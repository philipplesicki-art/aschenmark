// Tests der Kampagne (Weltkarte) ohne Browser. Läuft mit: node tests/campaign.test.mjs
import assert from 'node:assert/strict';
import { genMap, findRoute, MW, MH } from '../src/campaign/cmap.js';
import * as CS from '../src/campaign/cstate.js';
import { aiTurn } from '../src/campaign/cai.js';
import { serializeCampaign, deserializeCampaign } from '../src/campaign/csave.js';
import { FAC_IDS } from '../src/factions.js';
import { unitStrength, ROLES, CBLD } from '../src/campaign/cdata.js';
import { newBattle } from '../src/battle.js';
import { G, hooks } from '../src/state.js';
import { step } from '../src/sim.js';
import { setOrder } from '../src/path.js';

// Karte: gleiche Saat, gleiche Karte; zusammenhängend; Hauptstädte im passenden Gelände
{
  const a = genMap(5), b = genMap(5), c = genMap(6);
  assert.deepEqual(a.provs.map(p => p.name), b.provs.map(p => p.name), 'gleiche Saat, gleiche Namen');
  assert.notDeepEqual(a.provs.map(p => p.name), c.provs.map(p => p.name));
  assert.equal(a.provs.length, 30);
  for (const p of a.provs) assert.ok(p.nb.length > 0, 'jede Provinz hat Nachbarn');
  for (const p of a.provs) for (const q of p.nb) assert.ok(a.provs[q].nb.includes(p.id), 'Nachbarschaft beidseitig');
  for (const f of FAC_IDS) for (const g of FAC_IDS) if (f !== g) assert.ok(findRoute(a, a.capitals[f], a.capitals[g]), 'Hauptstädte verbunden');
  assert.equal(a.provs[a.capitals.asch].biome, 'asch'); assert.equal(a.provs[a.capitals.salz].biome, 'kueste');
  assert.equal(a.pid.length, MW * MH);
  for (const n of [22, 40]) assert.equal(genMap(9, n).provs.length, n);
  console.log('Karte ok');
}

// Stärke der Truppen: Speerträger der Grenzwacht etwa 10, Elite stärker als Fußtruppen
{
  assert.ok(Math.abs(unitStrength('wacht', 'melee') - 10) < .5);
  for (const f of FAC_IDS) assert.ok(unitStrength(f, 'elite') > unitStrength(f, 'melee') * 1.5);
  console.log('Stärken ok');
}

// Neue Kampagne, Bauen, Rekrutieren, Forschen, Runden
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 11 });
  const C = CS.C, cap = C.emp.wacht.capital, p = C.provs[cap];
  assert.equal(p.owner, 'wacht'); assert.equal(p.lvl, 2); assert.equal(C.armies.filter(a => a.owner === 'wacht').length, 1);
  assert.equal(CS.season().id, 'thaw');
  const inc = CS.empireIncome('wacht'); assert.ok(inc.ore > 50 && inc.food > inc.upkeep, 'Hauptstadt ernährt das Startheer');
  // Bauen: Kosten, Bauzeit, Platzgrenze
  const ore0 = C.emp.wacht.ore; assert.equal(CS.buildBlock(p, 'mine'), null); assert.ok(CS.startBuild(p, 'mine'));
  assert.equal(C.emp.wacht.ore, ore0 - CBLD.mine.cost[0][0]); assert.equal(CS.buildBlock(p, 'lumber'), 'Hier wird schon gebaut');
  CS.endTurn(); assert.equal(p.blds.mine, 1, 'Bergwerk nach einer Runde fertig');
  assert.equal(CS.buildBlock(p, 'lumber'), 'Kein Bauplatz frei (Siedlung ausbauen)');
  // Rekrutieren: Kaserne nötig, Rekruten erscheinen nächste Runde im Heer der Provinz
  C.emp.wacht.ore = C.emp.wacht.wood = C.emp.wacht.food = 5000;
  assert.equal(CS.recruitBlock(p, 'cav'), 'Kaserne Stufe 2 nötig');
  assert.ok(CS.recruit(p, 'melee', 3)); const before = CS.armiesAt(cap).find(a => a.owner === 'wacht').units.melee;
  CS.endTurn(); assert.equal(CS.armiesAt(cap).find(a => a.owner === 'wacht').units.melee, before + 3);
  // Forschung: dauert Runden, wirkt auf die Stärke
  const army = CS.armiesAt(cap).find(a => a.owner === 'wacht'), pow0 = CS.armyPower(army.units, 'wacht', army.hero);
  assert.ok(CS.startResearch('wacht', 'weapons')); assert.equal(CS.researchBlock('wacht', 'armor'), 'Forschung läuft');
  CS.endTurn(); CS.endTurn(); assert.equal(C.emp.wacht.tech.weapons, 1);
  assert.ok(CS.armyPower(army.units, 'wacht', army.hero) > pow0 * 1.09, 'Waffen I wirkt');
  // Jahreszeiten: Hartfrost halbiert die Bewegung und senkt die Ernte
  while (CS.season().id !== 'frost') CS.endTurn();
  assert.equal(CS.movesOf(army), 1); assert.ok(CS.empireIncome('wacht').food < CS.empireIncome('wacht', { food: 1, upkeep: 1 }).food);
  console.log('Bauen, Rekrutieren, Forschen ok');
}

