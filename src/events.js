// Naturereignisse. Jedes Ereignis hat drei Phasen: Vorzeichen, Höhepunkt, Abklingen.
// Die Wirkung hängt an G.ev.k (0 bis 1), die Darstellung liest G.ev.id und G.ev.k.
// Die Simulation bleibt ohne DOM; Zufall kommt aus simR, damit der Seed den Verlauf festlegt.
import { G, hooks, simR } from './state.js';
import { regionAt, REGIONS } from './regions.js';

export const EVENTS = {
  storm: {
    id: 'storm', name: 'Schneesturm', omen: 'Der Wind dreht, der Himmel wird weiß', peak: 'Schneesturm! Sicht und Tempo sinken', end: 'Der Sturm legt sich',
    omenT: 18, peakT: [40, 70], fadeT: 14,
    reg: ['grenz', 'wald'], sight: .6, spd: { wacht: .85, asch: .7, salz: .75 }, gather: .75
  },
  ash: {
    id: 'ash', name: 'Ascheregen', omen: 'Der Himmel im Osten färbt sich grau', peak: 'Ascheregen! Die Luft ist schwer', end: 'Die Asche sinkt',
    omenT: 18, peakT: [40, 60], fadeT: 14,
    reg: ['asch', 'wald'], sight: .5, spd: { wacht: .8, asch: 1.05, salz: .8 }, gather: .85
  },
  dust: {
    id: 'dust', name: 'Staubsturm', omen: 'Der Horizont wird gelb, der Wind trägt Sand', peak: 'Staubsturm! Nichts ist mehr zu sehen', end: 'Der Staub legt sich',
    omenT: 16, peakT: [35, 55], fadeT: 12,
    reg: ['trocken'], sight: .5, spd: { wacht: .85, asch: .9, salz: .8 }, gather: .8
  },
  flood: {
    id: 'flood', name: 'Flut', omen: 'Das Wasser steigt in den Gräben', peak: 'Die Flut kommt! Wege stehen unter Wasser', end: 'Das Wasser sinkt',
    omenT: 20, peakT: [45, 70], fadeT: 18,
    reg: ['sumpf'], sight: .8, spd: { wacht: .6, asch: .6, salz: .85 }, gather: .7
  },
  saltfog: {
    id: 'saltfog', name: 'Salznebel', omen: 'Weißer Dunst zieht vom Meer herauf', peak: 'Salznebel! Man sieht kaum zehn Schritt', end: 'Der Nebel reißt auf',
    omenT: 14, peakT: [40, 60], fadeT: 14,
    reg: ['kueste'], sight: .35, spd: { wacht: .95, asch: .95, salz: 1.1 }, gather: .9
  }
};
const LIST = Object.keys(EVENTS);

export function initEvents() {
  G.ev = { id: null, ph: 'none', t: 0, dur: 0, k: 0, next: 150 + simR() * 90, count: 0 };
}

// Ein Ereignis sofort starten (für Aufträge und Tests).
export function startEvent(id) {
  const d = EVENTS[id]; if (!d) return false;
  G.ev.id = id; G.ev.ph = 'omen'; G.ev.t = 0; G.ev.dur = d.omenT; G.ev.k = 0; G.ev.count++;
  hooks.toast(d.omen + ' (' + REGIONS[d.reg[0]].name + ')', 'bad'); hooks.sfx('alarm');
  return true;
}

export function updEvents(dt) {
  const ev = G.ev; if (!ev) return;
  if (ev.ph === 'none') {
    ev.next -= dt;
    if (ev.next <= 0) {
      // nur Ereignisse in Gebieten, die schon offen sind
      const ok = LIST.filter(id => EVENTS[id].reg.some(r => G.regions[r]));
      startEvent(ok[(simR() * ok.length) | 0]);
    }
    return;
  }
  const d = EVENTS[ev.id];
  ev.t += dt;
  if (ev.ph === 'omen') ev.k = .25 * Math.min(1, ev.t / ev.dur);
  else if (ev.ph === 'peak') ev.k = 1;
  else ev.k = 1 - Math.min(1, ev.t / ev.dur);
  if (ev.t < ev.dur) return;
  if (ev.ph === 'omen') { ev.ph = 'peak'; ev.t = 0; ev.dur = d.peakT[0] + simR() * (d.peakT[1] - d.peakT[0]); hooks.toast(d.peak, 'bad'); }
  else if (ev.ph === 'peak') { ev.ph = 'fade'; ev.t = 0; ev.dur = d.fadeT; hooks.toast(d.end, 'good'); }
  else { ev.id = null; ev.ph = 'none'; ev.k = 0; ev.next = 180 + simR() * 120; }
}

// Wirkung auf Einheiten und Sicht (1 = unverändert). Nur Wesen im betroffenen Gebiet spüren sie.
const mix = (m, k) => 1 + (m - 1) * k;
const hit = e => { const ev = G && G.ev; return !!(ev && ev.id && EVENTS[ev.id].reg.includes(regionAt(e.x, e.y))); };
export function evSpeed(u) { return hit(u) ? mix(EVENTS[G.ev.id].spd[u.fac] ?? 1, G.ev.k) : 1; }
export function evSight(e) { return e && hit(e) ? mix(EVENTS[G.ev.id].sight, G.ev.k) : 1; }
export function evGather(u) { return hit(u) ? mix(EVENTS[G.ev.id].gather, G.ev.k) : 1; }
// Stärke des Wetters an einem Ort (für die Darstellung).
export function evAt(x, y) { const ev = G && G.ev; return ev && ev.id && EVENTS[ev.id].reg.includes(regionAt(x, y)) ? ev.k : 0; }
