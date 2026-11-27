/* QuestClass RPG — combat hit effects (drawn on the target) and element auras (drawn around a hero).
   Everything is inline SVG + CSS animation, coloured by element, so no extra art is needed. */

// small particle shapes per element, in a 0..10 box
var ELEM_PART = {
  fire: 'M5 0 C7 3 9 5 8 8 C7 10 3 10 2 8 C1 6 3 4 3 2 C4 4 5 4 5 0Z',
  water: 'M5 0 C7 4 9 6 8 8 C7 10 3 10 2 8 C1 6 3 4 5 0Z',
  wind: 'M1 6 C3 2 7 2 9 5 C7 4 4 4 3 7 C2 8 1 7 1 6Z',
  earth: 'M2 3 L6 1 L9 4 L8 8 L4 9 L1 7Z',
  ice: 'M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4Z',
  lightning: 'M6 0 L2 6 L5 6 L3 10 L8 4 L5 4 L7 0Z',
  light: 'M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4Z',
  dark: 'M5 1 C8 1 10 4 9 7 C8 10 3 10 1 7 C0 4 2 1 5 1Z'
};
function elemColor(el) { var e = QC.elemById[el]; return e ? e.color : '#ffffff'; }
function elemGlow(el) { var e = QC.elemById[el]; return e ? e.glow : '#ffffff'; }

// ---------- hit effect on the target ----------
// kind: slash | thrust | smash | shot | magic | sound | claw ; el: attacker element (colours + particles)
function HitFx(p) {
  var st = Store.settings(); if (!st.hitFx) return null;
  var c = p.color || elemColor(p.el), g = p.glow || elemGlow(p.el), kind = p.kind || 'slash', part = ELEM_PART[p.el] || ELEM_PART.light;
  var stroke = function (d, w, delay) {
    return html`<g class="hfx-stroke" style=${'animation-delay:' + (delay || 0) + 's'}>
      <path d=${d} stroke=${c} stroke-width=${w * 2.2} stroke-linecap="round" fill="none" opacity=".55" />
      <path d=${d} stroke=${g} stroke-width=${w * 1.2} stroke-linecap="round" fill="none" />
      <path d=${d} stroke="#fff" stroke-width=${w * 0.45} stroke-linecap="round" fill="none" /></g>`;
  };
  var body;
  if (kind === 'slash') body = html`${stroke('M22 18 Q48 44 80 84', 3.2, 0)}${stroke('M78 22 Q54 42 26 78', 2.4, 0.08)}`;
  else if (kind === 'claw') body = html`${stroke('M26 16 Q40 50 34 86', 2.6, 0)}${stroke('M44 12 Q58 48 52 88', 2.8, 0.05)}${stroke('M62 16 Q76 50 70 86', 2.6, 0.1)}`;
  else if (kind === 'thrust') body = html`${stroke('M8 50 L92 50', 3.4, 0)}<polygon class="hfx-pop" points="50,30 56,44 72,50 56,56 50,70 44,56 28,50 44,44" fill=${g} stroke="#fff" stroke-width="1.2" />`;
  else if (kind === 'smash') body = html`<circle class="hfx-ring" cx="50" cy="55" r="14" fill="none" stroke=${g} stroke-width="5" /><circle class="hfx-ring" style="animation-delay:.08s" cx="50" cy="55" r="10" fill="none" stroke="#fff" stroke-width="2" />
      ${[0, 60, 120, 180, 240, 300].map(function (a, i) { var r = a * Math.PI / 180; return html`<path key=${i} class="hfx-crack" d=${'M' + (50 + Math.cos(r) * 8) + ' ' + (55 + Math.sin(r) * 8) + ' L' + (50 + Math.cos(r + 0.2) * 22) + ' ' + (55 + Math.sin(r + 0.2) * 22) + ' L' + (50 + Math.cos(r) * 34) + ' ' + (55 + Math.sin(r) * 34)} stroke=${c} stroke-width="3" fill="none" />`; })}`;
  else if (kind === 'shot') body = html`<circle class="hfx-pop" cx="50" cy="50" r="16" fill=${g} /><circle class="hfx-pop" cx="50" cy="50" r="8" fill="#fff" />
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(function (a, i) { var r = a * Math.PI / 180; return html`<path key=${i} class="hfx-ray" d=${'M' + (50 + Math.cos(r) * 14) + ' ' + (50 + Math.sin(r) * 14) + ' L' + (50 + Math.cos(r) * 40) + ' ' + (50 + Math.sin(r) * 40)} stroke=${c} stroke-width="3" stroke-linecap="round" />`; })}`;
  else if (kind === 'magic') body = html`<g class="hfx-spin"><circle cx="50" cy="50" r="30" fill="none" stroke=${g} stroke-width="2.5" stroke-dasharray="6 4" /><circle cx="50" cy="50" r="20" fill="none" stroke=${c} stroke-width="2" />
      <polygon points="50,24 72,62 28,62" fill="none" stroke="#fff" stroke-width="1.5" /><polygon points="50,76 28,38 72,38" fill="none" stroke="#fff" stroke-width="1.5" /></g><circle class="hfx-pop" cx="50" cy="50" r="10" fill=${g} />`;
  else body = html`${[0, 1, 2].map(function (i) { return html`<circle key=${i} class="hfx-ring" style=${'animation-delay:' + i * 0.1 + 's'} cx="50" cy="50" r="12" fill="none" stroke=${i ? c : g} stroke-width="3" />`; })}`;
  var parts = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
    var a = i / 8 * Math.PI * 2 + 0.3, dx = Math.cos(a) * 34, dy = Math.sin(a) * 30;
    return html`<g key=${'p' + i} class="hfx-part" style=${'--dx:' + dx + 'px;--dy:' + dy + 'px;animation-delay:' + (0.05 + i * 0.02) + 's'}><path transform="translate(45 45)" d=${part} fill=${i % 2 ? g : c} stroke="#fff" stroke-width=".6" /></g>`;
  });
  return html`<span class=${'hitfx hfx-' + kind} key=${p.k} aria-hidden="true"><svg viewBox="0 0 100 100">${body}${parts}</svg></span>`;
}

