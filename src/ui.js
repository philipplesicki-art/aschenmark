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
import { finishBattle, startBattle } from './battle.js';
import { iconFor } from './icons.js';
import { VET_NAMES } from './combat.js';
import { avgMorale } from './tactics.js';
import { coverAt, mudAt } from './terrain.js';

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
  if (!s.length) h = '<div class="hint">' + (G.battle ? 'Taste <b>E</b> wählt das ganze Heer, Rechtsklick schickt es los, <b>F</b> befiehlt den Angriffsmarsch. Über <b>Esc</b> geht es zum Rückzug.' : 'Linksklick wählt, ein gezogener Rahmen wählt mehrere, Rechtsklick befiehlt. Arbeiter bauen, schürfen Erz und fällen Holz (Rechtsklick auf Ader oder Baum). Ziel: die gegnerische Festung im Nordosten zerstören.') + '</div>';
  else if (s.length === 1) {
    const e = s[0];
    h = '<div class="nm">' + (e.kind === 'bld' ? bldName(e) : e.d.name) + (e.team === 1 ? ' <span class="sub">Feind</span>' : e.team === 3 ? ' <span class="sub">Wild</span>' : '') + '</div>';
    if (e.kind === 'dep') h += '<div class="sub">Erz: ' + Math.ceil(e.amt) + ' von ' + e.max + '</div>' + bar(e.amt, e.max, 'q');
    else {
      h += bar(e.hp, e.maxhp) + '<div class="sub">' + Math.ceil(e.hp) + ' / ' + e.maxhp + ' Leben';
      if (e.type === 'worker' && e.team === 0 && e.carry > 0) h += ' · trägt ' + e.carry + (e.cres === 'wood' ? ' Holz' : ' Erz');
      if (e.type === 'hq') h += ' · Stufe ' + (e.tier || 1);
      if (e.kind === 'unit' && G.battle && e.mor !== undefined && e.type !== 'hero') h += e.rout ? ' · <span class="mor low">auf der Flucht</span>' : ' · <span class="mor' + (e.mor < 35 ? ' low' : '') + '">Moral ' + Math.round(e.mor) + '</span>';
      if (e.kind === 'unit' && e.vet) h += ' · <span class="vet">' + '▲'.repeat(e.vet) + ' ' + VET_NAMES[e.vet] + '</span>';
      if (e.kind === 'unit' && e.hold && e.team === 0) h += ' · hält Stellung';
      if (e.kind === 'unit' && coverAt(e.x, e.y)) h += ' · <span class="terr">Deckung</span>';
      if (e.kind === 'unit' && mudAt(e.x, e.y)) h += ' · <span class="terr">Schlamm</span>';
      if (e.type === 'hero') {
        h += ' · Stufe ' + e.lvl;
        const next = XP_STEPS[e.lvl - 1], prev = e.lvl > 1 ? XP_STEPS[e.lvl - 2] : 0;
        if (e.lvl < MAX_HERO_LVL) h += '</div>' + bar(e.xp - prev, next - prev, 'x') + '<div class="sub">Erfahrung ' + e.xp + ' / ' + next;
      }
      if (e.kind === 'bld' && !e.built) h += ' · Bau ' + Math.floor(e.prog * 100) + '%';
      if (e.kind === 'bld' && e.queue.length) { const q = e.queue[0], qd = defOf(e.fac, q.type); h += ' · ' + qd.name + ' (' + e.queue.length + ')</div>' + bar(q.t, qd.time, 'q'); }
      else h += '</div>';
      if (e.kind === 'unit' && e.d.dmg) h += '<div class="sub st">' + Math.round(e.d.dmg * (e.dmgMul || 1)) + ' Schaden alle ' + String(e.d.cd).replace('.', ',') + ' s · ' + (e.d.rng > 60 ? 'Reichweite ' + e.d.rng : 'Nahkampf') + ' · Tempo ' + e.d.spd + '</div>' + (e.d.desc ? '<div class="sub">' + e.d.desc + '</div>' : '');
      if (e.kind === 'bld' && e.d.dmg && e.built) h += '<div class="sub st">' + e.d.dmg + ' Schaden alle ' + String(e.d.cd).replace('.', ',') + ' s · Reichweite ' + e.d.rng + '</div>';
      if (e.kind === 'bld' && e.up) h += '<div class="sub">Ausbau zur ' + FACTIONS[e.fac].tiers[e.up.to - 1] + '</div>' + bar(e.up.t, e.up.dur, 'q');
      if (e.kind === 'bld' && e.rs) h += '<div class="sub">Forschung: ' + techName(e.fac, e.rs.id, e.rs.lvl) + '</div>' + bar(e.rs.t, e.rs.dur, 'x');
    }
  } else {
    const c = {}; s.forEach(e => { c[e.d.name] = (c[e.d.name] || 0) + 1; });
    h = '<div class="nm">' + s.length + ' ausgewählt</div><div class="chips">' + Object.entries(c).map(([k, v]) => '<span>' + k + ' ×' + v + '</span>').join('') + '</div>';
  }
  $('info').innerHTML = h;
}

