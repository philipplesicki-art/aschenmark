import { TS, GW, GH, MAP, DIFF } from './config.js';
import { G, setG, rng, simR } from './state.js';
import { defOf, WILD } from './factions.js';
import { initEvents } from './events.js';
import { initQuests } from './quests.js';
import { REGIONS, ridgeCells, regionAt } from './regions.js';

export const free = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && G.blk[cy * GW + cx] === 0;

export function setBlock(e, v) {
  for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) G.blk[(e.gy + j) * GW + e.gx + i] += v;
}
function add(e) { G.ents.push(e); G.map.set(e.id, e); return e; }

export function mkUnit(type, team, x, y) {
  const fac = G.fac[team], d = defOf(fac, type);
  return add({
    id: G.nid++, type, team, fac, kind: 'unit', d, x, y, r: d.r, hp: d.hp, maxhp: d.hp, cd: 0,
    order: null, path: null, pi: 0, face: simR() * 6.28, carry: 0, gt: 0, hit: 0,
    buff: 0, slow: 0, weak: 0, shield: 0, rpT: 0, scan: simR() * .3, done: false,
    abCd: [0, 0], xp: 0, lvl: 1, dmgMul: 1, moving: false, working: false
  });
}

export function mkCreep(type, x, y) {
  const d = WILD[type];
  return add({
    id: G.nid++, type, team: 3, fac: 'wild', kind: 'unit', d, x, y, r: d.r, hp: d.hp, maxhp: d.hp, cd: 0,
    order: null, path: null, pi: 0, face: simR() * 6.28, carry: 0, gt: 0, hit: 0,
    buff: 0, slow: 0, weak: 0, shield: 0, rpT: 0, scan: simR() * .3, done: false,
    abCd: [0, 0], xp: 0, lvl: 1, dmgMul: 1, moving: false, working: false, hx: x, hy: y
  });
}

// Neutrale Lager bei den Erzadern der Außengebiete.
function camps() {
  const spots = [[95, 14, 'trocken'], [104, 40, 'trocken'], [10, 70, 'sumpf'], [28, 76, 'sumpf'], [55, 72, 'kueste'], [100, 70, 'kueste']];
  spots.forEach(([mx, my], k) => {
    const cx = (mx + 2.6) * TS, cy = (my + 2.4) * TS, comp = ['melee', 'melee', 'melee', 'ranged', k % 2 ? 'brute' : 'ranged'];
    comp.forEach((tp, i) => mkCreep(tp, cx + (i % 3) * 24 - 24, cy + Math.floor(i / 3) * 26));
  });
}

export function mkBld(type, team, gx, gy, built) {
  const fac = G.fac[team], d = defOf(fac, type), s = d.size;
  const e = {
    id: G.nid++, type, team, fac, kind: 'bld', d, gx, gy, size: s,
    x: (gx + s / 2) * TS, y: (gy + s / 2) * TS, r: s * TS / 2,
    hp: built ? d.hp : d.hp * .1, maxhp: d.hp, built, prog: built ? 1 : 0,
    queue: [], rally: null, cd: 0, hit: 0, seen: team === 0
  };
  setBlock(e, 1);
  return add(e);
}

export function mkDep(gx, gy, amt) {
  const e = {
    id: G.nid++, type: 'mine', team: 2, fac: null, kind: 'dep', d: defOf(null, 'mine'), gx, gy, size: 2,
    x: (gx + 1) * TS, y: (gy + 1) * TS, r: TS, amt, max: amt, hp: 1, maxhp: 1, seen: false
  };
  setBlock(e, 1);
  return add(e);
}

function forests(R) {
  const hq0 = [9.5, 39.5], hq1 = [70.5, 16.5];
  const lx = hq1[0] - hq0[0], ly = hq1[1] - hq0[1], ll = Math.hypot(lx, ly);
  const mines = G.ents.filter(e => e.kind === 'dep');
  const put = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH || G.blk[cy * GW + cx]) return;
    G.blk[cy * GW + cx] = 1;
    G.trees.push({ x: (cx + .5 + (R() - .5) * .5) * TS, y: (cy + .6 + (R() - .5) * .4) * TS, s: 15 + R() * 9, v: R() });
  };
  for (let i = 0; i < GW; i++) { put(i, 0); put(i, GH - 1); }
  for (let j = 0; j < GH; j++) { put(0, j); put(GW - 1, j); }
  // Grate zwischen Kernland und Außengebieten
  for (const [x, y] of ridgeCells()) put(x, y);
  for (let k = 0; k < 90; k++) {
    const cx = R() * GW, cy = R() * GH, r = 2 + R() * 3.6;
    if (Math.hypot(cx - hq0[0], cy - hq0[1]) < 13 || Math.hypot(cx - hq1[0], cy - hq1[1]) < 13) continue;
    if (mines.some(m => Math.hypot(cx - m.x / TS, cy - m.y / TS) < r + 5)) continue;
    const dl = Math.abs((cx - hq0[0]) * ly - (cy - hq0[1]) * lx) / ll;
    if (dl < r + 5) continue;
    for (let j = Math.floor(cy - r * 1.3); j <= Math.ceil(cy + r * 1.3); j++)
      for (let i = Math.floor(cx - r * 1.3); i <= Math.ceil(cx + r * 1.3); i++) {
        const d = Math.hypot(i + .5 - cx, j + .5 - cy) / (r * 1.25);
        if (d < 1 && R() < 1.05 - d) put(i, j);
      }
  }
  G.trees.sort((a, b) => a.y - b.y);
}

