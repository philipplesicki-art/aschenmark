// Probelauf: Angriff auf Wildnis mit Basisbau, Spielerseite von der KI gespielt
import * as CS from '../src/campaign/cstate.js';
import { newBaseBattle } from '../src/battle.js';
import { G, hooks } from '../src/state.js';
import { step } from '../src/sim.js';
import { aiTick } from '../src/ai.js';
import { setOrder } from '../src/path.js';
import { DIFF } from '../src/config.js';
CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 21 }); CS.cHooks.ask = true;
const C = CS.C, cap = C.emp.wacht.capital, a = C.armies.find(x => x.owner === 'wacht'); a.units.melee = 12; a.units.ranged = 8;
const tgt = CS.MAP.provs[cap].nb.find(n => !C.provs[n].owner), p = C.provs[tgt];
const r = CS.orderMove(a, tgt), spec = CS.battleSpec(r.pending);
console.log('Wilde:', JSON.stringify(spec.enemy.units), 'Siedlung', spec.settle);
newBaseBattle(spec); G.ai0 = { p: DIFF.normal, k: 0, next: 1e9, size: 99, wave: 0, active: false };
let res = null; hooks.battleEnd = x => { res = x; }; const t0 = G.t; let last = 0;
for (let i = 0; i < 20 * 1200 && !res; i++) { step(.05); if (G.t - last >= 1) { last = G.t; aiTick(0);
  if (G.t - t0 > 240) { const foe = G.ents.find(e => e.team === 3 && !e.dead); if (foe) for (const u of G.ents) if (u.team === 0 && u.kind === 'unit' && u.type !== 'worker' && !u.order) setOrder(u, { t: 'amove', x: foe.x, y: foe.y }); } } }
console.log('Ende nach', Math.round(G.t - t0), 's', res && res.won ? 'Sieg' : 'kein Sieg', JSON.stringify(res && res.pb));
CS.resolvePending(r.pending, CS.battleOutcome(spec, res)); CS.applyBaseBattle(spec, res, tgt);
console.log('Provinz', p.owner, 'Stufe', p.lvl, JSON.stringify(p.blds), JSON.stringify(p.bhp || {}));
