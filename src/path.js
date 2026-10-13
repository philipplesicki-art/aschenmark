import { evSpeed } from './events.js';
import { TS, GW, GH } from './config.js';
import { G } from './state.js';
import { free } from './world.js';

function Heap() {
  const a = [];
  return {
    push(f, i) {
      a.push([f, i]); let k = a.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; }
    },
    pop() {
      const t = a[0], l = a.pop();
      if (a.length) {
        a[0] = l; let k = 0;
        for (;;) {
          let c = 2 * k + 1; if (c >= a.length) break;
          if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++;
          if (a[k][0] <= a[c][0]) break;
          [a[k], a[c]] = [a[c], a[k]]; k = c;
        }
      }
      return t;
    },
    get size() { return a.length; }
  };
}

export function nearestFree(cx, cy) {
  if (free(cx, cy)) return [cx, cy];
  for (let r = 1; r < 16; r++) {
    let best = null, bd = 1e9;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      if (free(cx + i, cy + j)) { const d = i * i + j * j; if (d < bd) { bd = d; best = [cx + i, cy + j]; } }
    }
    if (best) return best;
  }
  return null;
}

function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 10);
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (!free(Math.floor(x / TS), Math.floor(y / TS))) return false;
  }
  return true;
}

export function findPath(sx, sy, gx, gy) {
  const sc = [Math.max(0, Math.min(GW - 1, Math.floor(sx / TS))), Math.max(0, Math.min(GH - 1, Math.floor(sy / TS)))];
  const g = nearestFree(Math.max(0, Math.min(GW - 1, Math.floor(gx / TS))), Math.max(0, Math.min(GH - 1, Math.floor(gy / TS))));
  if (!g) return null;
  const exact = Math.floor(gx / TS) === g[0] && Math.floor(gy / TS) === g[1];
  const gp = { x: exact ? gx : (g[0] + .5) * TS, y: exact ? gy : (g[1] + .5) * TS };
  if (sc[0] === g[0] && sc[1] === g[1]) return [gp];
  const N = GW * GH, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), cl = new Uint8Array(N);
  const si = sc[1] * GW + sc[0], gi = g[1] * GW + g[0], H = Heap();
  const hf = i => {
    const dx = Math.abs((i % GW) - g[0]), dy = Math.abs(Math.floor(i / GW) - g[1]);
    return Math.max(dx, dy) + .414 * Math.min(dx, dy);
  };
  gs[si] = 0; H.push(hf(si), si);
  let found = false;
  while (H.size) {
    const [, i] = H.pop();
    if (cl[i]) continue; cl[i] = 1;
    if (i === gi) { found = true; break; }
    const cx = i % GW, cy = (i / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!free(nx, ny)) continue;
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
      const ni = ny * GW + nx; if (cl[ni]) continue;
      const ng = gs[i] + (dx && dy ? 1.414 : 1);
      if (ng < gs[ni]) { gs[ni] = ng; from[ni] = i; H.push(ng + hf(ni), ni); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = gi; i !== si && i >= 0; i = from[i]) cells.push({ x: ((i % GW) + .5) * TS, y: (((i / GW) | 0) + .5) * TS });
  cells.reverse();
  cells[cells.length - 1] = gp;
  const out = []; let cur = { x: sx, y: sy }, i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !los(cur.x, cur.y, cells[j].x, cells[j].y)) j--;
    out.push(cells[j]); cur = cells[j]; i = j + 1;
  }
  return out;
}

export function setOrder(u, o) { u.order = o; u.path = null; u.pi = 0; u.done = false; u.pdx = undefined; u.rpT = 0; }

function follow(u, dt) {
  if (!u.path) return true;
  const p = u.path[u.pi];
  if (!p) { u.path = null; return true; }
  const dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
  const sp = u.d.spd * (u.buff > 0 ? 1.15 : 1) * (u.slow > 0 ? .55 : 1) * evSpeed(u) * dt;
  if (d <= sp + .5) {
    u.x = p.x; u.y = p.y; u.pi++;
    if (u.pi >= u.path.length) { u.path = null; return true; }
    return false;
  }
  u.x += dx / d * sp; u.y += dy / d * sp; u.face = Math.atan2(dy, dx);
  return false;
}

// Gibt true zurück, wenn das Ziel erreicht ist oder kein Weg existiert.
export function goTo(u, x, y, dt) {
  const moved = u.pdx === undefined || Math.hypot(u.pdx - x, u.pdy - y) > 28;
  if (!u.path) {
    if (u.done && !moved) return true;
    if (moved || u.rpT <= 0) {
      u.path = findPath(u.x, u.y, x, y); u.pi = 0; u.pdx = x; u.pdy = y; u.done = false; u.rpT = .5;
      if (!u.path) { u.done = true; return true; }
    } else return false;
  } else if (moved && u.rpT <= 0) {
    u.path = findPath(u.x, u.y, x, y); u.pi = 0; u.pdx = x; u.pdy = y; u.rpT = .5;
    if (!u.path) { u.done = true; return true; }
  }
  u.moving = true;
  const fin = follow(u, dt);
  if (fin) u.done = true;
  return fin;
}
