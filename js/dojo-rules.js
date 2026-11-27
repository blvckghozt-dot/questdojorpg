/* QuestDojo RPG — game rules shared by the web page and the server (pure functions, no DOM).
   Browser: needs the global QC (qc-core.js) loaded first and defines the global Dojo.
   Server: import Dojo from './dojo-rules.js' after QC is available as a module. */
(function (root, factory) {
  var QCref = typeof QC !== 'undefined' ? QC : (typeof require === 'function' ? require('./qc-core.js') : null);
  var Dojo = factory(QCref);
  if (typeof module !== 'undefined' && module.exports) module.exports = Dojo;
  else root.Dojo = Dojo;
})(typeof self !== 'undefined' ? self : this, function (QC) {
  'use strict';

  // ---------- level curve: QuestClass curve × 2, last step topped up so Lv.99 = exactly 2,000 EXP ----------
  var LEVEL_EXP_99 = 2000;
  var LEVEL_REQS = (function () {
    var r = QC.defaultRequirements().map(function (v) { return v * 2; });
    var sum = r.reduce(function (a, b) { return a + b; }, 0);
    r[r.length - 1] += LEVEL_EXP_99 - sum;
    return r;
  })();
  function levelOf(exp) { return QC.levelFromExp(exp || 0, LEVEL_REQS); }

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
  var DUNGEONS = QC.HOME_MONSTERS.map(function (m) {
    var mode = QC.modeById[m.mode], i = QC.diffIndex(m.diff);
    return { id: m.id, mode: m.mode, diff: m.diff, reward: mode.rewards[i], level: MON_LEVEL[m.diff], th: m.th };
  });
  var dungeonById = {}; DUNGEONS.forEach(function (x) { dungeonById[x.id] = x; });
  var QUESTIONS = 10, SECONDS = 10, GRACE_MS = 1500;
  // the 10 questions of one dungeon run, rebuilt identically on the server from the run's seed
  function dungeonQuestions(monId, seed) {
    var d = dungeonById[monId]; if (!d) return null;
    var rng = QC.mulberry32(seed >>> 0), out = [];
    for (var i = 0; i < QUESTIONS; i++) out.push(QC.generateQuestion(d.mode, d.diff, rng));
    return out;
  }

  // ---------- weekly race/element matchups (same for everyone) ----------
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
  function matchupPct(att, def, week) {
    var mu = matchups(week);
    return { e: QC.relationIn(mu.elem, att.element, def.element) * MATCH_PCT, r: QC.relationIn(mu.race, att.race, def.race) * MATCH_PCT };
  }

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

  // ---------- arena ----------
  // HP × 2.5 so a duel normally runs all 10 questions (a hit does ~20–30); K.O. only for a clear winner
  var ARENA_WIN_EXP = 5, ARENA_QUESTIONS = 10, QUEUE_MS = 60000, ARENA_HP_MULT = 2.5;
  function arenaHp(level) { return Math.round(QC.stats(level).hp * ARENA_HP_MULT); }
  // math duels mix all six topics; the difficulty follows the two players' average level
  function arenaDiff(avgLevel) { return avgLevel < 35 ? 'easy' : avgLevel < 65 ? 'medium' : 'hard'; }

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
  function cleanNick(raw) { return String(raw || '').trim().replace(/\s+/g, ' '); }
  function nickError(raw) {
    var s = cleanNick(raw);
    if (s.length < 2) return 'short';
    if (s.length > 16) return 'long';
    if (!/^[฀-๿a-zA-Z0-9 ._\-]+$/.test(s)) return 'chars';
    var sq = squash(s);
    if (BAD_ANY.some(function (w) { return sq.indexOf(w) >= 0; })) return 'rude';
    var words = s.toLowerCase().split(/[\s._\-0-9]+/).filter(Boolean);
    if (BAD_WORD.some(function (w) { return sq === w || words.indexOf(w) >= 0; })) return 'rude';
    return '';
  }

  return {
    LEVEL_REQS: LEVEL_REQS, LEVEL_EXP_99: LEVEL_EXP_99, levelOf: levelOf, weekKey: weekKey, nextMonday: nextMonday,
    DUNGEONS: DUNGEONS, dungeonById: dungeonById, QUESTIONS: QUESTIONS, SECONDS: SECONDS, GRACE_MS: GRACE_MS, dungeonQuestions: dungeonQuestions,
    matchups: matchups, matchupPct: matchupPct, MATCH_PCT: MATCH_PCT, damage: damage,
    ARENA_WIN_EXP: ARENA_WIN_EXP, ARENA_QUESTIONS: ARENA_QUESTIONS, QUEUE_MS: QUEUE_MS, arenaDiff: arenaDiff, arenaHp: arenaHp,
    ENERGY_MAX: ENERGY_MAX, ENERGY_MS: ENERGY_MS, energyNow: energyNow, energyNextIn: energyNextIn,
    nickError: nickError, cleanNick: cleanNick, fnv: fnv
  };
});
