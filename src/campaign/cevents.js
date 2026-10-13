// Ereignisse der Kampagne: je Runde und Reich mit einer gewissen Wahrscheinlichkeit, oft mit einer Entscheidung.
// Der Spieler entscheidet im Dialog (C.events), die KI (und Kampagnen ohne Oberfläche) sofort nach ai().
import { C, MAP, cR, cHooks, addLog, prov, pinfo, armiesAt, unitCount, season, mkArmy, empireName, heroCap } from './cstate.js';
import { FACTIONS, FAC_IDS } from '../factions.js';

const own = f => C.provs.filter(p => p.owner === f);
const pick = list => list[Math.floor(cR() * list.length)];
const lose = (units, k) => { for (const r of Object.keys(units)) units[r] -= Math.round(units[r] * k); };
const pn = ev => pinfo(ev.prov).name;
const hero = f => FACTIONS[f].units.hero.name;

// opts: Wahlmöglichkeiten; can(f, ev) sperrt eine Wahl (zu teuer), ai(f, ev) wählt für die KI.
export const CEVENTS = {
  harvest: { w: 3, when: f => season().id === 'thaw' || season().id === 'chill', title: 'Reiche Ernte',
    text: f => 'Die Speicher quellen über. Bauern bringen mehr, als erwartet war.',
    opts: [{ label: 'Einlagern', desc: 'Vorräte plus 120 und 15 je Provinz', apply: f => { C.emp[f].food += 120 + 15 * own(f).length; } }] },
  blight: { w: 2, when: f => C.emp[f].food > 300, title: 'Mehltau',
    text: f => 'Fäulnis frisst sich durch die Kornspeicher. Ein Viertel der Vorräte droht zu verderben.',
    opts: [{ label: 'Hinnehmen', desc: 'Ein Viertel der Vorräte verdirbt', apply: f => { C.emp[f].food *= .75; } },
      { label: 'Salz und Rauch kaufen', desc: '120 Erz, die Vorräte bleiben', can: f => C.emp[f].ore >= 120, apply: f => { C.emp[f].ore -= 120; } }],
    ai: f => (C.emp[f].ore > 400 ? 1 : 0) },
  vein: { w: 2, when: f => own(f).length > 1, setup: f => ({ prov: pick(own(f)).id }), title: 'Neue Erzader',
    text: (f, ev) => 'Bergleute in ' + pn(ev) + ' sind auf eine reiche Ader gestoßen.',
    opts: [{ label: 'Abbauen', desc: 'Die Provinz bringt dauerhaft 15 Erz mehr', apply: (f, ev) => { const p = prov(ev.prov); p.bonus = { ...p.bonus, ore: ((p.bonus && p.bonus.ore) || 0) + 15 }; } }] },
  plague: { w: 2, when: f => own(f).some(p => armiesAt(p.id).some(a => a.owner === f && unitCount(a.units) >= 4)),
    setup: f => ({ prov: pick(own(f).filter(p => armiesAt(p.id).some(a => a.owner === f && unitCount(a.units) >= 4))).id }), title: 'Seuche im Heerlager',
    text: (f, ev) => 'In ' + pn(ev) + ' grassiert das Lagerfieber. Die Feldscher sind ratlos.',
    opts: [{ label: 'Abwarten', desc: 'Ein Fünftel der Truppen dort stirbt', apply: (f, ev) => { for (const a of armiesAt(ev.prov)) if (a.owner === f) lose(a.units, .2); } },
      { label: 'Heilkundige holen', desc: '150 Vorräte und 80 Erz, nur ein Zwanzigstel stirbt', can: f => C.emp[f].food >= 150 && C.emp[f].ore >= 80,
        apply: (f, ev) => { C.emp[f].food -= 150; C.emp[f].ore -= 80; for (const a of armiesAt(ev.prov)) if (a.owner === f) lose(a.units, .05); } }],
    ai: f => (C.emp[f].ore > 300 && C.emp[f].food > 400 ? 1 : 0) },
  bandits: { w: 2, when: f => own(f).some(p => !armiesAt(p.id).some(a => a.owner === f) && p.id !== C.emp[f].capital),
    setup: f => ({ prov: pick(own(f).filter(p => !armiesAt(p.id).some(a => a.owner === f) && p.id !== C.emp[f].capital)).id }), title: 'Räuberbande',
    text: (f, ev) => 'Eine Räuberbande plündert die Höfe um ' + pn(ev) + ' und verlangt Schutzgeld.',
    opts: [{ label: 'Nicht zahlen', desc: 'Die Provinz gerät in Unruhe (4 Runden)', apply: (f, ev) => { const p = prov(ev.prov); p.unrest = Math.max(p.unrest || 0, 4); } },
      { label: 'Zahlen', desc: '100 Erz', can: f => C.emp[f].ore >= 100, apply: f => { C.emp[f].ore -= 100; } }],
    ai: f => (C.emp[f].ore > 350 ? 1 : 0) },
  scholar: { w: 2, when: f => !!C.emp[f].research, title: 'Wandernder Gelehrter',
    text: f => 'Ein Gelehrter aus dem Süden bietet seine Schriften an.',
    opts: [{ label: 'Abweisen', desc: 'Nichts geschieht', apply: () => {} },
      { label: 'Aufnehmen', desc: '120 Erz, die laufende Forschung kommt 4 Punkte voran', can: f => C.emp[f].ore >= 120, apply: f => { C.emp[f].ore -= 120; if (C.emp[f].research) C.emp[f].research.prog += 4; } }],
    ai: f => (C.emp[f].ore > 300 ? 1 : 0) },
  mercs: { w: 2, when: f => C.emp[f].capital >= 0, title: 'Söldner',
    text: f => 'Eine Söldnerschar bietet ihre Dienste an: sechs Fußkämpfer und zwei Reiter, kampferprobt.',
    opts: [{ label: 'Ablehnen', desc: 'Sie ziehen weiter', apply: () => {} },
      { label: 'Anwerben', desc: '320 Erz; die Truppe steht sofort in der Hauptstadt', can: f => C.emp[f].ore >= 320, apply: f => { C.emp[f].ore -= 320; mkArmy(f, C.emp[f].capital, { melee: 6, cav: 2 }); } }],
    ai: f => (C.emp[f].ore > 900 ? 1 : 0) },
  feast: { w: 2, when: f => season().id === 'frost' && own(f).some(p => p.unrest > 0), title: 'Mittwinterfest',
    text: f => 'Das Volk erwartet zur längsten Nacht ein Fest. Unruhige Provinzen könnten sich beruhigen.',
    opts: [{ label: 'Kein Fest', desc: 'Nichts geschieht', apply: () => {} },
      { label: 'Feiern lassen', desc: '150 Vorräte; Unruhe überall 3 Runden kürzer', can: f => C.emp[f].food >= 150, apply: f => { C.emp[f].food -= 150; for (const p of own(f)) if (p.unrest > 0) p.unrest = Math.max(0, p.unrest - 3); } }],
    ai: f => (C.emp[f].food > 400 ? 1 : 0) },
  refugees: { w: 1, when: f => own(f).some(p => p.lvl < 3 && !p.queue), setup: f => ({ prov: pick(own(f).filter(p => p.lvl < 3 && !p.queue)).id }), title: 'Flüchtlinge',
    text: (f, ev) => 'Flüchtlinge aus den Kriegsgebieten bitten um Aufnahme in ' + pn(ev) + '.',
    opts: [{ label: 'Abweisen', desc: 'Nichts geschieht', apply: () => {} },
      { label: 'Aufnehmen', desc: '120 Vorräte; die Siedlung wächst sofort um eine Stufe', can: f => C.emp[f].food >= 120, apply: (f, ev) => { C.emp[f].food -= 120; prov(ev.prov).lvl++; } }],
    ai: f => (C.emp[f].food > 300 ? 1 : 0) },
  duel: { w: 1, when: f => C.armies.some(a => a.owner === f && a.hero) && C.emp[f].heroLvl < heroCap(f), title: 'Herausforderung',
    text: f => 'Ein berüchtigter Kämpe fordert ' + hero(f) + ' zum Zweikampf. Ruhm oder Wunden warten.',
    opts: [{ label: 'Ablehnen', desc: 'Nichts geschieht', apply: () => {} },
      { label: 'Annehmen', desc: 'Meist viel Erfahrung, manchmal drei Runden verwundet', apply: f => {
        const e = C.emp[f];
        if (cR() < .7) { e.heroXp += 110; if (f === C.player) addLog(hero(f) + ' siegt im Zweikampf.', 'good'); }
        else { const a = C.armies.find(x => x.owner === f && x.hero); if (a) a.hero = false; e.heroDown = 3; if (f === C.player) addLog(hero(f) + ' unterliegt und ist verwundet.', 'bad'); }
      } }],
    ai: f => (cR() < .6 ? 1 : 0) },
  caravan: { w: 2, when: f => C.emp[f].food >= 250, title: 'Händlerzug',
    text: f => 'Ein Händlerzug aus dem Salzland bietet Erz gegen Vorräte.',
    opts: [{ label: 'Ablehnen', desc: 'Nichts geschieht', apply: () => {} },
      { label: 'Tauschen', desc: '250 Vorräte gegen 200 Erz', apply: f => { C.emp[f].food -= 250; C.emp[f].ore += 200; } }],
    ai: f => (C.emp[f].food > 700 ? 1 : 0) }
};
const IDS = Object.keys(CEVENTS);
export const EVENT_CHANCE = .14;

