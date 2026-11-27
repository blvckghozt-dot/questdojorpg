/* QuestDojo RPG — rules and local player store.
   Round 1: everything is kept in this browser (localStorage). Round 2 adds the server
   (arena, leaderboard, login) and moves a logged-in player's record there. */
var Dojo = (function () {
  'use strict';

  // ---------- level curve: QuestClass curve × 2 (Lv.99 = 1,998 EXP) ----------
  var LEVEL_REQS = QC.defaultRequirements().map(function (v) { return v * 2; });

  // ---------- time (Bangkok) & weeks (reset Monday 00:00) ----------
  var BKK = 7 * 3600 * 1000, DAY = 864e5;
  function weekKey(ms) { return QC.isoWeekKey(QC.bangkokDate(new Date(ms == null ? Date.now() : ms))); }
  function nextMonday(ms) {
    var now = ms == null ? Date.now() : ms, d = new Date(now + BKK);
    var dow = (d.getUTCDay() + 6) % 7, midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return midnight + (7 - dow) * DAY - BKK;
  }

  // ---------- dungeons: the 6 QuestClass topics × 3 difficulties ----------
  var MON_LEVEL = { easy: 10, medium: 35, hard: 65 };
  var DUNGEONS = [];
  QC.MODES.forEach(function (m) {
    QC.DIFFS.forEach(function (d, i) {
      var mon = SPR.MONSTERS.filter(function (x) { return x.mode === m.id && x.diff === d.id; })[0];
      if (mon) DUNGEONS.push({ id: mon.id, mode: m.id, diff: d.id, reward: m.rewards[i], level: MON_LEVEL[d.id], name: mon.name, th: mon.th });
    });
  });
  var dungeonById = {}; DUNGEONS.forEach(function (x) { dungeonById[x.id] = x; });
  var QUESTIONS = 10, SECONDS = 10;

  // ---------- weekly race/element matchups (same for everyone; the server will use the same seed) ----------
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  var mcache = {};
  function matchups(week) {
    week = week || weekKey();
    if (!mcache[week]) mcache[week] = {
      race: QC.randomMatchups(QC.RACES.map(function (r) { return r.id; }), QC.mulberry32(fnv('questdojo|race|' + week))),
      elem: QC.randomMatchups(QC.ELEMENTS.map(function (e) { return e.id; }), QC.mulberry32(fnv('questdojo|elem|' + week)))
    };
    return mcache[week];
  }
  var MATCH_PCT = 10;

  // ---------- damage with critical hits ----------
  // QuestClass damage formula; a fast answer (under 2.5 s) adds +15% critical chance on top of the level's CRIT.
  function damage(o, rng) {
    rng = rng || Math.random;
    var mu = matchups(o.week);
    var r = QC.computeDamage({ attLevel: o.attLevel, defLevel: o.defLevel, elapsedMs: o.elapsedMs, seconds: SECONDS,
      attElem: o.attElem, defElem: o.defElem, attRace: o.attRace, defRace: o.defRace,
      elemTable: mu.elem, raceTable: mu.race, elemPct: MATCH_PCT, racePct: MATCH_PCT, rng: rng });
    if (!r.critical && o.elapsedMs < 2500 && rng() < 0.15) { r.critical = true; r.damage = Math.round(r.damage * 1.35); }
    return r;
  }

  // ---------- energy for the arena: 10 max, +1 every 2 h 24 min (≈10 a day) ----------
  var ENERGY_MAX = 10, ENERGY_MS = 2.4 * 3600 * 1000;
  function energyNow(e, now) {
    now = now == null ? Date.now() : now;
    if (!e) return { n: ENERGY_MAX, at: now };
    var n = e.n, at = e.at;
    if (n >= ENERGY_MAX) return { n: ENERGY_MAX, at: now };
    var gained = Math.floor((now - at) / ENERGY_MS);
    if (gained > 0) { n = Math.min(ENERGY_MAX, n + gained); at = n >= ENERGY_MAX ? now : at + gained * ENERGY_MS; }
    return { n: n, at: at };
  }
  function energyNextIn(e, now) { now = now == null ? Date.now() : now; var c = energyNow(e, now); return c.n >= ENERGY_MAX ? 0 : c.at + ENERGY_MS - now; }

  // ---------- nicknames: 2–16 characters, no rude words ----------
  var BAD_ANY = ['fuck', 'fuk', 'shit', 'bitch', 'dick', 'cunt', 'pussy', 'porn', 'nigg', 'slut', 'whore', 'bastard', 'asshole', 'penis', 'vagina',
    'เหี้ย', 'เหี่ย', 'เฮี้ย', 'ควย', 'เย็ด', 'แตด', 'มึง', 'ไอ้สัตว์', 'อีสัตว์', 'ระยำ', 'ชาติหมา', 'จัญไร', 'ส้นตีน', 'พ่อมึง', 'แม่มึง', 'อีดอก', 'ดอกทอง', 'กะหรี่', 'ร่าน', 'เชี่ย', 'ชิบหาย', 'สันดาน', 'ไอ้เวร', 'อีเวร', 'หน้าหี', 'หน้าควย', 'สัสส'];
  // short words that are also parts of ordinary words: blocked only as the whole name or a whole word
  var BAD_WORD = ['สัส', 'สัด', 'หี', 'กู', 'ห่า', 'หำ', 'ตีน', 'ass', 'sex'];
  function squash(s) { return String(s).toLowerCase().normalize('NFC').replace(/[\s._\-0-9]+/g, ''); }
  function nickError(raw) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (s.length < 2) return 'short';
    if (s.length > 16) return 'long';
    if (!/^[฀-๿a-zA-Z0-9 ._\-]+$/.test(s)) return 'chars';
    var sq = squash(s);
    if (BAD_ANY.some(function (w) { return sq.indexOf(w) >= 0; })) return 'rude';
    var words = s.toLowerCase().split(/[\s._\-0-9]+/).filter(Boolean);
    if (BAD_WORD.some(function (w) { return sq === w || words.indexOf(w) >= 0; })) return 'rude';
    return '';
  }
  function cleanNick(raw) { return String(raw || '').trim().replace(/\s+/g, ' '); }

  return {
    LEVEL_REQS: LEVEL_REQS, weekKey: weekKey, nextMonday: nextMonday, DUNGEONS: DUNGEONS, dungeonById: dungeonById, QUESTIONS: QUESTIONS, SECONDS: SECONDS,
    matchups: matchups, MATCH_PCT: MATCH_PCT, damage: damage, ENERGY_MAX: ENERGY_MAX, ENERGY_MS: ENERGY_MS, energyNow: energyNow, energyNextIn: energyNextIn,
    nickError: nickError, cleanNick: cleanNick, fnv: fnv
  };
})();

