import { TS } from './config.js';
import { G, hooks, simR } from './state.js';
import { defOf } from './factions.js';
import { mkBld, popUsed, popCap, canPlaceAt, hasBuilt, nearestTree } from './world.js';
import { regionAt, openedRegion } from './regions.js';
import { setOrder } from './path.js';
import { autoGather, train, trainBlock } from './units.js';
import { cast, canCast, abilityList, canPower, castPower, powerOf } from './combat.js';
import { costOf, canAfford, pay, tierOf, UPGRADE, upgradeBlock, startUpgrade, TECH, techNext, techBlock, startResearch, trade, tradeBlock, foodRates, foodCap, farmsOf, SEASONS } from './economy.js';

// Die KI spielt eine Seite (T) gegen die andere (O). Im Spiel ist das Team 1; für Balance-Tests kann auch
// Team 0 von der KI gespielt werden (Zustand in G.ai0 statt G.ai).
let T = 1, O = 0;

const affordable = (c, reserveOre = 0, reserveWood = 0) => G.ore[T] >= (c.ore || 0) + reserveOre && G.wood[T] >= (c.wood || 0) + reserveWood;

function aiBuild(tp, ws, near) {
  const hq = near || G.ents.find(e => e.team === T && e.type === 'hq' && !e.dead);
  if (!hq || !ws.length) return false;
  const d = defOf(G.fac[T], tp), c = costOf(d);
  if (!canAfford(T, c)) return false;
  for (let k = 0; k < 40; k++) {
    const a = simR() * 6.28, rad = (near ? 50 : 110) + simR() * (tp === 'tower' ? 170 : near ? 90 : 130);
    const gx = Math.round((hq.x + Math.cos(a) * rad) / TS - d.size / 2), gy = Math.round((hq.y + Math.sin(a) * rad) / TS - d.size / 2);
    if (!canPlaceAt(tp, gx, gy, T)) continue;
    const w = ws.find(w => !w.order || w.order.t !== 'build') || ws[0];
    pay(T, c);
    const s = mkBld(tp, T, gx, gy, false);
    setOrder(w, { t: 'build', site: s.id });
    return true;
  }
  return false;
}

// Vorposten an einer Erzader gründen, die vom Hauptlager weit weg liegt.
function aiOutpost(ws, hq) {
  const d = defOf(G.fac[T], 'outpost'), c = costOf(d);
  if (!d || !affordable(c, 120, 60)) return;
  const drops = G.ents.filter(e => e.team === T && !e.dead && e.kind === 'bld' && (e.type === 'hq' || e.d.dropoff));
  const deps = G.ents.filter(e => e.kind === 'dep' && !e.dead && e.amt > 900 && G.regions[regionAt(e.x, e.y)] && Math.hypot(e.x - hq.x, e.y - hq.y) < 900
    && !drops.some(o => Math.hypot(o.x - e.x, o.y - e.y) < 330)).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
  for (const dep of deps) for (let k = 0; k < 30; k++) {
    const a = simR() * 6.28, rad = 70 + simR() * 90;
    const gx = Math.round((dep.x + Math.cos(a) * rad) / TS - d.size / 2), gy = Math.round((dep.y + Math.sin(a) * rad) / TS - d.size / 2);
    if (!canPlaceAt('outpost', gx, gy, T)) continue;
    const w = ws.find(w => !w.order || w.order.t !== 'build') || ws[0];
    pay(T, c); const s = mkBld('outpost', T, gx, gy, false); setOrder(w, { t: 'build', site: s.id });
    return;
  }
}

/* ---------- Wirtschaft: Holz, Holzlager, Ausbau, Forschung, Handel ---------- */
const isChopper = w => (w.order && w.order.t === 'chop') || (w.carry > 0 && w.cres === 'wood');
const busy = w => w.order && w.order.t === 'build';

