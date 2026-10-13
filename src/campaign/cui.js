// Oberfläche der Kampagne: Weltkarte (Canvas), Kopfleiste, Seitenfeld für Provinz oder Heer, Forschung, Chronik.
// Die Regeln stehen in cstate.js; hier wird nur gezeichnet und weitergereicht.
import { C, MAP, cHooks, prov, pinfo, season, year, empireIncome, provYield, buildBlock, startBuild, settleBlock, startSettle, settleName,
  recruitBlock, recruit, recruitCost, RESEARCH_IDS, researchBlock, researchCost, startResearch, researchRate, pickTrait, hasTrait, heroCap, armiesAt, movesLeft, orderMove,
  unitCount, armyPower, defense, endTurn, foodCapE, cTrade, cTradeRate, empireName, slotsUsed, splitArmy,
  nextPending, pendingArmy, resolvePending, battleSpec, battleOutcome, ADMIN_FREE, dipOf } from './cstate.js';
import { aiTurn } from './cai.js';
import { saveCampaign } from './csave.js';
import { findRoute, MW, MH } from './cmap.js';
import { BIOMES, CBLD, CBLD_IDS, SETTLE, ROLE_INFO, ROLES, facColor, HERO_TRAITS, SITES } from './cdata.js';
import { FACTIONS, WILD, FAC_IDS } from '../factions.js';
import { CTECH, ERAS, ctechName } from './ctech.js';
import { might, opinion, opinionWord, warBlock, declareWar, makePeace, acceptsPeace, acceptsAlliance, makeAlliance, breakAlliance, gift } from './cdip.js';
import { CEVENTS, resolveEvent, eventText, optOk } from './cevents.js';
import { storyStart, currentChapter, CHAPTERS } from './cstory.js';
import { paintBase, paintOwners, settlement, paintFrame } from './cmapart.js';

const $ = id => document.getElementById(id);
let root = null, cv = null, ctx = null, base = null, owners = null, sel = null, hover = -1, onExit = () => {}, view = { s: 1, ox: 0, oy: 0 };
const SC = 6; // Bildpunkte je Rasterzelle im Kartenbild
// fight(spec, done): Echtzeit-Schlacht starten (main.js); done(res) bringt den Ausgang zurück
export const cfg = { fight: null };

/* ---------- Aufbau ---------- */
export function openCampaign(exit) {
  onExit = exit || (() => {});
  if (!root) build();
  root.hidden = false; sel = { kind: 'prov', id: C.emp[C.player].capital };
  cHooks.changed = () => { owners = null; render(); };
  cHooks.log = () => renderLog();
  cHooks.ask = true;
  base = null; owners = null;
  resize(); render();
  if (C.story && !C.story.started && C.turn === 1) { C.story.started = true; storyStart(); }
  afterBattle(); // offene Schlacht aus einem gespeicherten Stand
}
export const campaignOpen = () => !!(root && !root.hidden);
export function closeCampaign() { if (root) root.hidden = true; }

function build() {
  root = document.createElement('div'); root.id = 'camp'; root.hidden = true;
  root.innerHTML = '<div id="cTop"></div><div id="cMain"><canvas id="cMap"></canvas><div id="cQuest"></div><div id="cLog"></div></div><div id="cSide"></div><div id="cDlg" hidden><div class="card" id="cCard"></div></div>';
  document.body.appendChild(root);
  cv = $('cMap'); ctx = cv.getContext('2d');
  new ResizeObserver(() => { resize(); render(); }).observe($('cMain'));
  cv.addEventListener('pointermove', e => { const p = pick(e); if (p.prov !== hover) { hover = p.prov; render(); } });
  cv.addEventListener('pointerleave', () => { hover = -1; render(); });
  cv.addEventListener('pointerdown', e => {
    const p = pick(e);
    if (e.button === 2 || (sel && sel.kind === 'army' && p.prov >= 0 && !p.army && e.button === 0 && e.shiftKey)) { moveTo(p.prov); return; }
    if (p.army) { sel = { kind: 'army', id: p.army.id }; render(); return; }
    if (sel && sel.kind === 'army' && p.prov >= 0) { const a = C.armies.find(x => x.id === sel.id); if (a && a.owner === C.player && p.prov !== a.at) { moveTo(p.prov); return; } }
    sel = p.prov >= 0 ? { kind: 'prov', id: p.prov } : null; render();
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (!campaignOpen()) return;
    if (e.key === 'Enter' && $('cDlg').hidden) { e.preventDefault(); nextTurn(); }
    if (e.key === 'Escape') { if (!$('cDlg').hidden) closeDlg(); else menu(); }
  });
}
function resize() {
  if (!cv) return;
  const r = $('cMain').getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  const s = Math.min(cv.width / (MW * SC), cv.height / (MH * SC));
  view = { s, ox: (cv.width - MW * SC * s) / 2, oy: (cv.height - MH * SC * s) / 2, dpr };
}
// Bildschirm → Rasterzelle; Heere haben Vorrang vor der Provinz darunter
function pick(e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * view.dpr, y = (e.clientY - r.top) * view.dpr;
  for (const b of banners) if (Math.abs(x - b.x) < b.w / 2 && y > b.y - b.h && y < b.y + 4) return { army: b.a, prov: b.a.at };
  const cx = Math.floor((x - view.ox) / (SC * view.s)), cy = Math.floor((y - view.oy) / (SC * view.s));
  return { prov: cx >= 0 && cy >= 0 && cx < MW && cy < MH ? MAP.pid[cy * MW + cx] : -1 };
}

