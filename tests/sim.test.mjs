// Headless-Test des Spielkerns ohne DOM. Läuft mit: npm test
import assert from 'node:assert/strict';
import { G, hooks } from '../src/state.js';
import { newWorld, mkUnit, mkBld, popCap } from '../src/world.js';
import { beginMatch, step } from '../src/sim.js';
import { train, trainBlock } from '../src/units.js';
import { cast, canCast, castPower, canPower, heroOf, hurt } from '../src/combat.js';
import { heroLevel, MAX_HERO_LVL } from '../src/factions.js';

let ended = null;
hooks.endGame = k => { ended = k; };
let levelUps = 0;
hooks.levelUp = () => { levelUps++; };

function summary() {
  const c = {};
  for (const e of G.ents) { const k = e.team + ':' + e.type; c[k] = (c[k] || 0) + 1; }
  return c;
}

const pairs = [['wacht', 'asch'], ['asch', 'wacht'], ['wacht', 'wacht'], ['salz', 'wacht'], ['asch', 'salz']];
for (const [f0, f1] of pairs) {
  ended = null;
  newWorld({ fac0: f0, fac1: f1, diff: 'normal', seed: 7 });
  beginMatch();
  const t0 = Date.now();
  for (let i = 0; i < 20 * 300; i++) { step(.05); if (G.over || ended) break; }
  const s = summary();
  console.log(`${f0} gegen ${f1}: t=${Math.round(G.t)}s, Erz ${G.ore.map(Math.round)}, ${Date.now() - t0} ms`, JSON.stringify(s));
  assert.ok(G.ore[0] > 300, 'Spieler-Arbeiter müssen Erz liefern');
  assert.ok((s['1:melee'] || 0) + (s['1:ranged'] || 0) > 3, 'KI muss Truppen ausbilden');
  assert.ok(popCap(0) >= 12, 'Burg liefert Versorgung');
}

// Held: Stufenaufstieg, Fähigkeiten, Macht.
for (const fac of ['wacht', 'asch', 'salz']) {
  newWorld({ fac0: fac, fac1: fac === 'wacht' ? 'asch' : 'wacht', diff: 'easy', seed: 3 });
  const foes0 = G.ents.filter(e => e.team === 1).length;
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  G.ore[0] = 2000;
  assert.equal(trainBlock(hq, 'hero'), null);
  const h = mkUnit('hero', 0, hq.x, hq.y + 90);
  const foe = mkUnit('melee', 1, h.x + 60, h.y);
  const foe2 = mkUnit('melee', 1, h.x + 70, h.y + 10);
  assert.equal(h.lvl, 1);
  assert.ok(canCast(h, 0), 'erste Fähigkeit ab Stufe 1');
  assert.ok(!canCast(h, 1), 'zweite Fähigkeit erst ab Stufe 2');
  const before = foe.hp + foe2.hp;
  assert.ok(cast(h, 0, foe.x, foe.y) || fac === 'wacht');
  if (fac !== 'wacht') assert.ok(foe.hp + foe2.hp < before || foe.dead, 'Flächenfähigkeit verletzt Feinde');
  if (fac === 'salz') assert.ok(foe.slow > 0, 'Brandungsschlag bremst');
  h.xp = 90; foe.hp = 1; hurt(foe, 5, h);
  assert.ok(h.lvl >= 1);
  h.xp = 700; hurt(foe2, 9999, h);
  assert.equal(h.lvl, MAX_HERO_LVL, 'Stufe 5 erreicht');
  assert.equal(heroLevel(700), MAX_HERO_LVL);
  assert.ok(canCast(h, 1), 'zweite Fähigkeit nach Stufenaufstieg');
  G.pp[0] = 6;
  assert.ok(canPower(0));
  assert.ok(castPower(0, hq.x, hq.y + 100));
  assert.ok(!canPower(0), 'Macht hat Abklingzeit');
  for (let i = 0; i < 20 * 10; i++) step(.05);
  console.log(`${fac}: Held Stufe ${h.lvl}, Stufenaufstiege ${levelUps}`);
}