// ---------- element aura (behind the hero) ----------
function auraCount(level) { return level >= 99 ? 9 : level >= 80 ? 7 : level >= 65 ? 6 : 5; }
function ElemAura(p) {
  var el = p.el, n = auraCount(p.level || 50), c = elemColor(el), g = elemGlow(el), items = [], i;
  var R = function (k, a, b) { var x = Math.sin((k + 1) * 12.9898 + (a || 0)) * 43758.5453; x = x - Math.floor(x); return x * ((b || 1)); };
  if (el === 'fire') {
    var m = n + 3;
    for (i = 0; i < m; i++) {
      var fx = 28 + i * (44 / (m - 1)), fs = 2.6 + R(i) * 2.4 + (i % 3 === 1 ? 1.2 : 0), base = 84 - Math.abs(i - (m - 1) / 2) * 0.9;
      items.push(html`<path key=${i} class="au-flame" style=${'animation-delay:-' + R(i, 3, 0.9) + 's'} d=${'M' + fx + ' ' + (base - fs * 3.2) + ' Q' + (fx + fs * 0.9) + ' ' + (base - fs * 1.2) + ' ' + (fx + fs * 0.7) + ' ' + base + ' L' + (fx - fs * 0.7) + ' ' + base + ' Q' + (fx - fs * 0.9) + ' ' + (base - fs * 1.2) + ' ' + fx + ' ' + (base - fs * 3.2) + 'Z'} fill=${i % 2 ? c : g} opacity=".8" />`);
      if (i % 2 === 0) items.push(html`<path key=${'c' + i} class="au-flame" style=${'animation-delay:-' + R(i, 5, 0.9) + 's'} d=${'M' + fx + ' ' + (base - fs * 1.8) + ' Q' + (fx + fs * 0.45) + ' ' + (base - fs * 0.6) + ' ' + (fx + fs * 0.35) + ' ' + base + ' L' + (fx - fs * 0.35) + ' ' + base + ' Q' + (fx - fs * 0.45) + ' ' + (base - fs * 0.6) + ' ' + fx + ' ' + (base - fs * 1.8) + 'Z'} fill="#fff3b0" opacity=".9" />`);
    }
    for (i = 0; i < n; i++) items.push(html`<rect key=${'e' + i} class="au-rise" style=${'animation-delay:-' + R(i, 5, 2) + 's'} x=${28 + R(i, 7, 44)} y="76" width="1.4" height="1.4" fill=${i % 2 ? '#fff3b0' : g} />`);
  } else if (el === 'water') {
    items.push(html`<ellipse key="w1" class="au-ripple" cx="50" cy="86" rx="22" ry="5" fill="none" stroke=${g} stroke-width="1.6" />`);
    items.push(html`<ellipse key="w2" class="au-ripple" style="animation-delay:-1s" cx="50" cy="86" rx="22" ry="5" fill="none" stroke=${c} stroke-width="1.2" />`);
    items.push(html`<path key="w3" class="au-wave" d="M22 80 Q30 74 38 80 T54 80 T70 80 T86 80" fill="none" stroke=${g} stroke-width="1.8" />`);
    for (i = 0; i < n; i++) items.push(html`<g key=${'d' + i} class="au-rise" style=${'animation-delay:-' + R(i, 2, 2.4) + 's'}><path transform=${'translate(' + (26 + R(i, 4, 46)) + ' 76) scale(.35)'} d=${ELEM_PART.water} fill=${g} /></g>`);
  } else if (el === 'wind') {
    for (i = 0; i < Math.min(4, n - 2); i++) items.push(html`<ellipse key=${i} class="au-spin" style=${'animation-delay:-' + i * 0.6 + 's;animation-duration:' + (2.2 + i * 0.4) + 's'} cx="50" cy=${40 + i * 14} rx=${26 - i * 2} ry="5" fill="none" stroke=${i % 2 ? c : g} stroke-width="1.4" stroke-dasharray="14 10" />`);
    for (i = 0; i < n; i++) items.push(html`<g key=${'l' + i} class="au-drift" style=${'animation-delay:-' + R(i, 1, 3) + 's'}><path transform=${'translate(' + (22 + R(i, 9, 50)) + ' ' + (30 + R(i, 3, 50)) + ') scale(.4)'} d=${ELEM_PART.wind} fill=${g} /></g>`);
  } else if (el === 'earth') {
    for (i = 0; i < n; i++) items.push(html`<g key=${i} class="au-float" style=${'animation-delay:-' + R(i, 6, 2.5) + 's'}><path transform=${'translate(' + (22 + (i / (n - 1 || 1)) * 50) + ' ' + (74 + R(i, 1, 8)) + ') scale(' + (0.35 + R(i, 2, 0.3)) + ')'} d=${ELEM_PART.earth} fill=${i % 2 ? c : g} stroke="#2a1a10" stroke-width=".8" /></g>`);
    items.push(html`<ellipse key="dust" class="au-ripple" cx="50" cy="87" rx="24" ry="4" fill=${c} opacity=".35" />`);
  } else if (el === 'ice') {
    for (i = 0; i < n + 2; i++) items.push(html`<g key=${i} class="au-fall" style=${'animation-delay:-' + R(i, 8, 3) + 's'}><path transform=${'translate(' + (20 + R(i, 5, 56)) + ' 18) scale(' + (0.3 + R(i, 7, 0.25)) + ')'} d=${ELEM_PART.ice} fill=${i % 2 ? '#ffffff' : g} /></g>`);
    items.push(html`<ellipse key="frost" cx="50" cy="87" rx="24" ry="4" fill=${g} opacity=".35" />`);
  } else if (el === 'lightning') {
    for (i = 0; i < Math.max(4, n - 2); i++) { var lx = 22 + R(i, 3, 56), ly = 16 + R(i, 4, 56); items.push(html`<path key=${i} class="au-bolt" style=${'animation-delay:-' + (i * 0.37 + R(i, 9, 0.3)) + 's'} d=${'M' + lx + ' ' + ly + ' l-4 6 l3 0 l-5 8 l2 0 l-3 7 l9 -11 l-3 0 l4 -5 l-3 0 l3 -5z'} fill=${i % 2 ? g : '#fff8d0'} stroke=${c} stroke-width=".7" />`); }
    items.push(html`<ellipse key="spark" class="au-ripple" cx="50" cy="86" rx="22" ry="4" fill="none" stroke=${g} stroke-width="1.2" stroke-dasharray="3 3" />`);
    for (i = 0; i < n; i++) items.push(html`<circle key=${'s' + i} class="au-twinkle" style=${'animation-delay:-' + R(i, 2, 1.2) + 's'} cx=${22 + R(i, 6, 56)} cy=${24 + R(i, 1, 60)} r="1" fill="#fff" />`);
  } else if (el === 'light') {
    items.push(html`<defs key="lg"><linearGradient id="auLightGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color=${g} stop-opacity=".9" /><stop offset="1" stop-color=${g} stop-opacity="0" /></linearGradient></defs>`);
    for (i = 0; i < 6; i++) items.push(html`<rect key=${i} class="au-ray" style=${'animation-delay:-' + i * 0.4 + 's'} x=${31 + i * 7.5} y="30" width="1.6" height="56" fill="url(#auLightGrad)" />`);
    items.push(html`<ellipse key="halo" cx="50" cy="86" rx="22" ry="4" fill=${g} opacity=".35" />`);
    for (i = 0; i < n; i++) items.push(html`<g key=${'t' + i} class="au-twinkle" style=${'animation-delay:-' + R(i, 3, 1.6) + 's'}><path transform=${'translate(' + (20 + R(i, 2, 56)) + ' ' + (18 + R(i, 5, 62)) + ') scale(.4)'} d=${ELEM_PART.light} fill="#fff" /></g>`);
  } else if (el === 'dark') {
    for (i = 0; i < n + 1; i++) items.push(html`<circle key=${i} class="au-smoke" style=${'animation-delay:-' + R(i, 4, 3) + 's'} cx=${26 + R(i, 1, 48)} cy="84" r=${4 + R(i, 2, 4)} fill=${i % 2 ? c : g} />`);
    items.push(html`<ellipse key="pool" cx="50" cy="87" rx="25" ry="4.5" fill="#12081c" opacity=".7" />`);
  }
  return html`<span class=${'elem-aura au-' + el} aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${items}</svg></span>`;
}

