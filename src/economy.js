// Wirtschaft: Rohstoffe, Burgstufen, Forschung und Handel. Reine Simulation (kein DOM, kein Three.js).
// Alle Zahlen stehen hier oder in factions.js; units.js, combat.js, commands.js und ai.js rufen nur diese Funktionen.
import { G, hooks } from './state.js';
import { FACTIONS } from './factions.js';
import { CARRY } from './config.js';

/* ---------- Rohstoffe ---------- */
export const START = { ore: 300, wood: 200 };
export const costOf = d => ({ ore: d.cost || 0, wood: d.wood || 0 });
export const canAfford = (t, c) => G.ore[t] >= (c.ore || 0) && G.wood[t] >= (c.wood || 0);
export const lack = (t, c) => (G.ore[t] < (c.ore || 0) ? 'Nicht genug Erz' : G.wood[t] < (c.wood || 0) ? 'Nicht genug Holz' : null);
export function pay(t, c) { G.ore[t] -= c.ore || 0; G.wood[t] -= c.wood || 0; }
export function refund(t, c, f = 1) { G.ore[t] += Math.floor((c.ore || 0) * f); G.wood[t] += Math.floor((c.wood || 0) * f); }
export const costStr = c => [c.ore ? c.ore : '', c.wood ? c.wood + ' H' : ''].filter(Boolean).join(' + ') || '0';

/* ---------- Burgstufen ---------- */
// Index = Zielstufe. Stufe 2 schaltet Reiter, Werkstatt, Markt und die zweite Technikstufe frei, Stufe 3 die dritte.
export const UPGRADE = [null, null, { ore: 250, wood: 200, time: 40 }, { ore: 450, wood: 350, time: 60 }];
export const MAX_TIER = 3;
export const hqOf = t => G.ents.find(e => e.team === t && e.type === 'hq' && !e.dead && e.built);
export const tierOf = t => { const h = hqOf(t); return h ? (h.tier || 1) : 1; };
export function upgradeBlock(h) {
  const to = (h.tier || 1) + 1;
  if (!h.built) return 'Gebäude im Bau';
  if (h.up) return 'Ausbau läuft';
  if (to > MAX_TIER) return 'Höchste Stufe erreicht';
  return lack(h.team, UPGRADE[to]);
}
export function startUpgrade(h) {
  const m = upgradeBlock(h); if (m) { if (h.team === 0) hooks.toast(m, 'bad'); return false; }
  const to = (h.tier || 1) + 1, u = UPGRADE[to];
  pay(h.team, u); h.up = { to, t: 0, dur: u.time };
  if (h.team === 0) hooks.sfx('train');
  return true;
}
export function cancelUpgrade(h) { if (!h.up) return; refund(h.team, UPGRADE[h.up.to], .75); h.up = null; }
function finishUpgrade(h) {
  h.tier = h.up.to; h.up = null;
  const k = h.tier === 2 ? 1.2 : 1.25 / 1.2; // Leben: Stufe 2 plus 20 %, Stufe 3 plus 25 % vom Ausgangswert
  h.maxhp = Math.round(h.maxhp * k); h.hp = Math.min(h.maxhp, h.hp + h.maxhp * .2);
  if (h.team === 0) { hooks.toast(FACTIONS[h.fac].tiers[h.tier - 1] + ' ist fertig (Stufe ' + h.tier + ')', 'good'); hooks.sfx('level'); }
}