// Anteil der Arbeiter, die Holz fällen sollen, je nach Vorrat
function woodShare() {
  const w = G.wood[T];
  return w < 120 ? .4 : w < 250 ? .27 : w < 450 ? .13 : w < 700 ? .05 : 0;
}
// Holzfäller nahe an der besten Abgabestelle (Holzlager oder Burg) ansetzen
function aiChop(w, drops) {
  let best = null, bd = 1e9;
  for (const d of drops) { const tr = nearestTree(d.x, d.y, 1100); if (tr) { const k = Math.hypot(tr.x - d.x, tr.y - d.y); if (k < bd) { bd = k; best = tr; } } }
  if (!best) { autoGather(w, 'ore'); return; }
  setOrder(w, { t: 'chop', cx: Math.floor(best.x / TS), cy: Math.floor(best.y / TS), hx: best.x, hy: best.y });
}
function aiWood(ws, mine, hq, D) {
  const drops = mine.filter(e => e.kind === 'bld' && e.built && e.d.drops && e.d.drops.includes('wood'));
  const choppers = ws.filter(isChopper), want = Math.floor(ws.length * woodShare() + .5);
  if (choppers.length < want) {
    const w = ws.find(x => !isChopper(x) && !busy(x) && !(x.carry > 0 && x.cres === 'ore'));
    if (w) aiChop(w, drops.length ? drops : [hq]);
  } else if (choppers.length > want + 1) {
    const w = choppers.find(x => !(x.carry > 0 && x.cres === 'wood')); if (w) autoGather(w, 'ore');
  }
  for (const w of ws) if (!w.order && !(w.carry > 0)) { if (choppers.length < want) aiChop(w, drops.length ? drops : [hq]); else autoGather(w, 'ore'); }
  // Holzlager am Wald: sobald Holzfäller weit von jeder Abgabestelle arbeiten
  const camps = mine.filter(e => e.type === 'lumber' && !e.dead).length;
  if (choppers.length >= 2 && camps < (D.maxCamps ?? 2) && G.t > 50 && !mine.some(e => e.type === 'lumber' && !e.built)) {
    const far = choppers.map(w => (w.order && w.order.t === 'chop' ? { x: w.order.hx, y: w.order.hy } : null)).filter(Boolean)
      .filter(p => !drops.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 260));
    if (far.length >= 2) aiBuild('lumber', ws, { x: far[0].x, y: far[0].y });
  }
}
// Rücklage, die die Ausbildung nicht antasten darf: der fällige Burgausbau.
function reserve(hq, D) {
  const tier = tierOf(T);
  if (tier >= 3 || hq.up || !hq.built || G.t < (D.tierAt[tier - 1] ?? 1e9) || ws0count() < 6) return { ore: 0, wood: 0 };
  if (enemiesNear(hq.x, hq.y, 450).length) return { ore: 0, wood: 0 }; // unter Beschuss: erst verteidigen
  return UPGRADE[tier + 1];
}
const ws0count = () => G.ents.filter(e => e.team === T && e.type === 'worker' && !e.dead).length;
function aiEconomy(hq, mine, ws, army, D) {
  const tier = tierOf(T);
  // Burg ausbauen
  if (tier < 3 && !hq.up && ws.length >= 6 && G.t > (D.tierAt[tier - 1] ?? 1e9) && !upgradeBlock(hq)) startUpgrade(hq);
  // Markt: gleicht aus, wenn ein Rohstoff übrig ist und der andere fehlt
  if (D.trade && tier >= 2 && !mine.some(e => e.type === 'market') && G.ore[T] > 380 && G.wood[T] > 380) aiBuild('market', ws);
  const mk = mine.find(e => e.type === 'market' && e.built);
  if (mk && D.trade) {
    if (G.food[T] < foodCap(T) * .35 && G.ore[T] > 350 && !tradeBlock(mk, 'ore')) trade(T, 'ore', 'food', 100);
    else if (G.ore[T] > 450 && G.wood[T] < 150 && !tradeBlock(mk, 'ore')) trade(T, 'ore', 'wood', 100);
    else if (G.wood[T] > 450 && G.ore[T] < 150 && !tradeBlock(mk, 'wood')) trade(T, 'wood', 'ore', 100);
  }
  // Forschung
  if (!D.research || G.t < 200) return;
  if (reserve(hq, D).ore) return; // erst der Ausbau
  const order = D.research === 1 ? ['mining', 'felling', 'harvest', 'weapons', 'storage', 'carry', 'armor', 'fort'] : ['mining', 'felling', 'harvest', 'weapons', 'storage', 'armor', 'carry', 'sig', 'fort', 'hero', 'siege', 'trade'];
  for (const id of order) {
    if (!techNext(T, id)) continue;
    const b = mine.find(e => e.type === TECH[id].at && e.built && !e.rs); if (!b || techBlock(b, id)) continue;
    const lv = TECH[id].levels[techNext(T, id) - 1];
    if (!affordable(lv, 110, 60)) continue;
    if (army.length < 4 && G.t < 400) continue; // zuerst ein Mindestheer
    startResearch(b, id); return;
  }
}

