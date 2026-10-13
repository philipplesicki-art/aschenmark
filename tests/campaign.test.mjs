// Tests der Kampagne (Weltkarte) ohne Browser. Läuft mit: node tests/campaign.test.mjs
import assert from 'node:assert/strict';
import { genMap, findRoute, MW, MH } from '../src/campaign/cmap.js';
import * as CS from '../src/campaign/cstate.js';
import { aiTurn } from '../src/campaign/cai.js';
import * as D from '../src/campaign/cdip.js';
import * as E from '../src/campaign/cevents.js';
import * as S from '../src/campaign/cstory.js';
import { serializeCampaign, deserializeCampaign } from '../src/campaign/csave.js';
import { FAC_IDS } from '../src/factions.js';
import { unitStrength, ROLES, CBLD } from '../src/campaign/cdata.js';
import { newBattle } from '../src/battle.js';
import { G, hooks } from '../src/state.js';
import { step } from '../src/sim.js';
import { setOrder } from '../src/path.js';
import * as T from '../src/terrain.js';
import { hurt } from '../src/combat.js';
import { GW } from '../src/config.js';

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
  assert.ok(CS.researchBlock('wacht', 'arms2').startsWith('Erst'), 'Voraussetzungen gelten');
  assert.ok(CS.startResearch('wacht', 'arms1')); assert.equal(CS.researchBlock('wacht', 'mail1'), 'Forschung läuft');
  for (let i = 0; i < 4; i++) CS.endTurn(); assert.equal(C.emp.wacht.tech.weapons || 0, 0, 'Zeitalter I braucht fünf Punkte'); CS.endTurn(); assert.equal(C.emp.wacht.tech.weapons, 1); assert.ok(C.emp.wacht.ctech.arms1);
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
  assert.equal(CS.orderMove(foeArmy, tgt), true, 'im Frieden kein Angriff'); assert.equal(C.provs[tgt].owner, 'wacht');
  CS.setDip('asch', 'wacht', 'war'); foeArmy.moved = 0;
  const r2 = CS.orderMove(foeArmy, tgt);
  assert.ok(r2 && r2.pending); const s2 = CS.battleSpec(r2.pending); assert.ok(!s2.playerAttacks); assert.equal(s2.player.fac, 'wacht'); assert.ok(s2.militia > 0, 'Bürgerwehr ' + JSON.stringify({ prov: r2.pending.prov, tgt, owner: C.provs[r2.pending.prov].owner, lvl: C.provs[r2.pending.prov].lvl }));
  const rep2 = CS.resolvePending(r2.pending); assert.ok(rep2 && !rep2.fought);
  // Rückzug: Niederlage, ein Teil der Truppen bleibt
  CS.cHooks.ask = false;
  console.log('Echtzeit-Schlacht ok: ' + Math.round(res.time) + ' s, ' + res.p.melee + '/14 Speerträger übrig');
}

// Diplomatie: Frieden sperrt Durchzug und Angriff, Waffenstillstand sperrt Kriegserklärung, Bündnisse ziehen mit in den Krieg
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 4242 });
  const C = CS.C;
  assert.equal(CS.dipOf('wacht', 'asch').st, 'peace'); assert.ok(!CS.hostile('wacht', 'asch')); assert.ok(CS.hostile('wacht', 'x'), 'Unbekannte gelten als feindlich');
  assert.ok(D.warBlock('wacht', 'asch').startsWith('Waffenstillstand'));
  C.dip[CS.dkey('wacht', 'asch')].truce = 0;
  CS.setDip('salz', 'asch', 'ally');
  assert.ok(D.declareWar('wacht', 'asch')); assert.ok(CS.hostile('wacht', 'asch')); assert.ok(CS.hostile('salz', 'wacht'), 'Verbündeter steht bei');
  assert.ok(D.opinion('asch', 'wacht') < 0);
  D.makePeace('wacht', 'asch'); assert.equal(CS.dipOf('wacht', 'asch').truce, CS.TRUCE);
  // Land eines Friedenspartners ist gesperrt
  const ap = C.provs.find(p => p.owner === 'asch'); assert.ok(!CS.passable('wacht', ap.id)); assert.ok(CS.passable('wacht', C.provs.find(p => !p.owner).id));
  // Im KI-Spiel kommt es zu Kriegen und Friedensschlüssen
  CS.newCampaign({ player: 'salz', diff: 'normal', seed: 99 });
  let wars = 0, peaces = 0; CS.cHooks.log = t => { if (/den Krieg/.test(t)) wars++; if (/Frieden/.test(t)) peaces++; };
  while (!CS.C.over && CS.C.turn < 120) { aiTurn(CS.C.player); CS.endTurn(aiTurn); }
  CS.cHooks.log = () => {};
  assert.ok(wars >= 2, 'Kriege: ' + wars);
  console.log('Diplomatie ok: ' + wars + ' Kriegserklärungen, ' + peaces + ' Friedensschlüsse in ' + CS.C.turn + ' Runden');
}