// Bauen und Ausbilden.
newWorld({ fac0: 'asch', fac1: 'wacht', diff: 'easy', seed: 5 });
beginMatch();
const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
G.ore[0] = 1000;
assert.ok(train(hq, 'worker'));
const bar = mkBld('barracks', 0, 14, 36, true);
assert.ok(train(bar, 'cav'));
assert.ok(train(bar, 'ranged'));
for (let i = 0; i < 20 * 40; i++) step(.05);
assert.ok(G.ents.some(e => e.team === 0 && e.type === 'cav'), 'Wolfsreiter wurde ausgebildet');
console.log('Alle Tests bestanden');

// Determinismus: gleicher Seed ergibt exakt denselben Verlauf.
{
  const run = () => {
    newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'normal', seed: 42 });
    beginMatch();
    for (let i = 0; i < 20 * 120; i++) { step(.05); if (G.over) break; }
    return JSON.stringify({ o: G.ore.map(Math.round), n: G.ents.length, k: G.kills, rs: G.rs, p: G.ents.slice(0, 12).map(e => [Math.round(e.x || 0), Math.round(e.y || 0)]) });
  };
  assert.equal(run(), run(), 'gleicher Seed muss gleichen Verlauf ergeben');
  console.log('Determinismus ok');
}

// Speichern und Laden: gleicher Verlauf nach dem Laden wie ohne Unterbrechung.
{
  const { serialize, deserialize } = await import('../src/save.js');
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'normal', seed: 5 });
  beginMatch();
  for (let i = 0; i < 20 * 90; i++) step(.05);
  const text = serialize();
  const fp = () => JSON.stringify({ o: G.ore.map(Math.round), n: G.ents.length, rs: G.rs, p: G.ents.slice(0, 14).map(e => [Math.round(e.x || 0), Math.round(e.y || 0), Math.round(e.hp)]) });
  for (let i = 0; i < 20 * 60; i++) step(.05);
  const direct = fp();
  deserialize(text);
  assert.equal(G.map.size, G.ents.length);
  for (let i = 0; i < 20 * 60; i++) step(.05);
  assert.equal(fp(), direct, 'geladener Spielstand muss gleich weiterlaufen');
  console.log('Speichern/Laden ok (' + Math.round(text.length / 1024) + ' KB)');
}

// Ereignisse: Phasen, Wirkung, Ende.
{
  const { startEvent, evSpeed, evSight } = await import('../src/events.js');
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 9 });
  beginMatch();
  const w = G.ents.find(e => e.team === 0 && e.type === 'melee'), a = G.ents.find(e => e.team === 1 && e.type === 'melee');
  assert.equal(evSpeed(w), 1);
  assert.equal(evSpeed(a), 1);
  a.x = 500; a.y = 900; // Sturm gilt nur in Grenzmark und Waldmeer
  const far = G.ents.find(e => e.team === 1 && e.type === 'worker');
  startEvent('storm');
  const seen = new Set();
  let minW = 1, minA = 1, minS = 1, minF = 1;
  for (let i = 0; i < 20 * 160 && (G.ev.id || i < 5); i++) { step(.05); seen.add(G.ev.ph); minW = Math.min(minW, evSpeed(w)); minA = Math.min(minA, evSpeed(a)); minS = Math.min(minS, evSight(w)); minF = Math.min(minF, evSpeed(far)); }
  assert.ok(seen.has('omen') && seen.has('peak') && seen.has('fade'), 'alle Phasen laufen');
  assert.ok(Math.abs(minW - .85) < .01 && Math.abs(minA - .7) < .01 && Math.abs(minS - .6) < .01, 'Wirkung am Höhepunkt');
  assert.equal(minF, 1, 'Aschenfelder bleiben verschont');
  assert.equal(G.ev.id, null); assert.equal(evSpeed(w), 1);
  console.log('Ereignisse ok');
}

