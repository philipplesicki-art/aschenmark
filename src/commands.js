// Spielerbefehle: Auswahl, Befehle, Bauen, Fähigkeiten und die Definition der Befehlsknöpfe.
// Kein DOM hier, damit die Logik auch in Tests laufen kann.
import { TS, GW } from './config.js';
import { G, UI, hooks, cam, view, proj, byId, alive } from './state.js';
import { FACTIONS, HK, defOf } from './factions.js';
import { mkBld, canPlaceAt, hasBuilt } from './world.js';
import { setOrder } from './path.js';
import { trainBlock, train } from './units.js';
import { kill, cast, canCast, abilityList, canPower, castPower, powerOf, heroOf } from './combat.js';

export const selEnts = () => G.sel.map(id => G.map.get(id)).filter(Boolean);
export function select(ids) { G.sel = ids; UI.sig = ''; }
export function toWorld(x, y) { return proj.toWorld ? proj.toWorld(x, y) : [x / cam.z + cam.x, y / cam.z + cam.y]; }
// Weltpunkt (mit Höhe h in Welteinheiten, nur in 3D) auf den Bildschirm.
export function toScreen(wx, wy, h) { return proj.toScreen ? proj.toScreen(wx, wy, h || 0) : [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z]; }

export function shown(e) {
  if (e.team === 0) return true;
  if (e.kind === 'unit') return G.fog[Math.floor(e.y / TS) * GW + Math.floor(e.x / TS)] === 2;
  return e.seen;
}

export function pickAt(wx, wy, pad) {
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (e.dead || !shown(e) || e.kind !== 'unit') continue;
    let d = Math.hypot(e.x - wx, e.y - wy);
    if (proj.toWorld) d = Math.min(d, Math.hypot(e.x - wx, e.y - 11 - wy)); // in 3D liegt der Körper über dem Standpunkt
    if (d <= e.r + (pad || 5) && d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  for (const e of G.ents) {
    if (e.dead || e.kind === 'unit' || !shown(e)) continue;
    const x0 = e.gx * TS, y0 = e.gy * TS, s = e.size * TS;
    if (wx >= x0 - 2 && wx <= x0 + s + 2 && wy >= y0 - (e.kind === 'bld' ? s * .4 : 0) && wy <= y0 + s + 2) return e;
  }
  return null;
}

export function mark(x, y, kind) { G.marks.push({ x, y, t: 0, kind }); }

export function cmdAt(wx, wy, am) {
  const s = selEnts();
  if (!s.length || s[0].team !== 0) return;
  const units = s.filter(e => e.kind === 'unit');
  if (!units.length) {
    const b = s[0];
    if (b.kind === 'bld' && b.d.trains) { b.rally = { x: wx, y: wy }; mark(wx, wy, 'rally'); hooks.sfx('click'); }
    return;
  }
  const t = am ? null : pickAt(wx, wy, 10);
  if (t) {
    if (t.team === 1 || t.team === 3) { units.forEach(u => setOrder(u, { t: 'attack', tg: t.id })); mark(t.x, t.y, 'atk'); hooks.sfx('cmd'); return; }
    if (t.kind === 'dep') {
      units.forEach(u => { if (u.type === 'worker') setOrder(u, { t: 'gather', dep: t.id }); else setOrder(u, { t: 'move', x: wx, y: wy }); });
      mark(t.x, t.y, 'move'); hooks.sfx('cmd'); return;
    }
    if (t.team === 0 && t.kind === 'bld' && !t.built && units.some(u => u.type === 'worker')) {
      units.forEach(u => { if (u.type === 'worker') setOrder(u, { t: 'build', site: t.id }); });
      mark(t.x, t.y, 'move'); hooks.sfx('cmd'); return;
    }
  }
  const n = units.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), sp = 22;
  units.forEach((u, i) => {
    const ox = ((i % cols) - (cols - 1) / 2) * sp, oy = (Math.floor(i / cols) - (rows - 1) / 2) * sp;
    setOrder(u, { t: am ? 'amove' : 'move', x: wx + ox, y: wy + oy });
  });
  mark(wx, wy, am ? 'atk' : 'move'); hooks.sfx('cmd');
}

