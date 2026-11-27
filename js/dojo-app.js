/* QuestDojo RPG — screens. Uses the QuestClass UI helpers (html, L, Hero, Monster, Modal, sfx, toast, …). */
UI.page = 'home';
UI.run = null;

function me() { return Store.asStudent(); }
function myLevel() { return Store.level(); }
function nickMsg(code) {
  return { short: L('ชื่อสั้นเกินไป (อย่างน้อย 2 ตัวอักษร)', 'Too short (at least 2 characters)'), long: L('ชื่อยาวเกินไป (ไม่เกิน 16 ตัวอักษร)', 'Too long (16 characters max)'),
    chars: L('ใช้ได้เฉพาะอักษรไทย อังกฤษ ตัวเลข เว้นวรรค . _ -', 'Thai or English letters, numbers, space . _ - only'), rude: L('ชื่อนี้มีคำไม่สุภาพ ลองชื่ออื่นนะ', 'That name has a rude word. Try another.') }[code] || '';
}
function titleOfMe(level) { var p = Store.get(); return p ? QC.titleOf(p.race, p.element, level == null ? myLevel() : level, UI.lang) : ''; }
function diffName(id) { var d = QC.DIFFS[QC.diffIndex(id)]; return L(d.th, d.en); }
function modeName(id) { var m = QC.modeById[id]; return L(m.th, m.en); }
function monName(d) { return L(d.th, d.name); }
function dur(ms) {
  ms = Math.max(0, ms); var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.ceil(ms % 36e5 / 6e4);
  if (m === 60) { h++; m = 0; }
  if (d) return d + L(' วัน ', 'd ') + h + L(' ชม.', 'h');
  if (h) return h + L(' ชม. ', 'h ') + m + L(' นาที', 'm');
  return m + L(' นาที', ' min');
}

// level-up cards (replaces the classroom version)
function announceLevelUps(list) {
  (list || []).forEach(function (lu) {
    if (!(lu.to > lu.from)) return;
    var p = Store.get(), stageUp = QC.stageOf(lu.to) !== QC.stageOf(lu.from);
    var detail = 'Lv.' + lu.from + ' → Lv.' + lu.to;
    if (stageUp) detail += ' • ' + L('ร่างใหม่: ', 'New form: ') + QC.titleOf(p.race, p.element, lu.to, UI.lang) + ' • ' + QC.weaponOf(p.race, lu.to);
    announce({ kind: 'level', title: p.nick, detail: detail, student: me(), level: lu.to });
    sfx(stageUp ? 'fanfare' : 'levelup');
  });
}

// ================= CHARACTER CREATION =================
function CreateScreen() {
  var ns = useState(''), nick = ns[0], setNick = ns[1];
  var rs = useState('human'), race = rs[0], setRace = rs[1];
  var es = useState('fire'), el = es[0], setEl = es[1];
  var ps = useState(1), pv = ps[0], setPv = ps[1];
  var bs = useState(false), busy = bs[0], setBusy = bs[1];
  var err = nick ? Dojo.nickError(nick) : 'short';
  var fake = { race: race, element: el };
  var create = async function () {
    if (err) return;
    var ok = await askConfirm({ title: L('ยืนยันตัวละคร?', 'Create this character?'),
      body: html`<p><b>${Dojo.cleanNick(nick)}</b> • ${raceName(race)} • ${elemName(el)}</p><p class="warn-line">${L('เผ่าและธาตุเลือกได้ครั้งเดียว เปลี่ยนภายหลังไม่ได้ (ชื่อเปลี่ยนได้ตลอด)', 'Race and element are permanent. You can change your name any time.')}</p>`, ok: L('เริ่มผจญภัย', 'Begin') });
    if (!ok) return;
    setBusy(true);
    try { Store.create({ nick: nick, race: race, element: el }); sfx('fanfare'); announce({ kind: 'notice', title: L('ยินดีต้อนรับสู่สำนัก!', 'Welcome to the Dojo!'), detail: QC.titleOf(race, el, 1, UI.lang), student: me(), level: 1 }); }
    catch (e) { failToast(e); setBusy(false); }
  };
  return html`<div class="create">
    <header class="create-head"><div class="brand-big"><b>QuestDojo</b><small>RPG TRAINING GROUNDS</small></div><${LangToggle} /></header>
    <${TeacherSay}>${L('ยินดีต้อนรับสู่สำนักฝึก! ตั้งชื่อ เลือกเผ่าและธาตุ แล้วไปฝึกในดันเจี้ยนกัน', 'Welcome to the Dojo! Pick a name, a race and an element, then train in the dungeons.')}</${TeacherSay}>
    <div class="create-grid">
      <div class="panel pad create-preview">
        <div class="status-art"><${Hero} student=${fake} level=${pv} size=${220} idle=${true} /></div>
        <b class="h3">${Dojo.cleanNick(nick) || L('ชื่อของคุณ', 'Your name')}</b>
        <span class="title-line">${QC.titleOf(race, el, pv, UI.lang)}</span>
        <div class="seg sm">${[1, 35, 99].map(function (x) { return html`<button class=${pv === x ? 'on' : ''} onClick=${function () { setPv(x); }}>${L('ร่าง ', 'Form ')}Lv.${x}</button>`; })}</div>
        <small class="muted">${L('ร่างจะเปลี่ยนเมื่อเลเวลถึง 10, 20, 35, 50, 65, 80, 99', 'Your form evolves at Lv. 10, 20, 35, 50, 65, 80, 99')}</small>
      </div>
      <div class="panel pad stack">
        <label class="field"><span>${L('ชื่อเล่น (เปลี่ยนได้ตลอด)', 'Nickname (can change any time)')}</span>
          <input type="text" maxlength="16" value=${nick} placeholder=${L('เช่น น้องเมฆ', 'e.g. Sky')} autocomplete="off" onInput=${function (e) { setNick(e.target.value); }} />
          ${nick && err ? html`<em class="err">${nickMsg(err)}</em>` : null}</label>
        <div class="field"><span>${L('เผ่า (เลือกครั้งเดียว)', 'Race (permanent)')}</span>
          <div class="race-grid">${QC.RACES.map(function (r) { return html`<button key=${r.id} class=${'race-card' + (race === r.id ? ' on' : '')} onClick=${function () { setRace(r.id); sfx('blip'); }}>
            <${Hero} student=${{ race: r.id, element: el }} level=${pv} size=${64} mode="portrait" /><b>${L(r.th, r.en)}</b></button>`; })}</div></div>
        <div class="field"><span>${L('ธาตุ (เลือกครั้งเดียว)', 'Element (permanent)')}: <b>${elemName(el)}</b></span>
          <div class="swatches">${QC.ELEMENTS.map(function (x) { return html`<button key=${x.id} class=${'swatch' + (el === x.id ? ' on' : '')} title=${L(x.th, x.en)} aria-label=${L(x.th, x.en)} style=${'background:' + x.color} onClick=${function () { setEl(x.id); sfx('blip'); }}></button>`; })}</div></div>
        <p class="muted small">${L('ทุกเผ่าและธาตุเก่งเท่ากัน แต่ละสัปดาห์จะสุ่มว่าใครชนะทางใครในลานประลอง', 'All races and elements are equally strong. Each week the arena matchups are re-rolled.')}</p>
        <button class="btn gold big" disabled=${!!err || busy} onClick=${create}>${L('สร้างตัวละคร', 'Create character')}</button>
        <p class="muted tiny">${Cloud.S.status === 'signedin' ? L('ตัวละครจะบันทึกในบัญชีของคุณ', 'Your character will be saved to your account.') : L('ไม่ต้องสมัครก็เล่นได้ (เก็บในเครื่องนี้)', 'No sign-up needed (saved on this device).')}</p>
        <${AccountBox} create=${true} />
      </div>
    </div></div>`;
}

