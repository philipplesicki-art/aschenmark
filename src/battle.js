// Echtzeit-Schlacht aus der Kampagne: ein Gefecht ohne Basisbau. Beide Heere stehen sich im Kernland gegenüber,
// der Verteidiger hat Türme (für jede Mauerstufe zwei) und Bürgerwehr (Siedlungsstufe). Die Jahreszeit der Runde gilt auch hier.
// Ende, wenn eine Seite keine Kämpfer mehr hat oder der Spieler abzieht. Reine Simulation: kein DOM, kein Three.js.
import { G, hooks, simR, rng } from './state.js';
import { newWorld, mkUnit, mkBld, mkCreep, setBlock, free, nearestTree } from './world.js';
import { setOrder } from './path.js';
import { aiSkirmish, aiTick } from './ai.js';
import { TS, GW, GH, DIFF } from './config.js';
import { SEASONS } from './economy.js';
import { initMorale, moraleTick, DEPLOY_T } from './tactics.js';
import { FACTIONS, otherFac, defOf, XP_STEPS, MAX_HERO_LVL } from './factions.js';

const MAX_SIDE = 48; // höchstens so viele Figuren je Seite; größere Heere werden zusammengefasst
export const scaleOf = n => Math.max(1, Math.ceil(n / MAX_SIDE));
const count = u => Object.values(u || {}).reduce((n, v) => n + (v || 0), 0);
// Aufstellung: vorne Nahkampf, dahinter Fernkampf und Helfer, Reiter auf den Flanken, Belagerung ganz hinten
const RANK = { melee: 0, elite: 0, brute: 0, ranged: 1, support: 1, cav: 2, siege: 3 };
// Schlachtfeld: die freie Linie zwischen den beiden Burgplätzen der Karte (dort wächst kein Wald)
const A = [9.5, 39.5], B = [70.5, 16.5];
const at = k => [(A[0] + (B[0] - A[0]) * k) * TS, (A[1] + (B[1] - A[1]) * k) * TS];

/* spec: { player: { fac, units, hero (Stufe oder 0), tech }, enemy: { fac ('wild' möglich), units, hero, tech },
           playerAttacks, towers, militia (für den Verteidiger), season, seed, diff, name } */