/* Store: the one player on this device + display preferences. Same shape the QuestClass UI helpers expect
   (settings(), subscribe(), expOf(), lsGet/lsSet, errText). */
var Store = (function () {
  'use strict';
  var PKEY = 'qd.player', PREF = 'qd.prefs', listeners = [];
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

  var player = validPlayer(parse(lsGet(PKEY)));
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  function save() { if (!lsSet(PKEY, JSON.stringify(player))) toastSaveFail(); emit(); }
  function toastSaveFail() { if (typeof toast === 'function') toast(UI.lang === 'en' ? 'Could not save on this device' : 'บันทึกลงเครื่องไม่สำเร็จ', 'err'); }

  function validPlayer(p) {
    if (!p || typeof p !== 'object' || !p.id || !QC.raceById[p.race] || !QC.elemById[p.element]) return null;
    p.exp = Math.max(0, Math.round(+p.exp || 0));
    p.kills = p.kills && typeof p.kills === 'object' ? p.kills : {};
    p.total = Object.assign({ clears: 0, wins: 0, battles: 0 }, p.total || {});
    p.week = p.week && p.week.key ? p.week : { key: Dojo.weekKey(), clears: 0, wins: 0, battles: 0 };
    p.nick = Dojo.cleanNick(p.nick) || 'Adventurer';
    return p;
  }
  function uid() { try { return crypto.randomUUID(); } catch (e) { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } }
  function ensureWeek() { var k = Dojo.weekKey(); if (player && player.week.key !== k) player.week = { key: k, clears: 0, wins: 0, battles: 0 }; }

  function get() { if (player) ensureWeek(); return player; }
  function asStudent() { return player ? { id: player.id, race: player.race, element: player.element, nick: player.nick, name: player.nick } : null; }
  function level() { return player ? QC.levelFromExp(player.exp, Dojo.LEVEL_REQS) : 1; }
  function create(o) {
    var nick = Dojo.cleanNick(o.nick);
    if (Dojo.nickError(nick) || !QC.raceById[o.race] || !QC.elemById[o.element]) throw new Error('invalid');
    player = validPlayer({ id: uid(), nick: nick, race: o.race, element: o.element, exp: 0, createdAt: Date.now(), seenWeek: Dojo.weekKey(), energy: { n: Dojo.ENERGY_MAX, at: Date.now() } });
    save(); return player;
  }
  function rename(nick) { nick = Dojo.cleanNick(nick); if (Dojo.nickError(nick)) throw new Error('invalid'); player.nick = nick; save(); }
  function addExp(delta) {
    var from = level(); player.exp = Math.max(0, player.exp + delta); var to = level();
    return { from: from, to: to };
  }
  function isAlive(monId) { return !player || player.kills[monId] !== Dojo.weekKey(); }
  function clearDungeon(monId) {
    var d = Dojo.dungeonById[monId]; if (!d || !player) return null;
    ensureWeek();
    if (!isAlive(monId)) return null;
    player.kills[monId] = Dojo.weekKey(); player.week.clears++; player.total.clears++;
    var lv = addExp(d.reward); save();
    return { exp: d.reward, from: lv.from, to: lv.to };
  }
  function energy() { return Dojo.energyNow(player && player.energy); }
  // a new week since the player last looked: monsters respawned and matchups changed
  function takeNewWeek() {
    if (!player) return false; var k = Dojo.weekKey();
    if (player.seenWeek === k) return false;
    player.seenWeek = k; ensureWeek(); save(); return true;
  }
  function exportData() { return { app: 'QuestDojo RPG', v: 1, exportedAt: new Date().toISOString(), player: player }; }
  function importData(obj) {
    if (!obj || obj.app !== 'QuestDojo RPG') throw new Error('notdojo');
    var p = validPlayer(JSON.parse(JSON.stringify(obj.player || null)));
    if (!p) throw new Error('invalid');
    player = p; save(); return p;
  }
  function reset() { player = null; lsDel(PKEY); emit(); }
  function errText(e) { return (e && e.message) || String(e); }
  function expOf() { return player ? player.exp : 0; }

  return { settings: settings, setPref: setPref, subscribe: subscribe, lsGet: lsGet, lsSet: lsSet, errText: errText, expOf: expOf,
    get: get, asStudent: asStudent, level: level, create: create, rename: rename, isAlive: isAlive, clearDungeon: clearDungeon,
    energy: energy, takeNewWeek: takeNewWeek, exportData: exportData, importData: importData, reset: reset };
})();