// ================= SHELL =================
var NAV = [
  { id: 'home', th: 'ตัวละคร', en: 'Hero', icon: 'hall' },
  { id: 'dungeon', th: 'ดันเจี้ยน', en: 'Dungeons', icon: 'dungeon' },
  { id: 'arena', th: 'ลานประลอง', en: 'Arena', icon: 'arena' },
  { id: 'board', th: 'อันดับ', en: 'Ranks', icon: 'oracle' },
  { id: 'settings', th: 'ตั้งค่า', en: 'Settings', icon: 'settings' }
];
function LangToggle() {
  return html`<div class="seg sm lang"><button class=${UI.lang === 'th' ? 'on' : ''} onClick=${function () { Store.lsSet('qc.lang', 'th'); setUI({ lang: 'th' }); }}>ไทย</button><button class=${UI.lang === 'en' ? 'on' : ''} onClick=${function () { Store.lsSet('qc.lang', 'en'); setUI({ lang: 'en' }); }}>EN</button></div>`;
}
function TopBar() {
  var p = Store.get(), lv = myLevel(), prog = QC.levelProgress(p.exp, Dojo.LEVEL_REQS), en = Store.energy();
  return html`<header class="dj-top">
    <button class="dj-me" onClick=${function () { setUI({ page: 'home', run: null }); }}>
      <${Hero} student=${me()} level=${lv} size=${40} mode="portrait" />
      <span class="dj-me-txt"><b>${p.nick}</b><small>Lv.${lv} • ${titleOfMe(lv)}</small></span></button>
    <div class="dj-exp"><${ExpBar} pct=${prog.pct} /><small class="num">${p.exp}${prog.next ? ' / ' + prog.next : ''} EXP</small></div>
    <span class="pill dj-energy" title=${L('พลังงานประลอง', 'Arena energy')}>⚡ ${en.n}/${Dojo.ENERGY_MAX}</span>
  </header>`;
}
function NavBar() {
  return html`<nav class="dj-nav" aria-label=${L('เมนู', 'Menu')}>${NAV.map(function (n) {
    return html`<button key=${n.id} class=${'dj-tab' + (UI.page === n.id ? ' on' : '')} aria-current=${UI.page === n.id ? 'page' : null} onClick=${function () { setUI({ page: n.id, run: null }); sfx('blip'); }}>
      <img src=${'ui/icon-' + n.icon + '.png'} alt="" width="22" height="22" /><span>${L(n.th, n.en)}</span></button>`;
  })}</nav>`;
}
var SCENE_OF = { home: 'hall', dungeon: 'game', arena: 'arena', board: 'reports', settings: 'avatars' };
function App() {
  useApp();
  useEffect(function () {
    var t = setInterval(uiEmit, 30000); // keep energy / respawn timers fresh
    return function () { clearInterval(t); };
  }, []);
  useEffect(function () { if (Store.get() && Store.takeNewWeek()) setUI({ modal: 'week' }); });
  var p = Store.get();
  if (!p) return html`<div class="dj-app create-app">${Cloud.S.status === 'checking' ? html`<${Loading} text=${L('กำลังตรวจสอบบัญชี…', 'Checking your account…')} />` : html`<${CreateScreen} />`}<${Toasts} /><${Announcements} /><${ConfirmHost} /></div>`;
  var page = UI.page;
  var body = page === 'dungeon' ? (UI.run ? html`<${DungeonRun} key=${UI.run.k} d=${Dojo.dungeonById[UI.run.id]} />` : html`<${DungeonPage} />`)
    : page === 'arena' ? html`<${ArenaPage} />` : page === 'board' ? html`<${BoardPage} />` : page === 'settings' ? html`<${SettingsPage} />` : html`<${HomePage} />`;
  var scene = page === 'dungeon' && UI.run ? Scenes.battle(Dojo.dungeonById[UI.run.id].mode) : Scenes.bg(SCENE_OF[page] || 'hall');
  return html`<div class="dj-app">
    <${TopBar} />
    <main class="dj-main"><div class="scene" style=${'--scene:' + scene}></div><div class="dj-page">${body}</div></main>
    ${page === 'dungeon' && UI.run ? null : html`<${NavBar} />`}
    ${UI.modal === 'week' ? html`<${WeekModal} onClose=${function () { setUI({ modal: null }); }} />` : null}
    <${ConflictModal} />
    ${UI.modal === 'rename' ? html`<${RenameModal} onClose=${function () { setUI({ modal: null }); }} />` : null}
    <${Toasts} /><${Announcements} /><${ConfirmHost} /></div>`;
}