/* ---------- Forschung ---------- */
// at: Gebäudetyp, in dem geforscht wird. levels: je Stufe Mindest-Burgstufe, Kosten und Dauer in Sekunden.
const L = (...a) => a.map(([tier, ore, wood, time]) => ({ tier, ore, wood, time }));
export const TECH = {
  carry:   { at: 'hq',       levels: L([1, 80, 60, 25], [2, 160, 120, 35]) },
  mining:  { at: 'hq',       levels: L([1, 100, 50, 30], [2, 200, 100, 40]) },
  felling: { at: 'hq',       levels: L([1, 60, 80, 25], [2, 140, 160, 35]) },
  hero:    { at: 'hq',       levels: L([2, 200, 100, 40], [3, 350, 200, 50]) },
  fort:    { at: 'hq',       levels: L([2, 150, 150, 40], [3, 280, 250, 50]) },
  weapons: { at: 'barracks', levels: L([1, 120, 60, 35], [2, 220, 120, 45], [3, 350, 200, 55]) },
  armor:   { at: 'barracks', levels: L([1, 100, 80, 35], [2, 200, 140, 45], [3, 320, 220, 55]) },
  sig:     { at: 'barracks', levels: L([2, 250, 200, 50]) },
  siege:   { at: 'workshop', levels: L([2, 180, 120, 40], [3, 300, 200, 50]) },
  trade:   { at: 'market',   levels: L([2, 120, 100, 30], [3, 240, 200, 40]) }
};
export const TECH_IDS = Object.keys(TECH);
export const techsAt = type => TECH_IDS.filter(id => TECH[id].at === type);

const NAMES = {
  wacht: { carry: ['Tragejoche', 'Lastenschlitten'], mining: ['Eisenspitzhacken', 'Stollenstützen'], felling: ['Scharfe Äxte', 'Zugsägen'], hero: ['Waffenübung', 'Heldenlieder'],
    fort: ['Verstärkte Mauern', 'Steinzinnen'], weapons: ['Geschärfte Speere', 'Stahlspitzen', 'Meisterschmiedung'], armor: ['Wattierte Wämser', 'Kettenhemden', 'Plattenpanzer'],
    sig: ['Schildwall-Drill'], siege: ['Eisenbeschlagene Rammen', 'Bergfried-Brecher'], trade: ['Handelsbriefe', 'Zollfreiheit'] },
  asch: { carry: ['Rückentragen', 'Schleppgestelle'], mining: ['Glutmeißel', 'Schmelzöfen'], felling: ['Brandäxte', 'Rodungstrupps'], hero: ['Blutrituale', 'Ahnenruf'],
    fort: ['Dornenwälle', 'Schwarzstein-Zinnen'], weapons: ['Zackenklingen', 'Splitterschneiden', 'Aschenstahl'], armor: ['Hautpanzer', 'Hornplatten', 'Schwarzer Harnisch'],
    sig: ['Brutstätten'], siege: ['Glühende Keulen', 'Bergbrecher'], trade: ['Beutetausch', 'Plünderrecht'] },
  salz: { carry: ['Salzkörbe', 'Seilwinden'], mining: ['Stahlmeißel', 'Hebelwerke'], felling: ['Treibholzsägen', 'Werftgespanne'], hero: ['Gezeitengesänge', 'Seherblick'],
    fort: ['Kalkmauern', 'Wellenbrecher'], weapons: ['Hakenstahl', 'Hohlschliff', 'Meeresstahl'], armor: ['Ölzeug', 'Schuppenpanzer', 'Perlmuttharnisch'],
    sig: ['Gezeitenkunde'], siege: ['Eisbrocken', 'Sturmschleuder'], trade: ['Hafenrechte', 'Seehandel'] }
};
const DESC = {
  carry: 'Arbeiter tragen vier Einheiten mehr je Fuhre.', mining: 'Erzabbau 20 Prozent schneller.', felling: 'Holzfällen 25 Prozent schneller.',
  hero: 'Helden sammeln 30 Prozent mehr Erfahrung.', fort: 'Gebäude nehmen 12 Prozent weniger Schaden.', weapons: 'Truppen richten 10 Prozent mehr Schaden an.',
  armor: 'Truppen nehmen 8 Prozent weniger Schaden.', siege: 'Belagerungswaffen richten 20 Prozent mehr Schaden an.', trade: 'Besserer Kurs beim Tauschen von Erz und Holz.',
  sig: { wacht: 'Speerträger nehmen 20 Prozent weniger Schaden.', asch: 'Truppen werden 25 Prozent schneller ausgebildet.', salz: 'Fähigkeiten und Macht laden 25 Prozent schneller.' }
};
export const techName = (fac, id, lvl) => (NAMES[fac] && NAMES[fac][id] ? NAMES[fac][id][Math.min(lvl, NAMES[fac][id].length) - 1] : id);
export const techDesc = (fac, id) => (typeof DESC[id] === 'object' ? DESC[id][fac] : DESC[id]);