// Ereignisse: KI entscheidet sofort, der Spieler mit Oberfläche über den Dialog; Wahl mit Kosten
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 777 });
  const C = CS.C, e = C.emp.wacht;
  CS.cHooks.ask = true; e.ore = 500;
  let ev = null; for (let i = 0; i < 400 && !ev; i++) { const x = E.rollEvent('wacht'); if (x && E.CEVENTS[x.id].opts.length > 1) ev = x; }
  assert.ok(ev && C.events.includes(ev), 'Ereignis wartet auf die Wahl');
  const ore0 = e.ore; E.resolveEvent(ev, 0); assert.ok(!C.events.includes(ev));
  assert.ok(e.ore <= ore0);
  e.ore = 0; const m = { id: 'mercs', f: 'wacht', turn: 1 }; assert.ok(!E.optOk(m, 1), 'zu teuer'); E.resolveEvent(m, 1); assert.equal(e.ore, 0, 'unbezahlbare Wahl fällt auf die erste zurück');
  CS.cHooks.ask = false;
  console.log('Ereignisse ok');
}

// Handlungsbogen: Kapitel mit Belohnung, Schlund öffnet sich, Erwachte ziehen aus, Versiegeln nach drei Runden
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 5150 });
  const C = CS.C, MAP = CS.MAP;
  assert.equal(S.currentChapter().title, 'Die Feuer der Mark');
  const free = C.provs.filter(p => !p.owner && !p.site).slice(0, 5); for (const p of free) { p.owner = 'wacht'; p.lvl = 1; }
  const wood0 = C.emp.wacht.wood; CS.endTurn();
  assert.equal(C.story.ch, 1, 'erstes Kapitel erfüllt'); assert.ok(C.emp.wacht.wood >= wood0 + 300 - 50);
  assert.ok(C.provs.filter(p => p.site).length >= 5, 'Stätten verteilt');
  while (C.story.rift === null && C.turn < 40) { aiTurn('wacht'); CS.endTurn(aiTurn); }
  assert.ok(C.story.rift >= 0, 'Schlund geöffnet in Runde ' + C.turn); const rp = C.provs[C.story.rift];
  assert.ok(rp.rift && !rp.owner, 'Schlund ist wild');
  CS.endTurn(aiTurn); CS.endTurn(aiTurn);
  assert.ok(C.armies.some(a => a.owner === 'wild') || C.provs.some(p => !p.owner && p.garrison.brute > 1), 'Erwachte ziehen aus');
  rp.owner = 'wacht'; rp.garrison = { melee: 0 }; C.story.riftHeld = 2;
  CS.endTurn(); assert.equal(C.story.sealedBy, 'wacht', 'versiegelt'); assert.ok(!C.armies.some(a => a.owner === 'wild'), 'Erwachte zerfallen');
  console.log('Handlungsbogen ok: Schlund in ' + MAP.provs[rp.id].name);
}

// Schlachtfelder nach Gelände: Wald dicht, Sumpf mit Wasser, Bergland mit Felsen, Küste mit Meer; Stadtmauer mit Tor
{
  const base = { player: { fac: 'wacht', units: { melee: 10, ranged: 6 }, hero: 1, tech: {} }, enemy: { fac: 'asch', units: { melee: 10, ranged: 6 }, hero: 0, tech: {} }, playerAttacks: true, towers: 0, militia: 2, season: 'thaw', name: 'Test', seed: 11, diff: 'normal' };
  const look = {};
  for (const b of ['grenz', 'wald', 'berg', 'sumpf', 'kueste', 'trocken', 'asch']) { newBattle({ ...base, biome: b, walls: b === 'grenz' ? 2 : 0 }); look[b] = { t: G.trees.length, r: G.rocks.length, w: G.water.reduce((a, x) => a + x, 0), m: G.ents.filter(e => e.type === 'wall').length }; }
  assert.ok(look.wald.t > look.grenz.t * 1.5, 'Wald dichter'); assert.ok(look.sumpf.w > 50, 'Sumpf mit Tümpeln'); assert.ok(look.kueste.w > 200, 'Küste mit Meer');
  assert.ok(look.berg.r > 50, 'Felsgrate'); assert.ok(look.grenz.m > 8, 'Stadtmauer'); assert.equal(look.wald.m, 0);
  // Die Heere erreichen sich: Pfad vom Spieler zum Gegner frei
  newBattle({ ...base, biome: 'berg', walls: 2 });
  const p = G.ents.find(e => e.team === 0 && e.kind === 'unit'), q = G.ents.find(e => e.team === 1 && e.kind === 'unit');
  let res = null; hooks.battleEnd = x => { res = x; };
  for (const u of G.ents.filter(e => e.team === 0 && e.kind === 'unit')) setOrder(u, { t: 'amove', x: q.x, y: q.y });
  for (let i = 0; i < 20 * 300 && !res; i++) step(.05);
  assert.ok(res, 'Schlacht im Bergland endet'); 
  console.log('Schlachtfelder ok: ' + Object.entries(look).map(([b, v]) => b + ' ' + v.t + 'B/' + v.r + 'F/' + v.w + 'W').join(', '));
}