export function selectSameType(e) {
  select(G.ents.filter(u => {
    if (u.dead || u.team !== 0 || u.type !== e.type) return false;
    const [sx, sy] = toScreen(u.x, u.y, 1);
    return sx >= 0 && sx <= view.w && sy >= 0 && sy <= view.h;
  }).map(u => u.id));
}

export function clickSelect(x, y, shift, dbl) {
  const [wx, wy] = toWorld(x, y), e = pickAt(wx, wy, 6);
  if (!e) { if (!shift) select([]); return; }
  hooks.sfx('click');
  if (dbl && e.team === 0 && e.kind === 'unit') { selectSameType(e); return; }
  if (shift && e.team === 0 && e.kind === 'unit') {
    const cur = selEnts().filter(s => s.kind === 'unit' && s.team === 0).map(s => s.id);
    select(cur.includes(e.id) ? cur.filter(i => i !== e.id) : cur.concat(e.id)); return;
  }
  select([e.id]);
}

export function boxSelect(d, shift) {
  // Der Rahmen gilt im Bildschirmraum, damit er auch bei geneigter Kamera genau trifft.
  const x0 = Math.min(d.sx, d.x), x1 = Math.max(d.sx, d.x), y0 = Math.min(d.sy, d.y), y1 = Math.max(d.sy, d.y);
  const inBox = (e, h) => { const [sx, sy] = toScreen(e.x, e.y, h); return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; };
  let us = G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && inBox(e, 1)).map(e => e.id);
  if (!us.length) {
    const b = G.ents.find(e => !e.dead && e.team === 0 && e.kind === 'bld' && inBox(e, 1));
    if (b) { select([b.id]); hooks.sfx('click'); } else if (!shift) select([]);
    return;
  }
  if (shift) us = [...new Set(selEnts().filter(s => s.kind === 'unit' && s.team === 0).map(s => s.id).concat(us))];
  select(us); hooks.sfx('click');
}

export function selectArmy() {
  const a = G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && e.type !== 'worker').map(e => e.id);
  if (a.length) { select(a); hooks.sfx('click'); } else hooks.toast('Noch keine Truppen', 'bad');
}
export function selectIdle() {
  const w = G.ents.filter(e => !e.dead && e.team === 0 && e.type === 'worker' && !e.order);
  if (!w.length) { hooks.toast('Keine untätigen Arbeiter'); return null; }
  G.idleI = (G.idleI + 1) % w.length;
  const u = w[G.idleI]; select([u.id]); hooks.sfx('click');
  return u;
}

/* ---------- Bauen ---------- */
export function buildBlock(tp) {
  const d = defOf(G.fac[0], tp);
  if (G.ore[0] < d.cost) return 'Nicht genug Erz';
  if (d.needs && !hasBuilt(0, d.needs)) return defOf(G.fac[0], d.needs).name + ' nötig';
  return null;
}
export function startPlace(tp) {
  const m = buildBlock(tp);
  if (m) { hooks.toast(m, 'bad'); return; }
  UI.mode = 'place'; UI.place = { type: tp, gx: 0, gy: 0, ok: false, has: false }; UI.sig = '';
  hooks.toast('Bauplatz wählen. Esc bricht ab.');
}
export function ghostAt(wx, wy) {
  const s = defOf(G.fac[0], UI.place.type).size;
  UI.place.gx = Math.round(wx / TS - s / 2); UI.place.gy = Math.round(wy / TS - s / 2);
  UI.place.ok = canPlaceAt(UI.place.type, UI.place.gx, UI.place.gy, 0); UI.place.has = true;
}
export function doPlace() {
  const p = UI.place;
  if (!p.ok) { hooks.toast('Hier kann nicht gebaut werden', 'bad'); return; }
  const d = defOf(G.fac[0], p.type), ws = selEnts().filter(e => e.type === 'worker');
  if (!ws.length || buildBlock(p.type)) return;
  G.ore[0] -= d.cost;
  const s = mkBld(p.type, 0, p.gx, p.gy, false);
  ws.forEach(w => setOrder(w, { t: 'build', site: s.id }));
  UI.mode = null; UI.place = null; UI.sig = ''; hooks.sfx('place');
}
export function cancelSite(b) {
  G.ore[0] += Math.floor(defOf(b.fac, b.type).cost * .75);
  kill(b); G.lost--; select([]);
}
export function cancelMode() { UI.mode = null; UI.place = null; UI.target = null; UI.sig = ''; }