// ================= HOME =================
function HomePage() {
  var p = Store.get(), lv = myLevel(), prog = QC.levelProgress(p.exp, Dojo.LEVEL_REQS), stats = QC.stats(lv);
  var as = useState(''), anim = as[0], setAnim = as[1];
  var play = function (a) { setAnim(a); sfx(a === 'attack' ? fxOf(me(), lv) : 'hit'); setTimeout(function () { setAnim(''); }, 850); };
  var T = QC.thresholds(Dojo.LEVEL_REQS), nextStage = QC.STAGES.filter(function (x) { return x > lv; })[0];
  var alive = Dojo.DUNGEONS.filter(function (d) { return Store.isAlive(d.id); }).length;
  return html`<section class="page home">
    <div class="home-grid">
      <div class="panel pad stack center">
        <div class="status-art"><${Hero} student=${me()} level=${lv} size=${220} anim=${anim} idle=${!anim} fx=${fxOf(me(), lv)} fxColor=${QC.elemById[p.element].color} /></div>
        <div class="row gap"><button class="btn sm" onClick=${function () { play('attack'); }}>${L('ท่าโจมตี', 'Attack')}</button><button class="btn sm" onClick=${function () { play('hit'); }}>${L('ท่าโดนโจมตี', 'Hit')}</button></div>
      </div>
      <div class="panel pad stack">
        <div class="row between wrap"><div><b class="h2">${p.nick}</b> <button class="link small" onClick=${function () { setUI({ modal: 'rename' }); }}>${L('เปลี่ยนชื่อ', 'Rename')}</button></div><span class="badge">${raceName(p.race)} • ${elemName(p.element)}</span></div>
        <span class="title-line">${titleOfMe(lv)}</span>
        <div class="lv-row"><b>Lv.${lv}</b><small>/99</small><${ExpBar} pct=${prog.pct} /><small class="num">${p.exp}${prog.next ? ' / ' + prog.next : ''} EXP</small></div>
        <dl class="kv"><dt>${L('อาวุธ', 'Weapon')}</dt><dd>${QC.weaponOf(p.race, lv)}</dd><dt>${L('ชุด', 'Outfit')}</dt><dd>${QC.armorOf(p.race, lv)}</dd>
          <dt>${L('ร่างถัดไป', 'Next form')}</dt><dd>${nextStage ? 'Lv.' + nextStage + ' (' + L('อีก ', '') + Math.max(0, T[nextStage] - p.exp) + ' EXP' + L('', ' to go') + ')' : L('ครบทุกร่างแล้ว', 'All forms unlocked')}</dd></dl>
        <div class="stat-grid">${[['HP', stats.hp], ['ATK', stats.atk], ['DEF', stats.def], ['SPD', stats.spd], ['CRIT', stats.crit + '%']].map(function (x) { return html`<div key=${x[0]}><small>${x[0]}</small><b>${x[1]}</b></div>`; })}</div>
      </div>
      <div class="panel pad stack">
        <h3 class="h3">${L('สัปดาห์นี้', 'This week')}</h3>
        <div class="tiles"><div class="tile"><small>${L('ดันเจี้ยนที่พิชิต', 'Dungeons cleared')}</small><b>${p.week.clears}/18</b></div><div class="tile"><small>${L('ชนะประลอง', 'Arena wins')}</small><b>${p.week.wins}</b></div></div>
        <p class="small muted">${L('มอนสเตอร์ที่ยังรออยู่ ', 'Monsters waiting: ')}${alive}/18 • ${L('เกิดใหม่ทั้งหมดในอีก ', 'All respawn in ')}${dur(Dojo.nextMonday() - Date.now())}</p>
        <button class="btn gold" onClick=${function () { setUI({ page: 'dungeon' }); }}>${L('ไปดันเจี้ยน', 'Go to the dungeons')}</button>
        <${MyMatchups} />
      </div>
    </div></section>`;
}
function MyMatchups(p) {
  var pl = Store.get(), mu = Dojo.matchups();
  var row = function (table, id, nameFn) {
    var beats = table[id] || [], loses = Object.keys(table).filter(function (k) { return (table[k] || []).indexOf(id) >= 0; });
    return html`<div class="mu-row"><b>${nameFn(id)}</b><span>${L('ชนะทาง', 'strong vs')} ${beats.map(function (b) { return html`<span key=${b} class="mu-chip good">${nameFn(b)}</span>`; })}</span>
      <span>${L('แพ้ทาง', 'weak vs')} ${loses.map(function (b) { return html`<span key=${b} class="mu-chip bad">${nameFn(b)}</span>`; })}</span></div>`;
  };
  return html`<div class="my-mu"><h4>${L('แพ้ทางประจำสัปดาห์ของคุณ', 'Your matchups this week')} <small class="muted">(±${Dojo.MATCH_PCT}% ${L('ดาเมจในลานประลอง', 'arena damage')})</small></h4>
    ${row(mu.elem, pl.element, elemName)}${row(mu.race, pl.race, raceName)}</div>`;
}
function RenameModal(p) {
  var ns = useState(Store.get().nick), nick = ns[0], setNick = ns[1];
  var err = Dojo.nickError(nick);
  var save = function () { if (err) return; try { Store.rename(nick); toast(L('เปลี่ยนชื่อแล้ว', 'Name changed')); p.onClose(); } catch (e) { failToast(e); } };
  return html`<${Modal} title=${L('เปลี่ยนชื่อ', 'Change name')} onClose=${p.onClose} footer=${html`<button class="btn ghost" onClick=${p.onClose}>${L('ยกเลิก', 'Cancel')}</button><button class="btn gold" disabled=${!!err} onClick=${save}>${L('บันทึก', 'Save')}</button>`}>
    <label class="field"><span>${L('ชื่อเล่น', 'Nickname')}</span><input type="text" maxlength="16" value=${nick} onInput=${function (e) { setNick(e.target.value); }} onKeyDown=${function (e) { if (e.key === 'Enter') save(); }} />${err ? html`<em class="err">${nickMsg(err)}</em>` : null}</label></${Modal}>`;
}
function WeekModal(p) {
  return html`<${Modal} title=${L('สัปดาห์ใหม่มาถึงแล้ว!', 'A new week begins!')} onClose=${p.onClose} footer=${html`<button class="btn gold" onClick=${p.onClose}>${L('รับทราบ', 'Got it')}</button>`}>
    <${TeacherSay}>${L('มอนสเตอร์ทั้ง 18 ตัวเกิดใหม่แล้ว อันดับประจำสัปดาห์เริ่มนับใหม่ และตารางแพ้ทางเผ่า–ธาตุถูกสุ่มใหม่!', 'All 18 monsters have respawned, the weekly ranks restarted, and the race & element matchups were re-rolled!')}</${TeacherSay}>
    <${MyMatchups} /></${Modal}>`;
}

