// Prozedurale 3D-Modelle (nur Three.js-Grundformen, nichts Zugekauftes). Maßstab: 1 Einheit = 16 Weltpixel, +X ist vorne.
// Look: gedämpfte, kalte Farben, schwere Mäntel, Eis und Ruß, dazu warmes Licht aus Fenstern, Schmieden und Feuerkörben.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/* ---------- Material- und Formcache ---------- */
const mats = new Map();
export function mat(hex, o = {}) {
  const k = hex + JSON.stringify(o);
  let m = mats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: .85, metalness: 0, ...o }); mats.set(k, m); }
  return m;
}
const glowM = (hex, i = 2) => mat(hex, { emissive: hex, emissiveIntensity: i, roughness: .5 });
const geos = new Map();
// Jede Form bekommt Box-Projektion als UV (1 Einheit = 1 Kachel), damit Texturen auf allen Teilen gleich dicht sitzen.
function boxUV(g) {
  const p = g.attributes.position, n = g.attributes.normal; if (!p || !n) return g;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
function geo(key, make) { let g = geos.get(key); if (!g) { g = boxUV(make()); geos.set(key, g); } return g; }
// Größere Kästen (Mauern, Balken, Bretter) bekommen leicht gerundete Kanten, die im Licht eine Kante zeigen.
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => { const mn = Math.min(w, h, d), mx = Math.max(w, h, d); return mn >= .12 && mx >= .5 ? new RoundedBoxGeometry(w, h, d, 1, Math.min(.045, mn * .2)) : new THREE.BoxGeometry(w, h, d); });
const cyl = (rt, rb, h, s = 10) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 10) => geo(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sph = (r, w = 12, h = 9) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const tor = (r, t, a = Math.PI * 2) => geo(`t${r},${t},${a}`, () => new THREE.TorusGeometry(r, t, 6, 18, a));
// Satteldach: Breite w (quer), Höhe h, Länge L (entlang X).
const roofG = (w, h, L) => geo(`r${w},${h},${L}`, () => {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-L / 2, 0, 0); return g;
});

function part(parent, g, m, x = 0, y = 0, z = 0, shadow = false) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }


