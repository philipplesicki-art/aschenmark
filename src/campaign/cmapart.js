// Kartenkunst der Weltkarte: gemaltes Gelände (Relief, weiche Übergänge, Küsten mit Brandungslinien, Meerestiefe),
// handgezeichnete Zeichen je Gelände, Siedlungen als kleine Bauten, Reichsgrenzen mit Leuchten, Rahmen und Windrose.
// Alles wird einmal je Karte in Leinwände gemalt (B Bildpunkte je Rasterzelle) und beim Zeichnen nur noch skaliert.
import { MW, MH } from './cmap.js';
import { BIOMES } from './cdata.js';

export const B = 8; // Bildpunkte je Rasterzelle im Kartenbild

/* ---------- Rauschen ---------- */
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) & 65535) / 65535; };
// Wertrauschen über eine feste Zufallstafel (256 × 256, gekachelt); die Saat verschiebt nur die Lage
const TAB = new Float32Array(65536); for (let i = 0; i < 65536; i++) TAB[i] = hash(i & 255, i >> 8, 99);
function vnoise(x, y, s) {
  x += s * 37.17; y += s * 11.53;
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = TAB[y0 + x0], b = TAB[y0 + x1], c = TAB[y1 + x0], d = TAB[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s, o = 4) => { let t = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 17); a *= .5; f *= 2.03; } return t; };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Gelände: Grundfarbe (etwas kräftiger als die Kennfarbe), Höhe, Kälte
const LOOK = {
  grenz: { c: '#8d969b', h: .35 }, wald: { c: '#3f5c4c', h: .3 }, asch: { c: '#4d4442', h: .3 }, berg: { c: '#8a847c', h: 1 },
  trocken: { c: '#a68a5c', h: .22 }, sumpf: { c: '#4c5c48', h: .08 }, kueste: { c: '#a39a7c', h: .12 }
};