// Aufträge: Kette durchlaufen, Speichern und Laden mitten im Auftrag.
{
  const { currentQuest, questProgress } = await import('../src/quests.js');
  const { serialize, deserialize } = await import('../src/save.js');
  const toast = []; hooks.toast = m => toast.push(m);
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 11, quests: true });
  beginMatch();
  const adv = s => { for (let i = 0; i < s * 2; i++) step(.5); };
  assert.equal(currentQuest().id, 'w1');
  mkBld('barracks', 0, 20, 30, true); mkBld('farm', 0, 24, 30, true); mkBld('farm', 0, 27, 30, true);
  for (let i = 0; i < 8; i++) mkUnit('melee', 0, 400 + i * 10, 1000);
  adv(2);
  assert.equal(currentQuest().id, 'w2', 'Auftrag 1 erfüllt');
  assert.ok(G.ev.id === 'storm');
  const text = serialize(); deserialize(text);
  assert.equal(currentQuest().id, 'w2', 'Auftrag nach Laden erhalten');
  adv(200);
  assert.equal(currentQuest().id, 'w3', 'Sturm überstanden');
  const u = mkUnit('melee', 0, 1500, 800); adv(1);
  assert.equal(currentQuest().id, 'w4');
  mkBld('tower', 0, 30, 20, true); mkBld('tower', 0, 33, 20, true); G.kills += 8; adv(1);
  assert.equal(currentQuest().id, 'w5');
  mkUnit('melee', 0, 560, 1700); adv(1);
  assert.equal(G.regions.sumpf, true, 'Moorpfad geöffnet');
  assert.equal(currentQuest().id, 'w6');
  mkUnit('melee', 0, 600, 2250); adv(1);
  assert.equal(currentQuest().id, 'w7');
  const op = (gx, gy) => { const b = mkBld('outpost', 0, gx, gy, true); return b; };
  op(10, 66); adv(1);
  assert.equal(currentQuest().id, 'w8'); assert.equal(G.ev.id, 'flood');
  adv(220);
  assert.equal(currentQuest().id, 'w9', 'Flut überstanden');
  G.mined[0] += 800; adv(1);
  assert.equal(currentQuest().id, 'w10');
  mkUnit('melee', 0, 1980, 1700); adv(1);
  assert.equal(G.regions.kueste, true, 'Küstenweg offen');
  mkUnit('melee', 0, 2300, 2250); adv(1);
  assert.equal(currentQuest().id, 'w12');
  op(70, 66); adv(250);
  assert.ok(G.quest.finished, 'Kette beendet');
  console.log('Aufträge ok:', G.quest.done.join(','));
}

// Regionen: Außengebiete sind abgeriegelt, ein Pass öffnet sie.
{
  const { openGate, regionAt, GATES } = await import('../src/regions.js');
  const { findPath } = await import('../src/path.js').catch(() => ({}));
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 4 });
  assert.equal(regionAt(8 * 32, 38 * 32), 'grenz');
  assert.equal(regionAt(95 * 32, 14 * 32), 'trocken');
  assert.equal(G.regions.trocken, false);
  const cell = (x, y) => G.blk[y * 120 + x];
  assert.equal(cell(80, 10), 1, 'Grat im Osten geschlossen');
  assert.equal(cell(80, 27), 1, 'Pass noch zu');
  let opened = null; hooks.regionsChanged = id => { opened = id; };
  assert.ok(openGate('ost'));
  assert.equal(opened, 'ost'); assert.equal(G.regions.trocken, true);
  assert.equal(cell(80, 27), 0, 'Pass offen'); assert.equal(cell(80, 10), 1, 'Grat bleibt');
  assert.ok(!openGate('ost'), 'zweites Öffnen ohne Wirkung');
  console.log('Regionen ok');
}

// Vorposten: nur nahe einer Erzader, Arbeiter liefern dort ab.
{
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 6 });
  const { canPlaceAt } = await import('../src/world.js');
  G.fog.fill(2);
  const dep = G.ents.find(e => e.kind === 'dep' && e.x < 800 && e.y > 1000 && e.x > 380 && e.y < 1200) || G.ents.find(e => e.kind === 'dep' && e.x > 1000 && e.x < 1400);
  const gx = Math.round(dep.x / 32) + 3, gy = Math.round(dep.y / 32) - 1;
  assert.equal(canPlaceAt('outpost', 2, 2, 0), false, 'ohne Erzader nicht');
  const near = canPlaceAt('outpost', gx, gy, 0) || canPlaceAt('outpost', gx - 6, gy, 0) || canPlaceAt('outpost', gx, gy + 4, 0);
  assert.ok(near, 'neben einer Erzader erlaubt');
  console.log('Vorposten ok');
}

