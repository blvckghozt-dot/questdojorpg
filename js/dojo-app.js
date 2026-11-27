/* QuestDojo RPG — screens. Uses the QuestClass UI helpers (html, L, Hero, Monster, Modal, sfx, toast, …). */
UI.page = 'home';
UI.run = null;
UI.duel = null;

function me() { return Store.asStudent(); }
function myLevel() { return Store.level(); }
function nickMsg(code) {
  return { short: L('ชื่อสั้นเกินไป (อย่างน้อย 2 ตัวอักษร)', 'Too short (at least 2 characters)'), long: L('ชื่อยาวเกินไป (ไม่เกิน 16 ตัวอักษร)', 'Too long (16 characters max)'),
    chars: L('ใช้ได้เฉพาะอักษรไทย อังกฤษ ตัวเลข เว้นวรรค . _ -', 'Thai or English letters, numbers, space . _ - only'), rude: L('ชื่อนี้มีคำไม่สุภาพ ลองชื่ออื่นนะ', 'That name has a rude word. Try another.') }[code] || '';
}
function apiErr(e) {
  var c = e && e.code;
  var m = { nick: L('ชื่อนี้ใช้ไม่ได้', 'That name is not allowed'), defeated: L('มอนสเตอร์ตัวนี้พ่ายแพ้ไปแล้วในสัปดาห์นี้', 'This monster is already defeated this week'),
    noplayer: L('ไม่พบตัวละคร ลองรีเฟรชหน้า', 'Character not found; refresh the page'), exists: L('บัญชีนี้มีตัวละครอยู่แล้ว', 'This account already has a character'),
    server: L('เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง', 'Server error, please retry') }[c];
  return m || (e && e.status ? L('เกิดข้อผิดพลาด ', 'Error ') + e.status : L('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่', 'Cannot reach the server. Check the internet and retry.'));
}
function failApi(e) { toast(apiErr(e), 'err'); }
function titleOf(p, level) { return p ? QC.titleOf(p.race, p.element, level, UI.lang) : ''; }
function titleOfMe(level) { return titleOf(Store.get(), level == null ? myLevel() : level); }
function diffName(id) { var d = QC.DIFFS[QC.diffIndex(id)]; return L(d.th, d.en); }
function modeName(id) { var m = QC.modeById[id]; return L(m.th, m.en); }
var MON_EN = {}; SPR.MONSTERS.forEach(function (m) { MON_EN[m.id] = m.name; });
function monName(d) { return L(d.th, MON_EN[d.id] || d.th); }
function dur(ms) {
  ms = Math.max(0, ms); var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.ceil(ms % 36e5 / 6e4);
  if (m === 60) { h++; m = 0; }
  if (d) return d + L(' วัน ', 'd ') + h + L(' ชม.', 'h');
  if (h) return h + L(' ชม. ', 'h ') + m + L(' นาที', 'm');
  return m + L(' นาที', ' min');
}

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
    try { await Store.create({ nick: nick, race: race, element: el }); sfx('fanfare'); announce({ kind: 'notice', title: L('ยินดีต้อนรับสู่สำนัก!', 'Welcome to the Dojo!'), detail: QC.titleOf(race, el, 1, UI.lang), student: me(), level: 1 }); }
    catch (e) { failApi(e); setBusy(false); }
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
        <p class="muted tiny">${Store.S.account ? L('ตัวละครจะผูกกับบัญชี ', 'This character will belong to ') + Store.S.account.name : L('ไม่ต้องสมัครก็เล่นได้', 'No sign-up needed')}</p>
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
    <button class="dj-me" onClick=${function () { if (!UI.duel) setUI({ page: 'home', run: null }); }}>
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
  useEffect(function () { var t = setInterval(uiEmit, 30000); return function () { clearInterval(t); }; }, []);
  useEffect(function () {
    if (Store.get() && Store.takeNewWeek()) setUI({ modal: 'week' });
    if (Store.S.migrated) { Store.S.migrated = false; toast(L('ย้ายตัวละครขึ้นเซิร์ฟเวอร์แล้ว (เริ่ม EXP ใหม่)', 'Your character moved to the server (EXP restarts)')); }
  });
  var st = Store.S, p = Store.get();
  if (st.status === 'loading' && !p) return html`<div class="dj-app create-app"><${Loading} text=${L('กำลังโหลด…', 'Loading…')} /></div>`;
  if (st.status === 'offline' && !p) return html`<div class="dj-app create-app"><div class="create"><${TeacherSay} kind="warn">${L('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่', 'Cannot reach the server. Check the internet and try again.')}</${TeacherSay}><button class="btn gold" onClick=${Store.boot}>${L('ลองใหม่', 'Retry')}</button></div></div>`;
  if (!p) return html`<div class="dj-app create-app"><${CreateScreen} /><${Toasts} /><${Announcements} /><${ConfirmHost} /></div>`;
  var page = UI.page, inBattle = (page === 'dungeon' && UI.run) || (page === 'arena' && UI.duel);
  var body = page === 'dungeon' ? (UI.run ? html`<${DungeonRun} key=${UI.run.k} d=${Dojo.dungeonById[UI.run.id]} />` : html`<${DungeonPage} />`)
    : page === 'arena' ? (UI.duel ? html`<${Duel} key=${UI.duel.k} mode=${UI.duel.mode} />` : html`<${ArenaPage} />`) : page === 'board' ? html`<${BoardPage} />` : page === 'settings' ? html`<${SettingsPage} />` : html`<${HomePage} />`;
  var scene = page === 'dungeon' && UI.run ? Scenes.battle(Dojo.dungeonById[UI.run.id].mode) : Scenes.bg(SCENE_OF[page] || 'hall');
  return html`<div class="dj-app">
    <${TopBar} />
    ${st.status === 'offline' ? html`<div class="banner warn">${L('ออฟไลน์: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'Offline: cannot reach the server')} <button class="link" onClick=${Store.boot}>${L('ลองใหม่', 'Retry')}</button></div>` : null}
    <main class="dj-main"><div class="scene" style=${'--scene:' + scene}></div><div class="dj-page">${body}</div></main>
    ${inBattle ? null : html`<${NavBar} />`}
    ${UI.modal === 'week' ? html`<${WeekModal} onClose=${function () { setUI({ modal: null }); }} />` : null}
    ${UI.modal === 'rename' ? html`<${RenameModal} onClose=${function () { setUI({ modal: null }); }} />` : null}
    <${LinkModal} />
    <${Toasts} /><${Announcements} /><${ConfirmHost} /></div>`;
}

// ================= HOME =================
function HomePage() {
  var p = Store.get(), lv = myLevel(), prog = QC.levelProgress(p.exp, Dojo.LEVEL_REQS), stats = QC.stats(lv), wk = Store.week();
  var as = useState(''), anim = as[0], setAnim = as[1];
  var play = function (a) { setAnim(a); sfx({ attack: fxOf(me(), lv), hit: 'hit', win: 'victory', lose: 'wrong' }[a]); setTimeout(function () { setAnim(''); }, a === 'win' || a === 'lose' ? 2400 : 850); };
  var T = QC.thresholds(Dojo.LEVEL_REQS), nextStage = QC.STAGES.filter(function (x) { return x > lv; })[0];
  var alive = Dojo.DUNGEONS.filter(function (d) { return Store.isAlive(d.id); }).length;
  return html`<section class="page home">
    <div class="home-grid">
      <div class="panel pad stack center">
        <div class="status-art"><${Hero} student=${me()} level=${lv} size=${220} anim=${anim} idle=${!anim} fx=${fxOf(me(), lv)} fxColor=${QC.elemById[p.element].color} /></div>
        <div class="row gap wrap center-row"><button class="btn sm" onClick=${function () { play('attack'); }}>${L('ท่าโจมตี', 'Attack')}</button><button class="btn sm" onClick=${function () { play('hit'); }}>${L('ท่าโดนโจมตี', 'Hit')}</button>
          <button class="btn sm" onClick=${function () { play('win'); }}>${L('ท่าชนะ', 'Victory')}</button><button class="btn sm" onClick=${function () { play('lose'); }}>${L('ท่าแพ้', 'Defeat')}</button></div>
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
        <div class="tiles"><div class="tile"><small>${L('ดันเจี้ยนที่พิชิต', 'Dungeons cleared')}</small><b>${wk.clears}/18</b></div><div class="tile"><small>${L('ชนะประลอง', 'Arena wins')}</small><b>${wk.wins}</b></div></div>
        <p class="small muted">${L('มอนสเตอร์ที่ยังรออยู่ ', 'Monsters waiting: ')}${alive}/18 • ${L('เกิดใหม่ทั้งหมดในอีก ', 'All respawn in ')}${dur(Dojo.nextMonday() - Date.now())}</p>
        <div class="row gap wrap"><button class="btn gold" onClick=${function () { setUI({ page: 'dungeon' }); }}>${L('ไปดันเจี้ยน', 'Dungeons')}</button><button class="btn" onClick=${function () { setUI({ page: 'arena' }); }}>${L('ไปลานประลอง', 'Arena')}</button></div>
        <${MyMatchups} />
      </div>
    </div></section>`;
}
function muRow(table, id, nameFn) {
  var beats = table[id] || [], loses = Object.keys(table).filter(function (k) { return (table[k] || []).indexOf(id) >= 0; });
  return html`<div class="mu-row"><b>${nameFn(id)}</b><span>${L('ชนะทาง', 'strong vs')} ${beats.map(function (b) { return html`<span key=${b} class="mu-chip good">${nameFn(b)}</span>`; })}</span>
    <span>${L('แพ้ทาง', 'weak vs')} ${loses.map(function (b) { return html`<span key=${b} class="mu-chip bad">${nameFn(b)}</span>`; })}</span></div>`;
}
function MyMatchups() {
  var pl = Store.get(), mu = Dojo.matchups();
  return html`<div class="my-mu"><h4>${L('แพ้ทางประจำสัปดาห์ของคุณ', 'Your matchups this week')} <small class="muted">(±${Dojo.MATCH_PCT}% ${L('ดาเมจในลานประลอง', 'arena damage')})</small></h4>
    ${muRow(mu.elem, pl.element, elemName)}${muRow(mu.race, pl.race, raceName)}</div>`;
}
function RenameModal(p) {
  var ns = useState(Store.get().nick), nick = ns[0], setNick = ns[1], bs = useState(false), busy = bs[0], setBusy = bs[1];
  var err = Dojo.nickError(nick);
  var save = async function () { if (err || busy) return; setBusy(true); try { await Store.rename(nick); toast(L('เปลี่ยนชื่อแล้ว', 'Name changed')); p.onClose(); } catch (e) { failApi(e); setBusy(false); } };
  return html`<${Modal} title=${L('เปลี่ยนชื่อ', 'Change name')} onClose=${p.onClose} footer=${html`<button class="btn ghost" onClick=${p.onClose}>${L('ยกเลิก', 'Cancel')}</button><button class="btn gold" disabled=${!!err || busy} onClick=${save}>${L('บันทึก', 'Save')}</button>`}>
    <label class="field"><span>${L('ชื่อเล่น', 'Nickname')}</span><input type="text" maxlength="16" value=${nick} onInput=${function (e) { setNick(e.target.value); }} onKeyDown=${function (e) { if (e.key === 'Enter') save(); }} />${err ? html`<em class="err">${nickMsg(err)}</em>` : null}</label></${Modal}>`;
}
function WeekModal(p) {
  return html`<${Modal} title=${L('สัปดาห์ใหม่มาถึงแล้ว!', 'A new week begins!')} onClose=${p.onClose} footer=${html`<button class="btn gold" onClick=${p.onClose}>${L('รับทราบ', 'Got it')}</button>`}>
    <${TeacherSay}>${L('มอนสเตอร์ทั้ง 18 ตัวเกิดใหม่แล้ว อันดับประจำสัปดาห์เริ่มนับใหม่ และตารางแพ้ทางเผ่า–ธาตุถูกสุ่มใหม่!', 'All 18 monsters have respawned, the weekly ranks restarted, and the race & element matchups were re-rolled!')}</${TeacherSay}>
    <${MyMatchups} /></${Modal}>`;
}

// ================= DUNGEONS =================
function DungeonPage() {
  return html`<section class="page dungeons">
    <${TeacherSay}>${L('ตอบถูกครบ 10 ข้อ มอนสเตอร์จะพ่ายแพ้ ตอบผิดหรือหมดเวลาแม้ข้อเดียวจะโดนโจมตีและแพ้ ลองใหม่ได้ไม่จำกัด! ตอบเร็วมีโอกาสคริติคอล', 'Answer all 10 correctly to defeat the monster. One wrong answer or time-out and it strikes you down, but you can retry right away. Fast answers can land critical hits!')}</${TeacherSay}>
    <p class="small muted">${L('มอนสเตอร์ที่พิชิตแล้วจะเกิดใหม่ทุกวันจันทร์ 00:00 (อีก ', 'Defeated monsters respawn every Monday 00:00 (in ')}${dur(Dojo.nextMonday() - Date.now())})</p>
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
  var timers = useRef([]), lock = useRef(false), run = useRef(null);
  useEffect(function () { return function () { timers.current.forEach(clearTimeout); }; }, []);
  var later = function (f, ms) { timers.current.push(setTimeout(f, ms)); };
  var fxc = QC.elemById[pl.element].color, size = Math.min(sprSize(), Math.round((window.innerWidth || 800) * 0.36));
  var begin = async function () {
    audioCtx(); setS(Object.assign({}, s, { phase: 'starting' }));
    try { var r = await Store.dungeonStart(d.id); run.current = { id: r.run, qs: Dojo.dungeonQuestions(d.id, r.seed), answers: [], ms: [] }; setS(function (o) { return Object.assign({}, o, { phase: 'countdown' }); }); }
    catch (e) { failApi(e); if (e.code === 'defeated') { Store.refresh(); setUI({ run: null }); } else setS(function (o) { return Object.assign({}, o, { phase: 'intro' }); }); }
  };
  var startQ = function (i) { lock.current = false; setS(function (o) { return Object.assign({}, o, { phase: 'question', i: i, q: run.current.qs[i], picked: undefined }); }); };
  var report = function () { var r = run.current; return Store.dungeonFinish(r.id, r.answers, r.ms); };
  var onAnswer = function (idx, elapsed) {
    if (lock.current) return; lock.current = true;
    var q = s.q, correct = idx === q.correctIndex, r0 = run.current;
    r0.answers.push(idx === null ? -1 : idx); r0.ms.push(Math.round(elapsed));
    if (correct) {
      var r = Dojo.damage({ attLevel: lv, defLevel: d.level, elapsedMs: elapsed, attElem: pl.element, attRace: pl.race });
      var hits = s.hits.concat([{ dmg: r.damage, crit: r.critical }]), last = s.i + 1 >= Dojo.QUESTIONS;
      setS(Object.assign({}, s, { phase: 'hit', picked: idx, hits: hits, crits: s.crits + (r.critical ? 1 : 0) }));
      setAnim({ hero: 'attack', mon: 'hit', dmg: r.damage, crit: r.critical, k: Date.now() }); sfx(fxOf(hero, lv)); later(function () { sfx(r.critical ? 'smash' : 'hit'); if (r.critical) shake(); }, 220);
      later(async function () {
        setAnim({});
        if (!last) { startQ(s.i + 1); return; }
        setS(function (o) { return Object.assign({}, o, { phase: 'saving' }); });
        try {
          var res = await report();
          if (res.win) { setS(function (o) { return Object.assign({}, o, { phase: 'won' }); }); setAnim({ mon: 'defeat', hero: 'win' }); sfx('victory'); setResult(res); announceLevelUps([{ from: res.from, to: res.to }]); }
          else setS(function (o) { return Object.assign({}, o, { phase: 'rejected' }); });
        } catch (e) { failApi(e); setS(function (o) { return Object.assign({}, o, { phase: 'rejected' }); }); }
      }, r.critical ? 1100 : 850);
    } else {
      setS(Object.assign({}, s, { phase: 'struck', picked: idx }));
      sfx('wrong'); setAnim({ mon: 'attack', claw: Date.now() });
      report().catch(function () { });
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
      ${s.phase === 'intro' || s.phase === 'starting' ? html`<div class="intro"><b class="huge">${monName(d)}</b><p>${L('ตอบถูกให้ครบ 10 ข้อ ข้อละ 10 วินาที ผิดหรือหมดเวลา = แพ้', '10 correct answers, 10 seconds each. One miss = defeat.')}</p>
        <button class="btn gold big" disabled=${s.phase === 'starting'} onClick=${begin}>${s.phase === 'starting' ? L('กำลังเตรียม…', 'Preparing…') : L('เริ่มต่อสู้!', 'Fight!')}</button></div>` : null}
      ${q && (s.phase === 'question' || s.phase === 'hit' || s.phase === 'struck') ? html`<${QuestionBox} q=${q} seconds=${Dojo.SECONDS} onAnswer=${onAnswer} locked=${s.phase !== 'question'} picked=${s.picked} />` : null}
      ${s.phase === 'saving' ? html`<div class="intro"><span class="spin"></span><p>${L('กำลังบันทึกผล…', 'Saving the result…')}</p></div>` : null}
      ${s.phase === 'lost' ? html`<div class="verdict bad"><div><b>${L('พ่ายแพ้!', 'Defeated!')}</b> ${s.picked === null || s.picked === undefined ? L('หมดเวลา', 'Time ran out') : L('ตอบผิด', 'Wrong answer')} • ${q ? q.text.replace(' = ?', '') + ' = ' + q.answer : ''}<br /><small>${L('ตอบถูกไป ', 'You got ')}${s.hits.length}/${Dojo.QUESTIONS} ${L('ข้อ', 'right')}</small></div>
        <div class="row gap"><button class="btn ghost" onClick=${leave}>${L('กลับ', 'Back')}</button><button class="btn gold" onClick=${retry}>${L('ลองใหม่', 'Retry')} <small>⏎</small></button></div></div>` : null}
      ${s.phase === 'rejected' ? html`<div class="verdict bad"><div>${L('ไม่สามารถบันทึกชัยชนะรอบนี้ได้ ลองสู้ใหม่อีกครั้ง', 'This win could not be recorded. Please fight again.')}</div><button class="btn gold" onClick=${retry}>${L('ลองใหม่', 'Retry')}</button></div>` : null}
      ${s.phase === 'won' ? html`<div class="intro"><b class="huge gold-text">${L('พิชิตแล้ว!', 'Victory!')}</b>
        <p>${monName(d)} ${L('พ่ายแพ้', 'is defeated')} • ${result ? '+' + result.exp + ' EXP' : ''}${s.crits ? ' • CRITICAL ×' + s.crits : ''}</p>
        <p class="muted small">${L('จะเกิดใหม่วันจันทร์', 'Respawns on Monday')}</p>
        <button class="btn gold big" onClick=${leave}>${L('เลือกดันเจี้ยนต่อ', 'Choose another dungeon')}</button></div>` : null}
    </div></section>`;
}

// ================= ARENA =================
function ArenaPage() {
  var ms = useState(Store.lsGet('qd.arenaMode') === 'gk' ? 'gk' : 'math'), mode = ms[0], setMode = ms[1];
  var cs = useState(null), counts = cs[0], setCounts = cs[1];
  useEffect(function () {
    var alive = true, tick = function () { Store.queueCounts().then(function (c) { if (alive) setCounts(c); }).catch(function () { }); };
    tick(); var t = setInterval(tick, 5000); return function () { alive = false; clearInterval(t); };
  }, []);
  var en = Store.energy(), next = Dojo.energyNextIn(Store.get().energy), mu = Dojo.matchups();
  var pick = function (m) { setMode(m); Store.lsSet('qd.arenaMode', m); sfx('blip'); };
  return html`<section class="page arena">
    <div class="panel pad stack">
      <h3 class="h3">${L('ลานประลอง', 'Arena')}</h3>
      <${TeacherSay}>${L('สุ่มเจอผู้เล่นจริง ได้โจทย์ 10 ข้อชุดเดียวกัน ตอบถูกแล้วโจมตี ตอบเร็วแรงกว่าและมีโอกาสคริติคอล ใครเหลือ HP มากกว่าชนะ ได้ 5 EXP', 'Get matched with a real player. Both get the same 10 questions; a correct answer strikes, faster answers hit harder and can crit. More HP left wins 5 EXP.')}</${TeacherSay}>
      <div class="energy"><span>⚡ ${L('พลังงาน', 'Energy')}</span><div class="energy-bar">${Array.from({ length: Dojo.ENERGY_MAX }).map(function (_, i) { return html`<i key=${i} class=${i < en.n ? 'on' : ''}></i>`; })}</div>
        <small class="muted">${en.n >= Dojo.ENERGY_MAX ? L('เต็มแล้ว', 'Full') : L('+1 ในอีก ', '+1 in ') + dur(next)}</small></div>
      <div class="seg arena-modes"><button class=${mode === 'math' ? 'on' : ''} onClick=${function () { pick('math'); }}>${L('คณิตศาสตร์', 'Math')}${counts ? html`<small>${counts.math}</small>` : null}</button><button class=${mode === 'gk' ? 'on' : ''} onClick=${function () { pick('gk'); }}>${L('ความรู้รอบตัว', 'General knowledge')}${counts ? html`<small>${counts.gk}</small>` : null}</button></div>
      <small class="muted">${counts ? L('กำลังรอคู่: คณิต ' + counts.math + ' • ความรู้รอบตัว ' + counts.gk + ' คน • กำลังสู้ ' + counts.playing + ' คน', 'Waiting: math ' + counts.math + ' • general ' + counts.gk + ' • fighting ' + counts.playing) : ''}</small>
      <button class="btn gold big" disabled=${en.n < 1 || Store.S.status !== 'ready'} onClick=${function () { audioCtx(); sfx('select'); setUI({ duel: { mode: mode, k: Date.now() } }); }}>${en.n < 1 ? L('พลังงานหมด', 'Out of energy') : L('หาคู่ต่อสู้', 'Find an opponent')}</button>
      <p class="muted tiny">${L('ใช้พลังงาน 1 ขีดเมื่อเจอคู่ ถ้ารอ 60 วินาทีแล้วไม่เจอ จะยกเลิกโดยไม่เสียพลังงาน ไม่มีบอท', 'A duel uses 1 energy once matched. No match in 60 s cancels without using energy. No bots.')}</p>
    </div>
    <div class="panel pad stack"><h3 class="h3">${L('ตารางแพ้ทางประจำสัปดาห์', 'This week\'s matchups')}</h3>
      <p class="small muted">${L('ทุกเผ่าและทุกธาตุชนะทาง 2 แบบ แพ้ทาง 2 แบบ ดาเมจ ±' + Dojo.MATCH_PCT + '% สุ่มใหม่ทุกวันจันทร์ 00:00', 'Every race and element is strong against 2 and weak against 2 (±' + Dojo.MATCH_PCT + '% damage). Re-rolled every Monday 00:00.')}</p>
      <${MuTable} table=${mu.elem} items=${QC.ELEMENTS} nameFn=${elemName} /><${MuTable} table=${mu.race} items=${QC.RACES} nameFn=${raceName} /></div>
  </section>`;
}
function MuTable(p) {
  return html`<div class="table-wrap"><table class="grid mu"><thead><tr><th></th><th>${L('ชนะทาง', 'Strong vs')}</th><th>${L('แพ้ทาง', 'Weak vs')}</th></tr></thead><tbody>${p.items.map(function (x) {
    var beats = p.table[x.id] || [], loses = p.items.filter(function (y) { return (p.table[y.id] || []).indexOf(x.id) >= 0; }).map(function (y) { return y.id; });
    return html`<tr key=${x.id}><th>${p.nameFn(x.id)}</th><td>${beats.map(function (b) { return html`<span key=${b} class="mu-chip good">${p.nameFn(b)}</span>`; })}</td><td>${loses.map(function (b) { return html`<span key=${b} class="mu-chip bad">${p.nameFn(b)}</span>`; })}</td></tr>`;
  })}</tbody></table></div>`;
}
function pctTxt(mu) { var t = mu.e + mu.r; return (t > 0 ? '+' : '') + t + '%'; }

// one online duel: queue → versus → 10 questions → result
function Duel(p) {
  var ss = useState({ phase: 'connecting', counts: null, waited: 0 }), s = ss[0], setS = ss[1];
  var as = useState({}), anim = as[0], setAnim = as[1];
  var ws = useRef(null), st = useRef(s), lock = useRef(false), timers = useRef([]);
  var set = function (patch) { st.current = Object.assign({}, st.current, patch); setS(st.current); };
  var later = function (f, ms) { timers.current.push(setTimeout(f, ms)); };
  useEffect(function () {
    var sock = new WebSocket(Store.arenaUrl(p.mode)); ws.current = sock;
    var t0 = Date.now(), tick = setInterval(function () { if (st.current.phase === 'queue') set({ waited: Date.now() - t0 }); }, 1000);
    sock.onopen = function () { if (st.current.phase === 'connecting') set({ phase: 'queue' }); };
    sock.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    sock.onclose = function () { if (['queue', 'connecting', 'versus', 'question', 'result'].indexOf(st.current.phase) >= 0 && !st.current.ended) set({ phase: 'dropped' }); };
    return function () { clearInterval(tick); timers.current.forEach(clearTimeout); try { if (sock.readyState <= 1) { if (st.current.phase === 'queue') sock.send(JSON.stringify({ t: 'leave' })); sock.close(); } } catch (e) { } };
  }, []);
  var onMsg = function (m) {
    var cur = st.current;
    if (m.t === 'queue') set({ counts: m.counts });
    else if (m.t === 'timeout') set({ phase: 'timeout', ended: true });
    else if (m.t === 'replaced') set({ phase: 'replaced', ended: true });
    else if (m.t === 'error') { set({ phase: 'error', code: m.code, ended: true }); if (m.energy) Store.setEnergy(m.energy); }
    else if (m.t === 'match') { sfx('roar'); Store.setEnergy(m.energy); set({ phase: 'versus', side: m.side, players: m.players, hp: m.hp, max: m.hp.slice(), mu: m.mu, mode: m.mode, logs: [], oppAnswered: false }); }
    else if (m.t === 'q') { lock.current = false; set({ phase: 'question', q: { text: m.text, choices: m.choices, correctIndex: undefined }, i: m.i, n: m.n, sec: m.sec, picked: undefined, oppAnswered: false }); }
    else if (m.t === 'opp-answered') set({ oppAnswered: true });
    else if (m.t === 'r') {
      var me_ = cur.side, op = 1 - me_, mine = m.res[me_], theirs = m.res[op];
      var q = Object.assign({}, cur.q, { correctIndex: m.correct });
      set({ phase: 'result', q: q, picked: cur.picked === undefined ? null : cur.picked, hp: m.hp, last: { mine: mine, theirs: theirs }, logs: cur.logs.concat([{ i: m.i, mine: mine, theirs: theirs }]) });
      if (mine.ok) { setAnim({ me: 'attack', op: 'hit', dmgOp: mine.dmg, critOp: mine.crit, k: Date.now() }); sfx(fxOf(me(), myLevel())); later(function () { sfx(mine.crit ? 'smash' : 'hit'); if (mine.crit) shake(); }, 220); }
      if (theirs.ok) later(function () { setAnim(function (a) { return Object.assign({}, a, { op: 'attack', me: 'hit', dmgMe: theirs.dmg, critMe: theirs.crit, k2: Date.now() }); }); sfx('hit'); }, mine.ok ? 650 : 0);
      if (!mine.ok && !theirs.ok) sfx('wrong');
      later(function () { setAnim({}); }, 1700);
    }
    else if (m.t === 'end') {
      var won = m.winner === cur.side, draw = m.winner < 0;
      set({ phase: 'end', ended: true, won: won, draw: draw, how: m.how, exp: m.exp, hp: m.hp, right: m.right });
      setAnim(won ? { me: 'win', op: 'lose' } : draw ? {} : { me: 'lose', op: 'win' });
      sfx(won ? 'victory' : 'wrong');
      Store.refresh();
      if (won && m.to > m.from) announceLevelUps([{ from: m.from, to: m.to }]);
    }
  };
  var answer = function (idx, elapsed) {
    if (lock.current) return; lock.current = true;
    set({ picked: idx });
    if (idx !== null && ws.current && ws.current.readyState === 1) ws.current.send(JSON.stringify({ t: 'a', i: st.current.i, c: idx }));
  };
  var back = function () { setUI({ duel: null }); Store.refresh(); };
  var again = function () { setUI({ duel: { mode: p.mode, k: Date.now() } }); };
  var size = Math.min(sprSize(), Math.round((window.innerWidth || 800) * 0.34));
  if (s.phase === 'connecting' || s.phase === 'queue') {
    var left = Math.max(0, Math.ceil((Dojo.QUEUE_MS - (s.waited || 0)) / 1000)), c = s.counts;
    return html`<section class="page duel-wait"><div class="panel pad stack center">
      <div class="seal-ring small-ring"></div>
      <b class="h2">${L('กำลังหาคู่ต่อสู้…', 'Looking for an opponent…')}</b>
      <p>${p.mode === 'gk' ? L('โหมดความรู้รอบตัว', 'General knowledge') : L('โหมดคณิตศาสตร์', 'Math')} • ${L('ในคิว ', 'In queue: ')}${c ? c[p.mode] : '…'} ${L('คน', '')}</p>
      <small class="muted">${L('ยกเลิกอัตโนมัติในอีก ', 'Auto-cancel in ')}${left} ${L('วินาที', 's')}</small>
      <button class="btn ghost" onClick=${back}>${L('ยกเลิก', 'Cancel')}</button></div></section>`;
  }
  if (['timeout', 'error', 'dropped', 'replaced'].indexOf(s.phase) >= 0) {
    var msg = s.phase === 'timeout' ? L('ยังไม่มีคู่ต่อสู้ในตอนนี้ ไม่เสียพลังงาน ลองใหม่อีกครั้งหรือชวนเพื่อนมาประลอง', 'No opponent right now; no energy used. Try again or invite a friend.')
      : s.phase === 'replaced' ? L('คุณเปิดลานประลองจากหน้าต่างอื่น', 'You opened the arena in another window.')
      : s.code === 'energy' ? L('พลังงานหมด รอให้ฟื้นก่อนนะ', 'Out of energy; wait for it to refill.')
      : L('การเชื่อมต่อขาด ถ้าออกระหว่างสู้จะนับว่าแพ้', 'Connection lost. Leaving during a duel counts as a loss.');
    return html`<section class="page duel-wait"><div class="panel pad stack center"><${TeacherSay} kind="warn">${msg}</${TeacherSay}>
      <div class="row gap"><button class="btn ghost" onClick=${back}>${L('กลับ', 'Back')}</button>${s.code === 'energy' ? null : html`<button class="btn gold" onClick=${again}>${L('หาใหม่', 'Search again')}</button>`}</div></div></section>`;
  }
  var mySide = s.side, op = 1 - mySide, A = s.players[mySide], B = s.players[op];
  var hpBar = function (side) { var v = s.hp[side], mx = s.max[side]; return html`<div class="hp"><i style=${'width:' + Math.max(0, v / mx * 100) + '%'}></i><b>${v}/${mx}</b></div>`; };
  var last = s.last;
  return html`<section class=${'page battle-page duel' + (s.mode === 'gk' ? ' gk' : '')}>
    <div class="battle-top row between"><div><b>${L('ลานประลอง', 'Arena')}</b> <small class="muted">${s.mode === 'gk' ? L('ความรู้รอบตัว', 'General knowledge') : L('คณิตศาสตร์', 'Math')}</small></div>
      <span class="pill">${s.n ? L('ข้อ ', 'Q ') + Math.min((s.i || 0) + 1, s.n) + '/' + s.n : 'VS'}</span></div>
    <div class="stage arena-stage painted" style=${'--spr:' + size + 'px;--stage-bg:' + Scenes.bg('arena')}>
      <div class="fighter left">
        <${Hero} student=${me()} level=${A.level} size=${size} anim=${anim.me || ''} idle=${!anim.me} fx=${fxOf(A, A.level)} fxColor=${QC.elemById[A.element].color} />
        ${anim.dmgMe ? html`<span key=${anim.k2} class=${'dmg' + (anim.critMe ? ' crit' : '')}>${anim.critMe ? 'CRITICAL! ' : ''}-${anim.dmgMe}</span>` : null}
        ${hpBar(mySide)}
        <div class="nameplate"><b>${A.nick}</b><small>Lv.${A.level} • ${titleOf(A, A.level)}</small></div>
        <small class="matchup">${L('ได้เปรียบ ', 'Edge ')}<span class=${s.mu[mySide].e + s.mu[mySide].r > 0 ? 'good' : s.mu[mySide].e + s.mu[mySide].r < 0 ? 'bad' : ''}>${pctTxt(s.mu[mySide])}</span></small>
      </div>
      <div class="vs">VS</div>
      <div class="fighter right">
        <${Hero} student=${{ race: B.race, element: B.element }} level=${B.level} size=${size} face="left" anim=${anim.op || ''} idle=${!anim.op} fx=${fxOf(B, B.level)} fxColor=${QC.elemById[B.element].color} />
        ${anim.dmgOp ? html`<${HitFx} k=${anim.k} kind=${fxOf(A, A.level)} el=${A.element} /><span key=${anim.k} class=${'dmg' + (anim.critOp ? ' crit' : '')}>${anim.critOp ? 'CRITICAL! ' : ''}-${anim.dmgOp}</span>` : null}
        ${hpBar(op)}
        <div class="nameplate"><b>${B.nick}</b><small>Lv.${B.level} • ${titleOf(B, B.level)}</small></div>
        <small class="matchup">${s.phase === 'question' && s.oppAnswered ? html`<span class="good">✔ ${L('ตอบแล้ว', 'answered')}</span>` : html`${L('ได้เปรียบ ', 'Edge ')}${pctTxt(s.mu[op])}`}</small>
      </div>
      ${s.phase === 'versus' ? html`<${Countdown} onDone=${function () { }} />` : null}
    </div>
    <div class="panel pad battle-main">
      ${s.phase === 'versus' ? html`<div class="intro"><b class="huge">${A.nick} VS ${B.nick}</b><p>${L('เตรียมตัว!', 'Get ready!')}</p></div>` : null}
      ${s.q && (s.phase === 'question' || s.phase === 'result') ? html`<${QuestionBox} key=${s.i} q=${s.q} seconds=${s.sec || Dojo.SECONDS} onAnswer=${answer} locked=${s.phase !== 'question' || s.picked !== undefined} picked=${s.picked} />` : null}
      ${s.phase === 'question' && s.picked !== undefined ? html`<p class="muted small center-txt">${L('รอคู่ต่อสู้…', 'Waiting for your opponent…')}</p>` : null}
      ${s.phase === 'result' && last ? html`<div class="duel-res"><span class=${last.mine.ok ? 'good-text' : 'bad-text'}>${L('คุณ', 'You')}: ${last.mine.ok ? '✔ -' + last.mine.dmg + (last.mine.crit ? ' CRIT' : '') : '✖'}</span><span class=${last.theirs.ok ? 'good-text' : 'bad-text'}>${B.nick}: ${last.theirs.ok ? '✔ -' + last.theirs.dmg + (last.theirs.crit ? ' CRIT' : '') : '✖'}</span></div>` : null}
      ${s.phase === 'end' ? html`<div class="intro"><b class=${'huge ' + (s.won ? 'gold-text' : '')}>${s.draw ? L('เสมอ!', 'Draw!') : s.won ? L('ชนะ!', 'Victory!') : L('แพ้!', 'Defeat!')}</b>
        <p>${s.how === 'left' ? (s.won ? L('คู่ต่อสู้ออกจากการต่อสู้', 'Your opponent left') : L('คุณออกจากการต่อสู้', 'You left the duel')) : s.how === 'ko' ? 'K.O.!' : ''} ${L('ตอบถูก ', 'Correct ')}${s.right ? s.right[mySide] + ' : ' + s.right[op] : ''}${s.exp ? ' • +' + s.exp + ' EXP' : ''}</p>
        <div class="row gap"><button class="btn ghost" onClick=${back}>${L('กลับลานประลอง', 'Back to the arena')}</button><button class="btn gold" disabled=${Store.energy().n < 1} onClick=${again}>${L('ประลองอีกครั้ง', 'Duel again')}</button></div></div>` : null}
    </div></section>`;
}

// ================= LEADERBOARD =================
function BoardPage() {
  var ts = useState('dungeon'), tab = ts[0], setTab = ts[1];
  var ds = useState(null), data = ds[0], setData = ds[1];
  useEffect(function () { setData(null); Store.board(tab).then(setData).catch(function (e) { setData({ error: apiErr(e) }); }); }, [tab]);
  var p = Store.get();
  return html`<section class="page board"><div class="panel pad stack">
    <h3 class="h3">${L('อันดับประจำสัปดาห์', 'Weekly ranks')} <small class="muted">${L('รีเซ็ตวันจันทร์ 00:00 • อีก ', 'Resets Monday 00:00 • in ')}${dur(Dojo.nextMonday() - Date.now())}</small></h3>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ id: 'dungeon', label: L('พิชิตดันเจี้ยนมากสุด', 'Most dungeons') }, { id: 'wins', label: L('ชนะประลองมากสุด', 'Most arena wins') }]} />
    ${!data ? html`<${Loading} />` : data.error ? html`<p class="err">${data.error}</p>` : html`
      <table class="grid rank"><thead><tr><th>#</th><th>${L('ผู้เล่น', 'Player')}</th><th>${tab === 'dungeon' ? L('ดันเจี้ยน', 'Dungeons') : L('ชนะ', 'Wins')}</th></tr></thead>
        <tbody>${data.top.length ? data.top.map(function (r, i) { return html`<tr key=${r.id} class=${r.id === p.id ? 'me' : ''}><td class="num">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
          <td><span class="who"><${Hero} student=${{ race: r.race, element: r.element }} level=${r.level} size=${28} mode="portrait" /><span>${r.nick} <small class="muted">Lv.${r.level} • ${titleOf(r, r.level)}</small></span></span></td><td class="num">${r.score}</td></tr>`; })
          : html`<tr><td colspan="3" class="muted">${L('ยังไม่มีใครติดอันดับสัปดาห์นี้ เป็นคนแรกเลย!', 'No one on the board yet this week. Be the first!')}</td></tr>`}</tbody></table>
      <p class="small">${L('อันดับของคุณ: ', 'Your rank: ')}<b>${data.me && data.me.rank ? '#' + data.me.rank : '–'}</b> (${data.me ? data.me.score : 0})</p>`}
  </div></section>`;
}

// ================= ACCOUNT (Math a Day / Google) =================
function GoogleG() { return html`<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`; }
var ACCOUNT_URL = 'https://account.mathaday.app';
function signIn() { location.href = ACCOUNT_URL + '/?return=' + encodeURIComponent(location.href); }
async function signOut() {
  var ok = await askConfirm({ title: L('ออกจากระบบ?', 'Sign out?'), body: L('ตัวละครถูกเก็บไว้ในบัญชีแล้ว และจะถูกลบออกจากเครื่องนี้ (เข้าสู่ระบบใหม่เพื่อเล่นต่อ)', 'Your character stays in your account and is removed from this device. Sign in again to continue.') });
  if (!ok) return;
  await fetch(ACCOUNT_URL + '/api/logout', { method: 'POST', credentials: 'include' }).catch(function () { });
  Store.forgetDevice(); setUI({ page: 'home', run: null, duel: null }); Store.boot();
}
function AccountBox(p) {
  var a = Store.S.account, pl = Store.get();
  if (!/(^|\.)mathaday\.app$/.test(location.hostname)) return html`<p class="muted tiny">${L('การเข้าสู่ระบบใช้ได้บนเว็บ questdojorpg.mathaday.app', 'Sign-in works on questdojorpg.mathaday.app')}</p>`;
  if (!a) return html`<div class="stack acct">
    <button class="btn google" onClick=${signIn}><${GoogleG} /> ${L('เข้าสู่ระบบด้วย Google', 'Sign in with Google')}</button>
    <p class="muted tiny">${p.create ? L('มีตัวละครในบัญชีอยู่แล้ว? เข้าสู่ระบบเพื่อเล่นต่อ', 'Already have a character? Sign in to continue.') : L('เข้าสู่ระบบเพื่อเก็บตัวละครไว้ในบัญชี เล่นต่อได้ทุกเครื่อง (บัญชีเดียวกับ Math a Day)', 'Sign in to keep your character in your account and play on any device (your Math a Day account).')}</p></div>`;
  return html`<div class="stack acct">
    <div class="acct-me">${a.picture ? html`<img src=${a.picture} alt="" width="36" height="36" referrerpolicy="no-referrer" />` : null}<div><b>${a.name || 'Google'}</b><small class="muted">${pl && pl.mine ? L('ตัวละครผูกกับบัญชีนี้แล้ว', 'Character saved to this account') : pl ? L('ตัวละครในเครื่องนี้ยังไม่ได้ผูกกับบัญชี', 'This device\'s character is not linked yet') : ''}</small></div></div>
    ${pl && !pl.mine && !pl.linked ? html`<button class="btn gold" onClick=${async function () { try { await Store.link('device'); toast(L('ผูกตัวละครกับบัญชีแล้ว', 'Character linked to your account')); } catch (e) { failApi(e); } }}>${L('ผูกตัวละครนี้กับบัญชี', 'Link this character to my account')}</button>` : null}
    ${p.create ? null : html`<button class="btn ghost" onClick=${signOut}>${L('ออกจากระบบ', 'Sign out')}</button>`}
  </div>`;
}
function LinkModal() {
  var st = Store.S; if (!st.link || !st.account) return null;
  var pl = Store.get(), dev = st.device || pl;
  var card = function (x, label) { if (!x) return null; var lv = Dojo.levelOf(x.exp); return html`<div class="panel pad stack center cf-card"><small class="muted">${label}</small><${Hero} student=${{ race: x.race, element: x.element }} level=${lv} size=${96} /><b>${x.nick}</b><small>Lv.${lv} • ${x.exp} EXP</small></div>`; };
  var doLink = async function () { try { await Store.link('device'); toast(L('ผูกตัวละครกับบัญชีแล้ว', 'Character linked to your account')); } catch (e) { failApi(e); } };
  if (st.link === 'upload') return html`<${Modal} title=${L('ผูกตัวละครกับบัญชี?', 'Link your character to your account?')} onClose=${Store.skipLink} footer=${html`<button class="btn ghost" onClick=${Store.skipLink}>${L('ไว้ทีหลัง', 'Later')}</button><button class="btn gold" onClick=${doLink}>${L('ผูกกับบัญชี', 'Link it')}</button>`}>
    <p>${L('บัญชีนี้ยังไม่มีตัวละคร QuestDojo จะผูกตัวละครในเครื่องนี้กับบัญชีเลยไหม แล้วเล่นต่อได้ทุกเครื่อง', 'This account has no QuestDojo character yet. Link the one on this device so you can play anywhere?')}</p>${card(dev, L('ในเครื่องนี้', 'This device'))}</${Modal}>`;
  return html`<${Modal} title=${L('เลือกตัวละคร', 'Choose a character')} onClose=${Store.skipLink}>
    <p>${L('บัญชีนี้มีตัวละครอยู่แล้ว และในเครื่องนี้ก็มีอีกตัว เลือกตัวที่จะใช้กับบัญชี ตัวที่ไม่เลือกจะยังอยู่แต่ไม่ผูกกับบัญชี', 'Your account and this device hold different characters. Pick the one to keep on your account; the other stays but unlinked.')}</p>
    <div class="cf-grid">${card(pl, L('ในบัญชี', 'In your account'))}${card(st.device, L('ในเครื่องนี้', 'On this device'))}</div>
    <div class="row gap wrap"><button class="btn gold" onClick=${Store.skipLink}>${L('ใช้ตัวในบัญชี', 'Use the account one')}</button><button class="btn" onClick=${doLink}>${L('ใช้ตัวในเครื่องนี้', 'Use this device\'s')}</button></div></${Modal}>`;
}

// ================= SETTINGS =================
function SettingsPage() {
  var st = Store.settings(), ks = useState(''), key = ks[0], setKey = ks[1], show = useState(false), shown = show[0], setShown = show[1];
  var useKey = async function () { try { await Store.useDeviceKey(key); toast(L('โหลดตัวละครแล้ว', 'Character loaded')); setKey(''); } catch (e) { toast(L('รหัสไม่ถูกต้อง', 'Invalid key'), 'err'); } };
  var copy = function () { try { navigator.clipboard.writeText(Store.deviceKey()); toast(L('คัดลอกแล้ว', 'Copied')); } catch (e) { } };
  var a = Store.S.account, pl = Store.get();
  return html`<section class="page settings"><div class="panel pad stack">
    <h3 class="h3">${L('ตั้งค่า', 'Settings')}</h3>
    <div class="row gap wrap"><span>${L('ภาษา', 'Language')}</span><${LangToggle} /></div>
    <label class="switch"><input type="checkbox" checked=${st.soundEnabled} onChange=${function (e) { Store.setPref({ soundEnabled: e.target.checked }); }} />${L('เสียงประกอบ', 'Sound effects')}</label>
    <label class="field"><span>${L('ความดัง', 'Volume')} ${st.sfxVolume}%</span><input type="range" min="0" max="100" value=${st.sfxVolume} onChange=${function (e) { Store.setPref({ sfxVolume: +e.target.value }); sfx('coin'); }} /></label>
    <label class="switch"><input type="checkbox" checked=${st.reducedMotion} onChange=${function (e) { Store.setPref({ reducedMotion: e.target.checked }); }} />${L('ลดการเคลื่อนไหว', 'Reduce motion')}</label>
    <label class="switch"><input type="checkbox" checked=${st.screenShakeEnabled} onChange=${function (e) { Store.setPref({ screenShakeEnabled: e.target.checked }); }} />${L('จอสั่นตอนโดนโจมตี', 'Screen shake')}</label>
  </div>
  <div class="panel pad stack"><h3 class="h3">${L('บัญชี', 'Account')}</h3>
    <${AccountBox} />
    ${!a && pl ? html`<div class="stack">
      <p class="small">${L('ยังไม่ได้เข้าสู่ระบบ: ตัวละครผูกกับเครื่องนี้ด้วย "รหัสเครื่อง" เก็บรหัสไว้เพื่อเล่นต่อในเครื่องอื่น (อย่าให้คนอื่นรู้)', 'Not signed in: your character is tied to this device by a device key. Keep it to continue on another device (keep it secret).')}</p>
      <div class="row gap wrap"><button class="btn sm" onClick=${function () { setShown(!shown); }}>${shown ? L('ซ่อนรหัส', 'Hide key') : L('ดูรหัสเครื่อง', 'Show device key')}</button>${shown ? html`<button class="btn sm" onClick=${copy}>${L('คัดลอก', 'Copy')}</button>` : null}</div>
      ${shown ? html`<code class="devkey">${Store.deviceKey()}</code>` : null}</div>` : null}
    ${!a ? html`<label class="field"><span>${L('ใช้รหัสเครื่องจากเครื่องอื่น', 'Use a device key from another device')}</span><div class="row gap"><input type="text" value=${key} placeholder="64 ${L('ตัวอักษร', 'characters')}" onInput=${function (e) { setKey(e.target.value); }} /><button class="btn sm" disabled=${key.trim().length !== 64} onClick=${useKey}>${L('ใช้', 'Use')}</button></div></label>` : null}
  </div>
  <p class="credit">QuestDojo RPG • ${L('ภาคต่อของ QuestClass RPG', 'a QuestClass RPG companion')}</p></section>`;
}

Store.boot();
render(html`<${App} />`, document.getElementById('app'));
