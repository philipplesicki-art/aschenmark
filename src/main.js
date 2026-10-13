import './style.css';
import { G, UI, hooks, cam, view } from './state.js';
import { newWorld, mkUnit, mkBld, canPlaceAt } from './world.js';
import { beginMatch, step } from './sim.js';
import { select, toScreen, toWorld } from './commands.js';
import { clampCam, centerOn, camInput } from './camera.js';
import * as R2 from './render.js';
import * as R3 from './render3d.js';
import { initInput } from './input.js';
import { wireHooks, wireTopBar, showStart, showChainEnd, refreshUI, ovOpen, cb, toast } from './ui.js';
import { initAudio, sfx, startMusic, stopMusic, setIntensity, setVolumes, setWeather, audioReady } from './audio.js';
import { evAt } from './events.js';
import { loadSettings } from './settings.js';
import { loadGame } from './save.js';
import { GATES, REGIONS } from './regions.js';
import { FACTIONS, FAC_IDS, otherFac } from './factions.js';
import { QUALITY } from './config.js';

const $ = id => document.getElementById(id);
const cv = $('c'), mm = $('mm'), gl = $('gl');
// 3D, wenn WebGL da ist; sonst die flache 2D-Darstellung als Ersatz.
let R = R2;
try { if (R3.attach3d(gl, cv, mm)) R = R3; } catch (err) { console.warn('3D nicht verfügbar:', err); }
if (R === R2) { gl.style.display = 'none'; R2.attachCanvases(cv, mm); }
const { resizeCanvas, buildTerrain, render, drawMini, burst, floatText, shake } = R;

// Grafikstufe: Link (?q=low|medium|high) vor Einstellung; ohne Wahl auf Touch-Geräten Mittel, sonst Hoch.
const qParam = (location.search.match(/[?&]q=(low|medium|high)/) || [])[1];
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const quality = qParam || (QUALITY[loadSettings().quality] ? loadSettings().quality : coarse ? 'medium' : 'high');
if (R.setQuality) R.setQuality(quality);

const quiet = fn => (...a) => { if (!(G && G.demo)) fn(...a); };
wireHooks({
  chainDone: () => showChainEnd(),
  setFx: on => R.setPost && R.setPost(on),
  setQuality: q => R.setQuality && R.setQuality(q),
  regionsChanged: id => {
    buildTerrain();
    const g = GATES[id]; if (!g || G.demo) return;
    toast(g.name + ' ist offen: ' + REGIONS[g.to].name, 'good'); sfx('horn');
    if (g.ridge === 'v') centerOn(g.at * 32, (g.a + g.b) / 2 * 32); else centerOn((g.a + g.b) / 2 * 32, g.at * 32);
  },
  sfx: quiet(sfx), burst, float: floatText, shake: quiet(shake),
  levelUp: h => {
    if (h.team !== 0 || G.demo) return;
    toast(h.d.name + ' erreicht Stufe ' + h.lvl, 'good'); sfx('level');
    floatText(h.x, h.y - 24, 'Stufe ' + h.lvl, '#ffe9a8');
    burst(h.x, h.y, 16, '#ffe9a8', 8);
  }
});

function audioOn() { const st = loadSettings(); initAudio(); setVolumes(st.music, st.sfx); }

function startMatch(fac0, diff, quests, fac1) {
  audioOn();
  fac0 = FACTIONS[fac0] ? fac0 : FAC_IDS[0];
  if (!FACTIONS[fac1] || fac1 === fac0) fac1 = otherFac(fac0);
  newWorld({ fac0, fac1, diff, quests });
  buildTerrain();
  beginMatch();
  cam.z = view.w < 640 ? 1 : 1.3; clampCam();
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  centerOn(hq.x + 40, hq.y - 20);
  select([hq.id]);
  refreshUI();
  stopMusic(); startMusic(fac0);
  toast(FACTIONS[fac0].name + ' gegen ' + FACTIONS[fac1].name + ': Verteidige deine Festung und zerstöre die gegnerische');
}
function loadMatch() {
  audioOn();
  if (!loadGame()) { toast('Kein Spielstand gefunden', 'bad'); showStart(); return; }
  buildTerrain();
  cam.z = view.w < 640 ? 1 : 1.3; clampCam();
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  if (hq) centerOn(hq.x + 40, hq.y - 20);
  G.paused = false; G.sel = [];
  refreshUI();
  stopMusic(); startMusic(G.fac[0]);
  toast('Spielstand geladen');
}