// Gelände im Kampf: Deckung am Waldrand gegen Fernkampf, Schlamm an Tümpeln bremst
{
  const base = { player: { fac: 'wacht', units: { melee: 4 }, hero: 0, tech: {} }, enemy: { fac: 'asch', units: { ranged: 4 }, hero: 0, tech: {} }, playerAttacks: true, towers: 0, walls: 0, militia: 0, season: 'thaw', name: 'T', seed: 11, diff: 'normal' };
  newBattle({ ...base, biome: 'wald' });
  const tr = G.trees.find(t => !t.fx && T.coverAt(t.x + 32, t.y));
  assert.ok(tr, 'Waldrand gefunden');
  const u = G.ents.find(e => e.team === 0 && e.kind === 'unit'), s = G.ents.find(e => e.team === 1 && e.kind === 'unit');
  u.x = tr.x + 32; u.y = tr.y; const hp0 = u.hp; hurt(u, 10, s); const inCover = hp0 - u.hp;
  u.x = 40 * 32; u.y = 28 * 32; const hp1 = u.hp; if (!T.coverAt(u.x, u.y)) { hurt(u, 10, s); assert.ok(inCover < hp1 - u.hp, 'Deckung mindert Fernkampf'); }
  newBattle({ ...base, biome: 'sumpf' });
  const wi = G.water.findIndex(x => x), wx = (wi % GW + .5) * 32, wy = (Math.floor(wi / GW) + .5) * 32;
  assert.ok(T.mudAt(wx + 32, wy) || T.mudAt(wx - 32, wy), 'Schlamm am Ufer');
  console.log('Gelände im Kampf ok');
}

// Gegenstände des Helden: Fund, besserer ersetzt schwächeren, Wirkung auf Stärke, Züge und Schlacht
{
  CS.newCampaign({ player: 'wacht', diff: 'normal', seed: 808 });
  const C = CS.C, e = C.emp.wacht, a = C.armies.find(x => x.owner === 'wacht' && x.hero);
  const p0 = CS.armyPower(a.units, 'wacht', true), m0 = CS.movesOf(a);
  e.items = { waffe: 'frostklinge' }; e.ore = 0;
  assert.ok(CS.armyPower(a.units, 'wacht', true) > p0 * 1.03, 'Waffe stärkt das Heer');
  e.items.talisman = 'ahnenhorn'; assert.equal(CS.movesOf(a), m0 + 1, 'Horn: ein Zug mehr');
  for (let i = 0; i < 30; i++) CS.grantItem('wacht');
  assert.equal(e.items.waffe, 'sturmspeer', 'beste Waffe behalten'); assert.ok(e.ore > 0, 'schwächere Funde verkauft');
  const spec = { player: { fac: 'wacht', units: { melee: 2 }, hero: 2, heroHp: CS.heroItemMul('wacht', 'hp'), heroDmg: CS.heroItemMul('wacht', 'dmg'), tech: {} }, enemy: { fac: 'asch', units: { melee: 2 }, hero: 0, tech: {} }, playerAttacks: true, towers: 0, walls: 0, militia: 0, season: 'thaw', biome: 'grenz', name: 'T', seed: 1, diff: 'normal' };
  newBattle(spec); const h = G.ents.find(x => x.team === 0 && x.type === 'hero');
  newBattle({ ...spec, player: { ...spec.player, heroHp: 1, heroDmg: 1 } }); const h0 = G.ents.find(x => x.team === 0 && x.type === 'hero');
  assert.ok(h.maxhp > h0.maxhp * 1.5 && h.dmgMul > h0.dmgMul * 1.4, 'Held mit Ausrüstung stärker in der Schlacht');
  console.log('Gegenstände ok: ' + Object.values(e.items).join(', '));
}
console.log('Kampagnentests bestanden');
