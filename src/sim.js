import { TS, GW, GH } from './config.js';
import { G, hooks } from './state.js';
import { updUnit, updBld, separate, autoGather } from './units.js';
import { updProjs, updZones, kill } from './combat.js';
import { aiTick } from './ai.js';
import { battleTick } from './battle.js';
import { updEvents, evSight } from './events.js';
import { updQuests } from './quests.js';
import { tierOf, seasonAt, foodRates, foodCap } from './economy.js';

export function updFog() {
  const f = G.fog;
  if (G.demo) { f.fill(2); for (const e of G.ents) e.seen = true; G.fogDirty = true; return; } // Szene hinter dem Hauptmenü: alles sichtbar
  for (let i = 0; i < f.length; i++) if (f[i] === 2) f[i] = 1;
  for (const e of G.ents) {
    if (e.team !== 0 || e.dead) continue;
    const rr = (e.kind === 'bld' && !e.built ? 70 : e.d.sight) * evSight(e), cx = e.x / TS, cy = e.y / TS, r = rr / TS;
    for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const dx = i + .5 - cx, dy = j + .5 - cy;
      if (dx * dx + dy * dy <= r * r) f[j * GW + i] = 2;
    }
  }
  for (const e of G.ents) {
    if (e.kind === 'unit' || e.seen) continue;
    for (let j = 0; j < e.size && !e.seen; j++) for (let i = 0; i < e.size; i++) {
      if (f[(e.gy + j) * GW + e.gx + i] === 2) { e.seen = true; break; }
    }
  }
  G.fogDirty = true;
}

// Vorräte: einmal je Sekunde Ernte und Verbrauch verrechnen. Ist das Lager leer, verhungern Truppen langsam.
const HUNGER_HP = .01; // Anteil der Lebenspunkte je Sekunde
function updFood() {
  const s = seasonAt(G.t);
  if (G.season !== s.id) { // Jahreszeitenwechsel melden
    if (G.season) {
      const msg = { chill: 'Der Frost zieht an. Die Ernte sinkt, Vorräte anlegen!', frost: 'Hartfrost! Kaum Ernte, die Truppen essen mehr.', melt: 'Das Eis bricht. Die Felder erholen sich.', thaw: 'Tauzeit. Zeit zum Wachsen.' }[s.id];
      hooks.toast(msg, s.id === 'frost' || s.id === 'chill' ? 'bad' : 'good'); hooks.sfx(s.id === 'frost' ? 'alarm' : 'done');
    }
    G.season = s.id;
  }
  if (G.battle) return; // in der Schlacht zählen nur die Truppen, keine Vorräte
  for (const t of [0, 1]) {
    const r = foodRates(t);
    G.food[t] = Math.max(0, Math.min(foodCap(t), G.food[t] + r.net));
    if (G.food[t] <= 0 && r.net < 0) {
      G.hunger[t] = (G.hunger[t] || 0) + 1;
      if (t === 0 && G.hunger[0] % 8 === 1) { hooks.toast('Hunger! Die Truppen verlieren Leben. Mehr Höfe oder Vorräte tauschen.', 'bad'); hooks.sfx('alarm'); }
      for (const e of G.ents) if (e.team === t && e.kind === 'unit' && !e.dead) { e.hp -= e.maxhp * HUNGER_HP; if (e.hp <= 0) kill(e, null); }
    } else G.hunger[t] = 0;
  }
}

export function beginMatch() {
  // Die ersten beiden Arbeiter jeder Seite holen Holz, der Rest baut Erz ab.
  for (const t of [0, 1]) G.ents.filter(e => e.kind === 'unit' && e.type === 'worker' && e.team === t).forEach((e, i) => autoGather(e, i < 2 ? 'wood' : 'ore'));
  updFog();
}

export function step(dt) {
  G.t += dt;
  G.combat = Math.max(0, G.combat - dt * .5);
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.kind === 'unit') updUnit(e, dt);
    else if (e.kind === 'bld') updBld(e, dt);
    else if (e.amt <= 0) { e.dead = true; for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) G.blk[(e.gy + j) * GW + e.gx + i] -= 1; G.map.delete(e.id); }
  }
  separate();
  updProjs(dt);
  updZones(dt);
  updEvents(dt);
  for (const m of G.marks) m.t += dt;
  G.marks = G.marks.filter(m => m.t < (m.life || .6));
  for (const c of G.corpses) c.t += dt;
  G.corpses = G.corpses.filter(c => c.t < c.life);
  for (let t = 0; t < 2; t++) {
    G.pp[t] = Math.min(6, G.pp[t] + dt / 50 * (tierOf(t) >= 3 ? 1.4 : 1)); // Burgstufe 3: Machtpunkte schneller
    G.ppCd[t] = Math.max(0, G.ppCd[t] - dt);
  }
  G.ents = G.ents.filter(e => !e.dead);
  G.sel = G.sel.filter(id => G.map.has(id));
  G.qT = (G.qT || 0) - dt; if (G.qT <= 0) { G.qT = .5; updQuests(); }
  G.aiT -= dt; if (G.aiT <= 0) { G.aiT = 1; if (G.battle) battleTick(); else { aiTick(1); if (G.ai0) aiTick(0); } }
  G.foodT -= dt; if (G.foodT <= 0) { G.foodT += 1; updFood(); }
  G.fogT -= dt; if (G.fogT <= 0) { G.fogT = .15; updFog(); }
}
