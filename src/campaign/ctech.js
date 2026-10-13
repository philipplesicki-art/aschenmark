// Forschungsbaum der Kampagne: vier Zeitalter, Voraussetzungen, Wirkungen auf Wirtschaft, Heere und Verwaltung.
// rts: Stufen der Gefechtsforschung, die in Echtzeit-Schlachten gelten (Waffen, Rüstung usw.).
// fx: Wirkungen auf der Weltkarte; mehrere Forschungen mit demselben Schlüssel addieren sich (siehe cfx in cstate.js).
import { techName } from '../economy.js';

export const CTECH = {
  // Zeitalter I: Grundlagen
  plough:   { era: 1, req: [], name: 'Eisenpflüge', desc: 'Gehöfte bringen 25 Prozent mehr.', rts: { harvest: 1 }, fx: { farm: .25 } },
  pick:     { era: 1, req: [], name: 'Stollenbau', desc: 'Bergwerke bringen 25 Prozent mehr.', rts: { mining: 1 }, fx: { mine: .25 } },
  saw:      { era: 1, req: [], name: 'Zugsägen', desc: 'Sägewerke bringen 25 Prozent mehr.', rts: { felling: 1 }, fx: { lumber: .25 } },
  arms1:    { era: 1, req: [], desc: 'Truppen schlagen 10 Prozent härter.', rts: { weapons: 1 } },
  mail1:    { era: 1, req: [], desc: 'Truppen halten 8 Prozent mehr aus.', rts: { armor: 1 } },
  scribes:  { era: 1, req: [], name: 'Schreibstuben', desc: 'Verwaltung: eine Provinz mehr ohne Ertragsverlust.', fx: { adminFree: 1 } },
  // Zeitalter II: Ausbau
  roads:    { era: 2, req: ['scribes'], name: 'Heerstraßen', desc: 'Märsche durch eigene Provinzen kosten nur einen halben Zug.', fx: { roads: 1 } },
  arms2:    { era: 2, req: ['arms1', 'pick'], desc: 'Waffen II: noch einmal 10 Prozent härter.', rts: { weapons: 2 } },
  mail2:    { era: 2, req: ['mail1'], desc: 'Rüstung II: noch einmal 8 Prozent zäher.', rts: { armor: 2 } },
  granary:  { era: 2, req: ['plough'], name: 'Kornspeicher', desc: 'Vorratslager plus 800, Gehöfte plus 15 Prozent.', rts: { storage: 1 }, fx: { foodCap: 800, farm: .15 } },
  masonry:  { era: 2, req: ['pick'], name: 'Steinmetze', desc: 'Mauern schützen je Stufe 10 Prozent mehr und kosten ein Viertel weniger.', rts: { fort: 1 }, fx: { wallBonus: .1, wallCost: .25 } },
  engines:  { era: 2, req: ['saw', 'arms1'], name: 'Belagerungsgerät', desc: 'Eigene Angriffe übergehen eine Mauerstufe.', rts: { siege: 1 }, fx: { breach: 1 } },
  coin:     { era: 2, req: ['scribes'], name: 'Münzwesen', desc: 'Handelskurs plus 8 Punkte, jede Marktstufe bringt 10 Erz mehr.', rts: { trade: 1 }, fx: { trade: .08, marketOre: 10 } },
  songs:    { era: 2, req: [], name: 'Heldenlieder', desc: 'Der Held sammelt 50 Prozent mehr Erfahrung.', rts: { hero: 1 }, fx: { heroXp: .5 } },
  // Zeitalter III: Macht
  arms3:    { era: 3, req: ['arms2'], desc: 'Waffen III: die besten Klingen Orsas.', rts: { weapons: 3 } },
  mail3:    { era: 3, req: ['mail2'], desc: 'Rüstung III: schwere Harnische.', rts: { armor: 3 } },
  baggage:  { era: 3, req: ['roads', 'granary'], name: 'Tross', desc: 'Unterhalt der Heere 20 Prozent geringer.', fx: { upkeep: .2 } },
  garrison: { era: 3, req: ['masonry'], name: 'Garnisonen', desc: 'Unruhe klingt schneller ab, Aufstände halb so oft, Bürgerwehr 50 Prozent stärker.', fx: { garrison: 1 } },
  drill:    { era: 3, req: ['arms2'], name: 'Exerzierplätze', desc: 'Kasernen bilden je Stufe 2 Trupps mehr je Runde aus.', rts: { sig: 1 }, fx: { drill: 2 } },
  academy:  { era: 3, req: ['coin'], name: 'Akademien', desc: 'Forschung 25 Prozent schneller.', fx: { research: .25 } },
  rams:     { era: 3, req: ['engines'], name: 'Sturmböcke', desc: 'Eigene Angriffe übergehen eine weitere Mauerstufe.', rts: { siege: 2 }, fx: { breach: 1 } },
  // Zeitalter IV: Reich
  reform:   { era: 4, req: ['garrison', 'academy'], name: 'Reichsreform', desc: 'Verwaltungslast um ein Drittel geringer.', fx: { adminHalf: 1 } },
  citadel:  { era: 4, req: ['garrison'], name: 'Zitadellen', desc: 'Mauern schützen je Stufe noch einmal 10 Prozent mehr.', rts: { fort: 2 }, fx: { wallBonus: .1 } },
  legend:   { era: 4, req: ['songs', 'drill'], name: 'Heldenepos', desc: 'Der Held steigt bis Stufe 8 auf.', rts: { hero: 2 }, fx: { heroCap: 3 } },
  levy:     { era: 4, req: ['baggage', 'drill'], name: 'Heerbann', desc: 'Rekruten kosten 20 Prozent weniger.', fx: { recruit: .2 } },
  rotation: { era: 4, req: ['granary', 'academy'], name: 'Fruchtwechsel', desc: 'Alle Provinzen bringen 10 Prozent mehr.', rts: { harvest: 2 }, fx: { yieldAll: .1 } }
};
export const CTECH_IDS = Object.keys(CTECH);
export const ERAS = [null, { name: 'Zeitalter der Gründer', cost: { ore: 140, wood: 100, food: 100 }, pts: 5 }, { name: 'Zeitalter der Fürsten', cost: { ore: 300, wood: 230, food: 230 }, pts: 8 },
  { name: 'Zeitalter der Heere', cost: { ore: 540, wood: 400, food: 420 }, pts: 12 }, { name: 'Zeitalter des Reiches', cost: { ore: 900, wood: 680, food: 700 }, pts: 18 }];
// Name je Fraktion: Waffen und Rüstung heißen wie im Gefecht
export function ctechName(f, id) {
  const t = CTECH[id];
  if (t.name) return t.name;
  const [k, lv] = Object.entries(t.rts)[0];
  return f ? techName(f, k, lv) : k + ' ' + lv;
}
// Reihenfolge, in der die KI forscht (erstes Verfügbares, das sie sich leisten kann)
export const AI_ORDER = ['arms1', 'scribes', 'pick', 'plough', 'mail1', 'saw', 'engines', 'granary', 'arms2', 'masonry', 'roads', 'coin', 'mail2', 'songs',
  'garrison', 'drill', 'baggage', 'academy', 'arms3', 'rams', 'mail3', 'reform', 'levy', 'citadel', 'legend', 'rotation'];
