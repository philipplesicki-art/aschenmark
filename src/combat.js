import { TS, MULT, BMULT } from './config.js';
import { G, hooks, byId, alive, simR } from './state.js';
import { FACTIONS, XP_STEPS, MAX_HERO_LVL, heroLevel, facOf } from './factions.js';
import { setBlock } from './world.js';
import { setOrder } from './path.js';
import { damageDealtMul, damageTakenMul, xpMul, cooldownMul } from './economy.js';

export function gap(a, t) {
  const ar = a.kind === 'unit' ? a.r : 0;
  if (t.kind === 'unit') return Math.hypot(a.x - t.x, a.y - t.y) - ar - t.r;
  const x0 = t.gx * TS, y0 = t.gy * TS, s = t.size * TS;
  const cx = Math.max(x0, Math.min(a.x, x0 + s)), cy = Math.max(y0, Math.min(a.y, y0 + s));
  return Math.hypot(a.x - cx, a.y - cy) - ar;
}

// Punkt knapp außerhalb eines Gebäudes, auf der Seite der Einheit.
export function entPoint(u, t) {
  if (t.kind === 'unit') return [t.x, t.y];
  const x0 = t.gx * TS, y0 = t.gy * TS, s = t.size * TS;
  const cx = Math.max(x0, Math.min(u.x, x0 + s)), cy = Math.max(y0, Math.min(u.y, y0 + s));
  const dx = cx - t.x, dy = cy - t.y, d = Math.hypot(dx, dy) || 1;
  return [cx + dx / d * 10, cy + dy / d * 10];
}

export function dmgFor(a, t) {
  let d = a.d.dmg * (a.dmgMul || 1) * (a.buff > 0 ? 1.4 : 1) * (a.weak > 0 ? .75 : 1) * damageDealtMul(a);
  if (t.kind === 'bld') d *= (BMULT[a.type] || 1);
  else { const m = MULT[a.type]; if (m && m[t.type]) d *= m[t.type]; }
  return d;
}

const colOf = e => (e.fac ? facOf(e.fac).color : '#d2a64a');

export function heroOf(team) { return G.ents.find(e => e.team === team && e.type === 'hero' && !e.dead); }

function giveXp(team, x, y, amount) {
  for (const h of G.ents) {
    if (h.team !== team || h.type !== 'hero' || h.dead) continue;
    if (Math.hypot(h.x - x, h.y - y) > 520) continue;
    h.xp += Math.round(amount * xpMul(team));
    const nl = Math.min(MAX_HERO_LVL, heroLevel(h.xp));
    while (h.lvl < nl) {
      h.lvl++;
      h.maxhp = Math.round(h.maxhp * 1.12); h.hp = Math.min(h.maxhp, h.hp + h.maxhp * .25);
      h.dmgMul = 1 + .1 * (h.lvl - 1);
      hooks.levelUp(h);
      if (h.lvl === MAX_HERO_LVL && team === 0) hooks.achieve('HERO_MAX');
    }
  }
}

export function hurt(t, d, src) {
  if (!alive(t) || t.kind === 'dep') return;
  if (t.shield > 0) d *= .6;
  d *= damageTakenMul(t);
  t.hp -= d; t.hit = .12;
  G.combat = Math.min(12, G.combat + .5);
  hooks.burst(t.x, t.y, 2, colOf(t), t.kind === 'bld' ? t.r : 4);
  if (d >= 9 && (t.kind === 'bld' || t.type === 'hero' || Math.random() < .35)) hooks.float(t.x, t.y - (t.kind === 'bld' ? t.r : t.r + 6), Math.round(d), src && src.team === 0 ? '#ffe9a8' : '#ff9d86');
  if (t.team === 0 && G.t - G.alertT > 12) { G.alertT = G.t; hooks.toast('Angriff auf ' + t.d.name + '!', 'bad'); hooks.sfx('alarm'); }
  if (t.kind === 'unit' && !t.order && t.type !== 'worker' && src && src.kind === 'unit' && alive(src))
    t.order = { t: 'attack', tg: src.id, auto: 1, hx: t.x, hy: t.y };
  if (t.hp <= 0) kill(t, src);
}

