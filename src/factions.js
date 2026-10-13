// Alle Zahlen und Namen der beiden Fraktionen. Einheiten sind über Rollen (worker, melee, ranged, cav,
// siege, hero) verknüpft, damit KI, Kampf und Oberfläche für beide Seiten denselben Code nutzen.

export const FACTIONS = {
  wacht: {
    id: 'wacht', name: 'Grenzwacht', color: '#4ba8cf', dark: '#1d5a78',
    blurb: 'Zähe Verteidiger. Wachtürme, Rammböcke und die Heldin Elda.',
    win: 'Die Grenzwacht hält die Grenzmark. Die Festung des Feindes liegt in Trümmern, und der Schnee deckt sie zu.',
    lose: 'Die Grenzburg ist gefallen. Der Winter kommt jetzt ohne Wachen.',
    tiers: ['Grenzburg', 'Wehrburg', 'Hochfeste'],
    units: {
      worker: { name: 'Arbeiter', hp: 45, spd: 68, dmg: 5, rng: 16, cd: 1.1, cost: 50, time: 7, r: 7, sight: 130, pop: 1 },
      melee:  { name: 'Speerträger', hp: 100, spd: 60, dmg: 12, rng: 18, cd: 1, cost: 80, time: 9, r: 8, sight: 140, pop: 1 },
      ranged: { name: 'Bogenschütze', hp: 60, spd: 64, dmg: 10, rng: 150, cd: 1.3, cost: 90, wood: 20, time: 10, r: 7, sight: 190, pop: 1 },
      cav:    { name: 'Reiter', hp: 150, spd: 112, dmg: 16, rng: 20, cd: 1, cost: 160, wood: 30, tier: 2, time: 14, r: 10, sight: 170, pop: 2 },
      siege:  { name: 'Rammbock', hp: 320, spd: 42, dmg: 48, rng: 24, cd: 1.8, cost: 220, wood: 80, tier: 2, time: 20, r: 12, sight: 120, pop: 3 },
      support: { name: 'Feldscher', hp: 70, spd: 64, dmg: 3, rng: 16, cd: 1.5, cost: 90, wood: 25, tier: 2, time: 11, r: 7, sight: 170, pop: 1, passive: true,
        aura: { kind: 'heal', amount: 7, range: 130, n: 3 }, desc: 'Heilt bis zu drei verletzte Verbündete in der Nähe.' },
      elite:  { name: 'Schildwache', hp: 240, spd: 52, dmg: 17, rng: 20, cd: 1.1, cost: 150, wood: 40, tier: 3, time: 15, r: 9, sight: 140, pop: 2, rres: .3,
        desc: 'Schwer gepanzert: Fernkampfschaden um 30 Prozent verringert.' },
      hero:   { name: 'Hauptfrau Elda', hp: 320, spd: 78, dmg: 24, rng: 22, cd: .9, cost: 300, time: 20, r: 10, sight: 200, pop: 3 }
    },
    blds: {
      hq:       { name: 'Grenzburg', hp: 1600, size: 3, cost: 0, sight: 230, supply: 12, trains: ['worker', 'hero'], drops: ['ore', 'wood'] },
      barracks: { name: 'Kaserne', hp: 800, size: 2, cost: 80, wood: 100, time: 14, sight: 170, trains: ['melee', 'ranged', 'cav', 'support', 'elite'] },
      workshop: { name: 'Werkstatt', hp: 700, size: 2, cost: 120, wood: 120, time: 16, sight: 150, trains: ['siege'], needs: 'barracks', tier: 2 },
      farm:     { name: 'Hof', hp: 420, size: 2, cost: 20, wood: 50, time: 9, sight: 140, supply: 8 },
      outpost:  { name: 'Vorposten', hp: 650, size: 2, cost: 120, wood: 140, time: 18, sight: 210, supply: 4, dropoff: true, drops: ['ore', 'wood'] },
      tower:    { name: 'Wachturm', hp: 520, size: 1, cost: 60, wood: 90, time: 12, sight: 230, dmg: 15, rng: 200, cd: 1.2 },
      lumber:   { name: 'Holzlager', hp: 380, size: 2, cost: 0, wood: 60, time: 8, sight: 150, drops: ['wood'] },
      market:   { name: 'Handelshaus', hp: 600, size: 2, cost: 100, wood: 150, time: 16, sight: 160, tier: 2 }
    },
    abilities: [
      { id: 'cry', name: 'Kriegsruf', key: 'q', cd: 45, lvl: 1, desc: 'Verbündete in der Nähe schlagen härter und laufen schneller.' },
      { id: 'wall', name: 'Schildwall', key: 'x', cd: 40, lvl: 2, desc: 'Verbündete in der Nähe nehmen 40 Prozent weniger Schaden.' }
    ],
    power: { id: 'spring', name: 'Heilquelle', cost: 2, radius: 140, dur: 7, cd: 50, desc: 'Eine Quelle heilt Verbündete im Gebiet.' }
  },
  asch: {
    id: 'asch', name: 'Aschenhorde', color: '#cc5638', dark: '#6c2818',
    blurb: 'Billige, schnelle Masse. Aschetrolle, Wolfsreiter und der Brandherr Kharg.',
    win: 'Die Aschenhorde hat gesiegt. Die Festung des Feindes brennt, und der Rauch zieht nach Westen.',
    lose: 'Die Aschenfeste ist erloschen. Kalte Glut ist das Ende des Stammes.',
    tiers: ['Aschenfeste', 'Glutfestung', 'Schlot des Zorns'],
    units: {
      worker: { name: 'Knecht', hp: 42, spd: 70, dmg: 5, rng: 16, cd: 1.1, cost: 45, time: 6, r: 7, sight: 130, pop: 1 },
      melee:  { name: 'Klingenkrieger', hp: 85, spd: 66, dmg: 14, rng: 18, cd: .95, cost: 65, time: 7, r: 8, sight: 140, pop: 1 },
      ranged: { name: 'Pfeilspeier', hp: 50, spd: 68, dmg: 9, rng: 135, cd: 1.2, cost: 70, wood: 15, time: 8, r: 7, sight: 180, pop: 1 },
      cav:    { name: 'Wolfsreiter', hp: 120, spd: 128, dmg: 15, rng: 20, cd: .9, cost: 135, wood: 25, tier: 2, time: 12, r: 10, sight: 180, pop: 2 },
      siege:  { name: 'Aschetroll', hp: 460, spd: 50, dmg: 32, rng: 26, cd: 1.6, cost: 240, wood: 60, tier: 2, time: 20, r: 13, sight: 130, pop: 3, splash: 46 },
      support: { name: 'Rauchpriester', hp: 60, spd: 66, dmg: 4, rng: 16, cd: 1.4, cost: 80, wood: 20, tier: 2, time: 10, r: 7, sight: 170, pop: 1, passive: true,
        aura: { kind: 'dmg', mul: .15, range: 150 }, desc: 'Verbündete in der Nähe schlagen 15 Prozent härter.' },
      elite:  { name: 'Aschenhüter', hp: 170, spd: 64, dmg: 24, rng: 20, cd: .9, cost: 120, wood: 30, tier: 3, time: 12, r: 9, sight: 140, pop: 2, rage: .5,
        desc: 'Kampfrausch: unter halbem Leben 50 Prozent mehr Schaden.' },
      hero:   { name: 'Brandherr Kharg', hp: 380, spd: 72, dmg: 28, rng: 22, cd: 1, cost: 300, time: 20, r: 11, sight: 190, pop: 3 }
    },
    blds: {
      hq:       { name: 'Aschenfeste', hp: 1400, size: 3, cost: 0, sight: 230, supply: 12, trains: ['worker', 'hero'], drops: ['ore', 'wood'] },
      barracks: { name: 'Kriegshalle', hp: 700, size: 2, cost: 70, wood: 90, time: 12, sight: 170, trains: ['melee', 'ranged', 'cav', 'support', 'elite'] },
      workshop: { name: 'Schmiedegrube', hp: 640, size: 2, cost: 110, wood: 110, time: 15, sight: 150, trains: ['siege'], needs: 'barracks', tier: 2 },
      farm:     { name: 'Pferch', hp: 360, size: 2, cost: 15, wood: 40, time: 8, sight: 140, supply: 8 },
      outpost:  { name: 'Glutlager', hp: 560, size: 2, cost: 100, wood: 120, time: 16, sight: 210, supply: 4, dropoff: true, drops: ['ore', 'wood'] },
      tower:    { name: 'Glutturm', hp: 480, size: 1, cost: 70, wood: 90, time: 12, sight: 210, dmg: 18, rng: 180, cd: 1.3 },
      lumber:   { name: 'Köhlerei', hp: 340, size: 2, cost: 0, wood: 50, time: 8, sight: 150, drops: ['wood'] },
      market:   { name: 'Plünderbasar', hp: 560, size: 2, cost: 90, wood: 130, time: 15, sight: 160, tier: 2 }
    },
    abilities: [
      { id: 'blast', name: 'Brandstoß', key: 'q', cd: 22, lvl: 1, targeted: true, range: 240, radius: 90, desc: 'Feuerschlag auf einen Punkt. Schaden wächst mit der Stufe.' },
      { id: 'dread', name: 'Schreckensruf', key: 'x', cd: 40, lvl: 2, desc: 'Feinde in der Nähe werden langsamer und schlagen schwächer.' }
    ],
    power: { id: 'rain', name: 'Feuerregen', cost: 3, radius: 150, dur: 5, cd: 50, desc: 'Glühende Brocken prasseln auf das Gebiet.' }
  },
  salz: {
    id: 'salz', name: 'Salzbund', color: '#a68be0', dark: '#4a3a78',
    blurb: 'Teure Elite von der versunkenen Küste. Harpuniere, Hirschreiter, Gezeitenschleuder und die Seherin Maren.',
    win: 'Der Salzbund hat gesiegt. Die Leuchtfeste brennt weiter, und die Festung des Feindes liegt still wie ein Wrack.',
    lose: 'Die Leuchtfeste ist dunkel. Der Salzbund treibt wieder ohne Hafen.',
    tiers: ['Leuchtfeste', 'Sturmwarte', 'Gezeitenburg'],
    units: {
      worker: { name: 'Salzträger', hp: 48, spd: 66, dmg: 5, rng: 16, cd: 1.1, cost: 55, time: 7, r: 7, sight: 140, pop: 1 },
      melee:  { name: 'Hakenwächter', hp: 115, spd: 58, dmg: 13, rng: 20, cd: 1.05, cost: 95, time: 10, r: 8, sight: 140, pop: 1 },
      ranged: { name: 'Harpunier', hp: 62, spd: 62, dmg: 13, rng: 165, cd: 1.5, cost: 105, wood: 25, time: 11, r: 7, sight: 200, pop: 1 },
      cav:    { name: 'Hirschreiter', hp: 140, spd: 118, dmg: 17, rng: 20, cd: 1, cost: 170, wood: 35, tier: 2, time: 14, r: 10, sight: 190, pop: 2 },
      siege:  { name: 'Gezeitenschleuder', hp: 260, spd: 40, dmg: 40, rng: 230, cd: 3, cost: 240, wood: 80, tier: 2, time: 20, r: 12, sight: 150, pop: 3 },
      support: { name: 'Muschelsänger', hp: 66, spd: 62, dmg: 4, rng: 16, cd: 1.4, cost: 100, wood: 25, tier: 2, time: 11, r: 7, sight: 190, pop: 1, passive: true,
        aura: { kind: 'slow', mul: .8, range: 170 }, desc: 'Feinde in der Nähe laufen 20 Prozent langsamer.' },
      elite:  { name: 'Perlenwache', hp: 210, spd: 56, dmg: 16, rng: 20, cd: 1, cost: 160, wood: 45, tier: 3, time: 15, r: 9, sight: 150, pop: 2, reflect: .2,
        desc: 'Dornenpanzer: Nahkämpfer erleiden 20 Prozent ihres Schadens selbst.' },
      hero:   { name: 'Seherin Maren', hp: 290, spd: 80, dmg: 20, rng: 120, cd: 1.1, cost: 300, time: 20, r: 10, sight: 230, pop: 3 }
    },
    blds: {
      hq:       { name: 'Leuchtfeste', hp: 1500, size: 3, cost: 0, sight: 260, supply: 12, trains: ['worker', 'hero'], drops: ['ore', 'wood'] },
      barracks: { name: 'Bootshalle', hp: 760, size: 2, cost: 85, wood: 105, time: 14, sight: 170, trains: ['melee', 'ranged', 'cav', 'support', 'elite'] },
      workshop: { name: 'Werft', hp: 680, size: 2, cost: 120, wood: 130, time: 16, sight: 150, trains: ['siege'], needs: 'barracks', tier: 2 },
      farm:     { name: 'Räucherei', hp: 400, size: 2, cost: 20, wood: 55, time: 9, sight: 140, supply: 8 },
      outpost:  { name: 'Salzlager', hp: 620, size: 2, cost: 110, wood: 130, time: 17, sight: 230, supply: 4, dropoff: true, drops: ['ore', 'wood'] },
      tower:    { name: 'Leuchtturm', hp: 500, size: 1, cost: 65, wood: 95, time: 12, sight: 290, dmg: 14, rng: 215, cd: 1.3 },
      lumber:   { name: 'Treibholzhof', hp: 360, size: 2, cost: 0, wood: 55, time: 8, sight: 150, drops: ['wood'] },
      market:   { name: 'Hafenmarkt', hp: 580, size: 2, cost: 90, wood: 140, time: 16, sight: 170, tier: 2 }
    },
    abilities: [
      { id: 'tide', name: 'Brandungsschlag', key: 'q', cd: 26, lvl: 1, targeted: true, range: 260, radius: 80, desc: 'Eine Welle trifft einen Punkt. Feinde nehmen Schaden und werden langsamer.' },
      { id: 'bless', name: 'Gezeitensegen', key: 'x', cd: 45, lvl: 2, desc: 'Verbündete in der Nähe heilen sofort ein Drittel ihres Lebens.' }
    ],
    power: { id: 'surge', name: 'Sturmflut', cost: 3, radius: 140, dur: 6, cd: 55, desc: 'Kaltes Wasser schwemmt über das Gebiet, schadet Feinden und bremst sie.' }
  }
};
export const FAC_IDS = Object.keys(FACTIONS);
// Gegner, wenn keiner gewählt ist: die nächste Fraktion in der Liste.
export const otherFac = fac => FAC_IDS[(FAC_IDS.indexOf(fac) + 1) % FAC_IDS.length];

