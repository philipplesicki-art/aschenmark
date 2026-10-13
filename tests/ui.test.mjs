// Rauchtest für Darstellung, Oberfläche und Eingabe mit Attrappen statt Browser. Läuft mit: node tests/ui.test.mjs
import assert from 'node:assert/strict';

const noop = () => {};
const grad = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad
    : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop,
  set: () => true
});
function el(extra = {}) {
  const o = {
    style: {}, dataset: {}, children: [], hidden: false, width: 160, height: 112, value: '.6', innerHTML: '', textContent: '', className: '',
    classList: { toggle: noop, add: noop, remove: noop }, getContext: () => ctxStub, addEventListener: noop, setPointerCapture: noop,
    appendChild(c) { this.children.push(c); }, removeChild(c) { this.children = this.children.filter(x => x !== c); },
    get firstChild() { return this.children[0]; }, remove: noop,
    querySelector: () => null, insertAdjacentHTML: noop, closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }), ...extra
  };
  return o;
}
const els = {};
global.document = { getElementById: id => els[id] || (els[id] = el()), createElement: () => el() };
global.window = global; global.devicePixelRatio = 1; global.addEventListener = noop;
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: noop };

const S = await import('../src/state.js');
const { newWorld, mkUnit } = await import('../src/world.js');
const { beginMatch, step } = await import('../src/sim.js');
const R = await import('../src/render.js');
const UIm = await import('../src/ui.js');
const C = await import('../src/commands.js');
const { initInput } = await import('../src/input.js');
const { cast, castPower, heroOf } = await import('../src/combat.js');
const { camInput, centerOn, clampCam } = await import('../src/camera.js');
const A = await import('../src/audio.js');

const cv = el(), mm = el();
R.attachCanvases(cv, mm);
R.resizeCanvas();
UIm.wireHooks({ burst: R.burst, float: R.floatText, shake: R.shake, sfx: A.sfx });
initInput(cv, mm);
UIm.wireTopBar();
UIm.showStart();