export function newBattle(spec) {
  const wild = spec.enemy.fac === 'wild', pf = spec.player.fac, ef = wild ? otherFac(pf) : spec.enemy.fac;
  newWorld({ fac0: pf, fac1: ef, diff: spec.diff || 'normal', seed: spec.seed });
  // Burgen, Arbeiter und Lager der Gefechtskarte entfernen; Erzadern und Wald bleiben als Gelände
  const sites = G.ents.filter(e => e.type === 'hq').map(h => ({ x: h.x, y: h.y, r: h.r, fac: h.fac, team: h.team, type: 'hq' })); // für die Bodenbemalung
  for (const e of G.ents) if (e.kind !== 'dep') { if (e.kind === 'bld') setBlock(e, -1); e.dead = true; G.map.delete(e.id); }
  G.ents = G.ents.filter(e => !e.dead);
  const scale = scaleOf(Math.max(count(spec.player.units), count(spec.enemy.units)));
  const E = wild ? 3 : 1;
  // Jahreszeit der Runde: Uhr auf den Anfang der Jahreszeit stellen (Schnee, Nebel, Licht folgen daraus)
  let t0 = 0; for (const s of SEASONS) { if (s.id === spec.season) break; t0 += s.dur; }
  G.t = t0 + 5; G.season = SEASONS.find(s => s.id === spec.season)?.id || 'thaw';
  G.ev.next = 1e9; G.ai.next = 1e9; G.pp = [2, 2];
  G.tech = [{ ...(spec.player.tech || {}) }, { ...(wild ? {} : spec.enemy.tech || {}) }];
  G.battle = { sites, name: spec.name || '', playerAttacks: !!spec.playerAttacks, scale, E, t0: G.t, engaged: !spec.playerAttacks, over: null,
    start: { p: { ...spec.player.units }, e: { ...spec.enemy.units }, pHero: !!spec.player.hero, eHero: !!spec.enemy.hero } };
  const pc = at(.33), ec = at(.67), dir = [ec[0] - pc[0], ec[1] - pc[1]], dl = Math.hypot(dir[0], dir[1]), fwd = [dir[0] / dl, dir[1] / dl];
  G.battle.biome = spec.biome || 'grenz';
  battleTerrain(G.battle.biome, rng((spec.seed ^ 0x2f6b) >>> 0), pc, ec, fwd);
  const defIsPlayer = !spec.playerAttacks;
  if (spec.walls > 0 && !wild) cityWalls(defIsPlayer ? 0 : 1, defIsPlayer ? pc : ec, defIsPlayer ? fwd : [-fwd[0], -fwd[1]], spec.walls);
  deploy(0, spec.player, pc, fwd, scale, defIsPlayer ? spec.militia : 0, false);
  deploy(E, spec.enemy, ec, [-fwd[0], -fwd[1]], scale, defIsPlayer ? 0 : spec.militia, wild);
  if (spec.towers && !wild) towers(defIsPlayer ? 0 : 1, defIsPlayer ? pc : ec, defIsPlayer ? fwd : [-fwd[0], -fwd[1]], Math.min(6, spec.towers));
  Object.assign(G.battle, { home: [pc, ec], fwd, phase: 'deploy', depT: G.t + DEPLOY_T });
  initMorale();
  return G;
}
/* ---------- Schlacht mit Basisbau (Kampagne) ---------- */
// Wie ein freies Gefecht: Burgen, Baumeister, Wirtschaft, Ausbildung. Der Verteidiger steht in seiner Siedlung mit den Bauten der
// Provinz (samt Schäden), der Angreifer kommt mit Heer, Baumeistern und Feldlager. Wer seine Burg verliert, hat verloren;
// gegen Wilde zählt die Besatzung. Danach gehen Bauten, Schäden, Rohstoffe und neue Truppen an die Kampagne zurück.
// Gebäude der Kampagne ↔ Bauwerke im Gefecht (Mauern werden zu je zwei Türmen; das Gelehrtenhaus hat kein Gegenstück)
export const BLD_MAP = { farm: 'farm', lumber: 'lumber', mine: 'outpost', barracks: 'barracks', market: 'market' };
export const tierOfLvl = lvl => lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1;
const fits = (gx, gy, s) => { for (let j = -1; j < s + 1; j++) for (let i = -1; i < s + 1; i++) if (!free(gx + i, gy + j)) return false; return true; };
// Bauwerk nahe (cx, cy) setzen: im Goldenen Winkel nach außen suchen, bis Platz ist
function placeNear(tp, team, cx, cy, minR, a0) {
  const s = defOf(G.fac[team], tp).size; let a = a0 || .3;
  for (let k = 0; k < 90; k++, a += 2.39996) {
    const rad = minR + k * 5, gx = Math.round((cx + Math.cos(a) * rad) / TS - s / 2), gy = Math.round((cy + Math.sin(a) * rad) / TS - s / 2);
    if (fits(gx, gy, s)) return mkBld(tp, team, gx, gy, true);
  }
  return null;
}
const hurtTo = (e, f) => { if (e && f !== undefined && f < 1) e.hp = Math.max(e.maxhp * .15, e.maxhp * f); };
// Siedlung aus der Kampagne: Burgstufe nach Siedlungsstufe, die Bauten der Provinz rund um die Burg, Türme zur Feindseite
function settlement(team, st, foeHq) {
  const hq = G.ents.find(e => e.team === team && e.type === 'hq'); if (!hq) return;
  const tier = tierOfLvl(st.lvl || 1); hq.tier = tier; if (tier > 1) { hq.maxhp = Math.round(hq.maxhp * (tier === 2 ? 1.2 : 1.5)); hq.hp = hq.maxhp; }
  hurtTo(hq, st.bhp && st.bhp.hq);
  const hp = id => (st.bhp && st.bhp[id]) || [];
  for (const [id, tp] of Object.entries(BLD_MAP)) {
    const L = Math.min(3, st.blds[id] || 0);
    for (let i = 0; i < L; i++) {
      let b = null;
      if (tp === 'outpost') { // Bergwerk: an der nächsten Erzader, die nicht schon an der Burg liegt
        const deps = G.ents.filter(e => e.kind === 'dep' && Math.hypot(e.x - hq.x, e.y - hq.y) > 280).sort((x, y) => Math.hypot(x.x - hq.x, x.y - hq.y) - Math.hypot(y.x - hq.x, y.y - hq.y));
        if (deps[i]) b = placeNear(tp, team, deps[i].x, deps[i].y, 70, 1.1);
      } else if (tp === 'lumber') { const tr = nearestTree(hq.x, hq.y, 1200); if (tr) b = placeNear(tp, team, tr.x, tr.y, 60, 2 + i); }
      else b = placeNear(tp, team, hq.x, hq.y, 120 + i * 20, .3 + i * 1.7 + tp.length);
      hurtTo(b, hp(id)[i]);
    }
  }
  const walls = Math.min(3, st.blds.walls || 0) + (st.capital ? 1 : 0);
  if (walls && foeHq) {
    const dx = foeHq.x - hq.x, dy = foeHq.y - hq.y, dl = Math.hypot(dx, dy), fx = dx / dl, fy = dy / dl;
    for (let i = 0; i < walls * 2; i++) {
      const off = ((i % 2 ? 1 : -1) * (Math.floor(i / 2) * 2 + 1)) * 65;
      const b = placeNear('tower', team, hq.x + fx * 190 - fy * off, hq.y + fy * 190 + fx * off, 0, i);
      hurtTo(b, hp('walls')[i >> 1]);
    }
  }
}
// spec wie newBattle, dazu: settle { lvl, blds, bhp, capital } (Siedlung des Verteidigers, fehlt bei Wildnis) und res { ore, wood } je Seite
export function newBaseBattle(spec) {
  const wild = spec.enemy.fac === 'wild', pf = spec.player.fac, ef = wild ? otherFac(pf) : spec.enemy.fac;
  newWorld({ fac0: pf, fac1: ef, diff: DIFF[spec.diff] ? spec.diff : 'normal', seed: spec.seed });
  // Lager der Wilden und die Startwachen der Gefechtskarte fallen weg; Burgen, Baumeister, Erz und Wald bleiben
  for (const e of G.ents) if (e.kind === 'unit' && (e.team === 3 || e.type === 'melee')) { e.dead = true; G.map.delete(e.id); }
  G.ents = G.ents.filter(e => !e.dead);
  let t0 = 0; for (const s of SEASONS) { if (s.id === spec.season) break; t0 += s.dur; }
  G.t = t0 + 5; G.season = SEASONS.find(s => s.id === spec.season)?.id || 'thaw';
  G.ev.next = 1e9; G.pp = [1, 1];
  G.tech = [{ ...(spec.player.tech || {}) }, { ...(wild ? {} : spec.enemy.tech || {}) }];
  const E = wild ? 3 : 1, defT = spec.playerAttacks ? E : 0;
  const hq0 = G.ents.find(e => e.team === 0 && e.type === 'hq'), hq1 = G.ents.find(e => e.team === 1 && e.type === 'hq');
  const res = s => s.res || {};
  G.ore = [res(spec.player).ore ?? 300, wild ? 0 : res(spec.enemy).ore ?? 300]; G.wood = [res(spec.player).wood ?? 200, wild ? 0 : res(spec.enemy).wood ?? 200];
  const scale = scaleOf(Math.max(count(spec.player.units), count(spec.enemy.units)));
  G.battle = { base: true, name: spec.name || '', playerAttacks: !!spec.playerAttacks, scale, E, defT, t0: G.t, engaged: true, over: null, phase: 'fight', biome: spec.biome || 'grenz',
    res0: [G.ore[0], G.wood[0], G.ore[1], G.wood[1]],
    start: { p: { ...spec.player.units }, e: { ...spec.enemy.units }, pHero: !!spec.player.hero, eHero: !!spec.enemy.hero } };
  const site = { x: hq1.x, y: hq1.y, r: hq1.r, fac: ef, team: 1, type: 'hq' };
  if (wild) { // Wildnis: keine Burg, die Besatzung lagert an ihrem Platz
    for (const e of G.ents) if (e.team === 1) { if (e.kind === 'bld') setBlock(e, -1); e.dead = true; G.map.delete(e.id); }
    G.ents = G.ents.filter(e => !e.dead);
  }
  G.battle.sites = [{ x: hq0.x, y: hq0.y, r: hq0.r, fac: pf, team: 0, type: 'hq' }, site]; // Bodenbemalung unter den Lagern
  if (spec.settle && !(wild && defT === E)) settlement(defT === 0 ? 0 : 1, spec.settle, defT === 0 ? hq1 : hq0);
  if (spec.playerAttacks) hq0.camp = true; else if (!wild) hq1.camp = true; // Feldlager des Angreifers
  // Heere vor dem eigenen Lager, Blick zum Gegner
  const fw = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  const f0 = fw(hq0, site), c0 = [hq0.x + f0[0] * 230, hq0.y + f0[1] * 230], c1 = [site.x - f0[0] * 230, site.y - f0[1] * 230];
  deploy(0, spec.player, c0, f0, scale, defT === 0 ? spec.militia : 0, false);
  deploy(E, spec.enemy, wild ? [site.x, site.y] : c1, [-f0[0], -f0[1]], scale, defT === E ? spec.militia : 0, wild);
  // KI: als Angreifer zieht sie bald los, als Verteidiger baut sie erst aus und hält ihre Truppen daheim
  if (!wild) { const n = G.ents.filter(e => e.team === 1 && e.kind === 'unit' && e.type !== 'worker').length; G.ai.size = defT === 1 ? Math.max(G.ai.size, n + 4) : Math.max(4, Math.round(n * .8)); G.ai.next = G.t + (defT === 1 ? 420 : 75); }
  return G;
}
// Aufstellung beenden: die Schlacht beginnt
export function startBattle() { const B = G.battle; if (B && B.phase === 'deploy') { B.phase = 'fight'; B.t1 = G.t; hooks.sfx('horn'); } }

