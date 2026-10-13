// Aufträge: eine Kette je Handlungsfaden. Fortschritt wird aus dem Spielzustand berechnet (nicht mitgezählt),
// deshalb übersteht er Speichern und Laden. Die Simulation bleibt ohne DOM, Meldungen laufen über hooks.
import { G, hooks } from './state.js';
import { popUsed } from './world.js';
import { startEvent } from './events.js';
import { openGate, regionAt } from './regions.js';

const mine = (type, built = true) => G.ents.filter(e => e.team === 0 && !e.dead && e.type === type && (!built || e.kind !== 'bld' || e.built)).length;

// Zielarten: jeweils { cur, max, text }.
const GOALS = {
  build: g => ({ cur: Math.min(g.n, mine(g.t)), max: g.n, text: g.label }),
  have: g => ({ cur: Math.min(g.n, mine(g.t)), max: g.n, text: g.label }),
  troops: g => ({ cur: Math.min(g.n, popUsed(0)), max: g.n, text: g.label }),
  kills: (g, q) => ({ cur: Math.min(g.n, G.kills - q.base.kills), max: g.n, text: g.label }),
  outpostIn: g => ({ cur: Math.min(g.n, G.ents.filter(e => e.team === 0 && !e.dead && e.kind === 'bld' && e.built && e.d.dropoff && regionAt(e.x, e.y) === g.region).length), max: g.n, text: g.label }),
  mine: (g, q) => ({ cur: Math.min(g.n, Math.floor(((G.mined || [0])[0]) - q.base.mined)), max: g.n, text: g.label }),
  reach: g => ({ cur: G.ents.some(e => e.team === 0 && e.kind === 'unit' && !e.dead && Math.hypot(e.x - g.x, e.y - g.y) <= g.r) ? 1 : 0, max: 1, text: g.label }),
  // Ereignis überstehen: erledigt, sobald es vorbei ist und die Burg noch steht.
  event: (g, q) => ({ cur: q.evDone && mine('hq') ? 1 : 0, max: 1, text: g.label }),
};

