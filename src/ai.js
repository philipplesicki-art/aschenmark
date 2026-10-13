import { TS } from './config.js';
import { G, hooks, simR } from './state.js';
import { defOf } from './factions.js';
import { mkBld, popUsed, popCap, canPlaceAt, hasBuilt } from './world.js';
import { regionAt, openedRegion } from './regions.js';
import { setOrder } from './path.js';
import { autoGather, train, trainBlock } from './units.js';
import { cast, canCast, abilityList, canPower, castPower, powerOf } from './combat.js';

function aiBuild(tp, ws) {
  const hq = G.ents.find(e => e.team === 1 && e.type === 'hq' && !e.dead);
  if (!hq || !ws.length) return;
  const d = defOf(G.fac[1], tp);
  if (G.ore[1] < d.cost) return;
  for (let k = 0; k < 40; k++) {
    const a = simR() * 6.28, rad = 110 + simR() * (tp === 'tower' ? 170 : 130);
    const gx = Math.round((hq.x + Math.cos(a) * rad) / TS - d.size / 2), gy = Math.round((hq.y + Math.sin(a) * rad) / TS - d.size / 2);
    if (!canPlaceAt(tp, gx, gy, 1)) continue;
    const w = ws.find(w => !w.order || w.order.t !== 'build') || ws[0];
    G.ore[1] -= d.cost;
    const s = mkBld(tp, 1, gx, gy, false);
    setOrder(w, { t: 'build', site: s.id });
    return;
  }
}

// Vorposten an einer Erzader gründen, die vom Hauptlager weit weg liegt.
function aiOutpost(ws, hq) {
  const d = defOf(G.fac[1], 'outpost');
  if (!d || G.ore[1] < d.cost + 120) return;
  const drops = G.ents.filter(e => e.team === 1 && !e.dead && e.kind === 'bld' && (e.type === 'hq' || e.d.dropoff));
  const deps = G.ents.filter(e => e.kind === 'dep' && !e.dead && e.amt > 900 && G.regions[regionAt(e.x, e.y)] && Math.hypot(e.x - hq.x, e.y - hq.y) < 900
    && !drops.some(o => Math.hypot(o.x - e.x, o.y - e.y) < 330)).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
  for (const dep of deps) for (let k = 0; k < 30; k++) {
    const a = simR() * 6.28, rad = 70 + simR() * 90;
    const gx = Math.round((dep.x + Math.cos(a) * rad) / TS - d.size / 2), gy = Math.round((dep.y + Math.sin(a) * rad) / TS - d.size / 2);
    if (!canPlaceAt('outpost', gx, gy, 1)) continue;
    const w = ws.find(w => !w.order || w.order.t !== 'build') || ws[0];
    G.ore[1] -= d.cost; const s = mkBld('outpost', 1, gx, gy, false); setOrder(w, { t: 'build', site: s.id });
    return;
  }
}

function enemiesNear(x, y, r) {
  return G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && Math.hypot(e.x - x, e.y - y) < r);
}

function aiHero(hero) {
  const list = abilityList(hero);
  list.forEach((a, i) => {
    if (!canCast(hero, i)) return;
    if (a.targeted) {
      const near = enemiesNear(hero.x, hero.y, a.range);
      if (near.length >= 2) {
        let best = near[0], bc = 0;
        for (const e of near) { const c = near.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < a.radius).length; if (c > bc) { bc = c; best = e; } }
        cast(hero, i, best.x, best.y);
      }
    } else if (a.id === 'bless') {
      const hurt = G.ents.filter(e => !e.dead && e.team === 1 && e.kind === 'unit' && e.hp < e.maxhp * .6 && Math.hypot(e.x - hero.x, e.y - hero.y) < 230);
      if (hurt.length >= 3) cast(hero, i);
    } else if (enemiesNear(hero.x, hero.y, 200).length >= 2) cast(hero, i);
  });
}

function aiPower(army) {
  if (G.t < 240 || !canPower(1)) return;
  const p = powerOf(1);
  if (p.id === 'rain' || p.id === 'surge') {
    const foes = G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && army.some(u => Math.hypot(u.x - e.x, u.y - e.y) < 320));
    let best = null, bc = 0;
    for (const e of foes) { const c = foes.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < p.radius).length; if (c > bc) { bc = c; best = e; } }
    if (best && bc >= 4) castPower(1, best.x, best.y);
  } else {
    const hurt = army.filter(u => u.hp < u.maxhp * .7);
    let best = null, bs = 0;
    for (const u of hurt) {
      const s = hurt.filter(o => Math.hypot(o.x - u.x, o.y - u.y) < p.radius).reduce((n, o) => n + (o.maxhp - o.hp), 0);
      if (s > bs) { bs = s; best = u; }
    }
    if (best && bs > 220) castPower(1, best.x, best.y);
  }
}

