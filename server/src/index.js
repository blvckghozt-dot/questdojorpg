/* QuestDojo RPG — API server (Cloudflare Worker on questdojorpg.mathaday.app/api/*).
   - Players: device key (guest) or the Math a Day account session cookie (mad_sid, read from the account D1).
   - Dungeons: the server hands out a seed, rebuilds the 10 questions and checks the answers before giving EXP.
   - Arena: one Durable Object (Lobby) runs the queues and the live duels over WebSockets.
   - Weekly ranks: dungeon clears and arena wins, reset Monday 00:00 (Bangkok). */
import QC from '../../js/qc-core.js';
import Dojo from '../../js/dojo-rules.js';
import GK from './gk.js';

const JSONH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSONH });
const err = (status, code, msg) => json({ error: code, message: msg || code }, status);

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const randU32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
const uid = () => crypto.randomUUID();

// ---------- identity ----------
async function accountOf(req, env) {
  if (!env.ACCOUNT_DB) return null;
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)mad_sid=([a-f0-9]{64})/);
  if (!m) return null;
  try {
    return await env.ACCOUNT_DB.prepare('SELECT a.id, a.name, a.picture FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.hash = ? AND s.expires > ?')
      .bind(await sha256(m[1]), Date.now()).first();
  } catch (e) { console.error('account lookup', e); return null; }
}
async function playerByToken(env, tok) {
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  return env.DB.prepare('SELECT * FROM players WHERE token_hash = ?').bind(await sha256(tok)).first();
}
async function playerByAccount(env, acct) { return acct ? env.DB.prepare('SELECT * FROM players WHERE account_id = ?').bind(acct.id).first() : null; }
// the player this request acts for: the account's character when signed in and linked, else the device's
async function identify(req, env, tokOverride) {
  const acct = await accountOf(req, env);
  const tok = tokOverride || req.headers.get('x-dojo-token') || '';
  const byAcct = await playerByAccount(env, acct), byTok = await playerByToken(env, tok);
  return { acct, byAcct, byTok, player: byAcct || byTok };
}

// ---------- player rows ----------
function fresh(p, now = Date.now()) {
  const wk = Dojo.weekKey(now);
  if (p.week !== wk) { p.week = wk; p.w_clears = 0; p.w_wins = 0; p.w_battles = 0; }
  const e = Dojo.energyNow({ n: p.energy_n, at: p.energy_at }, now); p.energy_n = e.n; p.energy_at = e.at;
  return p;
}
function view(p, acct) {
  fresh(p);
  let kills = {}; try { kills = JSON.parse(p.kills || '{}'); } catch { }
  return {
    id: p.id, nick: p.nick, race: p.race, element: p.element, exp: p.exp, level: Dojo.levelOf(p.exp),
    kills, week: { key: p.week, clears: p.w_clears, wins: p.w_wins, battles: p.w_battles },
    total: { clears: p.t_clears, wins: p.t_wins, battles: p.t_battles },
    energy: { n: p.energy_n, at: p.energy_at }, linked: !!p.account_id, mine: acct ? p.account_id === acct.id : false
  };
}
function pub(p) { const lv = Dojo.levelOf(p.exp); return { id: p.id, nick: p.nick, race: p.race, element: p.element, level: lv }; }
async function savePlayer(env, p) {
  p.updated = Date.now();
  await env.DB.prepare('UPDATE players SET nick=?, exp=?, kills=?, week=?, w_clears=?, w_wins=?, w_battles=?, t_clears=?, t_wins=?, t_battles=?, energy_n=?, energy_at=?, updated=? WHERE id=?')
    .bind(p.nick, p.exp, p.kills, p.week, p.w_clears, p.w_wins, p.w_battles, p.t_clears, p.t_wins, p.t_battles, p.energy_n, p.energy_at, p.updated, p.id).run();
}
const getPlayer = (env, id) => env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();

