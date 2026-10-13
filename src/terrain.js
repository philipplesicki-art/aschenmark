// Gelände im Kampf: Deckung am Waldrand, Schlamm an Tümpeln (Schlachten aus der Kampagne), tiefer Schnee im Hartfrost.
// Reine Simulation: nur Lesen aus G, kein Zufall.
import { G } from './state.js';
import { TS, GW, GH } from './config.js';
import { treeAtCell } from './world.js';

export const COVER = .7, MUD = .7, DEEP_SNOW = .88;
// Deckung: mindestens zwei Bäume in den acht Nachbarfeldern (oder im eigenen Feld)
export function coverAt(x, y) {
  const cx = Math.floor(x / TS), cy = Math.floor(y / TS); let n = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (treeAtCell(cx + i, cy + j) && ++n >= 2) return true;
  return false;
}
// Schlamm: ein Feld neben Wasser
export function mudAt(x, y) {
  if (!G.water) return false;
  const cx = Math.floor(x / TS), cy = Math.floor(y / TS);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = cx + i, yy = cy + j; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && G.water[yy * GW + xx]) return true; }
  return false;
}
// Faktor auf die Geschwindigkeit
export function terrainSpeed(u) {
  let k = 1;
  if (G.battle && G.season === 'frost') k *= DEEP_SNOW;
  if (mudAt(u.x, u.y)) k *= MUD;
  return k;
}