/* ---------- Szene hinter dem Hauptmenü: die eigene Festung lebt, die Kamera zieht langsam vorbei ---------- */
let menuFac = null, demoT = 0;
function demoBase() {
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  const plan = ['barracks', 'farm', 'tower', 'farm', 'workshop', 'tower', 'barracks'];
  let a = .3;
  for (const tp of plan) for (let k = 0; k < 60; k++, a += 2.39996) { // Goldener Winkel verteilt die Bauplätze
    const rad = 120 + k * 6, gx = Math.round((hq.x + Math.cos(a) * rad) / 32 - 1), gy = Math.round((hq.y + Math.sin(a) * rad) / 32 - 1);
    if (canPlaceAt(tp, gx, gy, 1)) { mkBld(tp, 0, gx, gy, true); break; }
  }
  const types = ['hero', 'melee', 'melee', 'melee', 'ranged', 'ranged', 'cav', 'siege'];
  types.forEach((tp, i) => mkUnit(tp, 0, hq.x + 70 + (i % 4) * 26, hq.y + 80 + Math.floor(i / 4) * 30));
}
function menuScene(fac) {
  fac = FACTIONS[fac] ? fac : FAC_IDS[0];
  if (G && G.demo && menuFac === fac && demoT < 600) return;
  menuFac = fac; demoT = 0;
  newWorld({ fac0: fac, fac1: otherFac(fac), diff: 'normal', seed: 2026 + FAC_IDS.indexOf(fac) * 17 });
  G.demo = true;
  demoBase();
  buildTerrain(); beginMatch();
  G.ai.next = 1e9; // keine Angriffswellen im Hintergrund
  for (let i = 0; i < 20 * 30; i++) step(.05); // Vorlauf: Arbeiter sind unterwegs, die KI baut
  G.sel = []; cam.z = view.w < 640 ? 1.1 : 1.5; demoCam(0);
  if (audioReady()) { stopMusic(); startMusic(fac); }
}
function demoCam(dt) {
  demoT += dt;
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0) || { x: 600, y: 1250 };
  const off = view.w > 700 ? view.w / cam.z * .2 : 0; // Festung rechts neben dem Menü
  // ohne Kartenbegrenzung: die Festung liegt am Westrand, links davon zeigt der Bergrand
  cam.x = hq.x - off + Math.sin(demoT * .045) * 150 - view.w / cam.z / 2; cam.y = hq.y + 20 + Math.sin(demoT * .031) * 70 - view.h / cam.z / 2;
}
// Musik im Menü startet mit der ersten Berührung (Browser erlauben Ton erst nach einer Eingabe).
const firstInput = () => {
  removeEventListener('pointerdown', firstInput); removeEventListener('keydown', firstInput);
  audioOn(); if (G && G.demo && menuFac) { stopMusic(); startMusic(menuFac); }
};
addEventListener('pointerdown', firstInput); addEventListener('keydown', firstInput);

cb.start = startMatch;
cb.load = loadMatch;
cb.restart = () => { stopMusic(); showStart(); };
cb.menuScene = menuScene;

if (R.setPost) R.setPost(loadSettings().fx !== false);
wireTopBar();
initInput(cv, mm);

// Bildrate: über Einstellungen einschaltbar, zum Prüfen der Leistung auf echter Hardware.
const fpsEl = document.createElement('div'); fpsEl.id = 'fps'; fpsEl.hidden = true; $('stage').appendChild(fpsEl);
let fpsN = 0, fpsT = 0, fpsWorst = 0;
function fpsTick(now, ms) {
  fpsN++; fpsWorst = Math.max(fpsWorst, ms);
  if (now - fpsT < 500) return;
  const on = !!loadSettings().fps; fpsEl.hidden = !on;
  if (on) fpsEl.textContent = Math.round(fpsN * 1000 / (now - fpsT)) + ' B/s · max ' + Math.round(fpsWorst) + ' ms · ' + (QUALITY[loadSettings().quality] || QUALITY[quality]).label;
  fpsN = 0; fpsT = now; fpsWorst = 0;
}

let last = performance.now(), lastUI = 0, lastMM = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const ms = now - last, dt = Math.min(.05, ms / 1000); last = now;
  fpsTick(now, ms);
  if (!G) return;
  if (G.demo) { step(dt); demoCam(dt); if (demoT > 600) menuScene(menuFac); }
  else { if (!G.paused && !G.over) step(dt); camInput(dt, ovOpen()); }
  render(dt, new Set(G.sel));
  setIntensity(G.over || G.demo ? 0 : G.combat / 8);
  setWeather(G.ev && G.ev.id, G.over || G.paused ? 0 : evAt(cam.x + view.w / cam.z / 2, cam.y + view.h / cam.z / 2));
  if (G.demo) return;
  if (now - lastUI > 250) { lastUI = now; refreshUI(); }
  if (now - lastMM > 100) { lastMM = now; drawMini(); }
}

function resize() { resizeCanvas(); if (G) clampCam(); }
new ResizeObserver(resize).observe($('stage'));
addEventListener('resize', resize);
resize();
showStart();
requestAnimationFrame(frame);

// Nur zum Prüfen: ?debug im Link macht Zustand und Schritte von außen erreichbar.
if (typeof location !== 'undefined' && /[?&]debug/.test(location.search)) window.__A = { get G() { return G; }, cam, step, centerOn, clampCam, select, view, dbg: R3.dbg, mkUnit, mkBld, toScreen, toWorld, startMatch, menuScene, UI, stats: R3.stats, setQuality: q => R.setQuality && R.setQuality(q), setPost: on => R.setPost && R.setPost(on), draw: (n = 1) => { for (let i = 0; i < n; i++) render(.016, new Set(G.sel)); } };
