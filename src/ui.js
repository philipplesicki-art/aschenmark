// Oberfläche außerhalb des Canvas: Kopfleiste, Auswahlinfo, Befehlsknöpfe, Menüs, Meldungen.
import { saveGame, hasSave } from './save.js';
import { G, UI, hooks, cam, view } from './state.js';
import { regionAt, REGIONS } from './regions.js';
import { EVENTS, evAt } from './events.js';
import { FACTIONS, FAC_IDS, XP_STEPS, MAX_HERO_LVL, defOf, bldName } from './factions.js';
import { techName, seasonAt, foodRates } from './economy.js';
import { DIFF, QUALITY } from './config.js';
import { popUsed, popCap } from './world.js';
import { cmdDefs, selEnts, selectArmy, selectIdle, usePower } from './commands.js';
import { canPower, powerOf } from './combat.js';
import { centerOn } from './camera.js';
import { loadSettings, saveSettings } from './settings.js';
import { setVolumes, sfx } from './audio.js';
import { platform, ACHIEVEMENTS } from './platform.js';
import { questProgress, ENDINGS } from './quests.js';
import { finishBattle } from './battle.js';

const $ = id => document.getElementById(id);
let btns = [];
export const cb = { start: () => {}, load: () => {}, restart: () => {}, menuScene: () => {}, campaign: () => {}, campaignLoad: () => {}, hasCampaign: () => false, battleBack: () => {} };

export function ovOpen() { return !$('ov').hidden; }

export function toast(msg, cls) {
  const box = $('toast'), d = document.createElement('div');
  d.className = 't ' + (cls || ''); d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 3200);
}

const bar = (v, m, cls) => '<div class="bar ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, v / m * 100)) + '%"></i></div>';

function renderQuest() {
  const box = $('quest'), pr = G && questProgress();
  if (!pr) { box.hidden = true; return; }
  const h = '<div class="qt">' + pr.def.title + '</div><div class="qx">' + pr.def.text + '</div>'
    + pr.goals.map(g => '<div class="qg' + (g.cur >= g.max ? ' ok' : '') + '"><span>' + g.text + '</span><span>' + (g.max > 1 ? g.cur + '/' + g.max : '') + '</span></div>').join('');
  if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
  box.hidden = false;
}

function renderInfo() {
  const s = selEnts(); let h = '';
  if (!s.length) h = '<div class="hint">Einheit antippen oder Rahmen ziehen. Zerstöre die gegnerische Festung im Nordosten, bevor deine fällt. Rechtsklick auf einen Baum: Arbeiter fällen Holz. Ein Holzlager am Wald spart lange Wege.</div>';
  else if (s.length === 1) {
    const e = s[0];
    h = '<div class="nm">' + (e.kind === 'bld' ? bldName(e) : e.d.name) + (e.team === 1 ? ' <span class="sub">Feind</span>' : e.team === 3 ? ' <span class="sub">Wild</span>' : '') + '</div>';
    if (e.kind === 'dep') h += '<div class="sub">Erz: ' + Math.ceil(e.amt) + ' von ' + e.max + '</div>' + bar(e.amt, e.max, 'q');
    else {
      h += bar(e.hp, e.maxhp) + '<div class="sub">' + Math.ceil(e.hp) + ' / ' + e.maxhp + ' Leben';
      if (e.type === 'worker' && e.team === 0 && e.carry > 0) h += ' · trägt ' + e.carry + (e.cres === 'wood' ? ' Holz' : ' Erz');
      if (e.type === 'hq') h += ' · Stufe ' + (e.tier || 1);
      if (e.type === 'hero') {
        h += ' · Stufe ' + e.lvl;
        const next = XP_STEPS[e.lvl - 1], prev = e.lvl > 1 ? XP_STEPS[e.lvl - 2] : 0;
        if (e.lvl < MAX_HERO_LVL) h += '</div>' + bar(e.xp - prev, next - prev, 'x') + '<div class="sub">Erfahrung ' + e.xp + ' / ' + next;
      }
      if (e.kind === 'bld' && !e.built) h += ' · Bau ' + Math.floor(e.prog * 100) + '%';
      if (e.kind === 'bld' && e.queue.length) { const q = e.queue[0], qd = defOf(e.fac, q.type); h += ' · ' + qd.name + ' (' + e.queue.length + ')</div>' + bar(q.t, qd.time, 'q'); }
      else h += '</div>';
      if (e.kind === 'bld' && e.up) h += '<div class="sub">Ausbau zur ' + FACTIONS[e.fac].tiers[e.up.to - 1] + '</div>' + bar(e.up.t, e.up.dur, 'q');
      if (e.kind === 'bld' && e.rs) h += '<div class="sub">Forschung: ' + techName(e.fac, e.rs.id, e.rs.lvl) + '</div>' + bar(e.rs.t, e.rs.dur, 'x');
    }
  } else {
    const c = {}; s.forEach(e => { c[e.d.name] = (c[e.d.name] || 0) + 1; });
    h = '<div class="nm">' + s.length + ' ausgewählt</div><div class="chips">' + Object.entries(c).map(([k, v]) => '<span>' + k + ' ×' + v + '</span>').join('') + '</div>';
  }
  $('info').innerHTML = h;
}