// ================= DUNGEONS =================
function DungeonPage() {
  var respawn = Dojo.nextMonday() - Date.now();
  return html`<section class="page dungeons">
    <${TeacherSay}>${L('ตอบถูกครบ 10 ข้อ มอนสเตอร์จะพ่ายแพ้ ตอบผิดหรือหมดเวลาแม้ข้อเดียวจะโดนโจมตีและแพ้ ลองใหม่ได้ไม่จำกัด! ตอบเร็วมีโอกาสคริติคอล', 'Answer all 10 correctly to defeat the monster. One wrong answer or time-out and it strikes you down, but you can retry right away. Fast answers can land critical hits!')}</${TeacherSay}>
    <p class="small muted">${L('มอนสเตอร์ที่พิชิตแล้วจะเกิดใหม่ทุกวันจันทร์ 00:00 (อีก ', 'Defeated monsters respawn every Monday 00:00 (in ')}${dur(respawn)})</p>
    ${QC.MODES.map(function (m) {
      return html`<div key=${m.id} class="dg-row panel pad"><h3 class="h3">${modeName(m.id)} <small class="muted">${m.family}</small></h3>
        <div class="dg-cards">${Dojo.DUNGEONS.filter(function (d) { return d.mode === m.id; }).map(function (d) {
          var alive = Store.isAlive(d.id);
          return html`<button key=${d.id} class=${'dg-card ' + d.diff + (alive ? '' : ' dead')} disabled=${!alive} onClick=${function () { audioCtx(); sfx('select'); setUI({ run: { id: d.id, k: Date.now() } }); }}>
            <span class="dg-art"><${Monster} id=${d.id} size=${84} idle=${alive} /></span>
            <span class="dg-txt"><b>${monName(d)}</b><small>${diffName(d.diff)} • +${d.reward} EXP</small>
              ${alive ? html`<em class="dg-go">${L('ท้าสู้', 'Fight')}</em>` : html`<em class="dg-dead">✔ ${L('พิชิตแล้ว', 'Defeated')}</em>`}</span></button>`;
        })}</div></div>`;
    })}</section>`;
}

