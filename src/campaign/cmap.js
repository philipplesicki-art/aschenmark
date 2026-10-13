// Kampagnenkarte von Orsa: aus einem Startwert erzeugt (gleicher Wert, gleiche Karte), deshalb wird nur der Startwert
// gespeichert. Raster aus Zellen; jede Landzelle gehört genau einer Provinz.
import { rng } from '../state.js';
import { FACTIONS } from '../factions.js';
import { NAME_PARTS, CAPITALS } from './cdata.js';

export const MW = 240, MH = 168; // Zellen; die Darstellung skaliert das Raster

function makeNoise(R, n = 7) {
  const k = Array.from({ length: n }, () => ({ fx: .6 + R() * 2.8, fy: .6 + R() * 2.8, p: R() * 6.283, q: R() * 6.283, a: .4 + R() }));
  const sum = k.reduce((s, o) => s + o.a, 0);
  return (u, v) => k.reduce((s, o) => s + Math.sin(u * o.fx * 6.283 + o.p) * Math.cos(v * o.fy * 6.283 + o.q) * o.a, 0) / sum;
}

export function genMap(seed, nProv = 30) {
  const R = rng((seed ^ 0x2545F491) >>> 0), shape = makeNoise(R), hill = makeNoise(R, 5);
  // Landmasse: weite Ellipse, Ränder vom Rauschen zerfranst; Meer ringsum
  let land = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const nx = x / MW * 2 - 1, ny = y / MH * 2 - 1, d = Math.hypot(nx * .94, ny * 1.04);
    if (d + shape(x / MW, y / MH) * .2 < .9) land[y * MW + x] = 1;
  }
  // nur die größte zusammenhängende Landmasse behalten (keine losen Inseln)
  land = largestComponent(land);
  const landCells = []; for (let i = 0; i < land.length; i++) if (land[i]) landCells.push(i);

  // Mittelpunkte: zuerst die drei Hauptstädte, dann Poisson-Verteilung über das Land
  const pts = [], minD = Math.sqrt(landCells.length / nProv) * .78;
  const nearestLand = (u, v) => { let best = landCells[0], bd = 1e9; for (const i of landCells) { const d = (i % MW - u * MW) ** 2 + (Math.floor(i / MW) - v * MH) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  const capFac = {};
  for (const f of Object.keys(CAPITALS)) { const i = nearestLand(...CAPITALS[f]); pts.push([i % MW, Math.floor(i / MW)]); capFac[pts.length - 1] = f; }
  for (let tries = 0; pts.length < nProv && tries < 20000; tries++) {
    const i = landCells[Math.floor(R() * landCells.length)], x = i % MW, y = Math.floor(i / MW);
    if (pts.every(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 > minD * minD)) pts.push([x, y]);
  }
  // Zellen der nächsten Mitte zuordnen; zweimal nach Lloyd glätten (Hauptstädte bleiben stehen)
  const pid = new Int16Array(MW * MH).fill(-1);
  const assign = () => { for (const i of landCells) { const x = i % MW, y = Math.floor(i / MW); let b = 0, bd = 1e9; for (let k = 0; k < pts.length; k++) { const d = (pts[k][0] - x) ** 2 + (pts[k][1] - y) ** 2; if (d < bd) { bd = d; b = k; } } pid[i] = b; } };
  for (let it = 0; it < 3; it++) {
    assign();
    if (it === 2) break;
    const sx = new Float64Array(pts.length), sy = new Float64Array(pts.length), n = new Float64Array(pts.length);
    for (const i of landCells) { const k = pid[i]; sx[k] += i % MW; sy[k] += Math.floor(i / MW); n[k]++; }
    for (let k = 3; k < pts.length; k++) if (n[k]) pts[k] = [sx[k] / n[k], sy[k] / n[k]];
  }

  // Provinzen: Mittelpunkt, Größe, Nachbarn (gemeinsame Grenze von mindestens zwei Zellen), Küstenlage
  const P = pts.map((p, id) => ({ id, cells: 0, sx: 0, sy: 0, nbc: new Map(), coast: false }));
  for (const i of landCells) {
    const x = i % MW, y = Math.floor(i / MW), p = P[pid[i]]; p.cells++; p.sx += x; p.sy += y;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) { p.coast = true; continue; }
      const q = pid[yy * MW + xx]; if (q < 0) p.coast = true; else if (q !== p.id) p.nbc.set(q, (p.nbc.get(q) || 0) + 1);
    }
  }
  const provs = P.map(p => ({ id: p.id, x: p.sx / p.cells, y: p.sy / p.cells, cells: p.cells, coast: p.coast,
    nb: [...p.nbc].filter(([, c]) => c >= 2).map(([q]) => q).sort((a, b) => a - b) }));
  // Nachbarschaft beidseitig machen
  for (const p of provs) for (const q of p.nb) if (!provs[q].nb.includes(p.id)) provs[q].nb.push(p.id);

  // Gelände nach Lage: Norden kalt, Osten trocken, Süden Sumpf, Trockenland und Küste; Berge verstreut im Binnenland
  for (const p of provs) {
    const u = p.x / MW, v = p.y / MH, h = hill(u, v);
    let b;
    if (v < .45) b = u < .32 ? 'grenz' : u < .58 ? 'wald' : 'asch';
    else if (v < .64) b = u > .68 ? 'trocken' : u < .34 ? (h > 0 ? 'wald' : 'grenz') : (h > .1 ? 'grenz' : 'wald');
    else b = p.coast ? 'kueste' : u > .74 || h > .15 ? 'trocken' : 'sumpf';
    if (b !== 'kueste' && h > .38) b = 'berg'; // Berge überall im Binnenland: jedes Reich findet Erz
    p.biome = b;
  }
  const capitals = {};
  for (const [k, f] of Object.entries(capFac)) { const p = provs[+k]; capitals[f] = p.id; p.biome = { wacht: 'grenz', asch: 'asch', salz: 'kueste' }[f]; }
  // Namen: Hauptstädte nach der Burg ihrer Fraktion, sonst Silben des Geländes, ohne Doppelungen
  const used = new Set();
  for (const p of provs) {
    const cf = Object.keys(capitals).find(f => capitals[f] === p.id);
    if (cf) { p.name = FACTIONS[cf].tiers[0]; used.add(p.name); continue; }
    const [a, b] = NAME_PARTS[p.biome];
    for (let t = 0; t < 60; t++) { const n = a[Math.floor(R() * a.length)] + b[Math.floor(R() * b.length)]; if (!used.has(n)) { p.name = n; used.add(n); break; } }
    p.name ||= 'Provinz ' + (p.id + 1);
  }
  return { seed, w: MW, h: MH, pid, provs, capitals };
}

function largestComponent(land) {
  const lab = new Int32Array(land.length).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < land.length; s++) {
    if (!land[s] || lab[s] >= 0) continue;
    let n = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % MW, y = Math.floor(i / MW);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const j = yy * MW + xx; if (land[j] && lab[j] < 0) { lab[j] = id; st.push(j); } }
    }
    if (n > bestN) { bestN = n; best = id; }
    id++;
  }
  const out = new Uint8Array(land.length); for (let i = 0; i < land.length; i++) out[i] = lab[i] === best ? 1 : 0;
  return out;
}

// Kürzester Weg über Nachbarprovinzen (Breitensuche); pass(id) entscheidet, ob eine Provinz durchquert werden darf.
export function findRoute(map, from, to, pass = () => true) {
  if (from === to) return [];
  const prev = new Map([[from, -1]]), q = [from];
  while (q.length) {
    const c = q.shift();
    for (const n of map.provs[c].nb) {
      if (prev.has(n)) continue;
      if (n !== to && !pass(n)) continue;
      prev.set(n, c);
      if (n === to) { const r = [n]; let k = c; while (k !== from) { r.unshift(k); k = prev.get(k); } return r; }
      q.push(n);
    }
  }
  return null;
}