// ---------- HTTP API ----------
async function api(req, env, url) {
  const p = url.pathname, m = req.method;
  if (m === 'POST' || m === 'PUT' || m === 'DELETE') {
    const o = req.headers.get('origin');
    if (o && o !== url.origin) return err(403, 'forbidden'); // same-origin only
  }
  const body = m === 'POST' ? await req.json().catch(() => ({})) : {};

  if (p === '/api/me' && m === 'GET') {
    const id = await identify(req, env);
    const out = { account: id.acct ? { name: id.acct.name, picture: id.acct.picture } : null, player: id.player ? view(id.player, id.acct) : null, week: Dojo.weekKey(), now: Date.now() };
    if (id.acct && !id.byAcct && id.byTok && !id.byTok.account_id) out.link = 'upload';                // device character, empty account
    if (id.acct && id.byAcct && id.byTok && id.byTok.id !== id.byAcct.id && !id.byTok.account_id) out.link = 'choose', out.device = view(id.byTok);
    return json(out);
  }

  if (p === '/api/player' && m === 'POST') {
    const nick = Dojo.cleanNick(body.nick);
    if (Dojo.nickError(nick)) return err(400, 'nick');
    if (!QC.raceById[body.race] || !QC.elemById[body.element]) return err(400, 'origin');
    const acct = await accountOf(req, env);
    if (acct && await playerByAccount(env, acct)) return err(409, 'exists');
    const now = Date.now(), tok = randHex(32), id = uid();
    await env.DB.prepare('INSERT INTO players (id, token_hash, account_id, nick, race, element, exp, kills, week, energy_n, energy_at, created, updated) VALUES (?, ?, ?, ?, ?, ?, 0, \'{}\', ?, ?, ?, ?, ?)')
      .bind(id, await sha256(tok), acct ? acct.id : null, nick, body.race, body.element, Dojo.weekKey(now), Dojo.ENERGY_MAX, now, now, now).run();
    return json({ token: tok, player: view(await getPlayer(env, id), acct) });
  }

  const id = await identify(req, env);
  const pl = id.player;

  if (p === '/api/link' && m === 'POST') {
    if (!id.acct) return err(401, 'signin');
    const dev = id.byTok;
    if (!dev || dev.account_id) return err(400, 'nothing');
    if (id.byAcct && body.keep !== 'device') return err(409, 'choose');
    if (id.byAcct) await env.DB.prepare('UPDATE players SET account_id = NULL WHERE id = ?').bind(id.byAcct.id).run(); // the old one is kept, unlinked
    await env.DB.prepare('UPDATE players SET account_id = ? WHERE id = ?').bind(id.acct.id, dev.id).run();
    return json({ player: view(await getPlayer(env, dev.id), id.acct) });
  }

  if (p === '/api/board' && m === 'GET') {
    const kind = url.searchParams.get('kind') === 'wins' ? 'w_wins' : 'w_clears', wk = Dojo.weekKey();
    const top = await env.DB.prepare(`SELECT id, nick, race, element, exp, ${kind} AS score FROM players WHERE week = ? AND ${kind} > 0 ORDER BY ${kind} DESC, updated ASC LIMIT 50`).bind(wk).all();
    let me = null;
    if (pl) {
      const v = view(pl), score = kind === 'w_wins' ? v.week.wins : v.week.clears;
      const ahead = score > 0 ? await env.DB.prepare(`SELECT COUNT(*) AS n FROM players WHERE week = ? AND (${kind} > ? OR (${kind} = ? AND updated < ?))`).bind(wk, score, score, pl.updated).first() : null;
      me = { score, rank: score > 0 ? ahead.n + 1 : null };
    }
    return json({ week: wk, kind: kind === 'w_wins' ? 'wins' : 'dungeon', resetAt: Dojo.nextMonday(), top: top.results.map((r) => ({ id: r.id, nick: r.nick, race: r.race, element: r.element, level: Dojo.levelOf(r.exp), score: r.score })), me });
  }

  if (p === '/api/arena/ws') {
    if (req.headers.get('upgrade') !== 'websocket') return err(426, 'websocket');
    const tid = await identify(req, env, url.searchParams.get('token') || '');
    if (!tid.player) return err(401, 'noplayer');
    const mode = url.searchParams.get('mode') === 'gk' ? 'gk' : 'math';
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    const h = new Headers(req.headers); h.set('x-dojo-player', tid.player.id); h.set('x-dojo-mode', mode); h.set('x-dojo-lang', url.searchParams.get('lang') === 'en' ? 'en' : 'th');
    return lobby.fetch(new Request('https://lobby/ws', { headers: h }));
  }
  if (p === '/api/arena/queue' && m === 'GET') {
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    return lobby.fetch(new Request('https://lobby/counts'));
  }
  if (!pl) return err(401, 'noplayer');

  if (p === '/api/rename' && m === 'POST') {
    const nick = Dojo.cleanNick(body.nick);
    if (Dojo.nickError(nick)) return err(400, 'nick');
    fresh(pl); pl.nick = nick; await savePlayer(env, pl);
    return json({ player: view(pl, id.acct) });
  }

  if (p === '/api/dungeon/start' && m === 'POST') {
    const d = Dojo.dungeonById[body.id]; if (!d) return err(400, 'dungeon');
    const v = view(pl);
    if (v.kills[d.id] === Dojo.weekKey()) return err(409, 'defeated');
    const run = uid(), seed = randU32(), now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM runs WHERE player_id = ? AND (done = 1 OR started < ?)').bind(pl.id, now - 3600e3),
      env.DB.prepare('INSERT INTO runs (id, player_id, monster, seed, started) VALUES (?, ?, ?, ?, ?)').bind(run, pl.id, d.id, seed, now)
    ]);
    return json({ run, seed });
  }

  if (p === '/api/dungeon/finish' && m === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM runs WHERE id = ? AND player_id = ?').bind(String(body.run || ''), pl.id).first();
    if (!r || r.done) return err(404, 'run');
    await env.DB.prepare('UPDATE runs SET done = 1 WHERE id = ?').bind(r.id).run();
    const qs = Dojo.dungeonQuestions(r.monster, r.seed), ans = Array.isArray(body.answers) ? body.answers : [], ms = Array.isArray(body.ms) ? body.ms : [];
    const limit = Dojo.SECONDS * 1000 + Dojo.GRACE_MS, elapsed = Date.now() - r.started;
    let ok = ans.length === Dojo.QUESTIONS && ms.length === Dojo.QUESTIONS;
    let sum = 0;
    for (let i = 0; ok && i < Dojo.QUESTIONS; i++) {
      const t = Number(ms[i]);
      if (ans[i] !== qs[i].correctIndex || !(t >= 250 && t <= limit)) ok = false;
      sum += t;
    }
    if (ok && elapsed < sum - 2000) ok = false;                    // cannot answer faster than the server clock allows
    if (ok && elapsed > sum + 10 * 60e3) ok = false;               // stale run
    const d = Dojo.dungeonById[r.monster], wk = Dojo.weekKey();
    fresh(pl);
    const kills = JSON.parse(pl.kills || '{}');
    if (!ok || kills[d.id] === wk) return json({ win: false, player: view(pl, id.acct) });
    const from = Dojo.levelOf(pl.exp);
    kills[d.id] = wk; pl.kills = JSON.stringify(kills); pl.exp += d.reward; pl.w_clears++; pl.t_clears++;
    await savePlayer(env, pl);
    return json({ win: true, exp: d.reward, from, to: Dojo.levelOf(pl.exp), player: view(pl, id.acct) });
  }

  return err(404, 'notfound');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return err(404, 'notfound');
    try { return await api(req, env, url); }
    catch (e) { console.error(e && e.stack || e); return err(500, 'server', 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง'); }
  }
};

