// 3D-Darstellung mit Three.js. Die Simulation bleibt flach (2D-Koordinaten); hier wird sie in eine geneigte Kamera,
// Gelände mit Schneedünen, Dunst und Fackellicht übersetzt. Ringe, Balken und Auswahl liegen als 2D-Ebene darüber.
import * as THREE from 'three';
import { TS, GW, GH, WW, WH, QUALITY } from './config.js';
import { REGIONS, regionAtCell, regionAt } from './regions.js';
import { evAt } from './events.js';
import { seasonAt } from './economy.js';
import { makePost } from './post.js';
import { G, UI, cam, view, rng, proj } from './state.js';
import { FACTIONS, defOf, MAX_HERO_LVL, facOf } from './factions.js';
import { shown } from './commands.js';
import { burst, floatText } from './render.js';
import * as MD from './models3d.js';

export { burst, floatText };

const S = 1 / 16, PITCH = 52 * Math.PI / 180, FOV = 36, MARGIN = 384, TSC = .7;
const FOG_TMP = new THREE.Color(), TREE_C = new THREE.Color();
// Wetter-Darstellung je Ereignis: Nebelfarbe, Dichte, Wind, Fallgeschwindigkeit, Partikelfarbe (bei voller Stärke)
const WEATHER = {
  storm:   { col: new THREE.Color(0xaab4bd), dens: 1.1, wind: 6,   fall: 1.2,  pc: [.92, .95, 1] },
  ash:     { col: new THREE.Color(0x5a4c46), dens: 1.4, wind: 1.5, fall: -.2,  pc: [.3, .25, .2] },
  dust:    { col: new THREE.Color(0x9a8566), dens: 1.3, wind: 8,   fall: -.75, pc: [.78, .64, .42] },
  flood:   { col: new THREE.Color(0x6a7b78), dens: .9,  wind: 1.2, fall: 3,    pc: [.6, .72, .85] },
  saltfog: { col: new THREE.Color(0xb4c2c8), dens: 2.0, wind: .5,  fall: -.9,  pc: [1, 1, 1] }
};
const FOGC = 0x5f6c7a, WU = WW * S, HU = WH * S;
let renderer = null, scene = null, camera = null, octx = null, mm = null, mctx = null, glc = null, ovc = null;
let world = null, sun = null, ready = false, dprNow = 1, shakeX = 0, shakeY = 0;
let mmBg = null, fogC = null, fogCtx = null, fogImg = null, fogBig = null, fogBigCtx = null, fogTex = null;
let post = null, postOn = true, wk = 0, snowK = 1, seasonK = 0; // seasonK: 0 mild bis 1 Hartfrost, weich nachgeführt
const FROST_C = new THREE.Color(0x9db8d8);
let Q = QUALITY.high;
const postActive = () => !!(post && postOn && Q.post);
export function setPost(on) { postOn = !!on; if (MD.GLOW) MD.GLOW.k = postActive() ? .2 : 1; }
// Grafikstufe wechseln: Pixeldichte, Schatten, Zahl der Punktlichter, Schnee und Nachbearbeitung.
export function setQuality(id) {
  Q = QUALITY[id] || QUALITY.high; if (!renderer) return;
  if (renderer.shadowMap.enabled !== Q.shadows) { renderer.shadowMap.enabled = Q.shadows; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
  sun.castShadow = Q.shadows;
  if (sun.shadow.mapSize.x !== Q.shadowMap) { sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  lights.forEach((l, i) => { l.visible = i < Q.lights; });
  snow.geometry.setDrawRange(0, Q.snow);
  if (post && post.setAO) post.setAO(!!Q.ao);
  setPost(postOn); resizeCanvas();
}
const LIGHTS_N = 8, lights = [], LI = { wacht: { hq: [34, 3.4], workshop: [36, 1.8], barracks: [16, 1.6], outpost: [18, 1.6], farm: [12, 1.4], tower: [16, 5.6] }, asch: { hq: [55, 2.4], workshop: [28, 1.4], barracks: [26, 1.4], outpost: [26, 1.6], farm: [6, 1], tower: [30, 4.8] }, salz: { hq: [42, 7.2], workshop: [24, 1.2], barracks: [16, 1.6], outpost: [24, 3.4], farm: [10, 1.2], tower: [30, 5.6] } };
const LCOL = { wacht: 0xffa25a, asch: 0xff7a33, salz: 0xffd9a0 };
const treeInst = new WeakMap(); // Baum → Platz in der Instanzgruppe, damit ein gefällter Baum verschwinden kann
let treesMesh = [], pts = null, snow = null, smokes = [], arrows = [];
const objs = new Map(), corpseObjs = new Map(), tmp = new THREE.Vector3(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/* ---------- Höhenfeld (nur Optik, die Simulation bleibt flach) ---------- */
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hAt(X, Z) {
  const dx = Math.max(0, -X, X - WU), dz = Math.max(0, -Z, Z - HU), out = Math.hypot(dx, dz);
  const dune = .22 * Math.sin(X * .21 + Z * .13) + .15 * Math.sin(X * .09 - Z * .17) + .08 * Math.sin(X * .47 + Z * .41);
  const rim = out > 0 ? Math.pow(out / 6, 1.55) * .95 * (1 + .3 * Math.sin(X * .5) * Math.sin(Z * .6)) : 0;
  return dune * (1 - sstep(0, 3, out)) + rim;
}

/* ---------- Partikel (eigener Shader: weiche Punkte mit Alpha) ---------- */
function makePoints(max, additive) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), siz = new Float32Array(max);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 }, uK: { value: 1 } },
    vertexShader: 'attribute vec4 color; attribute float size; varying vec4 vC; uniform float uScale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size*uScale/max(-mv.z,.5); }',
    fragmentShader: 'varying vec4 vC; uniform float uK; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,.15,d); gl_FragColor=vec4(vC.rgb,vC.a*a*uK); }'
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData = { pos, col, siz, max };
  return p;
}
const colCache = new Map();
function pc(s) {
  let v = colCache.get(s); if (v) return v;
  let r = 1, g = 1, b = 1, a = 1;
  if (s[0] === '#') { let h = s.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); r = ((n >> 16) & 255) / 255; g = ((n >> 8) & 255) / 255; b = (n & 255) / 255; }
  else { const m = s.match(/[\d.]+/g) || [255, 255, 255]; r = m[0] / 255; g = m[1] / 255; b = m[2] / 255; a = m[3] == null ? 1 : +m[3]; }
  v = [r, g, b, a]; colCache.set(s, v); return v;
}