function DungeonRun(p) {
  var d = p.d, pl = Store.get(), lv = myLevel(), hero = me();
  var ss = useState({ phase: 'intro', i: 0, q: null, picked: undefined, hits: [], crits: 0 }), s = ss[0], setS = ss[1];
  var as = useState({}), anim = as[0], setAnim = as[1];
  var rs = useState(null), result = rs[0], setResult = rs[1];
  var timers = useRef([]), lock = useRef(false);
  useEffect(function () { return function () { timers.current.forEach(clearTimeout); }; }, []);
  var later = function (f, ms) { timers.current.push(setTimeout(f, ms)); };
  var fxc = QC.elemById[pl.element].color, size = Math.min(sprSize(), Math.round((window.innerWidth || 800) * 0.36));
  var startQ = function (i) { lock.current = false; setS(function (o) { return Object.assign({}, o, { phase: 'question', i: i, q: QC.generateQuestion(d.mode, d.diff), picked: undefined }); }); };
  var onAnswer = function (idx, elapsed) {
    if (lock.current) return; lock.current = true;
    var q = s.q, correct = idx === q.correctIndex;
    if (correct) {
      var r = Dojo.damage({ attLevel: lv, defLevel: d.level, elapsedMs: elapsed, attElem: pl.element, attRace: pl.race });
      var hits = s.hits.concat([{ dmg: r.damage, crit: r.critical }]), last = s.i + 1 >= Dojo.QUESTIONS;
      setS(Object.assign({}, s, { phase: 'hit', picked: idx, hits: hits, crits: s.crits + (r.critical ? 1 : 0) }));
      setAnim({ hero: 'attack', mon: 'hit', dmg: r.damage, crit: r.critical, k: Date.now() }); sfx(fxOf(hero, lv)); later(function () { sfx(r.critical ? 'smash' : 'hit'); if (r.critical) shake(); }, 220);
      later(function () {
        setAnim({});
        if (!last) { startQ(s.i + 1); return; }
        var res = Store.clearDungeon(d.id);
        setS(function (o) { return Object.assign({}, o, { phase: 'won' }); }); setAnim({ mon: 'defeat', hero: 'win' }); sfx('victory'); setResult(res);
        if (res) announceLevelUps([{ from: res.from, to: res.to }]);
      }, r.critical ? 1100 : 850);
    } else {
      setS(Object.assign({}, s, { phase: 'struck', picked: idx }));
      sfx('wrong'); setAnim({ mon: 'attack', claw: Date.now() });
      later(function () { sfx('hit'); shake(); setAnim({ mon: 'attack', hero: 'hit', claw: Date.now() }); }, 300);
      later(function () { setAnim({ hero: 'lose' }); setS(function (o) { return Object.assign({}, o, { phase: 'lost' }); }); sfx('roar'); }, 1100);
    }
  };
  var leave = function () { setUI({ run: null }); };
  var retry = function () { setUI({ run: { id: d.id, k: Date.now() } }); };
  useEnterKey(s.phase === 'lost', retry);
  var hpLeft = Dojo.QUESTIONS - s.hits.length, q = s.q;
  return html`<section class="page battle-page dg-run">
    <div class="battle-top row between"><div><b>${monName(d)}</b> <small class="muted">${modeName(d.mode)} • ${diffName(d.diff)} • +${d.reward} EXP</small></div>
      <div class="row gap"><span class="pill">${L('ข้อ', 'Q')} ${Math.min(s.i + 1, Dojo.QUESTIONS)}/${Dojo.QUESTIONS}</span>${s.crits ? html`<span class="pill gold">CRIT ×${s.crits}</span>` : null}<button class="btn sm ghost" onClick=${leave}>${L('ออก', 'Leave')}</button></div></div>
    <div class="stage arena-stage painted" style=${'--spr:' + size + 'px;--stage-bg:' + Scenes.battle(d.mode)}>
      <div class="fighter left">
        ${anim.claw ? html`<${HitFx} k=${anim.claw} kind="claw" color="#c0283a" glow="#ff6a5a" el=${null} />` : null}
        <${Hero} student=${hero} level=${lv} size=${size} anim=${anim.hero || (s.phase === 'lost' ? 'lose' : '')} idle=${!anim.hero && s.phase !== 'lost'} fx=${fxOf(hero, lv)} fxColor=${fxc} />
        <div class="nameplate"><b>${pl.nick}</b><small>Lv.${lv} • ${titleOfMe(lv)}</small></div>
      </div>
      <div class="fighter right">
        <${Monster} id=${d.id} size=${size} face="left" anim=${anim.mon || ''} idle=${!anim.mon && s.phase !== 'won'} />
        ${anim.dmg ? html`<${HitFx} k=${anim.k} kind=${fxOf(hero, lv)} el=${pl.element} /><span key=${anim.k} class=${'dmg' + (anim.crit ? ' crit' : '')}>${anim.crit ? 'CRITICAL! ' : ''}-${anim.dmg}</span>` : null}
        <div class="hp boss dg-hp"><i style=${'width:' + (hpLeft / Dojo.QUESTIONS * 100) + '%'}></i><b>${hpLeft}/${Dojo.QUESTIONS}</b></div>
        <div class="nameplate"><b>${monName(d)}</b><small>Lv.${d.level}</small></div>
      </div>
      ${s.phase === 'countdown' ? html`<${Countdown} onDone=${function () { startQ(0); }} />` : null}
    </div>
    <div class="panel pad battle-main">
      ${s.phase === 'intro' ? html`<div class="intro"><b class="huge">${monName(d)}</b><p>${L('ตอบถูกให้ครบ 10 ข้อ ข้อละ 10 วินาที ผิดหรือหมดเวลา = แพ้', '10 correct answers, 10 seconds each. One miss = defeat.')}</p>
        <button class="btn gold big" onClick=${function () { audioCtx(); setS(Object.assign({}, s, { phase: 'countdown' })); }}>${L('เริ่มต่อสู้!', 'Fight!')}</button></div>` : null}
      ${q && (s.phase === 'question' || s.phase === 'hit' || s.phase === 'struck') ? html`<${QuestionBox} q=${q} seconds=${Dojo.SECONDS} onAnswer=${onAnswer} locked=${s.phase !== 'question'} picked=${s.picked} />` : null}
      ${s.phase === 'lost' ? html`<div class="verdict bad"><div><b>${L('พ่ายแพ้!', 'Defeated!')}</b> ${s.picked === null || s.picked === undefined ? L('หมดเวลา', 'Time ran out') : L('ตอบผิด', 'Wrong answer')} • ${q ? q.text.replace(' = ?', '') + ' = ' + q.answer : ''}<br /><small>${L('ตอบถูกไป ', 'You got ')}${s.hits.length}/${Dojo.QUESTIONS} ${L('ข้อ', 'right')}</small></div>
        <div class="row gap"><button class="btn ghost" onClick=${leave}>${L('กลับ', 'Back')}</button><button class="btn gold" onClick=${retry}>${L('ลองใหม่', 'Retry')} <small>⏎</small></button></div></div>` : null}
      ${s.phase === 'won' ? html`<div class="intro"><b class="huge gold-text">${L('พิชิตแล้ว!', 'Victory!')}</b>
        <p>${monName(d)} ${L('พ่ายแพ้', 'is defeated')} • ${result ? '+' + result.exp + ' EXP' : ''}${s.crits ? ' • CRITICAL ×' + s.crits : ''}</p>
        <p class="muted small">${L('จะเกิดใหม่วันจันทร์', 'Respawns on Monday')}</p>
        <button class="btn gold big" onClick=${leave}>${L('เลือกดันเจี้ยนต่อ', 'Choose another dungeon')}</button></div>` : null}
    </div></section>`;
}