export const CHAINS = {
  wacht: [
    { id: 'w1', title: 'Fundament', text: 'Die Burg ist alt, die Mauern halten. Es fehlt an allem, was ein Winter verlangt: Hände, Speere und ein Dach über den Vorräten.',
      goals: [{ type: 'build', t: 'barracks', n: 1, label: 'Kaserne bauen' }, { type: 'build', t: 'farm', n: 2, label: 'Zwei Höfe bauen' }, { type: 'troops', n: 12, label: 'Zwölf Truppen unter Waffen' }] },
    { id: 'w2', title: 'Der erste Sturm', text: 'Der Wind dreht. Die alten Wachen sagen, so beginnt es jedes Mal. Haltet die Burg und lasst die Arbeiter nicht im Freien stehen.',
      onStart: () => startEvent('storm'), goals: [{ type: 'event', label: 'Den Sturm überstehen' }] },
    { id: 'w3', title: 'Späher in der Ödnis', text: 'Hinter dem Kamm liegt das Land, das niemand mehr betritt. Schickt jemanden, der zurückkommt.',
      goals: [{ type: 'reach', x: 1500, y: 800, r: 140, label: 'Die Ödnis im Nordosten erreichen' }] },
    { id: 'w4', title: 'Feuer am Horizont', text: 'Der Rauch am Horizont kommt nicht vom Winter. Zeigt den Fremden, dass die Grenzmark nicht leer ist.',
      goals: [{ type: 'build', t: 'tower', n: 2, label: 'Zwei Wachtürme bauen' }, { type: 'kills', n: 8, label: 'Acht Feinde besiegen' }] },
    { id: 'w5', title: 'Der Moorpfad', text: 'Im Süden fällt der Grat ab. Dort, sagen die Alten, lag einmal ein Weg. Findet ihn, bevor die Vorräte reichen müssen, die wir nicht haben.',
      goals: [{ type: 'reach', x: 560, y: 1700, r: 150, label: 'Den Moorpfad erreichen' }], onDone: () => openGate('moor') },
    { id: 'w6', title: 'Land unter dem Nebel', text: 'Der Pfad ist frei. Was dahinter liegt, kennt niemand, der noch lebt. Schickt Späher ins Sumpfland.',
      goals: [{ type: 'reach', x: 600, y: 2250, r: 160, label: 'Das Sumpfland erreichen' }] },
    { id: 'w7', title: 'Vorposten im Moor', text: 'Wer das Moor nicht hält, den holt es sich. Baut einen Vorposten dort, wo die Erde schwarz ist und das Erz nah liegt, und lasst das Feuer nie ausgehen.',
      goals: [{ type: 'outpostIn', region: 'sumpf', n: 1, label: 'Vorposten im Sumpfland bauen' }] },
    { id: 'w8', title: 'Das Wasser steigt', text: 'Die Gräben laufen über, das Eis bricht von unten. Die Alten sagen, das Moor atmet ein. Haltet die Mauern trocken, bis es wieder ausatmet.',
      onStart: () => startEvent('flood'), goals: [{ type: 'event', label: 'Die Flut überstehen' }] },
    { id: 'w9', title: 'Erz aus schwarzer Erde', text: 'Die Schmiede frisst mehr, als der Fels hergibt. Holt das Erz aus dem Moor, ehe der Frost die Wege schließt und die Burg mit leeren Händen dasteht.',
      goals: [{ type: 'mine', n: 800, label: 'Achthundert Erz fördern' }] },
    { id: 'w10', title: 'Der Küstenweg', text: 'Ein Händler, halb erfroren, spricht von einem Weg nach Südosten, der zum Meer führt. Älter als die Burg, sagt er, und nicht leer. Findet ihn.',
      goals: [{ type: 'reach', x: 1980, y: 1700, r: 150, label: 'Den Küstenweg erreichen' }], onDone: () => openGate('kueste') },
    { id: 'w11', title: 'Salz und Nebel', text: 'Am Strand liegen Boote, kieloben, mit Raureif bedeckt. Keine Toten, keine Spuren. Wer hier lebte, ist gegangen, oder er wartet noch.',
      goals: [{ type: 'reach', x: 2300, y: 2250, r: 170, label: 'Die Küste erreichen' }] },
    { id: 'w12', title: 'Die Südgrenze', text: 'Ein Vorposten an der Küste, und der Nebel kommt. Was ihr hier haltet, ist nicht mehr die Grenzmark. Es ist der Rand von Orsa, und er gehört dem, der bleibt.',
      onStart: () => startEvent('saltfog'), goals: [{ type: 'outpostIn', region: 'kueste', n: 1, label: 'Vorposten an der Küste bauen' }, { type: 'event', label: 'Den Salznebel überstehen' }] },
  ],
  asch: [
    { id: 'a1', title: 'Glut im Winter', text: 'Die Feuer müssen brennen, sonst stirbt der Stamm. Baut die Halle, füllt die Pferche.',
      goals: [{ type: 'build', t: 'barracks', n: 1, label: 'Kriegshalle bauen' }, { type: 'build', t: 'farm', n: 2, label: 'Zwei Pferche bauen' }, { type: 'troops', n: 12, label: 'Zwölf Krieger unter Waffen' }] },
    { id: 'a2', title: 'Der Aschenregen', text: 'Die Berge husten wieder. Für die anderen ist es das Ende, für uns ist es Heimat. Haltet die Feste.',
      onStart: () => startEvent('ash'), goals: [{ type: 'event', label: 'Den Aschenregen überstehen' }] },
    { id: 'a3', title: 'Der Kamm', text: 'Im Westen liegt, was einmal unser war. Schickt Späher, bevor die Ersten dorthin gehen.',
      goals: [{ type: 'reach', x: 1100, y: 1000, r: 140, label: 'Die Westhänge erreichen' }] },
    { id: 'a4', title: 'Fremde Fahnen', text: 'Fremde Fahnen auf unserem Grund. Zeigt ihnen, was die Asche lehrt.',
      goals: [{ type: 'build', t: 'tower', n: 2, label: 'Zwei Gluttürme bauen' }, { type: 'kills', n: 8, label: 'Acht Feinde besiegen' }] },
    { id: 'a5', title: 'Der Ostpass', text: 'Im Osten liegt der Grat, den unsere Vorfahren nie überschritten. Das Feuer braucht neues Holz.',
      goals: [{ type: 'reach', x: 2500, y: 900, r: 150, label: 'Den Ostpass erreichen' }], onDone: () => openGate('ost') },
    { id: 'a6', title: 'Trockenes Land', text: 'Dahinter ist Staub und weiter Himmel. Findet heraus, wem es gehört.',
      goals: [{ type: 'reach', x: 3300, y: 900, r: 170, label: 'Das Trockenland erreichen' }] },
    { id: 'a7', title: 'Glut im Staub', text: 'Ein Lager, wo das Land trocken ist und niemand mehr Wache hält. Das Feuer nimmt, was es findet, und gibt nichts zurück.',
      goals: [{ type: 'outpostIn', region: 'trocken', n: 1, label: 'Glutlager im Trockenland bauen' }] },
    { id: 'a8', title: 'Der gelbe Wind', text: 'Der Staub kommt aus dem Osten und frisst die Sicht. Die Fremden verirren sich darin. Wir sind im Rauch geboren, uns schreckt kein Staub.',
      onStart: () => startEvent('dust'), goals: [{ type: 'event', label: 'Den Staubsturm überstehen' }] },
    { id: 'a9', title: 'Hunger der Esse', text: 'Die Essen brüllen, und die Berge geben nichts mehr her. Das Trockenland muss liefern, sonst werden die Schmieden kalt, und kalte Schmieden sind ein Tod, den der Stamm nicht kennt.',
      goals: [{ type: 'mine', n: 800, label: 'Achthundert Erz fördern' }] },
    { id: 'a10', title: 'Der Weg zum Meer', text: 'Im Süden fällt das Land ab. Die Alten erzählten von Wasser, das nicht brennt und nicht friert. Findet den Weg, damit der Stamm es mit eigenen Augen sieht.',
      goals: [{ type: 'reach', x: 1980, y: 1700, r: 150, label: 'Den Küstenweg erreichen' }], onDone: () => openGate('kueste') },
    { id: 'a11', title: 'Salz auf den Lippen', text: 'Das Meer ist grau und kalt und gehört niemandem. Am Ufer stehen Türme ohne Feuer. Jemand hat sie gebaut, und jemand wird sie vermissen.',
      goals: [{ type: 'reach', x: 2300, y: 2250, r: 170, label: 'Die Küste erreichen' }] },
    { id: 'a12', title: 'Fahnen im Nebel', text: 'Fremde Fahnen an der Küste, im Nebel kaum zu sehen. Errichtet ein Glutlager am Ufer und zeigt ihnen, wem das Wasser gehört, wenn der Nebel reißt.',
      onStart: () => startEvent('saltfog'), goals: [{ type: 'outpostIn', region: 'kueste', n: 1, label: 'Glutlager an der Küste bauen' }, { type: 'event', label: 'Den Salznebel überstehen' }] },
  ],
  salz: [
    { id: 's1', title: 'Gestrandet', text: 'Die Boote liegen zerschlagen im Schnee, das Meer ist drei Tagesmärsche fern. Baut eine Bootshalle, räuchert, was der Fang noch hergibt, und stellt Wachen auf.',
      goals: [{ type: 'build', t: 'barracks', n: 1, label: 'Bootshalle bauen' }, { type: 'build', t: 'farm', n: 2, label: 'Zwei Räuchereien bauen' }, { type: 'troops', n: 12, label: 'Zwölf Hände unter Waffen' }] },
    { id: 's2', title: 'Fremder Winter', text: 'Der Wind hier schmeckt nicht nach Salz, sondern nach Eisen. Ein Sturm kommt über den Kamm. Haltet die Leuchtfeste, bis er weiterzieht.',
      onStart: () => startEvent('storm'), goals: [{ type: 'event', label: 'Den Sturm überstehen' }] },
    { id: 's3', title: 'Der Wald, der rauscht', text: 'Das Waldmeer klingt wie Brandung, sagen die Kinder. Schickt Späher hinein und findet heraus, wer darin wohnt.',
      goals: [{ type: 'reach', x: 1250, y: 1450, r: 150, label: 'Den Rand des Waldmeers erkunden' }] },
    { id: 's4', title: 'Alte Herren', text: 'Rauch im Osten, Fahnen im Norden. Dieses Land hat schon Herren, und keiner von ihnen hat uns gerufen. Zündet die Leuchttürme an, damit sie sehen, dass wir bleiben.',
      goals: [{ type: 'build', t: 'tower', n: 2, label: 'Zwei Leuchttürme bauen' }, { type: 'kills', n: 8, label: 'Acht Feinde besiegen' }] },
    { id: 's5', title: 'Der Ruf des Wassers', text: 'Maren hört das Meer im Schlaf. Im Südosten, sagt sie, führt ein Weg hinunter, so alt wie unsere Lieder.',
      goals: [{ type: 'reach', x: 1980, y: 1700, r: 150, label: 'Den Küstenweg erreichen' }], onDone: () => openGate('kueste') },
    { id: 's6', title: 'Heimkehr', text: 'Grauer Strand, schwarze Klippen, und auf der höchsten steht ein Turm ohne Licht. Unsere Großmütter haben ihn gebaut.',
      goals: [{ type: 'reach', x: 2300, y: 2250, r: 170, label: 'Die Küste erreichen' }] },
    { id: 's7', title: 'Salz in der Hand', text: 'Ein Lager am Ufer, Salz in den Fässern, Feuer im Turm. Wer am Meer Wurzeln schlägt, braucht keine Mauern, nur Geduld.',
      goals: [{ type: 'outpostIn', region: 'kueste', n: 1, label: 'Salzlager an der Küste bauen' }] },
    { id: 's8', title: 'Der weiße Atem', text: 'Der Nebel steigt aus dem Wasser wie in den alten Liedern. Für die anderen ist er Blindheit, für uns ein Mantel. Haltet aus, bis er sich hebt.',
      onStart: () => startEvent('saltfog'), goals: [{ type: 'event', label: 'Den Salznebel überstehen' }] },
    { id: 's9', title: 'Eisen für die Werft', text: 'Die Werft braucht Eisen für Nägel, Anker und Ketten. Fördert Erz, bis die ersten Kiele auf den Hellingen liegen.',
      goals: [{ type: 'mine', n: 800, label: 'Achthundert Erz fördern' }] },
    { id: 's10', title: 'Der Ostpass', text: 'Händler aus dem Osten zahlten einst in Salz. Der Pass, über den sie kamen, ist verschüttet. Grabt ihn frei.',
      goals: [{ type: 'reach', x: 2500, y: 900, r: 150, label: 'Den Ostpass erreichen' }], onDone: () => openGate('ost') },
    { id: 's11', title: 'Staub statt Salz', text: 'Dahinter liegt ein Land ohne Wasser, nur Wind und Knochen. Doch wo kein Wasser ist, wiegt Salz so viel wie Gold.',
      goals: [{ type: 'reach', x: 3300, y: 900, r: 170, label: 'Das Trockenland erreichen' }] },
    { id: 's12', title: 'Das letzte Leuchtfeuer', text: 'Ein Salzlager im Trockenland, und der gelbe Wind soll kommen. Wenn das Feuer auch dort brennt, reicht unser Licht von Meer zu Meer.',
      onStart: () => startEvent('dust'), goals: [{ type: 'outpostIn', region: 'trocken', n: 1, label: 'Salzlager im Trockenland bauen' }, { type: 'event', label: 'Den Staubsturm überstehen' }] },
  ],
};

