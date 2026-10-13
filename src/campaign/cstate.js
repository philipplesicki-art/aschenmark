// Kampagne: Zustand und Regeln der Weltkarte. Reine Simulation (kein DOM). Eine Runde ist eine Jahreszeit.
// C ist der Zustand der laufenden Kampagne (wird gespeichert); die Kartengeometrie entsteht aus C.seed neu (genMap).
import { rng } from '../state.js';
import { FACTIONS, FAC_IDS, WILD } from '../factions.js';
import { CTECH, CTECH_IDS, ERAS, ctechName } from './ctech.js';
import { rollEvents } from './cevents.js';
import { newStory, storyTurn, storyBattle } from './cstory.js';
import { genMap, findRoute } from './cmap.js';
import { BIOMES, CBLD, CBLD_IDS, SETTLE, SETTLE_NAMES, ROLE_INFO, ROLES, unitStrength, UPKEEP_FOOD, CSEASONS, CAPITAL_BASE, HERO_TRAITS, HERO_TRAIT_IDS, SITES, SITE_IDS } from './cdata.js';

export let C = null, MAP = null;
// Summe einer Forschungswirkung (fx in ctech.js) und Züge des Helden
export function cfx(f, k) { const e = C.emp[f]; if (!e || !e.ctech) return 0; let v = 0; for (const id in e.ctech) { const x = CTECH[id] && CTECH[id].fx; if (x && x[k]) v += x[k]; } return v; }
// Stätten im Besitz eines Reiches
export const hasSite = (f, s) => !!C && C.provs.some(p => p.site === s && p.owner === f);
export const hasTrait = (f, t) => !!(C.emp[f] && C.emp[f].traits && C.emp[f].traits.includes(t));
export function setCampaign(c) { C = c; MAP = c ? genMap(c.seed, c.nProv) : null; }
// Oberfläche hängt sich hier ein. ask: Schlachten mit dem Spieler warten auf seine Wahl (Schlacht schlagen oder berechnen)
export const cHooks = { log: () => {}, battle: () => {}, changed: () => {}, moved: () => {}, ask: false };

