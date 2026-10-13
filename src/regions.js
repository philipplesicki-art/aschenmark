// Regionen der Welt Orsa und ihre Pässe. Die Simulation kennt nur Zahlen; Darstellung liest REGIONS für Farben.
// Aufbau der Karte (Zellen): links oben das Kernland (Grenzmark, Waldmeer, Aschenfelder), östlich das Trockenland,
// südlich Sumpfland und Küste. Die Außengebiete sind durch Grate abgeriegelt, bis ein Pass geöffnet wird.
import { GW, GH } from './config.js';
import { G, hooks } from './state.js';

export const CORE_W = 80, CORE_H = 56;

export const REGIONS = {
  grenz:  { id: 'grenz',  name: 'Grenzmark',     cold: true,  open: true },
  wald:   { id: 'wald',   name: 'Waldmeer',      cold: true,  open: true, tint: 'rgba(38,62,50,.38)' },
  asch:   { id: 'asch',   name: 'Aschenfelder',  cold: true,  open: true },
  trocken:{ id: 'trocken',name: 'Trockenland',   cold: false, open: false, base: '#a58a5e', dark: 'rgba(110,82,48,.38)', light: 'rgba(224,200,150,.34)', tree: [1, .84, .56] },
  sumpf:  { id: 'sumpf',  name: 'Sumpfland',     cold: false, open: false, base: '#4c5848', dark: 'rgba(22,34,26,.45)',  light: 'rgba(124,142,98,.30)',  tree: [.72, .95, .68] },
  kueste: { id: 'kueste', name: 'Küste',         cold: false, open: false, base: '#b3a57c', dark: 'rgba(84,88,80,.34)',  light: 'rgba(238,226,190,.42)', tree: [.94, 1, .9] }
};

export function regionAtCell(cx, cy) {
  if (cy >= CORE_H) return cx < 40 ? 'sumpf' : 'kueste';
  if (cx >= CORE_W) return 'trocken';
  return cx < 30 ? 'grenz' : cx < 54 ? 'wald' : 'asch';
}
export const regionAt = (x, y) => regionAtCell(Math.floor(x / 32), Math.floor(y / 32));

// Pässe: Lücken in den Graten. Ein Grat besteht aus zwei Zellreihen.
export const GATES = {
  ost:    { name: 'Ostpass',      to: 'trocken', ridge: 'v', at: CORE_W, a: 25, b: 30 },
  moor:   { name: 'Moorpfad',     to: 'sumpf',   ridge: 'h', at: CORE_H, a: 15, b: 20 },
  kueste: { name: 'Küstenweg',    to: 'kueste',  ridge: 'h', at: CORE_H, a: 60, b: 65 }
};

// Alle Grat-Zellen: senkrecht (x = at, at+1) für y von 0 bis CORE_H; waagerecht (y = at, at+1) für x von 0 bis GW.
export function ridgeCells() {
  const out = [];
  for (let y = 0; y < CORE_H; y++) for (const x of [CORE_W, CORE_W + 1]) out.push([x, y, y >= GATES.ost.a && y <= GATES.ost.b ? 'ost' : null]);
  for (let x = 0; x < GW; x++) for (const y of [CORE_H, CORE_H + 1]) {
    let g = null;
    for (const k of ['moor', 'kueste']) if (x >= GATES[k].a && x <= GATES[k].b) g = k;
    out.push([x, y, g]);
  }
  return out;
}

export function openedRegion(r) { return !!(G.regions && G.regions[r]); }

// Pass öffnen: Zellen frei, Bäume im Pass entfernen. Gibt false zurück, wenn schon offen.
export function openGate(id) {
  const g = GATES[id]; if (!g || G.gates[id]) return false;
  G.gates[id] = true; G.regions[g.to] = true;
  for (const [x, y, k] of ridgeCells()) if (k === id) {
    G.blk[y * GW + x] = 0;
    G.trees = G.trees.filter(t => !(Math.floor(t.x / 32) === x && Math.floor(t.y / 32) === y));
  }
  G.fogDirty = true;
  hooks.regionsChanged(id);
  return true;
}
