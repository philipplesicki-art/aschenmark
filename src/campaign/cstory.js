// Handlungsbogen der Kampagne: "Das Erwachen".
// Akt I: fünf Kapitel je Fraktion (für den Spieler) mit Zielen und Belohnungen. Akt II: Vorzeichen. Akt III: Ein Schlund bricht im
// Gebirge auf, die Erwachten (Wilde unter Besitzer 'wild') ziehen gegen alle Reiche, bis jemand den Schlund erobert und drei Runden hält.
// Zustand in C.story (gespeichert). Erzähltexte warten für den Spieler in C.story.msgs.
import { C, MAP, cR, cHooks, addLog, prov, pinfo, armiesAt, unitCount, mkArmy, orderMove, empireName, hostile, dipOf } from './cstate.js';
import { FACTIONS, FAC_IDS } from '../factions.js';
import { CTECH } from './ctech.js';

const own = f => C.provs.filter(p => p.owner === f);
const tell = (title, text, kind = 'story') => { if (cHooks.ask) (C.story.msgs ||= []).push({ title, text, kind }); };
const give = (f, r) => { const e = C.emp[f]; for (const k of ['ore', 'wood', 'food']) if (r[k]) e[k] += r[k]; };
const grantTech = (f, id) => { const e = C.emp[f]; if (e.ctech[id]) return false; e.ctech[id] = 1; for (const [k, lv] of Object.entries(CTECH[id].rts || {})) e.tech[k] = Math.max(e.tech[k] || 0, lv); return true; };
const sealedOrOpen = () => C.story.rift !== null && C.story.rift !== undefined;

// Gemeinsame Kapitel 4 und 5 (Akt III)
const fightAwakened = { title: 'Asche im Wind', goal: 'Ein Heer der Erwachten besiegen', when: () => sealedOrOpen(),
  done: f => (C.story.awkKills && C.story.awkKills[f]) > 0, reward: f => { C.emp[f].heroXp += 150; give(f, { ore: 300 }); }, rewardText: '150 Erfahrung für den Helden, 300 Erz' };
const sealRift = text => ({ title: 'Den Schlund versiegeln', goal: 'Den Schlund erobern und drei Runden halten', when: () => sealedOrOpen(),
  done: f => C.story.sealedBy === f, reward: f => { C.emp[f].sealed = true; give(f, { ore: 800, wood: 500, food: 600 }); }, rewardText: 'Ruhm in ganz Orsa: Heere dauerhaft 15 Prozent stärker, 800 Erz, 500 Holz, 600 Vorräte', text });