// Zufall der Kampagne: Zustand in C.rs (gespeichert), damit Spielstände gleich weiterlaufen.
export function cR() {
  C.rs = (C.rs + 0x6D2B79F5) >>> 0; let t = C.rs;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export const season = (turn = C.turn) => CSEASONS[(turn - 1) % 4];
export const year = (turn = C.turn) => Math.floor((turn - 1) / 4) + 1;
export const prov = id => C.provs[id];
export const pinfo = id => MAP.provs[id]; // feste Kartendaten: Name, Gelände, Lage, Nachbarn
export const isAI = fac => fac !== C.player;

const emptyUnits = () => Object.fromEntries(ROLES.map(r => [r, 0]));
export const unitCount = u => Object.values(u || {}).reduce((n, v) => n + (v || 0), 0); // alle Truppenarten, auch wilde (brute)
export const popOf = (u, fac) => ROLES.reduce((n, r) => n + (u[r] || 0) * ((FACTIONS[fac] && FACTIONS[fac].units[r] ? FACTIONS[fac].units[r].pop : 1) || 1), 0);

/* ---------- Neue Kampagne ---------- */
const REVOLT = .15; // Aufstandsgefahr je Runde in unruhigen Provinzen ohne Heer
export const CDIFF = {
  easy:   { label: 'Leicht', aiIncome: .8, aiAggro: 1.6, neutral: .8, hate: 15, warRatio: 1.5 },
  normal: { label: 'Normal', aiIncome: 1,  aiAggro: 1.3, neutral: 1, hate: 0, warRatio: 1.25 },
  hard:   { label: 'Schwer', aiIncome: 1.25, aiAggro: 1.1, neutral: 1.15, hate: -15, warRatio: 1.1 },
  brutal: { label: 'Unerbittlich', aiIncome: 1.5, aiAggro: 1, neutral: 1.3, hate: -30, warRatio: .95 }
};
export function newCampaign({ player = 'wacht', diff = 'normal', seed = (Math.random() * 1e9) | 0, nProv = 30 } = {}) {
  const map = genMap(seed, nProv);
  const c = {
    v: 1, seed, nProv, turn: 1, player, diff, nid: 1, rs: (seed ^ 0xA5A5A5A5) >>> 0, over: null, log: [],
    emp: {}, provs: [], armies: [], recruits: [], battles: 0, pending: [], dip: {}, offers: [], events: [], story: newStory()
  };
  C = c; MAP = map;
  for (const f of FAC_IDS) c.emp[f] = { ore: 300, wood: 300, food: 250, tech: {}, ctech: {}, traits: [], research: null, capital: map.capitals[f], alive: true, heroXp: 0, heroLvl: 1, heroDown: 0 };
  for (const p of map.provs) {
    const cap = FAC_IDS.find(f => map.capitals[f] === p.id);
    c.provs.push({ id: p.id, owner: cap || null, lvl: cap ? 2 : 0, blds: Object.fromEntries(CBLD_IDS.map(b => [b, 0])), queue: null,
      garrison: cap ? emptyUnits() : wildGarrison(p) });
    if (cap) Object.assign(c.provs[p.id].blds, { farm: 1, barracks: 1 });
  }
  // Stätten: sieben besondere Provinzen fern der Hauptstädte, stärker bewacht
  const capSet = new Set(Object.values(map.capitals)), near = new Set([...capSet].flatMap(id => [id, ...map.provs[id].nb]));
  const pool = map.provs.filter(p => !near.has(p.id)).map(p => p.id);
  for (const s of SITE_IDS) {
    if (!pool.length) break;
    const i = Math.floor(cR() * pool.length), id = pool.splice(i, 1)[0], p = c.provs[id];
    p.site = s; for (const r of Object.keys(p.garrison)) p.garrison[r] = Math.round(p.garrison[r] * 1.6); p.garrison.brute = (p.garrison.brute || 0) + 1;
    for (const n of map.provs[id].nb) { const k = pool.indexOf(n); if (k >= 0) pool.splice(k, 1); } // Stätten nicht nebeneinander
  }
  // Jede Fraktion beginnt mit ihrem Helden und einem kleinen Heer in der Hauptstadt
  for (const f of FAC_IDS) mkArmy(f, map.capitals[f], { melee: 6, ranged: 4 }, true);
  // Zu Beginn herrscht Frieden mit Waffenstillstand: erst die Wildnis, dann die Nachbarn
  for (const f of FAC_IDS) for (const g of FAC_IDS) if (f < g) c.dip[dkey(f, g)] = { st: 'peace', since: 1, truce: 8 };
  addLog('Jahr 1, Tauzeit. ' + FACTIONS[player].name + ' erhebt Anspruch auf Orsa.', 'good');
  return c;
}
// Wilde Besatzung neutraler Provinzen: Stärke wächst mit dem Abstand zur nächsten Hauptstadt
function wildGarrison(p) {
  const d = Math.min(...Object.values(MAP.capitals).map(c => Math.hypot(MAP.provs[c].x - p.x, MAP.provs[c].y - p.y)));
  const k = Math.max(1, Math.round((2 + d / 22) * CDIFF[C.diff].neutral + cR() * 2));
  return { ...emptyUnits(), melee: k + 1, ranged: Math.round(k * .6), brute: d > 90 ? 1 : 0 };
}
export function mkArmy(owner, at, units, hero = false) {
  const a = { id: C.nid++, owner, at, units: { ...emptyUnits(), ...units }, hero, path: [], moved: 0 };
  C.armies.push(a); return a;
}
export function addLog(text, kind = '') { C.log.push({ turn: C.turn, text, kind }); if (C.log.length > 200) C.log.shift(); cHooks.log(text, kind); }

/* ---------- Ertrag, Unterhalt ---------- */
export function provYield(p) {
  if (!p.owner || p.lvl < 1) return { ore: 0, wood: 0, food: 0 };
  const b = C.emp[p.owner].capital === p.id ? CAPITAL_BASE : BIOMES[pinfo(p.id).biome], base = 1 + .35 * (p.lvl - 1), y = {};
  for (const r of ['ore', 'wood', 'food']) {
    let v = b[r] * base;
    for (const id of CBLD_IDS) { const L = p.blds[id]; if (!L) continue; const d = CBLD[id]; v += L * (((d.yieldMul && d.yieldMul[r]) || 0) * b[r] * (1 + cfx(p.owner, id)) + ((d.yieldAdd && d.yieldAdd[r]) || 0) * (1 + cfx(p.owner, id))); }
    if (r === 'ore') v += (p.blds.market || 0) * cfx(p.owner, 'marketOre');
    v += (p.bonus && p.bonus[r]) || 0; // Ereignisse (neue Erzader)
    if (p.site === 'ironpit' && r === 'ore') v += 45; if (p.site === 'saltlake' && r === 'food') v += 40;
    y[r] = v * (1 + .1 * (p.blds.market || 0)) * (1 + cfx(p.owner, 'yieldAll'));
  }
  return y;
}
export function empireIncome(f, s = season()) {
  const inc = { ore: 0, wood: 0, food: 0 };
  let n = 0;
  for (const p of C.provs) if (p.owner === f) { n++; const y = provYield(p), u = p.unrest > 0 ? UNREST_YIELD : 1; inc.ore += y.ore * u; inc.wood += y.wood * u; inc.food += y.food * u; }
  inc.admin = adminMul(n, f); // große Reiche verlieren Ertrag an die Verwaltung
  for (const r of ['ore', 'wood', 'food']) inc[r] *= inc.admin;
  inc.food *= s.food;
  const k = isAI(f) ? CDIFF[C.diff].aiIncome : 1;
  for (const r in inc) inc[r] *= k;
  inc.upkeep = C.armies.filter(a => a.owner === f).reduce((n, a) => n + popOf(a.units, f) * (a.hero && hasTrait(f, 'zahlmeister') ? .5 : 1), 0) * UPKEEP_FOOD * s.upkeep * (1 - cfx(f, 'upkeep'));
  inc.foodNet = inc.food - inc.upkeep;
  return inc;
}

// Verwaltung: ab ADMIN_FREE Provinzen kostet jede weitere Ertrag (Civilization-artige Bremse gegen Schneeballreiche)
export const ADMIN_FREE = 6, ADMIN_STEP = .035, UNREST_YIELD = .25;
export const adminFree = f => ADMIN_FREE + (f ? cfx(f, 'adminFree') : 0);
export const adminMul = (n, f) => 1 / (1 + Math.max(0, n - adminFree(f)) * ADMIN_STEP * (f && cfx(f, 'adminHalf') ? .67 : 1));
// Unruhe nach einer Eroberung: Runden bis zur Ruhe; ohne eigenes Heer droht Aufstand
export const unrestTurns = p => 3 + p.lvl;

/* ---------- Bauen und Ausbau ---------- */
export const bldCost = (id, L, f) => { const k = id === 'walls' ? 1 - cfx(f, 'wallCost') : 1; return CBLD[id].cost[L].map(v => Math.round(v * k)); };
export const slotsUsed = p => CBLD_IDS.reduce((n, b) => n + (p.blds[b] ? 1 : 0), 0);
export function buildBlock(p, id, f = C.player) {
  if (p.owner !== f) return 'Nicht deine Provinz';
  if (p.queue) return 'Hier wird schon gebaut';
  const L = p.blds[id] || 0; if (L >= 3) return 'Höchste Stufe';
  if (!L && slotsUsed(p) >= SETTLE[Math.max(1, p.lvl)].slots) return 'Kein Bauplatz frei (Siedlung ausbauen)';
  if (L + 1 > p.lvl) return 'Siedlungsstufe ' + (L + 1) + ' nötig';
  const [o, w] = bldCost(id, L, f); const e = C.emp[f];
  return e.ore < o ? 'Nicht genug Erz' : e.wood < w ? 'Nicht genug Holz' : null;
}
export function startBuild(p, id, f = C.player) {
  if (buildBlock(p, id, f)) return false;
  const L = p.blds[id] || 0, [o, w] = bldCost(id, L, f), e = C.emp[f];
  e.ore -= o; e.wood -= w; p.queue = { kind: 'bld', id, t: CBLD[id].turns[L] };
  return true;
}
export function settleBlock(p, f = C.player) {
  if (p.owner !== f) return 'Nicht deine Provinz';
  if (p.queue) return 'Hier wird schon gebaut';
  if (p.lvl >= 5) return 'Höchste Stufe';
  const s = SETTLE[p.lvl + 1], e = C.emp[f];
  return e.ore < s.cost[0] ? 'Nicht genug Erz' : e.wood < s.cost[1] ? 'Nicht genug Holz' : null;
}
export function startSettle(p, f = C.player) {
  if (settleBlock(p, f)) return false;
  const s = SETTLE[p.lvl + 1], e = C.emp[f]; e.ore -= s.cost[0]; e.wood -= s.cost[1];
  p.queue = { kind: 'settle', t: s.turns }; return true;
}
export const settleName = p => SETTLE_NAMES[p.lvl] || '';

/* ---------- Rekrutierung ---------- */
// Kosten in der Kampagne folgen der Kampfstärke (berechnete Schlachten kennen kein Gegenspiel der Truppenarten),
// aufgeteilt auf Erz (Waffen), Holz (Gerät) und Vorräte (Proviant), damit jedes Gelände etwas wert ist.
// Kosten nach Stärke. Der Salzbund wirbt mit Salz und Vorräten an: weniger Erz, mehr Vorräte
export const recruitCost = (f, role) => { const s = unitStrength(f, role), d = FACTIONS[f].units[role], z = f === 'salz'; const k = C && C.emp[f] ? (1 - cfx(f, 'recruit')) * (hasSite(f, 'forge') ? .9 : 1) : 1; return { ore: Math.round(s * (z ? 2.7 : 3.2) * k), wood: Math.round((s * 2 + (d.wood || 0) * .5) * k), food: Math.round(s * (z ? 3.4 : 2.4) * k) }; };
export function recruitBlock(p, role, n = 1, f = C.player) {
  if (p.owner !== f) return 'Nicht deine Provinz';
  const bar = p.blds.barracks || 0; if (!bar) return 'Kaserne nötig';
  if (bar < ROLE_INFO[role].bar) return 'Kaserne Stufe ' + ROLE_INFO[role].bar + ' nötig';
  const queued = C.recruits.filter(r => r.prov === p.id).reduce((s, r) => s + r.n, 0);
  const cap = bar * (6 + cfx(f, 'drill'));
  if (queued + n > cap) return 'Kaserne ausgelastet (' + cap + ' je Runde)';
  const c = recruitCost(f, role), e = C.emp[f];
  return e.ore < c.ore * n ? 'Nicht genug Erz' : e.wood < c.wood * n ? 'Nicht genug Holz' : e.food < c.food * n ? 'Nicht genug Vorräte' : null;
}
export function recruit(p, role, n = 1, f = C.player) {
  if (recruitBlock(p, role, n, f)) return false;
  const c = recruitCost(f, role), e = C.emp[f]; e.ore -= c.ore * n; e.wood -= c.wood * n; e.food -= c.food * n;
  const r = C.recruits.find(x => x.prov === p.id && x.role === role && x.owner === f);
  if (r) r.n += n; else C.recruits.push({ prov: p.id, owner: f, role, n });
  return true;
}

/* ---------- Forschung (reichsweit; die Stufen gelten in jeder Schlacht) ---------- */
// Forschungsbaum (ctech.js). Kosten nach Zeitalter; Dauer aus Forschungspunkten und der Forschungsrate (Gelehrtenhäuser, Akademien).
export const RESEARCH_IDS = CTECH_IDS;
export const researchRate = f => 1 + Math.min(1.5, .25 * C.provs.reduce((n, p) => n + (p.owner === f ? p.blds.school || 0 : 0), 0)) + cfx(f, 'research') + (hasSite(f, 'observatory') ? .5 : 0);
export function researchCost(f, id) {
  const t = CTECH[id]; if (!t || C.emp[f].ctech[id]) return null;
  const E = ERAS[t.era]; return { ...E.cost, pts: E.pts, turns: Math.ceil(E.pts / researchRate(f)) };
}
export function researchBlock(f, id) {
  const e = C.emp[f], t = CTECH[id]; if (!t) return 'Unbekannt';
  if (e.ctech[id]) return 'Schon erforscht'; if (e.research) return 'Forschung läuft';
  const miss = t.req.filter(r => !e.ctech[r]); if (miss.length) return 'Erst: ' + miss.map(r => ctechName(f, r)).join(', ');
  const c = researchCost(f, id);
  return e.ore < c.ore ? 'Nicht genug Erz' : e.wood < c.wood ? 'Nicht genug Holz' : e.food < c.food ? 'Nicht genug Vorräte' : null;
}
export function startResearch(f, id) {
  if (researchBlock(f, id)) return false;
  const e = C.emp[f], c = researchCost(f, id); e.ore -= c.ore; e.wood -= c.wood; e.food -= c.food;
  e.research = { id, prog: 0, need: c.pts }; return true;
}
// Abgeschlossene Forschung: Gefechtsstufen übernehmen (gelten in Echtzeit-Schlachten und in der Stärke)
function finishResearch(f, id) {
  const e = C.emp[f]; e.ctech[id] = 1;
  for (const [k, lv] of Object.entries(CTECH[id].rts || {})) e.tech[k] = Math.max(e.tech[k] || 0, lv);
  if (f === C.player) addLog('Erforscht: ' + ctechName(f, id), 'good');
}

/* ---------- Handel: über Händler der Hauptstadt immer möglich, Märkte verbessern den Kurs ---------- */
export const marketLevels = f => C.provs.reduce((n, p) => n + (p.owner === f ? p.blds.market || 0 : 0), 0);
// Der Salzbund ist ein Handelsbund: bessere Kurse von Beginn an
export const cTradeRate = f => Math.min(f === 'salz' ? .95 : .9, .6 + .06 * marketLevels(f) + (f === 'salz' ? .1 : 0) + cfx(f, 'trade') + (hasSite(f, 'saltlake') ? .05 : 0));
export function cTrade(f, from, to, amt = 100) {
  const e = C.emp[f];
  if (from === to || e[from] < amt) return false;
  e[from] -= amt; e[to] += Math.floor(amt * cTradeRate(f)); return true;
}

/* ---------- Heere: Bewegung, Zusammenlegen, Teilen ---------- */
export const armiesAt = id => C.armies.filter(a => a.at === id && unitCount(a.units) + (a.hero ? 1 : 0) > 0);
export const movesOf = a => season().moves + (unitCount(a.units) > 0 && unitCount(a.units) === (a.units.cav || 0) ? 1 : 0) + (a.hero && hasTrait(a.owner, 'marschall') ? 1 : 0);
export const movesLeft = a => movesOf(a) - a.moved;
/* ---------- Diplomatie: Zustand je Reichspaar (Regeln und KI in cdip.js) ---------- */
export const TRUCE = 6; // Runden Waffenstillstand nach einem Frieden
export const dkey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export const dipOf = (a, b) => (C.dip && C.dip[dkey(a, b)]) || null;
// Feindlich ist, wer im Krieg ist; Unbekanntes (Wilde, Platzhalter) gilt als feindlich
export const hostile = (a, b) => { if (a === b) return false; const d = dipOf(a, b); return !d || d.st === 'war'; };
export const allied = (a, b) => a !== b && !!dipOf(a, b) && dipOf(a, b).st === 'ally';
export function setDip(a, b, st) {
  const d = (C.dip ||= {})[dkey(a, b)] ||= {}, old = d.st;
  d.st = st; d.since = C.turn; d.truce = old === 'war' && st !== 'war' ? TRUCE : 0;
  cHooks.changed(); return d;
}
// Durchzug: eigenes, herrenloses, verbündetes oder feindliches Land; das Land eines Friedenspartners ist gesperrt
export const passable = (f, id) => { const o = prov(id).owner; return !o || o === f || allied(o, f) || hostile(o, f); };
// Ziel setzen: Weg über eigene oder neutrale Provinzen; der Zug läuft sofort, soweit die Bewegungspunkte reichen.
export function orderMove(a, to) {
  const r = findRoute(MAP, a.at, to, n => passable(a.owner, n)); if (!r) return false;
  a.path = r; return advance(a) || true; // Schlachtbericht, falls unterwegs gekämpft wurde
}
export function advance(a) {
  while (a.path.length && movesLeft(a) > 0 && !C.over) {
    const next = a.path[0], p = prov(next);
    if (!passable(a.owner, next)) { a.path = []; return null; } // inzwischen Frieden: kein Durchzug
    const foes = armiesAt(next).filter(o => hostile(o.owner, a.owner));
    const guarded = (p.owner === null && unitCount(p.garrison) > 0) || (p.owner && hostile(p.owner, a.owner));
    if (foes.length || guarded) { // Angriff: kostet alle restlichen Bewegungspunkte
      // Belagerung: Hauptstädte und Provinzen mit wirksamen Mauern erst eine Runde einschließen, dann stürmen
      const fort = p.owner && hostile(p.owner, a.owner) && (C.emp[p.owner].capital === next || (p.blds.walls || 0) - breachOf(a) > 0);
      if (fort && a.siege !== next) {
        a.siege = next; a.moved = movesOf(a); a.path = [next];
        if (a.owner === C.player || p.owner === C.player) addLog(empireName(a.owner) + ' belagert ' + pinfo(next).name + '. Der Sturm folgt in der nächsten Runde.', a.owner === C.player ? '' : 'bad');
        return { siege: next };
      }
      a.moved = movesOf(a); a.path = []; a.siege = null;
      if (asksPlayer(a, next)) { const pb = { army: a.id, prov: next }; (C.pending ||= []).push(pb); return { pending: pb }; }
      const res = attack(a, next);
      if (res.won) { cHooks.moved(a, a.at, next); a.at = next; }
      return res;
    }
    cHooks.moved(a, a.at, next); // für die Darstellung: Marsch von Provinz zu Provinz
    a.at = next; a.path.shift(); a.siege = null; a.moved += cfx(a.owner, 'roads') && p.owner === a.owner ? .5 : 1; // Heerstraßen
    mergeAt(a);
  }
  return null;
}
export function mergeAt(a) {
  const same = C.armies.find(o => o !== a && o.owner === a.owner && o.at === a.at && !o.path.length && o.id < a.id);
  if (!same) return;
  for (const r of ROLES) same.units[r] += a.units[r];
  same.hero = same.hero || a.hero; same.moved = Math.max(same.moved, a.moved);
  C.armies = C.armies.filter(o => o !== a);
}
export function splitArmy(a, units) {
  for (const r of ROLES) if ((units[r] || 0) > a.units[r]) return null;
  for (const r of ROLES) a.units[r] -= units[r] || 0;
  const b = mkArmy(a.owner, a.at, units); b.moved = a.moved; return b;
}

/* ---------- Schlachten mit dem Spieler: warten auf seine Wahl ---------- */
const asksPlayer = (a, id) => cHooks.ask && (a.owner === C.player || prov(id).owner === C.player || armiesAt(id).some(o => o.owner === C.player));
// Noch gültig? Das Heer lebt, steht daneben und das Ziel ist weiter feindlich besetzt.
export function pendingArmy(pb) {
  const a = C.armies.find(x => x.id === pb.army), p = prov(pb.prov);
  if (!a || unitCount(a.units) + (a.hero ? 1 : 0) === 0 || a.at === pb.prov || !MAP.provs[a.at].nb.includes(pb.prov)) return null;
  const guarded = armiesAt(pb.prov).some(o => hostile(o.owner, a.owner)) || (p.owner === null && unitCount(p.garrison) > 0) || (p.owner && hostile(p.owner, a.owner));
  return guarded ? a : null;
}
export function nextPending() {
  while (C.pending && C.pending.length) { if (pendingArmy(C.pending[0])) return C.pending[0]; C.pending.shift(); }
  return null;
}
// Schlacht ausführen: berechnet (ohne out) oder mit dem Ausgang der gespielten Schlacht
export function resolvePending(pb, out) {
  C.pending = (C.pending || []).filter(x => x !== pb);
  const a = pendingArmy(pb); if (!a) return null;
  const r = attack(a, pb.prov, out);
  if (r.won && C.armies.includes(a)) { cHooks.moved(a, a.at, pb.prov); a.at = pb.prov; mergeAt(a); }
  cHooks.changed();
  return r;
}
// Aufstellung für die Echtzeit-Schlacht: wer kämpft, mit welchen Truppen, Türmen, Bürgerwehr, Jahreszeit
export function battleSpec(pb) {
  const a = pendingArmy(pb); if (!a) return null;
  const p = prov(pb.prov), def = defense(pb.prov, a.owner), units = {};
  for (const d of def.armies) for (const r of ROLES) units[r] = (units[r] || 0) + (d.units[r] || 0);
  if (p.owner === null) for (const r of Object.keys(p.garrison)) units[r] = (units[r] || 0) + p.garrison[r];
  const dFac = p.owner && hostile(p.owner, a.owner) ? p.owner : def.armies.length ? def.armies[0].owner : 'wild';
  const side = (fac, u, hero) => ({ fac, units: u, hero: hero && fac !== 'wild' ? C.emp[fac].heroLvl : 0, heroHp: fac !== 'wild' && hasTrait(fac, 'kaempe') ? 1.3 : 1, tech: fac !== 'wild' ? { ...C.emp[fac].tech } : {} });
  const att = side(a.owner, { ...a.units }, a.hero), dfd = side(dFac, units, def.armies.some(d => d.hero));
  const playerAttacks = a.owner === C.player;
  return { player: playerAttacks ? att : dfd, enemy: playerAttacks ? dfd : att, playerAttacks,
    towers: p.owner ? 2 * Math.max(0, (p.blds.walls || 0) - cfx(a.owner, 'breach') - (a.hero && hasTrait(a.owner, 'belagerer') ? 1 : 0)) : 0,
    walls: p.owner ? Math.max(0, (p.blds.walls || 0) - cfx(a.owner, 'breach')) + (C.emp[p.owner].capital === pb.prov ? 1 : 0) : 0, // Hauptstadt: immer eine Mauer
    militia: p.owner ? Math.min(8, 2 * p.lvl) : 0,
    season: season().id, biome: pinfo(pb.prov).biome, name: pinfo(pb.prov).name, seed: (C.seed * 31 + C.turn * 977 + pb.prov) >>> 0, diff: C.diff,
    atkPow: Math.round(armyPower(a.units, a.owner, a.hero)), defPow: Math.round(def.pow) };
}
// Ausgang der Echtzeit-Schlacht (Sicht des Spielers) in Angreifer/Verteidiger umrechnen
export function battleOutcome(spec, res) {
  return spec.playerAttacks
    ? { won: res.won, atk: res.p, def: res.e, atkHero: res.pHero, defHero: res.eHero, fought: true }
    : { won: !res.won, atk: res.e, def: res.p, atkHero: res.eHero, defHero: res.pHero, fought: true };
}
// Überlebende der Verteidiger auf ihre Heere verteilen (der Reihe nach auffüllen)
function setDefenders(armies, p, surv) {
  const left = { ...surv };
  const fill = u => { for (const r of Object.keys(u)) { const k = Math.min(u[r] || 0, left[r] || 0); left[r] = (left[r] || 0) - k; u[r] = k; } };
  for (const d of armies) fill(d.units);
  if (p.owner === null) fill(p.garrison);
}

/* ---------- Schlachten (berechnet) ---------- */
const wildStr = r => { const d = WILD[r]; return d ? Math.round(Math.sqrt(d.hp * d.dmg / d.cd) / 3.46 * 10) / 10 : 0; };
export function armyPower(units, fac, hero, f = fac) {
  let s = 0;
  for (const r of Object.keys(units)) s += (units[r] || 0) * (fac === 'wild' ? wildStr(r === 'brute' ? 'brute' : r) : unitStrength(fac, r));
  if (fac !== 'wild') { const t = C.emp[f].tech; s *= (1 + .1 * (t.weapons || 0)) / (1 - .08 * (t.armor || 0)); }
  if (hero) s *= (1 + .12 * (C.emp[f].heroLvl + 1)) * (hasTrait(f, 'feldherr') ? 1.1 : 1);
  if (C.emp[f] && C.emp[f].sealed) s *= 1.15; // Ruhm: Schlund versiegelt
  return s;
}
// Verteidiger einer Provinz: Heere darin plus Besatzung (neutral) bzw. Bürgerwehr (Siedlungsstufe), Mauern, Gelände.
// breach: Mauerstufen, die der Angreifer übergeht (Belagerungsgerät, Sturmböcke, Belagerer, eigene Belagerungstruppen)
export function defense(id, against, breach = 0) {
  const p = prov(id), armies = armiesAt(id).filter(o => hostile(o.owner, against));
  let pow = 0;
  for (const a of armies) pow += armyPower(a.units, a.owner, a.hero) * (a.hero && hasTrait(a.owner, 'waechter') ? 1.2 : 1);
  if (p.owner === null) pow += armyPower(p.garrison, 'wild');
  else if (hostile(p.owner, against)) pow += (6 + p.lvl * 15) * (C.emp[p.owner].capital === id ? 2 : 1) * (p.unrest > 0 ? .5 : 1) * (1 + .5 * cfx(p.owner, 'garrison')); // Bürgerwehr: Hauptstadt doppelt, in Unruhe halb
  const walls = Math.max(0, (p.blds.walls || 0) - breach), wb = .25 + (p.owner ? cfx(p.owner, 'wallBonus') : 0);
  const mul = BIOMES[pinfo(id).biome].def * (1 + wb * walls) * 1.1 * (p.owner && C.emp[p.owner].capital === id ? 1.25 : 1); // Hauptstadt: Burg
  return { pow: pow * mul, armies, mul, walls };
}
export const breachOf = a => cfx(a.owner, 'breach') + (a.hero && hasTrait(a.owner, 'belagerer') ? 1 : 0) + ((a.units.siege || 0) >= 2 ? 1 : 0);
// Verluste anteilig auf die Truppenarten verteilen
function takeLosses(units, frac) {
  for (const r of Object.keys(units)) { const lost = Math.min(units[r], Math.round(units[r] * frac + (cR() < (units[r] * frac) % 1 ? 1 : 0))); units[r] -= lost; }
}
export function attack(a, id, out) {
  const p = prov(id), atk = armyPower(a.units, a.owner, a.hero), def = defense(id, a.owner, breachOf(a));
  const won = out ? out.won : atk / Math.max(1, atk + def.pow) + (cR() - .5) * .12 > .5;
  const stronger = Math.max(atk, def.pow), weaker = Math.min(atk, def.pow);
  const winLoss = Math.max(.05, Math.min(.85, weaker / Math.max(1, stronger) * .55)), loseLoss = Math.min(1, .55 + (stronger / Math.max(1, weaker)) * .2);
  const report = { att: a.owner, def: p.owner || (def.armies[0] ? def.armies[0].owner : 'wild'), prov: id, atkPow: Math.round(atk), defPow: Math.round(def.pow), won, fought: !!(out && out.fought) };
  const before = unitCount(a.units), beforeD = def.armies.reduce((n, d) => n + unitCount(d.units), 0) + (p.owner === null ? unitCount(p.garrison) : 0);
  const nameD = p.owner ? FACTIONS[p.owner].name : 'Wilde'; // vor der Eroberung festhalten
  if (out) { // gespielte Schlacht: die Überlebenden zählen
    for (const r of Object.keys(a.units)) a.units[r] = Math.min(a.units[r], (out.atk && out.atk[r]) || 0);
    setDefenders(def.armies, p, out.def || {});
    if (a.hero && !out.atkHero && unitCount(a.units) > 0) { a.hero = false; heroFalls(a.owner); }
    for (const d of def.armies) if (d.hero && !out.defHero && unitCount(d.units) > 0) { d.hero = false; heroFalls(d.owner); }
    if (won && p.owner === null) p.garrison = emptyUnits();
  } else {
    takeLosses(a.units, won ? winLoss : loseLoss);
    for (const d of def.armies) takeLosses(d.units, won ? loseLoss : winLoss);
    if (p.owner === null) takeLosses(p.garrison, won ? 1 : winLoss);
  }
  report.atkLost = before - unitCount(a.units);
  report.defLost = beforeD - def.armies.reduce((n, d) => n + unitCount(d.units), 0) - (p.owner === null ? unitCount(p.garrison) : 0);
  C.battles++;
  heroXp(a.owner, 30 + (won ? 40 : 0)); for (const d of def.armies) heroXp(d.owner, 20 + (won ? 0 : 40));
  if (won) {
    for (const d of def.armies) { // Verlierer ziehen sich zurück oder lösen sich auf
      const back = MAP.provs[id].nb.find(n => prov(n).owner === d.owner);
      if (back !== undefined && unitCount(d.units) > 0) { d.at = back; d.path = []; } else { if (d.hero) heroFalls(d.owner); C.armies = C.armies.filter(o => o !== d); }
    }
    capture(id, a.owner, a);
  } else if (unitCount(a.units) === 0) { if (a.hero) heroFalls(a.owner); C.armies = C.armies.filter(o => o !== a); }
  else if (!won) for (const d of def.armies) if (unitCount(d.units) === 0 && !d.hero) C.armies = C.armies.filter(o => o !== d);
  const nameA = empireName(a.owner);
  report.awk = a.owner === 'wild' || def.armies.some(d => d.owner === 'wild'); report.awkDef = p.owner || (def.armies[0] && def.armies[0].owner);
  storyBattle(report, a);
  if (a.owner === 'wild') { if (!won) addLog('Die Erwachten scheitern an ' + pinfo(id).name + ' (' + report.atkPow + ' gegen ' + report.defPow + ')', report.def === C.player ? 'good' : ''); } else addLog((won ? nameA + ' erobert ' : nameA + ' scheitert an ') + pinfo(id).name + ' (' + report.atkPow + ' gegen ' + report.defPow + ', Verteidiger: ' + nameD + ')', a.owner === C.player ? (won ? 'good' : 'bad') : (report.def === C.player ? (won ? 'bad' : 'good') : ''));
  cHooks.battle(report);
  return report;
}
export const heroCap = f => 5 + cfx(f, 'heroCap');
function heroXp(f, xp) {
  const e = C.emp[f]; if (!e) return; e.heroXp += xp * (1 + cfx(f, 'heroXp'));
  while (e.heroLvl < heroCap(f) && e.heroXp >= e.heroLvl * 120) { e.heroLvl++; if (f === C.player) addLog(FACTIONS[f].units.hero.name + ' erreicht Stufe ' + e.heroLvl, 'good'); offerTrait(f); }
}
// Bei jedem Aufstieg drei Züge zur Wahl; die KI (und Kampagnen ohne Oberfläche) nehmen den ersten
function offerTrait(f) {
  const e = C.emp[f]; e.traits ||= [];
  const left = HERO_TRAIT_IDS.filter(t => !e.traits.includes(t)); if (!left.length) return;
  const offer = []; while (offer.length < Math.min(3, left.length)) { const t = left[Math.floor(cR() * left.length)]; if (!offer.includes(t)) offer.push(t); }
  if (f === C.player && cHooks.ask) (C.heroPick ||= []).push(offer); else e.traits.push(offer[0]);
}
export function pickTrait(t) {
  const o = (C.heroPick || []).shift(), e = C.emp[C.player];
  if (o && o.includes(t) && !e.traits.includes(t)) { e.traits.push(t); addLog(FACTIONS[C.player].units.hero.name + ' wird ' + HERO_TRAITS[t].name + ': ' + HERO_TRAITS[t].desc, 'good'); }
}
function heroFalls(f) { const e = C.emp[f]; e.heroDown = 3; if (f === C.player) addLog(FACTIONS[f].units.hero.name + ' ist verwundet und kehrt in drei Runden zurück', 'bad'); }
function capture(id, f, att) {
  const p = prov(id), old = p.owner;
  if (f === 'wild') { // Die Erwachten erobern nicht, sie verwüsten: die Provinz fällt an die Wildnis, das Heer bleibt als Besatzung
    const a = att && C.armies.includes(att) ? att : null;
    p.owner = null; p.queue = null; p.unrest = 0; p.lvl = Math.max(0, p.lvl - 1); p.garrison = emptyUnits();
    if (a) { for (const r of Object.keys(a.units)) p.garrison[r] = (p.garrison[r] || 0) + a.units[r]; C.armies = C.armies.filter(x => x !== a); }
    C.recruits = C.recruits.filter(r => r.prov !== id);
    addLog('Die Erwachten verwüsten ' + pinfo(id).name + '.', old === C.player ? 'bad' : '');
    if (old && C.emp[old].capital === id) { const rest = C.provs.filter(q => q.owner === old).sort((x, y) => y.lvl - x.lvl); C.emp[old].capital = rest.length ? rest[0].id : -1; }
    checkEnd(); return;
  }
  if (p.site && (f === C.player || old === C.player)) addLog((f === C.player ? 'Gewonnen: ' : 'Verloren: ') + SITES[p.site].name + ' in ' + pinfo(id).name + '. ' + SITES[p.site].desc, f === C.player ? 'good' : 'bad');
  p.owner = f; p.queue = null; p.garrison = emptyUnits(); p.lvl = Math.max(1, p.lvl); p.unrest = unrestTurns(p);
  if (p.blds.walls) p.blds.walls--;
  C.recruits = C.recruits.filter(r => r.prov !== id);
  if (old && C.emp[old].capital === id) {
    addLog('Die Hauptstadt ' + pinfo(id).name + ' ist gefallen!', old === C.player ? 'bad' : 'good');
    const rest = C.provs.filter(q => q.owner === old).sort((a, b) => b.lvl - a.lvl);
    C.emp[old].capital = rest.length ? rest[0].id : -1;
  }
  checkEnd();
}

/* ---------- Runde beenden ---------- */
export function endTurn(aiTurn) {
  if (C.over) return;
  for (const f of FAC_IDS) if (isAI(f) && C.emp[f].alive && aiTurn) aiTurn(f);
  // Wirtschaft aller Reiche
  for (const f of FAC_IDS) {
    const e = C.emp[f]; if (!e.alive) continue;
    const inc = empireIncome(f);
    e.ore += inc.ore; e.wood += inc.wood; e.food += inc.foodNet;
    if (e.food < 0) { // Hunger: Heere schrumpfen
      e.food = 0;
      for (const a of C.armies) if (a.owner === f) takeLosses(a.units, .08);
      if (f === C.player) addLog('Hunger in den Heerlagern! Truppen desertieren. Mehr Gehöfte oder weniger Truppen.', 'bad');
    }
    e.food = Math.min(e.food, foodCapE(f));
    if (e.research && (e.research.prog += researchRate(f)) >= e.research.need) { finishResearch(f, e.research.id); e.research = null; }
    if (e.heroDown > 0 && --e.heroDown === 0 && e.capital >= 0) {
      const at = armiesAt(e.capital).find(a => a.owner === f); if (at) at.hero = true; else mkArmy(f, e.capital, {}, true);
      if (f === C.player) addLog(FACTIONS[f].units.hero.name + ' ist zurück in ' + pinfo(e.capital).name, 'good');
    }
  }
  // Unruhe: ein eigenes Heer in der Provinz beruhigt doppelt so schnell; ohne Heer droht ein Aufstand
  for (const p of C.provs) if (p.owner && p.unrest > 0) {
    const held = armiesAt(p.id).some(a => a.owner === p.owner && unitCount(a.units) >= 3);
    const vogt = armiesAt(p.id).some(a => a.owner === p.owner && a.hero && hasTrait(p.owner, 'landvogt'));
    p.unrest = Math.max(0, p.unrest - (held ? 2 : 1) - cfx(p.owner, 'garrison') - (vogt ? 3 : 0) - (hasSite(p.owner, 'shrine') ? 1 : 0));
    if (!held && p.unrest > 0 && cR() < REVOLT * (cfx(p.owner, 'garrison') ? .5 : 1)) {
      const old = p.owner; p.owner = null; p.unrest = 0; p.queue = null; p.garrison = wildGarrison(MAP.provs[p.id]);
      C.recruits = C.recruits.filter(r => r.prov !== p.id);
      addLog('Aufstand in ' + pinfo(p.id).name + '! Die Provinz sagt sich von ' + FACTIONS[old].name + ' los.', old === C.player ? 'bad' : '');
      if (C.emp[old].capital === p.id) { const rest = C.provs.filter(q => q.owner === old).sort((a, b) => b.lvl - a.lvl); C.emp[old].capital = rest.length ? rest[0].id : -1; }
    }
  }
  // Bauaufträge
  for (const p of C.provs) if (p.queue && --p.queue.t <= 0) {
    if (p.queue.kind === 'bld') { p.blds[p.queue.id]++; if (p.owner === C.player) addLog(CBLD[p.queue.id].name + ' Stufe ' + p.blds[p.queue.id] + ' in ' + pinfo(p.id).name + ' fertig', 'good'); }
    else { p.lvl++; if (p.owner === C.player) addLog(pinfo(p.id).name + ' ist jetzt ' + settleName(p), 'good'); }
    p.queue = null;
  }
  // Rekruten stoßen zum Heer in ihrer Provinz
  for (const r of C.recruits) {
    if (prov(r.prov).owner !== r.owner) continue;
    let a = armiesAt(r.prov).find(x => x.owner === r.owner && !x.path.length);
    if (!a) a = mkArmy(r.owner, r.prov, {});
    a.units[r.role] += r.n;
  }
  C.recruits = [];
  for (const d of Object.values(C.dip || {})) if (d.truce > 0) d.truce--;
  rollEvents();
  storyTurn();
  // Stätten: Hünengrab und Söldnerlager wirken je Runde
  for (const p of C.provs) if (p.owner && p.site === 'barrow') heroXp(p.owner, 15);
  for (const p of C.provs) if (p.owner && p.site === 'camp' && C.turn % 2 === 0) { const a = armiesAt(p.id).find(x => x.owner === p.owner); if (a) a.units.melee += 2; else mkArmy(p.owner, p.id, { melee: 2 }); }
  // Neue Runde: Bewegungspunkte zurück, Heere setzen ihren Weg fort
  C.turn++;
  for (const a of C.armies) a.moved = 0;
  C.armies = C.armies.filter(a => unitCount(a.units) > 0 || a.hero);
  const s = season();
  addLog('Jahr ' + year() + ', ' + s.name + (s.id === 'frost' ? ': kaum Ernte, Heere frieren und kommen langsam voran.' : '.'), s.id === 'frost' ? 'bad' : '');
  for (const a of C.armies.filter(x => x.owner === C.player && x.path.length)) advance(a);
  checkEnd(); cHooks.changed();
}
export const foodCapE = f => 1000 + C.provs.filter(p => p.owner === f).reduce((n, p) => n + 200 * (p.blds.farm || 0) + 120 * p.lvl, 0) + cfx(f, 'foodCap');

/* ---------- Sieg und Niederlage ---------- */
export function checkEnd() {
  for (const f of FAC_IDS) {
    const e = C.emp[f]; if (!e.alive) continue;
    if (!C.provs.some(p => p.owner === f) && !C.armies.some(a => a.owner === f && unitCount(a.units) > 0)) {
      e.alive = false; C.armies = C.armies.filter(a => a.owner !== f);
      addLog(FACTIONS[f].name + ' ist aus Orsa verschwunden.', f === C.player ? 'bad' : 'good');
    }
  }
  if (!C.emp[C.player].alive) { C.over = { win: false }; addLog('Dein Reich ist untergegangen.', 'bad'); return; }
  const own = C.provs.filter(p => p.owner === C.player).length;
  const capsHeld = FAC_IDS.filter(f => f !== C.player).every(f => !C.emp[f].alive || C.provs[MAP.capitals[f]].owner === C.player);
  if (capsHeld || own >= Math.ceil(C.provs.length * .75)) { C.over = { win: true }; addLog('Orsa gehört dir. Der Sieg ist errungen.', 'good'); }
}
export const empireName = f => (f && FACTIONS[f] ? FACTIONS[f].name : f === 'wild' ? 'Die Erwachten' : 'Wilde');