/* ---------- Umgebungslicht ---------- */
// Ein im Code gemalter Nachthimmel als Umgebungskarte: Metall, Glas, Schnee und nasse Steine spiegeln ihn.
// Der Mond steht dort, woher das Mondlicht (sun) kommt; tief im Südosten glimmt der Widerschein der Feuer.
function skyEnvironment(r) {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float y = vP.y; vec3 zen = vec3(.045, .06, .1), hor = vec3(.34, .39, .47), gnd = vec3(.09, .09, .095);
        vec3 c = y > 0. ? mix(hor, zen, pow(y, .55)) : mix(hor * .55, gnd, pow(-y, .5));
        vec3 moon = normalize(vec3(-.58, .79, .21)); float d = max(0., dot(vP, moon));
        c += vec3(.78, .85, 1.) * (pow(d, 1200.) * 10. + pow(d, 14.) * .22);
        vec3 warm = normalize(vec3(.6, .06, .8)); c += vec3(1., .5, .2) * pow(max(0., dot(vP, warm)), 5.) * .3;
        gl_FragColor = vec4(c, 1.);
      }`
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), m));
  const pm = new THREE.PMREMGenerator(r), rt = pm.fromScene(s, .015); pm.dispose(); m.dispose();
  return rt.texture;
}

/* ---------- Aufbau ---------- */
export function attach3d(glCanvas, overlayCanvas, mini) {
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' }); } catch (_) { return false; }
  if (!r || !r.getContext()) return false;
  renderer = r; glc = glCanvas; ovc = overlayCanvas; octx = ovc.getContext('2d'); mm = mini; mctx = mm.getContext('2d');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  scene = new THREE.Scene(); scene.background = new THREE.Color(FOGC); scene.fog = new THREE.FogExp2(FOGC, .01);
  camera = new THREE.PerspectiveCamera(FOV, 1, 1, 700);
  // Kaltes Mondlicht von der Seite, schwaches Himmelslicht und ein warmer Gegenschein.
  scene.environment = skyEnvironment(r);
  scene.add(new THREE.HemisphereLight(0x9fb6d2, 0x2c2a2a, .62));
  sun = new THREE.DirectionalLight(0xc8d8ff, 2.9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 5; sc.far = 220; sun.shadow.bias = -.0004; sun.shadow.normalBias = .06;
  scene.add(sun); scene.add(sun.target);
  const warm = new THREE.DirectionalLight(0xff9a5a, .35); warm.position.set(60, 18, 30); scene.add(warm);
  MD.initTextures();
  // Warme Punktlichter, jedes Bild den nächsten Lichtquellen (Burg, Schmieden, Feuer) zugeteilt. Feste Zahl, damit kein Shader neu übersetzt wird.
  for (let i = 0; i < LIGHTS_N; i++) { const l = new THREE.PointLight(0xff9a4e, 0, 16, 1.6); l.castShadow = false; scene.add(l); lights.push(l); }
  pts = makePoints(760, false); scene.add(pts);
  snow = makePoints(650, false); scene.add(snow);
  for (let i = 0; i < 170; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: MD.TEX.smoke, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false; sp.userData = { life: 0, max: 1 }; scene.add(sp); smokes.push(sp);
  }
  fogC = document.createElement('canvas'); fogC.width = GW; fogC.height = GH; fogCtx = fogC.getContext('2d'); fogImg = fogCtx.createImageData(GW, GH);
  fogBig = document.createElement('canvas'); fogBig.width = GW * 4; fogBig.height = GH * 4; fogBigCtx = fogBig.getContext('2d');
  try { if (!/[?&]fx=0/.test(location.search)) { post = makePost(renderer, scene, camera, 1280, 760); MD.GLOW.k = .2; } } catch (err) { console.warn('Nachbearbeitung nicht verfügbar:', err); post = null; }
  proj.toWorld = toWorld3; proj.toScreen = toScreen3; proj.sync = sync;
  return true;
}

// Gefällter Baum: Instanz auf null skalieren.
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function treeFelled(tr) {
  const r = treeInst.get(tr); if (!r) return;
  r.im.setMatrixAt(r.i, ZERO); r.im.instanceMatrix.needsUpdate = true; treeInst.delete(tr);
}

export function resizeCanvas() {
  const dpr = Math.min(Q.dpr, window.devicePixelRatio || 1), r = ovc.getBoundingClientRect();
  dprNow = dpr; view.dpr = dpr; view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  ovc.width = Math.round(view.w * dpr); ovc.height = Math.round(view.h * dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(view.w, view.h, false);
  camera.aspect = view.w / view.h; camera.updateProjectionMatrix();
  if (post) post.setSize(view.w, view.h, dpr);
  const u = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(FOV * Math.PI / 360));
  pts.material.uniforms.uScale.value = u; snow.material.uniforms.uScale.value = u;
  if (G) sync();
}

/* ---------- Kamera: cam.x/y/z bleiben der sichtbare Ausschnitt in Weltpixeln ---------- */
function sync() {
  const cx = (cam.x + view.w / cam.z / 2) * S, cz = (cam.y + view.h / cam.z / 2) * S;
  const hg = view.h / cam.z * S * .95, D = hg * Math.sin(PITCH) / (2 * Math.tan(FOV * Math.PI / 360));
  camera.position.set(cx, D * Math.sin(PITCH), cz + D * Math.cos(PITCH));
  camera.lookAt(cx, 0, cz); camera.updateMatrixWorld(true);
  camera.userData = { cx, cz, D };
  const ev = G && G.ev, ek = ev && ev.id ? wk : 0;
  const W = ev && ev.id && WEATHER[ev.id];
  scene.fog.density = .5 / D * (1 + ek * (W ? W.dens : 0)) * (1 + .3 * seasonK);
  FOG_TMP.set(FOGC); FOG_TMP.lerp(FROST_C, .35 * seasonK); if (W) FOG_TMP.lerp(W.col, ek); scene.fog.color.copy(FOG_TMP); scene.background.copy(FOG_TMP);
}
function toWorld3(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / view.w * 2 - 1, -(y / view.h * 2 - 1)), camera);
  const p = ray.ray.intersectPlane(plane, tmp);
  if (!p) return [cam.x + view.w / cam.z / 2, cam.y + view.h / cam.z / 2];
  return [p.x / S, p.z / S];
}
function toScreen3(wx, wy, h) {
  tmp.set(wx * S, hAt(wx * S, wy * S) + (h || 0), wy * S).project(camera);
  return [(tmp.x + 1) / 2 * view.w, (1 - tmp.y) / 2 * view.h];
}
export function shake(a) { if (!G) return; G.shakeA = Math.min(9, Math.max(G.shakeA, a)); G.shakeT = .35; }

/* ---------- Gelände ---------- */
function paintGround() {
  const R = rng((G.seed ^ 0x5bd1e995) >>> 0);
  const c = document.createElement('canvas'); c.width = Math.round((WW + MARGIN * 2) * TSC); c.height = Math.round((WH + MARGIN * 2) * TSC);
  const t = c.getContext('2d'); t.scale(TSC, TSC); t.translate(MARGIN, MARGIN);
  t.fillStyle = '#7e8a97'; t.fillRect(-MARGIN, -MARGIN, WW + MARGIN * 2, WH + MARGIN * 2);
  const blot = (n, x0, y0, w, h) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * w, y = y0 + R() * h, r = 60 + R() * 200, g = t.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, R() < .55 ? 'rgba(236,243,250,.10)' : 'rgba(34,48,70,.11)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };
  blot(Math.round(560 * WW * WH / 4587520), 0, 0, WW, WH); blot(160, -MARGIN, -MARGIN, WW + MARGIN * 2, WH + MARGIN * 2);
  // Gebiete mit eigenem Boden: Grundfarbe je Zelle, danach Flecken in der Palette des Gebiets
  for (const r of Object.values(REGIONS)) {
    if (r.base) {
      t.fillStyle = r.base;
      for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (regionAtCell(cx, cy) === r.id) t.fillRect(cx * TS - .5, cy * TS - .5, TS + 1, TS + 1);
    }
    const pal = r.base ? [r.dark, r.light] : r.tint ? [r.tint] : null; if (!pal) continue;
    for (let k = 0; k < Math.round(WW * WH / (r.base ? 3500 : 9000)); k++) {
      const x = R() * WW, y = R() * WH;
      if (regionAtCell(Math.floor(x / TS), Math.floor(y / TS)) !== r.id) continue;
      const rad = 50 + R() * 140, g = t.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, pal[(R() * pal.length) | 0]); g.addColorStop(1, 'rgba(0,0,0,0)'); t.fillStyle = g; t.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  const hqs = G.battle ? G.battle.sites : [G.ents.find(e => e.type === 'hq' && e.team === 0), G.ents.find(e => e.type === 'hq' && e.team === 1)]; // Schlacht: leere Burgplätze
  const a = hqs[0], b = hqs[1];
  const dx = b.x - a.x, dy = b.y - a.y, nl = Math.hypot(dx, dy), nx = -dy / nl * 90, ny = dx / nl * 90;
  const road = () => { t.beginPath(); t.moveTo(a.x, a.y + 10); t.bezierCurveTo(a.x + dx / 3 + nx, a.y + dy / 3 + ny, a.x + dx * 2 / 3 - nx, a.y + dy * 2 / 3 - ny, b.x, b.y + 10); };
  t.lineCap = 'round'; t.lineJoin = 'round';
  road(); t.strokeStyle = 'rgba(38,36,40,.45)'; t.lineWidth = 78; t.stroke();
  road(); t.strokeStyle = 'rgba(70,64,62,.6)'; t.lineWidth = 50; t.stroke();
  road(); t.strokeStyle = 'rgba(120,108,96,.28)'; t.lineWidth = 22; t.stroke();
  for (const h of hqs) {
    if (h.fac === 'asch') { // Ruß und glühende Risse
      const g = t.createRadialGradient(h.x, h.y + 20, 40, h.x, h.y + 20, 340);
      g.addColorStop(0, 'rgba(18,15,14,.95)'); g.addColorStop(.6, 'rgba(34,28,26,.65)'); g.addColorStop(1, 'rgba(34,28,26,0)');
      t.fillStyle = g; t.fillRect(h.x - 350, h.y - 330, 700, 700);
      for (let pass = 0; pass < 2; pass++) {
        t.strokeStyle = pass ? 'rgba(255,150,60,.85)' : 'rgba(255,80,20,.22)'; t.lineWidth = pass ? 1.6 : 6;
        const R2 = rng(h.id * 31 + 7);
        for (let i = 0; i < 34; i++) {
          let x = h.x + (R2() - .5) * 560, y = h.y + 20 + (R2() - .5) * 460; t.beginPath(); t.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (R2() - .5) * 46; y += (R2() - .5) * 46; t.lineTo(x, y); }
          t.stroke();
        }
      }
    } else if (h.fac === 'salz') { // Salzkruste, Bohlenwege, kühler Schein vom Leuchtfeuer
      const g = t.createRadialGradient(h.x, h.y + 20, 30, h.x, h.y + 20, 330);
      g.addColorStop(0, 'rgba(96,92,88,.55)'); g.addColorStop(.55, 'rgba(150,150,148,.3)'); g.addColorStop(1, 'rgba(150,150,148,0)');
      t.fillStyle = g; t.fillRect(h.x - 340, h.y - 320, 680, 680);
      const R2 = rng(h.id * 17 + 3);
      for (let i = 0; i < 60; i++) { const x = h.x + (R2() - .5) * 520, y = h.y + 20 + (R2() - .5) * 440, r = 8 + R2() * 30, s = t.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(246,248,246,.5)'); s.addColorStop(1, 'rgba(246,248,246,0)'); t.fillStyle = s; t.fillRect(x - r, y - r, r * 2, r * 2); }
      t.strokeStyle = 'rgba(52,44,38,.7)'; t.lineWidth = 9;
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; t.beginPath(); t.moveTo(h.x, h.y + 20); t.lineTo(h.x + Math.cos(a) * 220, h.y + 20 + Math.sin(a) * 200); t.stroke(); }
      const w = t.createRadialGradient(h.x, h.y + 20, 0, h.x, h.y + 20, 280); w.addColorStop(0, 'rgba(255,224,170,.14)'); w.addColorStop(1, 'rgba(255,224,170,0)');
      t.fillStyle = w; t.fillRect(h.x - 290, h.y - 270, 580, 580);
    } else { // festgetretener Schnee, warmer Schein vom Dorf
      const g = t.createRadialGradient(h.x, h.y + 20, 30, h.x, h.y + 20, 320);
      g.addColorStop(0, 'rgba(120,100,82,.55)'); g.addColorStop(.5, 'rgba(110,98,88,.25)'); g.addColorStop(1, 'rgba(110,98,88,0)');
      t.fillStyle = g; t.fillRect(h.x - 330, h.y - 310, 660, 660);
      const w = t.createRadialGradient(h.x, h.y + 20, 0, h.x, h.y + 20, 260); w.addColorStop(0, 'rgba(255,170,90,.16)'); w.addColorStop(1, 'rgba(255,170,90,0)');
      t.fillStyle = w; t.fillRect(h.x - 270, h.y - 250, 540, 540);
    }
  }
  const dirt = (x, y, r, col) => { const g = t.createRadialGradient(x, y, r * .3, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(60,50,44,0)'); t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const e of G.ents) { if (e.type === 'hq') dirt(e.x, e.y + 20, 150, 'rgba(60,52,48,.6)'); else if (e.kind === 'dep') dirt(e.x, e.y, 90, 'rgba(34,30,30,.7)'); }
  // Vom Wind geformter Schnee: lange, flache Rippen in einer Richtung, im Licht hell, auf der Leeseite kalt-dunkel
  for (let i = 0; i < Math.round(2600 * WW * WH / 4587520); i++) {
    const x = R() * WW, y = R() * WH; if (!REGIONS[regionAtCell(Math.floor(x / TS), Math.floor(y / TS))].cold) continue;
    const L = 30 + R() * 110, a = -.35 + (R() - .5) * .25, bend = (R() - .5) * 14, ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    t.lineWidth = .8 + R() * 1.6; t.strokeStyle = 'rgba(244,248,255,.055)';
    t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 + bend, ex, ey); t.stroke();
    t.lineWidth = .8 + R() * 1.2; t.strokeStyle = 'rgba(30,44,66,.05)';
    t.beginPath(); t.moveTo(x + 1, y + 3); t.quadraticCurveTo((x + ex) / 2 + 1, (y + ey) / 2 + bend + 3, ex + 1, ey + 3); t.stroke();
  }
  for (let i = 0; i < Math.round(3200 * WW * WH / 4587520); i++) { // Schneeflocken und Schatten im Detail
    const x = R() * WW, y = R() * WH; if (!REGIONS[regionAtCell(Math.floor(x / TS), Math.floor(y / TS))].cold) continue; t.strokeStyle = R() < .5 ? 'rgba(248,251,255,.45)' : 'rgba(40,56,78,.35)'; t.lineWidth = 1.2;
    t.beginPath(); t.moveTo(x, y); t.lineTo(x + (R() - .5) * 6, y + (R() - .5) * 3); t.stroke();
  }
  return c;
}

function detailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(99);
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const px = R() * 256, py = R() * 256, r = 3 + R() * 14, v = R() < .5 ? 255 : 0, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${v},${v},${v},.12)`); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