// Kosten mit Rohstoffzeichen; was fehlt, wird rot
const costHtml = c => ' <span class="c">' + [['ore', G.ore[0]], ['wood', G.wood[0]]].filter(([k]) => c[k]).map(([k, have]) => '<span class="res ' + k + (have < c[k] ? ' no' : '') + '"><i></i>' + c[k] + '</span>').join('') + '</span>';
// Hinweisfeld über dem Knopf: Name, Wirkung, Werte, Kosten, Dauer, Sperrgrund
let tipFor = null;
function tipEl() { let t = $('tip'); if (!t) { t = document.createElement('div'); t.id = 'tip'; t.hidden = true; $('app').appendChild(t); } return t; }
function tipHtml(d) {
  const why = d.why ? d.why() : null;
  return '<div class="tn">' + d.label + (d.key && d.key !== 'escape' ? '<span class="k">' + d.key + '</span>' : '') + '</div>'
    + (d.desc ? '<div class="td">' + d.desc + '</div>' : '') + (d.stats ? '<div class="ts">' + d.stats + '</div>' : '')
    + (d.co || d.time ? '<div class="tc">' + (d.co ? costHtml(d.co) : '') + (d.time ? '<span class="tt">' + (d.timeLabel || 'Dauer') + ' ' + d.time + ' s</span>' : '') + '</div>' : '')
    + (why ? '<div class="tw">' + why + '</div>' : '');
}
function showTip(d, b) {
  if (!d.desc && !d.co && !d.why) return;
  const t = tipEl(); tipFor = { d, b }; t.innerHTML = tipHtml(d); t.hidden = false;
  const r = b.getBoundingClientRect(), a = $('app').getBoundingClientRect(), w = t.offsetWidth;
  t.style.left = Math.max(8, Math.min(a.width - w - 8, r.left - a.left + r.width / 2 - w / 2)) + 'px'; t.style.bottom = (a.bottom - r.top + 8) + 'px';
}
function hideTip() { tipFor = null; const t = $('tip'); if (t) t.hidden = true; }
function buildCmds() {
  const defs = cmdDefs();
  const sig = defs.map(d => d.id).join('|') + '#' + G.sel.join(',') + (UI.mode || '');
  if (sig === UI.sig) return;
  UI.sig = sig;
  const box = $('cmds'); box.textContent = ''; btns = []; hideTip();
  let grp = null, row = box;
  for (const d of defs) {
    if ((d.grp || '') !== grp) { // neue Gruppe: Überschrift und eigene Zeile
      grp = d.grp || ''; row = document.createElement('div'); row.className = 'cg';
      if (grp) { const l = document.createElement('span'); l.className = 'cgl'; l.textContent = grp; row.appendChild(l); }
      box.appendChild(row);
    }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn tile';
    b.innerHTML = iconFor(d) + (d.key && d.key !== 'escape' ? '<span class="k">' + d.key + '</span>' : '') + '<span class="l">' + d.label + '</span>' + (d.co ? costHtml(d.co) : d.cost ? ' <span class="c">' + d.cost + '</span>' : '');
    b.addEventListener('click', () => { if (d.en()) { d.fn(); sfx('click'); } else if (d.why && d.why()) toast(d.why(), 'bad'); });
    b.addEventListener('pointerenter', () => showTip(d, b)); b.addEventListener('pointerleave', hideTip);
    row.appendChild(b); btns.push({ d, b });
  }
  renderInfo();
}

