import { evGather } from './events.js';
import { CARRY } from './config.js';
import { G, hooks, byId, alive, simR } from './state.js';
import { defOf } from './factions.js';
import { free, mkUnit, nearestDep, popUsed, popCap } from './world.js';
import { goTo, setOrder, nearestFree } from './path.js';
import { gap, entPoint, acquire, strike } from './combat.js';
import { TS } from './config.js';

export function nearestOwn(u, type) {
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (e.team !== u.team || e.type !== type || e.dead || !e.built) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Nächster Abgabepunkt für Erz: Burg oder Vorposten.
export function nearestDrop(u) {
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (e.team !== u.team || e.kind !== 'bld' || e.dead || !e.built || !(e.type === 'hq' || e.d.dropoff)) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function autoGather(u) {
  const d = nearestDep(u, 700);
  if (d) setOrder(u, { t: 'gather', dep: d.id }); else u.order = null;
}

function engage(u, t, dt) {
  const g = gap(u, t);
  if (g <= u.d.rng) {
    u.path = null; u.face = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.cd <= 0) strike(u, t);
  } else {
    const p = entPoint(u, t); goTo(u, p[0], p[1], dt);
  }
}

export function updUnit(u, dt) {
  u.cd = Math.max(0, u.cd - dt); u.hit = Math.max(0, u.hit - dt);
  u.buff = Math.max(0, u.buff - dt); u.slow = Math.max(0, u.slow - dt);
  u.weak = Math.max(0, u.weak - dt); u.shield = Math.max(0, u.shield - dt);
  u.rpT = Math.max(0, u.rpT - dt); u.scan -= dt;
  u.abCd[0] = Math.max(0, u.abCd[0] - dt); u.abCd[1] = Math.max(0, u.abCd[1] - dt);
  u.moving = false; u.working = false;
  const o = u.order;
  if (!o) {
    if (u.type !== 'worker' && u.scan <= 0) {
      u.scan = .35;
      const t = acquire(u, Math.max(u.d.rng + 40, 120));
      if (t) u.order = { t: 'attack', tg: t.id, auto: 1, hx: u.x, hy: u.y };
    }
    return;
  }
  switch (o.t) {
    case 'move': if (goTo(u, o.x, o.y, dt)) u.order = null; break;
    case 'amove': {
      if (u.type === 'worker') { if (goTo(u, o.x, o.y, dt)) u.order = null; break; }
      if (u.scan <= 0) { u.scan = .35; const t = acquire(u, u.d.sight * .85); o.sub = t ? t.id : 0; }
      const t = o.sub ? byId(o.sub) : null;
      if (alive(t)) engage(u, t, dt);
      else { o.sub = 0; if (goTo(u, o.x, o.y, dt)) u.order = null; }
      break;
    }
    case 'attack': {
      const t = byId(o.tg);
      if (!alive(t)) {
        if (o.auto && Math.hypot(u.x - o.hx, u.y - o.hy) > 40) setOrder(u, { t: 'move', x: o.hx, y: o.hy }); else u.order = null;
        break;
      }
      if (o.auto && gap(u, t) > u.d.sight * 1.4 && u.scan <= 0) { setOrder(u, { t: 'move', x: o.hx, y: o.hy }); break; }
      engage(u, t, dt); break;
    }
    case 'gather': {
      let dep = byId(o.dep);
      if (!dep || dep.dead || dep.amt <= 0) {
        const nd = nearestDep(u, 500);
        if (nd) { o.dep = nd.id; dep = nd; } else if (u.carry <= 0) { u.order = null; break; }
      }
      if (u.carry > 0) {
        const hq = nearestDrop(u); if (!hq) { u.order = null; break; }
        if (gap(u, hq) <= 6) {
          G.ore[u.team] += u.carry * (u.team === 1 ? G.ai.p.rate : 1);
          (G.mined ||= [0, 0])[u.team] += u.carry;
          u.carry = 0; u.gt = 0; u.path = null; u.done = false; u.pdx = undefined;
        } else { const p = entPoint(u, hq); goTo(u, p[0], p[1], dt); }
      } else if (dep) {
        if (gap(u, dep) <= 6) {
          u.path = null; u.working = true; u.face = Math.atan2(dep.y - u.y, dep.x - u.x); u.gt += dt * evGather(u);
          if (u.gt >= 1.6) {
            u.gt = 0; const take = Math.min(CARRY, dep.amt); dep.amt -= take; u.carry = take; u.pdx = undefined; u.done = false;
          }
        } else { const p = entPoint(u, dep); goTo(u, p[0], p[1], dt); }
      }
      break;
    }
    case 'build': {
      const s = byId(o.site);
      if (!alive(s) || s.built) { u.order = null; autoGather(u); break; }
      if (gap(u, s) <= 8) {
        u.path = null; u.working = true; u.face = Math.atan2(s.y - u.y, s.x - u.x);
        s.prog = Math.min(1, s.prog + dt / s.d.time);
        s.hp = Math.min(s.maxhp, s.hp + dt / s.d.time * s.maxhp * .9);
        if (s.prog >= 1) {
          s.built = true; s.hp = s.maxhp;
          if (s.team === 0) { hooks.toast(s.d.name + ' fertiggestellt', 'good'); hooks.sfx('done'); }
        }
      } else { const p = entPoint(u, s); goTo(u, p[0], p[1], dt); }
      break;
    }
  }
}

export function updBld(b, dt) {
  b.hit = Math.max(0, b.hit - dt);
  if (!b.built) return;
  if (b.queue.length) {
    const q = b.queue[0]; q.t += dt;
    if (q.t >= defOf(b.fac, q.type).time) {
      b.queue.shift();
      const u = mkUnit(q.type, b.team, b.x + (simR() - .5) * 40, b.y + b.r + 12);
      if (b.team === 0) hooks.sfx('done');
      if (u.type === 'worker' && !b.rally) autoGather(u);
      else if (b.rally) setOrder(u, { t: 'move', x: b.rally.x + (simR() - .5) * 20, y: b.rally.y + (simR() - .5) * 20 });
      else setOrder(u, { t: 'move', x: b.x + (simR() - .5) * 60, y: b.y + b.r + 50 });
    }
  }
  if (b.d.dmg) {
    b.cd -= dt;
    if (b.cd <= 0) { const t = acquire(b, b.d.rng); if (t) strike(b, t); else b.cd = .25; }
  }
}

export function separate() {
  const us = [];
  for (const e of G.ents) if (e.kind === 'unit' && !e.dead) us.push(e);
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 28 || Math.abs(dy) > 28) continue;
      const d = Math.hypot(dx, dy), m = a.r + b.r - 1;
      if (d < m && d > .01) {
        const k = (m - d) / d * .5;
        const ax = a.x - dx * k, ay = a.y - dy * k, bx = b.x + dx * k, by = b.y + dy * k;
        if (free(Math.floor(ax / TS), Math.floor(ay / TS))) { a.x = ax; a.y = ay; }
        if (free(Math.floor(bx / TS), Math.floor(by / TS))) { b.x = bx; b.y = by; }
      }
    }
    if (!free(Math.floor(a.x / TS), Math.floor(a.y / TS))) {
      const f = nearestFree(Math.floor(a.x / TS), Math.floor(a.y / TS));
      if (f) {
        const tx = (f[0] + .5) * TS, ty = (f[1] + .5) * TS, d = Math.hypot(tx - a.x, ty - a.y) || 1;
        a.x += (tx - a.x) / d * Math.min(d, 3); a.y += (ty - a.y) / d * Math.min(d, 3);
      }
    }
  }
}

export function trainBlock(b, tp) {
  const d = defOf(b.fac, tp), t = b.team;
  if (!b.built) return 'Gebäude im Bau';
  if (G.ore[t] < d.cost) return 'Nicht genug Erz';
  if (popUsed(t) + d.pop > popCap(t)) return 'Mehr Höfe nötig';
  if (b.queue.length >= 5) return 'Warteschlange voll';
  if (tp === 'hero' && G.ents.some(e => e.team === t && !e.dead && (e.type === 'hero' || (e.queue && e.queue.some(q => q.type === 'hero'))))) return 'Held bereits im Dienst';
  return null;
}

export function train(b, tp) {
  const m = trainBlock(b, tp);
  if (m) { if (b.team === 0) hooks.toast(m, 'bad'); return false; }
  G.ore[b.team] -= defOf(b.fac, tp).cost;
  b.queue.push({ type: tp, t: 0 });
  if (b.team === 0) hooks.sfx('train');
  return true;
}