// ================= ARENA (online play arrives with the server) =================
function ArenaPage() {
  var en = Store.energy(), next = Dojo.energyNextIn(Store.get().energy), mu = Dojo.matchups();
  return html`<section class="page arena">
    <div class="panel pad stack">
      <h3 class="h3">${L('ลานประลอง', 'Arena')}</h3>
      <${TeacherSay}>${L('สุ่มเจอผู้เล่นจริงทั่วประเทศ ได้โจทย์ 10 ข้อชุดเดียวกัน ตอบถูกแล้วโจมตี ตอบเร็วแรงกว่าและมีโอกาสคริติคอล ใครเหลือ HP มากกว่าชนะ ได้ 5 EXP', 'Get matched with real players. Both get the same 10 questions; a correct answer strikes, faster answers hit harder and can crit. More HP left wins 5 EXP.')}</${TeacherSay}>
      <div class="energy"><span>⚡ ${L('พลังงาน', 'Energy')}</span><div class="energy-bar">${Array.from({ length: Dojo.ENERGY_MAX }).map(function (_, i) { return html`<i key=${i} class=${i < en.n ? 'on' : ''}></i>`; })}</div>
        <small class="muted">${en.n >= Dojo.ENERGY_MAX ? L('เต็มแล้ว', 'Full') : L('+1 ในอีก ', '+1 in ') + dur(next)}</small></div>
      <div class="seg arena-modes"><button class="on">${L('คณิตศาสตร์', 'Math')}</button><button>${L('ความรู้รอบตัว', 'General knowledge')}</button></div>
      <button class="btn gold big" disabled>${L('หาคู่ต่อสู้', 'Find an opponent')}</button>
      <p class="warn-line">${L('เปิดเร็วๆ นี้: ลานประลองออนไลน์และอันดับจะเปิดเมื่อเชื่อมต่อเซิร์ฟเวอร์ (รอบถัดไป)', 'Coming soon: the online arena and ranks open once the server is connected (next round).')}</p>
    </div>
    <div class="panel pad stack"><h3 class="h3">${L('ตารางแพ้ทางประจำสัปดาห์', 'This week\'s matchups')}</h3>
      <p class="small muted">${L('ทุกเผ่าและทุกธาตุชนะทาง 2 แบบ แพ้ทาง 2 แบบ สุ่มใหม่ทุกวันจันทร์ 00:00', 'Every race and element is strong against 2 and weak against 2. Re-rolled every Monday 00:00.')}</p>
      <${MuTable} table=${mu.elem} items=${QC.ELEMENTS} nameFn=${elemName} /><${MuTable} table=${mu.race} items=${QC.RACES} nameFn=${raceName} /></div>
  </section>`;
}
function MuTable(p) {
  return html`<div class="table-wrap"><table class="grid mu"><thead><tr><th></th><th>${L('ชนะทาง', 'Strong vs')}</th><th>${L('แพ้ทาง', 'Weak vs')}</th></tr></thead><tbody>${p.items.map(function (x) {
    var beats = p.table[x.id] || [], loses = p.items.filter(function (y) { return (p.table[y.id] || []).indexOf(x.id) >= 0; }).map(function (y) { return y.id; });
    return html`<tr key=${x.id}><th>${p.nameFn(x.id)}</th><td>${beats.map(function (b) { return html`<span key=${b} class="mu-chip good">${p.nameFn(b)}</span>`; })}</td><td>${loses.map(function (b) { return html`<span key=${b} class="mu-chip bad">${p.nameFn(b)}</span>`; })}</td></tr>`;
  })}</tbody></table></div>`;
}

// ================= LEADERBOARD (server in round 2; shows your own week for now) =================
function BoardPage() {
  var ts = useState('dungeon'), tab = ts[0], setTab = ts[1], p = Store.get();
  return html`<section class="page board"><div class="panel pad stack">
    <h3 class="h3">${L('อันดับประจำสัปดาห์', 'Weekly ranks')} <small class="muted">${L('รีเซ็ตวันจันทร์ 00:00 • อีก ', 'Resets Monday 00:00 • in ')}${dur(Dojo.nextMonday() - Date.now())}</small></h3>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ id: 'dungeon', label: L('พิชิตดันเจี้ยนมากสุด', 'Most dungeons') }, { id: 'wins', label: L('ชนะประลองมากสุด', 'Most arena wins') }]} />
    <table class="grid rank"><thead><tr><th>#</th><th>${L('ผู้เล่น', 'Player')}</th><th>${tab === 'dungeon' ? L('ดันเจี้ยน', 'Dungeons') : L('ชนะ', 'Wins')}</th></tr></thead>
      <tbody><tr class="me"><td>–</td><td><span class="who"><${Hero} student=${me()} level=${myLevel()} size=${28} mode="portrait" /><span>${p.nick} <small class="muted">${titleOfMe()}</small></span></span></td><td class="num">${tab === 'dungeon' ? p.week.clears : p.week.wins}</td></tr></tbody></table>
    <p class="warn-line">${L('อันดับของผู้เล่นทุกคนจะแสดงเมื่อเชื่อมต่อเซิร์ฟเวอร์ (รอบถัดไป)', 'Everyone\'s ranks appear once the server is connected (next round).')}</p>
  </div></section>`;
}