export function aiTick() {
  const A = G.ai, D = A.p, mine = G.ents.filter(e => e.team === 1 && !e.dead);
  const hq = mine.find(e => e.type === 'hq' && e.built);
  if (!hq) return;
  const ws = mine.filter(e => e.type === 'worker'), bars = mine.filter(e => e.type === 'barracks');
  const shops = mine.filter(e => e.type === 'workshop');
  const army = mine.filter(e => e.kind === 'unit' && e.type !== 'worker');
  const sites = mine.filter(e => e.kind === 'bld' && !e.built);
  for (const w of ws) if (!w.order) autoGather(w);

  const queuedW = hq.queue.filter(q => q.type === 'worker').length;
  if (ws.length + queuedW < D.workers && hq.queue.length < 2 && !trainBlock(hq, 'worker')) train(hq, 'worker');
  if (popUsed(1) >= popCap(1) - 3 && !sites.some(s => s.type === 'farm') && G.ore[1] >= defOf(G.fac[1], 'farm').cost) aiBuild('farm', ws);
  const wantBars = Math.min(D.maxBars, 1 + Math.floor(G.t / D.barEvery));
  if (bars.length + sites.filter(s => s.type === 'barracks').length < wantBars && ws.length >= 4) aiBuild('barracks', ws);
  if (D.siege && G.t > D.siegeAt - 90 && !shops.length && !sites.some(s => s.type === 'workshop') && hasBuilt(1, 'barracks') && ws.length >= 4) aiBuild('workshop', ws);
  if (D.towers && G.t > D.towerAt && mine.filter(e => e.type === 'tower').length + sites.filter(s => s.type === 'tower').length < D.towers && ws.length >= 4) aiBuild('tower', ws);

  if (D.hero && G.t > 240 && G.t > (A.opT || 0) && ws.length >= 5) {
    A.opT = G.t + 45;
    if (mine.filter(e => e.type === 'outpost').length < 2) aiOutpost(ws, hq);
  }

  const seq = ['melee', 'ranged', 'melee', 'cav', 'ranged'];
  const queued = bars.reduce((n, b) => n + b.queue.length, 0);
  const room = A.size + 4 - army.length - queued;
  if (room > 0) for (const b of bars) {
    if (!b.built || b.queue.length >= 2) continue;
    const tp = seq[A.k++ % seq.length];
    if (!trainBlock(b, tp)) train(b, tp);
  }
  for (const s of shops) {
    if (!s.built || s.queue.length >= 1) continue;
    if (D.siege && G.t > D.siegeAt && army.filter(u => u.type === 'siege').length < 2 && !trainBlock(s, 'siege')) train(s, 'siege');
  }
  if (D.hero && G.t > D.heroAt && !mine.some(e => e.type === 'hero') && !trainBlock(hq, 'hero')) train(hq, 'hero');

  const hero = army.find(e => e.type === 'hero');
  if (hero) aiHero(hero);
  aiPower(army);

  const myHQ = G.ents.find(e => e.team === 0 && e.type === 'hq' && !e.dead);
  if (!A.active && G.t > A.next && army.length >= A.size && myHQ) {
    army.forEach(u => setOrder(u, { t: 'amove', x: myHQ.x, y: myHQ.y }));
    A.active = true; A.wave++; A.size += D.grow; A.next = G.t + D.gap;
    hooks.toast('Die ' + 'Gegner marschieren! (Welle ' + A.wave + ')', 'bad'); hooks.sfx('horn');
  } else if (A.active) {
    if (army.length < 3) {
      A.active = false;
      army.forEach(u => setOrder(u, { t: 'move', x: hq.x - 40 + simR() * 80, y: hq.y + hq.r + 50 }));
    } else {
      for (const u of army) {
        if (u.order && u.order.t !== 'move') continue;
        let best = null, bd = 1e9;
        for (const e of G.ents) { if (e.team !== 0 || e.dead) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
        if (best) setOrder(u, { t: 'amove', x: best.x, y: best.y });
      }
    }
  }
  if (!A.active && hero && G.t > 330) {
    // Wilde Lager in offenen Gebieten räumen, solange kein Angriff läuft.
    const fighters = army.filter(u => u.type !== 'siege');
    if (A.camp) {
      const left = G.ents.some(e => e.team === 3 && !e.dead && Math.hypot(e.x - A.camp.x, e.y - A.camp.y) < 260);
      if (!left || fighters.length < 5) {
        A.camp = null; A.campT = G.t + 90;
        army.forEach(u => setOrder(u, { t: 'move', x: hq.x - 40 + simR() * 80, y: hq.y + hq.r + 50 }));
      }
    } else if (G.t > (A.campT || 0) && fighters.length >= Math.max(8, A.size - 2)) {
      let best = null, bd = 1e9;
      for (const e of G.ents) {
        if (e.team !== 3 || e.dead || !openedRegion(regionAt(e.x, e.y))) continue;
        const d = Math.hypot(e.x - hq.x, e.y - hq.y);
        if (d < bd && d < 2600) { bd = d; best = e; }
      }
      if (best) { A.camp = { x: best.x, y: best.y }; fighters.forEach(u => setOrder(u, { t: 'amove', x: best.x, y: best.y })); }
      else A.campT = G.t + 60;
    }
  }
  if (!A.active) {
    const inv = G.ents.find(e => e.team === 0 && !e.dead && e.kind === 'unit' && Math.hypot(e.x - hq.x, e.y - hq.y) < 380);
    if (inv) for (const u of army) if (!u.order || u.order.t === 'move') setOrder(u, { t: 'amove', x: inv.x, y: inv.y });
  }
}