function clearWorld() {
  if (world) { scene.remove(world); world.traverse(o => { if (o.isMesh && o.userData.own) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
  for (const o of objs.values()) scene.remove(o.g);
  for (const o of corpseObjs.values()) scene.remove(o);
  objs.clear(); corpseObjs.clear(); treesMesh = [];
  for (const s of smokes) { s.visible = false; s.userData.life = 0; }
}

export function buildTerrain() {
  clearWorld();
  world = new THREE.Group(); scene.add(world);
  const gc = paintGround();
  const tex = new THREE.CanvasTexture(gc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const det = detailTexture(), PW = (WW + MARGIN * 2) * S, PD = (WH + MARGIN * 2) * S;
  const g = new THREE.PlaneGeometry(PW, PD, Math.round(PW), Math.round(PD)); g.rotateX(-Math.PI / 2); g.translate(WU / 2, 0, HU / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: .95, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.detailMap = { value: det };
    sh.fragmentShader = 'uniform sampler2D detailMap;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(detailMap, vMapUv * vec2(' + (52 * WW / 2560).toFixed(1) + ', ' + (40 * WH / 1792).toFixed(1) + ')).rgb * 1.5 + .25;\n diffuseColor.rgb += step(.93, texture2D(detailMap, vMapUv * vec2(210., 150.)).g) * .14;');
  };
  const ground = new THREE.Mesh(g, m); ground.receiveShadow = true; ground.userData.own = true; world.add(ground);

  // Bäume: je eine instanzierte Gruppe für Kiefern und tote Bäume.
  const ah = G.ents.find(e => e.type === 'hq' && e.fac === 'asch');
  const live = [], dead = [], warm = { trocken: [], sumpf: [], kueste: [] };
  for (const tr of G.trees) {
    const rg = REGIONS[regionAt(tr.x, tr.y)];
    if (!rg.cold) warm[rg.id].push(tr); else (ah && Math.hypot(tr.x - ah.x, tr.y - ah.y) < 520 && tr.v < .75 ? dead : live).push(tr);
  }
  const mk = (geom, list, matl, hs) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geom, matl, list.length), d = new THREE.Object3D();
    list.forEach((tr, i) => { const X = tr.x * S, Z = tr.y * S, s = (.7 + tr.s / 24 * .55) * hs * .72; d.position.set(X, hAt(X, Z) - .05, Z); d.rotation.set(0, tr.v * 40, 0); d.scale.set(s, s * (.9 + tr.v * .3), s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); treeInst.set(tr, { im, i }); });
    im.castShadow = true; im.receiveShadow = true; world.add(im); treesMesh.push(im);
  };
  mk(MD.pineGeometry(), live, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), 1);
  for (const k of Object.keys(warm)) mk(MD.pineGeometry(k), warm[k], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), 1);
  mk(MD.deadTreeGeometry(), dead, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 1.1);

  // Ruinen um die wilden Lager und an Wegmarken der Außengebiete (nur Kulisse)
  [[95, 14], [104, 40], [10, 70], [28, 76], [55, 72], [100, 70]].forEach(([mx, my], i) => {
    for (const [dx, dy, sd] of [[-5.5, 3.5, 1], [6.5, -2.5, 2]]) {
      const rg = MD.ruinsGroup(i * 7 + sd), X = (mx + dx) * TS * S, Z = (my + dy) * TS * S;
      rg.position.set(X, hAt(X, Z) - .05, Z); rg.rotation.y = i + sd; rg.scale.setScalar(.9 + sd * .1); world.add(rg);
    }
  });
  // Kriegsnebel als weiche Textur knapp über dem Gelände
  fogTex = new THREE.CanvasTexture(fogBig); fogTex.colorSpace = THREE.SRGBColorSpace; fogTex.minFilter = fogTex.magFilter = THREE.LinearFilter;
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(WU, HU), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  fp.rotation.x = -Math.PI / 2; fp.position.set(WU / 2, 6.5, HU / 2); fp.renderOrder = 50; fp.userData.own = true; world.add(fp);
  G.fogDirty = true;

  // Minimap-Hintergrund: Gelände plus Bäume
  mmBg = document.createElement('canvas'); mmBg.width = mm.width; mmBg.height = mm.height;
  const mb = mmBg.getContext('2d'); mb.drawImage(gc, MARGIN * TSC, MARGIN * TSC, WW * TSC, WH * TSC, 0, 0, mm.width, mm.height);
  mb.fillStyle = 'rgba(20,40,38,.7)'; for (const tr of G.trees) mb.fillRect(tr.x / WW * mm.width - 1, tr.y / WH * mm.height - 1, 2, 2);
  ready = true;
}