// Einmal je Runde und Reich würfeln. Gibt das Ereignis zurück (für Tests).
export function rollEvent(f) {
  if (!C.emp[f].alive || !own(f).length || cR() >= EVENT_CHANCE) return null;
  const ok = IDS.filter(id => CEVENTS[id].when(f)); if (!ok.length) return null;
  let r = cR() * ok.reduce((n, id) => n + CEVENTS[id].w, 0), id = ok[0];
  for (const k of ok) { r -= CEVENTS[k].w; if (r < 0) { id = k; break; } }
  const ev = { id, f, turn: C.turn, ...(CEVENTS[id].setup ? CEVENTS[id].setup(f) : {}) };
  if (f === C.player && cHooks.ask && CEVENTS[id].opts.length > 1) (C.events ||= []).push(ev);
  else resolveEvent(ev, CEVENTS[id].ai ? CEVENTS[id].ai(f, ev) : 0);
  return ev;
}
export const optOk = (ev, i) => { const o = CEVENTS[ev.id].opts[i]; return !!o && (!o.can || o.can(ev.f, ev)); };
export function resolveEvent(ev, i) {
  const E = CEVENTS[ev.id]; if (!optOk(ev, i)) i = 0;
  E.opts[i].apply(ev.f, ev);
  if (ev.f === C.player) addLog(E.title + ': ' + E.opts[i].label + (E.opts.length > 1 ? '' : ' (' + E.opts[i].desc + ')'), '');
  C.events = (C.events || []).filter(x => x !== ev);
}
export const eventText = ev => CEVENTS[ev.id].text(ev.f, ev);
export function rollEvents() { for (const f of FAC_IDS) rollEvent(f); }