export const CHAPTERS = {
  wacht: [
    { title: 'Die Feuer der Mark', text: 'Die Grenzmark ist mehr als eine Burg. Entzündet die Signalfeuer auf den Hügeln ringsum, damit jeder weiß, wem dieses Land gehört.',
      goal: 'Sechs Provinzen halten', done: f => own(f).length >= 6, reward: f => give(f, { ore: 200, wood: 300 }), rewardText: '200 Erz, 300 Holz' },
    { title: 'Steinerne Wacht', text: 'Holz brennt, Stein nicht. Die Alten verlangen Mauern um jede Siedlung, die den Winter überdauern soll.',
      goal: 'Mauern Stufe 2 in drei Provinzen', done: f => own(f).filter(p => (p.blds.walls || 0) >= 2).length >= 3,
      reward: f => { if (!grantTech(f, 'masonry')) give(f, { ore: 400 }); }, rewardText: 'Die Steinmetze der Mark lehren ihr Handwerk (Forschung Steinmetze)' },
    { title: 'Das Licht auf dem Meer', text: 'Draußen auf dem Wasser hat jemand unsere Feuer gesehen und geantwortet. Erreicht die Küste und findet heraus, wer.',
      goal: 'Eine Küstenprovinz besitzen', done: f => own(f).some(p => pinfo(p.id).biome === 'kueste'),
      reward: f => { give(f, { food: 400 }); const s = C.emp.salz; if (s && s.alive) { s.op ||= {}; s.op[f] = (s.op[f] || 0) + 30; } }, rewardText: '400 Vorräte, der Salzbund ist dir gewogener' },
    fightAwakened,
    sealRift('Die Feuer der Grenzwacht brennen auf dem Rand des Schlundes. Was darunter schläft, schläft wieder, und die Mark hält Wacht.')
  ],
  asch: [
    { title: 'Glut nährt Glut', text: 'Die Horde wächst nur, wenn sie nimmt. Holt euch, was andere nicht halten können.',
      goal: 'Drei Provinzen erobern', done: f => (C.story.caps && C.story.caps[f] || 0) >= 3, reward: f => give(f, { ore: 300, food: 200 }), rewardText: '300 Erz, 200 Vorräte' },
    { title: 'Die Essen schüren', text: 'Der Fels gibt Eisen, wenn man ihn zwingt. Mehr Gruben, heißere Essen, schärfere Klingen.',
      goal: 'Drei Bergwerke der Stufe 2', done: f => own(f).filter(p => (p.blds.mine || 0) >= 2).length >= 3,
      reward: f => { if (!grantTech(f, C.emp[f].ctech.arms1 ? 'arms2' : 'arms1')) give(f, { ore: 500 }); }, rewardText: 'Die Schmiede finden ein neues Härteverfahren (Waffenforschung)' },
    { title: 'Das Flüstern im Fels', text: 'Die Ältesten hören nachts ein Klopfen unter den Bergen. Geht hinauf und lauscht selbst.',
      goal: 'Eine Bergprovinz besitzen', done: f => own(f).some(p => pinfo(p.id).biome === 'berg'), reward: f => { C.emp[f].heroXp += 80; give(f, { food: 300 }); }, rewardText: '80 Erfahrung für den Helden, 300 Vorräte' },
    fightAwakened,
    sealRift('Die Horde hat das Feuer unter dem Berg gesehen und ist nicht gewichen. Die Glut gehört wieder denen, die sie schüren.')
  ],
  salz: [
    { title: 'Häfen und Händler', text: 'Ein Bund lebt vom Handel. Baut Märkte, damit Salz und Silber durch eure Städte fließen.',
      goal: 'Zwei Märkte bauen', done: f => own(f).filter(p => p.blds.market).length >= 2, reward: f => give(f, { ore: 400 }), rewardText: '400 Erz' },
    { title: 'Das Salzrecht', text: 'Wer das Salz hält, hält die Vorräte des Winters. Sichert euch die Küste oder den großen Salzsee.',
      goal: 'Den Salzsee oder drei Küstenprovinzen besitzen', done: f => own(f).some(p => p.site === 'saltlake') || own(f).filter(p => pinfo(p.id).biome === 'kueste').length >= 3,
      reward: f => { if (!grantTech(f, 'coin')) give(f, { ore: 400 }); give(f, { food: 300 }); }, rewardText: 'Münzwesen wird eingeführt, 300 Vorräte' },
    { title: 'Antwort der Feuer', text: 'Im Norden brennen Feuer. Ein Bund ohne Verbündete ist nur ein Name. Findet jemanden, der an eurer Seite steht.',
      goal: 'Ein Bündnis schließen', done: f => FAC_IDS.some(g => g !== f && dipOf(f, g) && dipOf(f, g).st === 'ally'),
      reward: f => { if (C.emp[f].research) C.emp[f].research.prog += 6; give(f, { food: 300 }); }, rewardText: 'Die Gelehrten beider Reiche tauschen Schriften (6 Forschungspunkte), 300 Vorräte' },
    fightAwakened,
    sealRift('Salz auf die Wunde der Welt. Der Bund hat den Schlund geschlossen, und die Händler erzählen es in jedem Hafen.')
  ]
};

export function newStory() { return { ch: 0, act: 1, rift: null, riftHeld: 0, sealedBy: null, awkKills: {}, caps: {}, msgs: [] }; }
export function storyStart() {
  const ch = CHAPTERS[C.player][0];
  tell('Das Erwachen', 'Orsa liegt unter Schnee und Asche. Drei Reiche erheben Anspruch auf das Land, und keines weiß, was unter den Bergen schläft.\n\nErstes Kapitel: ' + ch.title + '. ' + ch.text);
}
export const currentChapter = () => { const L = CHAPTERS[C.player]; return C.story && C.story.ch < L.length ? L[C.story.ch] : null; };