/* ---------- Entitäten ---------- */
const UH = { worker: 2.1, melee: 2.5, ranged: 2.3, cav: 3.3, siege: 3.4, hero: 3.4, support: 2.5, elite: 2.8 };
const UF = { worker: .9, melee: 1, ranged: .92, cav: 1, siege: .85, hero: 1, support: .95, elite: 1.12 };
let blobTex = null, blobGeo = null, blobMat = null;
function blob() {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.6, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c); blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  return new THREE.Mesh(blobGeo, blobMat);
}

// Dunkler, geschmolzener Boden unter Gebäuden; die Fläche folgt dem Gelände.
let meltMat = null;
function meltDecal(e) {
  if (!meltMat) {
    // Freigetauter Boden: braune, nasse Erde mit Matschrand und ausgefranster Kante; wird vom warmen Licht beleuchtet.
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(77);
    x.fillStyle = '#463729'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) { const px = R() * 256, py = R() * 256, r = 4 + R() * 22, v = R(), gg = x.createRadialGradient(px, py, 0, px, py, r); gg.addColorStop(0, v < .5 ? 'rgba(24,18,13,.32)' : v < .85 ? 'rgba(104,88,70,.22)' : 'rgba(150,158,170,.16)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - r, py - r, r * 2, r * 2); }
    for (let i = 0; i < 1800; i++) { const v = R() < .5 ? 20 : 150; x.fillStyle = `rgba(${v},${v - 8},${v - 16},.35)`; x.fillRect(R() * 256, R() * 256, 1.5, 1.5); }
    const a = document.createElement('canvas'); a.width = a.height = 256; const y = a.getContext('2d');
    const g = y.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(.5, '#fff'); g.addColorStop(.78, '#888'); g.addColorStop(1, '#000');
    y.fillStyle = g; y.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { const ang = R() * 6.283, d = 70 + R() * 50, px = 128 + Math.cos(ang) * d, py = 128 + Math.sin(ang) * d, r = 6 + R() * 18; const q = y.createRadialGradient(px, py, 0, px, py, r); q.addColorStop(0, R() < .5 ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.35)'); q.addColorStop(1, 'rgba(128,128,128,0)'); y.fillStyle = q; y.fillRect(px - r, py - r, r * 2, r * 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); const am = new THREE.CanvasTexture(a);
    meltMat = new THREE.MeshStandardMaterial({ map: t, alphaMap: am, transparent: true, depthWrite: false, roughness: .55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3 });
  }
  const X = e.x * S, Z = e.y * S, Y0 = hAt(X, Z), R = e.size * 2 * (e.type === 'hq' ? 1.9 : 1.6);
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, 12, 12); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(X + p.getX(i), Z + p.getZ(i)) - Y0 + .05);
  const m = new THREE.Mesh(geo, meltMat); m.renderOrder = 2; return m;
}
function updateLights() {
  const { cx, cz } = camera.userData, cand = [];
  for (const o of objs.values()) {
    const e = o.e; if (e.kind !== 'bld' || !e.built || e.dead || !o.g.visible) continue;
    const li = LI[e.fac] && LI[e.fac][e.type]; if (!li) continue;
    const d = (o.g.position.x - cx) ** 2 + (o.g.position.z - cz) ** 2; cand.push([d, o, li]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < LIGHTS_N; i++) {
    if (i >= Q.lights) { lights[i].intensity = 0; continue; }
    const l = lights[i], c = cand[i];
    if (!c) { l.intensity = 0; continue; }
    const [, o, li] = c, fl = .92 + .08 * Math.sin(G.t * 7 + o.e.id * 3) * Math.sin(G.t * 13 + o.e.id);
    l.position.set(o.g.position.x + .6, o.g.position.y + li[1], o.g.position.z + o.e.size * 1.3); l.intensity = li[0] * fl; l.distance = 10 + o.e.size * 3;
    l.color.setHex(LCOL[o.e.fac] || 0xffa25a);
  }
}
function makeObj(e) {
  const g = new THREE.Group(); let o;
  if (e.kind === 'unit') {
    const m = MD.buildUnit(e.fac, e.type), f = UF[e.type] || 1;
    m.scale.multiplyScalar(f); g.add(m);
    const b = blob(); b.scale.setScalar(e.r * S * (e.type === 'siege' ? 3.8 : e.type === 'cav' ? 3.6 : 3)); b.position.y = .06; g.add(b);
    o = { g, e, m, j: m.userData.j || {}, rot: e.face, spin: 0 };
  } else if (e.kind === 'bld') {
    const m = MD.buildBld(e.fac, e.type, e.id); g.add(m);
    g.add(meltDecal(e));
    o = { g, e, m, built: e.built, fireSp: null };
  } else {
    const m = MD.buildDep(); g.add(m); o = { g, e, m };
  }
  scene.add(g); objs.set(e.id, o); return o;
}

const STEAM = new THREE.Color(0xa9abb0), SOOTC = new THREE.Color(0x4a4644);
function spawnSmoke(x, y, z, s = 1, steam = false) {
  for (const sp of smokes) if (sp.userData.life <= 0) {
    const L = (steam ? 4.2 : 3) + Math.random() * 1.8;
    sp.userData = { life: L, max: L, s: s * (steam ? 1.2 : 1), steam }; sp.material.color.copy(steam ? STEAM : SOOTC); sp.position.set(x, y, z); sp.visible = true; sp.scale.setScalar(.6 * s); return;
  }
}

function updateEnts(dt) {
  const t = G.t, seen = new Set();
  const { cx, cz } = camera.userData, far = (camera.userData.D * 1.6) ** 2;
  for (const e of G.ents) {
    if (e.dead || !shown(e)) continue;
    const X = e.x * S, Z = e.y * S;
    if ((X - cx) ** 2 + (Z - cz) ** 2 > far) continue;
    seen.add(e.id);
    let o = objs.get(e.id) || makeObj(e);
    const Y = hAt(X, Z);
    if (e.kind === 'unit') {
      o.g.position.set(X, Y, Z);
      let d = -e.face - o.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rot += d * Math.min(1, dt * 14); o.m.rotation.y = o.rot;
      const j = o.j, mv = e.moving, ph = t * (e.type === 'cav' ? 13 : 9) + e.id;
      o.m.position.y = mv ? Math.abs(Math.sin(ph)) * (e.type === 'cav' ? .12 : .08) : 0;
      if (j.legL) { j.legL.rotation.z = mv ? Math.sin(ph) * .7 : 0; j.legR.rotation.z = mv ? -Math.sin(ph) * .7 : 0; }
      if (j.legs) j.legs.forEach((l, i) => { l.rotation.z = mv ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.6 : 0)) * .8 : 0; });
      if (j.body && !j.ram) j.body.rotation.z = mv ? -.1 : 0;
      const sw = e.cd > 0 && e.cd > e.d.cd - .3 ? Math.sin((e.d.cd - e.cd) / .3 * Math.PI) : 0;
      const an = o.m.userData.anim;
      if (an) MD.playAnim(an, MD.pickClip(e, e.cd > 0 && e.cd > e.d.cd - .6), dt); // Modelle aus Blender: Skelettanimation
      if (j.weapon) { if (e.type === 'ranged') j.weapon.rotation.z = sw * .25; else j.weapon.rotation.z = -sw * 1.2; }
      if (j.tool) j.tool.rotation.z = e.working ? Math.sin(t * 14 + e.id) * .8 : 0;
      if (j.sack) j.sack.visible = e.carry > 0;
      if (j.ram) { j.ram.position.x = sw * 1.5; if (mv) j.wheels.forEach(w => w.rotateY(dt * 4)); }
      if (j.arm) { // Wurfarm: schnellt beim Schuss nach vorn und zieht langsam zurück
        const el = e.cd > 0 ? e.d.cd - e.cd : 99;
        j.arm.rotation.z = el < .25 ? -.15 - 1.55 * el / .25 : -1.7 + 1.55 * Math.min(1, (el - .25) / (e.d.cd - .6));
        if (mv) j.wheels.forEach(w => w.rotateY(dt * 4));
      }
      // Umhänge wehen: im Lauf nach hinten, im Stand leichtes Flattern
      const capes = o.m.userData.capes;
      if (capes) for (let i = 0; i < capes.length; i++) { const c = capes[i], tgt = (mv ? -.42 : -.06) + Math.sin(t * (mv ? 9 : 2.2) + e.id + i) * (mv ? .1 : .04); c.rotation.z += (tgt - c.rotation.z) * Math.min(1, dt * 6); }
      const lamp = o.m.userData.lamp;
      if (lamp) { lamp.position.y = 2.05 + Math.sin(t * 2 + e.id) * .04; lamp.rotation.y += dt * .8; }
      o.m.userData.flags && o.m.userData.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 4 + i) * .3; });
      const hp = 1 + Math.min(.08, e.hit || 0); o.m.scale.y = (o.m.userData.sy || (o.m.userData.sy = o.m.scale.y)) * hp;
    } else if (e.kind === 'bld') {
      o.g.position.set(X, Y, Z);
      const sc = o.m.userData.scaffold, built = e.built;
      if (!built) { o.g.scale.y = .18 + .82 * e.prog; if (sc) sc.visible = true; } else { o.g.scale.y = 1; if (sc) sc.visible = false; }
      const u = o.m.userData;
      u.flames && u.flames.forEach(f => { const k = .85 + .25 * Math.sin(t * 9 + f.ph) + .08 * Math.sin(t * 23 + f.ph); f.s.scale.set(1.3 * f.b * (.92 + .08 * k), 1.8 * f.b * k, 1); });
      u.pools && u.pools.forEach((p, i) => { p.material.opacity = built ? (.62 + .18 * Math.sin(t * 6 + i * 2 + e.id)) * MD.GLOW.k : 0; });
      u.flags && u.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i + e.id) * .25; });
      u.gears && u.gears.forEach(gr => { gr.rotation.z += dt * 1.4; });
      if (built && u.smoke && Math.random() < dt * (e.fac !== 'asch' ? 1.8 : 1.5) * u.smoke.length) { const s = u.smoke[(Math.random() * u.smoke.length) | 0]; spawnSmoke(X + s[0], Y + s[1], Z + s[2], 1, e.fac !== 'asch'); }
      const dmg = built && e.hp < e.maxhp * .5 && e.type !== 'tower';
      if (dmg && !o.fireSp) {
        o.fireSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: MD.TEX.fire, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        o.fireSp.position.set(0, (MD.BLD_H[e.fac][e.type] || 3) * .6, 0); o.fireSp.scale.set(e.size * 1.3, e.size * 1.8, 1); o.g.add(o.fireSp);
      }
      if (o.fireSp) { o.fireSp.visible = dmg; if (dmg) { const k = .85 + .25 * Math.sin(t * 9 + e.id); o.fireSp.scale.set(e.size * 1.3 * k, e.size * 1.9 * k, 1); if (Math.random() < dt * 4) spawnSmoke(X, Y + 4, Z, 1.4); } }
    } else {
      o.g.position.set(X, Y, Z);
      const k = .5 + .5 * Math.sqrt(Math.max(0, e.amt) / e.max); o.m.scale.setScalar(k);
    }
  }
  // Gebäude außer Sicht nur ausblenden (sie neu zu bauen kostet mehr), alles andere entfernen
  for (const [id, o] of objs) {
    if (seen.has(id)) { o.g.visible = true; continue; }
    if (o.e.kind === 'bld' && !o.e.dead && G.map.has(id)) o.g.visible = false; else { scene.remove(o.g); objs.delete(id); }
  }
}