/* ---------- Gelände ---------- */
export function paintBase(MAP, seed) {
  // Gelände in grober Auflösung rechnen (Q Bildpunkte je Zelle), danach weich vergrößern; Zeichen in voller Auflösung
  const Q = 3, W = MW * Q, H = MH * Q, N = MW * MH;
  // Abstand zur Küste je Zelle (an Land positiv, im Meer negativ)
  const land = new Uint8Array(N); for (let i = 0; i < N; i++) land[i] = MAP.pid[i] >= 0 ? 1 : 0;
  const dist = new Float32Array(N).fill(1e9), q = [];
  for (let i = 0; i < N; i++) { const x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; if (land[yy * MW + xx] !== land[i]) { dist[i] = .5; q.push(i); break; } } }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const j = yy * MW + xx; if (land[j] === land[i] && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); } } }
  const sd = new Float32Array(N); for (let i = 0; i < N; i++) sd[i] = land[i] ? Math.min(dist[i], 40) : -Math.min(dist[i], 40);
  // Gelände je Zelle, weich verwischt: Farbe und Grundhöhe
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N), ch = new Float32Array(N), cold = new Float32Array(N);
  for (let i = 0; i < N; i++) { const p = MAP.pid[i]; const b = p >= 0 ? MAP.provs[p].biome : 'kueste', L = LOOK[b] || LOOK.grenz, c = rgb(L.c); cr[i] = c[0]; cg[i] = c[1]; cb[i] = c[2]; ch[i] = L.h; cold[i] = BIOMES[b] && BIOMES[b].cold ? 1 : 0; }
  const blur = (a, r) => { const t = new Float32Array(N); for (let pass = 0; pass < 2; pass++) { for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + (pass ? 0 : k), yy = y + (pass ? k : 0); if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; s += a[yy * MW + xx]; n++; } t[y * MW + x] = s / n; } a.set(t); } };
  for (const a of [cr, cg, cb]) blur(a, 2); blur(ch, 3); blur(cold, 3);
  const bil = (a, u, v) => { const x = Math.max(0, Math.min(MW - 1.001, u - .5)), y = Math.max(0, Math.min(MH - 1.001, v - .5)), xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * MW + xi;
    const x1 = Math.min(MW - 1, xi + 1) - xi, y1 = (Math.min(MH - 1, yi + 1) - yi) * MW;
    return a[i] * (1 - fx) * (1 - fy) + a[i + x1] * fx * (1 - fy) + a[i + y1] * (1 - fx) * fy + a[i + x1 + y1] * fx * fy; };
  // Höhe je Bildpunkt (für Relief und Küste)
  const hgt = new Float32Array(W * H), isLand = new Uint8Array(W * H), depth = new Float32Array(W * H), shore = new Float32Array(W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = (px + .5) / Q, v = (py + .5) / Q, k = py * W + px;
    const w2 = (fbm(u * .6, v * .6, seed + 5, 3) - .5) * .9, wob = (fbm(u * .18, v * .18, seed, 3) - .5) * 2.6 + w2; // ausgefranste Küste
    const s = bil(sd, u, v) + wob; shore[k] = bil(sd, u, v) + w2;
    if (s > 0) {
      isLand[k] = 1;
      const base = bil(ch, u, v), rough = fbm(u * .16, v * .16, seed + 11, 4);
      hgt[k] = base * (.4 + rough * 1.3) * Math.min(1, s / 3) + rough * .12 + Math.pow(Math.max(0, fbm(u * .22, v * .22, seed + 23, 2) - .45), 2) * base * 3;
    } else { depth[k] = -s; hgt[k] = 0; }
  }
  const sm = document.createElement('canvas'); sm.width = W; sm.height = H; const sctx = sm.getContext('2d'), img = sctx.createImageData(W, H), d = img.data;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const k = py * W + px, u = (px + .5) / Q, v = (py + .5) / Q, grain = (hash(px, py, 7) - .5) * 5;
    let r, g, b;
    if (isLand[k]) {
      // Relief: Licht von Nordwesten
      const hx = hgt[Math.min(W * H - 1, k + 2)] - hgt[Math.max(0, k - 2)], hy = hgt[Math.min(W * H - 1, k + 2 * W)] - hgt[Math.max(0, k - 2 * W)];
      const shade = Math.max(-.5, Math.min(.5, (-hx - hy) * 7));
      r = bil(cr, u, v); g = bil(cg, u, v); b = bil(cb, u, v);
      const det = (fbm(u * .9, v * .9, seed + 3, 2) - .5) * .12, lv = 1 + shade * .55 + det;
      r *= lv; g *= lv; b *= lv;
      // Schnee auf Höhen im kalten Norden, Reif an kalten Hängen
      const snow = Math.max(0, Math.min(1, (hgt[k] - .62) * 4)) * (.35 + .65 * bil(cold, u, v)) + bil(cold, u, v) * Math.max(0, shade) * .25;
      r += (232 - r) * snow; g += (238 - g) * snow; b += (244 - b) * snow;
      // Küstensaum: heller Sand
      const sh = Math.max(0, 1 - shore[k] / 1.2);
      r += (176 - r) * sh * .35; g += (164 - g) * sh * .35; b += (130 - b) * sh * .35;
    } else {
      const dd = depth[k], t = Math.min(1, dd / 9);
      r = 46 + (12 - 46) * t; g = 86 + (30 - 86) * t; b = 98 + (48 - 98) * t;
      const wave = fbm(u * .9 + v * .3, v * .9, seed + 31, 2); r += (wave - .5) * 10; g += (wave - .5) * 14; b += (wave - .5) * 16;
      // Brandungslinien: mehrere Höhenlinien an der Küste
      for (const [at, a] of [[.35, .55], [1.3, .3], [2.6, .16], [4.2, .08]]) { const f = Math.abs(dd - at); if (f < .14) { const k2 = (1 - f / .14) * a; r += (220 - r) * k2; g += (232 - g) * k2; b += (236 - b) * k2; } }
    }
    d[k * 4] = r + grain; d[k * 4 + 1] = g + grain; d[k * 4 + 2] = b + grain; d[k * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = MW * B; c.height = MH * B; const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(sm, 0, 0, c.width, c.height);
  // Küstenlinie als dunkle, leicht unruhige Feder
  const R = B / Q; ctx.fillStyle = 'rgba(18,22,24,.7)';
  for (let py = 1; py < H - 1; py++) for (let px = 1; px < W - 1; px++) { const k = py * W + px; if (isLand[k] && (!isLand[k - 1] || !isLand[k + 1] || !isLand[k - W] || !isLand[k + W])) ctx.fillRect(px * R - .3, py * R - .3, R * .9, R * .9); }
  const river = rivers(ctx, MAP, seed, sd, (u, v) => bil(sd, u, v));
  glyphs(ctx, MAP, seed, (x, y) => isLand[Math.floor(y / R) * W + Math.floor(x / R)] && !river[Math.floor(y / B) * MW + Math.floor(x / B)], (x, y) => hgt[Math.floor(y / R) * W + Math.floor(x / R)], MW * B, MH * B);
  return c;
}