/* ---------- Gezielte Fähigkeiten und Mächte ---------- */
export function beginTarget(kind, data) {
  UI.mode = 'target'; UI.target = { kind, ...data }; UI.sig = '';
  hooks.toast('Ziel wählen. Esc bricht ab.');
}
export function applyTarget(wx, wy) {
  const t = UI.target; if (!t) return;
  if (t.kind === 'ability') {
    const h = byId(t.hero);
    if (cast(h, t.i, wx, wy)) cancelMode();
  } else if (t.kind === 'power') {
    if (castPower(0, wx, wy)) cancelMode();
  }
}
export function usePower() {
  if (!canPower(0)) {
    const p = powerOf(0);
    hooks.toast(G.ppCd[0] > 0 ? p.name + ' lädt noch' : p.name + ' braucht ' + p.cost + ' Machtpunkte', 'bad');
    return;
  }
  beginTarget('power', {});
}

/* ---------- Befehlsknöpfe ---------- */
export function cmdDefs() {
  if (!G || G.over) return [];
  const s = selEnts(), defs = [], fac = FACTIONS[G.fac[0]];
  if (UI.mode) defs.push({ id: 'cancel', label: 'Abbrechen', key: 'escape', en: () => true, fn: cancelMode });
  if (!s.length || s[0].team !== 0) return defs;
  const b = s.length === 1 && s[0].kind === 'bld' ? s[0] : null;
  if (b) {
    if (!b.built) { defs.push({ id: 'cs', label: 'Bau abbrechen', key: 'x', en: () => true, fn: () => cancelSite(b) }); return defs; }
    for (const tp of b.d.trains || []) {
      const d = defOf(b.fac, tp);
      defs.push({ id: 't' + tp, label: d.name, key: HK[tp], cost: d.cost, en: () => !trainBlock(b, tp), fn: () => train(b, tp) });
    }
    return defs;
  }
  const units = s.filter(e => e.kind === 'unit');
  if (units.some(u => u.type === 'worker')) {
    for (const tp of ['farm', 'barracks', 'workshop', 'tower', 'outpost']) {
      const d = fac.blds[tp];
      defs.push({ id: 'b' + tp, label: d.name, key: HK[tp], cost: d.cost, en: () => !buildBlock(tp), fn: () => startPlace(tp) });
    }
  }
  if (units.some(u => u.type !== 'worker')) defs.push({ id: 'am', label: 'Angriffsmarsch', key: 'a', en: () => true, on: () => UI.mode === 'amove', fn: () => { UI.mode = 'amove'; UI.sig = ''; hooks.toast('Ziel wählen'); } });
  if (units.length) defs.push({ id: 'halt', label: 'Halt', key: 's', en: () => true, fn: () => units.forEach(u => setOrder(u, null)) });
  const hero = units.find(u => u.type === 'hero');
  if (hero) {
    abilityList(hero).forEach((a, i) => {
      defs.push({
        id: 'ab' + i, label: a.name + (hero.lvl < a.lvl ? ' (Stufe ' + a.lvl + ')' : ''), key: a.key,
        en: () => canCast(hero, i), cd: () => hero.abCd[i], title: a.desc,
        fn: () => { if (a.targeted) beginTarget('ability', { hero: hero.id, i }); else cast(hero, i); }
      });
    });
  }
  return defs;
}
export function hotkeyFor(k) { return cmdDefs().find(c => c.key === k); }
export { heroOf };