// ================= ARENA LOBBY (Durable Object) =================
const COUNTDOWN_MS = 3200, NEXT_MS = 2600, END_MS = 1800;
function shuffle(a, rng) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Lobby {
  constructor(state, env) { this.state = state; this.env = env; this.queues = { math: [], gk: [] }; this.conns = new Map(); }

  counts() { return { math: this.queues.math.length, gk: this.queues.gk.length, playing: [...this.conns.values()].filter((c) => c.match).length }; }
  send(c, msg) { try { c.ws.send(JSON.stringify(msg)); } catch { } }
  broadcastCounts() { const n = this.counts(); for (const q of Object.values(this.queues)) for (const c of q) this.send(c, { t: 'queue', counts: n }); }
  dequeue(c) { const q = this.queues[c.mode]; const i = q.indexOf(c); if (i >= 0) q.splice(i, 1); clearTimeout(c.qTimer); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/counts') return json(this.counts());
    const id = req.headers.get('x-dojo-player'), mode = req.headers.get('x-dojo-mode'), lang = req.headers.get('x-dojo-lang');
    const row = await getPlayer(this.env, id);
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const c = { ws: server, id, mode, lang, match: null };
    const old = this.conns.get(id);
    if (old) { this.send(old, { t: 'replaced' }); this.drop(old, 'replaced'); try { old.ws.close(4000, 'replaced'); } catch { } }
    this.conns.set(id, c);
    server.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.onMessage(c, m); });
    server.addEventListener('close', () => this.drop(c, 'closed'));
    server.addEventListener('error', () => this.drop(c, 'closed'));
    if (!row) { this.send(c, { t: 'error', code: 'noplayer' }); server.close(4001, 'noplayer'); return new Response(null, { status: 101, webSocket: client }); }
    fresh(row);
    if (row.energy_n < 1) { this.send(c, { t: 'error', code: 'energy', energy: { n: row.energy_n, at: row.energy_at } }); server.close(4002, 'energy'); return new Response(null, { status: 101, webSocket: client }); }
    c.pub = pub(row); c.account = row.account_id;
    this.queues[mode].push(c);
    c.qTimer = setTimeout(() => { if (!c.match) { this.dequeue(c); this.send(c, { t: 'timeout' }); try { c.ws.close(1000, 'timeout'); } catch { } this.broadcastCounts(); } }, Dojo.QUEUE_MS);
    this.broadcastCounts();
    this.tryPair(mode);
    return new Response(null, { status: 101, webSocket: client });
  }

  drop(c, why) {
    if (this.conns.get(c.id) === c) this.conns.delete(c.id);
    if (!c.match) { this.dequeue(c); this.broadcastCounts(); return; }
    const mt = c.match; if (mt.over) return;
    const side = mt.c[0] === c ? 0 : 1;
    this.finish(mt, 1 - side, 'left');                               // leaving a duel forfeits it
  }

  onMessage(c, m) {
    if (m.t === 'leave' && !c.match) { this.dequeue(c); try { c.ws.close(1000, 'leave'); } catch { } this.broadcastCounts(); return; }
    if (m.t === 'a' && c.match) {
      const mt = c.match, side = mt.c[0] === c ? 0 : 1, q = mt.cur;
      if (!q || q.i !== m.i || q.ans[side]) return;
      const ms = Date.now() - q.sent;
      if (ms > Dojo.SECONDS * 1000 + Dojo.GRACE_MS) return;
      q.ans[side] = { c: Number.isInteger(m.c) ? m.c : -1, ms: Math.max(0, ms) };
      this.send(mt.c[1 - side], { t: 'opp-answered', i: q.i });
      if (q.ans[0] && q.ans[1]) this.resolve(mt);
    }
  }

  async tryPair(mode) {
    const q = this.queues[mode];
    for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) {
      const a = q[i], b = q[j];
      if (a.id === b.id || (a.account && a.account === b.account)) continue;
      this.dequeue(a); this.dequeue(b);
      await this.start(mode, a, b);
      return this.tryPair(mode);
    }
  }

  async start(mode, a, b) {
    const now = Date.now(), env = this.env;
    const rows = [await getPlayer(env, a.id), await getPlayer(env, b.id)].map((r) => fresh(r, now));
    if (rows.some((r) => r.energy_n < 1)) { for (const c of [a, b]) { this.send(c, { t: 'error', code: 'energy' }); try { c.ws.close(4002, 'energy'); } catch { } } return; }
    for (const r of rows) { r.energy_n -= 1; if (r.energy_n === Dojo.ENERGY_MAX - 1) r.energy_at = now; r.w_battles++; r.t_battles++; await savePlayer(env, r); }
    const rng = QC.mulberry32(randU32()), week = Dojo.weekKey(now);
    const pubs = rows.map(pub), hp = pubs.map((p) => Dojo.arenaHp(p.level));
    const qs = this.questions(mode, rng, (pubs[0].level + pubs[1].level) / 2);
    const mt = { mode, c: [a, b], p: pubs, hp: hp.slice(), max: hp.slice(), qs, i: -1, cur: null, right: [0, 0], fastMs: [0, 0], week, over: false, rng };
    a.match = mt; b.match = mt;
    const mu = [Dojo.matchupPct(pubs[0], pubs[1], week), Dojo.matchupPct(pubs[1], pubs[0], week)];
    [a, b].forEach((c, s) => this.send(c, { t: 'match', side: s, mode, players: pubs, hp: mt.hp, mu, energy: { n: rows[s].energy_n, at: rows[s].energy_at }, countdown: COUNTDOWN_MS }));
    this.broadcastCounts();
    mt.timer = setTimeout(() => this.ask(mt), COUNTDOWN_MS);
  }

  questions(mode, rng, avgLevel) {
    const out = [];
    if (mode === 'math') {
      const diff = Dojo.arenaDiff(avgLevel);
      for (let i = 0; i < Dojo.ARENA_QUESTIONS; i++) {
        const md = QC.MODES[Math.floor(rng() * QC.MODES.length)], q = QC.generateQuestion(md.id, diff, rng);
        out.push({ th: { text: q.text, choices: q.choices }, en: { text: q.text, choices: q.choices }, a: q.correctIndex });
      }
    } else {
      for (const g of shuffle(GK, rng).slice(0, Dojo.ARENA_QUESTIONS)) {
        const order = shuffle([0, 1, 2, 3], rng);
        out.push({ th: { text: g.t, choices: order.map((k) => g.c[k][0]) }, en: { text: g.e, choices: order.map((k) => g.c[k][1]) }, a: order.indexOf(g.a) });
      }
    }
    return out;
  }

  ask(mt) {
    if (mt.over) return;
    mt.i++;
    const q = mt.qs[mt.i];
    mt.cur = { i: mt.i, sent: Date.now(), ans: [null, null] };
    mt.c.forEach((c) => { const L = q[c.lang] || q.th; this.send(c, { t: 'q', i: mt.i, n: mt.qs.length, text: L.text, choices: L.choices, sec: Dojo.SECONDS }); });
    mt.timer = setTimeout(() => this.resolve(mt), Dojo.SECONDS * 1000 + Dojo.GRACE_MS);
  }

  resolve(mt) {
    if (mt.over || !mt.cur || mt.cur.done) return;
    clearTimeout(mt.timer);
    const q = mt.qs[mt.i], cur = mt.cur; cur.done = true;
    const res = [0, 1].map((s) => {
      const a = cur.ans[s], ok = !!a && a.c === q.a;
      if (!ok) return { c: a ? a.c : null, ok: false, ms: a ? a.ms : null, dmg: 0, crit: false };
      const att = mt.p[s], def = mt.p[1 - s];
      const d = Dojo.damage({ attLevel: att.level, defLevel: def.level, elapsedMs: a.ms, attElem: att.element, defElem: def.element, attRace: att.race, defRace: def.race, week: mt.week }, mt.rng);
      mt.right[s]++; mt.fastMs[s] += a.ms;
      return { c: a.c, ok: true, ms: a.ms, dmg: d.damage, crit: d.critical };
    });
    mt.hp[1] = Math.max(0, mt.hp[1] - res[0].dmg); mt.hp[0] = Math.max(0, mt.hp[0] - res[1].dmg);
    mt.c.forEach((c) => this.send(c, { t: 'r', i: mt.i, correct: q.a, res, hp: mt.hp }));
    const last = mt.i + 1 >= mt.qs.length || mt.hp[0] <= 0 || mt.hp[1] <= 0;
    mt.timer = setTimeout(() => (last ? this.finish(mt, this.winner(mt), mt.hp[0] <= 0 || mt.hp[1] <= 0 ? 'ko' : 'points') : this.ask(mt)), last ? END_MS : NEXT_MS);
  }

  // more HP left wins; then more correct answers; then the faster total time on correct answers
  winner(mt) {
    if (mt.hp[0] !== mt.hp[1]) return mt.hp[0] > mt.hp[1] ? 0 : 1;
    if (mt.right[0] !== mt.right[1]) return mt.right[0] > mt.right[1] ? 0 : 1;
    if (mt.right[0] && mt.fastMs[0] !== mt.fastMs[1]) return mt.fastMs[0] < mt.fastMs[1] ? 0 : 1;
    return -1;
  }

  async finish(mt, win, how) {
    if (mt.over) return; mt.over = true; clearTimeout(mt.timer);
    let result = { from: 0, to: 0 };
    if (win >= 0) {
      const r = fresh(await getPlayer(this.env, mt.p[win].id));
      result.from = Dojo.levelOf(r.exp); r.exp += Dojo.ARENA_WIN_EXP; r.w_wins++; r.t_wins++; result.to = Dojo.levelOf(r.exp);
      await savePlayer(this.env, r);
    }
    mt.c.forEach((c, s) => {
      this.send(c, { t: 'end', winner: win, how, hp: mt.hp, right: mt.right, exp: s === win ? Dojo.ARENA_WIN_EXP : 0, from: s === win ? result.from : null, to: s === win ? result.to : null });
      c.match = null;
      setTimeout(() => { try { c.ws.close(1000, 'end'); } catch { } }, 500);
    });
  }
}