// Neue Ereignisse nur in offenen Gebieten; Staubsturm wirkt im Trockenland.
{
  const { startEvent, evSpeed, EVENTS } = await import('../src/events.js');
  const { openGate } = await import('../src/regions.js');
  hooks.regionsChanged = () => {};
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 21 });
  const seenIds = new Set();
  for (let k = 0; k < 40; k++) { G.ev.id = null; G.ev.ph = 'none'; G.ev.next = 0; step(.05); if (G.ev.id) seenIds.add(G.ev.id); }
  assert.ok([...seenIds].every(id => ['storm', 'ash'].includes(id)), 'nur offene Gebiete: ' + [...seenIds]);
  openGate('ost');
  const u = mkUnit('melee', 0, 3300, 900);
  startEvent('dust'); G.ev.ph = 'peak'; G.ev.k = 1;
  assert.ok(evSpeed(u) < 1, 'Staubsturm bremst im Trockenland');
  const w = mkUnit('melee', 0, 400, 1000);
  assert.equal(evSpeed(w), 1, 'Grenzmark bleibt unberührt');
  console.log('Neue Ereignisse ok');
}

// Alle Aufträge beider Seiten sind auswertbar und haben Ziele.
{
  const { CHAINS, questProgress, initQuests } = await import('../src/quests.js');
  for (const fac of ['wacht', 'asch', 'salz']) {
    newWorld({ fac0: fac, fac1: fac === 'wacht' ? 'asch' : 'wacht', diff: 'easy', seed: 2, quests: true });
    assert.equal(CHAINS[fac].length, 12, fac + ' hat zwölf Aufträge');
    for (let i = 0; i < CHAINS[fac].length; i++) {
      G.quest.i = i; G.quest.finished = false;
      const pr = questProgress();
      assert.ok(pr && pr.goals.length > 0 && pr.goals.every(g => g.text && g.max >= 1), 'Auftrag ' + CHAINS[fac][i].id);
    }
  }
  console.log('Alle Aufträge auswertbar');
}

// Wilde Lager: bewachen Erzadern, greifen an, geben Beute.
{
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'easy', seed: 8 });
  const wild = G.ents.filter(e => e.team === 3);
  assert.equal(wild.length, 30, 'sechs Lager mit je fünf Wesen');
  const c = wild[0];
  const ore0 = G.ore[0];
  for (let i = 0; i < 9; i++) mkUnit('melee', 0, c.x - 60, c.y + i * 6 - 20);
  for (let i = 0; i < 20 * 40; i++) step(.05);
  const left = G.ents.filter(e => e.team === 3 && Math.hypot(e.x - c.hx, e.y - c.hy) < 120).length;
  assert.ok(left < 5, 'Lager wird besiegt: ' + left);
  assert.ok(G.ore[0] > ore0 + 20, 'Beute gutgeschrieben');
  assert.ok(Number.isFinite(G.pp[0]) && Number.isFinite(G.teamKills[0]));
  console.log('Wilde Lager ok');
}

// KI zieht gegen ein wildes Lager in einem offenen Gebiet.
{
  const { openGate } = await import('../src/regions.js');
  newWorld({ fac0: 'wacht', fac1: 'asch', diff: 'hard', seed: 9 });
  openGate('ost');
  const hq = G.ents.find(e => e.team === 1 && e.type === 'hq');
  for (let i = 0; i < 12; i++) mkUnit('melee', 1, hq.x - 100 + i * 8, hq.y + 100);
  mkUnit('hero', 1, hq.x, hq.y + 120);
  G.t = 400; G.ai.next = 1e9;
  for (let i = 0; i < 12; i++) step(.5);
  assert.ok(G.ai.camp, 'KI wählt ein Lager als Ziel');
  console.log('KI räumt Lager ok');
}