// Angriff: auf eine schwache Provinz gewinnt ein starkes Heer und erobert sie
{
  CS.newCampaign({ player: 'asch', diff: 'normal', seed: 21 });
  const C = CS.C, MAP = CS.MAP, cap = C.emp.asch.capital, a = C.armies.find(x => x.owner === 'asch');
  a.units.melee = 40; const tgt = MAP.provs[cap].nb.find(n => !C.provs[n].owner);
  const r = CS.orderMove(a, tgt);
  assert.ok(r && r.won, 'Schlachtbericht mit Sieg'); assert.equal(C.provs[tgt].owner, 'asch'); assert.equal(a.at, tgt);
  assert.ok(a.units.melee < 40, 'auch der Sieger verliert Truppen'); assert.equal(CS.movesLeft(a), 0, 'Angriff verbraucht die Züge');
  // Ein zu schwaches Heer scheitert
  const weak = CS.mkArmy('asch', tgt, { melee: 1 }); const next = MAP.provs[tgt].nb.find(n => !C.provs[n].owner && n !== cap);
  if (next !== undefined) { const r2 = CS.orderMove(weak, next); assert.ok(r2 && !r2.won); assert.ok(!C.armies.includes(weak) || weak.at === tgt); }
  console.log('Schlachten ok');
}

// Speichern und Laden: gleicher Verlauf danach
{
  CS.newCampaign({ player: 'salz', diff: 'hard', seed: 31 });
  for (let i = 0; i < 6; i++) { aiTurn('salz'); CS.endTurn(aiTurn); }
  const text = serializeCampaign();
  const run = () => { for (let i = 0; i < 6; i++) { aiTurn(CS.C.player); CS.endTurn(aiTurn); } return JSON.stringify({ p: CS.C.provs.map(p => p.owner), e: CS.C.emp, a: CS.C.armies.length }); };
  const direct = run(); deserializeCampaign(text); assert.equal(run(), direct, 'geladener Stand läuft gleich weiter');
  assert.throws(() => deserializeCampaign('{"v":9}'));
  console.log('Speichern und Laden ok');
}

// Eine Kampagne unter KI-Reichen endet mit einem Sieger
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 977 * 3 });
  while (!CS.C.over && CS.C.turn < 300) { aiTurn(CS.C.player); CS.endTurn(aiTurn); }
  assert.ok(CS.C.over, 'Kampagne endet'); assert.ok(CS.C.turn > 20, 'und dauert ' + CS.C.turn + ' Runden');
  assert.ok(CS.C.log.length > 20 && CS.C.battles > 10);
  console.log('KI-Kampagne ok: ' + CS.C.turn + ' Runden, ' + CS.C.battles + ' Schlachten');
}

// Echtzeit-Schlacht aus der Kampagne: Wahl abwarten, Aufstellung bauen, ausfechten, Überlebende zurückschreiben
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 21 });
  CS.cHooks.ask = true;
  const C = CS.C, MAP = CS.MAP, cap = C.emp.wacht.capital, a = C.armies.find(x => x.owner === 'wacht');
  a.units.melee = 14; a.units.ranged = 8;
  const tgt = MAP.provs[cap].nb.find(n => !C.provs[n].owner);
  const r = CS.orderMove(a, tgt);
  assert.ok(r && r.pending, 'Angriff des Spielers wartet auf die Wahl'); assert.equal(C.provs[tgt].owner, null); assert.equal(CS.nextPending(), r.pending);
  const spec = CS.battleSpec(r.pending);
  assert.equal(spec.player.fac, 'wacht'); assert.equal(spec.enemy.fac, 'wild'); assert.ok(spec.playerAttacks); assert.equal(spec.player.units.melee, 14); assert.ok(spec.player.hero >= 1);
  newBattle(spec);
  assert.equal(G.ents.filter(e => e.team === 0 && e.kind === 'unit').length, 14 + 8 + 1, 'Heer samt Held steht auf dem Feld');
  assert.ok(G.ents.some(e => e.team === 3), 'wilde Besatzung steht gegenüber'); assert.ok(!G.ents.some(e => e.type === 'hq'), 'keine Burgen');
  let res = null; hooks.battleEnd = x => { res = x; };
  // Spieler greift an: alle eigenen Truppen auf die Wilden
  const foe = G.ents.find(e => e.team === 3);
  for (const u of G.ents.filter(e => e.team === 0 && e.kind === 'unit')) setOrder(u, { t: 'amove', x: foe.x, y: foe.y });
  for (let i = 0; i < 20 * 240 && !res; i++) step(.05);
  assert.ok(res, 'Schlacht endet'); assert.ok(res.won, 'die Übermacht siegt');
  assert.ok(res.p.melee <= 14 && res.p.ranged <= 8);
  const rep = CS.resolvePending(r.pending, CS.battleOutcome(spec, res));
  assert.ok(rep.won && rep.fought); assert.equal(C.provs[tgt].owner, 'wacht'); assert.equal(a.at, tgt);
  assert.equal(a.units.melee, res.p.melee, 'Überlebende übernommen'); assert.equal(C.pending.length, 0);
  // Angriff der KI auf den Spieler wartet ebenso; berechnet löst er sich auf
  const foeArmy = CS.mkArmy('asch', MAP.provs[tgt].nb.find(n => n !== cap && !C.provs[n].owner) ?? cap, { melee: 30 });
  foeArmy.at = MAP.provs[tgt].nb.find(n => C.provs[n].owner !== 'wacht');
  const r2 = CS.orderMove(foeArmy, tgt);
  assert.ok(r2 && r2.pending); const s2 = CS.battleSpec(r2.pending); assert.ok(!s2.playerAttacks); assert.equal(s2.player.fac, 'wacht'); assert.ok(s2.militia > 0);
  const rep2 = CS.resolvePending(r2.pending); assert.ok(rep2 && !rep2.fought);
  // Rückzug: Niederlage, ein Teil der Truppen bleibt
  CS.cHooks.ask = false;
  console.log('Echtzeit-Schlacht ok: ' + Math.round(res.time) + ' s, ' + res.p.melee + '/14 Speerträger übrig');
}
console.log('Kampagnentests bestanden');
