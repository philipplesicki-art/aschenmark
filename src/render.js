// Darstellung auf Canvas: Gelände, Einheiten und Gebäude je Fraktion, Effekte, Kriegsnebel, Minimap.
import { TS, GW, GH, WW, WH } from './config.js';
import { G, UI, cam, view, rng } from './state.js';
import { FACTIONS, defOf, MAX_HERO_LVL, facOf } from './factions.js';
import { shown } from './commands.js';

let cv = null, ctx = null, mm = null, mctx = null, terr = null, vig = null, vigKey = '';
const fogC = typeof document !== 'undefined' ? document.createElement('canvas') : null;
let fctx = null, fogImg = null;
if (fogC) { fogC.width = GW; fogC.height = GH; fctx = fogC.getContext('2d'); fogImg = fctx.createImageData(GW, GH); }

export function attachCanvases(main, mini) {
  cv = main; ctx = cv.getContext('2d'); mm = mini; mctx = mm.getContext('2d');
}
export function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
  view.dpr = dpr; view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  cv.width = Math.round(view.w * dpr); cv.height = Math.round(view.h * dpr);
}

/* ---------- Effekte (von der Simulation über hooks aufgerufen) ---------- */
export function burst(x, y, n, col, spread) {
  if (!G || G.parts.length > 700) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 20 + Math.random() * 60;
    G.parts.push({ x: x + (Math.random() - .5) * (spread || 4), y: y + (Math.random() - .5) * (spread || 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: .35 + Math.random() * .4, col, sz: 1.5 + Math.random() * 2, g: 60 });
  }
}
export function floatText(x, y, text, col) {
  if (!G || G.floats.length > 40) return;
  G.floats.push({ x: x + (Math.random() - .5) * 10, y, text, col, t: 0, life: .95 });
}
export function shake(a, x, y) {
  if (!G) return;
  const sx = (x - cam.x) * cam.z, sy = (y - cam.y) * cam.z;
  if (sx < -200 || sy < -200 || sx > view.w + 200 || sy > view.h + 200) return;
  G.shakeA = Math.min(9, Math.max(G.shakeA, a)); G.shakeT = .35;
}

/* ---------- Gelände ---------- */
function drawTree(t, x, y, s, dead) {
  t.fillStyle = 'rgba(0,0,0,.28)'; t.beginPath(); t.ellipse(x + 3, y + s * .5, s * .85, s * .38, 0, 0, 7); t.fill();
  if (dead) {
    t.strokeStyle = '#2b2420'; t.lineWidth = 3; t.lineCap = 'round';
    t.beginPath(); t.moveTo(x, y + s * .5); t.lineTo(x, y - s * .9); t.stroke();
    t.lineWidth = 2; t.beginPath();
    t.moveTo(x, y - s * .2); t.lineTo(x - s * .6, y - s * .7); t.moveTo(x, y - s * .45); t.lineTo(x + s * .55, y - s * .95);
    t.moveTo(x, y - s * .7); t.lineTo(x - s * .3, y - s * 1.15); t.stroke();
    return;
  }
  t.fillStyle = '#4a3524'; t.fillRect(x - 2, y - 2, 4, s * .55);
  t.fillStyle = '#1d4723'; t.beginPath(); t.arc(x - s * .3, y - s * .1, s * .55, 0, 7); t.fill();
  t.fillStyle = '#28592b'; t.beginPath(); t.arc(x + s * .3, y - s * .15, s * .55, 0, 7); t.fill();
  t.fillStyle = '#33692f'; t.beginPath(); t.arc(x, y - s * .5, s * .6, 0, 7); t.fill();
  t.fillStyle = 'rgba(190,220,110,.16)'; t.beginPath(); t.arc(x - s * .12, y - s * .65, s * .3, 0, 7); t.fill();
}

