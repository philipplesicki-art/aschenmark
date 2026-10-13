// Diplomatie der Kampagne: Frieden, Krieg, Waffenstillstand, Beistandsbündnis. Die KI wägt Stärke, Haltung und Kriegsdauer ab.
// Zustand je Reichspaar in C.dip (siehe dkey/dipOf in cstate.js), Haltungen der KI in C.emp[f].op, Angebote an den Spieler in C.offers.
import { C, MAP, cR, cHooks, addLog, dipOf, setDip, hostile, allied, armyPower, empireName, CDIFF, prov, TRUCE } from './cstate.js';
import { FAC_IDS } from '../factions.js';

const others = f => FAC_IDS.filter(g => g !== f && C.emp[g].alive);
// Stärke eines Reiches für Abwägungen: Heere plus Provinzen
export const might = f => C.armies.filter(a => a.owner === f).reduce((n, a) => n + armyPower(a.units, f, a.hero), 0) + C.provs.filter(p => p.owner === f).length * 25;
export const borders = (f, g) => C.provs.some(p => p.owner === f && MAP.provs[p.id].nb.some(n => prov(n).owner === g));
const provCount = f => C.provs.filter(p => p.owner === f).length;
// Führungsmacht: deutlich mehr Provinzen als das zweitgrößte Reich
export function isLeader(g) { const counts = FAC_IDS.filter(h => C.emp[h].alive).map(provCount).sort((a, b) => b - a); return counts.length > 1 && provCount(g) === counts[0] && counts[0] > counts[1] * 1.3 + 2; }
// Haltung von f gegenüber g: Erinnerungen (op) plus Lage. Unter -20 feindselig, über 20 freundlich.
export function opinion(f, g) {
  let o = (C.emp[f].op && C.emp[f].op[g]) || 0;
  if (g === C.player) o += CDIFF[C.diff].hate || 0;
  const d = dipOf(f, g); if (d && d.st === 'war') o -= 15; if (d && d.st === 'ally') o += 25;
  if (borders(f, g)) o -= 5;
  // Die Führungsmacht wird gefürchtet: wer deutlich mehr Provinzen hat, hat keine Freunde
  const counts = FAC_IDS.filter(h => C.emp[h].alive).map(provCount).sort((a, b) => b - a);
  if (isLeader(g)) o -= 20;
  for (const h of others(f)) if (h !== g && hostile(f, h) && hostile(g, h)) o += 15; // gemeinsamer Feind
  return Math.round(o);
}
export const opinionWord = o => o <= -35 ? 'hasserfüllt' : o <= -15 ? 'feindselig' : o < 15 ? 'abwartend' : o < 35 ? 'freundlich' : 'herzlich';
const remember = (f, g, v) => { const e = C.emp[f]; e.op ||= {}; e.op[g] = Math.max(-60, Math.min(60, (e.op[g] || 0) + v)); };
const kind = (f, g) => (f === C.player || g === C.player ? (f === C.player ? 'good' : 'bad') : '');

export function warBlock(f, g) {
  const d = dipOf(f, g);
  if (!d || d.st === 'war') return 'Schon im Krieg';
  if (d.truce > 0) return 'Waffenstillstand noch ' + d.truce + ' Runde(n)';
  return null;
}
export function declareWar(f, g) {
  if (warBlock(f, g)) return false;
  const wasAlly = allied(f, g);
  setDip(f, g, 'war');
  addLog(empireName(f) + ' erklärt ' + empireName(g) + ' den Krieg' + (wasAlly ? ' und bricht das Bündnis' : '') + '!', f === C.player ? '' : g === C.player ? 'bad' : '');
  for (const h of others(f)) if (h !== g) remember(h, f, wasAlly ? -25 : -8); // Wortbruch spricht sich herum
  remember(g, f, -30);
  // Beistand: Verbündete des Angegriffenen ziehen mit in den Krieg
  for (const h of others(g)) if (h !== f && allied(h, g) && !hostile(h, f)) {
    setDip(h, f, 'war'); addLog(empireName(h) + ' steht ' + empireName(g) + ' bei und erklärt ' + empireName(f) + ' den Krieg.', h === C.player || f === C.player ? 'bad' : '');
  }
  return true;
}
export function makePeace(f, g) {
  setDip(f, g, 'peace');
  addLog(empireName(f) + ' und ' + empireName(g) + ' schließen Frieden (Waffenstillstand ' + TRUCE + ' Runden).', f === C.player || g === C.player ? 'good' : '');
}
export function makeAlliance(f, g) {
  setDip(f, g, 'ally');
  addLog(empireName(f) + ' und ' + empireName(g) + ' schließen ein Beistandsbündnis.', f === C.player || g === C.player ? 'good' : '');
}
export function breakAlliance(f, g) { setDip(f, g, 'peace'); remember(g, f, -15); addLog(empireName(f) + ' kündigt das Bündnis mit ' + empireName(g) + '.', kind(f, g)); }
export function gift(f, g, ore) {
  const e = C.emp[f]; if (e.ore < ore) return false;
  e.ore -= ore; C.emp[g].ore += ore; remember(g, f, ore / 15); return true;
}