// Master Max: golden archmage aura — light pillar, turning rune circle, rising motes
function HolyAura() {
  var motes = [];
  for (var i = 0; i < 9; i++) motes.push(html`<circle key=${i} class="ha-mote" style=${'animation-delay:-' + (i * 0.37).toFixed(2) + 's'} cx=${22 + (i * 37) % 56} cy="92" r=${i % 3 ? 1.1 : 1.7} fill=${i % 2 ? '#fff6c8' : '#ffd24a'} />`);
  var ticks = [];
  for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2; ticks.push(html`<line key=${k} x1=${50 + Math.cos(a) * 25} y1=${Math.sin(a) * 25} x2=${50 + Math.cos(a) * 29} y2=${Math.sin(a) * 29} />`); }
  return html`<span class="holy-aura" aria-hidden="true">
    <span class="ha-pillar"></span><span class="ha-halo"></span>
    <svg class="ha-circle" viewBox="0 -32 100 64"><g class="ha-spin" stroke="#ffd24a" stroke-width="1.1" fill="none">
      <circle cx="50" cy="0" r="30" /><circle cx="50" cy="0" r="23" stroke-dasharray="3 2" />${ticks}
      <polygon points="50,-23 70,11.5 30,11.5" stroke-width=".8" /><polygon points="50,23 70,-11.5 30,-11.5" stroke-width=".8" /></g></svg>
    <svg class="ha-motes" viewBox="0 0 100 100">${motes}</svg>
  </span>`;
}