function buildCmds() {
  const defs = cmdDefs();
  const sig = defs.map(d => d.id).join('|') + '#' + G.sel.join(',') + (UI.mode || '');
  if (sig === UI.sig) return;
  UI.sig = sig;
  const box = $('cmds'); box.textContent = ''; btns = [];
  for (const d of defs) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; if (d.title) b.title = d.title;
    b.innerHTML = d.label + (d.key && d.key !== 'escape' ? ' <span class="k">' + d.key + '</span>' : '') + (d.cost ? ' <span class="c">' + d.cost + '</span>' : '');
    b.addEventListener('click', () => { if (d.en()) { d.fn(); sfx('click'); } });
    box.appendChild(b); btns.push({ d, b });
  }
  renderInfo();
}

export function refreshUI() {
  if (!G) return;
  $('ore').textContent = Math.floor(G.ore[0]);
  $('wood').textContent = Math.floor(G.wood[0]);
  { const fr = foodRates(0), s = seasonAt(G.t), net = fr.net, fe = $('foodNet'), ch = $('seasonChip');
    $('food').textContent = Math.floor(G.food[0]);
    fe.textContent = (net >= 0 ? '+' : '') + net.toFixed(1); fe.className = net < -.05 ? 'neg' : net > .05 ? 'pos' : '';
    $('seasonN').textContent = s.name; $('seasonT').textContent = Math.floor(s.left / 60) + ':' + String(Math.floor(s.left % 60)).padStart(2, '0'); ch.className = 'stat season ' + s.id; }
  $('pop').textContent = G.battle ? G.ents.filter(e => e.team === 0 && e.kind === 'unit').length + ' gegen ' + G.ents.filter(e => e.team === G.battle.E && e.kind === 'unit').length : popUsed(0) + '/' + popCap(0);
  $('pp').textContent = G.pp[0].toFixed(1);
  renderQuest();
  { const cx = cam.x + view.w / cam.z / 2, cy = cam.y + view.h / cam.z / 2;
    $('reg').textContent = REGIONS[regionAt(cx, cy)].name;
    const ev = G.ev, chip = $('evChip');
    if (ev && ev.id) {
      const here = evAt(cx, cy) > 0, ph = ev.ph === 'omen' ? 'Vorzeichen' : ev.ph === 'peak' ? 'Höhepunkt' : 'Abklingen';
      $('evN').textContent = EVENTS[ev.id].name + (here ? '' : ' (' + REGIONS[EVENTS[ev.id].reg[0]].name + ')'); $('evP').textContent = ph; chip.hidden = false;
    } else chip.hidden = true;
  }
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
  $('clock').textContent = m + ':' + String(s).padStart(2, '0');
  $('idleN').textContent = G.ents.filter(e => !e.dead && e.team === 0 && e.type === 'worker' && !e.order).length;
  const p = powerOf(0), pb = $('bPower');
  pb.textContent = p.name + ' (' + p.cost + ')' + (G.ppCd[0] > 0 ? ' ' + Math.ceil(G.ppCd[0]) + 's' : '') + ' R';
  pb.disabled = !canPower(0); pb.title = p.desc;
  buildCmds();
  for (const { d, b } of btns) {
    b.disabled = !d.en();
    b.classList.toggle('on', !!(d.on && d.on()));
    if (d.cd) {
      const c = d.cd(), k = b.querySelector('.c');
      if (c > 0) { if (!k) b.insertAdjacentHTML('beforeend', ' <span class="c"></span>'); b.querySelector('.c').textContent = Math.ceil(c) + 's'; }
      else if (k) k.remove();
    }
  }
  renderInfo();
}

