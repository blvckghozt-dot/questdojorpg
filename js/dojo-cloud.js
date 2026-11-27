/* QuestDojo RPG — Math a Day account (account.mathaday.app): Google sign-in + saving the character to the account.
   Uses the shared account SDK (window.MathADay) and its per-app storage /api/data/questdojo.
   The session cookie is shared across *.mathaday.app, so this works on questdojorpg.mathaday.app (not on *.pages.dev). */
var Cloud = (function () {
  'use strict';
  var APP = 'questdojo';
  var S = { status: 'checking', me: null, rev: 0, linked: false, conflict: null, error: '' };
  var timer = null, pushing = false, again = false;
  function emit() { Store.emit(); }
  function base() { return window.MathADay ? window.MathADay.url : null; }
  function available() { return !!window.MathADay && /(^|\.)mathaday\.app$/.test(location.hostname); }
  function req(method, body) {
    return fetch(base() + '/api/data/' + APP, { method: method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function better(a, b) { return (a.exp || 0) !== (b.exp || 0) ? (a.exp || 0) > (b.exp || 0) : (a.savedAt || 0) >= (b.savedAt || 0); }

  async function init() {
    if (!available()) { S.status = 'unavailable'; emit(); return; }
    S.status = 'checking'; emit();
    var me = await window.MathADay.me();
    if (!me) { S.status = 'signedout'; S.me = null; emit(); return; }
    S.me = me; S.status = 'signedin';
    try { await pull(true); } catch (e) { S.error = String(e && e.message || e); }
    emit();
  }
  // first sync after sign-in: decide between the account's character and this device's
  async function pull(first) {
    var r = await req('GET');
    if (r._status !== 200) throw new Error(r.error || 'load failed');
    S.rev = r.rev || 0;
    var remote = r.data && r.data.player ? Store.validPlayer(JSON.parse(JSON.stringify(r.data.player))) : null, local = Store.snapshot();
    if (!remote && !local) { S.linked = true; return; }              // new player: the create screen will save into the account
    if (!remote && local) { if (first) { S.conflict = { kind: 'upload', local: local }; } return; }
    if (remote && !local) { Store.adopt(remote); S.linked = true; return; }
    if (remote.id === local.id) {                                        // same character on both: keep the further one
      S.linked = true;
      if (better(remote, local)) Store.adopt(remote); else schedule(0);
      return;
    }
    S.conflict = { kind: 'choose', local: local, remote: remote };      // two different characters: let the player choose
  }
  function schedule(ms) { if (!S.linked || S.status !== 'signedin') return; clearTimeout(timer); timer = setTimeout(push, ms == null ? 1200 : ms); }
  async function push() {
    if (pushing) { again = true; return; }
    var p = Store.snapshot(); if (!p) return;
    pushing = true;
    try {
      var r = await req('PUT', { data: { v: 1, player: p }, base: S.rev });
      if (r._status === 200) { S.rev = r.rev; S.error = ''; }
      else if (r._status === 409) {                                      // saved from another device meanwhile
        var g = await req('GET'); S.rev = g.rev || 0;
        var remote = g.data && g.data.player;
        if (remote && remote.id === p.id && better(remote, p)) { Store.adopt(remote); if (typeof toast === 'function') toast(L('โหลดความคืบหน้าล่าสุดจากอีกเครื่องแล้ว', 'Loaded newer progress from another device')); }
        else again = true;
      } else if (r._status === 401) { S.status = 'signedout'; S.me = null; S.linked = false; }
      else S.error = r.error || ('HTTP ' + r._status);
    } catch (e) { S.error = L('เชื่อมต่อบัญชีไม่ได้ จะลองใหม่อัตโนมัติ', 'Could not reach your account; will retry'); clearTimeout(timer); timer = setTimeout(push, 15000); }
    finally { pushing = false; emit(); if (again) { again = false; schedule(500); } }
  }
  // conflict choices
  async function useLocal() { S.conflict = null; S.linked = true; await push(); emit(); }
  function useRemote() { var c = S.conflict; S.conflict = null; S.linked = true; if (c && c.remote) Store.adopt(c.remote); emit(); }
  function stayOffline() { S.conflict = null; S.linked = false; emit(); }
  function signIn() { if (window.MathADay) window.MathADay.signIn(location.href); }
  async function signOut() {
    clearTimeout(timer);
    if (S.linked) await push().catch(function () { });
    await fetch(base() + '/api/logout', { method: 'POST', credentials: 'include' }).catch(function () { });
    S.me = null; S.status = 'signedout'; S.linked = false; S.rev = 0;
    Store.reset(); // the character lives in the account; keep shared school devices clean
  }
  Store.setOnSaved(function () { schedule(); });
  window.addEventListener('pagehide', function () { if (timer && S.linked) { clearTimeout(timer); var p = Store.snapshot(); if (p) fetch(base() + '/api/data/' + APP, { method: 'PUT', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { v: 1, player: p }, base: S.rev }) }).catch(function () { }); } });
  return { S: S, init: init, signIn: signIn, signOut: signOut, useLocal: useLocal, useRemote: useRemote, stayOffline: stayOffline, available: available, push: push };
})();