export function buildTerrain() {
  const R = rng((G.seed ^ 0x5bd1e995) >>> 0);
  const c = document.createElement('canvas'); c.width = WW; c.height = WH;
  const t = c.getContext('2d');
  t.fillStyle = '#35532c'; t.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 520; i++) {
    const x = R() * WW, y = R() * WH, r = 60 + R() * 190, g = t.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, R() < .5 ? 'rgba(150,170,70,.16)' : 'rgba(10,30,15,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const hqs = [G.ents.find(e => e.type === 'hq' && e.team === 0), G.ents.find(e => e.type === 'hq' && e.team === 1)];
  const a = hqs[0], b = hqs[1];
  const dx = b.x - a.x, dy = b.y - a.y, nl = Math.hypot(dx, dy), nx = -dy / nl * 90, ny = dx / nl * 90;
  const road = () => { t.beginPath(); t.moveTo(a.x, a.y + 10); t.bezierCurveTo(a.x + dx / 3 + nx, a.y + dy / 3 + ny, a.x + dx * 2 / 3 - nx, a.y + dy * 2 / 3 - ny, b.x, b.y + 10); };
  t.lineCap = 'round'; t.lineJoin = 'round';
  road(); t.strokeStyle = 'rgba(60,45,28,.5)'; t.lineWidth = 60; t.stroke();
  road(); t.strokeStyle = 'rgba(140,114,74,.5)'; t.lineWidth = 40; t.stroke();
  // Gelände nach Fraktion: Asche und Glutrisse bei der Aschenhorde, Blumen bei der Grenzwacht.
  for (const h of hqs) {
    if (h.fac === 'asch') {
      const g = t.createRadialGradient(h.x, h.y + 20, 40, h.x, h.y + 20, 300);
      g.addColorStop(0, 'rgba(34,30,28,.9)'); g.addColorStop(.6, 'rgba(48,40,36,.55)'); g.addColorStop(1, 'rgba(48,40,36,0)');
      t.fillStyle = g; t.fillRect(h.x - 310, h.y - 290, 620, 620);
      t.strokeStyle = 'rgba(255,110,40,.35)'; t.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        let x = h.x + (R() - .5) * 420, y = h.y + 20 + (R() - .5) * 360; t.beginPath(); t.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (R() - .5) * 40; y += (R() - .5) * 40; t.lineTo(x, y); }
        t.stroke();
      }
    } else {
      const g = t.createRadialGradient(h.x, h.y + 20, 30, h.x, h.y + 20, 300);
      g.addColorStop(0, 'rgba(140,175,80,.35)'); g.addColorStop(1, 'rgba(140,175,80,0)');
      t.fillStyle = g; t.fillRect(h.x - 310, h.y - 290, 620, 620);
      for (let i = 0; i < 160; i++) {
        const x = h.x + (R() - .5) * 540, y = h.y + 20 + (R() - .5) * 460;
        if (Math.hypot(x - h.x, y - h.y) > 280) continue;
        t.fillStyle = ['#e8e0b0', '#e4a8c8', '#9cc8f0', '#f0d060'][(R() * 4) | 0]; t.fillRect(x, y, 2, 2);
      }
    }
  }
  const dirt = (x, y, r) => { const g = t.createRadialGradient(x, y, r * .3, x, y, r); g.addColorStop(0, 'rgba(120,96,60,.7)'); g.addColorStop(1, 'rgba(120,96,60,0)'); t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const e of G.ents) { if (e.type === 'hq') dirt(e.x, e.y + 20, 150); if (e.kind === 'dep') dirt(e.x, e.y, 72); }
  for (let i = 0; i < 2800; i++) {
    const x = R() * WW, y = R() * WH; t.strokeStyle = R() < .5 ? 'rgba(170,200,90,.35)' : 'rgba(15,40,20,.35)'; t.lineWidth = 1;
    t.beginPath(); t.moveTo(x, y); t.lineTo(x + (R() - .5) * 3, y - 3 - R() * 4); t.stroke();
  }
  const ah = hqs.find(h => h.fac === 'asch');
  for (const tr of G.trees) {
    const dead = ah && Math.hypot(tr.x - ah.x, tr.y - ah.y) < 520 && tr.v < .75;
    drawTree(t, tr.x, tr.y, tr.s, dead);
  }
  terr = c;
}

/* ---------- Einheiten ---------- */
function ring(x, y, r, col, w, a) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = a == null ? 1 : a; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }

