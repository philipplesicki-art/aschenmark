export const TS = 32, GW = 120, GH = 84, WW = GW * TS, WH = GH * TS, CARRY = 10;

// Schwierigkeitsstufen der Gegner-KI.
export const DIFF = {
  easy:   { label: 'Leicht', workers: 6,  maxBars: 2, barEvery: 300, hero: false, towers: 0, siege: false, size0: 6,  grow: 3, gap: 90, first: 480, rate: .8 },
  normal: { label: 'Normal', workers: 8,  maxBars: 3, barEvery: 200, hero: true,  heroAt: 420, towers: 1, towerAt: 360, siege: true, siegeAt: 540, size0: 9,  grow: 4, gap: 75, first: 360, rate: 1 },
  hard:   { label: 'Schwer', workers: 10, maxBars: 4, barEvery: 140, hero: true,  heroAt: 300, towers: 2, towerAt: 300, siege: true, siegeAt: 400, size0: 10, grow: 5, gap: 55, first: 270, rate: 1.3 }
};

// Taktische Gegenspiel-Faktoren nach Rolle (Schere, Stein, Papier plus Belagerung).
export const MULT = {
  melee:  { cav: 1.7 },
  cav:    { ranged: 1.5, worker: 1.3 },
  ranged: { melee: 1.35 },
  siege:  { melee: .35, ranged: .35, cav: .35, hero: .35, worker: .35 }
};
export const BMULT = { ranged: .6, cav: .8, worker: .5, hero: 1.2, siege: 2.6 };

export const MAP = {
  hq: [[8, 38], [69, 15]],
  mines: [[13, 42, 2600], [5, 34, 2600], [63, 13, 2600], [73, 22, 2600], [38, 26, 4200], [20, 13, 3600], [58, 40, 3600],
    // Außengebiete (erst nach Öffnen der Pässe erreichbar)
    [95, 14, 3000], [104, 40, 3000], [10, 70, 3000], [28, 76, 3000], [55, 72, 3600], [100, 70, 3600]]
};

// Grafikstufen: Pixeldichte, Schatten, warme Punktlichter, Schneeflocken, Nachbearbeitung.
export const QUALITY = {
  low:    { label: 'Niedrig', dpr: 1,   shadows: false, shadowMap: 1024, lights: 2, snow: 220, post: false, ao: false },
  medium: { label: 'Mittel',  dpr: 1.5, shadows: true,  shadowMap: 1024, lights: 4, snow: 420, post: true, ao: false },
  high:   { label: 'Hoch',    dpr: 2,   shadows: true,  shadowMap: 2048, lights: 8, snow: 650, post: true, ao: true }
};
