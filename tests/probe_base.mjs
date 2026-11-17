// Probelauf: Kampagnenschlacht mit Basisbau, beide Seiten KI. Aufruf: node tests/probe_base.mjs [seed] [diff]
import * as CS from '../src/campaign/cstate.js';
import { newBaseBattle } from '../src/battle.js';
import { G, hooks } from '../src/state.js';
import { step } from '../src/sim.js';
import { aiTick } from '../src/ai.js';
import { DIFF } from '../src/config.js';
const seed = +(process.argv[2] || 21), diff = process.argv[3] || 'normal';
CS.newCampaign({ player: 'wacht', diff, seed }); CS.cHooks.ask = true;
const C = CS.C, MAP = CS.MAP, cap = C.emp.wacht.capital, a = C.armies.find(x => x.owner === 'wacht');
a.units.melee = 12; a.units.ranged = 8; a.units.cav = 3;
const tgt = MAP.provs[cap].nb[0], p = C.provs[tgt];
Object.assign(p, { owner: 'asch', lvl: 3, garrison: { melee: 0, ranged: 0 } }); Object.assign(p.blds, { farm: 2, barracks: 1, walls: 1, lumber: 1, mine: 1, market: 0 });
p.bhp = { farm: [1, .5] };
CS.mkArmy('asch', tgt, { melee: 8, ranged: 5 }, false);
CS.setDip('wacht', 'asch', 'war');
a.siege = tgt; const r = CS.orderMove(a, tgt); const spec = CS.battleSpec(r.pending);
console.log('Spec', spec.player.fac, 'gegen', spec.enemy.fac, 'Siedlung', JSON.stringify(spec.settle), 'Kasse', JSON.stringify(spec.player.res), JSON.stringify(spec.enemy.res));
newBaseBattle(spec);
G.ai0 = { p: DIFF[diff], k: 0, next: G.t + 90, size: 18, wave: 0, active: false };
const cnt = t => { const o = {}; for (const e of G.ents) if (e.team === t && !e.dead) o[e.type] = (o[e.type] || 0) + 1; return JSON.stringify(o); };
console.log('Start  0:', cnt(0)); console.log('Start  1:', cnt(1));
let res = null; hooks.battleEnd = x => { res = x; };
const t0 = G.t; let last = 0;
for (let i = 0; i < 20 * 2400 && !res; i++) { step(.05); if (G.t - last >= 1) { last = G.t; aiTick(0); } if (i % (20 * 300) === 0 && i) console.log(Math.round(G.t - t0) + ' s  0:', cnt(0), ' 1:', cnt(1)); }
console.log('Ende nach', Math.round(G.t - t0), 's', res ? (res.won ? 'Spieler siegt' : 'Spieler verliert') : 'ohne Ergebnis');
if (res) {
  console.log('Überlebende', JSON.stringify(res.p), 'gegen', JSON.stringify(res.e));
  console.log('Bauten Spieler', JSON.stringify(res.pb), '\nBauten Gegner', JSON.stringify(res.eb));
  const before = { ore: C.emp.wacht.ore, wood: C.emp.wacht.wood };
  CS.resolvePending(r.pending, CS.battleOutcome(spec, res)); CS.applyBaseBattle(spec, res, tgt);
  console.log('Provinz danach: Besitzer', p.owner, 'Stufe', p.lvl, JSON.stringify(p.blds), 'Schäden', JSON.stringify(p.bhp || {}));
  console.log('Kasse Grenzwacht', JSON.stringify(before), '->', Math.round(C.emp.wacht.ore), Math.round(C.emp.wacht.wood));
  console.log('Heer danach', JSON.stringify(C.armies.filter(x => x.owner === 'wacht').map(x => x.units)));
}