function updateCorpses(dt) {
  const alive = new Set();
  for (const c of G.corpses) {
    alive.add(c); let m = corpseObjs.get(c);
    const X = c.x * S, Z = c.y * S, k = 1 - c.t / c.life;
    if (!m) {
      m = new THREE.Group(); const b = blob(); b.scale.setScalar(c.kind === 'ruin' ? c.size * 2.4 : c.r * S * 3.2); b.position.y = .05; m.add(b);
      if (c.kind === 'ruin') {
        const R = rng((c.x * 13 + c.y * 7) | 0), rm = MD.mat(c.fac === 'asch' ? 0x2b2624 : c.fac === 'salz' ? 0xa9a69c : 0x6d7078, { roughness: 1 });
        for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(.5 + R() * 1.1, .3 + R() * .8, .5 + R() * 1.1), rm); r.position.set((R() - .5) * c.size * 1.8, .2, (R() - .5) * c.size * 1.8); r.rotation.set(R() * .5, R() * 6, R() * .5); r.castShadow = true; m.add(r); }
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(.9, .28, .5), MD.mat(c.fac === 'asch' ? 0x5a1a10 : c.fac === 'salz' ? 0x34433f : 0x2f4150, { roughness: 1 })); body.position.y = .16; body.rotation.y = -c.face; m.add(body);
      }
      scene.add(m); corpseObjs.set(c, m);
    }
    m.position.set(X, hAt(X, Z), Z); m.scale.y = Math.min(1, k * 3); 
  }
  for (const [c, m] of corpseObjs) if (!alive.has(c)) { scene.remove(m); corpseObjs.delete(c); }
}