function enemiesNear(x, y, r) {
  return G.ents.filter(e => !e.dead && e.team === O && e.kind === 'unit' && Math.hypot(e.x - x, e.y - y) < r);
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
      const hurt = G.ents.filter(e => !e.dead && e.team === T && e.kind === 'unit' && e.hp < e.maxhp * .6 && Math.hypot(e.x - hero.x, e.y - hero.y) < 230);
      if (hurt.length >= 3) cast(hero, i);
    } else if (enemiesNear(hero.x, hero.y, 200).length >= 2) cast(hero, i);
  });
}

function aiPower(army) {
  if ((G.t < 240 && !G.battle) || !canPower(T)) return;
  const p = powerOf(T);
  if (p.id === 'rain' || p.id === 'surge') {
    const foes = G.ents.filter(e => !e.dead && e.team === O && e.kind === 'unit' && army.some(u => Math.hypot(u.x - e.x, u.y - e.y) < 320));
    let best = null, bc = 0;
    for (const e of foes) { const c = foes.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < p.radius).length; if (c > bc) { bc = c; best = e; } }
    if (best && bc >= 4) castPower(T, best.x, best.y);
  } else {
    const hurt = army.filter(u => u.hp < u.maxhp * .7);
    let best = null, bs = 0;
    for (const u of hurt) {
      const s = hurt.filter(o => Math.hypot(o.x - u.x, o.y - u.y) < p.radius).reduce((n, o) => n + (o.maxhp - o.hp), 0);
      if (s > bs) { bs = s; best = u; }
    }
    if (best && bs > 220) castPower(T, best.x, best.y);
  }
}

// Schlacht aus der Kampagne: nur Held und Machtwirken, die Truppen führt battle.js
export function aiSkirmish(team, foe) {
  T = team; O = foe;
  const army = G.ents.filter(e => e.team === T && e.kind === 'unit' && !e.dead);
  const hero = army.find(e => e.type === 'hero');
  if (hero) aiHero(hero);
  aiPower(army);
}

