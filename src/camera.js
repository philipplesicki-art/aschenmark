import { WW, WH } from './config.js';
import { cam, view, UI, proj } from './state.js';

export function clampCam() {
  const zmin = Math.max(view.w / WW, view.h / WH, .5);
  cam.z = Math.max(zmin, Math.min(1.8, cam.z));
  cam.x = Math.max(0, Math.min(WW - view.w / cam.z, cam.x));
  cam.y = Math.max(0, Math.min(WH - view.h / cam.z, cam.y));
}
const tw = (x, y) => proj.toWorld ? proj.toWorld(x, y) : [x / cam.z + cam.x, y / cam.z + cam.y];
// Zoom auf den Punkt unter dem Zeiger: Der Weltpunkt unter (x, y) bleibt dort.
export function zoomAt(x, y, nz) {
  const [wx, wy] = tw(x, y);
  cam.z = nz; clampCam(); if (proj.sync) proj.sync();
  const [w2x, w2y] = tw(x, y);
  cam.x += wx - w2x; cam.y += wy - w2y; clampCam(); if (proj.sync) proj.sync();
}
export function centerOn(wx, wy) {
  cam.x = wx - view.w / cam.z / 2; cam.y = wy - view.h / cam.z / 2; clampCam();
}
// Kamerabewegung per Tastatur und Bildschirmrand (nur Maus).
export function camInput(dt, blocked) {
  if (blocked) return;
  const k = UI.keys || {}, m = UI.mouse, sp = 720 / cam.z * dt;
  let dx = 0, dy = 0;
  if (k.arrowleft || k.a) dx--; if (k.arrowright || k.d) dx++;
  if (k.arrowup || k.w) dy--; if (k.arrowdown || k.s) dy++;
  if (m && m.in && !UI.touching) {
    const e = 14;
    if (m.x < e) dx--; if (m.x > view.w - e) dx++; if (m.y < e) dy--; if (m.y > view.h - e) dy++;
  }
  if (dx || dy) { cam.x += dx * sp; cam.y += dy * sp; clampCam(); }
}