// Salzbund: Gezeitensegen heilt, Sturmflut schadet und bremst, die Gezeitenschleuder wirft im Bogen.
{
  newWorld({ fac0: 'salz', fac1: 'asch', diff: 'easy', seed: 13 });
  const hq = G.ents.find(e => e.type === 'hq' && e.team === 0);
  const h = mkUnit('hero', 0, hq.x, hq.y + 120); h.lvl = 2;
  const pal = mkUnit('melee', 0, h.x + 30, h.y); pal.hp = 20;
  assert.ok(cast(h, 1), 'Gezeitensegen wirkt ab Stufe 2');
  assert.ok(pal.hp > 50, 'Verbündete werden geheilt: ' + pal.hp);
  const foes = [0, 1, 2].map(i => mkUnit('melee', 1, h.x + 400 + i * 12, h.y));
  const hp0 = foes.reduce((n, e) => n + e.hp, 0);
  G.pp[0] = 6; assert.ok(castPower(0, foes[1].x, foes[1].y), 'Sturmflut einsetzbar');
  step(.6);
  assert.ok(foes.every(e => e.slow > 0), 'Sturmflut bremst');
  for (let i = 0; i < 20 * 6; i++) step(.05);
  assert.ok(foes.reduce((n, e) => n + Math.max(0, e.hp), 0) < hp0 - 60, 'Sturmflut schadet');
  const sg = mkUnit('siege', 0, hq.x + 200, hq.y + 300), wall = mkBld('barracks', 1, Math.round(sg.x / 32) + 4, Math.round(sg.y / 32) - 1, true);
  sg.order = { t: 'attack', tg: wall.id };
  let big = false; for (let i = 0; i < 20 * 5 && !big; i++) { step(.05); big = G.projs.some(p => p.big); }
  assert.ok(big, 'Gezeitenschleuder schießt Wurfgeschosse');
  console.log('Salzbund ok');
}

// Auftragskette des Salzbunds: Küste zuerst, dann der Ostpass.
{
  const { currentQuest } = await import('../src/quests.js');
  hooks.regionsChanged = () => {};
  newWorld({ fac0: 'salz', fac1: 'wacht', diff: 'easy', seed: 17, quests: true });
  beginMatch(); G.ai.next = 1e9; // keine Angriffswellen, die Kette wird allein geprüft
  const adv = s => { for (let i = 0; i < s * 2; i++) step(.5); };
  assert.equal(currentQuest().id, 's1');
  mkBld('barracks', 0, 20, 30, true); mkBld('farm', 0, 24, 30, true); mkBld('farm', 0, 27, 30, true);
  for (let i = 0; i < 8; i++) mkUnit('melee', 0, 400 + i * 10, 1000);
  adv(2); assert.equal(currentQuest().id, 's2'); assert.equal(G.ev.id, 'storm');
  adv(200); assert.equal(currentQuest().id, 's3', 'Sturm überstanden');
  mkUnit('melee', 0, 1250, 1450); adv(1); assert.equal(currentQuest().id, 's4');
  mkBld('tower', 0, 30, 20, true); mkBld('tower', 0, 33, 20, true); G.kills += 8; adv(1);
  assert.equal(currentQuest().id, 's5');
  mkUnit('melee', 0, 1980, 1700); adv(1); assert.equal(G.regions.kueste, true, 'Küstenweg offen');
  mkUnit('melee', 0, 2300, 2250); adv(1); assert.equal(currentQuest().id, 's7');
  mkBld('outpost', 0, 70, 66, true); adv(1); assert.equal(currentQuest().id, 's8'); assert.equal(G.ev.id, 'saltfog');
  adv(250); assert.equal(currentQuest().id, 's9', 'Salznebel überstanden');
  G.mined[0] += 800; adv(1); assert.equal(currentQuest().id, 's10');
  mkUnit('melee', 0, 2500, 900); adv(1); assert.equal(G.regions.trocken, true, 'Ostpass offen');
  mkUnit('melee', 0, 3300, 900); adv(1); assert.equal(currentQuest().id, 's12');
  mkBld('outpost', 0, 112, 52, true); adv(250);
  assert.ok(G.quest.finished, 'Kette des Salzbunds beendet');
  console.log('Aufträge Salzbund ok:', G.quest.done.join(','));
}

// Szene hinter dem Hauptmenü: alles sichtbar, kein Spielende, Simulation läuft.
{
  let endCalls = 0; hooks.endGame = () => { endCalls++; };
  newWorld({ fac0: 'salz', fac1: 'wacht', diff: 'normal', seed: 2026 });
  G.demo = true; beginMatch();
  for (let i = 0; i < 20 * 20; i++) step(.05);
  assert.ok(G.fog.every(v => v === 2), 'Menüszene ohne Kriegsnebel');
  assert.ok(G.ents.filter(e => e.kind === 'bld').every(e => e.seen), 'alle Gebäude sichtbar');
  assert.equal(endCalls, 0);
  hooks.endGame = k => { ended = k; };
  console.log('Menüszene ok');
}
