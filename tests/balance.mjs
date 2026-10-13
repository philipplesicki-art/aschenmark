// Balance-Prüfung: KI gegen KI in allen Paarungen, beide Kartenseiten, mehrere Startwerte.
// Aufruf: npm run balance [-- Partien je Paarung]   (dauert einige Minuten, läuft ohne Browser)
import { G, hooks } from '../src/state.js';
import { newWorld } from '../src/world.js';
import { beginMatch, step } from '../src/sim.js';
import { FAC_IDS, FACTIONS } from '../src/factions.js';
import { DIFF } from '../src/config.js';

const N = Number(process.argv[2]) || 4, LIMIT = 40 * 60, DT = .1;
let ended = null; hooks.endGame = k => { ended = ended || k; };

// Stärke am Zeitlimit: Festung, Heer und Wirtschaft (Erz als Kaufkraft)
const worth = t => {
  let v = G.ore[t] * .5;
  for (const e of G.ents) if (e.team === t && !e.dead) v += e.kind === 'unit' ? (e.d.cost || 0) * e.hp / e.maxhp : e.type === 'hq' ? 1500 * e.hp / e.maxhp : (e.d.cost || 0) * .5;
  return v;
};

function play(f0, f1, seed) {
  ended = null;
  newWorld({ fac0: f0, fac1: f1, diff: 'normal', seed });
  const P = DIFF.normal;
  G.ai0 = { p: P, k: 0, next: P.first, size: P.size0, wave: 0, active: false };
  beginMatch();
  while (!ended && G.t < LIMIT) step(DT);
  // endGame meldet aus Sicht von Team 0: 'win' heißt, Team 0 hat die Festung von Team 1 zerstört
  const w = ended === 'win' ? 0 : ended === 'lose' ? 1 : worth(0) >= worth(1) ? 0 : 1;
  return { w, t: G.t, by: ended ? 'Festung' : 'Wertung', lost: [...G.teamKills] };
}

const res = {}; for (const f of FAC_IDS) res[f] = { games: 0, wins: 0, time: 0, hq: 0 };
const pairs = {};
const t0 = Date.now();
for (const a of FAC_IDS) for (const b of FAC_IDS) {
  if (a === b) continue;
  for (let s = 0; s < N; s++) {
    const r = play(a, b, 1000 + s * 7919), win = r.w === 0 ? a : b, lose = r.w === 0 ? b : a;
    res[win].wins++; res[a].games++; res[b].games++; res[win].time += r.t; if (r.by === 'Festung') res[win].hq++;
    const k = [a, b].sort().join(' – '); (pairs[k] ||= {})[win] = (pairs[k][win] || 0) + 1;
    console.log(`${FACTIONS[a].name.padEnd(12)} (unten links) gegen ${FACTIONS[b].name.padEnd(12)} Startwert ${s}: ${FACTIONS[win].name} gewinnt nach ${Math.round(r.t / 60)} min (${r.by})`);
  }
}
console.log('\nGesamt (' + Math.round((Date.now() - t0) / 1000) + ' s Rechenzeit)');
for (const f of FAC_IDS) { const r = res[f]; console.log(`  ${FACTIONS[f].name.padEnd(12)} ${r.wins}/${r.games} Siege (${Math.round(r.wins / r.games * 100)} %), davon ${r.hq} durch Zerstörung der Festung`); }
console.log('Paarungen:'); for (const [k, v] of Object.entries(pairs)) console.log('  ' + k + ': ' + Object.entries(v).map(([f, n]) => FACTIONS[f].name + ' ' + n).join(', '));