/* ---------- Effekte ---------- */
function updateFx(dt) {
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * .4 * dt; if (p.hv === undefined) p.hv = .8 + Math.random() * 1.4; }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter(f => f.t < f.life);
  if (G.shakeT > 0) { G.shakeT -= dt; if (G.shakeT <= 0) G.shakeA = 0; }
  const ah = G.ents.find(e => e.type === 'hq' && e.fac === 'asch' && !e.dead);
  if (ah && Math.random() < dt * 14) G.parts.push({ x: ah.x + (Math.random() - .5) * 380, y: ah.y + (Math.random() - .5) * 280 + 60, vx: (Math.random() - .5) * 8, vy: -4, t: 0, life: 2.2 + Math.random(), col: Math.random() < .5 ? '#ff8a3a' : '#c0501e', sz: 1.6, g: -2 });
}

function drawParticles() {
  const d = pts.userData, n = Math.min(d.max, G.parts.length);
  for (let i = 0; i < n; i++) {
    const p = G.parts[i], X = p.x * S, Z = p.y * S, Y = hAt(X, Z);
    const h = p.g < 0 ? 2 + p.t * 1.7 : Math.max(.05, .6 + p.hv * p.t * 2.2 - p.t * p.t * 3.2);
    const c = pc(p.col), a = Math.max(0, 1 - p.t / p.life) * c[3];
    d.pos[i * 3] = X; d.pos[i * 3 + 1] = Y + h; d.pos[i * 3 + 2] = Z;
    d.col[i * 4] = c[0]; d.col[i * 4 + 1] = c[1]; d.col[i * 4 + 2] = c[2]; d.col[i * 4 + 3] = a; d.siz[i] = p.sz * .075;
  }
  for (let i = n; i < d.max; i++) d.col[i * 4 + 3] = 0;
  pts.geometry.attributes.position.needsUpdate = pts.geometry.attributes.color.needsUpdate = pts.geometry.attributes.size.needsUpdate = true;
}

let snowInit = false;
function drawSnow(dt, t) {
  const d = snow.userData, { cx, cz } = camera.userData, W = 100, DD = 70;
  if (!snowInit) { for (let i = 0; i < d.max; i++) { d.pos[i * 3] = cx + (Math.random() - .5) * W; d.pos[i * 3 + 1] = Math.random() * 30; d.pos[i * 3 + 2] = cz + (Math.random() - .5) * DD; d.siz[i] = .05 + Math.random() * .07; d.col[i * 4] = .92; d.col[i * 4 + 1] = .95; d.col[i * 4 + 2] = 1; d.col[i * 4 + 3] = .55 + Math.random() * .3; } snowInit = true; }
  const ev = G.ev, ek = ev && ev.id ? wk : 0, WX = ev && ev.id && WEATHER[ev.id];
  const wind = 1 + ek * (WX ? WX.wind : 0), fall = 1 + ek * (WX ? WX.fall : 0);
  const cr = WX ? .92 + (WX.pc[0] - .92) * ek : .92, cg = WX ? .95 + (WX.pc[1] - .95) * ek : .95, cb = WX ? 1 + (WX.pc[2] - 1) * ek : 1;
  for (let i = 0; i < d.max; i++) {
    d.col[i * 4] = cr; d.col[i * 4 + 1] = cg; d.col[i * 4 + 2] = cb;
    let x = d.pos[i * 3] + (1.2 + Math.sin(t * .6 + i) * .5) * wind * dt, y = d.pos[i * 3 + 1] - (1.6 + (i % 5) * .3) * fall * dt, z = d.pos[i * 3 + 2] + Math.sin(t * .4 + i * .7) * .25 * dt;
    if (y < 0) y += 30; if (y > 30) y -= 30; if (x > cx + W / 2) x -= W; if (x < cx - W / 2) x += W; if (z > cz + DD / 2) z -= DD; if (z < cz - DD / 2) z += DD;
    d.pos[i * 3] = x; d.pos[i * 3 + 1] = y; d.pos[i * 3 + 2] = z;
  }
  snow.geometry.attributes.position.needsUpdate = true; snow.geometry.attributes.color.needsUpdate = true; snow.geometry.attributes.size.needsUpdate = true;
}

function updateSmoke(dt) {
  for (const s of smokes) {
    const u = s.userData; if (u.life <= 0) continue;
    u.life -= dt; if (u.life <= 0) { s.visible = false; continue; }
    const k = 1 - u.life / u.max;
    s.position.y += (u.steam ? 1.5 + k * .6 : .9 + k * .6) * dt; s.position.x += (.5 + k * .8) * dt;
    s.scale.setScalar((.6 + k * 2.6) * (u.s || 1)); s.material.opacity = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k) * (u.steam ? .85 : .75);
  }
}

const stones = [];
function updateArrows() {
  let n = 0, m = 0;
  for (const p of G.projs) {
    const X = p.x * S, Z = (p.y + (p.sy !== undefined ? 6 : 0)) * S;
    if (p.big) { // Wurfgeschoss im Bogen: Höhe aus dem Anteil der zurückgelegten Strecke
      let s = stones[m]; if (!s) { s = new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8), MD.mat(0xa9d8ee, { roughness: .2, emissive: 0x2a6a88, emissiveIntensity: .8 })); s.castShadow = true; scene.add(s); stones.push(s); }
      const tg = G.map.get(p.t), tot = tg ? Math.hypot(tg.x - p.sx, tg.y - p.sy) + 1 : 1, k = tg ? 1 - Math.hypot(tg.x - p.x, tg.y - p.y) / tot : .5;
      s.position.set(X, hAt(X, Z) + 1.6 + Math.sin(Math.max(0, Math.min(1, k)) * Math.PI) * tot * S * .35, Z); s.visible = true; m++; continue;
    }
    let a = arrows[n]; if (!a) { a = new THREE.Mesh(new THREE.BoxGeometry(1.1, .06, .06), MD.mat(0xd9d3c0)); scene.add(a); arrows.push(a); }
    a.material = p.fire ? MD.mat(0xff8a2a, { emissive: 0xff6a10, emissiveIntensity: 2.4 }) : MD.mat(0xd9d3c0);
    a.position.set(X, hAt(X, Z) + 1.9, Z); a.rotation.y = -Math.atan2(p.vy || 0, p.vx || 1); a.visible = true; n++;
  }
  for (let i = n; i < arrows.length; i++) arrows[i].visible = false;
  for (let i = m; i < stones.length; i++) stones[i].visible = false;
}