export function kill(e, src) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  if (e.kind === 'bld') {
    setBlock(e, -1);
    hooks.burst(e.x, e.y, 26, '#6b5a45', e.r); hooks.burst(e.x, e.y, 12, '#e0833a', e.r);
    G.corpses.push({ kind: 'ruin', x: e.x, y: e.y, size: e.size, t: 0, life: 40, fac: e.fac });
    hooks.shake(e.size * 2.2, e.x, e.y);
  } else if (e.kind === 'unit') {
    hooks.burst(e.x, e.y, 9, colOf(e), 6);
    G.corpses.push({ kind: 'unit', x: e.x, y: e.y, face: e.face, type: e.type, fac: e.fac, r: e.r, t: 0, life: 9 });
  }
  if (e.team === 0) G.lost++; else if (e.team === 1) G.kills++;
  if (e.team === 3 && src && src.team < 2) { // Beute der wilden Wesen
    G.ore[src.team] += e.d.bounty || 0; giveXp(src.team, e.x, e.y, (e.d.pop || 1) * 12);
    if (src.team === 0) hooks.float(e.x, e.y - 14, '+' + (e.d.bounty || 0), '#e0933f');
  }
  G.map.delete(e.id);
  if (src && src.team !== e.team && src.team < 2 && (e.team === 0 || e.team === 1)) {
    const st = src.team;
    giveXp(st, e.x, e.y, e.kind === 'bld' ? 45 : (e.d.pop || 1) * 12);
    G.teamKills[st]++;
    if (G.teamKills[st] % 6 === 0) G.pp[st] = Math.min(6, G.pp[st] + 1);
  }
  if (e.type === 'hero' && e.team === 0) hooks.toast(e.d.name + ' ist gefallen', 'bad');
  if (e.type === 'hq') hooks.endGame(e.team === 0 ? 'lose' : 'win');
}

export function strike(a, t) {
  a.cd = a.d.cd;
  if (a.kind === 'unit') a.face = Math.atan2(t.y - a.y, t.x - a.x);
  if (a.d.rng > 60) {
    G.projs.push({ x: a.x, y: a.y - (a.kind === 'bld' ? 30 : 6), sx: a.x, sy: a.y, t: t.id, d: dmgFor(a, t), team: a.team, src: a.id, fire: a.fac === 'asch', big: a.type === 'siege' });
    hooks.sfx('shot');
  } else {
    hurt(t, dmgFor(a, t), a); hooks.sfx('hit');
    if (a.d.splash) {
      for (const e of G.ents) {
        if (e === t || e.dead || e.kind !== 'unit' || e.team === a.team) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= a.d.splash) hurt(e, dmgFor(a, e) * .55, a);
      }
      hooks.burst(t.x, t.y, 6, '#8a8f7c', a.d.splash * .5);
    }
  }
}