/* ---------- Oberflächen: Mauerwerk, Bretter, Schindeln, Eisenplatten, Schnee (alles im Code gezeichnet) ---------- */
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvasTex(draw, size = 256, rep = 1) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size, prng(size * 7 + draw.length));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Normal-Map aus der Helligkeit einer gezeichneten Textur (dunkel = tief, etwa Mörtelfugen). Sobel-Filter, kachelbar.
const normals = new Map();
function normalOf(tex, strength = 1.5) {
  if (!tex || !tex.image) return null;
  const k = tex.uuid + strength; if (normals.has(k)) return normals.get(k);
  let out = null;
  try {
    const src = tex.image, S = src.width, sx = src.getContext('2d');
    const d = sx.getImageData(0, 0, S, S).data, c = document.createElement('canvas'); c.width = c.height = S;
    const cx = c.getContext('2d'), img = cx.createImageData(S, S), o = img.data;
    const h = (x, y) => { const i = (((y + S) % S) * S + ((x + S) % S)) * 4; return (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1)) * strength;
      const dy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      o[i] = (-dx / l * .5 + .5) * 255; o[i + 1] = (dy / l * .5 + .5) * 255; o[i + 2] = (1 / l * .5 + .5) * 255; o[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    out = new THREE.CanvasTexture(c); out.wrapS = out.wrapT = THREE.RepeatWrapping; out.repeat.copy(tex.repeat); out.anisotropy = 4;
  } catch (_) { out = null; } // ohne echtes Canvas (Tests) bleibt es bei der Farbtextur
  normals.set(k, out); return out;
}
function grime(x, S, R, n, a) { for (let i = 0; i < n; i++) { const px = R() * S, py = R() * S, r = 6 + R() * 40, g = x.createRadialGradient(px, py, 0, px, py, r), v = R() < .6 ? 30 : 255; g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } }
function speck(x, S, R, n) { for (let i = 0; i < n; i++) { const v = 120 + R() * 135 | 0; x.fillStyle = `rgba(${v},${v},${v},.25)`; x.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2); } }
const SURF = {};
function surfaces() {
  if (SURF.stone !== undefined) return SURF;
  SURF.stone = canvasTex((x, S, R) => { // Bruchsteinmauer
    x.fillStyle = '#3a3a3c'; x.fillRect(0, 0, S, S);
    const rows = 8, rh = S / rows;
    for (let r = 0; r < rows; r++) { let px = -R() * 30; while (px < S) { const w = 26 + R() * 38, v = 170 + R() * 70 | 0; x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(px + 2, r * rh + 2, w - 4, rh - 4); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 2, r * rh + 2, w - 4, 2); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(px + 2, r * rh + rh - 5, w - 4, 3); px += w; } }
    grime(x, S, R, 60, .18); speck(x, S, R, 900);
  }, 256, .8);
  SURF.planks = canvasTex((x, S, R) => { // senkrechte Bretter mit Maserung
    const n = 8, w = S / n;
    for (let i = 0; i < n; i++) { const v = 150 + R() * 70 | 0; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`; x.fillRect(i * w, 0, w, S);
      for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(40,30,20,${.12 + R() * .18})`; x.lineWidth = 1; x.beginPath(); const gx = i * w + R() * w; x.moveTo(gx, 0); x.bezierCurveTo(gx + R() * 6 - 3, S * .3, gx + R() * 6 - 3, S * .7, gx + R() * 4 - 2, S); x.stroke(); }
      x.fillStyle = 'rgba(15,10,6,.85)'; x.fillRect(i * w, 0, 2.5, S);
      for (const y of [S * .1, S * .9]) { x.fillStyle = 'rgba(30,30,32,.9)'; x.fillRect(i * w + w / 2 - 2, y, 4, 4); } }
    grime(x, S, R, 40, .16);
  }, 256, .7);
  SURF.shingles = canvasTex((x, S, R) => { // Dachschindeln, versetzt
    x.fillStyle = '#2a2a2c'; x.fillRect(0, 0, S, S);
    const rows = 10, rh = S / rows, cw = S / 8;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 9; i++) { const v = 150 + R() * 80 | 0, px = i * cw + (r % 2) * cw / 2; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.beginPath(); x.moveTo(px + 1, r * rh); x.lineTo(px + cw - 1, r * rh); x.lineTo(px + cw - 1, r * rh + rh - 3); x.quadraticCurveTo(px + cw / 2, r * rh + rh + 1, px + 1, r * rh + rh - 3); x.fill(); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px + 1, r * rh + rh - 4, cw - 2, 2); }
    grime(x, S, R, 50, .2);
  }, 256, .85);
  SURF.plates = canvasTex((x, S, R) => { // genietete Eisenplatten mit Rostläufern
    const n = 2, w = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 150 + R() * 60 | 0; x.fillStyle = `rgb(${v},${v},${v + 3})`; x.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
      x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(i * w, j * w, w, 2); x.fillRect(i * w, j * w, 2, w);
      for (let k = 0; k < 8; k++) for (const [a, b] of [[k * w / 8 + 6, 7], [k * w / 8 + 6, w - 8], [7, k * w / 8 + 6], [w - 8, k * w / 8 + 6]]) { x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.arc(i * w + a, j * w + b, 2.2, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.arc(i * w + a + .8, j * w + b + .8, 1.4, 0, 7); x.fill(); } }
    for (let k = 0; k < 14; k++) { const px = R() * S, py = R() * S, g = x.createLinearGradient(px, py, px, py + 70); g.addColorStop(0, 'rgba(120,60,30,.35)'); g.addColorStop(1, 'rgba(120,60,30,0)'); x.fillStyle = g; x.fillRect(px, py, 3 + R() * 5, 70); }
    grime(x, S, R, 40, .2);
  }, 256, .5);
  SURF.snow = canvasTex((x, S, R) => { x.fillStyle = '#e8edf2'; x.fillRect(0, 0, S, S); grime(x, S, R, 120, .07); for (let i = 0; i < 500; i++) { x.fillStyle = R() < .5 ? 'rgba(255,255,255,.7)' : 'rgba(150,170,195,.25)'; x.fillRect(R() * S, R() * S, 1.5, 1.5); } }, 128, .8);
  SURF.rough = canvasTex((x, S, R) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, S, S); grime(x, S, R, 140, .22); speck(x, S, R, 1500); }, 128, 1);
  // Feine Detailtexturen für Figuren: Gewebe (Stoff, Leder, Haut) und gehämmertes, zerkratztes Metall
  SURF.cloth = canvasTex((x, S, R) => {
    x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 4) { x.fillStyle = `rgba(0,0,0,${.025 + R() * .03})`; x.fillRect(0, i, S, 2); x.fillStyle = `rgba(0,0,0,${.02 + R() * .025})`; x.fillRect(i + 2, 0, 1.5, S); }
    grime(x, S, R, 50, .1); speck(x, S, R, 400);
  }, 128, 8);
  SURF.fur = canvasTex((x, S, R) => { // Fell: kurze, gerichtete Striche, dazwischen dunkle Tiefe
    x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, S, S); x.lineCap = 'round';
    for (let i = 0; i < 2600; i++) { const px = R() * S, py = R() * S, l = 3 + R() * 7, a = Math.PI / 2 + (R() - .5) * .7, v = R() < .5 ? 70 : 245; x.strokeStyle = `rgba(${v},${v},${v},${.18 + R() * .22})`; x.lineWidth = .8 + R(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    grime(x, S, R, 40, .14);
  }, 128, 2.5);
  SURF.metal = canvasTex((x, S, R) => {
    x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const px = R() * S, py = R() * S, r = 3 + R() * 9, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(90,90,90,.35)'); g.addColorStop(1, 'rgba(90,90,90,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    x.lineWidth = .8; for (let i = 0; i < 90; i++) { x.strokeStyle = R() < .5 ? 'rgba(255,255,255,.35)' : 'rgba(40,40,40,.3)'; const px = R() * S, py = R() * S, a = R() * 6.28, l = 4 + R() * 22; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    grime(x, S, R, 30, .15);
  }, 128, 3);
  return SURF;
}
// Schnee auf allem, was nach oben zeigt, Ruß und Feuchte am Sockel. Gilt für die Baustoffe von Gebäuden (und kleine Holz- und Eisenteile der Truppen).
function weather(m, snow = .85, soot = .55, thr = .62) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uSnowAmt = { value: snow }; sh.uniforms.uSoot = { value: soot }; sh.uniforms.uThr = { value: thr };
    sh.vertexShader = 'varying vec3 vWn; varying float vWy; varying vec2 vWxz;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWn = normalize(mat3(modelMatrix) * objectNormal);\n vec4 wp4 = modelMatrix * vec4(transformed, 1.); vWy = wp4.y; vWxz = wp4.xz;');
    sh.fragmentShader = 'varying vec3 vWn; varying float vWy; varying vec2 vWxz; uniform float uSnowAmt, uSoot, uThr;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
      float nz = sampledDiffuseColor.g;
      #else
      float nz = .55;
      #endif
      float up = smoothstep(uThr, uThr + .2, vWn.y + (nz - .55) * .45) * uSnowAmt;
      diffuseColor.rgb *= mix(1. - uSoot, 1., smoothstep(-.2, 1.5, vWy));
      // Verwitterung: senkrechte Schmutz- und Feuchtespuren an Wänden, unregelmäßig lang
      float wcol = floor((vWxz.x + vWxz.y) * 7.), wrs = fract(sin(wcol * 91.7) * 437.58), wlen = fract(sin(wcol * 12.3) * 91.7);
      float streak = smoothstep(.62, .95, wrs) * (1. - abs(vWn.y)) * smoothstep(wlen * 3.5, wlen * 3.5 + 1.2, vWy) * step(.01, uSoot);
      diffuseColor.rgb *= 1. - streak * .28;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.78, .83, .9), up);`);
  };
  m.customProgramCacheKey = () => 'wx' + snow + '_' + soot + '_' + thr;
  return m;
}
const NSTR = { fur: 2.4, stone: 3.2, planks: 1.6, shingles: 1.5, plates: 1.4, snow: .5, rough: 1.1 }; // Tiefe der Normal-Maps
function surf(hex, map, o = {}, snow = .85, soot = .55, thr = .62) {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: .9, metalness: 0, ...o });
  const S = surfaces();
  if (S[map]) {
    m.map = S[map];
    const n = normalOf(S[map], NSTR[map] || 1.2);
    if (n) { m.normalMap = n; m.normalScale.set(1, 1); } else { m.bumpMap = S[map]; m.bumpScale = o.bump ?? 1.2; }
  }
  delete m.bump; return weather(m, snow, soot, thr);
}

/* ---------- Farben ---------- */
const C = {
  coatW: 0x43596b, coatW2: 0x2f4150, fur: 0xdad7cd, steel: 0x929ca6, wood: 0x5d4631, woodD: 0x3b2c20, leather: 0x35291f,
  skin: 0xd2a487, gold: 0xc9a24a, stone: 0x6f7279, stoneD: 0x484a50, snow: 0xc9d2dc, roofW: 0x34506a, roofW2: 0x24394d,
  iron: 0x2a2a2f, ironL: 0x4c4c55, clothA: 0x8e2b18, clothA2: 0x5a1a10, bone: 0xd9d3c0, hideA: 0x4a3b33, troll: 0x6c4c42,
  ember: 0xff7a22, warm: 0xffb25a, horse: 0x6a4d38, wolf: 0x6e7176, wolfD: 0x44464b
};
const L = { // Standardmaterialien
  coatW: mat(C.coatW), coatW2: mat(C.coatW2), fur: mat(C.fur, { roughness: 1 }), steel: mat(C.steel, { metalness: .65, roughness: .4 }),
  wood: surf(0x7a5d42, 'planks'), woodD: surf(0x4e3a2a, 'planks'), leather: mat(C.leather), skin: mat(C.skin, { roughness: .7 }), gold: mat(C.gold, { metalness: .8, roughness: .35 }),
  stone: surf(0x8d8e92, 'stone'), stoneD: surf(0x66676c, 'stone'), snow: surf(C.snow, 'snow', { roughness: .8 }, 0, 0),
  roofW: surf(0x46586a, 'shingles', {}, .9, .3, .36), roofW2: surf(0x33414f, 'shingles', {}, .9, .3, .36), iron: surf(0x3a3a40, 'plates', { metalness: .45, roughness: .6 }, .45, .4), ironL: surf(0x5c5c66, 'plates', { metalness: .45, roughness: .55 }, .45, .4),
  clothA: mat(C.clothA, { roughness: 1 }), clothA2: mat(C.clothA2, { roughness: 1 }), bone: mat(C.bone), hideA: surf(C.hideA, 'rough', { roughness: 1 }, .55, .3, .45), troll: surf(C.troll, 'rough', { roughness: .85 }, .15, .2),
  ember: glowM(C.ember, 2.6), emberDim: glowM(0xc8501a, .9), warm: glowM(C.warm, 3.4), horse: surf(C.horse, 'fur', { roughness: 1 }, .2, .2), wolf: surf(C.wolf, 'fur', { roughness: 1 }, .25, .2), wolfD: surf(C.wolfD, 'fur', { roughness: 1 }, .2, .2),
  glass: mat(0x9ec8d2, { transparent: true, opacity: .45, roughness: .15, metalness: .1 }), hay: mat(0xa8914a, { roughness: 1 }), dirt: surf(0x4a423a, 'rough', { roughness: 1 }, .3, .3)
};

/* ---------- Glut- und Rauchtexturen ---------- */
function radial(stops, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const TEX = {};
export function initTextures() {
  if (TEX.fire) return;
  TEX.fire = radial([[0, 'rgba(255,236,170,1)'], [.3, 'rgba(255,150,50,.85)'], [1, 'rgba(200,60,20,0)']]);
  TEX.glow = radial([[0, 'rgba(255,170,90,.9)'], [.5, 'rgba(255,120,40,.3)'], [1, 'rgba(255,100,30,0)']]);
  TEX.melt = radial([[0, 'rgba(30,24,20,.92)'], [.35, 'rgba(46,38,32,.78)'], [.62, 'rgba(70,72,78,.40)'], [1, 'rgba(90,96,104,0)']], 128);
  TEX.smoke = radial([[0, 'rgba(238,238,242,.8)'], [.6, 'rgba(238,238,242,.38)'], [1, 'rgba(238,238,242,0)']]);
}

/* ---------- Menschen ---------- */
// Umhang als gebogene Stoffbahn um den Rücken (−X). Oben schmal an den Schultern, unten weit ausgestellt.
// Gedrehtes Profil [Radius, Höhe] um die Hochachse. sx staucht von vorn nach hinten (Körper sind tiefer als breit
// nur bei Tieren), folds wirft nach unten zunehmende Falten in den Stoff.
const lathe = (key, pts, seg = 16, sx = 1, folds = 0) => geo('l' + key, () => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (folds) {
    const p = g.attributes.position, ys = pts.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), w = 1 - (p.getY(i) - y0) / (y1 - y0), k = 1 + folds * w * (Math.sin(Math.atan2(x, z) * 9) * .7 + Math.sin(Math.atan2(x, z) * 4 + 1) * .3);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
  }
  g.scale(sx, 1, 1); g.computeVertexNormals(); return g;
});
const caps = (r, len, seg = 8) => geo(`k${r},${len},${seg}`, () => new THREE.CapsuleGeometry(r, len, 3, seg));
// Körpermaße: Hüfte auf 0.95, Rumpf 0.86 hoch, Schultern bei 0.76 und ±0.31 (alles relativ zum Rumpfgelenk).
export const BODY = { hip: .95, shY: .76, shZ: .31, chest: .21 };
// Umhang als gebogene Stoffbahn um den Rücken (−X). Oben schmal an den Schultern, unten weit ausgestellt.
const capeGeo = (len, wid) => geo(`cape${len},${wid}`, () => new THREE.CylinderGeometry(.25, .5, len, 14, 4, true, Math.PI * 1.5 - wid / 2, wid).translate(0, -len / 2, 0));
const twoSided = new Map();
function dbl(m) { // Stoff ist von beiden Seiten sichtbar
  let d = twoSided.get(m); if (d) return d;
  d = m.clone(); d.side = THREE.DoubleSide;
  if (m.onBeforeCompile) { d.onBeforeCompile = m.onBeforeCompile; d.customProgramCacheKey = m.customProgramCacheKey; }
  twoSided.set(m, d); return d;
}
// Helmformen: Nasalhelm mit Wangenklappen, Topfhelm mit Sehschlitz, Eisenhut mit Krempe, Hörnerhelm.
// Maße im Kopfraum (Kopfkugel 0.24 um y 0.12); der ganze Kopf wird danach auf Menschenmaß verkleinert.
function helmet(head, m, type, o) {
  const dome = new THREE.SphereGeometry(.28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 1.9);
  if (type === 'great') {
    part(head, cyl(.275, .27, .4, 18), m, 0, .1, 0);
    part(head, dome, m, 0, .27, 0).scale.y = .55;
    part(head, box(.03, .035, .38), o.slit || L.iron, .27, .17, 0); // Sehschlitz
    for (const z of [-.06, 0, .06]) part(head, box(.03, .025, .025), L.iron, .27, .0, z); // Atemlöcher
    part(head, box(.035, .3, .05), o.trim || L.gold, .275, .08, 0); // Kreuz auf dem Visier
    part(head, box(.035, .04, .22), o.trim || L.gold, .275, .1, 0);
  } else if (type === 'kettle') {
    part(head, dome, m, 0, .17, 0);
    part(head, cyl(.45, .45, .035, 22), m, 0, .2, 0); // Krempe
    part(head, tor(.45, .02), o.trim || L.steel, 0, .2, 0).rotation.x = Math.PI / 2;
  } else {
    part(head, dome, m, 0, .17, 0);
    part(head, box(.04, .26, .06), m, .27, .06, 0); // Nasenschutz
    if (type !== 'horned') for (const z of [-1, 1]) { const c = part(head, box(.16, .22, .035), m, .13, -.02, z * .25); c.rotation.x = z * .18; } // Wangenklappen
    part(head, tor(.28, .03), o.trim || L.gold, 0, .18, 0).rotation.x = Math.PI / 2; // Helmreif
    part(head, cyl(.29, .3, .1, 18, ), o.mailCoif || L.ironL, 0, -.05, 0); // Kettenhaube unter dem Helm
  }
  if (o.crest) { part(head, box(.5, .14, .05), o.crest, -.04, .5, 0); part(head, box(.3, .1, .04), o.crest, -.32, .4, 0).rotation.z = .5; }
}
// Menschliche Figur mit Gelenken in userData.j (Beine, Rumpf, Kopf, Arme, Umhang). Zusätze über Optionen:
// Rüstung (plate, mail, tabard, pauldron, greaves, bracers, gloves), Kleidung (coat, skirt, sleeve, collar, hood),
// Gesicht (skin, hair, braid, longHair, beard, brow, scar, paint, eyes), Kopfschutz (helm, helmType, crest, circlet).
function human(o) {
  const g = new THREE.Group(), j = {}, B = BODY;
  const legM = o.legs || L.leather, skin = o.skin || L.skin, coat = o.coat;
  j.legL = pivot(g, 0, B.hip, -.12); j.legR = pivot(g, 0, B.hip, .12);
  for (const p of [j.legL, j.legR]) {
    part(p, caps(.1, .3), legM, 0, -.22, 0, true); // Oberschenkel
    part(p, caps(.082, .3), legM, 0, -.6, 0); // Unterschenkel
    part(p, cyl(.095, .088, .26, 10), o.boots || L.leather, 0, -.8, 0); // Stiefelschaft
    part(p, box(.27, .09, .13), o.boots || L.leather, .06, -.905, 0); // Fuß
    part(p, cyl(.108, .102, .07, 10), o.cuff || L.fur, 0, -.67, 0); // Stulpe
    if (o.greaves) { part(p, box(.05, .3, .13), o.greaves, .075, -.58, 0); part(p, sph(.07, 10, 7), o.greaves, .07, -.4, 0).scale.set(.7, 1, 1); } // Beinschiene mit Kniekachel
  }
  const body = pivot(g, 0, B.hip, 0); j.body = body;
  // Rumpf: Hüfte, Taille, Brust, Schultern, Halsansatz
  part(body, lathe('torso', [[0, -.03], [.24, -.01], [.26, .1], [.22, .3], [.245, .45], [.285, .62], [.295, .72], [.24, .8], [.11, .86], [0, .87]], 18, .74), coat, 0, 0, 0, true);
  if (o.skirt !== null) part(body, lathe('skirt' + (o.skirtLen || 1), [[.235, .3], [.27, .12], [.33, -.15 * (o.skirtLen || 1)], [.37, -.42 * (o.skirtLen || 1)]], 22, .86, .07), o.skirt || coat, 0, 0, 0, true); // Mantelschoß mit Falten
  if (o.mail) part(body, lathe('mail', [[.25, .34], [.29, .12], [.34, -.2]], 20, .86, .025), o.mail, 0, 0, 0, true); // Kettenschurz
  if (o.plate) { // Brustplatte mit Grat und Kante
    part(body, lathe('plate', [[.235, .36], [.265, .45], [.305, .62], [.315, .72], [.265, .8], [.15, .85]], 18, .78), o.plate, 0, 0, 0, true);
    part(body, box(.03, .36, .035), o.plate, .245, .62, 0);
    part(body, lathe('plateRim', [[.3, .72], [.32, .74], [.3, .76]], 18, .78), o.trim || L.steel, 0, 0, 0);
  }
  if (o.tabard) { // Wappenrock vorne und hinten, mit Zeichen
    const f = part(body, box(.03, 1.05, .3), o.tabard, .255, .17, 0); f.rotation.z = .075;
    part(body, box(.03, 1.0, .3), o.tabard, -.255, .19, 0).rotation.z = -.075;
    if (o.sigil) { part(body, box(.035, .17, .09), o.sigil, .25, .52, 0).rotation.z = .075; part(body, box(.035, .05, .2), o.sigil, .248, .56, 0).rotation.z = .075; }
  }
  part(body, cyl(.255, .255, .07, 18), o.belt || L.leather, 0, .3, 0).scale.set(.76, 1, 1);
  part(body, box(.05, .09, .1), o.buckle || L.gold, .2, .3, 0); // Gürtelschnalle
  part(body, cyl(.062, .075, .14, 10), skin, 0, .9, 0); // Hals
  if (o.collar) part(body, tor(.15, .055), o.collar, 0, .84, 0).rotation.x = Math.PI / 2;
  if (o.cape !== null) { // Umhang, an den Schultern befestigt; das Gelenk lässt ihn im Lauf wehen
    j.cape = pivot(body, 0, .82, 0); j.cape.userData.isCape = true;
    part(j.cape, capeGeo(o.capeLen || 1.0, o.capeW || 1.5), dbl(o.cape || coat), 0, 0, 0, true);
    for (const z of [-.13, .13]) part(body, sph(.035, 8, 6), o.clasp || L.gold, .17, .8, z); // Spangen
  }
  for (const z of [-B.shZ, B.shZ]) { // Schultern: Polster oder geschichtete Platten
    if (o.pauldron) { for (let k = 0; k < 3; k++) part(body, sph(.15 - k * .02, 14, 8), o.pauldron, 0, B.shY + .04 - k * .07, z * (1 + k * .05)).scale.set(1.15, .55, 1); }
    else part(body, sph(.12, 12, 8), o.pad || coat, 0, B.shY, z * .97).scale.set(1, .75, 1);
  }
  // Kopf: im alten Kopfraum gebaut und dann auf Menschenmaß verkleinert (etwa ein Siebtel der Körperhöhe)
  const head = pivot(body, 0, .95, 0); j.head = head; head.scale.set(.66, .74, .64);
  part(head, sph(.24, 18, 14), skin, 0, .12, 0);
  part(head, sph(.17, 14, 10), skin, .08, .0, 0).scale.set(1, .75, .95); // Kinn und Kiefer
  for (const z of [-1, 1]) part(head, sph(.06, 8, 6), skin, -.01, .12, z * .235).scale.set(.55, 1, .4); // Ohren
  part(head, box(.07, .1, .06), skin, .245, .1, 0).rotation.z = -.15; // Nase
  for (const z of [-.085, .085]) {
    part(head, box(.03, .03, .05), o.eyes || L.iron, .22, .16, z); // Augen
    part(head, box(.03, .022, .08), o.brow || o.hair || L.woodD, .228, .205, z * 1.05).rotation.x = z > 0 ? -.2 : .2; // Brauen
  }
  part(head, box(.03, .02, .12), mat(0x6a3a30), .225, .03, 0); // Mund
  if (o.beard) { part(head, sph(.17, 12, 8), o.beard, .12, -.06, 0).scale.set(.85, 1.15, 1.2); part(head, box(.04, .03, .14), o.beard, .235, .06, 0); }
  if (o.scar) part(head, box(.015, .16, .02), mat(0x8e4636), .235, .12, .1).rotation.x = .4;
  if (o.paint) for (const z of [-1, 1]) part(head, box(.015, .12, .025), o.paint, .225, .11, z * .12);
  if (o.hair) {
    part(head, sph(.255, 16, 12), o.hair, -.05, .16, 0).scale.set(1, 1, 1.02);
    if (o.braid) for (let i = 0; i < 6; i++) part(head, sph(.075 - i * .007, 8, 6), o.hair, -.25 - i * .025, .02 - i * .12, 0);
    if (o.longHair) part(head, box(.14, .6, .42), o.hair, -.2, -.14, 0);
  }
  if (o.hood) { part(head, sph(.3, 16, 12), o.hood, -.06, .13, 0).scale.set(1, 1.05, 1.06); part(head, tor(.25, .05), o.hood, .1, .1, 0).rotation.y = Math.PI / 2; } // Kapuze mit Saum ums Gesicht
  if (o.circlet) part(head, tor(.25, .022), o.circlet, 0, .25, 0).rotation.x = Math.PI / 2;
  if (o.helm) helmet(head, o.helm, o.helmType, o);
  // Arme: Oberarm, Unterarm, Hand; leicht vom Körper weg
  const hand = o.gloves || skin, sleeve = o.sleeve || coat;
  j.armR = pivot(body, 0, B.shY, B.shZ); j.armR.rotation.x = -.07;
  j.armL = pivot(body, 0, B.shY, -B.shZ); j.armL.rotation.x = .07;
  for (const a of [j.armR, j.armL]) {
    part(a, caps(.072, .22), sleeve, 0, -.17, 0, true);
    part(a, caps(.062, .2), sleeve, .015, -.45, 0);
    part(a, sph(.058, 10, 8), hand, .02, -.62, 0).scale.set(.75, 1.25, .62);
    if (o.bracers) part(a, cyl(.074, .066, .2, 10), o.bracers, .015, -.48, 0);
  }
  g.userData.j = j; return g;
}
const spear = (len = 3) => { const p = new THREE.Group(); part(p, cyl(.03, .03, len), L.wood, 0, len / 2 - .6, 0); part(p, cone(.07, .34, 6), L.steel, 0, len - .45, 0); return p; };
const shield = (m, r = .5) => { const s = new THREE.Group(); const d = part(s, cyl(r, r, .07, 16), m, 0, 0, 0); d.rotation.x = Math.PI / 2; const b = part(s, sph(.12, 8, 6), L.steel, .04, 0, 0); b.scale.x = .5; part(s, tor(r, .035), L.steel, .02, 0, 0).rotation.y = Math.PI / 2; const st = part(s, box(.05, r * 1.6, .09), L.steel, .05, 0, 0); st.rotation.x = 0; return s; };
const bow = col => { const b = new THREE.Group(); const a = part(b, tor(.62, .03, Math.PI), col, 0, 0, 0); a.rotation.z = -Math.PI / 2; return b; };

const quiver = (body, m, n = 5) => { const q = part(body, cyl(.07, .06, .5, 10), m, -.24, .6, .12); q.rotation.z = .45; for (let i = 0; i < n; i++) { const a = part(q, cyl(.012, .012, .3, 4), L.wood, (i % 3 - 1) * .025, .33, (i % 2 - .5) * .04); part(a, box(.02, .08, .06), L.fur, 0, .12, 0); } return q; };
const kiteShield = (m, trim) => { const s = new THREE.Group(); const top = part(s, cyl(.42, .42, .07, 14, ), m, 0, .12, 0); top.rotation.x = Math.PI / 2; top.scale.set(1, 1, 1); const lo = part(s, cone(.42, 1.0, 14), m, 0, -.42, 0); lo.rotation.z = Math.PI; lo.scale.set(1, 1, .17); for (const z of [-.045, .045]) { part(s, box(.06, 1.1, .03), trim, 0, -.18, z); part(s, box(.62, .06, .03), trim, 0, .1, z); } return s; };
const B_W = { tabard: mat(0x2f5f86, { roughness: 1 }), tabardD: mat(0x234966, { roughness: 1 }), cape: mat(0x1f3d58, { roughness: 1 }), hair: mat(0xb89662, { roughness: .9 }), hairD: mat(0x4e3a2a, { roughness: .9 }), beard: mat(0x8a7254, { roughness: 1 }), gray: mat(0x9a9590, { roughness: 1 }) };

function wacht(type) {
  if (type === 'worker') {
    const g = human({ coat: L.coatW2, hood: L.fur, collar: L.fur, beard: B_W.beard, brow: B_W.hairD, cape: null, sleeve: L.leather }); const j = g.userData.j;
    part(j.body, box(.03, .7, .32), L.leather, .27, .05, 0).rotation.z = .08; // Schürze
    const pick = pivot(j.armR, .1, -.5, 0); j.tool = pick;
    part(pick, cyl(.035, .035, 1.1), L.wood, .35, 0, 0).rotation.z = Math.PI / 2 - .5;
    part(pick, box(.5, .08, .06), L.steel, .7, .35, 0).rotation.z = -.5;
    j.sack = part(j.body, sph(.2, 12, 8), mat(0xb89a4a, { roughness: 1 }), -.3, .6, 0); j.sack.visible = false;
    return g;
  }
  if (type === 'melee') { // Speerträger: Nasalhelm mit Wangenklappen, Kettenschurz, blauer Wappenrock, Drachenschild
    const g = human({ coat: L.coatW, helm: L.steel, helmType: 'nasal', collar: L.fur, mail: L.ironL, tabard: B_W.tabard, sigil: L.fur, cape: B_W.cape, capeLen: .95, capeW: 1.4, pauldron: L.steel, gloves: L.leather, greaves: L.steel, beard: B_W.beard, brow: B_W.hairD }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .1, -.6, .05); const sp = spear(); sp.rotation.z = -1.05; sp.position.set(.1, 0, 0); j.weapon.add(sp);
    const sh = kiteShield(mat(0x3d6584), L.fur); sh.position.set(.14, .4, -.36); sh.scale.setScalar(.85); sh.rotation.y = Math.PI / 2; j.body.add(sh);
    return g;
  }
  if (type === 'ranged') { // Bogenschütze: Lederwams, Kapuzenmantel, Köcher, Armschienen
    const g = human({ coat: L.coatW2, hood: L.coatW, collar: L.fur, cape: B_W.tabardD, capeLen: .8, capeW: 1.3, bracers: L.leather, gloves: L.leather, brow: B_W.hairD }); const j = g.userData.j;
    const b = bow(L.wood); b.position.set(.1, -.55, 0); b.rotation.y = Math.PI / 2; j.weapon = pivot(j.armL, 0, 0, 0); j.weapon.add(b);
    quiver(j.body, L.leather);
    return g;
  }
  if (type === 'hero') { // Hauptfrau Elda: offenes Gesicht mit Zopf und Narbe, Plattenrüstung mit Goldkante, langer Umhang
    const g = human({ coat: mat(0x2c5878), collar: L.fur, belt: L.gold, plate: L.steel, trim: L.gold, tabard: B_W.tabard, sigil: L.gold, pauldron: L.steel, gloves: L.steel, greaves: L.steel, bracers: L.gold,
      cape: mat(0x1d3d57, { roughness: 1 }), capeLen: 1.35, capeW: 2.1, hair: B_W.hair, braid: true, brow: B_W.hairD, scar: true, circlet: L.gold, clasp: L.gold }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .1, -.6, .05); const sp = spear(3.6); sp.rotation.z = -1.0; j.weapon.add(sp);
    const fl = part(j.weapon, box(.02, .6, .5), mat(0x4a98c4, { side: THREE.DoubleSide, roughness: 1 }), -.5, 2.9, 0); fl.rotation.z = -1.0; (g.userData.flags = [fl]);
    const sh = shield(L.gold, .55); sh.position.set(.13, .35, -.37); sh.scale.setScalar(.85); sh.rotation.y = Math.PI / 2; j.body.add(sh);
    g.scale.setScalar(1.18); return g;
  }
  if (type === 'cav') {
    const g = new THREE.Group(), j = {};
    const horse = new THREE.Group(); g.add(horse); j.legs = [];
    const bd = part(horse, sph(.8), L.horse, 0, 1.2, 0); bd.scale.set(1.55, .78, .62);
    const neck = part(horse, cyl(.2, .3, .9), L.horse, 1.05, 1.65, 0); neck.rotation.z = -.6;
    part(horse, box(.7, .28, .3), L.horse, 1.55, 1.95, 0).rotation.z = -.25;
    part(horse, cone(.07, .22, 5), L.horse, 1.3, 2.25, .12); part(horse, cone(.07, .22, 5), L.horse, 1.3, 2.25, -.12);
    part(horse, box(.04, .6, .1), L.fur, .85, 1.95, 0).rotation.z = -.5;
    part(horse, cyl(.05, .12, .9), L.fur, -1.15, 1.2, 0).rotation.z = .9;
    for (const [x, z] of [[.75, .28], [.75, -.28], [-.7, .28], [-.7, -.28]]) { const l = pivot(horse, x, .85, z); part(l, cyl(.1, .07, .85), L.horse, 0, -.42, 0); part(l, box(.2, .1, .16), L.stoneD, .04, -.85, 0); j.legs.push(l); }
    part(horse, box(.7, .1, .55), mat(0x2f4a63), 0, 1.7, 0);
    for (const z of [-1, 1]) { const cp = part(horse, box(1.5, .7, .04), dbl(B_W.tabard), -.05, 1.25, z * .5); cp.rotation.x = z * .12; } // Schabracke
    part(horse, box(.5, .22, .34), L.steel, 1.62, 2.0, 0).rotation.z = -.25; // Rossstirn
    const r = human({ coat: L.coatW, helm: L.steel, helmType: 'great', collar: L.fur, mail: L.ironL, tabard: B_W.tabard, sigil: L.fur, cape: B_W.cape, capeLen: .8, capeW: 1.4, gloves: L.leather, crest: mat(0x4a98c4, { roughness: 1 }) }); r.position.set(-.1, 1.33, 0); r.scale.setScalar(.85); g.add(r);
    r.userData.j.legL.rotation.z = r.userData.j.legR.rotation.z = -1.2; j.weapon = pivot(r.userData.j.armR, 0, -.5, 0);
    const sp = spear(3.2); sp.rotation.z = -1.5; j.weapon.add(sp); j.rider = r;
    g.userData.j = j; g.scale.setScalar(.95); return g;
  }
  if (type === 'support') { // Feldscher: helle Kutte, Kräuterbeutel mit rotem Kreuz, Stab mit Laterne
    const cream = mat(0xcfc8b4, { roughness: 1 });
    const g = human({ coat: cream, hood: cream, collar: L.fur, skirt: cream, skirtLen: 1.25, cape: B_W.tabardD, capeLen: .9, capeW: 1.3, gloves: L.leather, belt: L.leather, brow: B_W.hairD, beard: B_W.beard }); const j = g.userData.j;
    part(j.body, box(.14, .32, .36), L.leather, -.2, .42, .24, true); // Kräuterbeutel
    const red = mat(0xa83030, { roughness: 1 }); part(j.body, box(.16, .2, .06), red, -.2, .45, .43); part(j.body, box(.16, .06, .2), red, -.2, .45, .43);
    for (let i = 0; i < 3; i++) part(j.body, sph(.07, 6, 5), mat([0x6f8a35, 0xc9a44a, 0x9a6a9a][i]), .2, .3, -.2 + i * .2); // Kräuterbüschel am Gürtel
    j.weapon = pivot(j.armR, .05, -.55, .02); part(j.weapon, cyl(.035, .035, 2.0, 6), L.woodD, .1, .55, 0);
    part(j.weapon, sph(.1, 8, 6), L.warm, .1, 1.6, 0); part(j.weapon, tor(.12, .02), L.iron, .1, 1.5, 0).rotation.x = Math.PI / 2; // Laterne
    return g;
  }
  if (type === 'elite') { // Schildwache: Topfhelm, Vollrüstung, Turmschild, Hellebarde
    const g = human({ coat: L.coatW, helm: L.steel, helmType: 'great', trim: L.gold, mail: L.ironL, plate: L.steel, tabard: B_W.tabard, sigil: L.fur, pauldron: L.steel, greaves: L.steel, gloves: L.steel, bracers: L.steel,
      cape: B_W.cape, capeLen: 1.1, capeW: 1.7, boots: L.iron }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .1, -.6, .05); const hb = spear(3.4); hb.rotation.z = -1.05; j.weapon.add(hb);
    part(hb, box(.5, .22, .05), L.steel, .0, 2.7, .0); part(hb, cone(.07, .3, 4), L.steel, .0, 2.95, 0); // Beil und Spitze
    const sh = kiteShield(mat(0x3d6584), L.gold); sh.position.set(.16, .35, -.4); sh.rotation.y = Math.PI / 2; sh.scale.setScalar(1.2); j.body.add(sh);
    g.scale.setScalar(1.12); return g;
  }
  // siege: überdachter Rammbock
  const g = new THREE.Group(), j = {};
  part(g, box(3.2, .3, 1.7), L.wood, 0, .85, 0, true);
  j.wheels = [];
  for (const [x, z] of [[-1.1, .95], [1.1, .95], [-1.1, -.95], [1.1, -.95]]) { const w = part(g, cyl(.5, .5, .2, 14), L.woodD, x, .5, z); w.rotation.x = Math.PI / 2; j.wheels.push(w); }
  for (const [x, z] of [[-1.4, .8], [1.4, .8], [-1.4, -.8], [1.4, -.8]]) part(g, box(.14, 1.5, .14), L.wood, x, 1.7, z);
  part(g, roofG(2.2, .8, 3.4), L.roofW, 0, 2.4, 0, true); snowRoof(g, 2.2, .8, 3.4, 2.4);
  const ram = pivot(g, 0, 1.55, 0); j.ram = ram;
  part(ram, cyl(.28, .28, 3.8, 10), L.woodD, 0, 0, 0).rotation.z = Math.PI / 2;
  part(ram, cone(.38, .7, 8), L.steel, 2.25, 0, 0).rotation.z = -Math.PI / 2;
  for (const x of [-.8, .8]) part(ram, tor(.3, .05), L.steel, x, 0, 0).rotation.y = Math.PI / 2;
  g.userData.j = j; return g;
}

function asch(type) {
  const hornsFor = (head, s = 1) => { for (const z of [-1, 1]) { const h = part(head, cone(.07 * s, .5 * s, 6), L.bone, .02, .38 * s, z * .2); h.rotation.x = -z * .5; } };
  const ashSkin = mat(0x9c7f70, { roughness: .8 }), soot = mat(0x1e1a19, { roughness: 1 });
  if (type === 'worker') {
    const g = human({ coat: L.hideA, hood: L.clothA2, collar: L.hideA, skin: ashSkin, cape: null, beard: soot, brow: soot }); const j = g.userData.j;
    const pick = pivot(j.armR, .1, -.5, 0); j.tool = pick;
    part(pick, cyl(.035, .035, 1.1), L.woodD, .35, 0, 0).rotation.z = Math.PI / 2 - .5; part(pick, box(.5, .08, .06), L.ironL, .7, .35, 0).rotation.z = -.5;
    j.sack = part(j.body, sph(.2, 12, 8), mat(0xb89a4a, { roughness: 1 }), -.3, .6, 0); j.sack.visible = false; return g;
  }
  if (type === 'melee') { // Klingenkrieger: Hörnerhelm, Plattenpanzer mit Zacken, zerrissener roter Umhang
    const g = human({ coat: L.iron, belt: L.clothA, helm: L.iron, helmType: 'horned', trim: L.emberDim, collar: L.clothA2, plate: L.ironL, tabard: L.clothA2, sigil: L.bone, cape: L.clothA2, capeLen: .9, capeW: 1.2,
      gloves: L.iron, greaves: L.iron, bracers: L.ironL, skin: ashSkin, eyes: L.emberDim, brow: soot }); const j = g.userData.j;
    hornsFor(j.head);
    j.weapon = pivot(j.armR, .1, -.6, .05);
    const bl = part(j.weapon, box(1.25, .12, .05), L.steel, .75, 0, 0); bl.rotation.z = -.2; part(j.weapon, box(.12, .06, .3), L.iron, .12, 0, 0);
    for (let i = 0; i < 4; i++) part(j.weapon, cone(.04, .14, 4), L.steel, .4 + i * .22, .08 - i * .045, 0).rotation.z = -.2; // Sägezahn
    for (const z of [-.44, .44]) part(j.body, cone(.11, .32, 8), L.ironL, 0, .88, z * .72).rotation.x = z > 0 ? -.8 : .8;
    return g;
  }
  if (type === 'ranged') { // Pfeilspeier: Knochenmaske, Häute, Köcher aus Eisen
    const g = human({ coat: L.hideA, hood: L.clothA2, collar: L.hideA, skin: ashSkin, cape: L.hideA, capeLen: .75, capeW: 1.2, bracers: L.iron, eyes: L.emberDim }); const j = g.userData.j;
    part(j.head, box(.1, .22, .3), L.bone, .22, .1, 0);
    for (const z of [-.08, .08]) part(j.head, box(.03, .04, .05), L.ember, .28, .16, z); // glimmende Augenlöcher
    const b = bow(L.woodD); b.position.set(.1, -.55, 0); b.rotation.y = Math.PI / 2; j.weapon = pivot(j.armL, 0, 0, 0); j.weapon.add(b);
    quiver(j.body, L.iron); return g;
  }
  if (type === 'hero') { // Brandherr Kharg: Hörnerkrone, Augen aus Glut, Glutbart, schwerer Umhang aus Brandtuch
    const g = human({ coat: mat(0x1c1c20, { metalness: .4, roughness: .6 }), belt: L.clothA, helm: L.iron, helmType: 'great', trim: L.ember, collar: L.clothA, plate: L.ironL, tabard: L.clothA, sigil: L.ember,
      cape: mat(0x4a140c, { roughness: 1 }), capeLen: 1.4, capeW: 2.3, gloves: L.iron, greaves: L.ironL, bracers: L.ember, skin: ashSkin, beard: L.emberDim, clasp: L.ember, slit: L.ember }); const j = g.userData.j;
    hornsFor(j.head, 1.5);
    for (const z of [-.46, .46]) { const sp = part(j.body, sph(.19, 14, 8), L.iron, 0, .84, z * .74); sp.scale.y = .7; part(sp, cone(.08, .34, 8), L.ironL, 0, .2, 0); }
    j.weapon = pivot(j.armR, .1, -.6, .05);
    part(j.weapon, cyl(.05, .05, 2.2), L.woodD, .6, 0, 0).rotation.z = Math.PI / 2 - .35;
    const hd = part(j.weapon, box(.46, .3, .3), L.iron, 1.42, .52, 0); hd.rotation.z = -.35; // Kriegshammer mit glühender Fuge
    part(hd, box(.48, .07, .32), L.ember, 0, 0, 0); for (const x of [-.24, .24]) part(hd, box(.06, .36, .36), L.ironL, x, 0, 0); part(hd, cone(.07, .26, 6), L.ironL, .33, 0, 0).rotation.z = -Math.PI / 2;
    g.userData.hammer = hd; g.scale.setScalar(1.3); return g;
  }
  if (type === 'cav') { // Wolfsreiter
    const g = new THREE.Group(), j = {}; j.legs = [];
    const bd = part(g, sph(.8), L.wolf, 0, 1.0, 0); bd.scale.set(1.7, .72, .6);
    part(g, sph(.5), L.wolf, 1.35, 1.3, 0).scale.set(1.1, .9, .9);
    part(g, cone(.2, .5, 6), L.wolf, 1.95, 1.2, 0).rotation.z = -Math.PI / 2;
    for (const z of [-.2, .2]) { part(g, cone(.11, .34, 5), L.wolfD, 1.25, 1.75, z); part(g, sph(.05, 6, 4), L.ember, 1.82, 1.4, z * .7); }
    part(g, cyl(.04, .14, 1.1), L.wolf, -1.4, 1.1, 0).rotation.z = 1.0;
    for (const [x, z] of [[.8, .26], [.8, -.26], [-.75, .26], [-.75, -.26]]) { const l = pivot(g, x, .75, z); part(l, cyl(.1, .06, .78), L.wolfD, 0, -.38, 0); j.legs.push(l); }
    for (let i = 0; i < 5; i++) part(g, cone(.1, .3, 4), L.wolfD, .8 - i * .38, 1.62, 0);
    const r = human({ coat: L.iron, belt: L.clothA, helm: L.iron, helmType: 'horned', trim: L.emberDim, tabard: L.clothA2, cape: L.clothA2, capeLen: .7, capeW: 1.2, gloves: L.iron }); r.position.set(-.05, 1.13, 0); r.scale.setScalar(.85); g.add(r);
    r.userData.j.legL.rotation.z = r.userData.j.legR.rotation.z = -1.2; hornsFor(r.userData.j.head);
    j.weapon = pivot(r.userData.j.armR, 0, -.5, 0); part(j.weapon, box(1.1, .1, .05), L.steel, .7, 0, 0);
    g.userData.j = j; g.scale.setScalar(.95); return g;
  }
  if (type === 'support') { // Rauchpriester: Knochenmaske, Räuchergefäß an Kette, Schädelstab
    const g = human({ coat: L.clothA2, hood: L.hideA, collar: L.hideA, skin: ashSkin, skirt: L.hideA, skirtLen: 1.2, cape: L.hideA, capeLen: .85, capeW: 1.3, eyes: L.emberDim, bracers: L.iron }); const j = g.userData.j;
    part(j.head, box(.1, .24, .3), L.bone, .22, .1, 0); for (const z of [-.08, .08]) part(j.head, box(.03, .04, .05), L.ember, .28, .16, z); // Maske mit glimmenden Augen
    for (const z of [-1, 1]) part(j.head, cone(.05, .3, 5), L.bone, .0, .42, z * .18).rotation.x = -z * .4;
    j.weapon = pivot(j.armR, .05, -.55, .02); part(j.weapon, cyl(.035, .04, 1.9, 6), L.woodD, .1, .5, 0); part(j.weapon, sph(.15, 7, 5), L.bone, .1, 1.5, 0);
    const chain = part(j.weapon, cyl(.01, .01, .6, 3), L.iron, .1, 1.1, .1); const cs = part(j.weapon, sph(.13, 8, 6), L.emberDim, .1, .75, .1); part(j.weapon, sph(.06, 6, 4), L.ember, .1, .75, .1); // Räuchergefäß
    g.userData.smoke = [[.1, .8, .1]]; return g;
  }
  if (type === 'elite') { // Aschenhüter: nackter Oberkörper mit Kriegsbemalung, zwei Äxte, Hörnerhelm
    const g = human({ coat: ashSkin, skirt: L.hideA, skirtLen: .8, belt: L.clothA, helm: L.iron, helmType: 'horned', trim: L.ember, pauldron: L.iron, greaves: L.hideA, gloves: L.iron, bracers: L.ironL, skin: ashSkin, paint: L.ember, beard: soot, eyes: L.ember, cape: null }); const j = g.userData.j;
    for (const z of [-1, 1]) { const h = part(j.head, cone(.08, .5, 6), L.bone, .02, .38, z * .2); h.rotation.x = -z * .5; }
    const axe = (arm) => { const w = pivot(arm, .1, -.6, .05); part(w, cyl(.04, .04, 1.4, 6), L.woodD, .55, 0, 0).rotation.z = Math.PI / 2 - .3; part(w, box(.3, .26, .05), L.steel, 1.0, .2, 0); part(w, cone(.05, .2, 4), L.ironL, 1.25, .45, 0); return w; };
    j.weapon = axe(j.armR); axe(j.armL);
    for (const z of [-.3, .3]) part(j.body, box(.04, .7, .06), L.leather, .26, .45, z).rotation.z = z > 0 ? -.4 : .4; // Gurte über der Brust
    g.scale.setScalar(1.12); return g;
  }
  // siege: Aschetroll
  const g = new THREE.Group(), j = {};
  j.legL = pivot(g, 0, 1.3, -.55); j.legR = pivot(g, 0, 1.3, .55);
  for (const p of [j.legL, j.legR]) part(p, cyl(.42, .36, 1.4), L.troll, 0, -.65, 0, true);
  const body = pivot(g, 0, 1.2, 0); j.body = body;
  const t = part(body, sph(1.15, 14, 10), L.troll, 0, 1.2, 0, true); t.scale.set(1, 1.15, .95);
  for (const [x, y, z] of [[.5, 1.6, .5], [-.3, 1.9, -.6], [.2, .9, -.9], [-.5, .8, .7]]) part(body, box(.16, .16, .16), L.ember, x, y, z);
  const head = pivot(body, .2, 2.5, 0); part(head, sph(.55), L.troll, 0, 0, 0, true);
  for (const z of [-.2, .2]) { part(head, sph(.07, 6, 4), L.ember, .46, .08, z); part(head, cone(.1, .5, 5), L.bone, .1, .6, z * 1.8); }
  part(head, box(.3, .1, .45), L.stoneD, .46, -.18, 0);
  j.armL = pivot(body, 0, 2.0, -1.2); part(j.armL, cyl(.32, .28, 1.5), L.troll, 0, -.65, 0); part(j.armL, sph(.34), L.troll, 0, -1.4, 0);
  j.armR = pivot(body, 0, 2.0, 1.2); part(j.armR, cyl(.32, .28, 1.5), L.troll, 0, -.65, 0);
  const club = pivot(j.armR, .2, -1.4, 0); j.weapon = club;
  part(club, cyl(.16, .3, 3), L.woodD, .8, .4, 0).rotation.z = Math.PI / 2 - .5;
  part(club, sph(.5, 10, 8), L.ironL, 1.9, 1.1, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, k = part(club, cone(.1, .4, 4), L.iron, 1.9 + Math.cos(a) * .5, 1.1 + Math.sin(a) * .5, (i % 2 - .5) * .3); k.rotation.z = a - Math.PI / 2; }
  g.userData.j = j; g.userData.club = club; return g;
}
/* ---------- Salzbund: Ölzeug, Segeltuch, Schuppenpanzer, violette Schärpen, Silber ---------- */
const SZ = {
  oil: mat(0x34433f, { roughness: .55, metalness: .05 }), oilD: mat(0x232d2b, { roughness: .6 }), canvas: mat(0xc9c1aa, { roughness: 1 }), canvasD: mat(0x968d76, { roughness: 1 }),
  sash: mat(0x5b4a8a, { roughness: 1 }), sashL: mat(0x8a74c4, { roughness: 1 }), silver: mat(0xc4ccd2, { metalness: .75, roughness: .3 }), salt: mat(0xe8ece9, { roughness: .9 }),
  scale: surf(0x7d8f8c, 'plates', { metalness: .5, roughness: .45 }, .4, .3), skin: mat(0xc9a28c, { roughness: .7 }), paleSkin: mat(0xdcc4b8, { roughness: .7 }),
  hair: mat(0x3a2e28, { roughness: .9 }), white: mat(0xe2e0dc, { roughness: .9 }), elk: surf(0x5e5246, 'fur', { roughness: 1 }, .2, .2), elkD: surf(0x3a332c, 'fur', { roughness: 1 }, .2, .2), antler: mat(0xcabfa6, { roughness: .8 }),
  rope: mat(0xa89a74, { roughness: 1 }), sea: glowM(0x7fd6ff, 2.2)
};
function harpoon(len = 2.6) {
  const p = new THREE.Group(); part(p, cyl(.03, .03, len), L.woodD, 0, len / 2 - .6, 0); part(p, cone(.06, .3, 5), SZ.silver, 0, len - .45, 0);
  for (const z of [-1, 1]) { const b = part(p, cone(.03, .16, 4), SZ.silver, 0, len - .62, z * .05); b.rotation.x = Math.PI + z * .5; }
  return p;
}
function salz(type) {
  const face = { skin: SZ.skin, brow: SZ.hair, paint: SZ.sash };
  if (type === 'worker') { // Salzträger: breiter Ölhut, Segeltuchmantel, Tragekorb
    const g = human({ ...face, coat: SZ.canvasD, helm: SZ.oil, helmType: 'kettle', trim: SZ.oilD, collar: SZ.oil, cape: null, beard: SZ.hair, sleeve: SZ.canvas }); const j = g.userData.j;
    part(j.body, cyl(.2, .16, .38, 12), SZ.rope, -.32, .55, 0, true); // Korb
    const pick = pivot(j.armR, .1, -.5, 0); j.tool = pick;
    part(pick, cyl(.035, .035, 1.1), L.wood, .35, 0, 0).rotation.z = Math.PI / 2 - .5; part(pick, box(.5, .08, .06), SZ.silver, .7, .35, 0).rotation.z = -.5;
    j.sack = part(j.body, sph(.17, 12, 8), SZ.salt, -.32, .78, 0); j.sack.visible = false;
    return g;
  }
  if (type === 'melee') { // Hakenwächter: Eisenhut, Schuppenpanzer, Bootshaken, Rundschild mit Welle
    const g = human({ ...face, coat: SZ.oil, helm: SZ.silver, helmType: 'kettle', trim: SZ.sash, plate: SZ.scale, trim2: SZ.silver, mail: SZ.scale, tabard: SZ.sash, sigil: SZ.salt, cape: SZ.oilD, capeLen: .95, capeW: 1.4,
      pauldron: SZ.scale, gloves: L.leather, greaves: SZ.silver, collar: SZ.canvasD, beard: SZ.hair }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .1, -.6, .05); const sp = spear(3.2); sp.rotation.z = -1.05; sp.position.set(.1, 0, 0); j.weapon.add(sp);
    const hook = part(sp, tor(.14, .03, Math.PI * 1.2), SZ.silver, .1, 2.45, 0); hook.rotation.y = Math.PI / 2; // Haken an der Spitze
    const sh = shield(mat(0x4a3a78), .5); sh.position.set(.13, .35, -.37); sh.scale.setScalar(.85); sh.rotation.y = Math.PI / 2; j.body.add(sh);
    for (let i = 0; i < 3; i++) part(sh, tor(.18 + i * .1, .02, Math.PI), SZ.salt, .05, -.05, 0).rotation.y = Math.PI / 2; // Wellenzeichen
    return g;
  }
  if (type === 'ranged') { // Harpunier: Ölzeugkapuze, Seil über der Schulter, Harpune
    const g = human({ ...face, coat: SZ.oil, hood: SZ.oilD, collar: SZ.canvasD, cape: SZ.canvasD, capeLen: .8, capeW: 1.3, bracers: SZ.sash, gloves: L.leather, belt: SZ.sash }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .1, -.6, .05); const hp = harpoon(); hp.rotation.z = -1.2; j.weapon.add(hp);
    const coil = part(j.body, tor(.2, .04), SZ.rope, -.06, .58, -.2); coil.rotation.y = Math.PI / 2; coil.rotation.x = .5;
    for (const z of [-.2, .2]) part(j.body, cyl(.03, .03, .5, 4), L.woodD, -.24, .72, z * .6).rotation.z = .4; // Ersatzharpunen
    return g;
  }
  if (type === 'hero') { // Seherin Maren: blasses Gesicht, langes weißes Haar, Muschelreif, Gewand, Stab mit Seelicht
    const g = human({ coat: SZ.sash, skin: SZ.paleSkin, brow: SZ.white, hair: SZ.white, longHair: true, circlet: SZ.silver, paint: SZ.sea, collar: SZ.silver, belt: SZ.silver, buckle: SZ.sea,
      cape: mat(0x2e2650, { roughness: 1 }), capeLen: 1.45, capeW: 2.2, pauldron: SZ.silver, bracers: SZ.silver, clasp: SZ.sea, sleeve: SZ.sashL }); const j = g.userData.j;
    part(j.body, lathe('robe', [[.26, .3], [.3, .05], [.4, -.5], [.48, -.92]], 24, .9, .05), SZ.sash, 0, 0, 0, true); // langes Gewand bis zum Boden
    part(j.head, sph(.06, 6, 4), SZ.sea, .22, .3, 0); // Perle am Reif
    j.weapon = pivot(j.armR, .1, -.6, .05);
    part(j.weapon, cyl(.035, .045, 2.6, 6), L.woodD, 0, .7, 0);
    const lamp = pivot(j.weapon, 0, 2.05, 0); part(lamp, tor(.17, .025), SZ.silver, 0, 0, 0); part(lamp, sph(.12, 10, 8), SZ.sea, 0, 0, 0);
    for (let i = 0; i < 3; i++) part(lamp, cone(.03, .2, 4), SZ.silver, Math.cos(i * 2.1) * .15, .14, Math.sin(i * 2.1) * .15);
    g.userData.lamp = lamp; g.scale.setScalar(1.15); return g;
  }
  if (type === 'cav') { // Hirschreiter: großer Moorhirsch mit Schaufelgeweih
    const g = new THREE.Group(), j = {}; j.legs = [];
    const deer = new THREE.Group(); g.add(deer);
    const bd = part(deer, sph(.8), SZ.elk, 0, 1.3, 0); bd.scale.set(1.5, .75, .6);
    part(deer, sph(.42), SZ.elkD, .9, 1.55, 0).scale.set(1, 1, .9); // Widerrist
    const neck = part(deer, cyl(.18, .28, .9), SZ.elk, 1.15, 1.85, 0); neck.rotation.z = -.4;
    const head = pivot(deer, 1.5, 2.25, 0); part(head, box(.6, .3, .3), SZ.elk, .2, 0, 0).rotation.z = -.35; part(head, box(.18, .2, .22), SZ.elkD, .5, -.12, 0);
    part(head, cyl(.08, .14, .22, 6), SZ.white, .02, -.14, 0); // heller Kehlfleck
    for (const z of [-1, 1]) { // Schaufelgeweih
      const a = pivot(head, 0, .14, z * .14); a.rotation.x = -z * .7;
      part(a, cyl(.03, .04, .5, 5), SZ.antler, 0, .25, 0);
      const pal = part(a, box(.42, .05, .3), SZ.antler, .08, .5, 0); pal.rotation.z = .25;
      for (let i = 0; i < 4; i++) part(pal, cone(.025, .2, 4), SZ.antler, -.15 + i * .1, .1, .12);
    }
    part(deer, cyl(.04, .1, .3), SZ.elk, -1.15, 1.4, 0).rotation.z = 1.2;
    for (const [x, z] of [[.75, .26], [.75, -.26], [-.7, .26], [-.7, -.26]]) { const l = pivot(deer, x, 1.0, z); part(l, cyl(.08, .05, 1.0), SZ.elkD, 0, -.5, 0); part(l, box(.14, .08, .12), L.iron, .03, -1.0, 0); j.legs.push(l); }
    for (const z of [-1, 1]) { const cp = part(deer, box(1.3, .55, .04), dbl(SZ.sash), -.1, 1.3, z * .48); cp.rotation.x = z * .12; }
    const r = human({ ...face, coat: SZ.oil, helm: SZ.silver, helmType: 'kettle', trim: SZ.sash, mail: SZ.scale, tabard: SZ.sash, sigil: SZ.salt, cape: SZ.oilD, capeLen: .7, capeW: 1.3, gloves: L.leather }); r.position.set(-.1, 1.58, 0); r.scale.setScalar(.85); g.add(r);
    r.userData.j.legL.rotation.z = r.userData.j.legR.rotation.z = -1.2; j.weapon = pivot(r.userData.j.armR, 0, -.5, 0);
    const lance = harpoon(3.4); lance.rotation.z = -1.5; j.weapon.add(lance); j.rider = r;
    g.userData.j = j; g.scale.setScalar(.92); return g;
  }
  if (type === 'support') { // Muschelsänger: Seidenmantel, Perlenreif, Stab mit leuchtender Muschel
    const g = human({ ...face, coat: SZ.sash, hood: SZ.sashL, skirt: SZ.sash, skirtLen: 1.25, cape: SZ.oilD, capeLen: .9, capeW: 1.3, circlet: SZ.silver, collar: SZ.silver, belt: SZ.silver, bracers: SZ.silver }); const j = g.userData.j;
    j.weapon = pivot(j.armR, .05, -.55, .02); part(j.weapon, cyl(.035, .04, 2.0, 6), L.woodD, .1, .55, 0);
    const shell = part(j.weapon, cone(.2, .45, 8), SZ.salt, .1, 1.7, 0); shell.rotation.z = -.6; part(j.weapon, sph(.12, 8, 6), SZ.sea, .1, 1.62, 0); // Muschel mit Seelicht
    for (let i = 0; i < 3; i++) part(j.weapon, tor(.1 + i * .05, .012), SZ.sea, .1, 1.72, 0).rotation.y = i * 1.0; // Schallringe
    return g;
  }
  if (type === 'elite') { // Perlenwache: Schuppenpanzer mit Dornen, Dreizack, Wellenschild
    const g = human({ ...face, coat: SZ.oil, helm: SZ.silver, helmType: 'great', trim: SZ.sash, mail: SZ.scale, plate: SZ.scale, tabard: SZ.sash, sigil: SZ.salt, pauldron: SZ.scale, greaves: SZ.silver, gloves: L.leather, bracers: SZ.silver,
      cape: SZ.oilD, capeLen: 1.1, capeW: 1.7, clasp: SZ.sea, slit: SZ.sea }); const j = g.userData.j;
    for (const z of [-.31, .31]) for (let i = 0; i < 3; i++) part(j.body, cone(.05, .24, 5), SZ.silver, -.05 + i * .06, .92 + i * .02, z * 1.25).rotation.z = -.4; // Dornen auf den Schultern
    j.weapon = pivot(j.armR, .1, -.6, .05); const tri = harpoon(3.2); tri.rotation.z = -1.05; j.weapon.add(tri);
    for (const z of [-1, 1]) part(tri, cone(.04, .3, 4), SZ.silver, .0, 2.65, z * .13); // Zinken
    const sh = shield(mat(0x4a3a78), .55); sh.position.set(.13, .35, -.37); sh.rotation.y = Math.PI / 2; sh.scale.setScalar(.9); j.body.add(sh);
    for (let i = 0; i < 3; i++) part(sh, tor(.18 + i * .1, .02, Math.PI), SZ.salt, .05, -.05, 0).rotation.y = Math.PI / 2;
    g.scale.setScalar(1.12); return g;
  }
  // siege: Gezeitenschleuder, ein Wurfarm auf Rädern mit Kugeln aus gefrorenem Meerwasser
  const g = new THREE.Group(), j = {};
  part(g, box(3.0, .28, 1.6), L.wood, 0, .8, 0, true);
  j.wheels = [];
  for (const [x, z] of [[-1.0, .9], [1.0, .9], [-1.0, -.9], [1.0, -.9]]) { const w = part(g, cyl(.5, .5, .18, 14), L.woodD, x, .5, z); w.rotation.x = Math.PI / 2; j.wheels.push(w); part(g, tor(.5, .04), L.iron, x, .5, z * 1.05); }
  for (const z of [-.6, .6]) { const a = part(g, box(.18, 1.6, .18), L.woodD, -.2, 1.65, z, true); a.rotation.z = -.15; }
  part(g, box(.2, .2, 1.4), L.woodD, -.3, 2.35, 0);
  part(g, cyl(.3, .3, 1.0, 12), SZ.rope, -.2, 1.0, 0).rotation.x = Math.PI / 2; // Torsionsbündel
  const arm = pivot(g, -.2, 1.0, 0); j.arm = arm;
  const beam = part(arm, box(2.6, .16, .16), L.wood, -1.0, 0, 0, true); beam.rotation.z = -.2;
  part(arm, cyl(.28, .2, .2, 10), L.iron, -2.2, .3, 0);
  part(arm, sph(.24, 10, 8), mat(0xa9d8ee, { roughness: .2, metalness: .1, emissive: 0x2a6a88, emissiveIntensity: .6 }), -2.2, .5, 0);
  for (let i = 0; i < 4; i++) part(g, sph(.2, 8, 6), mat(0xa9d8ee, { roughness: .2, metalness: .1, emissive: 0x2a6a88, emissiveIntensity: .6 }), 1.1 + (i % 2) * .3, 1.1 + (i > 1 ? .25 : 0), -.2 + (i % 2) * .35);
  banner(g, 1.3, .9, -.6, mat(0x5b4a8a, { side: THREE.DoubleSide, roughness: 1 }), .9);
  g.userData.j = j; return g;
}

const WM = { moss: mat(0x4a5a3a, { roughness: 1 }), mossD: mat(0x2e3a28, { roughness: 1 }), rag: mat(0x5c5446, { roughness: 1 }), rock: mat(0x6d706f, { roughness: .95 }), lichen: mat(0x8fa066, { roughness: 1 }) };
function antlers(head, s = 1) {
  for (const z of [-1, 1]) {
    const m = part(head, cyl(.025 * s, .04 * s, .55 * s, 5), L.bone, -.02, .42 * s, z * .2); m.rotation.x = -z * .45;
    const t = part(head, cyl(.02 * s, .03 * s, .32 * s, 5), L.bone, .08, .6 * s, z * .38); t.rotation.x = -z * .9; t.rotation.z = -.5;
  }
}
// Wilde Wesen: verwachsene, bemooste Gestalten mit Geweihmaske, deutlich anders als beide Fraktionen.
function wildUnit(type) {
  if (type === 'brute') {
    const g = human({ coat: WM.rock, belt: WM.mossD, cape: null, pad: WM.lichen, legs: WM.mossD, cuff: WM.moss, collar: WM.moss }); const j = g.userData.j;
    g.scale.setScalar(1.65); j.body.rotation.z = .12;
    antlers(j.head, 1.5);
    for (const [x, y, z, r] of [[-.15, .75, -.15, .17], [-.12, .35, .2, .2], [0, .82, .22, .14]]) part(j.body, sph(r, 8, 6), WM.moss, x, y, z).scale.set(1.2, .7, 1.2); // Moos
    j.weapon = pivot(j.armR, .1, -.6, .05);
    part(j.weapon, cyl(.1, .16, 2.1, 7), L.woodD, .7, 0, 0).rotation.z = Math.PI / 2 - .25;
    part(j.weapon, sph(.4, 8, 6), WM.rock, 1.55, .35, 0);
    return g;
  }
  const g = human({ coat: type === 'ranged' ? WM.rag : WM.moss, belt: L.hideA, cape: WM.mossD, pad: WM.mossD, legs: WM.mossD, cuff: WM.rag, collar: WM.lichen, hood: WM.mossD }); const j = g.userData.j;
  j.body.rotation.z = .2; g.scale.setScalar(.95);
  antlers(j.head, 1);
  part(j.head, box(.05, .22, .3), L.bone, .2, .13, 0); // Knochenmaske
  j.weapon = pivot(j.armR, .1, -.6, .05);
  if (type === 'ranged') {
    part(j.weapon, sph(.17, 7, 5), WM.rock, .35, 0, 0);
    part(j.armL, sph(.14, 7, 5), WM.rock, 0, -.7, 0);
  } else {
    part(j.weapon, cyl(.05, .08, 1.2, 6), L.bone, .6, 0, 0).rotation.z = Math.PI / 2 - .3;
    part(j.weapon, sph(.17, 7, 5), L.bone, 1.2, .25, 0);
  }
  return g;
}
/* ---------- Verschmelzen: weniger Zeichenaufrufe ---------- */
// Ein Modell besteht aus vielen kleinen Teilen. Alle Teile, die an derselben Gruppe hängen (Rumpf, Arm, Waffe, Gebäude),
// bewegen sich gemeinsam und werden je Material zu einem Netz verschmolzen. Gruppen (Gelenke) bleiben erhalten,
// ebenso Teile, die einzeln bewegt oder ein- und ausgeblendet werden (keep). Ergebnis je Schlüssel im Zwischenspeicher.
const bakeCache = new Map();
const BAKE_ATTR = ['position', 'normal', 'uv'];
// Einfarbige Materialien ohne Textur und ohne Leuchten teilen sich ein Material mit Eckenfarben,
// gruppiert nur nach Rauheit, Metallglanz und Seite. So zählt ein ganzer Rumpf nur wenige Zeichenaufrufe.
const vcMats = new Map();
function vcKey(m) {
  if (!m.isMeshStandardMaterial || m.map || m.transparent || m.vertexColors || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null;
  if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * m.emissiveIntensity > 0) return null;
  return 'vc' + (m.roughness < .55 ? 'g' : 'm') + (m.metalness > .3 ? 'M' : 'N') + m.side; // matt oder glänzend, Metall oder nicht
}
function vcMat(key, m) {
  let v = vcMats.get(key); if (v) return v;
  const metal = m.metalness > .3, S = surfaces(), dt = metal ? S.metal : S.cloth;
  v = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness < .55 ? .45 : .92, metalness: metal ? .65 : 0, side: m.side });
  if (dt) { // feine Struktur: Gewebe auf Stoff, Leder und Haut, Dellen und Kratzer auf Metall
    v.map = dt; v.roughnessMap = dt; const n = normalOf(dt, metal ? 1.4 : 2.2); if (n) { v.normalMap = n; v.normalScale.set(.7, .7); }
  }
  vcMats.set(key, v); return v;
}
function bakeGeo(mesh, rel, vc) {
  let gm = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const k of Object.keys(gm.attributes)) if (!BAKE_ATTR.includes(k)) gm.deleteAttribute(k);
  if (!gm.attributes.normal) gm.computeVertexNormals();
  if (!gm.attributes.uv) gm.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gm.attributes.position.count * 2), 2));
  if (vc) { const c = mesh.material.color, n = gm.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } gm.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  gm.clearGroups(); gm.applyMatrix4(rel); return gm;
}
export function bake(root, key, keep = new Set()) {
  root.updateMatrixWorld(true);
  // Anker: die Wurzel und jede Gruppe, die einzeln bewegt wird. Alle anderen Gruppen werden mitverschmolzen.
  const anchors = []; root.traverse(o => { if (o === root || (keep.has(o) && !o.isMesh)) anchors.push(o); });
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  anchors.forEach((an, ai) => {
    const list = [], walk = o => { for (const c of o.children) {
      if (keep.has(c) || c.isSprite) continue;
      if (!c.isMesh) { walk(c); continue; } // unbewegte Gruppe: hineinsehen
      if (Array.isArray(c.material) || c.children.some(k => k.isSprite)) continue; // Teile mit Flammen bleiben einzeln
      list.push(c); walk(c);
    } };
    walk(an); if (list.length < 2) return;
    inv.copy(an.matrixWorld).invert();
    const groups = new Map();
    for (const m of list) {
      const vk = vcKey(m.material), k = vk || m.material.uuid;
      let gr = groups.get(k); if (!gr) groups.set(k, gr = { mat: vk ? vcMat(vk, m.material) : m.material, vc: !!vk, sh: false, ms: [] });
      gr.ms.push(m); gr.sh = gr.sh || m.castShadow;
    }
    for (const m of list) { m.children.filter(k => !k.isMesh).forEach(k => { const w = new THREE.Vector3(); k.getWorldPosition(w); an.worldToLocal(w); k.position.copy(w); an.add(k); }); if (m.parent) m.parent.remove(m); }
    let gi = 0;
    for (const gr of groups.values()) {
      const ck = key + '|' + ai + '|' + gi++ + '|' + gr.mat.uuid + gr.sh;
      let geom = bakeCache.get(ck);
      if (!geom) { geom = mergeGeometries(gr.ms.map(m => bakeGeo(m, rel.multiplyMatrices(inv, m.matrixWorld), gr.vc))); geom.computeBoundingSphere(); bakeCache.set(ck, geom); }
      const mesh = new THREE.Mesh(geom, gr.mat); mesh.castShadow = gr.sh; mesh.receiveShadow = true; an.add(mesh);
    }
  });
  return root;
}
// Teile, die die Darstellung einzeln anfasst (Sichtbarkeit, Drehung, Deckkraft).
function keepOf(g) {
  const s = new Set(), add = v => { if (!v) return; if (Array.isArray(v)) v.forEach(add); else if (v.isObject3D) s.add(v); };
  const j = g.userData.j || {}; // nur die Gelenke der Wurzel animiert die Darstellung; Kopf, Arme und Reiter stehen still
  for (const [k, v] of Object.entries(j)) if (!['head', 'armR', 'armL', 'rider'].includes(k)) add(v);
  g.traverse(o => { if (o.userData.isCape) s.add(o); });
  add(g.userData.flags); add(g.userData.pools); add(g.userData.gears); add(g.userData.scaffold); add(g.userData.lamp);
  return s;
}

export function buildUnit(fac, type) {
  initTextures();
  const file = fromFile(fac + ':' + type); if (file) return file;
  const g = fac === 'wild' ? wildUnit(type) : fac === 'asch' ? asch(type) : fac === 'salz' ? salz(type) : wacht(type);
  const capes = []; g.traverse(o => { if (o.userData.isCape) capes.push(o); }); g.userData.capes = capes; // auch Umhänge von Reitern
  return bake(g, 'u:' + fac + ':' + type, keepOf(g));
}

/* ---------- Gebäude (Ursprung = Mittelpunkt der Grundfläche) ---------- */
const glowPool = [];
function windows(g, w, y, zs, n, m = L.warm) { for (let i = 0; i < n; i++) { const x = -w / 2 + (i + .5) * w / n; for (const z of zs) part(g, box(.32, .45, .06), m, x, y, z); } }
function fire(g, x, y, z, s = 1) {
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.fire, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: GLOW.k }));
  f.position.set(x, y, z); f.scale.set(1.3 * s, 1.8 * s, 1); g.add(f); (g.userData.flames ||= []).push({ s: f, b: s, ph: Math.random() * 9 }); return f;
}
export const GLOW = { k: 1 };
function pool(g, x, z, r, y = .08) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 * GLOW.k, fog: false }));
  p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); g.add(p); (g.userData.pools ||= []).push(p);
}
function banner(g, x, y, z, col, h = 1.6) {
  part(g, cyl(.05, .05, h * 1.6), L.woodD, x, y + h * .8, z);
  const f = part(g, box(.04, h * .8, .9), col, x, y + h * 1.25, z + .5); f.material = col; (g.userData.flags ||= []).push(f);
}
// Schnee als Haube auf dem Dach: kleineres Dreieck, das oben bündig aufsitzt.
function snowRoof(g, w, h, Ln, y, x = 0, z = 0) { part(g, roofG(w * .72, h * .72, Ln * 1.02), L.snow, x, y + h * .28 + .04, z); }

/* ---------- Baustoffe der Burgen: Putz und Balken, Holzschindeln, schwarzer Stein ---------- */
const B = {
  plaster: surf(0xcfc3a8, 'rough', { roughness: .95 }, .8, .45),
  beam: surf(0x3a2a1e, 'planks', {}, .7, .3),
  roofWood: surf(0x5c4838, 'shingles', {}, .9, .25, .36),
  slate: surf(0x4a5562, 'shingles', {}, .92, .25, .36),
  black: surf(0x3a3534, 'stone', {}, .45, .35),
  blackD: surf(0x262222, 'stone', {}, .4, .3),
  thatch: surf(0x8a7650, 'rough', { roughness: 1 }, .85, .2, .36),
  door: surf(0x4a3424, 'planks', {}, 0, .2)
};
const drift = (g, x, z, sx, sz, m = L.snow) => part(g, sph(1, 9, 6), m, x, -.12, z).scale.set(sx * .85, .3, sz * .85);
function icicles(g, x0, x1, y, z, n, dir = 'z') {
  for (let i = 0; i < n; i++) {
    const t = x0 + (i + .5) * (x1 - x0) / n, h = .22 + ((i * 37) % 5) * .08;
    const c = part(g, cone(.04, h, 5), L.glass, dir === 'z' ? t : z, y - h / 2, dir === 'z' ? z : t); c.rotation.x = Math.PI;
  }
}
function lantern(g, x, z, h = 1.5) {
  part(g, cyl(.04, .05, h, 5), L.woodD, x, h / 2, z); part(g, box(.2, .26, .2), L.iron, x, h + .1, z); part(g, box(.14, .18, .14), L.warm, x, h + .1, z);
  pool(g, x, z, .9, .06);
}
function crates(g, x, z, n = 2) { for (let i = 0; i < n; i++) { const w = .5 + (i % 2) * .15; part(g, box(w, w * .85, w), i % 2 ? L.wood : L.woodD, x + i * .55, w * .42, z + (i % 2) * .15, true).rotation.y = i * .4; } if (n > 1) part(g, box(.4, .4, .4), L.wood, x + .3, 1.0, z + .1, true).rotation.y = .5; }
function barrel(g, x, z, m = L.woodD) { part(g, cyl(.3, .3, .65, 10), m, x, .33, z, true); for (const y of [.18, .5]) part(g, tor(.3, .03), L.iron, x, y, z).rotation.x = Math.PI / 2; }
function heatGround() {}
// Zinnen auf einem Rechteck (Oberkante y) oder einem Kreis
function crenRect(g, cx, y, cz, w, d, m, mw = .3) {
  const row = (x0, z0, x1, z1) => { const L2 = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L2 / .62)); for (let i = 0; i < n; i++) { const t = (i + .5) / n; part(g, box(mw, .34, mw), m, x0 + (x1 - x0) * t, y + .17, z0 + (z1 - z0) * t, true); } };
  row(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2); row(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2);
  row(cx - w / 2, cz - d / 2 + .5, cx - w / 2, cz + d / 2 - .5); row(cx + w / 2, cz - d / 2 + .5, cx + w / 2, cz + d / 2 - .5);
}
function crenRound(g, cx, y, cz, r, m, n = 8) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = part(g, box(.26, .32, .3), m, cx + Math.cos(a) * r, y + .16, cz + Math.sin(a) * r, true); b.rotation.y = -a; } }
// Fachwerk: Putzkörper mit dunklen Balken, Streben und Schwelle
function timber(g, x, y0, z, w, h, d) {
  part(g, box(w, h, d), B.plaster, x, y0 + h / 2, z, true);
  const t = .1, o = .03;
  for (const s of [-1, 1]) {
    const fz = z + s * (d / 2 + o), fx = x + s * (w / 2 + o);
    for (const yy of [y0 + t / 2, y0 + h * .5, y0 + h - t / 2]) { part(g, box(w + .08, t, t), B.beam, x, yy, fz); part(g, box(t, t, d + .08), B.beam, fx, yy, z); }
    const n = Math.max(2, Math.round(w / .9));
    for (let i = 0; i <= n; i++) { const px = x - w / 2 + i * w / n; part(g, box(t, h, t), B.beam, px, y0 + h / 2, fz); if (i < n && i % 2 === 0) { const dx = w / n, dy = h * .5, br = part(g, box(t * .8, Math.hypot(dx, dy), t * .8), B.beam, px + dx / 2, y0 + h * .25, fz); br.rotation.z = -Math.atan2(dx, dy) * (s > 0 ? 1 : -1) * (i % 4 ? -1 : 1); } }
    for (const pz of [-d / 2, 0, d / 2]) part(g, box(t, h, t), B.beam, fx, y0 + h / 2, z + pz);
  }
}
/* ---------- Dachvarianten: jedes Gebäude bekommt aus seiner Kennung eine feste Variante ---------- */
// Farbe und Schneelast je Dachstoff. Wenig Schnee lässt Schiefer, Schindeln und Stroh von oben sichtbar.
const ROOF_KINDS = {
  slate:  { tex: 'shingles', cols: [[0x4a5562, .95], [0x2b3038, .12], [0x6a5648, .35], [0x3c4c40, .2], [0x5e6878, .65]] },
  wood:   { tex: 'shingles', cols: [[0x5c4838, .9], [0x7e4a2c, .12], [0x3a2e26, .3], [0x6a6450, .6], [0x8c5a3a, .22]] },
  thatch: { tex: 'rough', cols: [[0x8a7650, .85], [0x6a5a38, .15], [0xa88a50, .3], [0x5e5a40, .55], [0x947040, .1]] },
  hide:   { tex: 'rough', cols: [[0x4a3b33, .55], [0x5a4636, .3], [0x3a302c, .42], [0x62503e, .2]] },
  hull:   { tex: 'planks', cols: [[0x2e2a28, .35], [0x3a3330, .12], [0x24282a, .25], [0x4a3c32, .05], [0x33302c, .2]] }
};
const roofCache = new Map();
function roofOf(kind, i) {
  const k = kind + i; let m = roofCache.get(k); if (m) return m;
  const [c, snow] = ROOF_KINDS[kind].cols[i % ROOF_KINDS[kind].cols.length];
  m = surf(c, ROOF_KINDS[kind].tex, { roughness: .95 }, snow, .25, kind === 'hull' ? .7 : .36); roofCache.set(k, m); return m;
}
let RV = null; // Variante des Gebäudes, das gerade gebaut wird
function makeVariant(seed) {
  const R = prng((seed * 977 + 13) >>> 0);
  return { R, i: (R() * 5) | 0, dormers: R() < .6, chimney: R() < .65, patches: 3 + ((R() * 5) | 0), moss: R() < .5, sky: R() < .4, cornice: R() < .55, drift: R() < .5 };
}
// Grundmaterial eines Dachs gegen die Variante tauschen (Schiefer, Holzschindeln, Stroh, Häute).
function rs(m) {
  if (!RV) return m;
  const kind = m === B.slate ? 'slate' : m === B.roofWood ? 'wood' : m === B.thatch ? 'thatch' : m === L.hideA ? 'hide' : null;
  return kind ? roofOf(kind, RV.i + (kind === 'thatch' ? 1 : 0)) : m;
}
const tintCache = new Map();
function tintOf(m, f) { // hellerer oder dunklerer Ableger für Flicken
  const k = m.uuid + f; let t = tintCache.get(k); if (t) return t;
  t = m.clone(); t.color = m.color.clone().multiplyScalar(f);
  if (m.onBeforeCompile) { t.onBeforeCompile = m.onBeforeCompile; t.customProgramCacheKey = m.customProgramCacheKey; }
  tintCache.set(k, t); return t;
}
const MOSS = surf(0x4f5e3a, 'rough', { roughness: 1 }, .2, 0, .5);
// Einzelheiten auf einem Satteldach (First entlang X, Breite w quer, Höhe h, Länge Lr).
function roofDetails(g, x, y, z, w, h, Lr, m, plain = false) {
  const v = RV; if (!v || Lr < 1.2) return;
  const R = v.R, a = Math.atan2(h, w / 2), sl = Math.hypot(h, w / 2);
  const onSlope = (s, f, px, ps, mm, t = .04, out = .03) => { // flaches Teil auf der Dachfläche (s = +1 vorne, −1 hinten)
    const o = part(g, box(px, t, ps), mm, 0, 0, 0); o.rotation.x = s * a;
    o.position.set(x, y + h * f + Math.cos(a) * out, z + s * (w / 2) * (1 - f) + s * Math.sin(a) * out); return o;
  };
  for (let i = 0; i < v.patches; i++) { // Flicken und Ausbesserungen
    const s = R() < .5 ? 1 : -1, f = .15 + R() * .6, p = onSlope(s, f, .3 + R() * .5, .25 + R() * .35, tintOf(m, R() < .5 ? .55 : 1.5));
    p.position.x += (R() - .5) * (Lr - .8);
  }
  if (v.drift) { const sd = onSlope(R() < .5 ? -1 : 1, .5, Lr * (.5 + R() * .4), sl * .85, L.snow, .07, .05); sd.position.x += (R() - .5) * Lr * .3; } // Schneewehe auf einer Dachseite
  if (plain || v.fac === 'asch') return; // Häute und Bootsrümpfe: nur Flicken
  if (v.moss) for (let i = 0; i < 3; i++) { const p = onSlope(R() < .6 ? -1 : 1, .05 + R() * .3, .4 + R() * .6, .2 + R() * .3, MOSS, .03, .045); p.position.x += (R() - .5) * (Lr - .6); }
  if (v.sky && w > 1.4) { const p = onSlope(1, .55, .26, .3, L.warm, .05, .04); p.position.x += (R() - .5) * (Lr - 1); }
  if (v.dormers && w >= 1.8 && Lr >= 2.2) { // Gaube mit warmem Fenster auf der Vorderseite
    const dx = x + (R() - .5) * (Lr - 1.4), f = .32, dz = z + (w / 2) * (1 - f), dy = y + h * f;
    part(g, box(.5, .46, .5), B.plaster, dx, dy + .16, dz - .05, true);
    part(g, box(.24, .26, .04), L.warm, dx, dy + .16, dz + .21);
    const dr = part(g, roofG(.66, .32, .64), m, dx, dy + .39, dz - .05, true); dr.rotation.y = Math.PI / 2;
  }
  if (v.chimney) { // Schornstein auf der Rückseite, mit Rußkappe und Rauch
    const cx = x + (R() - .5) * (Lr - .8), f = .62, cz = z - (w / 2) * (1 - f), cy = y + h * f;
    part(g, box(.3, .95, .3), L.stoneD, cx, cy + .3, cz, true); part(g, box(.38, .08, .38), mat(0x1b1a1a, { roughness: 1 }), cx, cy + .8, cz);
    (g.userData.smoke ||= []).push([cx, cy + 1.0, cz]);
  }
  if (v.cornice) { const c = part(g, box(Lr * .96, .1, .2), L.snow, x, y + .06, z + w / 2 - .06); c.rotation.x = a * .5; icicles(g, x - Lr * .45, x + Lr * .45, y, z + w / 2 + .02, Math.round(Lr * 2.5)); }
}
// Steiles Dach mit gekreuzten Giebelbalken (Firstköpfe) an beiden Enden
function hallRoof(g, x, y, z, w, h, Lr, m) {
  m = rs(m);
  part(g, roofG(w, h, Lr), m, x, y, z, true);
  part(g, box(Lr + .1, .12, .14), B.beam, x, y + h + .02, z);
  for (const s of [-1, 1]) for (const k of [-1, 1]) { const b = part(g, box(.11, .7, .11), B.beam, x + s * (Lr / 2 + .02), y + h + .12, z + k * .16); b.rotation.x = k * .75; }
  roofDetails(g, x, y, z, w, h, Lr, m);
}
// Kieloben liegender Bootsrumpf als Dach (Salzbund): Halbzylinder entlang X mit Kiel und Spanten.
function hullRoof(g, x, y, z, w, h, Lr) {
  const m = RV ? roofOf('hull', RV.i) : roofOf('hull', 0);
  const hull = part(g, geo(`hull${w},${Lr}`, () => new THREE.CylinderGeometry(w / 2, w / 2, Lr, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), m, x, y, z, true);
  hull.scale.set(1, h / (w / 2), 1);
  part(g, box(Lr + .5, .14, .14), L.woodD, x, y + h + .04, z, true); // Kiel
  const st = part(g, box(.14, .9, .14), L.woodD, x + Lr / 2 + .2, y + h + .2, z); st.rotation.z = -.35; // Steven
  const nr = Math.max(2, Math.round(Lr / 1.1)); for (let i = 0; i < nr; i++) { const r = part(g, tor(w / 2 + .02, .04, Math.PI), L.woodD, x - Lr / 2 + (i + .5) * Lr / nr, y, z); r.rotation.y = Math.PI / 2; r.scale.y = h / (w / 2); }
  roofDetails(g, x, y, z, w, h * .9, Lr, m, true);
}
function archDoor(g, x, y, z, w, h, m = B.door, face = 'z') {
  const d = part(g, box(face === 'z' ? w : .12, h, face === 'z' ? .12 : w), m, x, y + h / 2, z);
  const a = part(g, cyl(w / 2, w / 2, .12, 12, ), m, x, y + h, z); a.rotation.x = face === 'z' ? Math.PI / 2 : 0; a.rotation.z = face === 'z' ? 0 : Math.PI / 2;
  return d;
}
function brazier(g, x, z, h = 1.1, s = .8) {
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, l = part(g, cyl(.035, .035, h * 1.05, 4), L.iron, x + Math.cos(a) * .16, h / 2, z + Math.sin(a) * .16); l.rotation.z = Math.cos(a) * .18; l.rotation.x = -Math.sin(a) * .18; }
  part(g, cyl(.3, .16, .26, 8), L.iron, x, h, z); part(g, cyl(.24, .24, .06, 8), L.ember, x, h + .1, z);
  fire(g, x, h + .55, z, s); pool(g, x, z, 1.6, .07);
}
function torch(g, x, y, z, s = .45) { part(g, cyl(.04, .03, .5, 5), L.woodD, x, y, z); fire(g, x, y + .38, z, s); }
function palisade(g, pts, h = 1.3) {
  for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c, d] = pts[i + 1], L2 = Math.hypot(c - a, d - b), n = Math.max(1, Math.round(L2 / .26));
    for (let k = 0; k < n; k++) { const t = (k + .5) / n, hh = h * (.9 + ((k * 13 + i * 7) % 5) * .04); part(g, cyl(.11, .12, hh, 6), L.woodD, a + (c - a) * t, hh / 2, b + (d - b) * t, true); part(g, cone(.11, .3, 6), L.wood, a + (c - a) * t, hh + .15, b + (d - b) * t); } }
}
const bannerW = () => mat(0x2f5f86, { side: THREE.DoubleSide, roughness: 1 });
const bannerA = () => mat(0x7a1e12, { side: THREE.DoubleSide, roughness: 1 });

/* ---------- Grenzwacht: nordische Steinburg, Fachwerkhallen, Schieferdächer ---------- */
// Holzstapel: Stämme liegen längs X, Reihen werden nach oben weniger (Pyramide)
function logPile(g, x, z, len, rows, m, rad = .21) {
  for (let row = 0; row < rows; row++) for (let i = 0; i < rows - row; i++) {
    const l = part(g, cyl(rad, rad, len, 8), m, x, rad + row * rad * 1.75, z + (i - (rows - row - 1) / 2) * rad * 2.05, true); l.rotation.z = Math.PI / 2;
    part(g, cyl(rad * .8, rad * .8, .02, 8), L.stone, x + len / 2 + .01, rad + row * rad * 1.75, z + (i - (rows - row - 1) / 2) * rad * 2.05).rotation.z = Math.PI / 2; // Schnittfläche
  }
}
// Marktstand: Tisch, Waren, Sonnensegel aus zwei Farben
function stall(g, x, z, w, c1, c2, rot = 0) {
  const st = new THREE.Group(); st.position.set(x, 0, z); st.rotation.y = rot; g.add(st);
  part(st, box(w, .62, .6), L.wood, 0, .31, 0, true);
  for (const dx of [-w / 2 + .05, w / 2 - .05]) part(st, cyl(.04, .04, 1.5, 5), L.woodD, dx, .75, -.28);
  const n = Math.max(2, Math.round(w / .35));
  for (let i = 0; i < n; i++) { const a = part(st, box(w / n, .05, .85), i % 2 ? c1 : c2, -w / 2 + (i + .5) * w / n, 1.42, -.12); a.rotation.x = .28; }
  for (let i = 0; i < 3; i++) part(st, sph(.1 + (i % 2) * .03, 7, 5), mat([0xc9a44a, 0x9a3a2a, 0x6f8a35][i]), -w * .3 + i * w * .3, .72, .05);
  return st;
}
function bWacht(type) {
  const g = new THREE.Group(); g.userData.smoke = [];
  if (type === 'hq') {
    part(g, box(5.9, .45, 5.9), L.stoneD, 0, -.05, 0, true);
    // Ringmauer mit Torhaus vorne (+Z)
    const wh = 1.7, wt = .42;
    part(g, box(5.2, wh, wt), L.stone, 0, wh / 2, -2.6, true); crenRect(g, 0, wh, -2.6, 5.2, 0, L.stone);
    for (const s of [-1, 1]) { part(g, box(wt, wh, 5.2), L.stone, s * 2.6, wh / 2, 0, true); part(g, box(1.7, wh, wt), L.stone, s * 1.75, wh / 2, 2.6, true); }
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { part(g, box(.3, .34, .3), L.stone, s * 2.6, wh + .17, -2.2 + i * .88, true); }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(g, box(.3, .34, .3), L.stone, s * (1.1 + i * .62), wh + .17, 2.6, true);
    // Torhaus
    part(g, box(1.6, 2.6, 1.0), L.stone, 0, 1.3, 2.6, true); crenRect(g, 0, 2.6, 2.6, 1.6, 1.0, L.stone, .26);
    archDoor(g, 0, 0, 3.12, .8, 1.0); part(g, box(.62, .9, .05), L.warm, 0, .55, 3.0);
    torch(g, -.62, 1.25, 3.18); torch(g, .62, 1.25, 3.18);
    part(g, box(.3, .14, .06), L.warm, 0, 2.0, 3.12);
    // Ecktürme mit Schieferhauben
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
      part(g, cyl(.72, .84, 2.9, 14), L.stone, x, 1.45, z, true); part(g, cyl(.8, .8, .12, 14), L.stoneD, x, 2.9, z);
      part(g, cone(.95, 1.7, 14), rs(B.slate), x, 3.8, z, true); part(g, box(.14, .34, .06), L.warm, x, 2.1, z + (z > 0 ? .78 : -.78));
    }
    // Bergfried: hoher Hauptturm mit Zinnen und spitzem Dach
    part(g, box(2.3, 4.6, 2.1), L.stone, -.7, 2.3, -.8, true); part(g, box(2.5, .2, 2.3), L.stoneD, -.7, 4.65, -.8); crenRect(g, -.7, 4.75, -.8, 2.4, 2.2, L.stone, .28);
    part(g, box(1.2, 2.0, 1.2), L.stone, -1.1, 5.8, -1.2, true); crenRect(g, -1.1, 6.8, -1.2, 1.2, 1.2, L.stone, .22);
    const sp = part(g, cyl(0, 1.0, 1.9, 4), rs(B.slate), -1.1, 7.95, -1.2, true); sp.rotation.y = Math.PI / 4;
    for (const y of [1.6, 2.7, 3.8]) part(g, box(.22, .42, .05), L.warm, -.7 + (y % 2 ? .45 : -.45), y, .28);
    part(g, box(.22, .42, .05), L.warm, -1.1, 5.9, -.58); part(g, box(.05, .42, .22), L.warm, .46, 3.2, -.8);
    // Große Halle mit Fachwerk-Obergeschoss
    part(g, box(2.4, 1.2, 1.7), L.stone, 1.2, .6, -1.25, true); timber(g, 1.2, 1.2, -1.25, 2.4, 1.0, 1.7); hallRoof(g, 1.2, 2.2, -1.25, 2.0, 1.4, 2.6, rs(B.slate));
    for (const x of [.6, 1.2, 1.8]) part(g, box(.22, .32, .05), L.warm, x, 1.7, -.36);
    part(g, box(.4, 1.4, .4), L.stoneD, 2.1, 3.0, -1.6, true); g.userData.smoke.push([2.1, 3.9, -1.6], [-1.2, 5.0, -1.8]);
    banner(g, -1.1, 8.6, -1.2, bannerW(), 1.4); banner(g, 2.6, 4.4, 2.6, bannerW(), .9); banner(g, -2.6, 4.4, 2.6, bannerW(), .9);
    brazier(g, -1.2, 2.0, 1.0); brazier(g, 1.2, 2.0, 1.0);
    crates(g, 1.4, .7, 2); barrel(g, -1.9, .9); barrel(g, -1.6, 1.5);
    drift(g, -3.1, 1.6, 1.2, 1.4); drift(g, 3.1, -1.2, 1.1, 1.6); drift(g, -2.9, -3.0, 1.4, .9); drift(g, 1.9, -3.1, 1.6, .8);
    icicles(g, .1, 2.3, 2.15, -.38, 7);
    pool(g, 0, 3.4, 2.4);
  } else if (type === 'barracks') { // Langhalle der Wache
    part(g, box(3.7, .3, 3.7), L.stoneD, 0, -.05, 0);
    part(g, box(3.3, .5, 1.9), L.stone, 0, .25, -.3, true); timber(g, 0, .5, -.3, 3.3, 1.2, 1.9);
    hallRoof(g, 0, 1.7, -.3, 2.5, 1.75, 3.7, rs(B.slate));
    archDoor(g, 0, .3, .68, .7, .95); part(g, box(.5, .7, .04), L.warm, 0, .7, .62);
    for (const x of [-1.1, -.55, .6, 1.15]) part(g, box(.24, .3, .05), L.warm, x, 1.3, .68);
    part(g, box(.42, 1.6, .42), L.stoneD, -1.3, 3.0, -.9, true); g.userData.smoke.push([-1.3, 3.9, -.9]);
    // Waffengestell und Übungspuppe
    part(g, box(1.2, .08, .08), L.woodD, 1.0, .9, 1.35); for (let i = 0; i < 4; i++) { const sp2 = part(g, cyl(.025, .025, 1.6, 4), L.wood, .6 + i * .28, .8, 1.3); sp2.rotation.x = .2; part(g, cone(.05, .2, 4), L.steel, .6 + i * .28, 1.6, 1.46); }
    part(g, cyl(.06, .06, 1.4, 5), L.woodD, -1.2, .7, 1.4); part(g, box(.9, .08, .08), L.woodD, -1.2, 1.15, 1.4); part(g, sph(.2, 7, 5), L.hay, -1.2, 1.45, 1.4); part(g, cyl(.18, .22, .5, 7), L.hay, -1.2, .85, 1.4);
    torch(g, -.55, 1.0, .74); torch(g, .55, 1.0, .74);
    banner(g, 1.7, 1.2, 1.6, bannerW(), 1.1); barrel(g, 1.6, -1.6); drift(g, -1.8, -1.6, 1.2, .9); drift(g, 1.8, .2, .8, 1.0);
    icicles(g, -1.6, 1.6, 1.68, .7, 9);
  } else if (type === 'workshop') { // Schmiede mit Esse und offenem Schuppen
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0);
    part(g, box(2.0, 1.7, 1.6), L.stone, -.8, .85, -.9, true); hallRoof(g, -.8, 1.7, -.9, 1.8, 1.1, 2.2, rs(B.roofWood));
    part(g, box(.8, 3.6, .8), L.stone, -1.5, 1.8, -1.4, true); part(g, box(.95, .2, .95), L.stoneD, -1.5, 3.65, -1.4); g.userData.smoke.push([-1.5, 3.9, -1.4], [-1.5, 3.9, -1.3]);
    for (const [x, z] of [[.3, -.1], [1.6, -.1], [.3, 1.5], [1.6, 1.5]]) part(g, box(.14, 1.7, .14), L.woodD, x, .85, z, true);
    const lean = part(g, box(1.6, .1, 1.9), rs(B.roofWood), .95, 1.75, .7, true); lean.rotation.x = .18;
    part(g, box(1.0, .7, .9), L.stoneD, .5, .35, .2, true); part(g, box(.8, .08, .7), L.ember, .5, .72, .2); fire(g, .5, 1.0, .2, .6);
    part(g, box(.5, .3, .26), L.iron, 1.2, .55, 1.0, true); part(g, box(.24, .4, .2), L.woodD, 1.2, .2, 1.0); // Amboss
    const wh2 = part(g, cyl(.35, .35, .12, 14), L.stone, 1.75, .45, -1.4); wh2.rotation.x = Math.PI / 2; part(g, box(.1, .5, .5), L.woodD, 1.75, .25, -1.4);
    for (let i = 0; i < 3; i++) part(g, sph(.5 - i * .1, 7, 5), mat(0x1b1a1a, { roughness: 1 }), -1.5 + i * .3, .1, 1.2 + i * .1).scale.y = .45;
    barrel(g, -.2, 1.6); crates(g, 1.4, -.6, 1); drift(g, -1.9, .6, .9, 1.2);
    pool(g, .5, .4, 2.2);
  } else if (type === 'farm') { // Scheune und verschneites Feld
    part(g, box(3.7, .25, 3.7), L.dirt, 0, -.05, 0);
    timber(g, -.8, .1, -.8, 2.0, 1.1, 1.6); hallRoof(g, -.8, 1.2, -.8, 2.0, 1.3, 2.4, rs(B.thatch));
    archDoor(g, -.8, .1, .03, .8, .7);
    for (let i = 0; i < 4; i++) part(g, box(1.7, .12, .22), L.dirt, .9, .08, .3 + i * .42);
    palisade(g, [[-.1, -.1], [1.9, -.1], [1.9, 1.85], [-.1, 1.85]], .55);
    for (const [x, z] of [[-1.6, 1.2], [-1.0, 1.4]]) { const h = part(g, cyl(.32, .32, .5, 10), L.hay, x, .32, z, true); h.rotation.z = Math.PI / 2; }
    lantern(g, -1.75, .5, 1.2); drift(g, 1.8, -1.6, 1.0, .7); drift(g, -1.9, -1.7, .9, .8);
  } else if (type === 'outpost') { // Wachposten mit Palisade
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0);
    timber(g, -.3, .1, -.3, 2.0, 1.3, 1.7); hallRoof(g, -.3, 1.4, -.3, 2.0, 1.3, 2.4, rs(B.roofWood));
    archDoor(g, -.3, .1, .57, .6, .8); part(g, box(.24, .3, .05), L.warm, .5, 1.0, .57);
    palisade(g, [[-1.75, 1.75], [-1.75, -1.75], [1.75, -1.75], [1.75, .4]], 1.2);
    for (const [x, z] of [[1.75, 1.75], [-1.75, 1.75]]) { part(g, box(.14, 2.4, .14), L.woodD, x, 1.2, z, true); part(g, box(.6, .1, .6), L.wood, x, 2.3, z); }
    brazier(g, 1.2, 1.3, .9, .6); crates(g, .7, -1.2, 2); barrel(g, -1.3, 1.2);
    banner(g, -1.75, 2.0, 1.75, bannerW(), .8); g.userData.smoke.push([-.9, 2.4, -.6]); part(g, box(.3, .8, .3), L.stoneD, -.9, 2.0, -.6);
    drift(g, -1.6, -1.6, 1.0, .8);
  } else if (type === 'lumber') { // Holzlager: Schleppdach über Stapeln, Hackklotz mit Axt
    part(g, box(3.7, .25, 3.7), L.dirt, 0, -.05, 0);
    logPile(g, -.2, -.5, 2.4, 4, L.wood); logPile(g, -.2, -1.45, 2.4, 3, L.woodD);
    for (const [x, z] of [[-1.5, -1.9], [1.1, -1.9], [-1.5, .55], [1.1, .55]]) part(g, box(.12, 2.1, .12), L.woodD, x, 1.05, z, true);
    const lean = part(g, box(3.0, .1, 2.8), rs(B.roofWood), -.2, 2.0, -.7, true); lean.rotation.x = .16; snowRoof(g, 1.8, .22, 2.8, 2.05, -.2, -.7);
    const st = part(g, cyl(.34, .4, .5, 10), L.wood, 1.2, .25, 1.1, true); part(st, box(.06, .62, .06), L.woodD, .1, .5, 0).rotation.z = -.5; part(st, box(.22, .12, .04), L.steel, .26, .78, 0).rotation.z = -.5; // Axt im Klotz
    part(g, box(1.1, .5, .12), L.wood, -1.0, .42, 1.3, true); part(g, box(1.1, .5, .12), L.wood, -1.0, .42, 1.0, true); part(g, cyl(.16, .16, 1.0, 8), L.wood, -1.0, .8, 1.15).rotation.z = Math.PI / 2; // Sägebock
    for (let i = 0; i < 6; i++) part(g, sph(.18, 6, 4), mat(0xb89a64), .4 + (i % 3) * .3, .05, 1.5 + Math.floor(i / 3) * .25).scale.set(1, .25, 1); // Späne
    banner(g, 1.7, 1.2, 1.6, bannerW(), .7); drift(g, -1.8, 1.7, 1.0, .8); lantern(g, -1.7, .3, 1.2);
  } else if (type === 'market') { // Handelshaus: Fachwerkkontor, Stände davor, Waage
    part(g, box(3.7, .3, 3.7), L.stoneD, 0, -.05, 0);
    part(g, box(2.4, 1.0, 1.6), L.stone, 0, .5, -.9, true); timber(g, 0, 1.0, -.9, 2.4, 1.0, 1.6); hallRoof(g, 0, 2.0, -.9, 2.1, 1.2, 2.6, B.slate);
    archDoor(g, -.5, .3, -.08, .6, .8); part(g, box(.4, .3, .05), L.warm, .6, 1.5, -.08);
    stall(g, -1.0, 1.2, 1.3, mat(0x2f5f86), mat(0xd8d0b0)); stall(g, 1.05, 1.2, 1.3, mat(0x7a1e12), mat(0xd8d0b0));
    const pole = part(g, cyl(.05, .05, 1.8, 6), L.woodD, 1.7, .9, -.2); part(pole, box(.9, .05, .05), L.gold, 0, .85, 0); for (const z of [-.4, .4]) part(pole, cyl(.2, .2, .03, 10), L.gold, z * 0 + (z > 0 ? .4 : -.4), .6, 0); // Waage
    crates(g, -1.6, -.2, 2); barrel(g, 1.5, .5); barrel(g, 1.7, .9); torch(g, -.9, 1.0, .0); banner(g, 1.7, 2.0, -1.6, bannerW(), 1.0); drift(g, -1.8, 1.7, 1.0, .8);
    g.userData.smoke.push([.9, 3.4, -1.2]); part(g, box(.4, 1.2, .4), L.stoneD, .9, 2.8, -1.2, true);
  } else { // Wachturm aus Stein mit Holzhaube
    part(g, box(1.9, .4, 1.9), L.stoneD, 0, -.05, 0);
    part(g, cyl(.72, .9, 4.4, 14), L.stone, 0, 2.2, 0, true);
    part(g, cyl(.92, .78, .5, 14), L.stoneD, 0, 4.55, 0, true); crenRound(g, 0, 4.8, 0, .82, L.stone, 9);
    part(g, cyl(.06, .06, 1.1, 4), L.woodD, 0, 5.4, 0);
    part(g, cone(1.05, 1.3, 9), rs(B.roofWood), 0, 6.3, 0, true);
    for (const [y, a] of [[1.6, 0], [2.8, 1.6], [3.8, .8]]) part(g, box(.1, .4, .14), L.warm, Math.cos(a) * .8, y, Math.sin(a) * .8).rotation.y = -a;
    archDoor(g, 0, .15, .9, .5, .7);
    fire(g, 0, 5.2, 0, .7);
    banner(g, .6, 6.2, 0, bannerW(), .7); drift(g, -.8, .6, .9, .8);
  }
  return g;
}

/* ---------- Aschenhorde: schwarzer Stein, Eisenzacken, Häute und Knochen ---------- */
function bAsch(type) {
  const g = new THREE.Group(); g.userData.smoke = [];
  const spikes = (cx, cz, w, n, h = 1, ax = 'x') => { for (let i = 0; i < n; i++) { const t = -w / 2 + (i + .5) * w / n; const c = part(g, cone(.12, .9 * h, 4), L.iron, ax === 'x' ? cx + t : cx, .45 * h + .1, ax === 'x' ? cz : cz + t); c.rotation.z = ((i * 7) % 3 - 1) * .12; } };
  const skull = (x, y, z) => { part(g, sph(.17, 6, 5), L.bone, x, y, z); part(g, box(.14, .08, .1), L.iron, x, y - .12, z + .1); };
  const pyr = (rt, rb, h, m, x, y, z) => { const p = part(g, cyl(rt, rb, h, 4), m, x, y, z, true); p.rotation.y = Math.PI / 4; return p; };
  if (type === 'hq') {
    part(g, box(5.9, .4, 5.9), B.blackD, 0, -.05, 0);
    pyr(3.0, 3.9, 1.6, B.black, 0, .8, 0); pyr(2.1, 2.7, 1.9, B.black, -.2, 2.55, -.3); pyr(1.2, 1.7, 1.8, B.blackD, -.3, 4.35, -.4);
    const sp = pyr(0, .7, 2.8, B.blackD, -.3, 6.6, -.4);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4, h = part(g, cone(.18, 1.6, 4), L.iron, -.3 + Math.cos(a) * .95, 5.6, -.4 + Math.sin(a) * .95); h.rotation.z = -Math.cos(a) * .5; h.rotation.x = Math.sin(a) * .5; }
    for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) { pyr(.2, .7, 3.6, B.black, x, 1.8, z); part(g, cone(.25, 1.0, 4), L.iron, x, 4.1, z); }
    // Schlund: glühendes Tor
    part(g, box(1.6, 1.6, .5), B.blackD, 0, .8, 2.45, true); part(g, box(1.1, 1.2, .1), L.ember, 0, .65, 2.7);
    for (let i = 0; i < 5; i++) part(g, cone(.08, .4, 4), L.bone, -.45 + i * .22, 1.35, 2.75).rotation.x = Math.PI;
    for (const y of [2.2, 3.9]) for (const x of [-.9, -.3, .3]) part(g, box(.3, .1, .06), L.ember, x - .2, y, y > 3 ? .45 : 1.1);
    spikes(0, 2.95, 5.6, 12, 1.1); spikes(0, -2.95, 5.6, 12, 1.1); spikes(2.95, 0, 5.6, 12, 1.1, 'z'); spikes(-2.95, 0, 5.6, 12, 1.1, 'z');
    for (const s of [-1, 1]) { skull(s * .55, 1.75, 2.72); brazier(g, s * 1.5, 3.3, 1.2, .9); }
    fire(g, -.3, 8.3, -.4, 1.3); banner(g, 1.4, 3.6, 1.4, bannerA(), 1.4); banner(g, -1.9, 3.4, 1.2, bannerA(), 1.2);
    g.userData.smoke.push([-.3, 8.6, -.4]); pool(g, 0, 3, 3.5);
  } else if (type === 'barracks') { // Kriegshalle: Hautdach auf schwarzem Sockel
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0); part(g, box(3.2, 1.0, 2.4), B.black, 0, .5, -.2, true);
    hallRoof(g, 0, 1.0, -.2, 3.0, 1.6, 3.6, L.hideA); for (let i = 0; i < 7; i++) part(g, cone(.1, .55, 4), L.bone, -1.5 + i * .5, 2.75, -.2);
    part(g, box(.9, .9, .1), L.ember, 0, .5, 1.02); for (let i = 0; i < 4; i++) part(g, cone(.07, .32, 4), L.bone, -.32 + i * .21, .98, 1.08).rotation.x = Math.PI;
    for (const x of [-1.2, 1.2]) { part(g, cyl(.06, .06, 2.4), L.woodD, x, 1.2, 1.4); skull(x, 2.5, 1.4); }
    brazier(g, 1.6, 1.6, .9, .7); spikes(0, 1.75, 3.4, 8, .8); part(g, cyl(.38, .38, .5, 8), L.hideA, -1.6, .3, 1.6);
    banner(g, -1.7, 1.0, -1.5, bannerA(), 1.1);
  } else if (type === 'workshop') { // Schmiedegrube
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0);
    part(g, box(2.4, .3, 2.4), L.emberDim, 0, .12, 0);
    for (const [x, z, w, d] of [[0, 1.3, 2.8, .35], [0, -1.3, 2.8, .35], [1.3, 0, .35, 2.4], [-1.3, 0, .35, 2.4]]) part(g, box(w, .8, d), B.black, x, .45, z, true);
    part(g, box(.8, .5, .5), L.ironL, 0, .75, 0, true); part(g, box(.3, .4, .7), L.ironL, 0, 1.15, 0);
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5]]) { pyr(.3, .6, 3.4, B.blackD, x, 1.7, z); g.userData.smoke.push([x, 3.6, z]); fire(g, x, 3.5, z, .7); }
    for (let i = 0; i < 3; i++) part(g, cyl(.04, .04, 1.1), L.steel, 1.3 + i * .2, .9, 1.6).rotation.z = .5;
    skull(-1.6, .9, 1.6); pool(g, 0, 0, 2.2, .15);
  } else if (type === 'farm') { // Pferch
    part(g, box(3.6, .25, 3.6), L.dirt, 0, -.05, 0);
    palisade(g, [[-1.7, -1.7], [1.7, -1.7], [1.7, 1.7], [-1.7, 1.7], [-1.7, -.6]], .9);
    part(g, box(1.6, .8, 1.2), B.black, -.8, .4, -.8, true); hallRoof(g, -.8, .8, -.8, 1.5, .9, 1.9, L.hideA);
    part(g, cyl(.5, .6, .7, 8), L.hay, .9, .35, .9); part(g, cyl(.45, .45, .5, 8), L.hay, 1.1, .3, -.7); skull(1.7, 1.1, 1.7);
  } else if (type === 'outpost') { // Glutlager
    part(g, box(3.6, .3, 3.6), L.dirt, 0, -.05, 0); part(g, box(2.4, .9, 2.0), B.black, -.3, .45, -.2, true);
    hallRoof(g, -.3, .9, -.2, 2.4, 1.4, 2.8, L.hideA); for (let i = 0; i < 5; i++) part(g, cone(.1, .5, 4), L.bone, -1.3 + i * .5, 2.4, -.2);
    part(g, box(.8, .7, .1), L.ember, .1, .4, .82); brazier(g, 1.4, 1.3, 1.0, .8);
    spikes(-.3, 1.7, 2.8, 7, .8); part(g, cyl(.45, .5, .6, 8), L.hay, -1.5, .3, 1.4); skull(-1.2, 1.4, .82);
  } else if (type === 'lumber') { // Köhlerei: rauchender Kohlenmeiler, Stapel, Säcke
    part(g, box(3.6, .25, 3.6), L.dirt, 0, -.05, 0);
    const m = part(g, sph(1.25, 14, 9), mat(0x1c1a19, { roughness: 1 }), -.4, 0, -.3, true); m.scale.set(1, .72, 1);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; part(g, cyl(.06, .06, .5, 5), L.woodD, -.4 + Math.cos(a) * .95, .35, -.3 + Math.sin(a) * .95).rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); }
    part(g, cyl(.22, .26, .35, 8), L.emberDim, -.4, .98, -.3); fire(g, -.4, 1.3, -.3, .6); pool(g, -.4, -.3, 2.2, .1);
    g.userData.smoke.push([-.4, 1.5, -.3], [-.3, 1.4, -.2]);
    logPile(g, 1.0, 1.1, 1.8, 3, L.woodD, .19);
    for (let i = 0; i < 4; i++) part(g, sph(.26, 8, 6), mat(0x14110f, { roughness: 1 }), -1.5 + i * .38, .22, 1.3 + (i % 2) * .2).scale.set(1, .9, .8); // Kohlensäcke
    skull(1.5, .5, -.9); part(g, cyl(.05, .05, 1.8, 5), L.woodD, 1.5, .9, -.9); banner(g, 1.6, .9, -1.4, bannerA(), .8); spikes(0, 1.75, 3.0, 6, .6);
  } else if (type === 'market') { // Plünderbasar: Hautzelte um ein Feuer, Beute, Knochen
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0); part(g, cyl(1.7, 1.8, .18, 10), B.blackD, 0, .05, 0, true);
    for (const [x, z, r, h] of [[-.95, -.75, .85, 1.7], [.95, -.55, .75, 1.5], [-.1, .95, .8, 1.6]]) {
      part(g, cone(r, h, 7), L.hideA, x, h / 2 + .08, z, true); part(g, cone(r * .35, .4, 6), L.bone, x, h + .2, z); part(g, box(.4, .55, .06), mat(0x14110f), x, .35, z + r * .85); // Eingang
      for (let i = 0; i < 3; i++) part(g, cyl(.03, .03, h * .55, 4), L.woodD, x + Math.cos(i * 2.1) * r * .5, h * .7, z + Math.sin(i * 2.1) * r * .5).rotation.z = .3;
    }
    brazier(g, 0, 0, .8, .8);
    crates(g, 1.3, 1.1, 2); barrel(g, -1.6, 1.0); part(g, cyl(.05, .05, 1.8, 5), L.woodD, 1.6, .9, -1.4); skull(1.6, 1.9, -1.4); skull(-1.6, 1.1, -1.5);
    for (let i = 0; i < 4; i++) part(g, cone(.08, .5, 4), L.bone, -1.2 + i * .35, 1.3, 1.5).rotation.x = Math.PI; // Zähne an der Leine
    part(g, box(1.0, .08, .06), L.woodD, -.7, 1.1, 1.5); banner(g, 1.5, 1.2, 1.5, bannerA(), .9);
  } else { // Glutturm
    part(g, box(1.9, .4, 1.9), B.blackD, 0, -.05, 0); pyr(.45, .95, 4.4, B.black, 0, 2.2, 0);
    pyr(1.0, .6, .8, B.blackD, 0, 4.7, 0); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; part(g, cone(.13, .8, 4), L.iron, Math.cos(a) * .8, 5.4, Math.sin(a) * .8); }
    part(g, box(.2, .6, .08), L.ember, .5, 2.6, .3); skull(.62, 3.4, .1);
    fire(g, 0, 5.6, 0, 1.2); pool(g, 0, 0, 2.2);
  }
  return g;
}
/* ---------- Salzbund: gekalkter Stein, geteertes Holz, Bootsrumpf-Dächer, Leuchtfeuer, Salzhaufen ---------- */
const BS = {
  lime: surf(0xbdb9ae, 'stone', {}, .7, .45), limeD: surf(0x8f8c84, 'stone', {}, .55, .4), tar: surf(0x2c2724, 'planks', {}, .6, .3),
  band: surf(0x4a3a78, 'rough', { roughness: .9 }, .4, .2), copper: mat(0x4f7d6e, { metalness: .5, roughness: .45 }),
  fish: mat(0xaab4b8, { metalness: .4, roughness: .4 }), net: mat(0x6a6250, { roughness: 1 })
};
const bannerS = () => mat(0x5b4a8a, { side: THREE.DoubleSide, roughness: 1 });
function saltPile(g, x, z, s = 1) { part(g, cone(.5 * s, .55 * s, 9), SZ.salt, x, .27 * s, z, true); part(g, cone(.3 * s, .35 * s, 7), SZ.salt, x + .35 * s, .17 * s, z + .2 * s); }
function fishRack(g, x, z, len = 1.4) {
  for (const dx of [-len / 2, len / 2]) part(g, cyl(.04, .05, 1.2, 5), L.woodD, x + dx, .6, z);
  part(g, cyl(.025, .025, len + .2, 4), L.woodD, x, 1.15, z).rotation.z = Math.PI / 2;
  for (let i = 0; i < Math.round(len * 5); i++) part(g, box(.05, .28, .09), BS.fish, x - len / 2 + .1 + i * .2, .95, z);
}
function lanternRoom(g, x, y, z, r = .55) { // Laternenhaus mit Glas, Lichtkern, Galerie und Kupferhaube
  part(g, cyl(r + .45, r + .45, .14, 16), L.iron, x, y, z);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; part(g, cyl(.02, .02, .4, 4), L.iron, x + Math.cos(a) * (r + .4), y + .25, z + Math.sin(a) * (r + .4)); }
  part(g, tor(r + .4, .025), L.iron, x, y + .44, z).rotation.x = Math.PI / 2;
  part(g, cyl(r, r, .9, 12), L.glass, x, y + .55, z); part(g, sph(r * .55, 10, 8), L.warm, x, y + .55, z);
  fire(g, x, y + .6, z, 1.1);
  part(g, cone(r + .15, .8, 12), BS.copper, x, y + 1.4, z, true); part(g, sph(.1, 6, 5), L.gold, x, y + 1.85, z);
}
function stripedTower(g, x, z, rb, rt, h, y0 = 0) {
  part(g, cyl(rt, rb, h, 16), BS.lime, x, y0 + h / 2, z, true);
  for (let k = 1; k < 4; k++) { const t = k / 4, r = rb + (rt - rb) * t; part(g, cyl(r + .02, r + .05, h * .1, 16), BS.band, x, y0 + h * t, z); }
}
function bSalz(type) {
  const g = new THREE.Group(); g.userData.smoke = [];
  if (type === 'hq') {
    part(g, box(5.9, .45, 5.9), BS.limeD, 0, -.05, 0, true);
    const wh = 1.3, wt = .4; // niedrige Ringmauer mit überdachtem Wehrgang aus Teerholz
    part(g, box(5.2, wh, wt), BS.lime, 0, wh / 2, -2.6, true);
    for (const s of [-1, 1]) { part(g, box(wt, wh, 5.2), BS.lime, s * 2.6, wh / 2, 0, true); part(g, box(1.7, wh, wt), BS.lime, s * 1.75, wh / 2, 2.6, true); }
    for (const [x, z, w, d] of [[0, -2.6, 5.4, .7], [-2.6, 0, .7, 5.4], [2.6, 0, .7, 5.4]]) part(g, box(w, .1, d), BS.tar, x, wh + .4, z, true);
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) part(g, box(.14, .5, .14), L.woodD, x, wh + .2, z);
    // Torhaus mit Bootsdach
    part(g, box(1.7, 1.9, 1.0), BS.lime, 0, .95, 2.6, true); hullRoof(g, 0, 1.9, 2.6, 1.2, .6, 1.9);
    archDoor(g, 0, 0, 3.12, .8, 1.0, BS.tar); part(g, box(.62, .9, .05), L.warm, 0, .55, 3.0);
    torch(g, -.62, 1.25, 3.18); torch(g, .62, 1.25, 3.18);
    // Leuchtturm: schlank, gekalkt, violette Bänder, Laternenhaus oben
    stripedTower(g, -1.3, -1.2, 1.05, .72, 6.4, .2);
    for (const y of [2.0, 3.6, 5.1]) part(g, box(.2, .38, .05), L.warm, -1.3 + .2, y, -1.2 + .86 - y * .025);
    lanternRoom(g, -1.3, 6.6, -1.2, .55);
    // Langhaus mit Bootsrumpf-Dach
    part(g, box(2.4, 1.3, 1.7), BS.lime, 1.2, .65, -1.1, true); part(g, box(2.5, .12, 1.8), BS.tar, 1.2, 1.3, -1.1);
    hullRoof(g, 1.2, 1.36, -1.1, 1.9, 1.1, 2.7);
    for (const x of [.6, 1.2, 1.8]) part(g, box(.22, .32, .05), L.warm, x, .8, -.24);
    part(g, box(.36, 1.2, .36), BS.limeD, 2.1, 2.0, -1.6, true); g.userData.smoke.push([2.1, 2.7, -1.6]);
    // Hof: Salz, Netze, ein Boot auf Böcken, Fahnen
    saltPile(g, 1.6, .9, 1); saltPile(g, -1.9, 1.2, .8); fishRack(g, .4, 1.6, 1.2);
    const boat = part(g, geo('boat', () => new THREE.CylinderGeometry(.5, .5, 2.2, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI)), BS.tar, -.2, .75, .4, true); boat.scale.set(1, .7, 1);
    for (const x of [-.9, .5]) part(g, box(.1, .5, .8), L.woodD, x, .25, .4);
    banner(g, 2.6, 1.6, 2.6, bannerS(), 1.1); banner(g, -2.6, 1.6, 2.6, bannerS(), 1.1); banner(g, 1.2, 2.5, -1.1, bannerS(), .9);
    brazier(g, -1.2, 2.0, 1.0); barrel(g, 1.9, -.2, BS.tar); barrel(g, 2.0, .35, BS.tar);
    drift(g, -3.1, 1.4, 1.2, 1.3); drift(g, 3.1, -1.4, 1.1, 1.4); drift(g, 1.8, -3.1, 1.5, .8);
    pool(g, 0, 3.4, 2.4);
  } else if (type === 'barracks') { // Bootshalle
    part(g, box(3.7, .3, 3.7), BS.limeD, 0, -.05, 0);
    part(g, box(3.2, 1.1, 2.1), BS.tar, 0, .55, -.3, true); hullRoof(g, 0, 1.1, -.3, 2.4, 1.3, 3.5);
    part(g, box(1.1, .9, .06), mat(0x14110f, { roughness: 1 }), 0, .45, .76); // offenes Tor
    const bow2 = part(g, cone(.35, .9, 4), BS.tar, 0, .5, .95); bow2.rotation.x = Math.PI / 2; bow2.scale.set(1, 1, .6); // Bug eines Bootes ragt heraus
    for (let i = 0; i < 4; i++) { const o = part(g, box(.06, 1.6, .12), L.wood, 1.1 + i * .14, .8, 1.2); o.rotation.z = .25; } // Riemen
    torch(g, -.7, 1.0, .82); torch(g, .7, 1.0, .82); fishRack(g, -1.1, 1.4, 1.0);
    banner(g, 1.7, 1.2, 1.6, bannerS(), 1.0); drift(g, -1.8, -1.6, 1.1, .9);
  } else if (type === 'workshop') { // Werft: Helling mit Spantenskelett, Kran, Holzstapel
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0);
    const sl = part(g, box(3.3, .12, 1.4), L.wood, 0, .2, .5); sl.rotation.z = -.06;
    part(g, box(2.8, .16, .14), L.woodD, 0, .45, .5, true); // Kiel
    for (let i = 0; i < 6; i++) { const r = part(g, tor(.6, .05, Math.PI), L.wood, -1.2 + i * .48, .5, .5); r.rotation.y = Math.PI / 2; r.rotation.z = Math.PI; r.scale.y = 1.2 - Math.abs(i - 2.5) * .15; } // Spanten
    part(g, box(.6, .8, .12), L.woodD, 1.45, .7, .5).rotation.z = -.3; // Vorsteven
    for (const z of [-1.2, .4]) part(g, box(.16, 2.6, .16), L.woodD, -1.4, 1.3, z, true);
    part(g, box(.16, .16, 2.0), L.woodD, -1.4, 2.6, -.4); const ar = part(g, box(2.0, .14, .14), L.woodD, -.5, 2.55, .4); ar.rotation.z = -.1; // Kranbalken
    part(g, cyl(.015, .015, 1.6, 4), SZ.rope, .4, 1.75, .4); part(g, box(.3, .3, .3), L.iron, .4, .9, .4);
    part(g, box(1.6, 1.1, 1.0), BS.lime, .7, .55, -1.3, true); hullRoof(g, .7, 1.1, -1.3, 1.2, .7, 1.9);
    part(g, box(.6, .4, .1), L.ember, .7, .3, -.78); fire(g, .7, .55, -.7, .5);
    for (let i = 0; i < 4; i++) part(g, cyl(.12, .12, 1.6, 7), L.wood, -1.0 + (i % 2) * .26, .14 + Math.floor(i / 2) * .22, -1.4).rotation.z = Math.PI / 2;
    g.userData.smoke.push([.7, 1.9, -1.3]); pool(g, .7, -.6, 1.8);
  } else if (type === 'farm') { // Räucherei: Hütte mit Rauch, Fischgestelle, Salz
    part(g, box(3.7, .25, 3.7), L.dirt, 0, -.05, 0);
    part(g, box(1.8, 1.0, 1.5), BS.lime, -.8, .5, -.8, true); hallRoof(g, -.8, 1.0, -.8, 1.8, 1.0, 2.1, B.thatch);
    archDoor(g, -.8, 0, -.04, .6, .6, BS.tar);
    fishRack(g, .9, .4, 1.4); fishRack(g, .9, 1.3, 1.4);
    saltPile(g, -1.4, 1.3, .7); barrel(g, -.4, 1.4, BS.tar);
    g.userData.smoke.push([-.8, 2.2, -.8], [-1.2, 2.0, -.6]);
    lantern(g, -1.75, .5, 1.1); drift(g, 1.8, -1.6, 1.0, .7);
  } else if (type === 'outpost') { // Salzlager mit Feuerkorb am Mast
    part(g, box(3.7, .3, 3.7), L.dirt, 0, -.05, 0);
    part(g, box(2.2, 1.1, 1.6), BS.tar, -.3, .55, -.5, true); hullRoof(g, -.3, 1.1, -.5, 1.7, .9, 2.5);
    archDoor(g, -.3, 0, .32, .6, .7, BS.tar);
    saltPile(g, 1.1, .9, 1.1); saltPile(g, -1.2, 1.2, .8); crates(g, .7, -1.4, 2);
    part(g, cyl(.06, .08, 3.2, 6), L.woodD, 1.4, 1.6, -1.2, true); brazier(g, 1.4, -1.2, 3.2, .6);
    banner(g, -1.7, 1.2, 1.6, bannerS(), .8); drift(g, -1.6, -1.6, 1.0, .8);
  } else if (type === 'lumber') { // Treibholzhof: gebleichte Stämme, Netze, Bootsrumpf als Unterstand
    part(g, box(3.7, .25, 3.7), L.dirt, 0, -.05, 0);
    const pale = mat(0xb8ad98, { roughness: 1 }), paleD = mat(0x8f8573, { roughness: 1 });
    for (const [x, z] of [[-1.3, -1.2], [1.0, -1.2]]) part(g, cyl(.08, .09, 1.7, 6), L.woodD, x, .85, z, true);
    hullRoof(g, -.15, 1.65, -1.2, 1.5, .6, 2.9);
    logPile(g, -.15, -1.2, 2.6, 3, pale, .2); logPile(g, -.4, .35, 2.2, 4, paleD, .19);
    for (let i = 0; i < 5; i++) part(g, cyl(.01, .01, 1.7, 3), SZ.rope, -1.7 + i * .3, 1.1, .35 + Math.sin(i) * .1).rotation.z = .2 + i * .06; // Netzschnüre
    part(g, box(1.4, .05, .7), mat(0x6a6250, { roughness: 1 }), 1.2, 1.3, .9).rotation.z = .12; // Netz über der Leine
    part(g, cyl(.04, .04, 1.4, 5), L.woodD, 1.9, .7, .9); part(g, cyl(.04, .04, 1.4, 5), L.woodD, .5, .7, .9);
    saltPile(g, 1.4, -.6, .8); barrel(g, 1.6, 1.5, BS.tar); banner(g, -1.8, 1.4, 1.5, bannerS(), .8); drift(g, -1.7, 1.7, 1.0, .8);
  } else if (type === 'market') { // Hafenmarkt: Bohlenplattform mit Sonnensegeln, Fisch, Waagen
    part(g, box(3.7, .28, 3.7), BS.tar, 0, .06, 0, true);
    for (let i = 0; i < 8; i++) part(g, box(.4, .04, 3.5), i % 2 ? L.wood : L.woodD, -1.55 + i * .44, .22, 0);
    stall(g, -.95, -1.0, 1.4, mat(0x5b4a8a), mat(0xe2e0dc)); stall(g, .95, -1.0, 1.4, mat(0x2e6f7e), mat(0xe2e0dc)); stall(g, 0, 1.0, 1.6, mat(0x8a74c4), mat(0xe2e0dc), Math.PI);
    fishRack(g, -1.4, 0.1, 1.0); saltPile(g, 1.5, .1, .8); barrel(g, 1.4, 1.5, BS.tar); barrel(g, 1.7, 1.2, BS.tar);
    const pole = part(g, cyl(.05, .05, 2.2, 6), L.woodD, 1.7, 1.2, -.1); lanternRoom(g, 1.7, 2.4, -.1, .18);
    banner(g, -1.7, 1.6, 1.5, bannerS(), 1.0); drift(g, -1.8, 1.8, 1.0, .8);
  } else { // Leuchtturm
    part(g, box(1.9, .4, 1.9), BS.limeD, 0, -.05, 0);
    stripedTower(g, 0, 0, .9, .6, 5.0, .15);
    for (const [y, a] of [[1.4, 0], [2.6, 1.8], [3.8, .9]]) part(g, box(.1, .36, .14), L.warm, Math.cos(a) * .76, y, Math.sin(a) * .76).rotation.y = -a;
    archDoor(g, 0, .15, .9, .5, .7, BS.tar);
    lanternRoom(g, 0, 5.15, 0, .45);
    banner(g, .7, 4.5, 0, bannerS(), .6); drift(g, -.8, .6, .9, .8);
  }
  return g;
}

function detailW() {}
function detailA() {}

// Fensterrahmen: Jedes leuchtende Fenster (warmes Glas als flacher Kasten) bekommt Rahmen, Kreuz und Sims aus
// dunklem Holz. Die Teile hängen am Fenster selbst und werden mit ihm verschmolzen.
function frameWindows(g) {
  const wins = []; g.traverse(o => { if (o.isMesh && o.material === L.warm && o.geometry.parameters && o.geometry.parameters.width !== undefined) wins.push(o); });
  for (const w of wins) {
    const { width: a, height: h, depth: b } = w.geometry.parameters;
    if (h < .14 || Math.max(a, h, b) > .55) continue; // Schlitze und Torglut bleiben ohne Rahmen
    const flatZ = b <= a, wd = flatZ ? a : b, th = flatZ ? b : a, t = .035, dd = th + .025, fm = B.beam;
    const bar = (bw, bh, x, y) => part(w, flatZ ? box(bw, bh, dd) : box(dd, bh, bw), fm, flatZ ? x : 0, y, flatZ ? 0 : x);
    bar(wd + t * 2, t, 0, h / 2 + t / 2); bar(wd + t * 2, t, 0, -h / 2 - t / 2); bar(t, h, wd / 2 + t / 2, 0); bar(t, h, -wd / 2 - t / 2, 0);
    bar(t * .6, h, 0, 0); if (h > .25) bar(wd, t * .6, 0, h * .12); // Kreuz
    part(w, flatZ ? box(wd + .1, .04, dd + .06) : box(dd + .06, .04, wd + .1), L.stoneD, 0, -h / 2 - t - .02, 0); // Sims
  }
}
export function buildBld(fac, type, seed = 1) {
  initTextures();
  if (type === 'wall') return bake(wallSeg(fac), 'b:' + fac + ':wall', new Set());
  const file = fromFile(fac + ':' + type);
  if (file) return withScaffold(file);
  RV = makeVariant(seed); RV.fac = fac;
  const g = fac === 'asch' ? bAsch(type) : fac === 'salz' ? bSalz(type) : bWacht(type);
  RV = null; frameWindows(g);
  g.userData.fac = fac;
  (fac === 'asch' ? detailA : detailW)(g, type);
  withScaffold(g);
  return bake(g, 'b:' + fac + ':' + type + ':' + seed, keepOf(g));
}
// Stadtmauer (Schlachten aus der Kampagne): ein Mauerstück mit Wehrgang und Zinnen, Stein nach Fraktion
let WALLST = null;
function wallSeg(fac) {
  WALLST ||= { wacht: surf(0x8a8b8f, 'stone', {}, .25), asch: surf(0x55565b, 'stone', {}, .2, .8), salz: surf(0xb8b1a1, 'stone', {}, .25) }; // wenig Schnee, damit der Stein sichtbar bleibt
  const g = new THREE.Group(), st = WALLST[fac] || L.stone;
  part(g, box(2.25, .3, 1.25), L.stoneD, 0, .15, 0, true);
  part(g, box(2.1, 1.9, 1.0), st, 0, 1.1, 0, true);
  part(g, box(2.2, .16, 1.14), L.stoneD, 0, 2.1, 0, true);
  for (const x of [-.78, 0, .78]) part(g, box(.44, .46, .32), st, x, 2.4, .4, true);
  for (const x of [-.78, 0, .78]) part(g, box(.44, .3, .26), st, x, 2.33, -.42, true);
  return g;
}
// Baugerüst, das während des Baus sichtbar ist
function withScaffold(g) {
  const sc = new THREE.Group();
  for (let i = 0; i < 4; i++) { const px = (i % 2 ? 1 : -1) * 1.5, pz = (i < 2 ? 1 : -1) * 1.5; part(sc, box(.14, 2.6, .14), L.wood, px, 1.3, pz); }
  part(sc, box(3.2, .1, .1), L.wood, 0, 2.4, 1.5); part(sc, box(.1, .1, 3.2), L.wood, 1.5, 2.4, 0);
  sc.visible = false; g.add(sc); g.userData.scaffold = sc;
  return g;
}

/* ---------- Modelle aus Dateien (Blender, glTF) ---------- */
// public/models/index.json nennt die vorhandenen Dateien, Schlüssel Fraktion:Typ, z. B. { "wacht:melee": "wacht_melee.glb" }.
// Fehlt ein Eintrag, baut der Code das Modell wie bisher. Maßstab: 1 = 1 Spieleinheit (16 Weltpixel), vorne ist +X.
// Animationen heißen stehen, gehen, angriff, arbeit, tod. In Gebäuden werden leere Objekte namens Rauch…, Feuer…
// und Teile namens Fahne… zu Rauchquellen, Flammen und wehenden Fahnen.
const FILES = new Map();
export function registerModel(key, gltf) {
  const sc = gltf.scene;
  sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  FILES.set(key, { scene: sc, clips: gltf.animations || [] });
}
export const hasModel = key => FILES.has(key);
export const clearModels = () => FILES.clear();
export async function loadModels(base = 'models/') {
  let idx;
  try { const r = await fetch(base + 'index.json'); if (!r.ok) return 0; idx = await r.json(); } catch (_) { return 0; }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const ld = new GLTFLoader(); let n = 0;
  await Promise.all(Object.entries(idx).map(async ([k, f]) => {
    try { registerModel(k, await ld.loadAsync(base + f)); n++; } catch (err) { console.warn('Modell fehlt oder ist defekt:', f, err); }
  }));
  return n;
}
function fromFile(key) {
  const f = FILES.get(key); if (!f) return null;
  const g = new THREE.Group(), m = skeletonClone(f.scene); g.add(m);
  g.userData.j = {}; g.userData.capes = []; g.userData.smoke = []; g.userData.fromFile = true;
  if (f.clips.length) {
    const mixer = new THREE.AnimationMixer(m), actions = {};
    for (const c of f.clips) actions[c.name.toLowerCase()] = mixer.clipAction(c);
    g.userData.anim = { mixer, actions, cur: null };
  }
  g.updateMatrixWorld(true);
  const marks = []; m.traverse(o => marks.push(o));
  for (const o of marks) {
    const n = o.name || '', p = new THREE.Vector3(); o.getWorldPosition(p);
    if (/^Rauch/i.test(n)) g.userData.smoke.push([p.x, p.y, p.z]);
    else if (/^Feuer/i.test(n)) fire(g, p.x, p.y, p.z, o.scale.x || 1);
    else if (/^Fahne/i.test(n) && o.isMesh) (g.userData.flags ||= []).push(o);
  }
  return g;
}
// Welche Animation zum Zustand passt; fehlt sie im Modell, wird stehen bzw. die erste genommen.
export function pickClip(e, striking) {
  if (e.dead) return 'tod';
  if (striking) return 'angriff';
  if (e.working) return 'arbeit';
  return e.moving ? 'gehen' : 'stehen';
}
export function playAnim(an, want, dt) {
  const act = an.actions[want] || an.actions.stehen || Object.values(an.actions)[0];
  if (act && an.cur !== act) { act.reset().fadeIn(.15).play(); if (an.cur) an.cur.fadeOut(.15); an.cur = act; an.name = want; }
  an.mixer.update(dt);
}
// Kopie mit eigenem Skelett, damit jede Einheit ihre Animation unabhängig abspielt.
const skeletonClone = o => SkeletonUtils.clone(o);
export const BLD_H = { wacht: { hq: 9.0, barracks: 3.8, workshop: 3.8, farm: 2.8, tower: 7, outpost: 3.0, lumber: 2.6, market: 4.2 }, asch: { hq: 8.4, barracks: 3.2, workshop: 3.4, farm: 2, tower: 6, outpost: 3, lumber: 2.4, market: 2.4 }, salz: { hq: 9.4, barracks: 3.4, workshop: 3.4, farm: 2.6, tower: 7.2, outpost: 3.4, lumber: 2.4, market: 3.4 } };

/* ---------- Erzader ---------- */
// Fels: Ikosaeder mit verschobenen Ecken, kantig wie gebrochener Stein (gleiche Ecke, gleiche Verschiebung).
export const rockGeo = (seed, r) => geo('rock' + seed + ',' + r, () => {
  const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, R = prng(seed * 131 + 7), off = new Map();
  const dirs = [0, 1, 2, 3].map(() => new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize());
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3);
    let f = off.get(k); if (f === undefined) { const n = v.clone().normalize(); f = 1 + dirs.reduce((s, d, j) => s + Math.max(0, n.dot(d)) * (j ? -.18 : .22), 0) + (R() - .5) * .12; off.set(k, f); }
    p.setXYZ(i, v.x * f, v.y * f * .8, v.z * f);
  }
  g.computeVertexNormals(); return g;
});
const ROCK = surf(0x5a5b60, 'rough', { roughness: .92 }, .45, .3, .7);
export function buildDep() {
  initTextures();
  const g = new THREE.Group(), cr = mat(0xd8a436, { emissive: 0xc07a14, emissiveIntensity: .9, roughness: .3, metalness: .4 });
  // Felsbrocken, aus denen das Erz bricht
  for (const [x, z, r, s] of [[0, 0, 1.25, 1], [1.0, .55, .8, 2], [-1.0, .45, .75, 3], [.35, -1.0, .85, 4], [-.6, -.8, .55, 5], [1.3, -.5, .45, 6]]) {
    const m = part(g, rockGeo(s, r), ROCK, x, r * .45, z, true); m.rotation.y = s * 1.7;
  }
  // Goldkristalle: sechseckige Säulen mit Spitze, büschelweise aus den Fugen
  const R = prng(11);
  for (let i = 0; i < 14; i++) {
    const a = R() * 6.28, d = .3 + R() * 1.1, h = .35 + R() * .9, w = .07 + R() * .08, c = pivot(g, Math.cos(a) * d, .25 + R() * .5, Math.sin(a) * d);
    c.rotation.set((R() - .5) * 1.1, R() * 3, (R() - .5) * 1.1);
    part(c, cyl(w, w * 1.15, h, 6), cr, 0, h / 2, 0, true); part(c, cone(w, w * 2.2, 6), cr, 0, h + w * 1.1, 0);
  }
  pool(g, 0, 0, 2.6, .1);
  return bake(g, 'dep', keepOf(g));
}

/* ---------- Bäume (instanziert) ---------- */
function tinted(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
// Schlanke Fichte: sieben Etagen, unregelmäßige Ränder, nach unten hängende Zweige, Farbverlauf nach oben, Schnee auf den oberen Hälften.
function jitterCone(r, h, y, seg, seed, droop) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, true).translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i), z = p.getZ(i);
    if (yy < h * .5) { // Rand
      const a = Math.atan2(z, x), j = 1 + .16 * Math.sin(a * 3 + seed * 2.1) + .1 * Math.sin(a * 5 + seed * 4.7);
      p.setXYZ(i, x * j, yy - droop * (.6 + .4 * Math.sin(a * 2 + seed)), z * j);
    }
  }
  g.translate(0, y, 0); g.computeVertexNormals(); return g;
}
function gradient(g, c0, c1, y0, y1) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), A = new THREE.Color(c0), B = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < n; i++) { c.copy(A).lerp(B, Math.max(0, Math.min(1, (g.attributes.position.getY(i) - y0) / (y1 - y0)))); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const PAL = {
  snow:    { lo: 0x14292a, hi: 0x2b5242, cap0: 0xcdd8e2, cap1: 0xf4f8fb },
  trocken: { lo: 0x4e4526, hi: 0x8b7a3c, cap0: 0xb99b62, cap1: 0xd9c48c },
  sumpf:   { lo: 0x1f3a26, hi: 0x3f6b3a, cap0: 0x4f6e3e, cap1: 0x7f9a5a },
  kueste:  { lo: 0x2a463c, hi: 0x4c7a62, cap0: 0x8d9a86, cap1: 0xc4cbb8 }
};
export function pineGeometry(kind = 'snow') {
  const P = PAL[kind] || PAL.snow;
  const parts = [tinted(new THREE.CylinderGeometry(.16, .3, 1.6, 6).translate(0, .8, 0), 0x3a2c22)];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), r = 1.65 * Math.pow(1 - t, .85) + .3, h = 1.7 - t * .35, y = 1.0 + i * .98;
    parts.push(gradient(jitterCone(r, h, y, 9, i + 1, .22), P.lo, P.hi, y - .3, y + h));
    parts.push(gradient(jitterCone(r * .8, h * .5, y + h * .5, 9, i + 1.7, .12), P.cap0, P.cap1, y + h * .5, y + h));
  }
  parts.push(gradient(jitterCone(.28, 1.1, 8.1, 7, 9, 0), P.hi, P.hi, 8, 9));
  return mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)));
}
export function deadTreeGeometry() {
  const dk = 0x241d1b, parts = [tinted(new THREE.CylinderGeometry(.1, .22, 3.4, 5).translate(0, 1.7, 0), dk)];
  const br = (x, y, z, rz, ry, len) => { const c = new THREE.CylinderGeometry(.03, .09, len, 4); c.translate(0, len / 2, 0); c.rotateZ(rz); c.rotateY(ry); c.translate(x, y, z); parts.push(tinted(c, dk)); };
  br(0, 1.4, 0, -.9, 0, 1.6); br(0, 2.0, 0, .9, 1.2, 1.5); br(0, 2.7, 0, -.6, 2.4, 1.2); br(0, 3.2, 0, .4, 4, .9);
  const ember = new THREE.SphereGeometry(.09, 5, 4).translate(.9, 2.6, .2); parts.push(tinted(ember, 0xff7a22));
  return mergeGeometries(parts.map(p => p.toNonIndexed()));
}

// Verfallene Mauerreste und Säulen als Kulisse in den Außengebieten (rein optisch).
export function ruinsGroup(seed = 1) {
  const g = new THREE.Group(); let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const stoneM = [L.stone, L.stoneD];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + r() * .6, rad = 1.6 + r() * 1.2, h = .6 + r() * 1.5;
    const w = part(g, box(1.5 + r(), h, .42), stoneM[i % 2], Math.cos(a) * rad, h / 2, Math.sin(a) * rad, true);
    w.rotation.y = a + Math.PI / 2 + (r() - .5) * .3; w.rotation.z = (r() - .5) * .12;
    if (r() > .5) part(w, box(.5, .35, .46), L.snow, (r() - .5), h / 2 + .1, 0);
  }
  for (let i = 0; i < 2; i++) { const h = 1.4 + r() * 1.3, a = r() * 6.28; const c = part(g, cyl(.22, .27, h, 8), L.stone, Math.cos(a) * 2.6, h / 2, Math.sin(a) * 2.6, true); if (i) { c.rotation.z = 1.25; c.position.y = .25; } }
  for (let i = 0; i < 7; i++) part(g, box(.3 + r() * .3, .2 + r() * .15, .3 + r() * .3), L.stoneD, (r() - .5) * 5, .1, (r() - .5) * 5).rotation.y = r() * 3;
  g.userData.own = true; return bake(g, 'ruin:' + seed);
}