function updateFogTex() {
  if (!G.fogDirty) return; G.fogDirty = false;
  const f = G.fog, d = fogImg.data;
  for (let i = 0; i < f.length; i++) { d[i * 4] = 10; d[i * 4 + 1] = 14; d[i * 4 + 2] = 20; d[i * 4 + 3] = f[i] === 0 ? 240 : f[i] === 1 ? 130 : 0; }
  fogCtx.putImageData(fogImg, 0, 0);
  fogBigCtx.imageSmoothingEnabled = true; fogBigCtx.imageSmoothingQuality = 'high'; fogBigCtx.clearRect(0, 0, fogBig.width, fogBig.height); fogBigCtx.drawImage(fogC, 0, 0, fogBig.width, fogBig.height);
  if (fogTex) fogTex.needsUpdate = true;
}

/* ---------- Überlagerung (2D): Ringe, Balken, Auswahl, Texte ---------- */
const gp = (wx, wy, h) => { tmp.set(wx * S, hAt(wx * S, wy * S) + (h || 0), wy * S).project(camera); return [(tmp.x + 1) / 2 * view.w, (1 - tmp.y) / 2 * view.h]; };
function ringO(c, cx, cy, r, stroke, w, alpha, fill, dash) {
  c.beginPath();
  for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI * 2, p = gp(cx + Math.cos(a) * r, cy + Math.sin(a) * r, .12); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
  c.closePath(); c.globalAlpha = alpha == null ? 1 : alpha;
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = w || 1.5; if (dash) c.setLineDash(dash); c.stroke(); if (dash) c.setLineDash([]); }
  c.globalAlpha = 1;
}
function boxO(c, gx, gy, s, stroke, w, fill) {
  const x0 = gx * TS, y0 = gy * TS, x1 = x0 + s * TS, y1 = y0 + s * TS, P = [gp(x0, y0, .12), gp(x1, y0, .12), gp(x1, y1, .12), gp(x0, y1, .12)];
  c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.stroke(); }
}
let vig = null, vigKey = '';
function drawOverlay(selSet) {
  const c = octx; c.setTransform(dprNow, 0, 0, dprNow, 0, 0); c.clearRect(0, 0, view.w, view.h); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const zn of G.zones) {
    const k = zn.t / zn.dur, pulse = .5 + .5 * Math.sin(G.t * 6);
    if (zn.type === 'spring') ringO(c, zn.x, zn.y, zn.r * (.9 + .1 * pulse), 'rgba(160,240,255,.85)', 2, 1 - k * .6, 'rgba(130,230,255,.16)');
    else if (zn.type === 'surge') { ringO(c, zn.x, zn.y, zn.r, 'rgba(150,210,240,.9)', 2.5, .6 + .3 * pulse, 'rgba(70,140,190,.22)'); ringO(c, zn.x, zn.y, zn.r * ((G.t * .7) % 1), 'rgba(220,245,255,.8)', 1.5, 1 - ((G.t * .7) % 1)); }
    else ringO(c, zn.x, zn.y, zn.r, 'rgba(255,140,50,.85)', 2, .5 + .3 * pulse, 'rgba(255,100,30,.1)');
  }
  for (const m of G.marks) {
    const k = m.t / (m.life || .6);
    if (m.kind === 'cry') ringO(c, m.x, m.y, 20 + k * 230, 'rgba(235,185,90,1)', 3, 1 - k);
    else if (m.kind === 'wall') ringO(c, m.x, m.y, 20 + k * 200, 'rgba(130,190,255,1)', 3, 1 - k);
    else if (m.kind === 'dread') ringO(c, m.x, m.y, 20 + k * 220, 'rgba(160,90,200,1)', 3, 1 - k);
    else if (m.kind === 'bless') ringO(c, m.x, m.y, 20 + k * 220, 'rgba(190,170,255,1)', 3, 1 - k, 'rgba(170,150,255,' + (.18 * (1 - k)) + ')');
    else if (m.kind === 'tide') { const r = (m.r || 80) * (.3 + k * .9); ringO(c, m.x, m.y, r, 'rgba(210,240,255,1)', 3, 1 - k, 'rgba(90,160,210,' + (.35 * (1 - k)) + ')'); ringO(c, m.x, m.y, r * .6, 'rgba(160,220,250,1)', 2, 1 - k); }
    else if (m.kind === 'blast') { const r = (m.r || 60) * (.4 + k * .6); ringO(c, m.x, m.y, r, 'rgba(255,220,140,1)', 2, 1 - k, 'rgba(255,150,60,' + (.4 * (1 - k)) + ')'); }
    else ringO(c, m.x, m.y, 8 + k * 20, (m.kind === 'atk' ? 'rgba(232,105,77,1)' : 'rgba(155,224,124,1)'), 2, 1 - k);
  }
  for (const e of G.ents) {
    if (e.dead || !objs.has(e.id) || !objs.get(e.id).g.visible) continue;
    const sel = selSet.has(e.id);
    if (e.kind === 'unit') {
      if (sel) ringO(c, e.x, e.y, e.r * 1.7, '#9be07c', 2, .95);
      if (sel && e.d.aura) ringO(c, e.x, e.y, e.d.aura.range, 'rgba(160,230,170,.55)', 1.2, 1, 'rgba(160,230,170,.06)', [6, 6]); // Reichweite der Aura
      if (e.buff > 0) ringO(c, e.x, e.y, e.r + 8, 'rgba(235,185,90,.9)', 1.6, 1);
      if (e.shield > 0) ringO(c, e.x, e.y, e.r + 11, 'rgba(130,190,255,.9)', 2, 1, null, [10, 6]);
      if (e.slow > 0 || e.weak > 0) ringO(c, e.x, e.y, e.r + 7, 'rgba(170,100,210,.9)', 1.6, 1);
    } else if (sel) {
      if (e.kind === 'dep') ringO(c, e.x, e.y, TS * 1.3, '#9be07c', 2, .95);
      else {
        boxO(c, e.gx - .1, e.gy - .1, e.size + .2, '#9be07c', 2);
        if (e.type === 'tower') ringO(c, e.x, e.y, e.d.rng, 'rgba(155,224,124,.55)', 1.2, 1, null, [6, 6]);
        if (e.rally) {
          const a = gp(e.x, e.y, 1), b = gp(e.rally.x, e.rally.y, .1), f = gp(e.rally.x, e.rally.y, 1.8);
          c.strokeStyle = 'rgba(155,224,124,.7)'; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
          c.strokeStyle = '#9be07c'; c.lineWidth = 2; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(f[0], f[1]); c.stroke(); c.fillStyle = '#9be07c'; c.fillRect(f[0], f[1], 10, 6);
        }
      }
    }
    // Lebensbalken
    if (e.kind === 'dep' || (e.hp >= e.maxhp && !sel && e.built !== false)) continue;
    const top = e.kind === 'bld' ? (MD.BLD_H[e.fac][e.type] || 3) + .6 : (UH[e.type] || 2.3) * (UF[e.type] || 1) * (e.type === 'hero' ? 1.2 : 1.05) + .5;
    const p = gp(e.x, e.y, top), w = e.kind === 'bld' ? Math.min(64, e.size * 24) : (e.type === 'siege' ? 36 : 28), x = p[0] - w / 2, y = p[1];
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - 1, y - 1, w + 2, 6);
    const fr = Math.max(0, e.hp / e.maxhp); c.fillStyle = fr > .5 ? '#8cc674' : fr > .25 ? '#e0b94a' : '#e8694d'; c.fillRect(x, y, w * fr, 4);
    if (e.type === 'hero') for (let i = 0; i < MAX_HERO_LVL; i++) { c.fillStyle = i < e.lvl ? '#e0a64a' : 'rgba(0,0,0,.6)'; c.fillRect(x + i * 6, y - 6, 4, 3); }
  }
  c.font = '700 14px "Barlow Condensed",sans-serif'; c.textAlign = 'center';
  for (const f of G.floats) {
    if (f.y0 === undefined) f.y0 = f.y; const p = gp(f.x, f.y0, 2.6 + f.t * 1.8);
    c.globalAlpha = Math.max(0, 1 - f.t / f.life); c.fillStyle = '#000'; c.fillText(f.text, p[0] + 1, p[1] + 1); c.fillStyle = f.col; c.fillText(f.text, p[0], p[1]);
  }
  c.globalAlpha = 1; c.textAlign = 'start';
  if (UI.mode === 'place' && UI.place && UI.place.has) { const s = defOf(G.fac[0], UI.place.type).size; boxO(c, UI.place.gx, UI.place.gy, s, UI.place.ok ? '#9be07c' : '#e8694d', 2.5, UI.place.ok ? 'rgba(155,224,124,.3)' : 'rgba(232,105,77,.35)'); }
  if (UI.mode === 'target' && UI.target && UI.mx !== undefined) {
    const [wx, wy] = toWorld3(UI.mx, UI.my); let rad = 80, rng2 = 0, hero = null;
    if (UI.target.kind === 'power') rad = FACTIONS[G.fac[0]].power.radius;
    else { hero = G.map.get(UI.target.hero); const a = hero && FACTIONS[hero.fac].abilities[UI.target.i]; if (a) { rad = a.radius; rng2 = a.range; } }
    if (hero && rng2) ringO(c, hero.x, hero.y, rng2, 'rgba(255,255,255,.45)', 1.2, 1, null, [6, 6]);
    ringO(c, wx, wy, rad, 'rgba(255,200,120,.95)', 2, 1, 'rgba(255,170,70,.16)');
  }
  const key = view.w + 'x' + view.h;
  if (vigKey !== key) {
    vigKey = key; vig = c.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * .3, view.w / 2, view.h / 2, Math.max(view.w, view.h) * .72);
    vig.addColorStop(0, 'rgba(8,14,24,0)'); vig.addColorStop(1, "rgba(6,10,18,.5)");
  }
  c.fillStyle = vig; c.fillRect(0, 0, view.w, view.h);
  if (UI.drag && UI.drag.active) { const d = UI.drag, x = Math.min(d.sx, d.x), y = Math.min(d.sy, d.y), w = Math.abs(d.x - d.sx), h = Math.abs(d.y - d.sy); c.fillStyle = 'rgba(155,224,124,.12)'; c.fillRect(x, y, w, h); c.strokeStyle = '#9be07c'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w, h); }
  const hint = UI.mode === 'amove' ? 'Angriffsmarsch: Ziel wählen' : UI.mode === 'target' ? 'Ziel wählen' : '';
  if (hint) { c.fillStyle = 'rgba(12,16,20,.82)'; c.fillRect(view.w / 2 - 95, view.h - 34, 190, 24); c.fillStyle = '#e8694d'; c.font = '600 15px sans-serif'; c.textAlign = 'center'; c.fillText(hint, view.w / 2, view.h - 17); c.textAlign = 'start'; }
}