export function acquire(u, range) {
  let best = null, bs = 1e9;
  for (const e of G.ents) {
    if (e.team === u.team || e.team === 2 || e.dead || e.kind === 'dep') continue;
    const d = gap(u, e); if (d > range) continue;
    const sc = d + (e.kind === 'bld' ? 150 : 0) + (e.type === 'worker' ? -10 : 0);
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}

export function updProjs(dt) {
  for (const p of G.projs) {
    const t = byId(p.t);
    if (!alive(t)) { p.dead = true; continue; }
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), s = 380 * dt;
    p.vx = dx / (d || 1); p.vy = dy / (d || 1);
    if (d <= s + 6) { hurt(t, p.d, byId(p.src)); p.dead = true; } else { p.x += p.vx * s; p.y += p.vy * s; }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

/* ---------- Heldenfähigkeiten ---------- */
export const abilityList = u => FACTIONS[u.fac].abilities;
export function canCast(h, i) {
  const a = abilityList(h)[i];
  return alive(h) && !!a && h.lvl >= a.lvl && h.abCd[i] <= 0;
}

function around(h, r, enemy) {
  return G.ents.filter(e => e.kind === 'unit' && !e.dead && (enemy ? e.team !== h.team && e.team !== 2 : e.team === h.team) && Math.hypot(e.x - h.x, e.y - h.y) < r);
}

export function cast(h, i, x, y) {
  if (!canCast(h, i)) return false;
  const a = abilityList(h)[i];
  if (a.targeted) {
    if (x === undefined) return false;
    if (Math.hypot(x - h.x, y - h.y) > a.range * 1.1) { if (h.team === 0) hooks.toast('Ziel zu weit entfernt', 'bad'); return false; }
  }
  h.abCd[i] = a.cd * cooldownMul(h.team, h.fac);
  if (a.id === 'cry') {
    around(h, 250, false).forEach(e => { e.buff = 10; });
    G.marks.push({ x: h.x, y: h.y, t: 0, kind: 'cry', life: .9 }); hooks.sfx('horn');
  } else if (a.id === 'wall') {
    around(h, 220, false).forEach(e => { e.shield = 8; });
    G.marks.push({ x: h.x, y: h.y, t: 0, kind: 'wall', life: .9 }); hooks.sfx('horn');
  } else if (a.id === 'blast') {
    const dmg = 70 + 18 * h.lvl;
    for (const e of G.ents) {
      if (e.dead || e.team === h.team || e.team === 2 || e.kind === 'dep') continue;
      if (Math.hypot(e.x - x, e.y - y) <= a.radius + (e.kind === 'bld' ? e.r : e.r * .5)) hurt(e, e.kind === 'bld' ? dmg * .6 : dmg, h);
    }
    G.marks.push({ x, y, t: 0, kind: 'blast', life: .7, r: a.radius });
    hooks.burst(x, y, 30, '#ff9a3c', a.radius * .6); hooks.burst(x, y, 12, '#3a2a22', a.radius * .5);
    hooks.shake(5, x, y); hooks.sfx('boom');
  } else if (a.id === 'tide') {
    const dmg = 55 + 14 * h.lvl;
    for (const e of G.ents) {
      if (e.dead || e.team === h.team || e.team === 2 || e.kind === 'dep') continue;
      if (Math.hypot(e.x - x, e.y - y) > a.radius + (e.kind === 'bld' ? e.r : e.r * .5)) continue;
      hurt(e, e.kind === 'bld' ? dmg * .5 : dmg, h);
      if (e.kind === 'unit') e.slow = Math.max(e.slow, 5);
    }
    G.marks.push({ x, y, t: 0, kind: 'tide', life: .8, r: a.radius });
    hooks.burst(x, y, 26, '#bfe6ff', a.radius * .6); hooks.burst(x, y, 10, '#5a8fb0', a.radius * .4);
    hooks.shake(3, x, y); hooks.sfx('boom');
  } else if (a.id === 'bless') {
    around(h, 230, false).forEach(e => { e.hp = Math.min(e.maxhp, e.hp + e.maxhp / 3); });
    G.marks.push({ x: h.x, y: h.y, t: 0, kind: 'bless', life: .9 }); hooks.sfx('done');
  } else if (a.id === 'dread') {
    around(h, 220, true).forEach(e => { e.slow = 6; e.weak = 6; });
    G.marks.push({ x: h.x, y: h.y, t: 0, kind: 'dread', life: .9 }); hooks.sfx('horn');
  }
  if (h.team === 0) hooks.toast(a.name + '!', 'good');
  return true;
}

/* ---------- Mächte (globale Fähigkeiten) ---------- */
export const powerOf = team => FACTIONS[G.fac[team]].power;
export const canPower = team => G.pp[team] >= powerOf(team).cost && G.ppCd[team] <= 0;
export function castPower(team, x, y) {
  if (!canPower(team)) return false;
  const p = powerOf(team);
  G.pp[team] -= p.cost; G.ppCd[team] = p.cd * cooldownMul(team, G.fac[team]);
  G.zones.push({ type: p.id, x, y, r: p.radius, t: 0, dur: p.dur, team, acc: 0 });
  hooks.sfx(p.id === 'spring' ? 'done' : 'horn');
  if (team === 0) { hooks.toast(p.name + '!', 'good'); hooks.achieve('POWER_USED'); }
  return true;
}

export function updZones(dt) {
  for (const z of G.zones) {
    z.t += dt;
    if (z.type === 'spring') {
      for (const e of G.ents) {
        if (e.dead || e.team !== z.team || e.kind === 'dep') continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) <= z.r + (e.kind === 'bld' ? e.r : 0)) e.hp = Math.min(e.maxhp, e.hp + (e.kind === 'bld' ? 12 : 26) * dt);
      }
      if (Math.random() < dt * 14) hooks.burst(z.x + (Math.random() - .5) * z.r * 1.6, z.y + (Math.random() - .5) * z.r * 1.6, 1, '#9fe8ff', 2);
    } else if (z.type === 'surge') {
      z.acc += dt;
      while (z.acc >= .5) {
        z.acc -= .5;
        for (const e of G.ents) {
          if (e.dead || e.team === z.team || e.team === 2 || e.kind === 'dep') continue;
          if (Math.hypot(e.x - z.x, e.y - z.y) > z.r + (e.kind === 'bld' ? e.r : 0)) continue;
          hurt(e, e.kind === 'bld' ? 4 : 6, null); // zusammen etwa 70 je Einheit, wie der Feuerregen im Mittel
          if (e.kind === 'unit') e.slow = Math.max(e.slow, 1.2);
        }
      }
      if (Math.random() < dt * 18) hooks.burst(z.x + (Math.random() - .5) * z.r * 1.6, z.y + (Math.random() - .5) * z.r * 1.6, 2, '#a9d8f0', 6);
    } else if (z.type === 'rain') {
      z.acc += dt;
      while (z.acc >= .3) {
        z.acc -= .3;
        const a = simR() * 6.28, rr = Math.sqrt(simR()) * z.r, x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr;
        for (const e of G.ents) {
          if (e.dead || e.team === z.team || e.team === 2 || e.kind === 'dep') continue;
          if (Math.hypot(e.x - x, e.y - y) <= 40 + (e.kind === 'bld' ? e.r : 0)) hurt(e, e.kind === 'bld' ? 26 : 52, null);
        }
        G.marks.push({ x, y, t: 0, kind: 'blast', life: .45, r: 36 });
        hooks.burst(x, y, 8, '#ff9a3c', 20); hooks.shake(1.2, x, y);
      }
    }
  }
  G.zones = G.zones.filter(z => z.t < z.dur);
}
