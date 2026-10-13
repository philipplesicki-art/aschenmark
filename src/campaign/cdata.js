// Kampagne: feste Daten für Gelände, Gebäude, Rekrutierung und Namen. Reine Daten, keine Logik.
import { FACTIONS } from '../factions.js';

// Gelände: Grundertrag je Runde bei Siedlungsstufe 1 (Erz, Holz, Vorräte), Verteidigungsbonus, Farbe auf der Karte.
export const BIOMES = {
  grenz: { name: 'Grenzland', ore: 40, wood: 50, food: 40,  def: 1.05, col: '#8e9aa6', cold: true },
  wald: { name: 'Waldmeer', ore: 15, wood: 85, food: 35,   def: 1.15, col: '#4f6a5c', cold: true },
  asch: { name: 'Aschenfelder', ore: 90, wood: 20, food: 25,  def: 1.0,  col: '#5d5552', cold: true },
  berg: { name: 'Bergland', ore: 110, wood: 25, food: 10,  def: 1.3,  col: '#7b7670', cold: true },
  trocken: { name: 'Trockenland', ore: 75, wood: 15, food: 30,  def: 1.0,  col: '#a58a5e', cold: false },
  sumpf: { name: 'Sumpfland', ore: 40, wood: 60, food: 60, def: 1.2,  col: '#556552', cold: false },
  kueste: { name: 'Küste', ore: 35, wood: 30, food: 80, def: 1.0,  col: '#9d9478', cold: false }
};

// Hauptstädte ernten unabhängig vom Gelände gleich viel, damit kein Reich durch seinen Startort im Vorteil ist.
export const CAPITAL_BASE = { ore: 60, wood: 60, food: 60 };

// Gebäude einer Provinz. Stufen 1 bis 3; Kosten je Stufe (Erz, Holz), Bauzeit in Runden.
// yield: Mehrertrag je Stufe (als Anteil am Grundertrag des Rohstoffs oder fester Wert).
export const CBLD = {
  farm:     { name: 'Gehöfte',       desc: 'Mehr Vorräte: je Stufe plus 60 Prozent des Grundertrags und 20 fest.', cost: [[20, 60], [50, 120], [100, 200]], turns: [1, 1, 2], yieldMul: { food: .6 }, yieldAdd: { food: 20 } },
  mine:     { name: 'Bergwerk',      desc: 'Mehr Erz: je Stufe plus 60 Prozent des Grundertrags und 15 fest.', cost: [[40, 60], [100, 120], [180, 220]], turns: [1, 2, 2], yieldMul: { ore: .6 }, yieldAdd: { ore: 15 } },
  lumber:   { name: 'Sägewerk',      desc: 'Mehr Holz: je Stufe plus 60 Prozent des Grundertrags und 15 fest.', cost: [[30, 40], [80, 90], [150, 160]], turns: [1, 1, 2], yieldMul: { wood: .6 }, yieldAdd: { wood: 15 } },
  barracks: { name: 'Kaserne',       desc: 'Rekrutierung in dieser Provinz. Stufe 2 erlaubt Reiter und Unterstützer, Stufe 3 Elite und Belagerung.', cost: [[80, 100], [160, 180], [260, 260]], turns: [1, 2, 2] },
  walls:    { name: 'Mauern',        desc: 'Verteidiger sind je Stufe 25 Prozent stärker.', cost: [[60, 120], [140, 220], [260, 340]], turns: [2, 2, 3] },
  school:   { name: 'Gelehrtenhaus', desc: 'Forschung: je Stufe ein Viertel Forschungspunkt mehr je Runde (im ganzen Reich zusammen höchstens 1,5).', cost: [[80, 100], [160, 180], [260, 260]], turns: [1, 2, 2] },
  market:   { name: 'Markt',         desc: 'Je Stufe 30 Erz und 10 Prozent mehr Ertrag dieser Provinz.', cost: [[100, 100], [180, 180], [280, 280]], turns: [1, 2, 2], yieldAdd: { ore: 30 }, yieldPct: .1 }
};
export const CBLD_IDS = Object.keys(CBLD);

// Ausbau der Siedlung: Stufe 1 bis 5. Jede Stufe erhöht den Grundertrag um 35 Prozent und einen Gebäudeplatz.
export const SETTLE = [null, { slots: 2 }, { slots: 3, cost: [120, 120], turns: 2 }, { slots: 4, cost: [220, 220], turns: 3 }, { slots: 5, cost: [360, 360], turns: 3 }, { slots: 6, cost: [520, 520], turns: 4 }];
export const SETTLE_NAMES = ['Wildnis', 'Weiler', 'Dorf', 'Marktflecken', 'Stadt', 'Festung'];

// Rekrutierung: Kosten aus den Gefechtswerten (Erz, Holz), nötige Kasernenstufe, Stärke für berechnete Schlachten.
// Stärke grob aus Leben mal Schaden je Sekunde, so dass ein Speerträger etwa 10 zählt.
export const ROLE_INFO = {
  melee:   { bar: 1, name: 'Fußtruppen' },
  ranged:  { bar: 1, name: 'Fernkämpfer' },
  cav:     { bar: 2, name: 'Reiter' },
  support: { bar: 2, name: 'Unterstützer' },
  elite:   { bar: 3, name: 'Elite' },
  siege:   { bar: 3, name: 'Belagerung' }
};
export const ROLES = Object.keys(ROLE_INFO);
export function unitStrength(fac, role) {
  const d = FACTIONS[fac].units[role]; if (!d) return 0;
  const dps = d.dmg / d.cd * (d.rng > 60 ? 1.15 : 1);
  let s = Math.sqrt(d.hp * dps) / 3.46; // Speerträger der Grenzwacht ≈ 10
  if (d.aura) s *= 1.6; if (d.rres || d.rage || d.reflect) s *= 1.15;
  return Math.round(s * 10) / 10;
}
// Unterhalt je Einheit und Runde: Vorräte je Versorgungsplatz.
export const UPKEEP_FOOD = 7.5;