// Enden der Handlungsfäden, gezeigt nach dem letzten Auftrag.
export const ENDINGS = {
  wacht: { title: 'Die Grenze hält', text: [
    'Vom Moor bis zur Küste brennen die Feuer der Grenzwacht. Zum ersten Mal seit Menschengedenken ist die Grenzmark größer als der Winter.',
    'Doch weit draußen auf dem Meer hat jemand die Feuer gesehen und mit einem eigenen Licht geantwortet.'] },
  asch: { title: 'Die Glut wandert', text: [
    'Die Essen der Aschenhorde brennen im Staub des Ostens und am Salz des Südens. Kein Winter hat den Stamm gebrochen.',
    'Doch die Asche, die aus den Bergen fällt, wird dichter. Etwas unter dem Fels ist wach, und es ist hungriger als jede Esse.'] },
  salz: { title: 'Licht von Meer zu Meer', text: [
    'Die alten Türme brennen wieder, vom grauen Strand bis in den Staub des Ostens. Der Salzbund hat einen Hafen, und er hat ihn sich selbst gebaut.',
    'Maren hört das Meer nicht mehr im Schlaf. Sie hört etwas anderes, tiefer unter dem Wasser, und es kennt ihren Namen.'] }
};

export function initQuests(chain) {
  G.quest = chain && CHAINS[chain] ? { chain, i: -1, base: { kills: 0 }, evDone: false, done: [], finished: false } : null;
  if (G.quest) nextQuest();
}