export function refreshUI() {
  if (!G) return;
  $('ore').textContent = Math.floor(G.ore[0]);
  $('wood').textContent = Math.floor(G.wood[0]);
  { const fr = foodRates(0), s = seasonAt(G.t), net = fr.net, fe = $('foodNet'), ch = $('seasonChip');
    $('food').textContent = Math.floor(G.food[0]);
    fe.textContent = (net >= 0 ? '+' : '−') + Math.abs(net).toFixed(1).replace('.', ','); fe.className = net < -.05 ? 'neg' : net > .05 ? 'pos' : '';
    $('seasonN').textContent = s.name; $('seasonT').textContent = Math.floor(s.left / 60) + ':' + String(Math.floor(s.left % 60)).padStart(2, '0'); ch.className = 'stat season ' + s.id; }
  $('pop').textContent = G.battle ? G.ents.filter(e => e.team === 0 && e.kind === 'unit').length + ' gegen ' + G.ents.filter(e => e.team === G.battle.E && e.kind === 'unit').length + ' · Moral ' + avgMorale(0) + ' zu ' + avgMorale(1) : popUsed(0) + '/' + popCap(0);
  $('pp').textContent = G.pp[0].toFixed(1).replace('.', ',');
  renderQuest();
  { const dp = $('deploy'), on = !!G.battle && G.battle.phase === 'deploy' && !G.battle.over;
    if (on) { const h = '<span><b>Aufstellung</b> · noch ' + Math.max(0, Math.ceil(G.battle.depT - G.t)) + ' s · Truppen im markierten Feld ordnen</span><button class="btn" type="button" id="bFight">Schlacht beginnen</button>';
      if (dp.dataset.h !== h) { dp.innerHTML = h; dp.dataset.h = h; } dp.onclick = ev => { if (ev.target && ev.target.id === 'bFight') startBattle(); }; }
    dp.hidden = !on; }
  { const cx = cam.x + view.w / cam.z / 2, cy = cam.y + view.h / cam.z / 2;
    $('reg').textContent = G.battle ? G.battle.name : REGIONS[regionAt(cx, cy)].name; // in der Schlacht: die Provinz
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
  { const h = p.name + ' <span class="c">' + (G.ppCd[0] > 0 ? Math.ceil(G.ppCd[0]) + ' s' : p.cost + ' Macht') + '</span> <span class="k">R</span>'; if (pb.dataset.h !== h) { pb.innerHTML = h; pb.dataset.h = h; } }
  pb.classList.toggle('off', !canPower(0)); pb.title = p.desc + ' Kostet ' + p.cost + ' Machtpunkte.';
  buildCmds();
  if (tipFor) { const h = tipHtml(tipFor.d), t = tipEl(); if (t.dataset.h !== h) { t.innerHTML = h; t.dataset.h = h; } }
  for (const { d, b } of btns) {
    b.classList.toggle('off', !d.en());
    if (d.co) { const c = b.querySelector('.c'), h = costHtml(d.co).trim(); if (c && c.outerHTML !== h) c.outerHTML = h; }
    b.classList.toggle('on', !!(d.on && d.on()));
    if (d.cd) {
      const c = d.cd(), k = b.querySelector('.c');
      if (c > 0) { if (!k) b.insertAdjacentHTML('beforeend', ' <span class="c"></span>'); b.querySelector('.c').textContent = Math.ceil(c) + ' s'; }
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
export const VERSION = '0.7.2';
let screen = null;
const has = (el, c) => !!(el && el.classList && el.classList.contains && el.classList.contains(c));

function setMenuLook(on) { // Hauptmenü: Spielfläche ohne Leisten, Karte links über der laufenden Szene
  for (const id of ['app', 'ov', 'card']) { const el = $(id); if (el && el.classList) el.classList.toggle(id === 'app' ? 'inmenu' : 'menu', on); }
}
function show(html, onAct, back, focusSel) {
  const card = $('card');
  if (card.classList) card.classList.remove('wide');
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
    mbtn('help', 'Handbuch', 'Steuerung, Wirtschaft, Kampf und Kampagne'),
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

// Handbuch: vier Abschnitte, jeder als Liste aus Stichwort und Erklärung
export const HANDBOOK = {
  steuerung: ['Steuerung', [
    ['Maus', 'Linksklick wählt, ein gezogener Rahmen wählt mehrere, Doppelklick wählt alle gleichen Truppen im Bild. Rechtsklick befiehlt: ziehen, angreifen, Erz schürfen, Holz fällen, Baustelle fertigstellen. Das Mausrad zoomt.'],
    ['Tasten', 'W, A, S, D oder die Pfeiltasten bewegen die Kamera. F Angriffsmarsch, H Halt, G Stellung halten, Q und X Fähigkeiten des Helden, R Macht der Fraktion, E ganzes Heer, Punkt nächster untätiger Arbeiter, Leertaste springt zur Auswahl.'],
    ['Gruppen', 'Strg und eine Ziffer von 1 bis 5 speichert die Auswahl, die Ziffer allein ruft sie wieder auf.'],
    ['Befehlsleiste', 'Wer mit der Maus über einem Knopf verweilt, sieht Wirkung, Kosten, Dauer und in Rot den Grund, falls er gesperrt ist.'],
    ['Touch', 'Tippen wählt und befiehlt, Wischen verschiebt, zwei Finger zoomen. Bauplätze und Ziele erst antippen, dann bestätigen.'],
    ['Sonstiges', 'Escape öffnet das Menü, F11 schaltet das Vollbild.']
  ]],
  wirtschaft: ['Wirtschaft', [
    ['Erz', 'Bezahlt Truppen und Forschung. Arbeiter schürfen es an den Adern und tragen es zur Burg oder zu einem Vorposten.'],
    ['Holz', 'Bezahlt Bauwerke und Gerät. Rechtsklick auf einen Baum lässt Arbeiter fällen. Ein Holzlager am Waldrand spart lange Wege.'],
    ['Vorräte', 'Truppen essen. Höfe und die Burg ernten, das Lager fasst nur eine begrenzte Menge. Ist es leer, verlieren die Truppen Leben.'],
    ['Jahreszeiten', 'Ein Jahr dauert neun Minuten. Im Frühfrost sinkt die Ernte, im Hartfrost ruht sie fast ganz und die Truppen essen doppelt. Vor dem Winter Vorräte anlegen.'],
    ['Burgstufen', 'Der Ausbau der Burg schaltet Reiter, Werkstatt, Markt, Helfer und Elite frei, dazu die höheren Forschungen.'],
    ['Forschung', 'In Burg, Kaserne, Werkstatt und Markt. Jede Forschung wirkt sofort und dauerhaft.'],
    ['Handel', 'Der Markt tauscht Erz, Holz und Vorräte gegeneinander, anfangs zu einem schlechten Kurs.']
  ]],
  kampf: ['Kampf', [
    ['Stärken', 'Speere schlagen Reiter, Reiter schlagen Fernkämpfer, Fernkämpfer schlagen Speere. Belagerungsgerät zerstört Gebäude, ist gegen Truppen aber schwach.'],
    ['Helfer und Elite', 'Helfer kämpfen kaum, stärken aber alle in ihrer Nähe. Elitetruppen haben je eine besondere Eigenschaft.'],
    ['Held', 'Sammelt Erfahrung im Kampf und steigt bis Stufe 5 auf. Ab Stufe 2 kommt die zweite Fähigkeit dazu. Jede Fraktion hat nur einen.'],
    ['Macht', 'Machtpunkte wachsen mit der Zeit und mit besiegten Feinden. Mit R wählst du das Zielgebiet.'],
    ['Gelände', 'Am Waldrand mindert Deckung den Schaden durch Fernkampf um ein Drittel. Schlamm an Tümpeln und tiefer Schnee im Hartfrost bremsen.'],
    ['Wetter', 'Schneesturm, Ascheregen, Staubsturm, Flut und Salznebel kündigen sich an, nehmen Sicht und Tempo und treffen die Fraktionen verschieden hart.'],
    ['Fraktionen', 'Die Grenzwacht hält stand und heilt. Die Aschenhorde kommt billig, schnell und in Massen. Der Salzbund ist teuer, zäh und kämpft auf Abstand.']
  ]],
  taktik: ['Taktik', [
    ['Flanke und Rücken', 'Ein Nahkampftreffer von der Seite wirkt um ein Fünftel stärker, einer in den Rücken um die Hälfte, und beide drücken die Moral. Wer den Feind bindet und mit einer zweiten Gruppe umgeht, gewinnt auch gegen mehr Leute.'],
    ['Sturmangriff', 'Reiter mit Anlauf treffen beim ersten Schlag fast doppelt so hart. Danach brauchen sie neuen Anlauf: herausziehen und wieder anreiten lohnt sich.'],
    ['Feste Reihe', 'Fußvolk, das steht, ist von vorn schwerer zu treffen und fängt einen Sturmangriff ab; der Reiter nimmt dabei selbst Schaden. Reiter gehören deshalb in Flanke und Rücken oder auf Schützen.'],
    ['Stellung halten', 'Taste G. Die Truppe bleibt stehen und schlägt nur, was in Reichweite kommt. So bleibt die Reihe geschlossen und lässt sich nicht herauslocken.'],
    ['Erfahrung', 'Wer Feinde erschlägt, steigt im Rang: nach zwei, fünf und neun Gegnern. Jeder Rang bringt ein Zehntel mehr Schaden und Leben, und die Truppe wankt später. Erfahrene Trupps zu schonen und zurückzuziehen lohnt sich.'],
    ['Moral', 'Gilt in den Schlachten der Kampagne. Verluste, Tote in der Nähe, Treffer in Flanke und Rücken und Unterzahl lassen sie sinken. Bei null flieht die Truppe hinter die eigene Linie. In Sicherheit sammelt sie sich wieder, beim Helden schneller. Fällt der Held, wankt das ganze Heer.'],
    ['Sieg durch Flucht', 'Eine Seite, bei der niemand mehr standhält, hat verloren. Wer geflohen ist, überlebt und zählt weiter zum Heer. Ein Gegner muss also nicht vernichtet, nur gebrochen werden.'],
    ['Aufstellung', 'Vor jeder Schlacht der Kampagne bleiben vierzig Sekunden, um das Heer im markierten Feld zu ordnen: Speere nach vorn, Schützen in den Wald, Reiter an die Flanke. Der Knopf oben beginnt die Schlacht früher.']
  ]],
  kampagne: ['Kampagne', [
    ['Weltkarte', 'Linksklick wählt Provinz oder Heer. Mit gewähltem Heer schickt ein Klick oder Rechtsklick es los. Ziehen, Pfeiltasten und Mausrad bewegen die Karte, Pos1 zeigt alles, Enter beendet die Runde.'],
    ['Runden', 'Eine Runde ist eine Jahreszeit. Im Hartfrost ruht die Ernte fast ganz, und Heere kommen nur halb so weit.'],
    ['Provinzen', 'Jede Provinz bringt Erz, Holz und Vorräte nach ihrem Gelände. Gebäude und der Ausbau der Siedlung steigern den Ertrag. Die Bauplätze sind knapp.'],
    ['Unruhe', 'Eroberte Provinzen sind einige Runden unruhig und bringen wenig. Ein Heer von mindestens drei Trupps hält sie ruhig, sonst droht ein Aufstand.'],
    ['Verwaltung', 'Ab der siebten Provinz kostet jede weitere einen Teil des Ertrags im ganzen Reich. Forschung mildert das.'],
    ['Schlachten', 'Wer feindliches Land betritt, greift an. Du kannst jede Schlacht selbst schlagen oder berechnen lassen. Hauptstädte und Mauern müssen erst eine Runde belagert werden.'],
    ['Diplomatie', 'Frieden sperrt das Land des anderen. Die Reiche fürchten den Größten, schätzen Geschenke und vergessen keinen Wortbruch.'],
    ['Held', 'Jeder Aufstieg bringt einen Zug im Werdegang. Nach Siegen findet der Held zuweilen Waffen, Rüstungen und Talismane.'],
    ['Das Erwachen', 'Fünf Kapitel führen durch die Kampagne. Was unter den Bergen schläft, bleibt nicht ewig still.']
  ]]
};
function helpScreen(back, tab = 'steuerung') {
  const [, rows] = HANDBOOK[tab];
  show('<h2>Handbuch</h2><div class="row tabs">' + Object.entries(HANDBOOK).map(([k, [n]]) => '<button class="btn pick sm' + (k === tab ? ' sel' : '') + '" data-act="tab" data-v="' + k + '" type="button"><b>' + n + '</b></button>').join('') + '</div>'
    + '<dl class="hb">' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>'
    + backRow(), (act, el) => { if (act === 'back') back(); else if (act === 'tab') helpScreen(back, el.dataset.v); }, back, '[data-act=tab].sel');
  const c = $('card'); if (c && c.classList) c.classList.add('wide');
}

function creditsScreen() {
  show('<h2>Mitwirkende</h2>'
    + '<p>Entwicklung: Philipp Lesicki, gebaut mit Claude Code.</p>'
    + '<p class="sub">Alle Modelle, Texturen, Effekte und die Musik entstehen zur Laufzeit im Code. Namen, Orte und Figuren der Welt Orsa sind eigene Erfindungen.</p>'
    + '<h3>Verwendete Software</h3><ul class="help">'
    + '<li>Three.js (MIT-Lizenz) für die 3D-Darstellung</li><li>Vite (MIT-Lizenz) zum Bauen</li><li>Electron (MIT-Lizenz) für die Desktop-Fassung</li>'
    + '<li>Schriften Cinzel, Alegreya und Alegreya Sans (SIL Open Font License)</li></ul>'
    + backRow(), act => { if (act === 'back') mainMenu(); }, mainMenu);
}

/* ---------- Pause, Bestätigung, Ende ---------- */
export function openMenu() {
  if (!G || G.over || G.demo) return;
  G.paused = true; setMenuLook(false);
  if (G.battle) return battleMenu();
  show('<h2>Pause</h2><nav class="mlist compact">'
    + mbtn('resume', 'Weiterspielen') + mbtn('save', 'Speichern') + (hasSave() ? mbtn('load', 'Letzten Spielstand laden') : '')
    + mbtn('settings', 'Einstellungen') + mbtn('help', 'Handbuch') + mbtn('menu', 'Hauptmenü') + (platform.canQuit ? mbtn('quit', 'Beenden') : '') + '</nav>',
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
    + mbtn('settings', 'Einstellungen') + mbtn('help', 'Handbuch') + '</nav>',
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