/* ---------- Flüsse: aus dem Bergland bergab zum Meer ---------- */
// Quellen in Bergprovinzen weit im Landesinneren; jeder Schritt geht zum Nachbarn mit kleinerem Küstenabstand (mit etwas Zufall),
// bis das Meer oder ein anderer Fluss erreicht ist. Gezeichnet geglättet, stromab breiter. Gibt die Flusszellen zurück.
function rivers(ctx, MAP, seed, sd, sdAt) {
  const mask = new Uint8Array(MW * MH), lines = [];
  const src = [];
  for (let i = 0; i < MW * MH; i++) { const p = MAP.pid[i]; if (p < 0) continue; const b = MAP.provs[p].biome; if ((b === 'berg' && sd[i] >= 4) || ((b === 'wald' || b === 'grenz' || b === 'sumpf') && sd[i] >= 10)) src.push(i); }
  src.sort((a, b) => hash(a % MW, (a / MW) | 0, seed + 41) - hash(b % MW, (b / MW) | 0, seed + 41));
  const starts = [];
  for (const i of src) { if (starts.length >= 9) break; const x = i % MW, y = (i / MW) | 0; if (starts.every(j => Math.hypot(j % MW - x, ((j / MW) | 0) - y) > 18)) starts.push(i); }
  // Fließen: in kleinen Schritten bergab (Küstenabstand plus weiches Rauschen), mit Schwung, damit Bögen statt Ecken entstehen
  const H = (u, v) => sdAt(u, v) + (fbm(u * .05, v * .05, seed + 43, 2) - .5) * 2.2; // Rauschen flacher als das Gefälle zur Küste: keine Senken
  const pool = [], lakes = [];
  for (const s0 of starts) {
    let u = s0 % MW + .5, v = ((s0 / MW) | 0) + .5, du = 0, dv = 0; const pts = [];
    for (let step = 0; step < 700; step++) {
      pts.push([u, v]);
      if (sdAt(u, v) < -.6) break; // im Meer
      if (step > 12 && pool.some(([x, y]) => Math.abs(x - u) < .8 && Math.abs(y - v) < .8)) break; // Zusammenfluss
      const e = .6, gx = H(u + e, v) - H(u - e, v), gy = H(u, v + e) - H(u, v - e), gl = Math.hypot(gx, gy) || 1;
      du = du * .55 - gx / gl * .45; dv = dv * .55 - gy / gl * .45; const dl = Math.hypot(du, dv) || 1;
      u += du / dl * .55; v += dv / dl * .55;
      if (u < 1 || v < 1 || u > MW - 1 || v > MH - 1) break;
    }
    if (pts.length < 14) continue;
    // Kein Weg zum Meer: der Fluss endet in einem See (nur, wenn er nicht in einen anderen mündet)
    const end = pts[pts.length - 1]; if (sdAt(end[0], end[1]) > 1 && !pool.some(([x, y]) => Math.abs(x - end[0]) < 1 && Math.abs(y - end[1]) < 1)) lakes.push(end);
    for (const [x, y] of pts) { pool.push([x, y]); mask[Math.floor(y) * MW + Math.floor(x)] = 1; }
    lines.push(pts);
  }
  for (const pts of lines) {
    let p = pts; for (let it = 0; it < 1; it++) { const q = [p[0]]; for (let k = 0; k < p.length - 1; k++) { const A = p[k], C2 = p[k + 1]; q.push([A[0] * .75 + C2[0] * .25, A[1] * .75 + C2[1] * .25], [A[0] * .25 + C2[0] * .75, A[1] * .25 + C2[1] * .75]); } q.push(p[p.length - 1]); p = q; }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 1; k < p.length; k++) { // stromab breiter: Abschnitt für Abschnitt
      const t = k / p.length, w = 2 + t * 6;
      ctx.strokeStyle = 'rgba(20,26,30,.7)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(p[k - 1][0] * B, p[k - 1][1] * B); ctx.lineTo(p[k][0] * B, p[k][1] * B); ctx.stroke();
    }
    for (let k = 1; k < p.length; k++) {
      const t = k / p.length, w = 2 + t * 6;
      ctx.strokeStyle = 'rgb(' + Math.round(70 - t * 20) + ',' + Math.round(110 - t * 20) + ',' + Math.round(124 - t * 14) + ')'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[k - 1][0] * B, p[k - 1][1] * B); ctx.lineTo(p[k][0] * B, p[k][1] * B); ctx.stroke();
    }
  }
  for (const [x, y] of lakes) { // See: dunkles Wasser mit hellem Saum
    const X = x * B, Y = y * B, r = 2.6 * B;
    ctx.fillStyle = 'rgba(20,26,30,.7)'; ctx.beginPath(); ctx.ellipse(X, Y, r + 2, r * .7 + 2, .3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgb(48,86,98)'; ctx.beginPath(); ctx.ellipse(X, Y, r, r * .7, .3, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(220,232,236,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(X, Y, r * .7, r * .45, .3, 3.6, 5.6); ctx.stroke();
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const cx = Math.floor(x) + i, cy = Math.floor(y) + j; if (cx >= 0 && cy >= 0 && cx < MW && cy < MH && Math.hypot(i, j) < 3) mask[cy * MW + cx] = 1; }
  }
  return mask;
}