function nextQuest() {
  const q = G.quest; q.i++;
  const def = CHAINS[q.chain][q.i];
  if (!def) { q.finished = true; hooks.toast('Alle Aufträge erfüllt', 'good'); hooks.chainDone && hooks.chainDone(); return; }
  q.base = { kills: G.kills, mined: (G.mined || [0])[0] }; q.evDone = false; q.evStarted = false;
  if (def.onStart) def.onStart();
  hooks.toast('Auftrag: ' + def.title, 'good');
}

export const currentQuest = () => (G && G.quest && !G.quest.finished ? CHAINS[G.quest.chain][G.quest.i] : null);

export function questProgress() {
  const def = currentQuest(); if (!def) return null;
  return { def, goals: def.goals.map(g => GOALS[g.type](g, G.quest)) };
}

export function updQuests() {
  const q = G.quest; if (!q || q.finished) return;
  const def = currentQuest();
  if (def.goals.some(g => g.type === 'event') && G.ev) {
    if (G.ev.id) q.evStarted = true; else if (q.evStarted) q.evDone = true;
  }
  const pr = questProgress();
  if (pr.goals.every(g => g.cur >= g.max)) {
    if (def.onDone) def.onDone();
    q.done.push(def.id); hooks.sfx('done'); hooks.toast('Auftrag erfüllt: ' + def.title, 'good');
    nextQuest();
  }
}