// ================= ACCOUNT (Math a Day / Google) =================
function GoogleG() { return html`<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`; }
function AccountBox(p) {
  var c = Cloud.S;
  if (c.status === 'unavailable') return html`<p class="muted tiny">${L('การเข้าสู่ระบบใช้ได้บนเว็บ questdojorpg.mathaday.app', 'Sign-in works on questdojorpg.mathaday.app')}</p>`;
  if (c.status === 'checking') return html`<p class="muted small"><span class="spin inline-spin"></span> ${L('กำลังตรวจสอบบัญชี…', 'Checking your account…')}</p>`;
  if (c.status === 'signedout') return html`<div class="stack acct">
    <button class="btn google" onClick=${Cloud.signIn}><${GoogleG} /> ${L('เข้าสู่ระบบด้วย Google', 'Sign in with Google')}</button>
    <p class="muted tiny">${p.create ? L('มีตัวละครในบัญชีอยู่แล้ว? เข้าสู่ระบบเพื่อเล่นต่อ', 'Already have a character? Sign in to continue.') : L('เข้าสู่ระบบเพื่อเก็บตัวละครไว้ในบัญชี เล่นต่อได้ทุกเครื่อง (ใช้บัญชีเดียวกับ Math a Day)', 'Sign in to keep your character in your account and play on any device (your Math a Day account).')}</p></div>`;
  var me = c.me || {};
  return html`<div class="stack acct">
    <div class="acct-me">${me.picture ? html`<img src=${me.picture} alt="" width="36" height="36" referrerpolicy="no-referrer" />` : null}<div><b>${me.name || 'Google'}</b><small class="muted">${c.linked ? L('ตัวละครบันทึกในบัญชีแล้ว', 'Character saved to your account') : L('ยังไม่ได้เชื่อมตัวละครกับบัญชี', 'Character not linked to the account')}</small></div></div>
    ${c.error ? html`<p class="err">${c.error}</p>` : null}
    ${!c.linked && Store.get() ? html`<button class="btn gold" onClick=${Cloud.useLocal}>${L('ย้ายตัวละครนี้ขึ้นบัญชี', 'Move this character to my account')}</button>` : null}
    ${p.create ? null : html`<button class="btn ghost" onClick=${async function () { var ok = await askConfirm({ title: L('ออกจากระบบ?', 'Sign out?'), body: L('ตัวละครถูกเก็บไว้ในบัญชีแล้ว และจะถูกลบออกจากเครื่องนี้ (เข้าสู่ระบบใหม่เพื่อเล่นต่อ)', 'Your character is kept in your account and removed from this device. Sign in again to continue.') }); if (ok) { await Cloud.signOut(); setUI({ page: 'home', run: null }); } }}>${L('ออกจากระบบ', 'Sign out')}</button>`}
  </div>`;
}
function ConflictModal() {
  var c = Cloud.S.conflict; if (!c) return null;
  var card = function (pl, label) { var lv = QC.levelFromExp(pl.exp, Dojo.LEVEL_REQS); return html`<div class="panel pad stack center cf-card"><small class="muted">${label}</small><${Hero} student=${{ race: pl.race, element: pl.element }} level=${lv} size=${96} /><b>${pl.nick}</b><small>Lv.${lv} • ${pl.exp} EXP</small></div>`; };
  if (c.kind === 'upload') return html`<${Modal} title=${L('ย้ายตัวละครขึ้นบัญชี?', 'Move your character to your account?')} onClose=${Cloud.stayOffline} footer=${html`<button class="btn ghost" onClick=${Cloud.stayOffline}>${L('ไว้ทีหลัง', 'Later')}</button><button class="btn gold" onClick=${Cloud.useLocal}>${L('ย้ายขึ้นบัญชี', 'Move it')}</button>`}>
    <p>${L('บัญชีนี้ยังไม่มีตัวละคร QuestDojo จะย้ายตัวละครในเครื่องนี้ขึ้นบัญชีเลยไหม เล่นต่อได้ทุกเครื่อง', 'This account has no QuestDojo character yet. Move the one on this device so you can play anywhere?')}</p>${card(c.local, L('ในเครื่องนี้', 'This device'))}</${Modal}>`;
  return html`<${Modal} title=${L('เลือกตัวละคร', 'Choose a character')} onClose=${Cloud.stayOffline}>
    <p>${L('บัญชีนี้มีตัวละครอยู่แล้ว และในเครื่องนี้ก็มีอีกตัว เลือกตัวที่จะเล่นต่อ ตัวที่ไม่เลือกจะถูกแทนที่', 'Your account and this device hold different characters. Pick one to keep; the other is replaced.')}</p>
    <div class="cf-grid">${card(c.remote, L('ในบัญชี', 'In your account'))}${card(c.local, L('ในเครื่องนี้', 'On this device'))}</div>
    <div class="row gap wrap"><button class="btn gold" onClick=${Cloud.useRemote}>${L('ใช้ตัวในบัญชี', 'Use the account one')}</button><button class="btn" onClick=${async function () { var ok = await askConfirm({ title: L('แทนที่ตัวละครในบัญชี?', 'Replace the account character?'), body: L('ตัวละครในบัญชี (' + c.remote.nick + ') จะถูกแทนที่ด้วยตัวในเครื่องนี้ ย้อนกลับไม่ได้', 'The account character (' + c.remote.nick + ') will be replaced by this device\'s. This cannot be undone.'), danger: true }); if (ok) Cloud.useLocal(); }}>${L('ใช้ตัวในเครื่องนี้', 'Use this device\'s')}</button></div></${Modal}>`;
}
(function loadAccount() {
  if (!/(^|\.)mathaday\.app$/.test(location.hostname)) { Cloud.init(); return; }
  var sc = document.createElement('script'); sc.src = 'https://account.mathaday.app/sdk.js'; sc.async = true;
  sc.onload = function () { Cloud.init(); }; sc.onerror = function () { Cloud.S.status = 'unavailable'; Store.emit(); };
  document.head.appendChild(sc);
})();