function UI_REDUCED() { return Store.settings().reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function Countdown(p) {
  var cs = useState(3), n = cs[0], setN = cs[1];
  useEffect(function () {
    if (UI_REDUCED()) { p.onDone(); return; }
    sfx('drum');
    var t = setTimeout(function () { if (n > 1) setN(n - 1); else p.onDone(); }, 520);
    return function () { clearTimeout(t); };
  }, [n]);
  return html`<div class="countdown" aria-live="assertive"><b key=${n}>${n}</b></div>`;
}
// fighter sprite size that keeps the whole battle screen inside the window (1366×768 target)
function sprSize() { return Math.max(120, Math.min(230, Math.round((window.innerHeight || 768) * 0.27))); }
function TimeBar(p) { return html`<div class=${'timebar' + (p.pct < 30 ? ' low' : '') + (p.stopped ? ' stopped' : '')}><i style=${'width:' + p.pct + '%'}></i><b>${p.stopped ? p.left.toFixed(1) : Math.ceil(p.left)}</b></div>`; }
function QuestionBox(p) {
  // p.q, p.seconds, p.onAnswer(index|null, elapsedMs), p.locked, p.picked
  // The countdown stops the moment an answer is chosen (or time runs out) and the bar freezes at that point.
  var ts = useState(0), now = ts[0], setNow = ts[1];
  var start = useRef(Date.now()), done = useRef(false), lastSec = useRef(-1), iv = useRef(null);
  var stopClock = function () { if (iv.current) { clearInterval(iv.current); iv.current = null; } };
  useEffect(function () {
    start.current = Date.now(); done.current = false; lastSec.current = -1; setNow(0);
    iv.current = setInterval(function () {
      if (done.current) { stopClock(); return; }
      var el = Date.now() - start.current;
      var left = p.seconds - el / 1000, sec = Math.ceil(left);
      if (left <= 3 && sec !== lastSec.current && sec > 0) { lastSec.current = sec; sfx('tick'); }
      if (el >= p.seconds * 1000) { done.current = true; stopClock(); setNow(p.seconds * 1000); p.onAnswer(null, p.seconds * 1000); return; }
      setNow(el);
    }, 100);
    return stopClock;
  }, [p.q]);
  var pick = function (i) {
    if (done.current || p.locked) return;
    done.current = true; stopClock();
    var el = Math.min(Date.now() - start.current, p.seconds * 1000);
    setNow(el); p.onAnswer(i, el);
  };
  var left = Math.max(0, p.seconds - now / 1000), stopped = done.current || p.locked;
  return html`<div class="qbox">
    <${TimeBar} pct=${(left / p.seconds) * 100} left=${left} stopped=${stopped} />
    ${stopped && p.picked !== null && p.picked !== undefined ? html`<small class="answered-in">${L('ตอบใน ', 'Answered in ')}${(now / 1000).toFixed(1)} ${L('วินาที', 's')}</small>` : null}
    <div class="qtext">${p.q.text}</div>
    <div class="choices">${p.q.choices.map(function (c, i) {
      var cls = 'choice';
      if (p.picked !== undefined && p.locked) { if (i === p.q.correctIndex) cls += ' right'; else if (i === p.picked) cls += ' wrong'; }
      return html`<button class=${cls} disabled=${p.locked} onClick=${function () { pick(i); }}><span class="key">${'ABCD'[i]}</span>${c}</button>`;
    })}</div></div>`;
}