for (const [f0, f1] of [['wacht', 'asch'], ['asch', 'wacht'], ['salz', 'asch'], ['wacht', 'salz']]) {
  newWorld({ fac0: f0, fac1: f1, diff: 'normal', seed: 11 });
  R.buildTerrain(); beginMatch();
  const { G, cam } = S;
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  centerOn(hq.x, hq.y); clampCam();
  C.select([hq.id]); UIm.refreshUI();
  // Held, Truppen und Gegner in Sichtweite, damit alle Zeichenpfade laufen.
  const hero = mkUnit('hero', 0, hq.x + 80, hq.y + 80);
  for (const t of ['melee', 'ranged', 'cav', 'siege', 'worker']) { mkUnit(t, 0, hq.x + 120, hq.y + 100); mkUnit(t, 1, hq.x + 200, hq.y + 110); }
  const wbar = C.cmdDefs();
  assert.ok(wbar.length >= 2, 'Burg zeigt Ausbildungsknöpfe');
  C.select([hero.id]); UIm.refreshUI();
  const defs = C.cmdDefs();
  assert.ok(defs.some(d => d.id === 'ab0') && defs.some(d => d.id === 'ab1'), 'Heldenfähigkeiten als Knöpfe');
  C.select(G.ents.filter(e => e.team === 0 && e.type === 'worker').map(e => e.id)); UIm.refreshUI();
  assert.ok(C.cmdDefs().some(d => d.id === 'bworkshop'), 'Arbeiter können Werkstatt bauen');
  S.UI.mode = 'place'; S.UI.place = { type: 'farm', gx: 12, gy: 36, ok: true, has: true };
  for (let i = 0; i < 40; i++) { step(.05); R.render(.05, new Set(G.sel)); }
  C.cancelMode();
  G.pp[0] = 6; castPower(0, hq.x + 100, hq.y); cast(hero, 0, hq.x + 200, hq.y + 110); hero.xp = 700;
  S.UI.mode = 'target'; S.UI.target = { kind: 'power' }; S.UI.mx = 300; S.UI.my = 300;
  for (let i = 0; i < 80; i++) { step(.05); R.render(.05, new Set(G.sel)); }
  R.drawMini(); UIm.refreshUI(); camInput(.05, false);
  for (const e of G.ents) if (e.kind === 'bld' && e.team === 1) e.hp = e.maxhp * .3;
  R.render(.05, new Set());
  console.log(f0, 'gegen', f1, 'gezeichnet:', G.ents.length, 'Objekte,', G.parts.length, 'Partikel');
}
// Menüs: jeden Bildschirm öffnen und durchklicken.
{
  const click = (act, v) => els.card.onclick({ target: { closest: () => ({ dataset: { act, v }, disabled: false }) } });
  let started = null; UIm.cb.start = (...a) => { started = a; }; UIm.cb.menuScene = () => {}; UIm.cb.restart = () => UIm.showStart();
  UIm.showStart();
  click('new'); click('fac', 'salz'); click('opp', 'asch'); click('diff', 'hard'); click('quests'); click('start');
  assert.equal(started[0], 'salz'); assert.equal(started[1], 'hard'); assert.equal(started[3], 'asch');
  UIm.showStart(); click('new'); click('fac', 'asch'); click('opp', 'random'); click('start');
  assert.equal(started[0], 'asch'); assert.ok(['wacht', 'salz'].includes(started[3]), 'Zufallsgegner ist eine andere Fraktion');
  UIm.showStart();
  for (const a of ['settings', 'chronicle', 'help', 'credits']) { click(a); if (a === 'settings') { click('q', 'low'); click('fx'); click('fps'); click('fx'); click('fps'); } click('back'); }
  assert.ok(UIm.menuKey('escape'), 'Escape im Hauptmenü wird abgefangen');
  const { G } = S; G.paused = false; G.over = null; G.demo = false;
  UIm.openMenu(); assert.ok(G.paused, 'Pause hält das Spiel an');
  click('settings'); click('back'); click('help'); click('back'); click('menu'); click('no'); UIm.menuKey('escape');
  assert.equal(G.paused, false, 'Escape setzt das Spiel fort');
  G.quest = { chain: 'salz', i: 12, done: [], finished: true }; UIm.showChainEnd(); click('resume');
  console.log('Menüs ok');
}
// Modelle: jede Einheit und jedes Gebäude aller Fraktionen lässt sich bauen und bleibt sparsam an Zeichenaufrufen.
{
  const MD = await import('../src/models3d.js');
  const calls = g => { let n = 0; g.traverse(o => { if (o.isMesh || o.isSprite) n++; }); return n; };
  const worst = { unit: 0, bld: 0 };
  for (const f of ['wacht', 'asch', 'salz']) {
    for (const t of ['worker', 'melee', 'ranged', 'cav', 'siege', 'hero']) worst.unit = Math.max(worst.unit, calls(MD.buildUnit(f, t)));
    for (const t of ['hq', 'barracks', 'workshop', 'farm', 'outpost', 'tower', 'lumber', 'market']) for (const seed of [1, 2, 3]) worst.bld = Math.max(worst.bld, calls(MD.buildBld(f, t, seed)));
  }
  for (const t of ['melee', 'ranged', 'brute']) worst.unit = Math.max(worst.unit, calls(MD.buildUnit('wild', t)));
  assert.ok(worst.unit <= 18, 'Einheit mit zu vielen Zeichenaufrufen: ' + worst.unit);
  assert.ok(worst.bld <= 45, 'Gebäude mit zu vielen Zeichenaufrufen: ' + worst.bld);
  console.log('Modelle ok, höchstens', worst.unit, 'Aufrufe je Einheit und', worst.bld, 'je Gebäude');
}
// Modelle aus Dateien: ein registriertes Modell ersetzt das Code-Modell, Animationen folgen dem Zustand.
{
  const MD = await import('../src/models3d.js'), THREE = await import('three');
  const sc = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)); body.name = 'Koerper'; sc.add(body);
  const smoke = new THREE.Object3D(); smoke.name = 'Rauch1'; smoke.position.set(0, 3, 0); sc.add(smoke);
  const clip = (name, y) => new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack('Koerper.position[y]', [0, 1], [0, y])]);
  MD.registerModel('wacht:melee', { scene: sc, animations: [clip('stehen', 0), clip('gehen', .2)] });
  MD.registerModel('wacht:barracks', { scene: sc.clone(true), animations: [] });
  const u = MD.buildUnit('wacht', 'melee'), an = u.userData.anim;
  assert.ok(u.userData.fromFile && an && an.actions.gehen, 'Einheit nutzt das Dateimodell mit Animationen');
  assert.ok(MD.buildUnit('asch', 'melee').userData.fromFile !== true, 'ohne Datei bleibt das Code-Modell');
  const e = { moving: true, working: false, dead: false };
  MD.playAnim(an, MD.pickClip(e, false), .1); assert.equal(an.name, 'gehen');
  e.moving = false; MD.playAnim(an, MD.pickClip(e, false), .1); assert.equal(an.name, 'stehen');
  assert.equal(MD.pickClip(e, true), 'angriff'); MD.playAnim(an, 'angriff', .1); assert.ok(an.cur, 'fehlende Animation fällt auf stehen zurück');
  const b = MD.buildBld('wacht', 'barracks', 3);
  assert.ok(b.userData.fromFile && b.userData.smoke.length === 1 && b.userData.scaffold, 'Gebäude aus Datei mit Rauchpunkt und Baugerüst');
  MD.clearModels();
  assert.ok(!MD.buildUnit('wacht', 'melee').userData.fromFile, 'nach dem Leeren wieder Code-Modelle');
  console.log('Dateimodelle ok');
}
UIm.handleEnd('win'); UIm.openMenu();
A.sfx('hit');
console.log('UI-Rauchtest bestanden');