export const tl = (t, id) => (G.tech && G.tech[t] && G.tech[t][id]) || 0;
export const techNext = (t, id) => (tl(t, id) < TECH[id].levels.length ? tl(t, id) + 1 : 0);
export function techBlock(b, id) {
  const t = b.team, n = techNext(t, id);
  if (!b.built) return 'Gebäude im Bau';
  if (b.rs) return 'Forschung läuft';
  if (!n) return 'Schon erforscht';
  const lv = TECH[id].levels[n - 1];
  if (tierOf(t) < lv.tier) return 'Burgstufe ' + lv.tier + ' nötig';
  return lack(t, lv);
}
export function startResearch(b, id) {
  const m = techBlock(b, id); if (m) { if (b.team === 0) hooks.toast(m, 'bad'); return false; }
  const n = techNext(b.team, id), lv = TECH[id].levels[n - 1];
  pay(b.team, lv); b.rs = { id, lvl: n, t: 0, dur: lv.time };
  if (b.team === 0) hooks.sfx('train');
  return true;
}
export function cancelResearch(b) { if (!b.rs) return; refund(b.team, TECH[b.rs.id].levels[b.rs.lvl - 1], .75); b.rs = null; }
function finishResearch(b) {
  const { id, lvl } = b.rs; b.rs = null;
  (G.tech[b.team] ||= {})[id] = lvl;
  if (b.team === 0) { hooks.toast('Erforscht: ' + techName(b.fac, id, lvl), 'good'); hooks.sfx('level'); }
}
// Fortschritt von Ausbau und Forschung; wird je Gebäude und Schritt aufgerufen.
export function updEconomy(b, dt) {
  if (b.up) { b.up.t += dt; if (b.up.t >= b.up.dur) finishUpgrade(b); }
  if (b.rs) { b.rs.t += dt; if (b.rs.t >= b.rs.dur) finishResearch(b); }
}

/* ---------- Wirkung der Forschung (wird von Kampf, Arbeit und Ausbildung gelesen) ---------- */
export const carryCap = t => CARRY + 4 * tl(t, 'carry');
export const gatherMul = (t, res) => 1 + (res === 'wood' ? .25 * tl(t, 'felling') : .2 * tl(t, 'mining'));
export const xpMul = t => 1 + .3 * tl(t, 'hero');
export const trainMul = (t, fac) => (fac === 'asch' && tl(t, 'sig') ? .75 : 1);
export const cooldownMul = (t, fac) => (fac === 'salz' && tl(t, 'sig') ? .75 : 1);
export function damageDealtMul(a) {
  const t = a.team; if (t > 1 || a.kind !== 'unit') return 1;
  let m = 1 + .1 * tl(t, 'weapons');
  if (a.type === 'siege') m *= 1 + .2 * tl(t, 'siege');
  return m;
}
export function damageTakenMul(e) {
  const t = e.team; if (t > 1) return 1;
  if (e.kind === 'bld') return 1 - .12 * tl(t, 'fort');
  if (e.kind === 'unit' && e.type !== 'worker') {
    let m = 1 - .08 * tl(t, 'armor');
    if (e.fac === 'wacht' && e.type === 'melee' && tl(t, 'sig')) m *= .8;
    return m;
  }
  return 1;
}

/* ---------- Handel ---------- */
export const tradeRate = t => .75 + .1 * tl(t, 'trade');
// amt Einheiten der Ware from gegen die Ware to tauschen ('ore' oder 'wood'); gibt false zurück, wenn zu wenig da ist.
export function trade(t, from, to, amt = 100) {
  const A = from === 'ore' ? G.ore : G.wood, B = to === 'ore' ? G.ore : G.wood;
  if (from === to || A[t] < amt) return false;
  A[t] -= amt; B[t] += Math.floor(amt * tradeRate(t));
  return true;
}
export const tradeBlock = (b, from) => (!b.built ? 'Gebäude im Bau' : (from === 'ore' ? G.ore : G.wood)[b.team] < 100 ? 'Nicht genug ' + (from === 'ore' ? 'Erz' : 'Holz') : null);