export function nearestDep(u, maxD) {
  let best = null, bd = maxD || 1e9;
  for (const e of G.ents) {
    if (e.kind !== 'dep' || e.dead || e.amt <= 0 || !G.regions[regionAt(e.x, e.y)]) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function popUsed(t) {
  let n = 0;
  for (const e of G.ents) {
    if (e.team !== t || e.dead) continue;
    if (e.kind === 'unit') n += e.d.pop;
    else if (e.kind === 'bld') for (const q of e.queue) n += defOf(e.fac, q.type).pop;
  }
  return n;
}
export function popCap(t) {
  let n = 0;
  for (const e of G.ents) if (e.team === t && e.kind === 'bld' && e.built && !e.dead) n += e.d.supply || 0;
  return Math.min(n, 60);
}
export const hasBuilt = (team, type) => G.ents.some(e => e.team === team && e.type === type && e.built && !e.dead);

// Neue Partie. Der Spieler (Team 0) startet immer unten links.
export function newWorld({ fac0 = 'wacht', fac1 = 'asch', diff = 'normal', seed, quests = false } = {}) {
  seed = seed ?? ((Math.random() * 1e9) | 0);
  const R = rng(seed), P = DIFF[diff];
  setG({
    t: 0, nid: 1, ents: [], map: new Map(), projs: [], parts: [], marks: [], zones: [], floats: [], corpses: [],
    blk: new Uint8Array(GW * GH), fog: new Uint8Array(GW * GH), fogDirty: true,
    ore: [300, 300], pp: [0, 0], ppCd: [0, 0], teamKills: [0, 0], kills: 0, lost: 0,
    over: null, paused: false, sel: [], groups: {}, alertT: -99, diff, trees: [], aiT: 3, fogT: 0, idleI: -1,
    fac: [fac0, fac1], seed, gates: {}, mined: [0, 0], regions: Object.fromEntries(Object.values(REGIONS).map(r => [r.id, r.open])), rs: (seed ^ 0x9E3779B9) >>> 0, combat: 0, shakeT: 0, shakeA: 0,
    ai: { p: P, k: 0, next: P.first, size: P.size0, wave: 0, active: false }
  });
  initEvents();
  for (const m of MAP.mines) mkDep(m[0], m[1], m[2]);
  const h0 = mkBld('hq', 0, MAP.hq[0][0], MAP.hq[0][1], true);
  const h1 = mkBld('hq', 1, MAP.hq[1][0], MAP.hq[1][1], true);
  forests(R);
  camps();
  for (let i = 0; i < 5; i++) {
    mkUnit('worker', 0, h0.x - 50 + i * 24, h0.y + h0.r + 22);
    mkUnit('worker', 1, h1.x - 50 + i * 24, h1.y + h1.r + 22);
  }
  for (let i = 0; i < 3; i++) mkUnit('melee', 0, h0.x + 60 + i * 20, h0.y + 30);
  for (let i = 0; i < 2; i++) mkUnit('melee', 1, h1.x - 60 - i * 20, h1.y + 30);
  initQuests(quests ? fac0 : null);
  return G;
}

// Platzprüfung für Neubauten. Der Spieler braucht erkundetes Gelände, die KI einen freien Rand.
export function canPlaceAt(tp, gx, gy, team) {
  const ai = team === 1 || !!G.ai0, s = defOf(G.fac[team], tp).size, m = ai ? 1 : 0; // KI-Seiten: freier Rand, kein Nebel nötig
  if (tp === 'outpost') { // nahe einer Erzader, aber nicht neben einem anderen Abgabepunkt
    const cx = (gx + s / 2) * TS, cy = (gy + s / 2) * TS;
    if (!G.ents.some(e => e.kind === 'dep' && !e.dead && e.amt > 0 && Math.hypot(e.x - cx, e.y - cy) < 230)) return false;
    if (G.ents.some(e => e.team === team && e.kind === 'bld' && !e.dead && (e.type === 'hq' || e.d.dropoff) && Math.hypot(e.x - cx, e.y - cy) < 260)) return false;
  }
  for (let j = -m; j < s + m; j++) for (let i = -m; i < s + m; i++) {
    if (!free(gx + i, gy + j)) return false;
    if (!ai && i >= 0 && j >= 0 && i < s && j < s && G.fog[(gy + j) * GW + gx + i] === 0) return false;
  }
  return true;
}