// ================= SETTINGS =================
function SettingsPage() {
  var st = Store.settings(), fileRef = useRef(null);
  var backup = function () {
    try {
      var blob = new Blob([JSON.stringify(Store.exportData(), null, 1)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'questdojo-' + QC.bangkokDate() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(L('บันทึกไฟล์สำรองแล้ว', 'Backup saved'));
    } catch (e) { failToast(e); }
  };
  var onFile = function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    var rd = new FileReader();
    rd.onload = async function () {
      var obj = null; try { obj = JSON.parse(rd.result); } catch (err) { toast(L('ไฟล์ไม่ถูกต้อง', 'Invalid file'), 'err'); return; }
      if (!obj || obj.app !== 'QuestDojo RPG' || !obj.player) { toast(L('ไม่ใช่ไฟล์สำรองของ QuestDojo', 'Not a QuestDojo backup'), 'err'); return; }
      var ok = await askConfirm({ title: L('กู้คืนตัวละคร?', 'Restore character?'), body: html`<p>${obj.player.nick} • EXP ${obj.player.exp}</p><p class="warn-line">${L('ตัวละครปัจจุบันในเครื่องนี้จะถูกแทนที่', 'The character on this device will be replaced.')}</p>`, danger: true });
      if (!ok) return;
      try { Store.importData(obj); toast(L('กู้คืนแล้ว', 'Restored')); } catch (err) { toast(L('ไฟล์ไม่ถูกต้อง', 'Invalid file'), 'err'); }
    };
    rd.readAsText(f);
  };
  var wipe = async function () {
    var ok = await askConfirm({ title: L('ลบตัวละคร?', 'Delete character?'), body: L('ตัวละครและ EXP ในเครื่องนี้จะหายถาวร (แนะนำให้สำรองข้อมูลก่อน)', 'Your character and EXP on this device will be gone for good. Back up first.'), danger: true, ok: L('ลบ', 'Delete') });
    if (ok) { Store.reset(); setUI({ page: 'home', run: null }); }
  };
  return html`<section class="page settings"><div class="panel pad stack">
    <h3 class="h3">${L('ตั้งค่า', 'Settings')}</h3>
    <div class="row gap wrap"><span>${L('ภาษา', 'Language')}</span><${LangToggle} /></div>
    <label class="switch"><input type="checkbox" checked=${st.soundEnabled} onChange=${function (e) { Store.setPref({ soundEnabled: e.target.checked }); }} />${L('เสียงประกอบ', 'Sound effects')}</label>
    <label class="field"><span>${L('ความดัง', 'Volume')} ${st.sfxVolume}%</span><input type="range" min="0" max="100" value=${st.sfxVolume} onChange=${function (e) { Store.setPref({ sfxVolume: +e.target.value }); sfx('coin'); }} /></label>
    <label class="switch"><input type="checkbox" checked=${st.reducedMotion} onChange=${function (e) { Store.setPref({ reducedMotion: e.target.checked }); }} />${L('ลดการเคลื่อนไหว', 'Reduce motion')}</label>
    <label class="switch"><input type="checkbox" checked=${st.screenShakeEnabled} onChange=${function (e) { Store.setPref({ screenShakeEnabled: e.target.checked }); }} />${L('จอสั่นตอนโดนโจมตี', 'Screen shake')}</label>
  </div>
  <div class="panel pad stack"><h3 class="h3">${L('บัญชีและข้อมูล', 'Account & data')}</h3>
    ${Cloud.S.linked ? null : html`<p class="small">${L('ตอนนี้ตัวละครเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ถ้าล้างข้อมูลเว็บหรือเปลี่ยนเครื่อง ตัวละครจะหาย เข้าสู่ระบบหรือกดสำรองข้อมูลไว้', 'Your character is saved in this browser only. Clearing site data or changing device loses it. Sign in or keep a backup.')}</p>`}
    <div class="row gap wrap"><button class="btn" onClick=${backup}>${L('สำรองข้อมูล', 'Back up')}</button><button class="btn" onClick=${function () { fileRef.current && fileRef.current.click(); }}>${L('กู้คืน', 'Restore')}</button>
      <input ref=${fileRef} type="file" accept="application/json,.json" hidden onChange=${onFile} /></div>
    <${AccountBox} />
    <button class="btn danger-ghost" onClick=${wipe}>${L('ลบตัวละคร', 'Delete character')}</button>
  </div>
  <p class="credit">QuestDojo RPG • ${L('ภาคต่อของ QuestClass RPG', 'a QuestClass RPG companion')}</p></section>`;
}

render(html`<${App} />`, document.getElementById('app'));