// Jahreszeiten der Kampagne (eine Runde je Jahreszeit), passend zum Gefecht.
export const CSEASONS = [
  { id: 'thaw',  name: 'Tauzeit',   food: 1,   upkeep: 1,   moves: 2 },
  { id: 'chill', name: 'Frühfrost', food: .7,  upkeep: 1.2, moves: 2 },
  { id: 'frost', name: 'Hartfrost', food: .25, upkeep: 1.6, moves: 1 },
  { id: 'melt',  name: 'Tauwetter', food: .8,  upkeep: 1,   moves: 1 }
];

// Namen aus Silben je Gelände; eigene Erfindungen.
export const NAME_PARTS = {
  grenz:   [['Frost', 'Kalten', 'Grau', 'Raben', 'Wolfs', 'Hagel', 'Eis', 'Weiß'], ['mark', 'furt', 'wacht', 'tal', 'heim', 'bruck', 'stein', 'au']],
  wald:    [['Tannen', 'Föhren', 'Moos', 'Dunkel', 'Hirsch', 'Eiben', 'Harz', 'Schatten'], ['wald', 'hain', 'grund', 'tann', 'lohe', 'forst', 'busch', 'rode']],
  asch:    [['Asch', 'Glut', 'Ruß', 'Schlacken', 'Brand', 'Kohl', 'Zunder', 'Schwelen'], ['feld', 'grube', 'kamm', 'öde', 'statt', 'riss', 'kuhle', 'hang']],
  berg:    [['Grat', 'Fels', 'Horn', 'Klamm', 'Geier', 'Kar', 'Zinnen', 'Schroff'], ['spitz', 'joch', 'wand', 'egg', 'burg', 'scharte', 'fels', 'kogel']],
  trocken: [['Sand', 'Dorn', 'Staub', 'Salbei', 'Ocker', 'Dürr', 'Kies', 'Sonnen'], ['ebene', 'senke', 'weite', 'brunn', 'pfad', 'steppe', 'mulde', 'rast']],
  sumpf:   [['Moor', 'Schilf', 'Nebel', 'Torf', 'Unken', 'Weiden', 'Erlen', 'Brack'], ['bruch', 'lake', 'fenn', 'siel', 'wasser', 'rieth', 'pfuhl', 'damm']],
  kueste:  [['Salz', 'Möwen', 'Brandungs', 'Muschel', 'Tang', 'Klippen', 'Dünen', 'Gezeiten'], ['hafen', 'strand', 'bucht', 'kliff', 'ort', 'sand', 'riff', 'kai']]
};

// Startprovinzen (Lage als Anteil der Kartengröße) und Farbe je Fraktion.
export const CAPITALS = { wacht: [.21, .17], asch: [.79, .17], salz: [.5, .89] }; // gleichseitiges Dreieck auf der 240×168-Karte (je ~140 Zellen)
export const facColor = fac => (FACTIONS[fac] ? FACTIONS[fac].color : fac === 'wild' ? '#9a5bb5' : '#9bb06a'); // wild: die Erwachten

// Werdegang des Helden: bei jedem Stufenaufstieg wählt das Reich einen von drei angebotenen Zügen.
export const HERO_TRAITS = {
  feldherr:    { name: 'Feldherr', desc: 'Das Heer des Helden ist 10 Prozent stärker.' },
  belagerer:   { name: 'Belagerer', desc: 'Angriffe des Heldenheeres übergehen eine Mauerstufe.' },
  marschall:   { name: 'Marschall', desc: 'Das Heer des Helden hat einen Zug mehr je Runde.' },
  waechter:    { name: 'Wächter', desc: 'Verteidigt der Held, ist sein Heer 20 Prozent stärker.' },
  landvogt:    { name: 'Landvogt', desc: 'Wo der Held steht, legt sich Unruhe drei Runden schneller.' },
  kaempe:      { name: 'Kämpe', desc: 'In Echtzeit-Schlachten hat der Held 30 Prozent mehr Leben.' },
  zahlmeister: { name: 'Zahlmeister', desc: 'Das Heer des Helden kostet nur halben Unterhalt.' }
};
export const HERO_TRAIT_IDS = Object.keys(HERO_TRAITS);

// Stätten: besondere Orte auf der Weltkarte. Stärker bewacht, aber ihr Besitz gibt dem ganzen Reich einen Vorteil.
export const SITES = {
  forge:       { name: 'Alte Schmiede', glyph: '⚒', desc: 'Rekruten kosten im ganzen Reich ein Zehntel weniger.' },
  observatory: { name: 'Sternwarte', glyph: '✶', desc: 'Forschung ein halber Punkt mehr je Runde.' },
  saltlake:    { name: 'Salzsee', glyph: '◈', desc: 'Hier 40 Vorräte mehr, Handelskurs plus 5 Punkte.' },
  shrine:      { name: 'Heiligtum der Frostmutter', glyph: '✦', desc: 'Unruhe klingt im ganzen Reich eine Runde schneller ab.' },
  barrow:      { name: 'Hünengrab', glyph: '☗', desc: 'Der Held gewinnt jede Runde 15 Erfahrung.' },
  ironpit:     { name: 'Eisengrube', glyph: '⛏', desc: 'Hier 45 Erz mehr je Runde.' },
  camp:        { name: 'Söldnerlager', glyph: '⚑', desc: 'Jede zweite Runde schließen sich hier zwei Söldner dem Reich an.' }
};
export const SITE_IDS = Object.keys(SITES);