/* ---------- Kartenbild ---------- */
let baseCache = { seed: null, img: null };
function buildBase() {
  if (baseCache.seed !== C.seed + ':' + C.nProv) baseCache = { seed: C.seed + ':' + C.nProv, img: paintBase(MAP, C.seed) };
  return baseCache.img;
}
function buildOwners() {
  const colors = {}; for (const f of Object.keys(FACTIONS)) colors[f] = FACTIONS[f].color;
  return paintOwners(MAP, id => C.provs[id].owner, colors);
}
/* ---------- Zeichnen ---------- */
let banners = [];
export function render() {
  if (!campaignOpen() || !C) return;
  if (!base) { // erstes Malen der Karte dauert etwas: Hinweis zeigen, dann im nächsten Takt malen
    if (baseCache.seed !== C.seed + ':' + C.nProv) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1218'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#d2a05a'; ctx.font = '700 ' + Math.round(22 * view.dpr) + 'px Cinzel, serif'; ctx.textAlign = 'center'; ctx.fillText('Die Karte von Orsa wird gezeichnet', cv.width / 2, cv.height / 2); if (!render.wait) render.wait = setTimeout(() => { render.wait = null; base = buildBase(); render(); }, 30); return; }
    base = buildBase();
  }
  if (!owners) owners = buildOwners();
  const s = view.s, X = cx => view.ox + cx * SC * s, Y = cy => view.oy + cy * SC * s;
  ctx.setTransform(1, 0, 0, 1, 0, 0); { const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, 0, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .7); g.addColorStop(0, '#16303c'); g.addColorStop(1, '#070d12'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height); } // offenes Meer rings um die Karte
  ctx.drawImage(base, view.ox, view.oy, MW * SC * s, MH * SC * s); ctx.drawImage(owners, view.ox, view.oy, MW * SC * s, MH * SC * s);
  // Hervorhebung: Auswahl und Mauszeiger
  const hl = (id, col, w) => { if (id < 0) return; ctx.save(); ctx.globalAlpha = .9; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (MAP.pid[y * MW + x] !== id) continue;
      if (x + 1 >= MW || MAP.pid[y * MW + x + 1] !== id) { ctx.moveTo(X(x + 1), Y(y)); ctx.lineTo(X(x + 1), Y(y + 1)); }
      if (x === 0 || MAP.pid[y * MW + x - 1] !== id) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); }
      if (y + 1 >= MH || MAP.pid[(y + 1) * MW + x] !== id) { ctx.moveTo(X(x), Y(y + 1)); ctx.lineTo(X(x + 1), Y(y + 1)); }
      if (y === 0 || MAP.pid[(y - 1) * MW + x] !== id) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); } }
    ctx.stroke(); ctx.restore(); };
  hl(hover, 'rgba(255,255,255,.45)', 1.5 * view.dpr);
  const selProv = sel && sel.kind === 'prov' ? sel.id : sel && sel.kind === 'army' ? (C.armies.find(a => a.id === sel.id) || {}).at ?? -1 : -1;
  hl(selProv, '#e0933f', 2.5 * view.dpr);
  // Weg des gewählten Heeres
  const sa = sel && sel.kind === 'army' ? C.armies.find(a => a.id === sel.id) : null;
  if (sa) {
    const route = sa.path.length ? sa.path : (hover >= 0 && sa.owner === C.player && hover !== sa.at ? findRoute(MAP, sa.at, hover) || [] : []);
    if (route.length) {
      ctx.strokeStyle = sa.path.length ? 'rgba(224,147,63,.95)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 3 * view.dpr; ctx.setLineDash([8 * view.dpr, 6 * view.dpr]); ctx.beginPath();
      let p = pinfo(sa.at); ctx.moveTo(X(p.x), Y(p.y)); for (const id of route) { p = pinfo(id); ctx.lineTo(X(p.x), Y(p.y)); } ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // Siedlungen und Namen
  const fs = Math.max(10, 13 * s * 1.25) * view.dpr, sk = view.dpr * Math.max(.9, Math.min(1.4, s * 1.3));
  paintFrame(ctx, view.ox, view.oy, MW * SC * s, MH * SC * s, view.dpr * Math.max(.75, Math.min(1.3, s)));
  for (const pi of MAP.provs) {
    const p = C.provs[pi.id], x = X(pi.x), y = Y(pi.y), cap = Object.values(C.emp).some(e => e.capital === pi.id);
    if (p.lvl > 0) settlement(ctx, x, y + 22 * view.dpr, p.lvl, p.owner ? facColor(p.owner) : '#7d7a74', sk, cap, (p.blds.walls || 0) > 0); // Siedlung: Bauten nach Stufe
    else if (!p.owner && unitCount(p.garrison) > 0) { // wilde Besatzung: gekreuzte Klingen im dunklen Rund
      const r = 7 * view.dpr; ctx.fillStyle = 'rgba(15,14,12,.7)'; ctx.beginPath(); ctx.arc(x, y + 14 * view.dpr, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(190,200,150,.8)'; ctx.lineWidth = 1.4 * view.dpr; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * .55, y + 14 * view.dpr - r * .55); ctx.lineTo(x + r * .55, y + 14 * view.dpr + r * .55); ctx.moveTo(x + r * .55, y + 14 * view.dpr - r * .55); ctx.lineTo(x - r * .55, y + 14 * view.dpr + r * .55); ctx.stroke(); }
    if (p.rift) { const g = ctx.createRadialGradient(x, y + 10 * view.dpr, 2, x, y + 10 * view.dpr, 26 * view.dpr); g.addColorStop(0, 'rgba(255,120,60,.95)'); g.addColorStop(.45, 'rgba(160,60,190,.55)'); g.addColorStop(1, 'rgba(60,20,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 10 * view.dpr, 26 * view.dpr, 0, 7); ctx.fill(); }
    if (p.site) { const sy = y - fs * 1.15; ctx.font = (15 * view.dpr) + 'px serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(SITES[p.site].glyph, x + 1, sy + 1); ctx.fillStyle = '#ffd98a'; ctx.fillText(SITES[p.site].glyph, x, sy); }
    ctx.font = '700 ' + Math.round(fs * .82) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.2 * view.dpr; ctx.strokeStyle = 'rgba(12,10,8,.82)'; ctx.strokeText(pi.name, x, y - 3); ctx.fillStyle = p.owner ? '#f4ead6' : '#d6d2c2'; ctx.fillText(pi.name, x, y - 3);
  }
  // Heere als Banner
  banners = [];
  const byProv = {}; for (const a of C.armies) (byProv[a.at] ||= []).push(a);
  for (const [id, list] of Object.entries(byProv)) list.forEach((a, k) => {
    const pi = pinfo(+id), w = 26 * view.dpr, h = 30 * view.dpr, x = X(pi.x) + (k - (list.length - 1) / 2) * (w + 4 * view.dpr), y = Y(pi.y) + 58 * view.dpr; // unter Name und Siedlung
    const selA = sel && sel.kind === 'army' && sel.id === a.id;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x - w / 2 + 3, y - h + 3, w, h);
    ctx.fillStyle = facColor(a.owner); ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w / 2, y - 8 * view.dpr); ctx.lineTo(x, y); ctx.lineTo(x - w / 2, y - 8 * view.dpr); ctx.closePath(); ctx.fill();
    ctx.lineWidth = (selA ? 3 : 1.5) * view.dpr; ctx.strokeStyle = selA ? '#ffe9a8' : '#111'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + (12 * view.dpr) + 'px "Alegreya Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(unitCount(a.units), x, y - h / 2);
    if (a.hero) { ctx.fillStyle = '#ffd36a'; ctx.fillText('★', x, y - h + 11 * view.dpr); }
    if (a.owner === C.player && movesLeft(a) > 0) { ctx.fillStyle = '#9be07c'; ctx.beginPath(); ctx.arc(x + w / 2, y - h, 4 * view.dpr, 0, 7); ctx.fill(); }
    banners.push({ a, x, y, w, h });
  });
  renderTop(); renderSide(); renderQuest();
}

/* ---------- Kopfleiste, Chronik ---------- */
function renderTop() {
  const e = C.emp[C.player], inc = empireIncome(C.player), s = season(), sg = v => (v >= 0 ? '+' : '') + Math.round(v);
  $('cTop').innerHTML = '<div class="stat ore"><span>Erz</span><b>' + Math.floor(e.ore) + '</b><i class="pos">' + sg(inc.ore) + '</i></div>'
    + '<div class="stat wood"><span>Holz</span><b>' + Math.floor(e.wood) + '</b><i class="pos">' + sg(inc.wood) + '</i></div>'
    + '<div class="stat food"><span>Vorräte</span><b>' + Math.floor(e.food) + ' / ' + foodCapE(C.player) + '</b><i class="' + (inc.foodNet < 0 ? 'neg' : 'pos') + '">' + sg(inc.foodNet) + '</i></div>'
    + '<div class="stat season ' + s.id + '"><span>Jahr ' + year() + '</span><b>' + s.name + '</b></div>'
    + '<div class="stat"><span>Runde</span><b>' + C.turn + '</b></div>'
    + '<div class="stat"><span>Provinzen</span><b>' + C.provs.filter(p => p.owner === C.player).length + ' / ' + C.provs.length + '</b></div>'
    + (inc.admin < 1 ? '<div class="stat" title="Verwaltung: ab ' + ADMIN_FREE + ' Provinzen kostet jede weitere Ertrag im ganzen Reich"><span>Verwaltung</span><b class="neg">−' + Math.round(100 - inc.admin * 100) + ' %</b></div>' : '')
    + '<div class="sp"></div>'
    + '<button class="btn' + (e.research ? '' : ' idle') + '" data-c="research" type="button" title="' + (e.research ? ctechName(C.player, e.research.id) : 'Keine Forschung in Arbeit') + '">Forschung' + (e.research ? ' <span class="c">' + Math.max(1, Math.ceil((e.research.need - e.research.prog) / researchRate(C.player))) + ' R</span>' : ' <span class="c">!</span>') + '</button>'
    + '<button class="btn" data-c="dip" type="button">Diplomatie</button><button class="btn" data-c="trade" type="button">Handel</button><button class="btn" data-c="log" type="button">Chronik</button><button class="btn" data-c="menu" type="button">Menü</button>'
    + '<button class="btn go" data-c="end" type="button">Runde beenden <span class="k">Enter</span></button>';
  $('cTop').onclick = ev => { const b = ev.target.closest('[data-c]'); if (!b) return; ({ research: openResearch, dip: () => openDiplomacy(), trade: openTrade, log: openLog, menu, end: nextTurn })[b.dataset.c](); };
}
function renderLog() {
  const box = $('cLog'); if (!box || !C) return;
  box.innerHTML = C.log.slice(-5).map(l => '<div class="' + l.kind + '">' + l.text + '</div>').join('');
}

/* ---------- Seitenfeld ---------- */
const costTxt = c => [c.ore ? Math.round(c.ore) + ' Erz' : '', c.wood ? Math.round(c.wood) + ' Holz' : '', c.food ? Math.round(c.food) + ' Vorr.' : ''].filter(Boolean).join(' · ');
const btn = (act, label, block, title, cost) => '<button class="btn cbtn" type="button" data-a="' + act + '"' + (block ? ' disabled title="' + block + '"' : title ? ' title="' + title + '"' : '') + '><span>' + label + '</span>' + (cost ? '<small>' + cost + '</small>' : '') + '</button>';
function renderSide() {
  const box = $('cSide'); let h = '';
  if (sel && sel.kind === 'army') {
    const a = C.armies.find(x => x.id === sel.id);
    if (!a) { sel = null; return renderSide(); }
    const mine = a.owner === C.player;
    h += '<h3 style="color:' + facColor(a.owner) + '">' + (a.owner === 'wild' ? 'Heer der Erwachten' : a.hero ? FACTIONS[a.owner].units.hero.name + 's Heer' : 'Heer') + '</h3>';
    h += '<div class="sub">' + empireName(a.owner) + ' · in ' + pinfo(a.at).name + (mine ? ' · Züge ' + movesLeft(a) : '') + ' · Stärke ' + Math.round(armyPower(a.units, a.owner, a.hero)) + '</div>';
    if (a.hero) h += '<div class="sub">Held Stufe ' + C.emp[a.owner].heroLvl + ' von ' + heroCap(a.owner) + ': +' + Math.round(12 * (C.emp[a.owner].heroLvl + 1)) + ' Prozent Stärke' + ((C.emp[a.owner].traits || []).length ? '<br>' + C.emp[a.owner].traits.map(t => '<span title="' + HERO_TRAITS[t].desc + '">' + HERO_TRAITS[t].name + '</span>').join(', ') : '') + '</div>';
    h += '<ul class="units">' + Object.keys(a.units).filter(r => a.units[r]).map(r => '<li><span>' + uName(a.owner, r) + '</span><b>' + a.units[r] + '</b></li>').join('') + '</ul>';
    if (mine) {
      h += '<p class="sub">Linksklick auf eine Provinz: dorthin ziehen. Gegner und Wilde werden beim Betreten angegriffen.</p>';
      if (a.path.length) h += btn('halt', 'Marsch anhalten');
      if (unitCount(a.units) >= 2) h += btn('split', 'Heer teilen', null, 'Die Hälfte jeder Truppenart bildet ein neues Heer');
    }
    h += btn('toProv', 'Provinz ' + pinfo(a.at).name + ' zeigen');
  } else if (sel && sel.kind === 'prov') {
    const p = prov(sel.id), pi = pinfo(sel.id), mine = p.owner === C.player, y = provYield(p);
    h += '<h3 style="color:' + (p.owner ? facColor(p.owner) : '#cfd2c4') + '">' + pi.name + '</h3>';
    h += '<div class="sub">' + BIOMES[pi.biome].name + ' · ' + (p.owner ? empireName(p.owner) : 'herrenlos') + (p.lvl ? ' · ' + settleName(p) + ' (Stufe ' + p.lvl + ')' : '') + '</div>';
    if (p.site) h += '<div class="queue site"><b>' + SITES[p.site].glyph + ' ' + SITES[p.site].name + '</b><br>' + SITES[p.site].desc + (p.owner ? '' : ' Stärker bewacht als andere Provinzen.') + '</div>';
    if (p.owner) h += '<div class="yields"><span class="ore">' + Math.round(y.ore) + ' Erz</span><span class="wood">' + Math.round(y.wood) + ' Holz</span><span class="food">' + Math.round(y.food) + ' Vorr.</span></div>';
    if (p.owner && p.unrest > 0) h += '<div class="queue unrest">Unruhe, noch ' + p.unrest + ' Runde(n): Ertrag ein Viertel, Bürgerwehr halb.'
      + (armiesAt(p.id).some(a => a.owner === p.owner && unitCount(a.units) >= 3) ? ' Das Heer hier beruhigt doppelt so schnell.' : ' Ohne Heer (ab 3 Trupps) droht ein Aufstand!') + '</div>';
    if (!p.owner) h += '<div class="sub">Wilde Besatzung, Stärke ' + Math.round(defense(p.id, C.player).pow) + '</div>';
    else if (!mine) h += '<div class="sub">Verteidigung ' + Math.round(defense(p.id, C.player).pow) + (p.blds.walls ? ' · Mauern Stufe ' + p.blds.walls : '') + '</div>';
    const here = armiesAt(p.id); if (here.length) h += '<div class="sub">Heere: ' + here.map(a => empireName(a.owner) + ' (' + unitCount(a.units) + (a.hero ? ' ★' : '') + ')').join(', ') + '</div>';
    if (mine) {
      if (p.queue) h += '<div class="queue">Im Bau: ' + (p.queue.kind === 'bld' ? CBLD[p.queue.id].name + ' Stufe ' + ((p.blds[p.queue.id] || 0) + 1) : 'Ausbau zu ' + ['', 'Weiler', 'Dorf', 'Marktflecken', 'Stadt', 'Festung'][p.lvl + 1]) + ' · noch ' + p.queue.t + ' Runde(n)</div>';
      h += '<h4>Gebäude <small>(' + slotsUsed(p) + ' / ' + SETTLE[Math.max(1, p.lvl)].slots + ' Plätze)</small></h4>';
      for (const id of CBLD_IDS) { const L = p.blds[id] || 0, d = CBLD[id]; if (L >= 3) { h += '<div class="bld done">' + d.name + ' Stufe 3</div>'; continue; }
        h += btn('b:' + id, (L ? d.name + ' auf Stufe ' + (L + 1) : d.name + ' bauen') + (L ? '' : ''), buildBlock(p, id), d.desc, costTxt({ ore: d.cost[L][0], wood: d.cost[L][1] }) + ' · ' + d.turns[L] + ' R'); }
      if (p.lvl < 5) h += btn('settle', 'Siedlung ausbauen: ' + ['', 'Weiler', 'Dorf', 'Marktflecken', 'Stadt', 'Festung'][p.lvl + 1], settleBlock(p), 'Mehr Ertrag und ein Gebäudeplatz mehr', costTxt({ ore: SETTLE[p.lvl + 1].cost[0], wood: SETTLE[p.lvl + 1].cost[1] }) + ' · ' + SETTLE[p.lvl + 1].turns + ' R');
      if (p.blds.barracks) {
        h += '<h4>Rekrutieren <small>(erscheinen nächste Runde)</small></h4>';
        const queued = C.recruits.filter(r => r.prov === p.id); if (queued.length) h += '<div class="queue">' + queued.map(r => r.n + ' ' + FACTIONS[C.player].units[r.role].name).join(', ') + '</div>';
        for (const r of ROLES) h += btn('r:' + r, FACTIONS[C.player].units[r].name, recruitBlock(p, r), FACTIONS[C.player].units[r].desc || ROLE_INFO[r].name, costTxt(recruitCost(C.player, r)));
      }
    }
  } else h += '<p class="sub">Provinz oder Heer anklicken. Rechtsklick mit gewähltem Heer: dorthin ziehen. Enter beendet die Runde.</p>';
  box.innerHTML = h;
  box.onclick = ev => { const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return; act(b.dataset.a); };
}
function act(a) {
  if (a === 'halt') { const x = C.armies.find(q => q.id === sel.id); if (x) x.path = []; }
  else if (a === 'split') { const x = C.armies.find(q => q.id === sel.id), half = {}; for (const r of ROLES) half[r] = Math.floor(x.units[r] / 2); const n = splitArmy(x, half); if (n) sel = { kind: 'army', id: n.id }; }
  else if (a === 'toProv') { const x = C.armies.find(q => q.id === sel.id); if (x) sel = { kind: 'prov', id: x.at }; }
  else if (a === 'settle') startSettle(prov(sel.id));
  else if (a.startsWith('b:')) startBuild(prov(sel.id), a.slice(2));
  else if (a.startsWith('r:')) recruit(prov(sel.id), a.slice(2), 1);
  render();
}
function moveTo(id) {
  const a = sel && sel.kind === 'army' ? C.armies.find(x => x.id === sel.id) : null;
  if (!a || a.owner !== C.player || id < 0 || id === a.at) return;
  const res = orderMove(a, id);
  if (res && res.pending) choose(res.pending);
  else if (res && typeof res === 'object' && 'won' in res) showBattle(res);
  owners = null; render();
}

/* ---------- Dialoge: Forschung, Handel, Chronik, Schlacht, Menü, Ende ---------- */
function dlg(html, onClick) { $('cCard').innerHTML = html; $('cDlg').hidden = false; $('cCard').onclick = ev => { const b = ev.target.closest('[data-d]'); if (b && !b.disabled) onClick(b.dataset.d); }; }
function closeDlg() { $('cDlg').hidden = true; $('cCard').classList.remove('wide'); render(); }
// Forschungsbaum: vier Spalten (Zeitalter), jede Forschung als Karte: erforscht, in Arbeit, verfügbar oder gesperrt
function openResearch() {
  const e = C.emp[C.player], f = C.player, rate = researchRate(f);
  const card = id => {
    const t = CTECH[id], done = e.ctech[id], cur = e.research && e.research.id === id, block = researchBlock(f, id), locked = !done && t.req.some(r => !e.ctech[r]);
    const c = researchCost(f, id), cls = done ? 'done' : cur ? 'cur' : locked ? 'locked' : block ? 'wait' : 'open';
    return '<button class="tcard ' + cls + '" data-d="' + id + '" type="button"' + (done || cur || block ? ' disabled' : '') + ' title="' + (block && !done ? block : '') + '">'
      + '<b>' + ctechName(f, id) + '</b><span>' + t.desc + '</span>'
      + (t.req.length ? '<small>braucht ' + t.req.map(r => ctechName(f, r)).join(', ') + '</small>' : '')
      + (done ? '<i>erforscht</i>' : cur ? '<i>in Arbeit: ' + e.research.prog.toFixed(1) + ' / ' + e.research.need + '</i>' : c ? '<i>' + costTxt(c) + ' · ' + c.turns + ' R</i>' : '') + '</button>';
  };
  const cols = [1, 2, 3, 4].map(era => '<div class="tcol"><h4>' + ERAS[era].name + '</h4>' + RESEARCH_IDS.filter(id => CTECH[id].era === era).map(card).join('') + '</div>').join('');
  dlg('<h2>Forschung</h2><p class="sub">Eine Forschung zur Zeit. Forschungsrate ' + rate.toFixed(2) + ' Punkte je Runde (Gelehrtenhäuser und Akademien erhöhen sie). Waffen, Rüstung und Gerät gelten auch in Echtzeit-Schlachten.</p>'
    + '<div class="ttree">' + cols + '</div><div class="row end"><button class="btn" data-d="x" type="button">Schließen</button></div>',
    d => { if (d === 'x') return closeDlg(); startResearch(f, d); openResearch(); render(); });
  $('cCard').classList.add('wide');
}
function openTrade() {
  const e = C.emp[C.player], rate = cTradeRate(C.player), names = { ore: 'Erz', wood: 'Holz', food: 'Vorräte' };
  const pairs = [['ore', 'wood'], ['ore', 'food'], ['wood', 'ore'], ['wood', 'food'], ['food', 'ore'], ['food', 'wood']];
  dlg('<h2>Handel</h2><p class="sub">Händler der Hauptstadt tauschen zum Kurs ' + Math.round(rate * 100) + ' zu 100. Märkte verbessern ihn.</p><div class="row">'
    + pairs.map(([a, b]) => '<button class="btn" data-d="' + a + ':' + b + '" type="button"' + (e[a] < 100 ? ' disabled' : '') + '>100 ' + names[a] + ' → ' + Math.floor(100 * rate) + ' ' + names[b] + '</button>').join('') + '</div><div class="row end"><button class="btn" data-d="x" type="button">Schließen</button></div>',
    d => { if (d === 'x') return closeDlg(); const [a, b] = d.split(':'); cTrade(C.player, a, b, 100); openTrade(); render(); });
}
function openLog() {
  dlg('<h2>Chronik</h2><div class="clog">' + C.log.slice().reverse().map(l => '<div class="' + l.kind + '"><small>R' + l.turn + '</small> ' + l.text + '</div>').join('') + '</div><div class="row end"><button class="btn" data-d="x" type="button">Schließen</button></div>', () => closeDlg());
}
function showBattle(r) {
  const att = empireName(r.att), def = r.def === 'wild' ? 'Wilde' : empireName(r.def), mine = r.att === C.player || r.def !== C.player ? r.won : !r.won;
  dlg('<h2>' + (mine ? 'Sieg bei ' : 'Niederlage bei ') + pinfo(r.prov).name + '</h2><p>' + att + ' (Stärke ' + r.atkPow + ') greift ' + def + ' (Stärke ' + r.defPow + ') an.'
    + (r.fought ? ' Die Schlacht wurde geschlagen.' : ' Der Ausgang wurde berechnet.') + '</p>'
    + '<p class="sub">Verluste: Angreifer ' + (r.atkLost || 0) + ', Verteidiger ' + (r.defLost || 0) + '. '
    + (r.won ? 'Die Provinz gehört nun ' + att + '.' : 'Der Angriff ist abgewehrt.') + '</p><div class="row end"><button class="btn go" data-d="x" type="button">Weiter</button></div>', () => afterBattle());
}
// Nächste offene Schlacht anbieten, sonst zurück zur Karte (oder zum Ende)
function afterBattle() {
  if (C.over) return showOver();
  if (C.story && C.story.msgs && C.story.msgs.length) return showStory(C.story.msgs[0]);
  if (C.heroPick && C.heroPick.length) return chooseTrait();
  if (C.events && C.events.length) return showEvent(C.events[0]);
  if (C.offers && C.offers.length) return showOffer(C.offers[0]);
  const pb = nextPending();
  if (pb) choose(pb); else if (!$('cDlg').hidden) closeDlg();
}
const uName = (fac, r) => (FACTIONS[fac] && FACTIONS[fac].units[r] ? FACTIONS[fac].units[r].name : WILD[r] ? WILD[r].name : ROLE_INFO[r] ? ROLE_INFO[r].name : r);
const unitList = (fac, u) => Object.entries(u).filter(([, n]) => n > 0).map(([r, n]) => n + ' ' + (fac !== 'wild' && FACTIONS[fac].units[r] ? FACTIONS[fac].units[r].name : fac === 'wild' && WILD[r] ? WILD[r].name : ROLE_INFO[r] ? ROLE_INFO[r].name : r)).join(', ') || 'keine Truppen';
// Wahl vor der Schlacht: selbst führen oder berechnen lassen
function choose(pb) {
  const a = pendingArmy(pb), spec = battleSpec(pb); if (!a || !spec) return afterBattle();
  const pl = spec.player, en = spec.enemy, chance = Math.round(100 * spec.atkPow / Math.max(1, spec.atkPow + spec.defPow));
  const mineChance = spec.playerAttacks ? chance : 100 - chance;
  const hero = s => s.hero ? ' und ' + (s.fac !== 'wild' ? FACTIONS[s.fac].units.hero.name : 'Held') + ' (Stufe ' + s.hero + ')' : '';
  dlg('<h2>' + (spec.playerAttacks ? 'Angriff auf ' : 'Überfall auf ') + spec.name + '</h2>'
    + '<p>' + (spec.playerAttacks ? 'Dein Heer steht vor ' + spec.name + '.' : empireName(a.owner) + ' greift ' + spec.name + ' an!') + ' ' + BIOMES[spec.biome].name + ', ' + season().name + '.</p>'
    + '<ul class="help"><li><b>' + empireName(pl.fac) + ':</b> ' + unitList(pl.fac, pl.units) + hero(pl) + (!spec.playerAttacks && spec.militia ? ', ' + spec.militia + ' Bürgerwehr' : '') + (!spec.playerAttacks && spec.towers ? ', ' + spec.towers + ' Türme' : '') + (!spec.playerAttacks && spec.walls ? ', Stadtmauer' : '') + '</li>'
    + '<li><b>' + (en.fac === 'wild' ? 'Wilde' : empireName(en.fac)) + ':</b> ' + unitList(en.fac, en.units) + hero(en) + (spec.playerAttacks && spec.militia ? ', ' + spec.militia + ' Bürgerwehr' : '') + (spec.playerAttacks && spec.towers ? ', ' + spec.towers + ' Türme' : '') + (spec.playerAttacks && spec.walls ? ', Stadtmauer mit Tor' : '') + '</li></ul>'
    + '<p class="sub">Geschätzte Siegchance beim Berechnen: ' + mineChance + ' %. In der Schlacht zählt nur, wer am Ende noch steht.</p>'
    + '<div class="row end"><button class="btn" data-d="auto" type="button">Automatisch berechnen</button>'
    + (cfg.fight ? '<button class="btn go" data-d="fight" type="button">Schlacht schlagen</button>' : '') + '</div>',
  d => {
    if (d === 'auto') { const r = resolvePending(pb); saveCampaign(); owners = null; render(); if (r) showBattle(r); else afterBattle(); }
    else if (d === 'fight') fight(pb, spec);
  });
}
const waiting = () => !!((C.story && C.story.msgs && C.story.msgs.length) || nextPending() || (C.heroPick && C.heroPick.length) || (C.events && C.events.length) || (C.offers && C.offers.length));
// Erzählung: Kapitel, Vorzeichen, Schlund
function showStory(m) {
  dlg('<h2>' + m.title + '</h2><div class="prose">' + m.text.split('\n\n').map(t => '<p>' + t + '</p>').join('') + '</div><div class="row end"><button class="btn go" data-d="x" type="button">Weiter</button></div>',
    () => { C.story.msgs.shift(); render(); afterBattle(); });
}
// Kapitelanzeige oben links auf der Karte
function renderQuest() {
  const el = $('cQuest'); if (!el || !C.story) return;
  const ch = currentChapter(), S = C.story, n = CHAPTERS[C.player].length;
  let h = '';
  if (ch) h += '<div class="qt">Kapitel ' + (S.ch + 1) + ' von ' + n + ': ' + ch.title + '</div><div class="qg">' + (ch.when && !ch.when() ? 'Noch verborgen. Die Zeit wird es zeigen.' : ch.goal) + '</div><div class="qr">Belohnung: ' + ch.rewardText + '</div>';
  else h += '<div class="qt">Das Erwachen ist überstanden</div>';
  if (S.rift >= 0 && S.rift !== null) { const p = prov(S.rift); h += '<div class="qx">Der Schlund in ' + pinfo(S.rift).name + (p.owner ? ': gehalten von ' + empireName(p.owner) + ', ' + S.riftHeld + ' von 3 Runden' : ' ist offen.') + '</div>'; }
  el.innerHTML = h;
}
// Ereignis mit Entscheidung
function showEvent(ev) {
  const E = CEVENTS[ev.id];
  dlg('<h2>' + E.title + '</h2><p>' + eventText(ev) + '</p><div class="mlist compact">'
    + E.opts.map((o, i) => '<button class="mbtn" data-d="' + i + '" type="button"' + (optOk(ev, i) ? '' : ' disabled') + '><span>' + o.label + '</span><small>' + o.desc + '</small></button>').join('') + '</div>',
  d => { resolveEvent(ev, +d); owners = null; render(); afterBattle(); });
}
// Angebot eines anderen Reiches
function showOffer(o) {
  const peace = o.kind === 'peace', n = empireName(o.from);
  dlg('<h2>' + (peace ? n + ' bittet um Frieden' : n + ' bietet ein Bündnis an') + '</h2>'
    + '<p>' + (peace ? 'Der Krieg dauert an. Mit dem Frieden gilt ' + 6 + ' Runden Waffenstillstand, das Land der anderen Seite ist dann gesperrt.' : 'Ein Beistandsbündnis: Wer einen von euch angreift, hat beide zum Feind. Eure Heere dürfen durch das Land des anderen ziehen.') + '</p>'
    + '<div class="row end"><button class="btn" data-d="no" type="button">Ablehnen</button><button class="btn go" data-d="yes" type="button">Annehmen</button></div>',
  d => {
    C.offers = C.offers.filter(x => x !== o);
    const st = dipOf(C.player, o.from);
    if (d === 'yes' && C.emp[o.from].alive) { if (peace && st && st.st === 'war') makePeace(C.player, o.from); else if (!peace && st && st.st === 'peace') makeAlliance(C.player, o.from); }
    owners = null; render(); afterBattle();
  });
}
// Diplomatie: Lage und Handlungen gegenüber jedem Reich
function openDiplomacy(note = '') {
  const f = C.player, e = C.emp[f], my = might(f);
  const b = (d, label, dis, title) => '<button class="btn" data-d="' + d + '" type="button"' + (dis ? ' disabled' : '') + (title ? ' title="' + title + '"' : '') + '>' + label + '</button>';
  const rows = FAC_IDS.filter(g => g !== f && C.emp[g].alive).map(g => {
    const d = dipOf(f, g), op = opinion(g, f), r = might(g) / Math.max(1, my);
    const st = d.st === 'war' ? 'Krieg seit ' + (C.turn - d.since) + ' Runden' : d.st === 'ally' ? 'Bündnis' : 'Frieden' + (d.truce ? ', Waffenstillstand noch ' + d.truce + ' Runden' : '');
    let h = '';
    if (d.st === 'war') h += [0, 200, 500].map(t => b('peace:' + g + ':' + t, t ? 'Frieden gegen ' + t + ' Erz' : 'Frieden anbieten', e.ore < t)).join('');
    else {
      const wb = warBlock(f, g); h += b('war:' + g, 'Krieg erklären', !!wb, wb || (d.st === 'ally' ? 'Bündnisbruch verärgert alle Reiche' : ''));
      if (d.st === 'peace') h += b('ally:' + g, 'Bündnis anbieten', false, 'Nur gegen einen gemeinsamen Feind und bei guter Haltung');
      else h += b('unally:' + g, 'Bündnis kündigen');
    }
    h += b('gift:' + g, 'Geschenk: 150 Erz', e.ore < 150);
    return '<div class="dip"><div><b style="color:' + facColor(g) + '">' + empireName(g) + '</b><div class="sub">' + st + ' · Haltung zu dir: ' + opinionWord(op) + ' (' + op + ')' + (r > 9.99 ? ' · Stärke weit über der deinen' : ' · Stärke ' + Math.round(r * 100) + ' Prozent der deinen') + '</div></div><div class="row">' + h + '</div></div>';
  }).join('');
  dlg('<h2>Diplomatie</h2><p class="sub">Im Frieden ist das Land des anderen gesperrt, nach einem Friedensschluss gilt ein Waffenstillstand. Die Reiche fürchten die Führungsmacht und mögen, wer denselben Feind hat.</p>'
    + (note ? '<p class="note">' + note + '</p>' : '') + rows + '<div class="row end"><button class="btn" data-d="x" type="button">Schließen</button></div>',
  d => {
    if (d === 'x') return closeDlg();
    const [k, g, t] = d.split(':'); let msg = '';
    if (k === 'war') { declareWar(f, g); msg = 'Krieg mit ' + empireName(g) + '.'; }
    else if (k === 'peace') { if (acceptsPeace(g, f, +t)) { e.ore -= +t; C.emp[g].ore += +t; makePeace(f, g); msg = empireName(g) + ' nimmt den Frieden an.'; } else msg = empireName(g) + ' lehnt ab. Mehr Tribut, eine bessere Kriegslage oder Zeit könnten helfen.'; }
    else if (k === 'ally') { if (acceptsAlliance(g, f)) { makeAlliance(f, g); msg = 'Bündnis mit ' + empireName(g) + '.'; } else msg = empireName(g) + ' lehnt ab: dafür braucht es einen gemeinsamen Feind, gute Haltung und einige Runden Frieden.'; }
    else if (k === 'unally') { breakAlliance(f, g); msg = 'Bündnis gekündigt.'; }
    else if (k === 'gift') { gift(f, g, 150); msg = empireName(g) + ' nimmt das Geschenk an.'; }
    owners = null; render(); openDiplomacy(msg);
  });
}
// Der Held ist aufgestiegen: einen von drei Zügen wählen
function chooseTrait() {
  const offer = C.heroPick[0], e = C.emp[C.player], h = FACTIONS[C.player].units.hero.name;
  dlg('<h2>' + h + ' erreicht Stufe ' + e.heroLvl + '</h2><p class="sub">Wähle den nächsten Schritt im Werdegang. Bisher: ' + (e.traits.length ? e.traits.map(t => HERO_TRAITS[t].name).join(', ') : 'noch keiner') + '.</p><div class="mlist compact">'
    + offer.map(t => '<button class="mbtn" data-d="' + t + '" type="button"><span>' + HERO_TRAITS[t].name + '</span><small>' + HERO_TRAITS[t].desc + '</small></button>').join('') + '</div>',
  d => { pickTrait(d); render(); afterBattle(); });
}
function fight(pb, spec) {
  saveCampaign(); $('cDlg').hidden = true; closeCampaign();
  cfg.fight(spec, res => {
    root.hidden = false; cHooks.ask = true;
    const r = resolvePending(pb, battleOutcome(spec, res)); saveCampaign();
    owners = null; resize(); render();
    if (r) showBattle(r); else afterBattle();
  });
}
function menu() {
  dlg('<h2>Kampagne</h2><div class="mlist compact"><button class="mbtn" data-d="resume" type="button"><span>Weiterspielen</span></button><button class="mbtn" data-d="save" type="button"><span>Speichern</span></button><button class="mbtn" data-d="exit" type="button"><span>Speichern und zum Hauptmenü</span></button></div>',
    d => { if (d === 'resume') closeDlg(); else if (d === 'save') { saveCampaign(); closeDlg(); } else { saveCampaign(); $('cDlg').hidden = true; closeCampaign(); onExit(); } });
}
export function nextTurn() {
  if (C.over) return showOver();
  if (waiting()) return afterBattle(); // erst offene Schlachten und Entscheidungen
  const before = C.log.length;
  endTurn(aiTurn); saveCampaign();
  owners = null; render();
  // Angriffe auf das eigene Reich in dieser Runde zusammenfassen
  const hits = C.log.slice(before).filter(l => l.kind === 'bad' && !l.text.startsWith('Jahr '));
  if (C.over) showOver(); else if (waiting()) afterBattle(); else if (hits.length) dlg('<h2>' + season().name + ', Jahr ' + year() + '</h2>' + hits.map(l => '<p>' + l.text + '</p>').join('') + '<div class="row end"><button class="btn go" data-d="x" type="button">Weiter</button></div>', () => closeDlg());
}
function showOver() {
  const w = C.over.win;
  dlg('<h2>' + (w ? 'Orsa ist geeint' : 'Das Reich ist gefallen') + '</h2><p>' + (w ? FACTIONS[C.player].name + ' herrscht nach ' + year() + ' Jahren über Orsa.' : 'Nach ' + year() + ' Jahren ist nichts von ' + FACTIONS[C.player].name + ' geblieben.') + '</p>'
    + '<p class="sub">' + C.provs.filter(p => p.owner === C.player).length + ' Provinzen · ' + C.battles + ' Schlachten</p><div class="row end"><button class="btn go" data-d="x" type="button">Zum Hauptmenü</button></div>',
    () => { $('cDlg').hidden = true; closeCampaign(); onExit(); });
}