export function wireTopBar() {
  $('bIdle').addEventListener('click', () => { if (G) { const u = selectIdle(); if (u) centerOn(u.x, u.y); } });
  $('bArmy').addEventListener('click', () => { if (G) selectArmy(); });
  $('bPower').addEventListener('click', () => { if (G) usePower(); });
  $('bMenu').addEventListener('click', () => { if (G && !G.over) openMenu(); });
}

/* ---------- Menüs ---------- */
// Alle Menüs teilen sich die Karte #card im Overlay #ov. Jeder Bildschirm liefert HTML und verarbeitet Klicks
// über data-act; Escape führt einen Schritt zurück. Im Hauptmenü läuft dahinter eine lebende Szene.
export const VERSION = '0.3.0';
let screen = null;
const has = (el, c) => !!(el && el.classList && el.classList.contains && el.classList.contains(c));

function setMenuLook(on) { // Hauptmenü: Spielfläche ohne Leisten, Karte links über der laufenden Szene
  for (const id of ['app', 'ov', 'card']) { const el = $(id); if (el && el.classList) el.classList.toggle(id === 'app' ? 'inmenu' : 'menu', on); }
}
function show(html, onAct, back, focusSel) {
  const card = $('card');
  card.innerHTML = html; $('ov').hidden = false; screen = { back };
  card.onclick = e => {
    const a = e.target.closest && e.target.closest('[data-act]'); if (!a || a.disabled) return;
    sfx('click'); onAct(a.dataset.act, a);
  };
  const f = card.querySelector && (card.querySelector(focusSel || '[autofocus]') || card.querySelector('.mbtn, .btn'));
  if (f && f.focus) try { f.focus({ preventScroll: true }); } catch (_) {}
}
function closeOverlay() { setMenuLook(false); $('ov').hidden = true; screen = null; }
const mbtn = (act, title, sub) => '<button class="mbtn" type="button" data-act="' + act + '"><span>' + title + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>';
const toggle = (act, label, on) => '<button class="btn tog' + (on ? ' sel' : '') + '" data-act="' + act + '" type="button">' + label + ': <b>' + (on ? 'an' : 'aus') + '</b></button>';
const backRow = (extra = '') => '<div class="row end"><button class="btn" data-act="back" type="button">Zurück</button>' + extra + '</div>';

// Tastatur im Menü: Escape zurück, Pfeiltasten wandern durch die Knöpfe.
export function menuKey(k, e) {
  if (k === 'escape') { if (screen && screen.back) { sfx('click'); screen.back(); } return true; }
  if (k !== 'arrowdown' && k !== 'arrowup') return false;
  const card = $('card'); if (!card.querySelectorAll) return true;
  const bs = [...card.querySelectorAll('button:not([disabled]), input')];
  const i = bs.indexOf(document.activeElement), n = bs.length; if (!n) return true;
  const next = bs[i < 0 ? 0 : (i + (k === 'arrowdown' ? 1 : -1) + n) % n];
  if (next && next.focus) next.focus();
  if (e && e.preventDefault) e.preventDefault();
  return true;
}

export function showStart() {
  setMenuLook(true);
  cb.menuScene(loadSettings().fac);
  mainMenu();
}

