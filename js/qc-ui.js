/* QuestClass RPG — UI foundation: i18n, sound, sprite cache, shared components */
var HP = window.htmPreact;
var html = HP.html, render = HP.render, useState = HP.useState, useEffect = HP.useEffect, useRef = HP.useRef, useMemo = HP.useMemo, useCallback = HP.useCallback;

// ---------- global UI state ----------
var UI = {
  page: 'attendance', lang: (Store.lsGet('qc.lang') === 'en' ? 'en' : 'th'), present: false, drawer: false,
  modal: null, toasts: [], ann: [], annQueue: [], listeners: [], selection: [], confirm: null
};
function uiEmit() { UI.listeners.forEach(function (f) { f(); }); }
function setUI(patch) { Object.assign(UI, patch); uiEmit(); }
function useApp() {
  var s = useState(0), force = s[1];
  useEffect(function () {
    var f = function () { force(function (n) { return n + 1; }); };
    UI.listeners.push(f); var un = Store.subscribe(f);
    return function () { UI.listeners = UI.listeners.filter(function (x) { return x !== f; }); un(); };
  }, []);
}
function L(th, en) { return UI.lang === 'en' ? (en || th) : th; }
function raceName(id) { var r = QC.raceById[id]; return r ? L(r.th, r.en) : L('ยังไม่เลือก', 'Not chosen'); }
function elemName(id) { var e = QC.elemById[id]; return e ? L(e.th, e.en) : L('ยังไม่เลือก', 'Not chosen'); }
function fmtDateTH(d) { if (!d) return ''; var p = d.split('-'); var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], me = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return +p[2] + ' ' + L(m[+p[1] - 1], me[+p[1] - 1]); }
function fmtTime(iso) { try { var d = new Date(iso); return d.toLocaleString(UI.lang === 'en' ? 'en-GB' : 'th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }

// ---------- toasts & announcements ----------
function toast(msg, kind) {
  var id = Math.random(); UI.toasts = UI.toasts.concat([{ id: id, msg: msg, kind: kind || 'ok' }]).slice(-4); uiEmit();
  setTimeout(function () { UI.toasts = UI.toasts.filter(function (t) { return t.id !== id; }); uiEmit(); }, kind === 'err' ? 6500 : 3200);
}
function failToast(e) { toast((e && (e.userError ? e.message : Store.errText(e))) || L('บันทึกไม่สำเร็จ', 'Save failed'), 'err'); }
function announce(item) {
  item.id = Math.random();
  UI.annQueue.push(item); if (UI.annQueue.length > 50) UI.annQueue.shift(); pumpAnn();
}
function pumpAnn() {
  while (UI.ann.length < 3 && UI.annQueue.length) {
    var it = UI.annQueue.shift(); UI.ann = UI.ann.concat([it]);
    (function (id) { setTimeout(function () { dismissAnn(id); }, 6500); })(it.id);
  }
  uiEmit();
}
function dismissAnn(id) { UI.ann = UI.ann.filter(function (a) { return a.id !== id; }); pumpAnn(); }
function announceLevelUps(list) {
  if (!list || !list.length) return;
  var cls = Store.activeClass(); if (!cls) return;
  var byId = {}; (cls.students || []).forEach(function (x) { byId[x.id] = x; });
  var items = list.map(function (lu) { var s = byId[lu.sid]; return s ? { s: s, lu: lu, up: lu.to > lu.from, stageUp: QC.stageOf(lu.to) !== QC.stageOf(lu.from) && lu.to > lu.from } : null; }).filter(Boolean);
  var one = function (it) {
    var s = it.s, lu = it.lu;
    var detail = it.up ? 'Lv.' + lu.from + ' → Lv.' + lu.to : L('ระดับลดเป็น Lv.' + lu.to, 'Level down to Lv.' + lu.to);
    if (it.stageUp && s.race) detail += ' • ' + L('ปลดล็อก: ', 'Unlocked: ') + QC.titleOf(s.race, s.element, lu.to, UI.lang) + ' • ' + QC.weaponOf(s.race, lu.to);
    announce({ kind: it.up ? 'level' : 'down', title: s.nick || s.name, detail: detail, student: s, level: lu.to });
  };
  if (items.length <= 3) items.forEach(one);
  else {
    // many at once (e.g. whole-class check-in): one summary card, plus individual cards only for new evolution stages
    var ups = items.filter(function (it) { return it.up; });
    if (ups.length) announce({ kind: 'level', title: L('เลเวลอัป ' + ups.length + ' คน!', ups.length + ' adventurers levelled up!'), detail: ups.slice(0, 8).map(function (it) { return (it.s.nick || it.s.name) + ' Lv.' + it.lu.to; }).join(' • ') + (ups.length > 8 ? L(' และอีก ' + (ups.length - 8) + ' คน', ' +' + (ups.length - 8) + ' more') : '') });
    items.filter(function (it) { return it.stageUp; }).slice(0, 6).forEach(one);
  }
  if (items.some(function (it) { return it.stageUp; })) sfx('fanfare'); else if (items.some(function (it) { return it.up; })) sfx('levelup');
}
async function giveExp(classId, opts) {
  var r = await Store.award(classId, opts);
  announceLevelUps(r.levelUps);
  return r;
}

// ---------- confirm dialog (window.confirm is not available in the viewer) ----------
function askConfirm(opts) { return new Promise(function (resolve) { setUI({ confirm: Object.assign({}, opts, { resolve: resolve }) }); }); }

// ---------- sound (Web Audio synth; follows sound settings) ----------
var Audio_ = { ctx: null };
function audioCtx() {
  if (!Audio_.ctx) { try { var AC = window.AudioContext || window.webkitAudioContext; Audio_.ctx = AC ? new AC() : null; } catch (e) { Audio_.ctx = null; } }
  if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume().catch(function () { });
  return Audio_.ctx;
}
function tone(ctx, t0, freq, dur, type, vol, slideTo) {
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(ctx, t0, dur, vol, hp) {
  var len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
  src.buffer = buf; g.gain.value = vol; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t0);
}
function sfx(name) {
  var st = Store.settings(); if (!st.soundEnabled) return;
  var ctx = audioCtx(); if (!ctx) return;
  var v = (st.sfxVolume / 100) * 0.22, t = ctx.currentTime + 0.01;
  switch (name) {
    case 'tick': tone(ctx, t, 1200, 0.05, 'square', v * 0.5); break;
    case 'blip': tone(ctx, t, 660 + Math.random() * 440, 0.05, 'square', v * 0.45); break;
    case 'select': tone(ctx, t, 880, 0.08, 'triangle', v); tone(ctx, t + 0.07, 1320, 0.12, 'triangle', v); break;
    case 'correct': tone(ctx, t, 660, 0.09, 'square', v); tone(ctx, t + 0.09, 990, 0.16, 'square', v); break;
    case 'wrong': tone(ctx, t, 220, 0.25, 'sawtooth', v, 110); break;
    case 'slash': noise(ctx, t, 0.16, v * 1.2, 1800); tone(ctx, t, 900, 0.1, 'triangle', v * 0.6, 300); break;
    case 'smash': noise(ctx, t, 0.22, v * 1.4, 200); tone(ctx, t, 140, 0.2, 'square', v, 60); break;
    case 'shot': noise(ctx, t, 0.1, v, 2500); tone(ctx, t, 1500, 0.12, 'square', v * 0.6, 400); break;
    case 'magic': [880, 1175, 1568].forEach(function (f, i) { tone(ctx, t + i * 0.05, f, 0.2, 'sine', v * 0.8); }); break;
    case 'sound': [523, 659, 784, 1046].forEach(function (f, i) { tone(ctx, t + i * 0.06, f, 0.25, 'triangle', v * 0.7); }); break;
    case 'thrust': noise(ctx, t, 0.08, v, 3000); tone(ctx, t, 1400, 0.09, 'sawtooth', v * 0.5, 700); break;
    case 'hit': noise(ctx, t, 0.12, v * 1.2, 600); tone(ctx, t, 180, 0.15, 'square', v * 0.7, 90); break;
    case 'coin': tone(ctx, t, 988, 0.07, 'square', v * 0.7); tone(ctx, t + 0.07, 1319, 0.2, 'square', v * 0.7); break;
    case 'levelup': [523, 659, 784, 1046].forEach(function (f, i) { tone(ctx, t + i * 0.08, f, 0.14, 'square', v * 0.7); }); break;
    case 'fanfare': [523, 523, 523, 659, 784, 659, 784, 1046].forEach(function (f, i) { tone(ctx, t + i * 0.1, f, 0.16, 'square', v * 0.75); }); break;
    case 'victory': [392, 523, 659, 784, 1046, 784, 1046].forEach(function (f, i) { tone(ctx, t + i * 0.11, f, 0.2, 'square', v * 0.8); }); break;
    case 'timeup': [880, 660, 880, 660].forEach(function (f, i) { tone(ctx, t + i * 0.18, f, 0.16, 'square', v); }); break;
    case 'roar': tone(ctx, t, 90, 0.6, 'sawtooth', v * 1.3, 50); noise(ctx, t, 0.5, v * 0.8, 150); break;
    case 'drum': tone(ctx, t, 120, 0.12, 'sine', v * 1.4, 60); break;
  }
}

// ---------- sprites → image URLs (cached) ----------
var Sprites = { cache: {} };
function bufURL(w, h, data, crop) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var ctx = c.getContext('2d'); var img = ctx.createImageData(w, h); img.data.set(data); ctx.putImageData(img, 0, 0);
  if (crop) { var c2 = document.createElement('canvas'); c2.width = crop[2]; c2.height = crop[3]; c2.getContext('2d').drawImage(c, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]); return c2.toDataURL('image/png'); }
  return c.toDataURL('image/png');
}
function charArt(race, elem, stage) {
  var key = race && elem ? race + '-' + elem + '-' + stage : 'none';
  if (Sprites.cache[key]) return Sprites.cache[key];
  var r;
  if (key === 'none') {
    r = SPR.renderCharacter('human', 'earth', 1);
    var d = r.base; for (var i = 0; i < d.length; i += 4) { var gv = (d[i] * 0.3 + d[i + 1] * 0.5 + d[i + 2] * 0.2) * 0.55 + 20; d[i] = gv; d[i + 1] = gv; d[i + 2] = gv + 18; }
  } else r = SPR.renderCharacter(race, elem, stage);
  var top = Math.max(0, r.headTop - 8);
  var out = { base: bufURL(r.w, r.h, r.base), aura: bufURL(r.w, r.h, r.aura), portrait: bufURL(r.w, r.h, r.base, [SPR.W / 2 - 16, top, 32, 32]), headTop: r.headTop, feetY: r.feetY };
  Sprites.cache[key] = out; return out;
}
function monsterArt(id) {
  var key = 'm:' + id; if (Sprites.cache[key]) return Sprites.cache[key];
  var r = SPR.renderMonster(id);
  var out = { base: bufURL(r.w, r.h, r.base), aura: bufURL(r.w, r.h, r.aura) };
  Sprites.cache[key] = out; return out;
}
function teacherArt() {
  if (Sprites.cache.teacher) return Sprites.cache.teacher;
  var r = SPR.renderTeacher();
  var out = { base: bufURL(r.w, r.h, r.base), aura: bufURL(r.w, r.h, r.aura), portrait: bufURL(r.w, r.h, r.base, [SPR.W / 2 - 16, 26, 32, 32]) };
  Sprites.cache.teacher = out; return out;
}
function monsterFor(mode, diff) { return SPR.MONSTERS.filter(function (m) { return m.mode === mode && m.diff === diff; })[0]; }

// ---------- student derived data ----------
function studentInfo(s, st) {
  st = st || Store.settings();
  var exp = Store.expOf(s.id), prog = QC.levelProgress(exp, st.levelRequirements), level = prog.level;
  return { exp: exp, level: level, stage: QC.stageOf(level), prog: prog, title: QC.titleOf(s.race, s.element, level, UI.lang), weapon: s.race ? QC.weaponOf(s.race, level) : '', armor: s.race ? QC.armorOf(s.race, level) : '', stats: QC.stats(level) };
}
var FX = { sword: 'slash', dualsword: 'slash', greatsword: 'slash', dualaxe: 'slash', greataxe: 'slash', plasmaaxe: 'slash', scythe: 'slash', dagger: 'slash', dualdagger: 'slash', claw: 'slash',
  spear: 'thrust', rapier: 'thrust', needle: 'thrust',
  hammer: 'smash', warhammer: 'smash', sledge: 'smash', maul: 'smash', piston: 'smash', wrench: 'smash', towershield: 'smash', swordshield: 'smash', flail: 'smash', orbflail: 'smash', whip: 'smash', knuckles: 'smash',
  blunderbuss: 'shot', armcannon: 'shot', drones: 'shot', longbow: 'shot', shortbow: 'shot', darts: 'shot', chakram: 'shot',
  staff: 'magic', twigstaff: 'magic', greatstaff: 'magic', orb: 'magic', wand: 'magic', vinewand: 'magic', scepter: 'magic', grimoire: 'magic',
  lyre: 'sound', flute: 'sound' };
function fxOf(s, level) { return s && s.race ? FX[QC.weaponKindOf(s.race, level)] || 'slash' : 'slash'; }

// ---------- components ----------
function Hero(p) {
  // p: student|null, size, mode ('full'|'portrait'), aura (bool), anim (''|'attack'|'hit'|'win'|'lose'), face ('right'|'left'), teacher
  var st = Store.settings();
  var art, level = p.level;
  if (p.teacher) art = teacherArt();
  else {
    var s = p.student;
    if (level === undefined) level = s ? QC.levelFromExp(Store.expOf(s.id), st.levelRequirements) : 1;
    art = s && s.race && s.element ? charArt(s.race, s.element, QC.stageOf(level)) : charArt(null, null, 1);
  }
  var size = p.size || 64;
  if (p.teacher && !p.fallback) {
    var tfb = function () { return html`<${Hero} teacher=${true} fallback=${true} size=${size} mode=${p.mode} anim=${p.anim} idle=${p.idle} face=${p.face} aura=${p.aura} />`; };
    if (p.mode === 'portrait') return html`<${RealPortrait} race="npc" stage="teacher" size=${size} fb=${tfb} />`;
    return html`<${SpriteHero} race="npc" stage="teacher" size=${size} anim=${p.anim} idle=${p.idle} face=${p.face} aura=${p.aura === false ? false : size >= 60} holy=${true} fb=${tfb} />`;
  }
  if (!p.teacher && !p.fallback && s && s.race && s.element && RealArt.has(s.race, QC.stageOf(level))) {
    var stg = QC.stageOf(level);
    if (p.mode === 'portrait') return html`<${RealPortrait} race=${s.race} element=${s.element} stage=${stg} size=${size} />`;
    return html`<${SpriteHero} race=${s.race} element=${s.element} stage=${stg} level=${level} size=${size} anim=${p.anim} idle=${p.idle} walk=${p.walk} face=${p.face} aura=${p.aura} fx=${p.fx} fxColor=${p.fxColor} />`;
  }
  var cls = 'hero ' + (p.mode === 'portrait' ? 'portrait' : 'full') + (p.face === 'left' ? ' face-left' : '') + (p.anim ? ' anim-' + p.anim : '') + (p.idle ? ' idle' : '');
  if (p.mode === 'portrait') return html`<span class=${cls} style=${'width:' + size + 'px;height:' + size + 'px'}><img src=${art.portrait} alt="" draggable="false" /></span>`;
  var auraOn = !p.teacher && p.aura !== false && st.auraEnabled && level >= st.auraMinLevel && s && s.element;
  return html`<span class=${cls} style=${'width:' + size + 'px;height:' + size + 'px'}>
    ${auraOn && st.elementFx && size >= 60 ? html`<${ElemAura} el=${s.element} level=${level} />` : null}
    ${p.aura !== false && (p.teacher || auraOn || level < 50) ? html`<img class="aura" src=${art.aura} alt="" draggable="false" />` : null}
    <img class="base" src=${art.base} alt="" draggable="false" />
  </span>`;
}
function RealPortrait(p) {
  var fs = useState(0), force = fs[1];
  useEffect(function () { return RealArt.onReady(function () { force(function (n) { return n + 1; }); }); }, []);
  var url = RealArt.portraitNow(p.race, p.element, p.stage);
  if (!url && p.fb) return p.fb();
  if (!url) return html`<${Hero} student=${{ race: p.race, element: p.element }} level=${p.stage} size=${p.size} mode="portrait" fallback=${true} />`;
  return html`<span class="hero portrait" style=${'width:' + p.size + 'px;height:' + p.size + 'px'}><img src=${url} alt="" draggable="false" /></span>`;
}
function Monster(p) {
  var size = p.size || 160;
  var fb = function () { return html`<${ProcMonster} id=${p.id} size=${size} face=${p.face} anim=${p.anim} idle=${p.idle} />`; };
  // real art faces left (south-west) already, so it is never mirrored
  return html`<span class=${'monster real-mon' + (p.anim ? ' anim-' + p.anim : '')} style=${'width:' + size + 'px;height:' + size + 'px'}>
    <${SpriteHero} race="npc" stage=${'mon-' + p.id} size=${size} anim=${p.anim === 'alert' ? '' : p.anim} idle=${p.idle} aura=${false} fb=${fb} /></span>`;
}
function ProcMonster(p) {
  var art = monsterArt(p.id), size = p.size || 160;
  return html`<span class=${'monster' + (p.face === 'left' ? ' face-left' : '') + (p.anim ? ' anim-' + p.anim : '') + (p.idle ? ' idle' : '')} style=${'width:' + size + 'px;height:' + size + 'px'}>
    <img class="aura" src=${art.aura} alt="" draggable="false" /><img class="base" src=${art.base} alt="" draggable="false" /></span>`;
}
function TeacherSay(p) {
  return html`<div class=${'teacher-say ' + (p.kind || '')}><${Hero} teacher=${true} size=${p.size || 56} mode="full" aura=${false} />
    <div class="bubble"><b>${L('อาจารย์แม็ก', 'Master Max')}</b><span>${p.children}</span></div></div>`;
}
function Modal(p) {
  var ref = useRef(null);
  useEffect(function () {
    var prev = document.activeElement;
    var el = ref.current; if (el) { var f = el.querySelector('[autofocus], input, select, textarea, button'); if (f) f.focus(); }
    var onKey = function (e) { if (e.key === 'Escape' && p.onClose) p.onClose(); };
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  }, []);
  return html`<div class="modal-back" onClick=${function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); }}>
    <div class=${'modal ' + (p.wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref=${ref}>
      <header class="modal-head"><h2 id="modal-title">${p.title}</h2>${p.onClose ? html`<button class="icon-btn" aria-label=${L('ปิด', 'Close')} onClick=${p.onClose}>✕</button>` : null}</header>
      <div class="modal-body">${p.children}</div>
      ${p.footer ? html`<footer class="modal-foot">${p.footer}</footer>` : null}
    </div></div>`;
}
function ConfirmHost() {
  var c = UI.confirm; if (!c) return null;
  var close = function (v) { setUI({ confirm: null }); c.resolve(v); };
  return html`<${Modal} title=${c.title} onClose=${function () { close(false); }} footer=${html`
      <button class="btn ghost" onClick=${function () { close(false); }}>${L('ยกเลิก', 'Cancel')}</button>
      <button class=${'btn ' + (c.danger ? 'danger' : 'gold')} onClick=${function () { close(true); }}>${c.ok || L('ยืนยัน', 'Confirm')}</button>`}>
    <div class="confirm-text">${c.body}</div></${Modal}>`;
}
function Toasts() {
  return html`<div class="toasts" role="status" aria-live="polite">${UI.toasts.map(function (t) { return html`<div key=${t.id} class=${'toast ' + t.kind}>${t.kind === 'err' ? '⚠ ' : '✓ '}${t.msg}</div>`; })}</div>`;
}
function Announcements() {
  return html`<div class="ann-stack">${UI.ann.map(function (a) {
    return html`<div key=${a.id} class=${'ann ' + a.kind}>
      <div class="ann-art">${a.student ? html`<${Hero} student=${a.student} level=${a.level} size=${72} aura=${true} />` : html`<${Hero} teacher=${true} size=${72} />`}</div>
      <div class="ann-text"><div class="ann-kicker">${a.kind === 'level' ? 'LEVEL UP!' : a.kind === 'victory' ? 'VICTORY!' : a.kind === 'down' ? L('ปรับระดับ', 'LEVEL CHANGE') : L('ประกาศ', 'NOTICE')}</div>
        <b>${a.title}</b><span>${a.detail}</span></div>
      <button class="icon-btn" aria-label=${L('ปิด', 'Close')} onClick=${function () { dismissAnn(a.id); }}>✕</button></div>`;
  })}</div>`;
}
function ExpBar(p) { return html`<div class="expbar" title=${p.title || ''}><i style=${'width:' + Math.max(0, Math.min(100, p.pct)) + '%'}></i></div>`; }
function Empty(p) { return html`<div class="empty"><${TeacherSay}>${p.children}</${TeacherSay}>${p.action || null}</div>`; }
function Tabs(p) {
  return html`<div class="tabs" role="tablist">${p.items.map(function (it) {
    return html`<button role="tab" aria-selected=${p.value === it.id} class=${'tab' + (p.value === it.id ? ' on' : '')} onClick=${function () { p.onChange(it.id); }}>${it.label}</button>`;
  })}</div>`;
}
function NumberStepper(p) {
  var v = p.value;
  return html`<div class="stepper"><button class="btn sq" type="button" aria-label="-" onClick=${function () { p.onChange(Math.max(p.min, (+v || 0) - (p.step || 1))); }}>−</button>
    <input id=${p.id} type="number" inputmode="numeric" min=${p.min} max=${p.max} value=${v} onInput=${function (e) { p.onChange(e.target.value === '' ? '' : +e.target.value); }} />
    <button class="btn sq" type="button" aria-label="+" onClick=${function () { p.onChange(Math.min(p.max, (+v || 0) + (p.step || 1))); }}>+</button></div>`;
}
function Loading(p) { return html`<div class="loading"><span class="spin"></span>${p.text || L('กำลังโหลดข้อมูล…', 'Loading…')}</div>`; }
// press Enter (or Space) to go on when a result is showing
function useEnterKey(active, fn) {
  var ref = useRef(fn); ref.current = fn;
  useEffect(function () {
    if (!active) return;
    var h = function (e) { if ((e.key === 'Enter' || e.key === ' ') && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) && !UI.confirm) { e.preventDefault(); ref.current(); } };
    document.addEventListener('keydown', h); return function () { document.removeEventListener('keydown', h); };
  }, [active]);
}
function shake() { var st = Store.settings(); if (!st.screenShakeEnabled || st.reducedMotion) return; var el = document.querySelector('.stage'); if (!el) return; el.classList.remove('shaking'); void el.offsetWidth; el.classList.add('shaking'); }
function needClass() { var c = Store.activeClass(); return c; }

