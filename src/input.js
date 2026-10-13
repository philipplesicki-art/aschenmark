// Maus, Touch und Tastatur. Befehle selbst stehen in commands.js.
import { G, UI, cam, view } from './state.js';
import { clampCam, zoomAt, centerOn } from './camera.js';
import {
  toWorld, pickAt, select, selEnts, cmdAt, clickSelect, boxSelect, selectSameType, selectArmy, selectIdle,
  ghostAt, doPlace, cancelMode, applyTarget, usePower, hotkeyFor
} from './commands.js';
import { hooks } from './state.js';
import { WW, WH } from './config.js';
import { initAudio } from './audio.js';
import { ovOpen, openMenu, menuKey } from './ui.js';

UI.keys = {}; UI.mouse = { x: 0, y: 0, in: false }; UI.drag = null; UI.touching = false;
const pts = new Map(); let pinch = null, lastTap = 0, mmDown = false;

export function initInput(cv, mm) {
  const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!G || ovOpen()) return;
    initAudio();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const [x, y] = rel(e);
    pts.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), moved: false });
    if (e.pointerType === 'mouse') {
      UI.touching = false;
      if (e.button === 2) {
        if (UI.mode) cancelMode(); else { const w = toWorld(x, y); cmdAt(w[0], w[1], false); }
        return;
      }
      if (e.button === 0 && !UI.mode) UI.drag = { sx: x, sy: y, x, y, active: false };
    } else {
      UI.touching = true;
      if (pts.size === 2) { pts.forEach(p => { p.moved = true; }); pinch = { ...pinchInfo(), z: cam.z }; }
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!G) return;
    const [x, y] = rel(e);
    UI.mouse.x = x; UI.mouse.y = y; UI.mouse.in = true; UI.mx = x; UI.my = y;
    const p = pts.get(e.pointerId);
    if (e.pointerType === 'mouse') {
      if (UI.drag) { UI.drag.x = x; UI.drag.y = y; if (!UI.drag.active && Math.hypot(x - UI.drag.sx, y - UI.drag.sy) > 6) UI.drag.active = true; }
      if (UI.mode === 'place') { const w = toWorld(x, y); ghostAt(w[0], w[1]); }
      return;
    }
    if (!p) return;
    const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
    if (pts.size >= 2 && pinch) {
      const n = pinchInfo();
      zoomAt(n.cx, n.cy, pinch.z * n.d / pinch.d);
      cam.x -= (n.cx - pinch.cx) / cam.z; cam.y -= (n.cy - pinch.cy) / cam.z; clampCam();
      pinch.cx = n.cx; pinch.cy = n.cy;
    } else {
      if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 9) p.moved = true;
      if (p.moved) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); }
    }
  });
  function pinchInfo() {
    const a = [...pts.values()];
    return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 };
  }
  function tapAt(x, y) {
    const [wx, wy] = toWorld(x, y);
    if (UI.mode === 'place') {
      const s = 1; void s;
      const prev = { gx: UI.place.gx, gy: UI.place.gy, has: UI.place.has };
      ghostAt(wx, wy);
      if (prev.has && prev.gx === UI.place.gx && prev.gy === UI.place.gy) doPlace();
      return;
    }
    if (UI.mode === 'amove') { cmdAt(wx, wy, true); cancelMode(); return; }
    if (UI.mode === 'target') {
      const near = UI.tapPos && Math.hypot(UI.tapPos[0] - x, UI.tapPos[1] - y) < 36;
      UI.tapPos = [x, y]; UI.mx = x; UI.my = y;
      if (near) applyTarget(wx, wy);
      return;
    }
    const e = pickAt(wx, wy, 9), sel = selEnts(), now = performance.now();
    if (e && e.team === 0) {
      hooks.sfx('click');
      if (sel.length === 1 && sel[0] === e && e.kind === 'unit' && now - lastTap < 500) selectSameType(e); else select([e.id]);
      lastTap = now; return;
    }
    if (sel.length && sel[0].team === 0) { cmdAt(wx, wy, false); return; }
    if (e) { select([e.id]); hooks.sfx('click'); } else select([]);
  }
  function endPointer(e) {
    if (!G) return;
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    const [x, y] = rel(e);
    if (e.pointerType === 'mouse') {
      if (e.type === 'pointerup' && e.button === 0) {
        const w = toWorld(x, y);
        if (UI.mode === 'place') { ghostAt(w[0], w[1]); doPlace(); }
        else if (UI.mode === 'amove') { cmdAt(w[0], w[1], true); cancelMode(); }
        else if (UI.mode === 'target') applyTarget(w[0], w[1]);
        else if (UI.drag) { if (UI.drag.active) boxSelect(UI.drag, e.shiftKey); else clickSelect(x, y, e.shiftKey, e.detail >= 2); }
      }
      UI.drag = null; return;
    }
    if (e.type === 'pointerup' && p && !p.moved && pts.size === 0 && performance.now() - p.t < 500) tapAt(x, y);
    if (pts.size < 2) pinch = null;
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') UI.mouse.in = false; });
  cv.addEventListener('wheel', e => {
    if (!G) return; e.preventDefault();
    const [x, y] = rel(e); zoomAt(x, y, cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });

  const mmPos = e => { const r = mm.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * WW, (e.clientY - r.top) / r.height * WH]; };
  mm.addEventListener('pointerdown', e => {
    if (!G) return;
    if (e.button === 2) { const w = mmPos(e); cmdAt(w[0], w[1], false); return; }
    mmDown = true; try { mm.setPointerCapture(e.pointerId); } catch (_) {}
    const w = mmPos(e); centerOn(w[0], w[1]);
  });
  mm.addEventListener('pointermove', e => { if (mmDown) { const w = mmPos(e); centerOn(w[0], w[1]); } });
  mm.addEventListener('pointerup', () => { mmDown = false; });
  mm.addEventListener('pointercancel', () => { mmDown = false; });
  mm.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    if (ovOpen()) { menuKey(k, e); return; }
    if (!G || G.demo) return;
    if (k === 'escape') { if (UI.mode) cancelMode(); else openMenu(); return; }
    if (/^[1-5]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); G.groups[k] = G.sel.slice(); hooks.toast('Gruppe ' + k + ' gespeichert'); }
      else if (G.groups[k]) {
        const ids = G.groups[k].filter(id => G.map.has(id)); select(ids);
        const now = performance.now();
        if (G.gk === k && now - G.gkT < 400 && ids.length) { const f = G.map.get(ids[0]); centerOn(f.x, f.y); }
        G.gk = k; G.gkT = now;
      }
      return;
    }
    if (k === ' ') { e.preventDefault(); const s = selEnts(); if (s.length) centerOn(s[0].x, s[0].y); return; }
    if (k === 'e') { selectArmy(); return; }
    if (k === '.') { const u = selectIdle(); if (u) centerOn(u.x, u.y); return; }
    if (k === 'r') { usePower(); return; }
    const c = hotkeyFor(k);
    if (c) { if (c.en()) c.fn(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) UI.keys[k] = true;
  });
  addEventListener('keyup', e => { UI.keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in UI.keys) UI.keys[k] = false; });
}