function drawUnit(e, sel) {
  const f = facOf(e.fac), col = f.color, dk = f.dark, asch = e.fac === 'asch', r = e.r, x = e.x, y = e.y;
  const bob = e.moving ? Math.sin(G.t * 13 + e.id) * 1.1 : 0, flash = e.hit > 0;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * .7, r * (e.type === 'siege' ? 1.5 : 1.05), r * .5, 0, 0, 7); ctx.fill();
  if (sel) { ctx.strokeStyle = '#9be07c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, y + r * .7, r * 1.55, r * .85, 0, 0, 7); ctx.stroke(); }
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(e.face);
  const body = flash ? '#fff' : col;
  if (e.type === 'cav' && !asch) {
    ctx.fillStyle = flash ? '#fff' : '#6b4a2e'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * .78, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a321e'; ctx.beginPath(); ctx.arc(r * 1.35, 0, r * .4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r * .2, r * .35); ctx.lineTo(r * 2.5, r * .35); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(-r * .1, 0, r * .62, 0, 7); ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#e6c49c'; ctx.beginPath(); ctx.arc(r * .1, 0, r * .3, 0, 7); ctx.fill();
  } else if (e.type === 'cav') {
    ctx.fillStyle = flash ? '#fff' : '#6d6f73'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * .7, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 1.35, 0, r * .45, 0, 7); ctx.fill();
    ctx.fillStyle = '#3d3f43'; ctx.beginPath(); ctx.moveTo(r * 1.3, -r * .35); ctx.lineTo(r * 1.55, -r * .75); ctx.lineTo(r * 1.65, -r * .3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 1.3, r * .35); ctx.lineTo(r * 1.55, r * .75); ctx.lineTo(r * 1.65, r * .3); ctx.fill();
    ctx.fillStyle = '#ffb050'; ctx.fillRect(r * 1.62, -r * .22, 2, 2); ctx.fillRect(r * 1.62, r * .12, 2, 2);
    ctx.strokeStyle = '#6d6f73'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(-r * 2, Math.sin(G.t * 9 + e.id) * 2); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(-r * .05, 0, r * .6, 0, 7); ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = '#cfcab8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(r * .7, r * .8, r * 1.1, -1.2, .1); ctx.stroke();
  } else if (e.type === 'siege' && !asch) {
    ctx.fillStyle = '#4a3a2a'; for (const [wx, wy] of [[-.8, -.95], [.8, -.95], [-.8, .95], [.8, .95]]) { ctx.beginPath(); ctx.arc(r * wx, r * wy, r * .32, 0, 7); ctx.fill(); }
    ctx.fillStyle = flash ? '#fff' : '#7a5636'; ctx.fillRect(-r * 1.5, -r * .35, r * 2.9, r * .7);
    ctx.fillStyle = flash ? '#fff' : '#5f5d53'; ctx.beginPath(); ctx.moveTo(r * 1.4, -r * .5); ctx.lineTo(r * 1.9, 0); ctx.lineTo(r * 1.4, r * .5); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-r * 1.1, -r * .85); ctx.quadraticCurveTo(0, -r * 1.5, r * 1.1, -r * .85); ctx.lineTo(r * 1.1, r * .85); ctx.quadraticCurveTo(0, r * 1.5, -r * 1.1, r * .85); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (e.type === 'siege') {
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const sw = e.cd > 0 && e.cd > e.d.cd - .3 ? 1.1 : 0;
    ctx.save(); ctx.rotate(-sw); ctx.beginPath(); ctx.moveTo(r * .3, r * .95); ctx.lineTo(r * 2.2, r * .5); ctx.stroke();
    ctx.fillStyle = '#3b3a38'; ctx.beginPath(); ctx.arc(r * 2.2, r * .5, r * .42, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = flash ? '#fff' : '#69745c'; ctx.beginPath(); ctx.arc(0, 0, r * 1.0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * .2, -r * .95, r * .4, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-r * .5, -r * .6); ctx.lineTo(r * .3, -r * .1); ctx.moveTo(-r * .5, r * .1); ctx.lineTo(r * .3, r * .6); ctx.stroke();
    ctx.fillStyle = '#7f8873'; ctx.beginPath(); ctx.arc(r * .72, 0, r * .46, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e4d2'; ctx.fillRect(r * 1.05, -r * .28, 2.5, 3); ctx.fillRect(r * 1.05, r * .12, 2.5, 3);
    ctx.fillStyle = '#ffb050'; ctx.fillRect(r * .9, -r * .2, 1.6, 1.6); ctx.fillRect(r * .9, r * .1, 1.6, 1.6);
  } else {
    const big = e.type === 'hero';
    if (big) { // Umhang
      ctx.fillStyle = flash ? '#fff' : (asch ? '#2a1612' : '#12374a'); ctx.beginPath(); ctx.moveTo(-r * .2, -r * .9); ctx.lineTo(-r * 2.2 + Math.sin(G.t * 5 + e.id) * 2, 0); ctx.lineTo(-r * .2, r * .9); ctx.fill();
    }
    if (e.type === 'melee' && !asch) {
      ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r * .3, r * .5); ctx.lineTo(r * 2.5, r * .5); ctx.stroke();
      ctx.fillStyle = '#e8e4d2'; ctx.beginPath(); ctx.moveTo(r * 2.5, r * .5); ctx.lineTo(r * 2.1, r * .2); ctx.lineTo(r * 2.1, r * .8); ctx.fill();
    }
    if (e.type === 'melee' && asch) {
      ctx.strokeStyle = '#c9c4b4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r * .9, r * .6, r * 1.1, -.9, .5); ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : '#2d2a28'; ctx.beginPath(); ctx.arc(r * .1, -r * .85, r * .5, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
    }
    if (e.type === 'ranged') { ctx.strokeStyle = asch ? '#5a4030' : '#8a6238'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(r * .5, 0, r * 1.05, -1.2, 1.2); ctx.stroke(); }
    if (e.type === 'worker') {
      ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 1.6; const sw = e.working ? Math.sin(G.t * 14) * .5 : 0;
      ctx.save(); ctx.rotate(sw); ctx.beginPath(); ctx.moveTo(0, r * .6); ctx.lineTo(r * 1.6, r * .6); ctx.stroke();
      ctx.strokeStyle = '#bdbdb0'; ctx.beginPath(); ctx.moveTo(r * 1.6, r * .1); ctx.lineTo(r * 1.6, r * 1.1); ctx.stroke(); ctx.restore();
    }
    if (big) {
      const glow = asch;
      ctx.strokeStyle = glow ? '#ff9a3c' : '#eee8cf'; ctx.lineWidth = glow ? 3.4 : 2.4; ctx.beginPath(); ctx.moveTo(0, r * .5); ctx.lineTo(r * (glow ? 2.6 : 2.1), r * .5); ctx.stroke();
      if (glow) { ctx.strokeStyle = 'rgba(255,200,120,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, r * .5); ctx.lineTo(r * 2.6, r * .5); ctx.stroke(); }
      ctx.fillStyle = '#d2a64a'; ctx.fillRect(r * .25, r * .1, 2.5, r);
    }
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r * (big ? .95 : .85), 0, 7); ctx.fill();
    ctx.strokeStyle = big ? '#d2a64a' : dk; ctx.lineWidth = big ? 2 : 1.3; ctx.stroke();
    ctx.fillStyle = '#e6c49c'; ctx.beginPath(); ctx.arc(r * .18, 0, r * .42, 0, 7); ctx.fill();
    if (e.type === 'melee' || big) {
      ctx.fillStyle = asch ? '#2d2a28' : dk; ctx.beginPath(); ctx.arc(r * .12, 0, r * .46, Math.PI * .55, Math.PI * 1.45); ctx.fill();
    }
    if (asch && e.type !== 'worker') { // Hörner
      ctx.strokeStyle = '#e8e4d2'; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(r * .1, -r * .4); ctx.quadraticCurveTo(r * .5, -r * .9, r * .2, -r * 1.2);
      ctx.moveTo(r * .1, r * .4); ctx.quadraticCurveTo(r * .5, r * .9, r * .2, r * 1.2); ctx.stroke();
    } else if (!asch && big) {
      ctx.fillStyle = '#f4f0e0'; ctx.beginPath(); ctx.ellipse(-r * .25, 0, r * .5, r * .22, 0, 0, 7); ctx.fill();
    }
    if (e.type === 'worker' && e.carry > 0) { ctx.fillStyle = '#d2a64a'; ctx.beginPath(); ctx.arc(-r * .7, 0, r * .4, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  if (e.buff > 0) ring(x, y + bob, r + 4 + Math.sin(G.t * 8), 'rgba(210,166,74,.85)', 1.4);
  if (e.shield > 0) { ctx.strokeStyle = 'rgba(130,190,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + bob, r + 6, G.t * 2, G.t * 2 + 4.2); ctx.stroke(); }
  if (e.slow > 0 || e.weak > 0) ring(x, y + bob, r + 3, 'rgba(160,90,200,.8)', 1.4);
  if (e.type === 'hero' && asch && Math.random() < .5) burst(x - Math.cos(e.face) * r, y - Math.sin(e.face) * r - 6, 1, '#ff9a3c', 3);
}

/* ---------- Gebäude ---------- */
function flames(x0, y0, w, k) {
  const n = Math.ceil(2 + w / 24 * (1.2 - k));
  for (let i = 0; i < n; i++) {
    const fx = x0 + w * (.15 + .7 * ((i * 0.37 + e_seed(i)) % 1)), ph = G.t * 9 + i * 2.1, h = 9 + Math.sin(ph) * 4;
    ctx.fillStyle = 'rgba(255,120,30,.9)'; ctx.beginPath(); ctx.moveTo(fx - 4, y0 + w * .35); ctx.quadraticCurveTo(fx + Math.sin(ph) * 3, y0 + w * .35 - h * 1.3, fx + 4, y0 + w * .35); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,100,.9)'; ctx.beginPath(); ctx.moveTo(fx - 2, y0 + w * .35); ctx.quadraticCurveTo(fx + Math.sin(ph) * 2, y0 + w * .35 - h * .8, fx + 2, y0 + w * .35); ctx.fill();
  }
  if (Math.random() < .25) burst(x0 + w * Math.random(), y0 + w * .2, 1, 'rgba(70,64,60,.8)', 6);
}
const e_seed = i => ((i * 7919) % 13) / 13;

function drawBld(e, sel) {
  const f = facOf(e.fac), asch = e.fac === 'asch';
  const x0 = e.gx * TS, y0 = e.gy * TS, w = e.size * TS, col = f.color, dk = f.dark;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(e.x + 4, y0 + w - 2, w * .58, w * .2, 0, 0, 7); ctx.fill();
  ctx.save();
  if (!e.built) {
    ctx.strokeStyle = 'rgba(160,125,70,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x0 + 2, y0 + 2, w - 4, w - 4); ctx.setLineDash([]);
    const hh = (w * 1.5 + 8) * e.prog; ctx.beginPath(); ctx.rect(x0 - 14, y0 + w + 8 - hh, w + 28, hh); ctx.clip();
  }
  const fl = e.hit > 0;
  const stone = fl ? '#fff' : (asch ? '#4b4642' : '#8d8a7c'), stoneD = fl ? '#eee' : (asch ? '#2d2a28' : '#5f5d53');
  const wood = fl ? '#fff' : (asch ? '#4a3226' : '#7a5636'), roof = fl ? '#fff' : (asch ? '#8a2f1b' : col);
  const ember = Math.sin(G.t * 7 + e.id) * .15 + .85;
  const brazier = (bx, by) => { ctx.fillStyle = '#1b1812'; ctx.fillRect(bx - 3, by, 6, 5); ctx.fillStyle = 'rgba(255,140,40,' + ember + ')'; ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.quadraticCurveTo(bx, by - 11 - Math.sin(G.t * 11 + bx) * 3, bx + 4, by); ctx.fill(); };
  if (e.type === 'hq') {
    ctx.fillStyle = stoneD; ctx.fillRect(x0 + 2, y0 + w * .2, w - 4, w * .76);
    ctx.fillStyle = stone; ctx.fillRect(x0 + w * .14, y0 + w * .12, w * .72, w * .74);
    ctx.fillStyle = stoneD;
    if (asch) { for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x0 + w * .14 + i * w * .1, y0 + w * .13); ctx.lineTo(x0 + w * .19 + i * w * .1, y0 - w * .02); ctx.lineTo(x0 + w * .24 + i * w * .1, y0 + w * .13); ctx.fill(); } }
    else for (let i = 0; i < 7; i++) ctx.fillRect(x0 + w * .14 + i * w * .1, y0 + w * .06, w * .06, w * .08);
    ctx.fillStyle = '#1b1812'; ctx.beginPath(); ctx.moveTo(e.x - w * .1, y0 + w * .86); ctx.lineTo(e.x - w * .1, y0 + w * .66); ctx.arc(e.x, y0 + w * .66, w * .1, Math.PI, 0); ctx.lineTo(e.x + w * .1, y0 + w * .86); ctx.fill();
    for (const [tx, ty] of [[.14, .2], [.86, .2], [.12, .9], [.88, .9]]) {
      const cx = x0 + w * tx, cy = y0 + w * ty;
      ctx.fillStyle = stoneD; ctx.fillRect(cx - w * .1, cy - w * .18, w * .2, w * .3); ctx.fillStyle = stone; ctx.beginPath(); ctx.arc(cx, cy + w * .1, w * .1, 0, 7); ctx.fill();
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(cx - w * .13, cy - w * .15); ctx.lineTo(cx, cy - w * (asch ? .42 : .34)); ctx.lineTo(cx + w * .13, cy - w * .15); ctx.fill();
    }
    if (asch) { brazier(x0 + w * .3, y0 + w * .62); brazier(x0 + w * .7, y0 + w * .62); }
    ctx.strokeStyle = asch ? '#7a6a5a' : '#d8d0b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, y0 + w * .12); ctx.lineTo(e.x, y0 - w * .28); ctx.stroke();
    ctx.fillStyle = asch ? '#b8381e' : roof; ctx.beginPath(); ctx.moveTo(e.x, y0 - w * .28); ctx.lineTo(e.x + w * .22 + Math.sin(G.t * 3) * 2, y0 - w * .2); ctx.lineTo(e.x, y0 - w * .1); ctx.fill();
  } else if (e.type === 'barracks') {
    ctx.fillStyle = wood; ctx.fillRect(x0 + 4, y0 + w * .32, w - 8, w * .62);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 6; i++) ctx.fillRect(x0 + 4 + i * (w - 8) / 6, y0 + w * .32, 1.5, w * .62);
    ctx.fillStyle = roof; ctx.beginPath();
    if (asch) { ctx.moveTo(x0 - 2, y0 + w * .42); ctx.lineTo(x0 + w * .1, y0 + w * .04); ctx.lineTo(x0 + w * .3, y0 + w * .14); ctx.lineTo(x0 + w * .5, y0 - w * .04); ctx.lineTo(x0 + w * .7, y0 + w * .14); ctx.lineTo(x0 + w * .9, y0 + w * .04); ctx.lineTo(x0 + w + 2, y0 + w * .42); }
    else { ctx.moveTo(x0 - 2, y0 + w * .42); ctx.lineTo(x0 + w * .14, y0); ctx.lineTo(x0 + w * .86, y0); ctx.lineTo(x0 + w + 2, y0 + w * .42); }
    ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1b1812'; ctx.fillRect(e.x - w * .1, y0 + w * .62, w * .2, w * .32);
    ctx.strokeStyle = asch ? '#e0833a' : '#d8d0b0'; ctx.lineWidth = 1.8; ctx.beginPath();
    ctx.moveTo(e.x - w * .16, y0 + w * .14); ctx.lineTo(e.x + w * .16, y0 + w * .32); ctx.moveTo(e.x + w * .16, y0 + w * .14); ctx.lineTo(e.x - w * .16, y0 + w * .32); ctx.stroke();
    if (asch) brazier(x0 + w * .15, y0 + w * .82);
  } else if (e.type === 'workshop') {
    ctx.fillStyle = wood; ctx.fillRect(x0 + 3, y0 + w * .34, w - 6, w * .6);
    ctx.fillStyle = stoneD; ctx.fillRect(x0 + w * .68, y0 - w * .08, w * .2, w * .5);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x0 - 2, y0 + w * .44); ctx.lineTo(x0 + w * .1, y0 + w * .08); ctx.lineTo(x0 + w * .62, y0 + w * .08); ctx.lineTo(x0 + w * .72, y0 + w * .44); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1b1812'; ctx.fillRect(e.x - w * .2, y0 + w * .62, w * .36, w * .32);
    ctx.fillStyle = 'rgba(255,150,50,' + ember + ')'; ctx.fillRect(e.x - w * .16, y0 + w * .68, w * .28, w * .2);
    ctx.fillStyle = 'rgba(80,76,72,.7)'; ctx.beginPath(); ctx.arc(x0 + w * .78 + Math.sin(G.t * 2) * 3, y0 - w * .18 - Math.sin(G.t * 3) * 3, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#bdbdb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0 + w * .22, y0 + w * .75, 6, 0, 7); ctx.stroke();
  } else if (e.type === 'farm') {
    ctx.fillStyle = asch ? '#3a2e24' : '#5b4528'; ctx.fillRect(x0 + 2, y0 + w * .38, w - 4, w * .58);
    if (!asch) for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#a9a24a' : '#6f8a35'; ctx.fillRect(x0 + 6, y0 + w * .44 + i * w * .1, w - 12, w * .06); }
    ctx.strokeStyle = asch ? '#6a5a4a' : '#8a6238'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 2, y0 + w * .38, w - 4, w * .58);
    if (asch) { ctx.fillStyle = '#6a5a4a'; for (let i = 0; i < 8; i++) { const px = x0 + 4 + i * (w - 8) / 7.2; ctx.beginPath(); ctx.moveTo(px - 2, y0 + w * .38); ctx.lineTo(px, y0 + w * .28); ctx.lineTo(px + 2, y0 + w * .38); ctx.fill(); } }
    ctx.fillStyle = wood; ctx.fillRect(x0 + w * .1, y0 + w * .12, w * .38, w * .3);
    ctx.fillStyle = fl ? '#fff' : (asch ? '#6a5040' : '#c9a44a'); ctx.beginPath(); ctx.moveTo(x0 + w * .04, y0 + w * .2); ctx.lineTo(x0 + w * .29, y0 - w * .04); ctx.lineTo(x0 + w * .54, y0 + w * .2); ctx.fill();
    ctx.fillStyle = roof; ctx.fillRect(x0 + w * .7, y0 + w * .16, w * .18, w * .12);
    ctx.strokeStyle = '#d8d0b0'; ctx.beginPath(); ctx.moveTo(x0 + w * .7, y0 + w * .04); ctx.lineTo(x0 + w * .7, y0 + w * .3); ctx.stroke();
  } else if (e.type === 'lumber') { // Holzlager: Stapel und Sägebock unter einem Schleppdach
    ctx.fillStyle = asch ? '#3a2e24' : '#5b4528'; ctx.fillRect(x0 + 2, y0 + w * .5, w - 4, w * .46);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#8a6238' : '#6f4c2a'; ctx.fillRect(x0 + 6, y0 + w * .56 + i * w * .1, w * .6, w * .07); }
    ctx.fillStyle = wood; ctx.fillRect(x0 + w * .64, y0 + w * .46, w * .3, w * .4);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x0 + w * .58, y0 + w * .5); ctx.lineTo(x0 + w * .79, y0 + w * .22); ctx.lineTo(x0 + w, y0 + w * .5); ctx.fill();
  } else if (e.type === 'market') { // Markt: Stände mit Sonnensegel
    ctx.fillStyle = wood; ctx.fillRect(x0 + 3, y0 + w * .46, w - 6, w * .5);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? roof : (fl ? '#fff' : '#d8d0b0'); ctx.fillRect(x0 + 3 + i * (w - 6) / 4, y0 + w * .26, (w - 6) / 4, w * .26); }
    ctx.fillStyle = '#c9a44a'; for (let i = 0; i < 3; i++) ctx.fillRect(x0 + w * (.18 + i * .28), y0 + w * .62, w * .12, w * .1);
    ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.strokeRect(x0 + 3, y0 + w * .26, w - 6, w * .7);
  } else if (e.type === 'tower') {
    ctx.fillStyle = stoneD; ctx.fillRect(x0 + 5, y0 - 26, w - 10, w + 22); ctx.fillStyle = stone; ctx.fillRect(x0 + 8, y0 - 26, w - 18, w + 22);
    ctx.fillStyle = stoneD;
    if (asch) { for (let i = 0; i < 3; i++) { const px = x0 + 7 + i * 9; ctx.beginPath(); ctx.moveTo(px, y0 - 26); ctx.lineTo(px + 3, y0 - 40); ctx.lineTo(px + 6, y0 - 26); ctx.fill(); } brazier(e.x, y0 - 36); }
    else for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 5 + i * (w - 14) / 2.4, y0 - 34, 6, 9);
    ctx.fillStyle = '#1b1812'; ctx.fillRect(e.x - 2, y0 - 8, 4, 9);
    if (!asch) { ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(e.x, y0 - 34); ctx.lineTo(e.x + 14 + Math.sin(G.t * 3) * 1.5, y0 - 30); ctx.lineTo(e.x, y0 - 26); ctx.fill(); }
  }
  ctx.restore();
  if (e.built && e.hp < e.maxhp * .5 && e.type !== 'tower') flames(x0, y0, w, e.hp / e.maxhp * 2);
  if (sel) {
    ctx.strokeStyle = '#9be07c'; ctx.lineWidth = 1.8; ctx.strokeRect(x0 - 3, y0 - 3, w + 6, w + 6);
    if (e.type === 'tower') { ctx.setLineDash([5, 5]); ring(e.x, e.y, e.d.rng, 'rgba(155,224,124,.5)', 1); ctx.setLineDash([]); }
    if (e.rally) { ctx.strokeStyle = 'rgba(155,224,124,.6)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rally.x, e.rally.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#9be07c'; ctx.fillRect(e.rally.x - 1, e.rally.y - 14, 2, 14); ctx.fillRect(e.rally.x, e.rally.y - 14, 9, 6); }
  }
}

