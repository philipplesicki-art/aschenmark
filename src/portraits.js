// Bildnisse für die Oberfläche: Kopf und Schultern einer Einheit (bzw. das ganze Gebäude oder Gerät) aus dem echten 3D-Modell,
// einmal je Fraktion und Typ in einem kleinen eigenen Zeichner gerechnet und als Bild zwischengespeichert.
// portrait() liefert sofort die Bildadresse oder null; fehlt das Bild noch, wird es im Leerlauf gerechnet.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as MD from './models3d.js';

const PX = 224, CACHE = new Map(), QUEUE = [];
let R = null, scene = null, cam = null, busy = false, failed = false;

function setup() {
  const cv = document.createElement('canvas'); cv.width = cv.height = PX;
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(PX, PX, false); R.setClearColor(0x000000, 0);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.25;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  scene.add(new THREE.HemisphereLight(0x8fa4c0, 0x241c16, .55));
  const key = new THREE.DirectionalLight(0xffd2a0, 2.6); key.position.set(3, 3.5, 3); scene.add(key);   // warmes Fackellicht von vorn
  const rim = new THREE.DirectionalLight(0x9cc0ff, 3.2); rim.position.set(-3, 2.5, -3.5); scene.add(rim); // kaltes Gegenlicht für die Kontur
  cam = new THREE.PerspectiveCamera(24, 1, .05, 400);
}

function shoot(kind, fac, type) {
  if (!R) { try { setup(); } catch (err) { R = null; failed = true; return false; } } // ohne WebGL (Tests, alte Grafik): keine Bildnisse
  const m = kind === 'bld' ? MD.buildBld(fac, type, 1) : MD.buildUnit(fac, type);
  const u = m.userData;
  if (u.anim) MD.playAnim(u.anim, 'stehen', .6);
  if (u.scaffold) u.scaffold.visible = false;
  if (u.snowParts) u.snowParts.forEach(s => { s.visible = false; });
  scene.add(m); m.updateMatrixWorld(true);
  // Modelle blicken nach +X; die Kamera steht leicht schräg davor. Bei Reitern gehört der Knochen 'head' dem Pferd: dort das ganze Tier zeigen.
  const box = new THREE.Box3().setFromObject(m), bh = box.max.y - box.min.y;
  const head = kind === 'unit' && type !== 'cav' && m.getObjectByName('head'), a = .32;
  if (head) {
    const p = new THREE.Vector3(); head.getWorldPosition(p);
    const k = Math.max(.6, bh / 2.25), half = .5 * k, tgt = p.add(new THREE.Vector3(0, .06 * k, 0)), d = half / Math.tan(cam.fov * Math.PI / 360);
    cam.position.set(tgt.x + Math.cos(a) * d, tgt.y + .1 * d, tgt.z + Math.sin(a) * d); cam.lookAt(tgt.x, tgt.y - .04 * k, tgt.z);
  } else {
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), cav = type === 'cav';
    // Reiter: die senkrechte Lanze nicht mitzählen, sondern nach Länge des Pferdes rahmen, Blick auf Reiter und Pferdekopf
    let r = sz.length() * .5; if (cav) { r = Math.max(sz.x, sz.z) * .62; c.y = box.min.y + r * 1.15; }
    const d = r * (cav ? .62 : kind === 'bld' ? .8 : .66) / Math.tan(cam.fov * Math.PI / 360), dir = new THREE.Vector3(Math.cos(cav ? .9 : .6), cav ? .3 : .62, Math.sin(cav ? .9 : .6)).normalize();
    cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c.x, c.y - r * .05, c.z);
  }
  cam.near = .05; cam.far = 400; cam.updateProjectionMatrix();
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(m);
  return url;
}

function pump() {
  if (busy || !QUEUE.length) return;
  busy = true;
  const run = () => {
    const [key, kind, fac, type] = QUEUE.shift();
    try { CACHE.set(key, failed ? false : shoot(kind, fac, type)); } catch (err) { console.warn('Bildnis nicht möglich:', key, err); CACHE.set(key, false); if (!R || !R.getContext()) failed = true; }
    busy = false; if (QUEUE.length) pump();
  };
  setTimeout(run, 16);
}

// kind: 'unit' oder 'bld'. Ergebnis: Bildadresse, null (wird gerade gerechnet) oder false (nicht möglich).
export function portrait(kind, fac, type) {
  if (typeof document === 'undefined') return false;
  const key = kind + ':' + fac + ':' + type;
  if (failed) return false;
  if (CACHE.has(key)) return CACHE.get(key);
  if (!QUEUE.some(q => q[0] === key)) { QUEUE.push([key, kind, fac, type]); pump(); }
  return null;
}
// Bildnisse vorab rechnen (z. B. die Truppen der eigenen Fraktion beim Spielbeginn)
export function warm(list) { for (const [kind, fac, type] of list) portrait(kind, fac, type); }