// Einmal je Runde (aus endTurn)
export function storyTurn() {
  const S = C.story ||= newStory();
  // Akt II: Vorzeichen
  if (C.turn === 13) { addLog('Die Alten erzählen von Beben im Gebirge. Das Vieh ist unruhig.', ''); tell('Vorzeichen', 'In den Bergdörfern zittern nachts die Becher auf den Tischen. Die Alten sagen, so war es schon einmal, vor langer Zeit, bevor die Asche fiel.'); }
  if (C.turn === 21) addLog('Asche fällt auf den Schnee, und sie ist warm.', 'bad');
  // Akt III: der Schlund bricht auf (ab Jahr 8 oder wenn ein Reich mächtig wird)
  const big = FAC_IDS.some(f => own(f).length >= C.provs.length * .4);
  if (S.rift === null && (C.turn >= 29 || (big && C.turn >= 16))) openRift();
  if (S.rift !== null && S.rift >= 0) riftTurn();
  // Kapitel des Spielers
  const ch = currentChapter();
  if (ch && (!ch.when || ch.when()) && ch.done(C.player)) {
    ch.reward(C.player); S.ch++;
    addLog('Kapitel erfüllt: ' + ch.title + '. ' + ch.rewardText, 'good');
    const nx = currentChapter();
    tell('Kapitel erfüllt: ' + ch.title, (ch.text && S.ch === CHAPTERS[C.player].length ? ch.text + '\n\n' : '') + 'Belohnung: ' + ch.rewardText + '.' + (nx ? '\n\nNächstes Kapitel: ' + nx.title + '. ' + (nx.text || '') : ''));
  }
}
function openRift() {
  const S = C.story;
  // Bergland oder Aschenfelder, möglichst fern aller Hauptstädte und nicht Hauptstadt
  const caps = FAC_IDS.map(f => C.emp[f].capital).filter(id => id >= 0);
  const far = p => Math.min(...caps.map(c => Math.hypot(pinfo(c).x - pinfo(p.id).x, pinfo(c).y - pinfo(p.id).y)));
  // gleich weit von allen Hauptstädten (Mitte der Karte), damit kein Reich allein die Last trägt
  const spread = p => { const d = caps.map(c => Math.hypot(pinfo(c).x - pinfo(p.id).x, pinfo(c).y - pinfo(p.id).y)); return Math.min(...d) - (Math.max(...d) - Math.min(...d)) * .5; };
  const cand = C.provs.filter(p => !caps.includes(p.id) && pinfo(p.id).biome === 'berg').sort((a, b) => spread(b) - spread(a));
  const p = cand[0] || C.provs.filter(q => !caps.includes(q.id)).sort((a, b) => spread(b) - spread(a))[0];
  if (!p) { S.rift = -1; return; }
  const old = p.owner;
  for (const a of armiesAt(p.id)) C.armies = C.armies.filter(x => x !== a);
  p.owner = null; p.queue = null; p.unrest = 0; p.rift = true;
  p.garrison = { melee: 16 + Math.floor(C.turn / 3), ranged: 10 + Math.floor(C.turn / 6), brute: 5 + Math.floor(C.turn / 8) };
  mkArmy('wild', p.id, { melee: 8 + Math.floor(C.turn / 5), ranged: 5, brute: 2 }); // sofort zieht ein erstes Heer aus
  S.rift = p.id; S.act = 3;
  addLog('Die Erde bricht auf in ' + pinfo(p.id).name + (old ? ' (' + empireName(old) + ')' : '') + '! Aus dem Schlund steigen die Erwachten.', 'bad');
  tell('Der Schlund', 'In ' + pinfo(p.id).name + ' reißt der Berg auf. Glut und Frost steigen zugleich aus der Tiefe, und mit ihnen Gestalten, die keine Sprache kennen. Sie ziehen gegen jedes Feuer, das brennt, gleich welchem Reich es gehört.\n\nWer den Schlund erobert und drei Runden hält, kann ihn versiegeln.');
  // Gemeinsamer Feind: die Reiche rücken zusammen
  for (const f of FAC_IDS) for (const g of FAC_IDS) if (f !== g && C.emp[f].alive) { const e = C.emp[f]; e.op ||= {}; e.op[g] = (e.op[g] || 0) + 10; }
}
function riftTurn() {
  const S = C.story, p = prov(S.rift);
  if (p.owner) { // gehalten: nach drei Runden versiegelt
    if (++S.riftHeld >= 3) {
      S.sealedBy = p.owner; p.rift = false; S.rift = -1; S.act = 4;
      for (const a of C.armies.filter(x => x.owner === 'wild')) C.armies = C.armies.filter(x => x !== a);
      addLog(empireName(p.owner) + ' versiegelt den Schlund in ' + pinfo(p.id).name + '. Die Erwachten zerfallen zu Asche.', p.owner === C.player ? 'good' : '');
      if (p.owner !== C.player) tell('Der Schlund ist versiegelt', empireName(p.owner) + ' hat den Schlund geschlossen. Ganz Orsa spricht davon, und nicht in deinem Namen.');
    }
    return;
  }
  S.riftHeld = 0;
  // Die Besatzung wächst nach, alle zwei Runden zieht ein Heer aus
  if (C.turn % 2 === 0) {
    p.garrison.brute = (p.garrison.brute || 0) + 1; p.garrison.melee = (p.garrison.melee || 0) + 2;
    const k = 5 + Math.floor(C.turn / 6);
    mkArmy('wild', p.id, { melee: k, ranged: Math.round(k * .6), brute: 1 + Math.floor(C.turn / 16) });
  }
  // Heere der Erwachten ziehen zur nächsten bewohnten Provinz
  for (const a of C.armies.filter(x => x.owner === 'wild')) {
    if (!C.armies.includes(a) || C.over) continue;
    a.moved = 0;
    let best = null, bd = 1e9;
    for (const q of C.provs) if (q.owner) { const d = Math.hypot(pinfo(q.id).x - pinfo(a.at).x, pinfo(q.id).y - pinfo(a.at).y); if (d < bd) { bd = d; best = q.id; } }
    if (best !== null) orderMove(a, best);
  }
}
// Buchführung aus attack(): Siege über Erwachte, Eroberungen
export function storyBattle(r, a) {
  const S = C.story; if (!S) return;
  if (r.won && a.owner !== 'wild') { S.caps ||= {}; S.caps[a.owner] = (S.caps[a.owner] || 0) + 1; }
  if (r.awk) { const winner = r.won ? r.att : r.awkDef; if (winner && winner !== 'wild') { S.awkKills ||= {}; S.awkKills[winner] = (S.awkKills[winner] || 0) + 1; } }
}
