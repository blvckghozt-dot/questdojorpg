/* QuestDojo RPG — player store. The server (/api on this site) is the source of truth for the character,
   EXP, dungeon kills, weekly counts and energy; this keeps a cached copy for display plus display preferences.
   Players who are not signed in are identified by a device key (localStorage 'qd.token');
   signed-in players by their Math a Day account session (cookie on .mathaday.app). */
var Store = (function () {
  'use strict';
  var TKEY = 'qd.token', CKEY = 'qd.cache', PREF = 'qd.prefs', SEEN = 'qd.seenWeek', LEGACY = 'qd.player', listeners = [];
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function parse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function subscribe(f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; }

  var base = QC.defaultSettings(); base.levelRequirements = Dojo.LEVEL_REQS;
  var prefs = Object.assign({ soundEnabled: true, sfxVolume: 70, reducedMotion: false, screenShakeEnabled: true }, parse(lsGet(PREF)) || {});
  function settings() { return Object.assign({}, base, prefs); }
  function setPref(patch) { Object.assign(prefs, patch); lsSet(PREF, JSON.stringify(prefs)); emit(); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }

  // S.status: 'loading' | 'ready' | 'offline'
  var S = { status: 'loading', player: parse(lsGet(CKEY)), account: null, link: null, device: null, error: '', migrated: false };
  function setPlayer(p) { S.player = p || null; if (p) lsSet(CKEY, JSON.stringify(p)); else lsDel(CKEY); emit(); }
  function token() { return lsGet(TKEY) || ''; }

  function ApiError(status, body) { var e = new Error((body && body.message) || ('HTTP ' + status)); e.status = status; e.code = body && body.error; return e; }
  async function api(path, body, method) {
    var h = { 'x-dojo-token': token() }; if (body) h['Content-Type'] = 'application/json';
    var r = await fetch('/api/' + path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: h, body: body ? JSON.stringify(body) : undefined });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw ApiError(r.status, j);
    return j;
  }

  async function boot() {
    S.status = 'loading'; emit();
    try {
      var me = await api('me');
      S.account = me.account; S.link = me.link || null; S.device = me.device || null; S.status = 'ready'; S.error = '';
      if (!me.player) {
        // a round-1 character kept only in this browser: recreate it on the server (name, race and element)
        var old = parse(lsGet(LEGACY));
        if (old && old.race && old.element && !Dojo.nickError(old.nick)) {
          try { await create({ nick: old.nick, race: old.race, element: old.element }); S.migrated = true; } catch (e) { }
          lsDel(LEGACY); return;
        }
      }
      setPlayer(me.player);
    } catch (e) { S.status = 'offline'; S.error = e.message; emit(); }
  }
  async function create(o) {
    var r = await api('player', { nick: o.nick, race: o.race, element: o.element });
    if (r.token && !S.account) lsSet(TKEY, r.token);
    lsSet(SEEN, Dojo.weekKey());
    setPlayer(r.player); return r.player;
  }
  async function rename(nick) { var r = await api('rename', { nick: nick }); setPlayer(r.player); }
  async function link(keep) { var r = await api('link', { keep: keep }); S.link = null; S.device = null; setPlayer(r.player); }
  function skipLink() { S.link = null; S.device = null; emit(); }
  async function dungeonStart(id) { return api('dungeon/start', { id: id }); }
  async function dungeonFinish(run, answers, ms) {
    var r = await api('dungeon/finish', { run: run, answers: answers, ms: ms });
    setPlayer(r.player); return r;
  }
  async function board(kind) { return api('board?kind=' + encodeURIComponent(kind)); }
  async function queueCounts() { return api('arena/queue'); }
  function arenaUrl(mode) {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/arena/ws?mode=' + mode + '&lang=' + (UI.lang === 'en' ? 'en' : 'th') + '&token=' + encodeURIComponent(token());
  }
  async function refresh() { try { var me = await api('me'); S.account = me.account; setPlayer(me.player); } catch (e) { } }

  // device key: lets a player who is not signed in move to another device
  function deviceKey() { return token(); }
  async function useDeviceKey(k) {
    k = String(k || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(k)) throw new Error('key');
    var prev = token(); lsSet(TKEY, k);
    try { var me = await api('me'); if (!me.player) throw new Error('key'); S.account = me.account; setPlayer(me.player); }
    catch (e) { if (prev) lsSet(TKEY, prev); else lsDel(TKEY); throw new Error('key'); }
  }
  function forgetDevice() { lsDel(TKEY); lsDel(CKEY); S.player = null; emit(); }

  function get() { return S.player; }
  function asStudent() { var p = S.player; return p ? { id: p.id, race: p.race, element: p.element, nick: p.nick, name: p.nick } : null; }
  function level() { return S.player ? Dojo.levelOf(S.player.exp) : 1; }
  function isAlive(monId) { return !S.player || (S.player.kills || {})[monId] !== Dojo.weekKey(); }
  function week() { var p = S.player, k = Dojo.weekKey(); return p && p.week && p.week.key === k ? p.week : { key: k, clears: 0, wins: 0, battles: 0 }; }
  function energy() { return Dojo.energyNow(S.player && S.player.energy); }
  function setEnergy(e) { if (S.player && e) { S.player.energy = e; setPlayer(S.player); } }
  function takeNewWeek() { if (!S.player) return false; var k = Dojo.weekKey(), seen = lsGet(SEEN); lsSet(SEEN, k); return !!seen && seen !== k; }
  function errText(e) { return (e && e.message) || String(e); }
  function expOf() { return S.player ? S.player.exp : 0; }

  return { S: S, settings: settings, setPref: setPref, subscribe: subscribe, emit: emit, lsGet: lsGet, lsSet: lsSet, errText: errText, expOf: expOf,
    boot: boot, create: create, rename: rename, link: link, skipLink: skipLink, dungeonStart: dungeonStart, dungeonFinish: dungeonFinish, board: board,
    queueCounts: queueCounts, arenaUrl: arenaUrl, refresh: refresh, deviceKey: deviceKey, useDeviceKey: useDeviceKey, forgetDevice: forgetDevice,
    get: get, asStudent: asStudent, level: level, isAlive: isAlive, week: week, energy: energy, setEnergy: setEnergy, takeNewWeek: takeNewWeek };
})();