function mainMenu() {
  setMenuLook(true);
  const items = [
    hasSave() && mbtn('continue', 'Fortsetzen', 'Den gespeicherten Spielstand laden'),
    mbtn('campaign', 'Kampagne', 'Orsa erobern: Weltkarte, Provinzen, Heere, viele Jahre'),
    mbtn('new', 'Neues Gefecht', 'Fraktion, Gegner und Schwierigkeit wählen'),
    mbtn('settings', 'Einstellungen', 'Ton, Grafik und Anzeige'),
    mbtn('chronicle', 'Chronik', 'Siege, Handlungsfäden und Erfolge'),
    mbtn('help', 'Steuerung', 'Maus, Tasten, Touch und Taktik'),
    mbtn('credits', 'Mitwirkende'),
    platform.canQuit && mbtn('quit', 'Beenden')
  ].filter(Boolean).join('');
  show('<div class="title"><h1>Aschenmark</h1><div class="tag">Ein Echtzeit-Strategiespiel aus Orsa</div></div>'
    + '<nav class="mlist">' + items + '</nav>'
    + '<div class="foot">Version ' + VERSION + ' · Welt, Grafik und Musik entstehen im Code</div>',
  act => {
    if (act === 'continue') { closeOverlay(); cb.load(); }
    else if (act === 'new') setupScreen();
    else if (act === 'campaign') campaignScreen();
    else if (act === 'settings') settingsScreen(mainMenu);
    else if (act === 'chronicle') chronicleScreen();
    else if (act === 'help') helpScreen(mainMenu);
    else if (act === 'credits') creditsScreen();
    else if (act === 'quit') platform.quit();
  }, null);
}

function setupScreen() {
  const st = loadSettings();
  let fac = FACTIONS[st.fac] ? st.fac : FAC_IDS[0], opp = st.opp || 'random', diff = DIFF[st.diff] ? st.diff : 'hard', quests = st.quests !== false;
  const render = focus => {
    if (opp === fac) opp = 'random';
    const opps = [['random', 'Zufall', '#8d99a5']].concat(FAC_IDS.filter(f => f !== fac).map(f => [f, FACTIONS[f].name, FACTIONS[f].color]));
    show('<h2>Neues Gefecht</h2>'
      + '<h3>Deine Fraktion</h3><div class="row facs">' + FAC_IDS.map(id => { const f = FACTIONS[id];
        return '<button class="btn pick' + (id === fac ? ' sel' : '') + '" data-act="fac" data-v="' + id + '" type="button" style="--fc:' + f.color + '"><b>' + f.name + '</b><small>' + f.blurb + '</small></button>'; }).join('') + '</div>'
      + '<h3>Gegner</h3><div class="row">' + opps.map(([id, n, c]) => '<button class="btn pick sm' + (id === opp ? ' sel' : '') + '" data-act="opp" data-v="' + id + '" type="button" style="--fc:' + c + '"><b>' + n + '</b></button>').join('') + '</div>'
      + '<h3>Schwierigkeit</h3><div class="row">' + Object.entries(DIFF).map(([k, d]) => '<button class="btn pick sm' + (k === diff ? ' sel' : '') + '" data-act="diff" data-v="' + k + '" type="button"><b>' + d.label + '</b></button>').join('') + '</div>'
      + '<h3>Aufträge</h3><div class="row"><button class="btn pick' + (quests ? ' sel' : '') + '" data-act="quests" type="button"><b>' + (quests ? 'An' : 'Aus') + '</b><small>Zwölf Aufträge führen durch das Gefecht und öffnen die Außengebiete</small></button></div>'
      + backRow('<button class="btn big go" data-act="start" type="button">Gefecht beginnen</button>'),
    (act, el) => {
      if (act === 'fac') { if (fac !== el.dataset.v) { fac = el.dataset.v; saveSettings({ fac }); cb.menuScene(fac); } render('[data-act=fac].sel'); }
      else if (act === 'opp') { opp = el.dataset.v; saveSettings({ opp }); render('[data-act=opp].sel'); }
      else if (act === 'diff') { diff = el.dataset.v; saveSettings({ diff }); render('[data-act=diff].sel'); }
      else if (act === 'quests') { quests = !quests; saveSettings({ quests }); render('[data-act=quests]'); }
      else if (act === 'back') mainMenu();
      else if (act === 'start') {
        const others = FAC_IDS.filter(f => f !== fac), o = opp === 'random' ? others[Math.floor(Math.random() * others.length)] : opp;
        closeOverlay(); cb.start(fac, diff, quests, o);
      }
    }, mainMenu, focus || '.go');
  };
  render();
}