export const NEUTRAL = { mine: { name: 'Erzader', kind: 'dep', size: 2 },
  // Stadtmauer in Schlachten aus der Kampagne (gehört dem Verteidiger, greift nicht an)
  wall: { name: 'Stadtmauer', kind: 'bld', size: 1, hp: 700, sight: 120, cost: 0, wood: 0, time: 0 } };

for (const f of Object.values(FACTIONS)) {
  for (const d of Object.values(f.units)) d.kind = 'unit';
  for (const d of Object.values(f.blds)) d.kind = 'bld';
}

// Wilde Wesen der Außengebiete (Team 3): greifen beide Seiten an, bewachen Erzadern und geben Beute.
export const WILD = {
  melee:  { name: 'Streuner', hp: 90, spd: 60, dmg: 11, rng: 18, cd: 1, r: 8, sight: 150, pop: 1, bounty: 25 },
  ranged: { name: 'Steinwerfer', hp: 70, spd: 56, dmg: 10, rng: 130, cd: 1.3, r: 8, sight: 170, pop: 1, bounty: 30 },
  brute:  { name: 'Hüne', hp: 420, spd: 46, dmg: 30, rng: 24, cd: 1.6, r: 13, sight: 150, pop: 3, bounty: 90 }
};
// Gibt das Gebäude Rohstoff res ab? (Hauptburg, Vorposten: Erz und Holz; Holzlager: nur Holz)
export const takes = (b, res) => !!(b && b.d && b.d.drops && b.d.drops.includes(res));
// Anzeigename eines Gebäudes; die Hauptburg trägt je Ausbaustufe einen eigenen Namen.
export const bldName = e => (e.type === 'hq' && FACTIONS[e.fac] ? FACTIONS[e.fac].tiers[(e.tier || 1) - 1] : e.d.name);
export const facOf = fac => FACTIONS[fac] || { id: 'wild', name: 'Wild', color: '#9bb06a', dark: '#3e5030' };
export function defOf(fac, type) {
  if (fac === 'wild') return WILD[type];
  if (NEUTRAL[type]) return NEUTRAL[type];
  const f = FACTIONS[fac];
  return f.units[type] || f.blds[type];
}

// Hotkeys nach Rolle. Sie gelten nur im jeweiligen Kontext (Auswahl), Überschneidungen sind unkritisch.
export const HK = { worker: 'w', hero: 'g', melee: 'z', ranged: 'x', cav: 'c', siege: 'v', farm: 'f', barracks: 'k', workshop: 'j', tower: 't', outpost: 'o', lumber: 'l', market: 'm', support: 'h', elite: 'y' };

// Held: Erfahrung für Stufe 2 bis 5.
export const XP_STEPS = [80, 200, 380, 620];
export const MAX_HERO_LVL = XP_STEPS.length + 1;
export const heroLevel = xp => 1 + XP_STEPS.filter(s => xp >= s).length;