/* ---------- Geländezeichen ---------- */
function glyphs(ctx, MAP, seed, landAt, hgtAt, W, H) {
  const marks = [];
  const free = (x, y) => { // nicht auf Siedlung, Namen und Banner der Provinz
    const p = MAP.pid[Math.floor(y / B) * MW + Math.floor(x / B)]; if (p < 0) return false;
    const pr = MAP.provs[p], dx = x / B - pr.x, dy = y / B - pr.y; return !(Math.abs(dx) < 7 && dy > -5 && dy < 9);
  };
  // gleichmäßig verteilte Punkte (Gitter mit Zittern)
  const step = 12;
  for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
    const x = gx + hash(gx, gy, seed + 1) * step, y = gy + hash(gx, gy, seed + 2) * step;
    if (x >= W || y >= H || !landAt(x, y) || !free(x, y)) continue;
    const p = MAP.pid[Math.floor(y / B) * MW + Math.floor(x / B)], b = MAP.provs[p].biome, r = hash(gx, gy, seed + 3);
    const dens = { wald: .78, berg: .5, grenz: .16, sumpf: .32, asch: .26, trocken: .2, kueste: .07 }[b] || 0;
    if (r > dens) continue;
    marks.push({ x, y, b, r: hash(gx, gy, seed + 4), h: hgtAt(x, y) });
  }
  marks.sort((a, b) => a.y - b.y);
  for (const m of marks) {
    const { x, y } = m;
    if (m.b === 'wald' || (m.b === 'grenz' && m.r < .7)) tree(ctx, x, y, 7 + m.r * 4, m.b === 'wald' ? '#22362c' : '#3a4a40');
    else if (m.b === 'berg') mountain(ctx, x, y, 13 + m.r * 9 + m.h * 8);
    else if (m.b === 'grenz') hill(ctx, x, y, 10 + m.r * 5);
    else if (m.b === 'sumpf') { if (m.r < .35) pool(ctx, x, y, 5 + m.r * 6); else reeds(ctx, x, y); }
    else if (m.b === 'asch') { if (m.r < .45) fissure(ctx, x, y, m.r); else crater(ctx, x, y, 4 + m.r * 4); }
    else if (m.b === 'trocken') { if (m.r < .55) dune(ctx, x, y, 8 + m.r * 6); else rock(ctx, x, y); }
    else if (m.b === 'kueste') reeds(ctx, x, y);
  }
}
function tree(c, x, y, s, col) {
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + s * .35, y + 1, s * .55, s * .2, 0, 0, 7); c.fill();
  c.fillStyle = '#2a2018'; c.fillRect(x - .6, y - s * .3, 1.2, s * .35);
  for (let i = 0; i < 3; i++) { const yy = y - s * .25 - i * s * .32, w = s * (.55 - i * .14);
    c.fillStyle = col; c.beginPath(); c.moveTo(x, yy - s * .55); c.lineTo(x + w, yy); c.lineTo(x - w, yy); c.closePath(); c.fill();
    c.fillStyle = 'rgba(190,220,200,.16)'; c.beginPath(); c.moveTo(x, yy - s * .55); c.lineTo(x - w, yy); c.lineTo(x - w * .4, yy); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(240,246,250,.55)'; c.beginPath(); c.moveTo(x, y - s * 1.45); c.lineTo(x + s * .14, y - s * 1.25); c.lineTo(x - s * .14, y - s * 1.25); c.fill();
}
function mountain(c, x, y, s) {
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s * 1.4, y + 2); c.lineTo(x + s * .4, y - s * .4); c.fill();
  c.fillStyle = '#6d6862'; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s * .05, y - s * 1.1); c.lineTo(x + s, y); c.closePath(); c.fill();
  c.fillStyle = '#4a4642'; c.beginPath(); c.moveTo(x - s * .05, y - s * 1.1); c.lineTo(x + s, y); c.lineTo(x + s * .2, y); c.lineTo(x + s * .12, y - s * .5); c.closePath(); c.fill();
  c.fillStyle = '#eef3f6'; c.beginPath(); c.moveTo(x - s * .05, y - s * 1.1); c.lineTo(x - s * .36, y - s * .74); c.lineTo(x - s * .16, y - s * .8); c.lineTo(x - s * .02, y - s * .66); c.lineTo(x + s * .16, y - s * .82); c.lineTo(x + s * .3, y - s * .74); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(20,18,16,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s * .05, y - s * 1.1); c.lineTo(x + s, y); c.stroke();
}
function hill(c, x, y, s) { c.strokeStyle = 'rgba(30,34,36,.5)'; c.lineWidth = 1.1; c.beginPath(); c.arc(x, y + s * .4, s * .7, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.strokeStyle = 'rgba(235,240,244,.25)'; c.beginPath(); c.arc(x - 1, y + s * .4 - 1, s * .7, Math.PI * 1.2, Math.PI * 1.45); c.stroke(); }
function pool(c, x, y, s) { c.fillStyle = 'rgba(28,44,46,.85)'; c.beginPath(); c.ellipse(x, y, s, s * .42, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(160,190,180,.35)'; c.lineWidth = .8; c.beginPath(); c.ellipse(x - s * .2, y - s * .08, s * .5, s * .14, 0, Math.PI, Math.PI * 2); c.stroke(); }
function reeds(c, x, y) { c.strokeStyle = 'rgba(40,52,34,.8)'; c.lineWidth = 1; c.beginPath(); for (const [dx, h] of [[-2.5, 5], [0, 7], [2.5, 5.5]]) { c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + .5, y - h * .6, x + dx * 1.4, y - h); } c.stroke(); }
function fissure(c, x, y, r) { c.strokeStyle = 'rgba(255,120,50,' + (.45 + r * .4) + ')'; c.lineWidth = 1.2; c.shadowColor = 'rgba(255,90,30,.9)'; c.shadowBlur = 5; c.beginPath(); c.moveTo(x - 5, y + 1); c.lineTo(x - 1, y - 1); c.lineTo(x + 2, y + 1.5); c.lineTo(x + 6, y - .5); c.stroke(); c.shadowBlur = 0; }
function crater(c, x, y, s) { c.fillStyle = 'rgba(20,16,15,.55)'; c.beginPath(); c.ellipse(x, y, s, s * .45, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(180,160,150,.3)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y + .5, s, s * .45, 0, 0, Math.PI); c.stroke(); }
function dune(c, x, y, s) { c.strokeStyle = 'rgba(90,64,36,.45)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s * .2, y - s * .45, x + s, y); c.stroke(); c.strokeStyle = 'rgba(255,236,190,.25)'; c.beginPath(); c.moveTo(x - s, y - 1); c.quadraticCurveTo(x - s * .4, y - s * .4, x, y - s * .3); c.stroke(); }
function rock(c, x, y) { c.fillStyle = 'rgba(70,60,48,.8)'; c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 1.5, y - 3); c.lineTo(x + 2, y - 2.5); c.lineTo(x + 3, y); c.closePath(); c.fill(); }

/* ---------- Reiche: Färbung und leuchtende Grenzen ---------- */
export function paintOwners(MAP, owner, colors) {
  const W = MW * B, H = MH * B, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const own = i => { const p = MAP.pid[i]; return p >= 0 ? owner(p) : null; };
  // Fläche: zarte Tönung
  const t = document.createElement('canvas'); t.width = MW; t.height = MH; const tx = t.getContext('2d'), img = tx.createImageData(MW, MH), d = img.data;
  for (let i = 0; i < MW * MH; i++) { const o = own(i); if (o && colors[o]) { const c3 = rgb(colors[o]); d[i * 4] = c3[0]; d[i * 4 + 1] = c3[1]; d[i * 4 + 2] = c3[2]; d[i * 4 + 3] = 52; } }
  tx.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(t, 0, 0, W, H);
  const edges = test => { x.beginPath(); for (const ch of borderChains(MAP, test)) tracePath(x, ch, B, 0, 0); };
  // Provinzgrenzen: feine gepunktete Linien
  x.setLineDash([2, 3]); x.lineWidth = 1.2; x.strokeStyle = 'rgba(20,18,16,.55)'; edges(() => true); x.stroke(); x.setLineDash([]);
  // Reichsgrenzen: Leuchten innen, dann kräftige Linie mit dunklem Rand
  for (const f of Object.keys(colors)) {
    const test = (a, b) => (owner(a) === f) !== (owner(b) === f) && (owner(a) === f || owner(b) === f);
    x.save(); x.shadowColor = colors[f]; x.shadowBlur = 12; x.strokeStyle = colors[f]; x.globalAlpha = .55; x.lineWidth = 6; edges(test); x.stroke(); x.restore();
    x.lineWidth = 4.2; x.strokeStyle = 'rgba(10,10,10,.75)'; edges(test); x.stroke();
    x.lineWidth = 2.4; x.strokeStyle = colors[f]; edges(test); x.stroke();
  }
  return c;
}

/* ---------- Grenzen als weiche Linien ---------- */
// Zellkanten zwischen zwei Provinzen, für die test(a, b) gilt, zu Ketten verbinden und mit Chaikin zweimal glätten.
// Ergebnis: Listen von Punkten in Zellkoordinaten; geschlossene Ketten tragen closed = true.
// sea: auch Kanten zum Meer und zum Kartenrand (Nachbar -1)
export function borderChains(MAP, test, sea = false) {
  const segs = [], at = new Map(), key = (x, y) => x * 1000 + y;
  const add = (x1, y1, x2, y2) => { const i = segs.length; segs.push([x1, y1, x2, y2]); for (const k of [key(x1, y1), key(x2, y2)]) { let l = at.get(k); if (!l) at.set(k, l = []); l.push(i); } };
  const pidAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? -1 : MAP.pid[y * MW + x]);
  const ok = (a, b) => a !== b && (sea || (a >= 0 && b >= 0)) && test(a, b);
  for (let y = -1; y < MH; y++) for (let xx = -1; xx < MW; xx++) {
    const a = pidAt(xx, y);
    if (y >= 0 && ok(a, pidAt(xx + 1, y))) add(xx + 1, y, xx + 1, y + 1);
    if (xx >= 0 && ok(a, pidAt(xx, y + 1))) add(xx, y + 1, xx + 1, y + 1);
  }
  const used = new Uint8Array(segs.length), chains = [];
  const next = (px, py) => { const l = at.get(key(px, py)) || []; for (const i of l) if (!used[i]) return i; return -1; };
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1; const [x1, y1, x2, y2] = segs[s0], pts = [[x1, y1], [x2, y2]];
    for (let dir = 0; dir < 2; dir++) { // in beide Richtungen verlängern
      for (;;) {
        const end = dir ? pts[0] : pts[pts.length - 1], i = next(end[0], end[1]); if (i < 0) break;
        used[i] = 1; const g = segs[i], o = g[0] === end[0] && g[1] === end[1] ? [g[2], g[3]] : [g[0], g[1]];
        if (dir) pts.unshift(o); else pts.push(o);
      }
    }
    const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    let p = closed ? pts.slice(0, -1) : pts;
    for (let it = 0; it < 2; it++) { // Chaikin
      const q = []; const n = p.length;
      if (!closed) q.push(p[0]);
      for (let i = 0; i < (closed ? n : n - 1); i++) { const A = p[i], Bp = p[(i + 1) % n]; q.push([A[0] * .75 + Bp[0] * .25, A[1] * .75 + Bp[1] * .25], [A[0] * .25 + Bp[0] * .75, A[1] * .25 + Bp[1] * .75]); }
      if (!closed) q.push(p[n - 1]);
      p = q;
    }
    p.closed = closed; chains.push(p);
  }
  return chains;
}
export function tracePath(c, pts, k, ox, oy) {
  c.moveTo(ox + pts[0][0] * k, oy + pts[0][1] * k);
  for (let i = 1; i < pts.length; i++) c.lineTo(ox + pts[i][0] * k, oy + pts[i][1] * k);
  if (pts.closed) c.closePath();
}