function campaignScreen() {
  const st = loadSettings();
  let fac = FACTIONS[st.fac] ? st.fac : FAC_IDS[0], diff = ['easy', 'normal', 'hard', 'brutal'].includes(st.cdiff) ? st.cdiff : 'hard', size = [30, 48, 72].includes(st.csize) ? st.csize : 48;
  const render = focus => {
    show('<h2>Kampagne</h2><p class="sub">Rundenbasiert auf der Weltkarte von Orsa: Provinzen erobern, Siedlungen ausbauen, Heere führen, forschen. Eine Runde ist eine Jahreszeit.</p>'
      + (cb.hasCampaign() ? '<div class="row"><button class="btn big go" data-act="cont" type="button">Kampagne fortsetzen</button></div><h3>Oder neu beginnen</h3>' : '')
      + '<h3>Dein Reich</h3><div class="row facs">' + FAC_IDS.map(id => { const f = FACTIONS[id];
        return '<button class="btn pick' + (id === fac ? ' sel' : '') + '" data-act="fac" data-v="' + id + '" type="button" style="--fc:' + f.color + '"><b>' + f.name + '</b><small>' + f.blurb + '</small></button>'; }).join('') + '</div>'
      + '<h3>Schwierigkeit</h3><div class="row">' + [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer'], ['brutal', 'Unerbittlich']].map(([k, n]) => '<button class="btn pick sm' + (k === diff ? ' sel' : '') + '" data-act="diff" data-v="' + k + '" type="button"><b>' + n + '</b></button>').join('') + '</div>'
      + '<h3>Größe der Welt</h3><div class="row">' + [[30, 'Klein'], [48, 'Mittel'], [72, 'Groß']].map(([k, n]) => '<button class="btn pick sm' + (k === size ? ' sel' : '') + '" data-act="size" data-v="' + k + '" type="button"><b>' + n + '</b><small>' + k + ' Provinzen</small></button>').join('') + '</div>'
      + backRow('<button class="btn big' + (cb.hasCampaign() ? '' : ' go') + '" data-act="start" type="button">Neue Kampagne</button>'),
    (act, el) => {
      if (act === 'fac') { fac = el.dataset.v; saveSettings({ fac }); render('[data-act=fac].sel'); }
      else if (act === 'diff') { diff = el.dataset.v; saveSettings({ cdiff: diff }); render('[data-act=diff].sel'); }
      else if (act === 'size') { size = +el.dataset.v; saveSettings({ csize: size }); render('[data-act=size].sel'); }
      else if (act === 'back') mainMenu();
      else if (act === 'cont') { closeOverlay(); cb.campaignLoad(); }
      else if (act === 'start') { closeOverlay(); cb.campaign(fac, diff, size); }
    }, mainMenu, focus || '.go');
  };
  render();
}

const Q_HINT = {
  low: 'Ohne Schatten und Nachbearbeitung, zwei Lichtquellen. Für schwache Grafik und ältere Laptops.',
  medium: 'Schatten, vier Lichtquellen, mittlere Pixeldichte. Ein guter Ausgleich für die meisten Rechner.',
  high: 'Volle Schatten, acht Lichtquellen und scharfe Darstellung auf hochauflösenden Bildschirmen.'
};
function settingsScreen(back) {
  let full = false;
  const render = focus => {
    const st = loadSettings(), q = QUALITY[st.quality] ? st.quality : 'high';
    show('<h2>Einstellungen</h2>'
      + '<h3>Ton</h3><label>Musik <input id="vm" type="range" min="0" max="1" step=".05" value="' + st.music + '"></label>'
      + '<label>Effekte <input id="vs" type="range" min="0" max="1" step=".05" value="' + st.sfx + '"></label>'
      + '<h3>Grafik</h3><div class="row">' + Object.entries(QUALITY).map(([k, d]) => '<button class="btn pick sm' + (k === q ? ' sel' : '') + '" data-act="q" data-v="' + k + '" type="button"><b>' + d.label + '</b></button>').join('') + '</div>'
      + '<p class="sub">' + Q_HINT[q] + '</p>'
      + '<div class="row">' + toggle('fx', 'Nachbearbeitung', st.fx !== false) + toggle('fps', 'Bildrate anzeigen', !!st.fps) + toggle('full', 'Vollbild', full) + '</div>'
      + backRow(),
    (act, el) => {
      if (act === 'q') { saveSettings({ quality: el.dataset.v }); hooks.setQuality(el.dataset.v); render('[data-act=q].sel'); }
      else if (act === 'fx') { const on = loadSettings().fx === false; saveSettings({ fx: on }); hooks.setFx(on); render('[data-act=fx]'); }
      else if (act === 'fps') { saveSettings({ fps: !loadSettings().fps }); render('[data-act=fps]'); }
      else if (act === 'full') platform.setFullscreen(!full).then(() => platform.isFullscreen()).then(v => { full = v; render('[data-act=full]'); });
      else if (act === 'back') back();
    }, back, focus);
    const upd = () => { const m = +$('vm').value, s = +$('vs').value; setVolumes(m, s); saveSettings({ music: m, sfx: s }); };
    $('vm').oninput = upd; $('vs').oninput = upd;
  };
  render();
  platform.isFullscreen().then(v => { if (v !== full && screen && screen.back === back) { full = v; render(); } });
}

function chronicleScreen() {
  const st = loadSettings(), wins = st.wins || {}, chains = st.chains || {}, ach = st.ach || {};
  show('<h2>Chronik</h2><h3>Fraktionen</h3><div class="chron">' + FAC_IDS.map(id => { const f = FACTIONS[id];
    return '<div class="crow" style="--fc:' + f.color + '"><b>' + f.name + '</b><span class="' + (wins[id] ? 'ok' : '') + '">' + (wins[id] ? 'Sieg errungen' : 'Noch kein Sieg') + '</span><span class="' + (chains[id] ? 'ok' : '') + '">' + (chains[id] ? 'Handlungsfaden vollendet' : 'Handlungsfaden offen') + '</span></div>'; }).join('') + '</div>'
    + '<h3>Erfolge</h3><ul class="ach">' + Object.entries(ACHIEVEMENTS).map(([k, n]) => '<li class="' + (ach[k] ? 'ok' : '') + '">' + n + '</li>').join('') + '</ul>'
    + backRow(), act => { if (act === 'back') mainMenu(); }, mainMenu);
}

function helpScreen(back) {
  show('<h2>Steuerung</h2><ul class="help">'
    + '<li><b>Maus</b> Linksklick wählt, Rahmen ziehen wählt mehrere, Rechtsklick befiehlt, Mausrad zoomt, Doppelklick wählt alle gleichen Truppen</li>'
    + '<li><b>Touch</b> Tippen wählt und befiehlt, Wischen verschiebt, zwei Finger zoomen. Bauplatz und Ziele erst antippen, dann erneut bestätigen</li>'
    + '<li><b>Tasten</b> A Angriffsmarsch, S Halt, Q und X Heldenfähigkeiten, R Macht, E Heer, Punkt untätiger Arbeiter, Strg+1 bis 5 Gruppen, Leertaste zur Auswahl, Escape Menü, F11 Vollbild</li>'
    + '<li><b>Held</b> sammelt Erfahrung durch Kämpfe, steigt bis Stufe 5 auf und schaltet auf Stufe 2 die zweite Fähigkeit frei</li>'
    + '<li><b>Macht</b> Machtpunkte wachsen mit der Zeit und mit besiegten Feinden. Mit R wählst du ein Zielgebiet</li>'
    + '<li><b>Taktik</b> Speere schlagen Reiter, Reiter schlagen Fernkämpfer, Fernkämpfer schlagen Speere. Belagerung zerstört Gebäude, ist aber gegen Truppen schwach</li>'
    + '<li><b>Fraktionen</b> Die Grenzwacht hält stand, die Aschenhorde kommt in Massen, der Salzbund kämpft auf Abstand und heilt</li></ul>'
    + backRow(), act => { if (act === 'back') back(); }, back);
}

function creditsScreen() {
  show('<h2>Mitwirkende</h2>'
    + '<p>Entwicklung: Philipp Lesicki, gebaut mit Claude Code.</p>'
    + '<p class="sub">Alle Modelle, Texturen, Effekte und die Musik entstehen zur Laufzeit im Code. Namen, Orte und Figuren der Welt Orsa sind eigene Erfindungen.</p>'
    + '<h3>Verwendete Software</h3><ul class="help">'
    + '<li>Three.js (MIT-Lizenz) für die 3D-Darstellung</li><li>Vite (MIT-Lizenz) zum Bauen</li><li>Electron (MIT-Lizenz) für die Desktop-Fassung</li>'
    + '<li>Schriften Barlow Condensed und Spectral SC (SIL Open Font License)</li></ul>'
    + backRow(), act => { if (act === 'back') mainMenu(); }, mainMenu);
}

/* ---------- Pause, Bestätigung, Ende ---------- */
export function openMenu() {
  if (!G || G.over || G.demo) return;
  G.paused = true; setMenuLook(false);
  if (G.battle) return battleMenu();
  show('<h2>Pause</h2><nav class="mlist compact">'
    + mbtn('resume', 'Weiterspielen') + mbtn('save', 'Speichern') + (hasSave() ? mbtn('load', 'Letzten Spielstand laden') : '')
    + mbtn('settings', 'Einstellungen') + mbtn('help', 'Steuerung') + mbtn('menu', 'Hauptmenü') + (platform.canQuit ? mbtn('quit', 'Beenden') : '') + '</nav>',
  act => {
    if (act === 'resume') closeMenu();
    else if (act === 'save') { const ok = saveGame(); toast(ok ? 'Spielstand gespeichert' : 'Speichern nicht möglich', ok ? 'good' : 'bad'); }
    else if (act === 'load') confirmScreen('Spielstand laden?', 'Der laufende Fortschritt seit dem letzten Speichern geht verloren.', () => { closeOverlay(); cb.load(); }, openMenu);
    else if (act === 'settings') settingsScreen(openMenu);
    else if (act === 'help') helpScreen(openMenu);
    else if (act === 'menu') confirmScreen('Zum Hauptmenü?', 'Nicht gespeicherter Fortschritt geht verloren.', () => cb.restart(), openMenu, true);
    else if (act === 'quit') confirmScreen('Spiel beenden?', 'Nicht gespeicherter Fortschritt geht verloren.', () => platform.quit(), openMenu, true);
  }, closeMenu);
}
// Pause in der Schlacht aus der Kampagne: Speichern geht nur auf der Weltkarte, statt Hauptmenü gibt es den Rückzug
function battleMenu() {
  show('<h2>Schlacht bei ' + G.battle.name + '</h2><nav class="mlist compact">'
    + mbtn('resume', 'Weiterkämpfen') + mbtn('retreat', 'Rückzug', 'Die Schlacht ist verloren, ein Teil der Truppen entkommt')
    + mbtn('settings', 'Einstellungen') + mbtn('help', 'Steuerung') + '</nav>',
  act => {
    if (act === 'resume') closeMenu();
    else if (act === 'retreat') confirmScreen('Rückzug antreten?', 'Die Schlacht gilt als verloren. Wer noch steht, zieht sich zurück, ein Fünftel geht dabei verloren.', () => { closeOverlay(); G.paused = false; finishBattle(false, true); }, battleMenu);
    else if (act === 'settings') settingsScreen(battleMenu);
    else if (act === 'help') helpScreen(battleMenu);
  }, closeMenu);
}
// Ende einer Schlacht aus der Kampagne: Bilanz, dann zurück auf die Weltkarte
export function showBattleEnd(res) {
  const B = G.battle, sum = u => Object.values(u).reduce((n, v) => n + v, 0), p0 = sum(B.start.p), e0 = sum(B.start.e);
  const title = res.retreat ? 'Rückzug' : res.won ? 'Sieg bei ' + B.name : 'Niederlage bei ' + B.name;
  sfx(res.won ? 'win' : 'lose');
  setTimeout(() => {
    setMenuLook(false); G.paused = true;
    show('<h2>' + title + '</h2>'
      + '<p>' + (res.won ? (B.playerAttacks ? 'Das Feld ist geräumt. ' + B.name + ' kann eingenommen werden.' : 'Der Angriff ist abgeschlagen.') : res.retreat ? 'Die Truppen lösen sich vom Feind.' : 'Das Heer ist geschlagen.') + '</p>'
      + '<p class="sub">Dauer ' + Math.floor(res.time / 60) + ':' + String(Math.floor(res.time % 60)).padStart(2, '0') + ' · eigene Truppen ' + sum(res.p) + ' von ' + p0 + ' · Gegner ' + sum(res.e) + ' von ' + e0
      + (B.scale > 1 ? '<br>Jede Figur stand für ' + B.scale + ' Krieger.' : '') + (B.start.pHero && !res.pHero ? '<br>Dein Held ist verwundet und fällt drei Runden aus.' : '') + '</p>'
      + '<div class="row end"><button class="btn go" data-act="back" type="button">Zur Weltkarte</button></div>',
    act => { if (act === 'back') { closeOverlay(); cb.battleBack(res); } }, null, '.go');
  }, res.retreat ? 0 : 1400);
}
function confirmScreen(title, text, yes, back, offerSave) {
  show('<h2>' + title + '</h2><p>' + text + '</p><div class="row end"><button class="btn" data-act="no" type="button">Abbrechen</button>'
    + (offerSave ? '<button class="btn" data-act="saveyes" type="button">Speichern und weiter</button>' : '')
    + '<button class="btn go" data-act="yes" type="button">' + (offerSave ? 'Ohne Speichern' : 'Ja') + '</button></div>',
  act => { if (act === 'no') back(); else if (act === 'yes') yes(); else if (act === 'saveyes') { saveGame(); yes(); } }, back, '[data-act=no]');
}
export function closeMenu() { if (G) G.paused = false; closeOverlay(); }

export function showChainEnd() {
  if (!G || !G.quest) return;
  G.paused = true;
  const chain = G.quest.chain, end = ENDINGS[chain] || { title: 'Der Anfang ist gemacht', text: [] };
  const m = Math.floor(G.t / 60), open = Object.values(REGIONS).filter(r => G.regions[r.id]).map(r => r.name).join(', ');
  saveSettings({ chains: { ...(loadSettings().chains || {}), [chain]: true } }); achieve('CHAIN_DONE');
  setMenuLook(false);
  show('<h2>' + end.title + '</h2>' + end.text.map(p => '<p>' + p + '</p>').join('')
    + '<p class="sub">Dauer ' + m + ' Minuten · besiegt ' + G.kills + ' · verloren ' + G.lost + '<br>Offene Gebiete: ' + open + '</p>'
    + '<p class="sub">Hier endet der erste Teil. Du kannst weiterspielen und das Gefecht zu Ende bringen.</p>'
    + '<div class="row end"><button class="btn" data-act="menu" type="button">Hauptmenü</button><button class="btn go" data-act="resume" type="button">Weiterspielen</button></div>',
  act => { if (act === 'resume') closeMenu(); else if (act === 'menu') cb.restart(); }, closeMenu, '.go');
}

export function showEnd(kind) {
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60), f = FACTIONS[G.fac[0]], again = [G.fac[0], G.diff, !!G.quest, G.fac[1]];
  const html = (kind === 'win' ? '<h2>Sieg</h2><p>' + f.win + '</p>' : '<h2>Niederlage</h2><p>' + f.lose + '</p>')
    + '<p class="sub">Dauer ' + m + ':' + String(s).padStart(2, '0') + ' · besiegt ' + G.kills + ' · verloren ' + G.lost + '</p>'
    + '<div class="row end"><button class="btn" data-act="menu" type="button">Hauptmenü</button><button class="btn go" data-act="again" type="button">Gleiche Einstellungen</button></div>';
  setTimeout(() => {
    setMenuLook(false);
    show(html, act => { if (act === 'again') { closeOverlay(); cb.start(...again); } else if (act === 'menu') cb.restart(); }, null, '.go');
  }, 1400);
}

function achieve(id) {
  const ach = loadSettings().ach || {};
  if (!ach[id]) saveSettings({ ach: { ...ach, [id]: true } });
  platform.unlock(id);
}

export function handleEnd(kind) {
  if (G.over || G.demo) return;
  G.over = kind;
  sfx(kind === 'win' ? 'win' : 'lose');
  if (kind === 'win') {
    const st = loadSettings(), wins = { ...st.wins, [G.fac[0]]: true }, n = FAC_IDS.filter(f => wins[f]).length;
    saveSettings({ wins });
    achieve('WIN_FIRST');
    if (G.diff === 'hard') achieve('WIN_HARD');
    if (n >= 2) achieve('WIN_BOTH');
    if (n >= FAC_IDS.length) achieve('WIN_ALL');
  }
  showEnd(kind);
}

export function wireHooks(extra) {
  // In der Szene hinter dem Hauptmenü bleibt das Spiel stumm: keine Meldungen, kein Ende.
  hooks.toast = (m, c) => { if (!(G && G.demo)) toast(m, c); };
  hooks.endGame = handleEnd;
  hooks.achieve = id => { if (!(G && G.demo)) achieve(id); };
  Object.assign(hooks, extra);
}