/* ---------- Hauptschleife ---------- */
export function render(dt, selSet) {
  if (!renderer) return;
  if (!G || !ready) { renderer.setClearColor(0x0b0d0a); renderer.clear(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, ovc.width, ovc.height); return; }
  updateFx(dt); updateFogTex();
  { const rg = REGIONS[regionAt(cam.x + view.w / cam.z / 2, cam.y + view.h / cam.z / 2)], tk = rg && rg.cold ? 1 : Math.max(.06, wk); snowK += (tk - snowK) * Math.min(1, dt * 1.5); snow.material.uniforms.uK.value = snowK; }
  { const tgt = evAt(cam.x + view.w / cam.z / 2, cam.y + view.h / cam.z / 2); wk += (tgt - wk) * Math.min(1, dt * 2); }
  { const sn = seasonAt(G.t), tk = sn.id === 'frost' ? 1 : sn.id === 'chill' ? .45 : sn.id === 'melt' ? .25 : 0; seasonK += (tk - seasonK) * Math.min(1, dt * .6); }
  sync();
  const sh = G.shakeT > 0 ? G.shakeA * (G.shakeT / .35) * .045 : 0;
  if (sh) camera.position.add(new THREE.Vector3((Math.random() - .5) * sh, (Math.random() - .5) * sh, (Math.random() - .5) * sh));
  const { cx, cz } = camera.userData;
  sun.target.position.set(cx, 0, cz); sun.position.set(cx - 38, 52, cz + 14);
  { // Schattenausschnitt folgt dem Bild: die ganze Auflösung für das, was zu sehen ist
    const ext = Math.max(18, Math.max(view.w, view.h) / cam.z * S * .62 + 4), sc = sun.shadow.camera;
    if (Math.abs(sc.right - ext) > ext * .08) { sc.left = sc.bottom = -ext; sc.right = sc.top = ext; sc.updateProjectionMatrix(); }
  }
  updateEnts(dt); updateLights(); updateCorpses(dt); updateArrows(); updateSmoke(dt); drawParticles(); drawSnow(dt, G.t);
  if (postActive()) post.render(dt, G.t); else renderer.render(scene, camera);
  camera.updateMatrixWorld(true);
  drawOverlay(selSet);
}

export function drawMini() {
  if (!G || !ready || !mmBg) return;
  const W = mm.width, H = mm.height, sx = W / WW, sy = H / WH;
  mctx.drawImage(mmBg, 0, 0);
  for (const e of G.ents) {
    if (e.dead || !shown(e)) continue;
    if (e.kind === 'dep') { mctx.fillStyle = '#e0a63a'; mctx.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4); continue; }
    mctx.fillStyle = facOf(e.fac).color; const s = e.kind === 'bld' ? 4 : 2.2; mctx.fillRect(e.x * sx - s / 2, e.y * sy - s / 2, s, s);
  }
  mctx.imageSmoothingEnabled = true; mctx.drawImage(fogC, 0, 0, W, H);
  const cs = [[0, 0], [view.w, 0], [view.w, view.h], [0, view.h]].map(p => toWorld3(p[0], p[1]));
  mctx.strokeStyle = '#e8e4d2'; mctx.lineWidth = 1; mctx.beginPath();
  cs.forEach((p, i) => { const x = Math.max(0, Math.min(W, p[0] * sx)), y = Math.max(0, Math.min(H, p[1] * sy)); i ? mctx.lineTo(x, y) : mctx.moveTo(x, y); });
  mctx.closePath(); mctx.stroke();
}

// Modelle aus public/models laden; vorhandene Objekte neu aufbauen, damit sie die Dateien verwenden.
export async function loadFileModels() {
  const n = await MD.loadModels();
  if (n) { for (const o of objs.values()) scene.remove(o.g); objs.clear(); }
  return n;
}
export function stats() { const i = renderer.info.render, by = {}; const cnt = (k, g) => g.traverse(o => { if ((o.isMesh || o.isSprite || o.isPoints) && o.visible) by[k] = (by[k] || 0) + 1; }); for (const o of objs.values()) if (o.g.visible) cnt(o.e.kind + ':' + o.e.type, o.g); by.smoke = smokes.filter(s => s.visible).length; by.corpse = corpseObjs.size; by.world = 0; if (world) cnt('world', world); return { by, calls: i.calls, tris: i.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: (renderer.info.programs || []).length }; }
export function dbg() { const mm = [...objs.values()].filter(o => o.e.kind === 'bld').map(o => { const d = o.g.children.find(c => c.material === meltMat); if (!d) return 'none'; d.updateWorldMatrix(true, false); const v = new THREE.Vector3(); d.getWorldPosition(v); return [v.y.toFixed(2), d.visible, d.material.map && d.material.map.image && d.material.map.image.width, d.material.opacity]; }); return { mm, objs: objs.size, kinds: [...objs.values()].reduce((a, o) => { a[o.e.kind + ':' + o.e.type] = (a[o.e.kind + ':' + o.e.type] || 0) + 1; return a; }, {}), camPos: camera.position.toArray().map(v => +v.toFixed(1)), ud: camera.userData }; }
