// KI der Kampagne: ein Zug je Reich und Runde. Einfach und gierig, aber mit Blick auf Vorräte, Front und Hauptstadt.
import { C, MAP, prov, pinfo, cR, empireIncome, buildBlock, startBuild, settleBlock, startSettle, slotsUsed, recruitBlock, recruit,
  RESEARCH_IDS, researchBlock, startResearch, researchCost, armiesAt, orderMove, armyPower, defense, unitCount, mergeAt, CDIFF, season, foodCapE, cTrade } from './cstate.js';
import { findRoute } from './cmap.js';
import { BIOMES, CBLD, SETTLE } from './cdata.js';
import { CSEASONS } from './cdata.js';

const RESERVE = 140; // Erz, das für Rekruten bleibt

export function aiTurn(f) {
  const e = C.emp[f], own = C.provs.filter(p => p.owner === f);
  if (!own.length && !C.armies.some(a => a.owner === f)) return;
  const hostileProv = p => p.owner !== f && (p.owner || p.garrison && Object.values(p.garrison).some(n => n > 0));
  const frontier = own.filter(p => MAP.provs[p.id].nb.some(n => hostileProv(prov(n))));

  /* Bauen: eine Sache je Provinz, nach Bedarf und Gelände */
  const thaw = empireIncome(f, CSEASONS[0]);
  for (const p of own) {
    if (p.queue) continue;
    const b = BIOMES[pinfo(p.id).biome], cand = [];
    const want = (id, score) => { if (!buildBlock(p, id, f) && e.ore - CBLD[id].cost[p.blds[id] || 0][0] > RESERVE * .5) cand.push([score, id]); };
    want('farm', (thaw.foodNet < 8 ? 6 : 1) + b.food / 6);
    want('mine', b.ore / 5); want('lumber', b.wood / 6 + (e.wood < 200 ? 2 : 0));
    if (p.id === e.capital || frontier.includes(p) || e.ore > 1000) want('barracks', (p.blds.barracks || 0) < 2 ? 3.5 : e.ore > 1000 ? 2.5 : 1.5);
    if (frontier.includes(p)) want('walls', p.id === e.capital ? 4 : 2);
    if (p.lvl >= 2 && !C.provs.some(q => q.owner === f && q.blds.market)) want('market', 2.2); else if (p.lvl >= 3) want('market', 1.2);
    cand.sort((a, b) => b[0] - a[0]);
    if (cand.length && cand[0][0] > 1.5) startBuild(p, cand[0][1], f);
    else if (!p.queue && slotsUsed(p) >= SETTLE[Math.max(1, p.lvl)].slots - 1 && !settleBlock(p, f) && e.ore > 400) startSettle(p, f);
    else if (!p.queue && p.lvl < 2 && !settleBlock(p, f) && e.ore > 300) startSettle(p, f);
  }

  /* Handel: Überschuss in den knappsten Rohstoff tauschen */
  for (let k = 0; k < 4; k++) {
    const r = ['ore', 'wood', 'food'].sort((x, y) => e[x] - e[y]), low = r[0], high = r[2];
    const k = f === 'salz' ? 1.3 : 2, base = f === 'salz' ? 120 : 250; // Händler tauschen früher
    if (e[high] > k * e[low] + base && cTrade(f, high, low, Math.max(100, Math.floor((e[high] - k * e[low]) / 4)))) continue; break;
  }

  /* Forschung */
  if (!e.research) for (const id of RESEARCH_IDS) if (!researchBlock(f, id) && e.ore > researchCost(f, id).ore + 80) { startResearch(f, id); break; }

  /* Rekrutieren: solange Erz da ist und die Vorräte den Winter tragen */
  const inc = empireIncome(f), frostNet = empireIncome(f, CSEASONS[2]).foodNet;
  const foodOk = e.food + frostNet * 2 > 0 || inc.foodNet > 5;
  const mix = [['melee', .42], ['ranged', .3], ['cav', .14], ['support', .06], ['elite', .08]];
  for (const p of own.filter(q => q.blds.barracks).sort((a, b) => (frontier.includes(b) ? 1 : 0) - (frontier.includes(a) ? 1 : 0))) {
    for (let k = 0; k < p.blds.barracks * 6 && foodOk && e.ore > RESERVE; k++) {
      let r = cR(), role = 'melee';
      for (const [id, w] of mix) { if (r < w) { role = id; break; } r -= w; }
      if (recruitBlock(p, role, 1, f)) role = 'melee';
      if (!recruit(p, role, 1, f)) break;
    }
  }

  /* Heere: zusammenlegen, angreifen, wo es sich lohnt, sonst an die Front oder zur bedrohten Hauptstadt */
  for (const p of own) { const here = armiesAt(p.id).filter(a => a.owner === f); for (const a of here.slice(1)) { a.path = []; mergeAt(a); } }
  const aggro = CDIFF[C.diff].aiAggro, cap = e.capital >= 0 ? prov(e.capital) : null;
  const capThreat = cap ? MAP.provs[cap.id].nb.reduce((s, n) => s + armiesAt(n).filter(a => a.owner !== f).reduce((t, a) => t + armyPower(a.units, a.owner, a.hero), 0), 0) : 0;
  for (const a of C.armies.filter(x => x.owner === f)) {
    if (C.over || !C.armies.includes(a)) continue;
    const pow = armyPower(a.units, f, a.hero);
    if (unitCount(a.units) < 3 && !a.hero) continue;
    // Hauptstadt bedroht: zurück, wenn in der Nähe
    if (cap && capThreat > defense(cap.id, 'x').pow * .8 && a.at !== cap.id) {
      const r = findRoute(MAP, a.at, cap.id, n => prov(n).owner === f);
      if (r && r.length <= 2) { orderMove(a, cap.id); continue; }
    }
    if (cap && a.at === cap.id && capThreat > pow * .7) continue; // bleibt zur Verteidigung
    let best = null, bestScore = 0;
    for (const n of MAP.provs[a.at].nb) {
      const q = prov(n); if (!hostileProv(q) && !armiesAt(n).some(o => o.owner !== f)) continue;
      const d = defense(n, f).pow, ratio = pow / Math.max(1, d);
      const value = 1 + q.lvl * .3 + (q.owner && C.emp[q.owner].capital === n ? 1.5 : 0) + (q.owner ? .3 : 0);
      if (ratio >= aggro && ratio * value > bestScore) { bestScore = ratio * value; best = n; }
    }
    if (best !== null) { orderMove(a, best); continue; }
    // kein lohnendes Ziel: zur Front ziehen (nur über eigene Provinzen)
    if (!frontier.some(p => p.id === a.at) && frontier.length) {
      let tgt = null, bd = 1e9;
      for (const p of frontier) { const r = findRoute(MAP, a.at, p.id, n => prov(n).owner === f); if (r && r.length < bd) { bd = r.length; tgt = p.id; } }
      if (tgt !== null) orderMove(a, tgt);
    }
  }
}