function drawDep(e, sel) {
  const k = .6 + .4 * e.amt / e.max, x = e.x, y = e.y;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + TS * .6, TS * .9 * k, TS * .35, 0, 0, 7); ctx.fill();
  for (const [dx, dy, s, c] of [[-.5, .1, .5, '#6c6a62'], [.45, .15, .45, '#7b786d'], [0, -.25, .62, '#8a877a'], [-.1, .35, .4, '#5d5b54']]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + dx * TS * k, y + dy * TS * k, TS * .55 * s * k + 4, TS * .45 * s * k + 3, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#d2a64a';
  for (const [dx, dy] of [[-.45, .05], [.1, -.3], [.5, .1], [-.05, .3], [.25, .25]]) { ctx.beginPath(); ctx.arc(x + dx * TS * k, y + dy * TS * k, 2.6, 0, 7); ctx.fill(); }
  if (sel) { ctx.strokeStyle = '#9be07c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, y + 4, TS * 1.1, TS * .8, 0, 0, 7); ctx.stroke(); }
}

function drawBars(e, sel) {
  if (e.kind === 'dep') return;
  if (e.hp >= e.maxhp && !sel && e.built !== false) return;
  const w = e.kind === 'bld' ? Math.min(60, e.size * TS) : (e.type === 'siege' ? 34 : 26), x = e.x - w / 2;
  const y = e.kind === 'bld' ? e.gy * TS - (e.type === 'tower' ? 40 : 10) : e.y - e.r - 9;
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
  const fr = e.hp / e.maxhp; ctx.fillStyle = fr > .5 ? '#8cc674' : fr > .25 ? '#e0b94a' : '#e8694d'; ctx.fillRect(x, y, w * fr, 3);
  if (e.type === 'hero') { for (let i = 0; i < MAX_HERO_LVL; i++) { ctx.fillStyle = i < e.lvl ? '#d2a64a' : 'rgba(0,0,0,.6)'; ctx.fillRect(x + i * 6, y - 5, 4, 3); } }
}

/* ---------- Hauptzeichnung ---------- */
function updateFx(dt) {
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 60) * dt; }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const f of G.floats) { f.t += dt; f.y -= 22 * dt; }
  G.floats = G.floats.filter(f => f.t < f.life);
  if (G.shakeT > 0) { G.shakeT -= dt; if (G.shakeT <= 0) G.shakeA = 0; }
  // Glut in der Luft über der Aschenfeste
  const ah = G.ents.find(e => e.type === 'hq' && e.fac === 'asch' && !e.dead);
  if (ah && Math.random() < dt * 14) G.parts.push({ x: ah.x + (Math.random() - .5) * 380, y: ah.y + (Math.random() - .5) * 280 + 60, vx: (Math.random() - .5) * 8, vy: -14 - Math.random() * 14, t: 0, life: 2 + Math.random(), col: Math.random() < .5 ? '#ff8a3a' : '#c0501e', sz: 1.5, g: -2 });
}