/* ---------- Siedlungen: von der Hütte zur Festung ---------- */
// x, y: Mittelpunkt der Grundlinie; k: Maßstab; col: Dachfarbe des Besitzers (grau ohne Besitzer)
export function settlement(c, x, y, lvl, col, k, cap, walls) {
  const house = (hx, hy, w, h, roof) => {
    c.fillStyle = '#d9cfbd'; c.fillRect(hx - w / 2, hy - h, w, h);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(hx + w * .1, hy - h, w * .4, h);
    c.fillStyle = roof; c.beginPath(); c.moveTo(hx - w / 2 - w * .12, hy - h); c.lineTo(hx, hy - h - w * .65); c.lineTo(hx + w / 2 + w * .12, hy - h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(10,10,10,.85)'; c.lineWidth = Math.max(1, k * .9); c.strokeRect(hx - w / 2, hy - h, w, h); c.stroke();
    c.fillStyle = 'rgba(255,200,110,.95)'; c.fillRect(hx - w * .12, hy - h * .55, w * .24, h * .26);
  };
  const tower = (tx, ty, w, h, roof) => {
    c.fillStyle = '#c9c1b2'; c.fillRect(tx - w / 2, ty - h, w, h); c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(tx, ty - h, w / 2, h);
    for (let i = 0; i < 3; i++) c.fillRect(tx - w / 2 + i * w / 2.5, ty - h - w * .22, w / 5, w * .22);
    c.fillStyle = roof; c.beginPath(); c.moveTo(tx - w * .6, ty - h - w * .2); c.lineTo(tx, ty - h - w * 1.1); c.lineTo(tx + w * .6, ty - h - w * .2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(10,10,10,.85)'; c.lineWidth = Math.max(1, k * .9); c.strokeRect(tx - w / 2, ty - h, w, h); c.stroke();
  };
  c.save();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 2 * k, y + 1.5 * k, (7 + lvl * 3) * k, (2.5 + lvl) * k, 0, 0, 7); c.fill();
  if (walls || lvl >= 5) { c.strokeStyle = '#bfb6a6'; c.lineWidth = 3 * k; c.beginPath(); c.ellipse(x, y - 2 * k, (9 + lvl * 2.6) * k, (4 + lvl * 1.2) * k, 0, 0, 7); c.stroke(); c.strokeStyle = 'rgba(10,10,10,.8)'; c.lineWidth = 1; c.stroke(); }
  const w = 7 * k, h = 6 * k;
  if (lvl >= 3 || cap) tower(x, y - 2 * k, 6 * k, (12 + lvl * 2) * k, col);
  if (lvl >= 2) house(x - 8 * k, y, w, h, col);
  if (lvl >= 1) house(x + (lvl >= 2 ? 7 : 0) * k, y + (lvl >= 2 ? 1 : 0) * k, w, h, col);
  if (lvl >= 4) { house(x - 14 * k, y + 2 * k, w * .9, h * .9, col); house(x + 14 * k, y + 2 * k, w * .9, h * .9, col); }
  if (cap) { // Banner auf dem Turm
    const ty = y - (14 + lvl * 2 + 8) * k - 2 * k; c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.2 * k; c.beginPath(); c.moveTo(x, ty + 6 * k); c.lineTo(x, ty - 6 * k); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(x, ty - 6 * k); c.lineTo(x + 8 * k, ty - 3.5 * k); c.lineTo(x, ty - 1 * k); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

/* ---------- Rahmen, Windrose, Titel ---------- */
export function paintFrame(c, x0, y0, w, h, k) {
  c.save();
  // Vignette
  const g = c.createRadialGradient(x0 + w / 2, y0 + h / 2, Math.min(w, h) * .35, x0 + w / 2, y0 + h / 2, Math.max(w, h) * .72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(x0, y0, w, h);
  // doppelte Messinglinie
  c.strokeStyle = 'rgba(210,160,90,.85)'; c.lineWidth = 2 * k; c.strokeRect(x0 + 6 * k, y0 + 6 * k, w - 12 * k, h - 12 * k);
  c.strokeStyle = 'rgba(210,160,90,.35)'; c.lineWidth = 1 * k; c.strokeRect(x0 + 11 * k, y0 + 11 * k, w - 22 * k, h - 22 * k);
  for (const [cx, cy] of [[x0 + 6 * k, y0 + 6 * k], [x0 + w - 6 * k, y0 + 6 * k], [x0 + 6 * k, y0 + h - 6 * k], [x0 + w - 6 * k, y0 + h - 6 * k]]) {
    c.fillStyle = '#d2a05a'; c.beginPath(); c.moveTo(cx, cy - 6 * k); c.lineTo(cx + 6 * k, cy); c.lineTo(cx, cy + 6 * k); c.lineTo(cx - 6 * k, cy); c.closePath(); c.fill();
  }
  // Windrose unten rechts im Meer
  const rx = x0 + w - 70 * k, ry = y0 + h - 70 * k, R = 34 * k;
  c.translate(rx, ry);
  c.strokeStyle = 'rgba(210,160,90,.6)'; c.lineWidth = 1 * k; c.beginPath(); c.arc(0, 0, R * .78, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, R * .62, 0, 7); c.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, L = i % 2 ? R * .6 : R;
    c.save(); c.rotate(a); c.fillStyle = i % 2 ? 'rgba(160,120,70,.8)' : 'rgba(230,190,120,.95)'; c.beginPath(); c.moveTo(0, -L); c.lineTo(L * .14, 0); c.lineTo(0, L * .14 - 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(90,64,34,.9)'; c.beginPath(); c.moveTo(0, -L); c.lineTo(-L * .14, 0); c.lineTo(0, 0); c.closePath(); c.fill(); c.restore(); }
  c.fillStyle = '#f2cf8e'; c.font = '700 ' + Math.round(12 * k) + 'px Cinzel, serif'; c.textAlign = 'center'; c.fillText('N', 0, -R - 4 * k);
  c.setTransform(1, 0, 0, 1, 0, 0);
  // Titelkartusche oben rechts (dort liegt Meer)
  c.font = '700 ' + Math.round(26 * k) + 'px Cinzel, serif'; c.textAlign = 'left';
  const tw = c.measureText('ORSA').width, tx = x0 + w - tw - 34 * k, ty = y0 + 20 * k;
  c.fillStyle = 'rgba(12,12,14,.6)'; c.fillRect(tx - 10 * k, ty, tw + 20 * k, 40 * k);
  c.strokeStyle = 'rgba(210,160,90,.7)'; c.lineWidth = 1 * k; c.strokeRect(tx - 10 * k, ty, tw + 20 * k, 40 * k);
  c.fillStyle = '#f2cf8e'; c.fillText('ORSA', tx, ty + 30 * k);
  c.restore();
}