export function aiTick(team = 1) {
  T = team; O = 1 - team;
  const A = team === 1 ? G.ai : G.ai0, D = A.p, mine = G.ents.filter(e => e.team === T && !e.dead);
  const hq = mine.find(e => e.type === 'hq' && e.built);
  if (!hq) return;
  const ws = mine.filter(e => e.type === 'worker'), bars = mine.filter(e => e.type === 'barracks');
  const shops = mine.filter(e => e.type === 'workshop');
  const army = mine.filter(e => e.kind === 'unit' && e.type !== 'worker');
  const sites = mine.filter(e => e.kind === 'bld' && !e.built);
  aiWood(ws, mine, hq, D);

  const queuedW = hq.queue.filter(q => q.type === 'worker').length;
  if (ws.length + queuedW < D.workers && hq.queue.length < 2 && !trainBlock(hq, 'worker')) train(hq, 'worker');
  // Höfe: für die Versorgung und damit die Ernte in der Tauzeit den Verbrauch deckt (der Winter zehrt am Lager)
  const thaw = foodRates(T, SEASONS[0]);
  const farmNeed = popUsed(T) >= popCap(T) - 3 || (thaw.net < .3 + thaw.pop * .03 && G.t > 90 && farmsOf(T) < 14);
  if (farmNeed && !sites.some(s => s.type === 'farm') && canAfford(T, costOf(defOf(G.fac[T], 'farm')))) aiBuild('farm', ws);
  const wantBars = Math.min(D.maxBars, 1 + Math.floor(G.t / D.barEvery));
  if (bars.length + sites.filter(s => s.type === 'barracks').length < wantBars && ws.length >= 4) aiBuild('barracks', ws);
  if (D.siege && G.t > D.siegeAt - 90 && tierOf(T) >= 2 && !shops.length && !sites.some(s => s.type === 'workshop') && hasBuilt(T, 'barracks') && ws.length >= 4) aiBuild('workshop', ws);
  if (D.towers && G.t > D.towerAt && mine.filter(e => e.type === 'tower').length + sites.filter(s => s.type === 'tower').length < D.towers && ws.length >= 4) aiBuild('tower', ws);

  if (D.hero && G.t > 240 && G.t > (A.opT || 0) && ws.length >= 5) {
    A.opT = G.t + 45;
    if (mine.filter(e => e.type === 'outpost').length < 2) aiOutpost(ws, hq);
  }
  aiEconomy(hq, mine, ws, army, D);

  const seq = ['melee', 'ranged', 'melee', 'cav', 'ranged'];
  const queued = bars.reduce((n, b) => n + b.queue.length, 0);
  const room = A.size + 4 - army.length - queued;
  const keep = reserve(hq, D);
  if (room > 0) for (const b of bars) {
    if (!b.built || b.queue.length >= 2) continue;
    let tp = seq[A.k++ % seq.length];
    // Unterstützer (ab Stufe 2) und Elite (ab Stufe 3) werden zwischen die Fußtruppen gemischt
    const sup = army.filter(u => u.type === 'support').length + bars.reduce((n, x) => n + x.queue.filter(q => q.type === 'support').length, 0);
    if (D.supports && tierOf(T) >= 2 && A.k % 6 === 0 && sup < D.supports) tp = 'support';
    else if (D.elites && tierOf(T) >= 3 && A.k % 4 === 0) tp = 'elite';
    if (tp === 'cav' && tierOf(T) < 2) tp = 'melee'; // Reiter gibt es erst ab Burgstufe 2
    if (trainBlock(b, tp) && tp !== 'melee') tp = 'melee'; // fehlt Holz für Fernkämpfer, dann Speerträger
    if (G.ore[T] - defOf(G.fac[T], tp).cost < keep.ore || G.wood[T] - (defOf(G.fac[T], tp).wood || 0) < keep.wood) continue; // spart für den Ausbau
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

  const foeHQ = G.ents.find(e => e.team === O && e.type === 'hq' && !e.dead);
  if (!A.active && G.t > A.next && army.length >= A.size && foeHQ) {
    army.forEach(u => setOrder(u, { t: 'amove', x: foeHQ.x, y: foeHQ.y }));
    A.active = true; A.wave++; A.size += D.grow; A.next = G.t + D.gap;
    if (T === 1) { hooks.toast('Die Gegner marschieren! (Welle ' + A.wave + ')', 'bad'); hooks.sfx('horn'); }
  } else if (A.active) {
    if (army.length < 3) {
      A.active = false;
      army.forEach(u => setOrder(u, { t: 'move', x: hq.x - 40 + simR() * 80, y: hq.y + hq.r + 50 }));
    } else {
      for (const u of army) {
        if (u.order && u.order.t !== 'move') continue;
        let best = null, bd = 1e9;
        for (const e of G.ents) { if (e.team !== O || e.dead) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
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
    const inv = G.ents.find(e => e.team === O && !e.dead && e.kind === 'unit' && Math.hypot(e.x - hq.x, e.y - hq.y) < 380);
    if (inv) for (const u of army) if (!u.order || u.order.t === 'move') setOrder(u, { t: 'amove', x: inv.x, y: inv.y });
  }
}