// Ein Heer in Reihen aufstellen. Rechts/links wechselnd, damit die Mitte zuerst gefüllt wird.
function deploy(team, side, c, fwd, scale, militia, wild) {
  const side_ = [-fwd[1], fwd[0]], rows = [[], [], [], []];
  for (const [role, n] of Object.entries(side.units || {})) {
    let k = Math.round((n || 0) / scale); if (n > 0 && !k) k = 1;
    for (let i = 0; i < k; i++) rows[RANK[role] ?? 1].push(role);
  }
  for (let i = 0; i < (militia || 0); i++) rows[0].push('militia');
  if (side.hero && !wild) rows[1].unshift('hero');
  const sp = 24;
  rows.forEach((row, r) => {
    const flank = r === 2; // Reiter: halb links, halb rechts neben der ersten Reihe
    row.forEach((role, i) => {
      const per = flank ? 4 : 10, line = Math.floor(i / per), j = i % per;
      let off = (j % 2 ? 1 : -1) * Math.ceil(j / 2) * sp;
      let back = (flank ? 0 : r) * 34 + line * 26;
      if (flank) off = (i % 2 ? 1 : -1) * (5.5 * sp + Math.floor(i / 2) % 3 * sp), back = Math.floor(i / 6) * 26;
      let x = c[0] - fwd[0] * back + side_[0] * off, y = c[1] - fwd[1] * back + side_[1] * off;
      [x, y] = freeSpot(x, y);
      const u = wild ? mkCreep(role === 'militia' ? 'melee' : role, x, y) : mkUnit(role === 'militia' ? 'melee' : role, team, x, y);
      u.face = Math.atan2(fwd[1], fwd[0]);
      u.dep = 1; if (role === 'militia') u.militia = 1;
      if (role === 'hero') heroAt(u, side.hero, side.heroHp || 1, side.heroDmg || 1);
    });
  });
}
function freeSpot(x, y) {
  const cx = Math.floor(x / TS), cy = Math.floor(y / TS);
  if (free(cx, cy)) return [x, y];
  for (let r = 1; r < 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (free(cx + i, cy + j)) return [(cx + i + .5) * TS, (cy + j + .5) * TS];
  return [x, y];
}
// Held mit der Stufe aus der Kampagne
function heroAt(h, lvl, hpMul, dmgMul = 1) {
  for (let l = 1; l < Math.min(lvl, MAX_HERO_LVL); l++) { h.maxhp = Math.round(h.maxhp * 1.12); h.lvl++; }
  h.maxhp = Math.round(h.maxhp * hpMul); h.hp = h.maxhp; h.dmgMul = (1 + .1 * (h.lvl - 1)) * dmgMul; // Stufe und Waffe h.xp = XP_STEPS[h.lvl - 2] || 0;
}
// Türme vor dem Verteidiger
/* ---------- Schlachtfeld nach dem Gelände der Provinz ---------- */
// Wald: dichte Haine mit Schneisen. Bergland: Felsgrate mit Durchlässen. Sumpf: Tümpel. Küste: Meer an einer Flanke.
// Trockenland: karg, Felsen. Aschenfelder: tote Bäume, Krater. Die Mitte zwischen den Heeren bleibt immer gangbar.
const noise = (R) => { const g = []; for (let i = 0; i < 64; i++) g.push(R()); return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, h = (a, b) => g[((a * 7 + b * 13) % 64 + 64) % 64], u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return h(xi, yi) * (1 - u) * (1 - v) + h(xi + 1, yi) * u * (1 - v) + h(xi, yi + 1) * (1 - u) * v + h(xi + 1, yi + 1) * u * v; }; };
function battleTerrain(biome, R, pc, ec, fwd) {
  // Zufallsbäume der Gefechtskarte entfernen (Rand und Grate bleiben)
  for (const t of G.trees) if (!t.fx) G.blk[Math.floor(t.y / TS) * GW + Math.floor(t.x / TS)] = 0;
  G.trees = G.trees.filter(t => t.fx);
  G.water = new Uint8Array(GW * GH); G.rocks = [];
  const n1 = noise(R), n2 = noise(R), n3 = noise(R);
  const fbm = (n, x, y) => n(x, y) * .6 + n(x * 2.1 + 5, y * 2.1 + 3) * .3 + n(x * 4.3, y * 4.3) * .1;
  const ax = pc[0] / TS, ay = pc[1] / TS, bx = ec[0] / TS, by = ec[1] / TS, side = [-fwd[1], fwd[0]];
  const along = (cx, cy) => (cx - ax) * fwd[0] + (cy - ay) * fwd[1], across = (cx, cy) => (cx - ax) * side[0] + (cy - ay) * side[1];
  const L = Math.hypot(bx - ax, by - ay);
  const clear = (cx, cy) => Math.hypot(cx - ax, cy - ay) < 8 || Math.hypot(cx - bx, cy - by) < 8 || (along(cx, cy) > -4 && along(cx, cy) < L + 4 && Math.abs(across(cx, cy)) < 2.2);
  const tree = (cx, cy, s) => { G.blk[cy * GW + cx] = 1; G.trees.push({ x: (cx + .5 + (R() - .5) * .5) * TS, y: (cy + .6 + (R() - .5) * .4) * TS, s: s || 15 + R() * 9, v: R() }); };
  const rock = (cx, cy) => { G.blk[cy * GW + cx] = 1; G.rocks.push({ x: (cx + .5 + (R() - .5) * .3) * TS, y: (cy + .5 + (R() - .5) * .3) * TS, s: .7 + R() * .9, v: R() }); };
  const water = (cx, cy) => { G.blk[cy * GW + cx] = 1; G.water[cy * GW + cx] = 1; };
  const P = { grenz: [.66, 0, 0], wald: [.47, 0, 0], berg: [.74, .045, 0], sumpf: [.7, 0, .63], kueste: [.78, 0, 0], trocken: [.86, .012, 0], asch: [.8, .02, 0] }[biome] || [.66, 0, 0];
  for (let cy = 2; cy < 54; cy++) for (let cx = 2; cx < 78; cx++) {
    if (G.blk[cy * GW + cx] || clear(cx, cy)) continue;
    const x = cx / 9, y = cy / 9;
    if (biome === 'kueste' && across(cx, cy) + (n3(cx / 6, cy / 6) - .5) * 6 > 11) { water(cx, cy); continue; } // Meer an der Flanke
    if (P[2] && fbm(n3, x * 1.3, y * 1.3) > P[2]) { water(cx, cy); continue; } // Tümpel
    if (biome === 'berg' && Math.abs(fbm(n2, x * .8, y * .8) - .5) < P[1] && n1(x * 3, y * 3) > .28) { rock(cx, cy); continue; } // Grate mit Lücken
    if (P[1] && biome !== 'berg' && R() < P[1]) { rock(cx, cy); continue; }
    if (fbm(n1, x, y) > P[0] + (R() - .5) * .05) tree(cx, cy);
  }
  // Am Meer: der Strand vor dem Wasser bleibt frei, kein Baum direkt am Wasser
  G.trees.sort((a, b) => a.y - b.y);
}
// Stadtmauer im Bogen vor dem Verteidiger, mit einem Tor (zwei Felder breit) in der Mitte
function cityWalls(team, c, fwd, level) {
  const r = 7.2, cx = c[0] / TS, cy = c[1] / TS, a0 = Math.atan2(fwd[1], fwd[0]), hp = 600 + 250 * level, done = new Set();
  for (let a = -1.25; a <= 1.25; a += .045) {
    if (Math.abs(a) < .17) continue; // Tor
    const gx = Math.round(cx + Math.cos(a0 + a) * r - .5), gy = Math.round(cy + Math.sin(a0 + a) * r - .5), k = gy * GW + gx;
    if (done.has(k) || !free(gx, gy)) continue; done.add(k);
    const w = mkBld('wall', team, gx, gy, true); w.hp = w.maxhp = hp; w.rot = a0 + a;
  }
}
function towers(team, c, fwd, n) {
  const s = defOf(G.fac[team], 'tower').size, side_ = [-fwd[1], fwd[0]];
  for (let i = 0; i < n; i++) {
    const off = ((i % 2 ? 1 : -1) * (Math.floor(i / 2) * 2 + 1.3)) * 70, ahead = 70;
    const x = c[0] + fwd[0] * ahead + side_[0] * off, y = c[1] + fwd[1] * ahead + side_[1] * off;
    let gx = Math.round(x / TS - s / 2), gy = Math.round(y / TS - s / 2), ok = false;
    for (let r = 0; r < 4 && !ok; r++) for (let j = -r; j <= r && !ok; j++) for (let k = -r; k <= r && !ok; k++) {
      let fits = true;
      for (let b = 0; b < s && fits; b++) for (let a = 0; a < s; a++) if (!free(gx + k + a, gy + j + b)) { fits = false; break; }
      if (fits) { gx += k; gy += j; ok = true; }
    }
    if (ok) mkBld('tower', team, gx, gy, true);
  }
}