// KI entscheidet über Frieden mit g (Abgabe: Tribut in Erz, den g zahlt)
export function acceptsPeace(f, g, tribute = 0) {
  const d = dipOf(f, g); if (!d || d.st !== 'war') return false;
  const r = might(f) / Math.max(1, might(g)), turns = C.turn - d.since, wars = others(f).filter(h => hostile(f, h)).length;
  // Kriegsmüdigkeit nach langen Kriegen; wer an zwei Fronten kämpft, will eine schließen
  return (1.15 - Math.min(2, r)) + Math.min(.9, turns * .035) + (turns > 20 ? .3 : 0) + (wars - 1) * .25 + tribute / 500 + opinion(f, g) / 120 > .3;
}
export function acceptsAlliance(f, g) {
  const d = dipOf(f, g); if (!d || d.st !== 'peace' || C.turn - d.since < 4) return false;
  const common = others(f).some(h => h !== g && hostile(f, h) && hostile(g, h));
  return common && opinion(f, g) >= 10;
}

// Ein Zug der KI-Diplomatie
export function aiDiplomacy(f) {
  const D = CDIFF[C.diff], mine = might(f);
  for (const g of others(f)) {
    const d = dipOf(f, g); if (!d) continue;
    const r = mine / Math.max(1, might(g)), op = opinion(f, g);
    if (d.st === 'ally') { // Bündnisse ohne gemeinsamen Feind schlafen ein
      const common = others(f).some(h => h !== g && hostile(f, h) && hostile(g, h)) || (C.story && C.story.rift >= 0 && C.story.rift !== null);
      d.idle = common ? 0 : (d.idle || 0) + 1;
      if (d.idle > 6 && (g !== C.player || cR() < .5)) { setDip(f, g, 'peace'); addLog('Das Bündnis zwischen ' + empireName(f) + ' und ' + empireName(g) + ' ist erloschen.', f === C.player || g === C.player ? 'bad' : ''); }
      continue;
    }
    if (d.st === 'war') {
      const turns = C.turn - d.since;
      if (r < .7 || (turns > 14 && r < 1.3 && cR() < .3) || (turns > 24 && r < 1.8 && cR() < .2)) { // Sieger beenden lange Kriege nur, wenn kein Durchbruch in Sicht ist
        if (g !== C.player || !cHooks.ask) { if (acceptsPeace(g, f)) makePeace(f, g); }
        else if (!(C.offers || []).some(o => o.from === f) && (d.asked || 0) + 4 <= C.turn) { d.asked = C.turn; (C.offers ||= []).push({ from: f, kind: 'peace' }); }
      }
      continue;
    }
    if (d.st === 'peace') {
      // Bündnis gegen einen gemeinsamen Feind
      if (acceptsAlliance(f, g)) {
        if (g !== C.player || !cHooks.ask) { if (acceptsAlliance(g, f) && cR() < .5) makeAlliance(f, g); }
        else if (!(C.offers || []).some(o => o.from === f) && (d.asked || 0) + 6 <= C.turn) { d.asked = C.turn; (C.offers ||= []).push({ from: f, kind: 'ally' }); }
        continue;
      }
      // Krieg: gemeinsame Grenze, überlegen genug, keine Freundschaft; wer keine wilden Nachbarn mehr hat, wird ungeduldig
      if (d.truce > 0 || !borders(f, g)) continue;
      const wars = others(f).filter(h => hostile(f, h)).length;
      const stuck = !C.provs.some(p => p.owner === f && MAP.provs[p.id].nb.some(n => prov(n).owner === null));
      // Nicht auf einen Gegner einprügeln, der schon im Krieg steht (außer gegen die Führungsmacht)
      const busy = others(g).some(h => h !== f && hostile(g, h)), lead = isLeader(g);
      const duel = others(f).length === 1;
      const need = (duel ? .8 : 1) * D.warRatio * (stuck ? .85 : 1.1) * (1 + wars * .5) * (busy && !lead ? 1.5 : 1) * (lead ? .85 : 1);
      if (r >= need && op < 10 && cR() < (stuck ? .35 : .15)) declareWar(f, g);
    }
  }
}