function updateFogImage() {
  if (!G.fogDirty) return;
  G.fogDirty = false;
  const f = G.fog, d = fogImg.data;
  for (let i = 0; i < f.length; i++) { d[i * 4] = 6; d[i * 4 + 1] = 9; d[i * 4 + 2] = 6; d[i * 4 + 3] = f[i] === 0 ? 238 : f[i] === 1 ? 125 : 0; }
  fctx.putImageData(fogImg, 0, 0);
}

export function render(dt, selSet) {
  const W = cv.width, H = cv.height, dpr = view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d0a'; ctx.fillRect(0, 0, W, H);
  if (!G || !terr) return;
  updateFx(dt); updateFogImage();
  const z = cam.z * dpr;
  const sh = G.shakeT > 0 ? G.shakeA * (G.shakeT / .35) : 0;
  const ox = sh ? (Math.random() - .5) * sh : 0, oy = sh ? (Math.random() - .5) * sh : 0;
  ctx.setTransform(z, 0, 0, z, (-cam.x + ox) * z, (-cam.y + oy) * z);
  ctx.drawImage(terr, 0, 0);
  const vx0 = cam.x - 140, vy0 = cam.y - 140, vx1 = cam.x + view.w / cam.z + 140, vy1 = cam.y + view.h / cam.z + 140;

  for (const c of G.corpses) {
    if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
    const k = 1 - c.t / c.life;
    ctx.globalAlpha = Math.min(1, k * 1.4) * (c.kind === 'ruin' ? .8 : .7);
    if (c.kind === 'ruin') {
      ctx.fillStyle = c.fac === 'asch' ? '#2d2724' : '#6a6458';
      for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = c.size * TS * .3 * ((i % 3) + 1) / 2; ctx.beginPath(); ctx.ellipse(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * .6, 7 + (i % 3) * 3, 5 + (i % 2) * 3, a, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = '#16120e'; ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * .4, c.r * 1.2, c.r * .55, c.face, 0, 7); ctx.fill();
      ctx.fillStyle = facOf(c.fac).color; ctx.beginPath(); ctx.arc(c.x, c.y + c.r * .3, c.r * .35, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const zn of G.zones) {
    const k = zn.t / zn.dur, pulse = .5 + .5 * Math.sin(G.t * 6);
    if (zn.type === 'spring') {
      const g = ctx.createRadialGradient(zn.x, zn.y, 0, zn.x, zn.y, zn.r); g.addColorStop(0, 'rgba(130,230,255,.35)'); g.addColorStop(1, 'rgba(130,230,255,.06)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.r, 0, 7); ctx.fill(); ring(zn.x, zn.y, zn.r * (.9 + .1 * pulse), 'rgba(160,240,255,.8)', 2, 1 - k * .6);
    } else {
      ring(zn.x, zn.y, zn.r, 'rgba(255,140,50,.8)', 2, .5 + .3 * pulse); ctx.fillStyle = 'rgba(255,100,30,.08)'; ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.r, 0, 7); ctx.fill();
    }
  }
  for (const m of G.marks) {
    const k = m.t / (m.life || .6);
    if (m.kind === 'cry') { ring(m.x, m.y, 20 + k * 230, 'rgba(210,166,74,1)', 3, 1 - k); continue; }
    if (m.kind === 'wall') { ring(m.x, m.y, 20 + k * 200, 'rgba(130,190,255,1)', 3, 1 - k); continue; }
    if (m.kind === 'dread') { ring(m.x, m.y, 20 + k * 220, 'rgba(160,90,200,1)', 3, 1 - k); continue; }
    if (m.kind === 'blast') { ctx.fillStyle = 'rgba(255,150,60,' + (.5 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(m.x, m.y, (m.r || 60) * (.4 + k * .6), 0, 7); ctx.fill(); ring(m.x, m.y, (m.r || 60) * (.4 + k * .6), 'rgba(255,220,140,1)', 2, 1 - k); continue; }
    ctx.strokeStyle = (m.kind === 'atk' ? 'rgba(232,105,77,' : 'rgba(155,224,124,') + (1 - k) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(m.x, m.y, 6 + k * 14, 3 + k * 7, 0, 0, 7); ctx.stroke();
  }

  const list = [];
  for (const e of G.ents) { if (e.dead || e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1 || !shown(e)) continue; list.push(e); }
  list.sort((a, b) => (a.kind === 'unit' ? a.y : a.gy * TS + a.size * TS) - (b.kind === 'unit' ? b.y : b.gy * TS + b.size * TS));
  for (const e of list) { const s = selSet.has(e.id); if (e.kind === 'unit') drawUnit(e, s); else if (e.kind === 'bld') drawBld(e, s); else drawDep(e, s); }
  for (const e of list) drawBars(e, selSet.has(e.id));

  ctx.lineCap = 'round';
  for (const p of G.projs) {
    const fire = p.fire;
    ctx.strokeStyle = fire ? '#ffb060' : (p.team === 0 ? '#dff1fa' : '#ffd0b0'); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 2); ctx.lineTo(p.x - (p.vx || 0) * 10, p.y - 2 - (p.vy || 0) * 10); ctx.stroke();
    if (fire) { ctx.fillStyle = 'rgba(255,150,50,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 2.2, 0, 7); ctx.fill(); }
  }
  for (const p of G.parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true; ctx.drawImage(fogC, 0, 0, WW, WH);

  ctx.font = '700 13px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center';
  for (const f of G.floats) { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';

  if (UI.mode === 'place' && UI.place && UI.place.has) {
    const s = defOf(G.fac[0], UI.place.type).size * TS;
    ctx.fillStyle = UI.place.ok ? 'rgba(155,224,124,.35)' : 'rgba(232,105,77,.4)'; ctx.fillRect(UI.place.gx * TS, UI.place.gy * TS, s, s);
    ctx.strokeStyle = UI.place.ok ? '#9be07c' : '#e8694d'; ctx.lineWidth = 2; ctx.strokeRect(UI.place.gx * TS, UI.place.gy * TS, s, s);
  }
  if (UI.mode === 'target' && UI.target && UI.mx !== undefined) {
    const wx = UI.mx / cam.z + cam.x, wy = UI.my / cam.z + cam.y;
    let rad = 80, rng = 0, hero = null;
    if (UI.target.kind === 'power') { const p = FACTIONS[G.fac[0]].power; rad = p.radius; }
    else { hero = G.map.get(UI.target.hero); const a = hero && FACTIONS[hero.fac].abilities[UI.target.i]; if (a) { rad = a.radius; rng = a.range; } }
    if (hero && rng) { ctx.setLineDash([6, 6]); ring(hero.x, hero.y, rng, 'rgba(255,255,255,.4)', 1.2); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(255,170,70,.18)'; ctx.beginPath(); ctx.arc(wx, wy, rad, 0, 7); ctx.fill(); ring(wx, wy, rad, 'rgba(255,200,120,.9)', 2);
  }

  // Bildschirmraum: Vignette, Auswahlrahmen, Hinweise
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const key = view.w + 'x' + view.h;
  if (vigKey !== key) {
    vigKey = key; vig = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * .35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * .75);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.42)');
  }
  ctx.fillStyle = vig; ctx.fillRect(0, 0, view.w, view.h);
  if (UI.drag && UI.drag.active) {
    const d = UI.drag, x = Math.min(d.sx, d.x), y = Math.min(d.sy, d.y), w = Math.abs(d.x - d.sx), h = Math.abs(d.y - d.sy);
    ctx.fillStyle = 'rgba(155,224,124,.12)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#9be07c'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w, h);
  }
  const hint = UI.mode === 'amove' ? 'Angriffsmarsch: Ziel wählen' : UI.mode === 'target' ? 'Ziel wählen' : '';
  if (hint) { ctx.fillStyle = 'rgba(15,18,14,.8)'; ctx.fillRect(view.w / 2 - 95, view.h - 34, 190, 24); ctx.fillStyle = '#e8694d'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hint, view.w / 2, view.h - 17); ctx.textAlign = 'start'; }
}

export function drawMini() {
  if (!G || !terr) return;
  const W = mm.width, H = mm.height, sx = W / WW, sy = H / WH;
  mctx.drawImage(terr, 0, 0, W, H);
  for (const e of G.ents) {
    if (e.dead || !shown(e)) continue;
    if (e.kind === 'dep') { mctx.fillStyle = '#d2a64a'; mctx.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4); continue; }
    mctx.fillStyle = facOf(e.fac).color; const s = e.kind === 'bld' ? 4 : 2.2; mctx.fillRect(e.x * sx - s / 2, e.y * sy - s / 2, s, s);
  }
  mctx.imageSmoothingEnabled = true; mctx.drawImage(fogC, 0, 0, W, H);
  mctx.strokeStyle = '#e8e4d2'; mctx.lineWidth = 1; mctx.strokeRect(cam.x * sx + .5, cam.y * sy + .5, view.w / cam.z * sx, view.h / cam.z * sy);
}
