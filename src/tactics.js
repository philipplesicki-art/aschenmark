// Taktik im Kampf: Flanke und Rücken, Sturmangriff der Reiter, gestellte Speere, Stellung halten.
// In Schlachten aus der Kampagne zusätzlich: gedämpfter Schaden (längere Gefechte), Moral mit Flucht und Sammeln, Aufstellungsphase.
// Reine Simulation: kein DOM, Zufall nur über simR().
import { G, hooks } from './state.js';

export const PACE = .02;        // Schaden an Einheiten in Schlachten (Gefechte dauern länger, Führung zählt mehr)
export const BLD_PACE = .2;     // Schaden an Mauern und Türmen in Schlachten
export const CHARGE_RUN = 110;  // Anlauf in Weltpixeln für einen Sturmangriff
export const DEPLOY_T = 40;     // Sekunden für die Aufstellung
export const ZONE = 340;        // Radius der Aufstellungszone
const MELEE = t => t === 'melee' || t === 'elite';

// Von wo trifft a die Einheit t? 0 von vorn, 1 Flanke, 2 Rücken
export function facing(t, a) {
  let d = Math.abs(Math.atan2(a.y - t.y, a.x - t.x) - (t.face || 0)) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d;
  return d > 2.2 ? 2 : d > 1.25 ? 1 : 0;
}
// Nahkampftreffer von a auf die Einheit t: Faktor auf den Schaden und was dabei geschah
export function meleeMods(a, t) {
  const f = facing(t, a), braced = MELEE(t.type) && f === 0 && (t.still || 0) > 1.2;
  let mul = f === 2 ? 1.5 : f === 1 ? 1.2 : 1, charge = false, spiked = false;
  if (braced) mul *= .8; // feste Reihe: von vorn schwerer zu treffen
  if (a.type === 'cav' && (a.run || 0) >= CHARGE_RUN) {
    if (braced) spiked = true; else { mul *= 1.9; charge = true; } // Sturmangriff; gestellte Speere fangen ihn ab
    a.run = 0;
  }
  return { mul, f, charge, spiked };
}

/* ---------- Bewegung verfolgen: Anlauf, Stehen ---------- */
export function track(u, dt) {
  const d = u.lx === undefined ? 0 : Math.hypot(u.x - u.lx, u.y - u.ly);
  if (d > .05) { u.run = Math.min(400, (u.run || 0) + d); u.still = 0; } else { u.run = Math.max(0, (u.run || 0) - 160 * dt); u.still = (u.still || 0) + dt; }
  u.lx = u.x; u.ly = u.y;
  const B = G.battle;
  if (B && B.phase === 'deploy' && u.team === 0 && B.home) { // Aufstellung: nur in der eigenen Zone
    const o = u.order, h = B.home[0];
    if (o && (o.t === 'move' || o.t === 'amove') && Math.hypot(o.x - h[0], o.y - h[1]) > ZONE) {
      const k = ZONE / Math.hypot(o.x - h[0], o.y - h[1]); o.x = h[0] + (o.x - h[0]) * k; o.y = h[1] + (o.y - h[1]) * k; u.path = null;
    }
  }
}

/* ---------- Moral (nur in Schlachten) ---------- */
const hasMorale = u => !!G.battle && u.kind === 'unit' && u.mor !== undefined;
export function initMorale() {
  for (const u of G.ents) if (u.kind === 'unit') { u.mor = u.type === 'hero' ? 100 : u.militia ? 70 : 100; u.rout = false; }
}
export function moraleLoss(u, n) { if (hasMorale(u) && u.type !== 'hero') u.mor = Math.max(0, u.mor - n * (1 - .15 * (u.vet || 0))); } // erfahrene Truppen wanken später
export function onDamage(t, d) { if (hasMorale(t)) moraleLoss(t, d / t.maxhp * 55); }
export function onDeath(e) {
  if (!G.battle || e.kind !== 'unit') return;
  const hero = e.type === 'hero';
  for (const u of G.ents) {
    if (u.dead || u.kind !== 'unit' || u === e) continue;
    const near = Math.hypot(u.x - e.x, u.y - e.y) < 170;
    if (u.team === e.team) { if (hero) moraleLoss(u, 30); else if (near) moraleLoss(u, 7); }
    else if (near && hasMorale(u)) u.mor = Math.min(100, u.mor + (hero ? 20 : 3)); // Feind fällt: Mut wächst
  }
  if (hero) hooks.toast(e.d.name + ' ist gefallen! ' + (e.team === 0 ? 'Die eigenen Reihen wanken.' : 'Der Feind wankt.'), e.team === 0 ? 'bad' : 'good');
}
// Wohin flieht eine Einheit: hinter die eigene Aufstellung
export function routGoal(u) {
  const B = G.battle; if (!B || !B.home) return [u.x, u.y];
  const mine = u.team === 0, h = B.home[mine ? 0 : 1], s = mine ? -1 : 1;
  return [h[0] + B.fwd[0] * s * 260, h[1] + B.fwd[1] * s * 260];
}
// Einmal je Sekunde: Lage um jede Einheit, Flucht und Sammeln
export function moraleTick() {
  const B = G.battle; if (!B || B.phase === 'deploy') return;
  const us = G.ents.filter(e => e.kind === 'unit' && !e.dead && e.mor !== undefined);
  for (const u of us) {
    let al = 0, fo = 0, hero = false, foeNear = 1e9;
    for (const o of us) {
      if (o === u) continue; const d = Math.hypot(o.x - u.x, o.y - u.y);
      const same = (o.team === 0) === (u.team === 0);
      if (same) { if (d < 170 && !o.rout) al += o.d.pop || 1; if (o.type === 'hero' && d < 240) hero = true; }
      else { if (d < 170 && !o.rout) fo += o.d.pop || 1; if (d < foeNear) foeNear = d; }
    }
    if (u.type === 'hero') continue;
    if (u.rout) {
      if (foeNear > 230) u.mor = Math.min(100, u.mor + (hero ? 9 : 5));
      if (u.mor >= 38 && foeNear > 160) { u.rout = false; if (u.team === 0) hooks.float(u.x, u.y - 16, 'gesammelt', '#cfe8c0'); }
      continue;
    }
    if (fo > (al + (u.d.pop || 1)) * 1.6) u.mor -= 1.2; else if (fo === 0) u.mor += 2; else if (al + 1 >= fo) u.mor += .5;
    if (hero) u.mor += 1;
    if (u.hp < u.maxhp * .3) u.mor -= .6;
    u.mor = Math.max(0, Math.min(100, u.mor));
    if (u.mor <= 0 && fo > 0) { u.rout = true; u.order = null; u.path = null; u.mor = 0; hooks.float(u.x, u.y - 16, 'Flucht!', u.team === 0 ? '#ff9d86' : '#ffe9a8'); }
  }
}
export const avgMorale = team => { const l = G.ents.filter(e => e.kind === 'unit' && !e.dead && e.mor !== undefined && (team === 0 ? e.team === 0 : e.team !== 0)); return l.length ? Math.round(l.reduce((n, u) => n + (u.rout ? 0 : u.mor), 0) / l.length) : 0; };