/* ---------- Ablauf: einmal je Sekunde aus step() ---------- */
const fighters = t => G.ents.filter(e => e.team === t && e.kind === 'unit' && !e.dead);
const hqAlive = t => G.ents.some(e => e.team === t && e.type === 'hq' && !e.dead);
function baseTick(B) {
  const att = B.defT === 0 ? B.E : 0;
  if (B.E === 3) { // gegen Wilde: deren Besatzung zählt; greifen sie an, ziehen sie auf die Burg
    const foes = fighters(3);
    if (!foes.length) return finishBattle(true);
    if (!hqAlive(0) && !fighters(0).length) return finishBattle(false);
    if (B.defT === 0) { const h = G.ents.find(e => e.team === 0 && e.type === 'hq' && !e.dead); if (h) for (const u of foes) if (!u.order) setOrder(u, { t: 'amove', x: h.x, y: h.y }); }
    return;
  }
  if (!hqAlive(B.defT)) return finishBattle(B.defT !== 0);  // die Siedlung fällt
  if (!hqAlive(att) || !G.ents.some(e => e.team === att && e.kind === 'unit' && !e.dead)) return finishBattle(att !== 0); // Feldlager zerstört oder Angreifer aufgerieben
  aiTick(1);
}
export function battleTick() {
  const B = G.battle; if (!B || B.over) return;
  if (B.base) return baseTick(B);
  if (B.phase === 'deploy') { if (G.t >= B.depT) startBattle(); else return; }
  moraleTick();
  // Wer flieht, kämpft nicht mehr: eine Seite ohne standhafte Kämpfer hat verloren (die Geflohenen überleben)
  const mine = fighters(0).filter(u => !u.rout), foes = fighters(B.E).filter(u => !u.rout);
  if (!mine.length || !foes.length) return finishBattle(mine.length > 0);
  // Der Verteidiger wartet, bis der Angreifer nahe ist (oder angreift); der Angreifer zieht los.
  if (!B.engaged) {
    const c = foes.reduce((s, u) => [s[0] + u.x / foes.length, s[1] + u.y / foes.length], [0, 0]);
    if (mine.some(u => Math.hypot(u.x - c[0], u.y - c[1]) < 420) || foes.some(u => u.hp < u.maxhp)) { B.engaged = true; B.engT = G.t; }
  }
  if (B.engaged) for (const u of foes) {
    let best = null, bd = 1e9;
    for (const e of mine) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
    // Verteidiger halten die Linie, bis der Angreifer nahe ist (höchstens 75 Sekunden nach dem ersten Kontakt).
    // Im Turnier gemessen: Schützen in Deckung zu schicken zerreißt die Linie und schwächt den Verteidiger; Linie halten stärkt ihn.
    if (B.playerAttacks && G.t - (B.engT || 0) < 75 && bd > 300) continue;
    if (u.order && u.order.t !== 'move') continue;
    // Rollen: Reiter suchen Schützen, Helfer und Geschütze; Belagerungsgerät nimmt Mauern und Türme
    if (u.type === 'cav') { let tg = null, td = 760; for (const e of mine) { if (e.type !== 'ranged' && e.type !== 'support' && e.type !== 'siege') continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < td) { td = d; tg = e; } } if (tg) { setOrder(u, { t: 'attack', tg: tg.id }); continue; } }
    if (u.type === 'siege') { let tg = null, td = 900; for (const e of G.ents) { if (e.team !== 0 || e.kind !== 'bld' || e.dead) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < td) { td = d; tg = e; } } if (tg) { setOrder(u, { t: 'attack', tg: tg.id }); continue; } }
    if (best) setOrder(u, { t: 'amove', x: best.x + (simR() - .5) * 30, y: best.y + (simR() - .5) * 30 });
  }
  if (B.E === 1) aiSkirmish(1, 0);
}
// Überlebende je Truppenart, auf die Kampagne hochgerechnet (Bürgerwehr zählt nicht)
function survivors(t, start) {
  const out = {}, n = {}, fresh = {};
  for (const u of fighters(t)) {
    if (u.militia || u.type === 'hero' || u.type === 'worker') continue;
    if (u.dep || !G.battle.base) n[u.type] = (n[u.type] || 0) + 1; else fresh[u.type] = (fresh[u.type] || 0) + 1; // im Gefecht ausgebildet: ein Krieger je Figur
  }
  for (const r of Object.keys(start)) out[r] = Math.min(start[r] || 0, Math.round((n[r] || 0) * G.battle.scale));
  for (const r of Object.keys(fresh)) out[r] = (out[r] || 0) + fresh[r]; // neue Truppen schließen sich dem Heer an
  return out;
}
// Stehende Bauwerke einer Seite, für die Kampagne: Anzahl und Zustand je Art, dazu die Burg
function standing(t) {
  const out = { hq: null, blds: {} };
  for (const e of G.ents) {
    if (e.team !== t || e.kind !== 'bld' || e.dead || !e.built || e.type === 'wall') continue;
    if (e.type === 'hq') { out.hq = { tier: e.tier || 1, hp: e.hp / e.maxhp, camp: !!e.camp }; continue; }
    (out.blds[e.type] ||= []).push(Math.round(e.hp / e.maxhp * 100) / 100);
  }
  return out;
}
export function finishBattle(won, retreat = false) {
  const B = G.battle; if (!B || B.over) return B && B.over;
  const p = survivors(0, B.start.p);
  if (retreat) for (const r of Object.keys(p)) p[r] = Math.floor(p[r] * .8); // Abzug unter Feuer kostet
  const res = { won, retreat, p, e: survivors(B.E, B.start.e), pHero: B.start.pHero && fighters(0).some(u => u.type === 'hero'),
    eHero: B.start.eHero && fighters(B.E).some(u => u.type === 'hero'), time: G.t - B.t0, kills: G.kills, lost: G.lost };
  if (B.base) { // Bauten und übrige Rohstoffe beider Seiten gehen an die Kampagne zurück
    res.base = true; res.pb = standing(0); res.eb = B.E === 1 ? standing(1) : null;
    res.pres = { ore: Math.floor(G.ore[0]), wood: Math.floor(G.wood[0]) }; res.eres = B.E === 1 ? { ore: Math.floor(G.ore[1]), wood: Math.floor(G.wood[1]) } : null;
    res.res0 = B.res0;
  }
  B.over = res; G.over = won ? 'win' : 'lose';
  hooks.battleEnd(res);
  return res;
}
export const playerName = fac => FACTIONS[fac] ? FACTIONS[fac].name : 'Wilde';
