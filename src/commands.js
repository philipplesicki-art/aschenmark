// Spielerbefehle: Auswahl, Befehle, Bauen, Fähigkeiten und die Definition der Befehlsknöpfe.
// Kein DOM hier, damit die Logik auch in Tests laufen kann.
import { TS, GW } from './config.js';
import { G, UI, hooks, cam, view, proj, byId, alive } from './state.js';
import { FACTIONS, HK, defOf, bldName } from './factions.js';
import { mkBld, canPlaceAt, hasBuilt, treeReach } from './world.js';
import { setOrder } from './path.js';
import { trainBlock, train } from './units.js';
import { kill, cast, canCast, abilityList, canPower, castPower, powerOf, heroOf } from './combat.js';
import { costOf, costStr, lack, pay, refund, UPGRADE, upgradeBlock, startUpgrade, cancelUpgrade, techsAt, techNext, techBlock, startResearch, cancelResearch, techName, techDesc, TECH, tradeBlock, trade, tradeRate, tierOf, RES_NAME } from './economy.js';

export const selEnts = () => G.sel.map(id => G.map.get(id)).filter(Boolean);
export function select(ids) { G.sel = ids; UI.sig = ''; }
export function toWorld(x, y) { return proj.toWorld ? proj.toWorld(x, y) : [x / cam.z + cam.x, y / cam.z + cam.y]; }
// Weltpunkt (mit Höhe h in Welteinheiten, nur in 3D) auf den Bildschirm.
export function toScreen(wx, wy, h) { return proj.toScreen ? proj.toScreen(wx, wy, h || 0) : [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z]; }

export function shown(e) {
  if (e.team === 0) return true;
  if (e.kind === 'unit') return G.fog[Math.floor(e.y / TS) * GW + Math.floor(e.x / TS)] === 2;
  return e.seen;
}

export function pickAt(wx, wy, pad) {
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (e.dead || !shown(e) || e.kind !== 'unit') continue;
    let d = Math.hypot(e.x - wx, e.y - wy);
    if (proj.toWorld) d = Math.min(d, Math.hypot(e.x - wx, e.y - 11 - wy)); // in 3D liegt der Körper über dem Standpunkt
    if (d <= e.r + (pad || 5) && d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  for (const e of G.ents) {
    if (e.dead || e.kind === 'unit' || !shown(e)) continue;
    const x0 = e.gx * TS, y0 = e.gy * TS, s = e.size * TS;
    if (wx >= x0 - 2 && wx <= x0 + s + 2 && wy >= y0 - (e.kind === 'bld' ? s * .4 : 0) && wy <= y0 + s + 2) return e;
  }
  return null;
}

export function mark(x, y, kind) { G.marks.push({ x, y, t: 0, kind }); }

// Baum unter dem Mauszeiger. Im 3D-Bild zählt die Krone (Bäume sind hoch), nicht der Fußpunkt.
function treeAtClick(wx, wy) {
  const c = UI.click; UI.click = null;
  let best = null, bd = 1e9;
  for (const tr of G.trees) {
    if (tr.fx || Math.abs(tr.x - wx) > 280 || Math.abs(tr.y - wy) > 280) continue;
    const [sx, sy] = toScreen(tr.x, tr.y, 2.6), px = Math.abs(toScreen(tr.x + 16, tr.y, 2.6)[0] - sx) || 1;
    const d = c ? Math.hypot(sx - c[0], sy - c[1]) / (px * 1.6) : Math.hypot(tr.x - wx, tr.y - wy) / 24; // 1 = Rand der Krone
    if (d < 1 && d < bd) { bd = d; best = tr; }
  }
  return best;
}
export function cmdAt(wx, wy, am) {
  const s = selEnts();
  if (!s.length || s[0].team !== 0) return;
  const units = s.filter(e => e.kind === 'unit');
  if (!units.length) {
    const b = s[0];
    if (b.kind === 'bld' && b.d.trains) { b.rally = { x: wx, y: wy }; mark(wx, wy, 'rally'); hooks.sfx('click'); }
    return;
  }
  const t = am ? null : pickAt(wx, wy, 10);
  if (!t && !am && units.some(u => u.type === 'worker')) {
    const tr = treeAtClick(wx, wy);
    if (tr) {
      units.forEach(u => { if (u.type === 'worker') setOrder(u, { t: 'chop', cx: Math.floor(tr.x / TS), cy: Math.floor(tr.y / TS), hx: tr.x, hy: tr.y }); else setOrder(u, { t: 'move', x: wx, y: wy }); });
      mark(tr.x, tr.y, 'move'); hooks.sfx('cmd'); return;
    }
  }
  UI.click = null;
  if (t) {
    if (t.team === 1 || t.team === 3) { units.forEach(u => setOrder(u, { t: 'attack', tg: t.id })); mark(t.x, t.y, 'atk'); hooks.sfx('cmd'); return; }
    if (t.kind === 'dep') {
      units.forEach(u => { if (u.type === 'worker') setOrder(u, { t: 'gather', dep: t.id }); else setOrder(u, { t: 'move', x: wx, y: wy }); });
      mark(t.x, t.y, 'move'); hooks.sfx('cmd'); return;
    }
    if (t.team === 0 && t.kind === 'bld' && !t.built && units.some(u => u.type === 'worker')) {
      units.forEach(u => { if (u.type === 'worker') setOrder(u, { t: 'build', site: t.id }); });
      mark(t.x, t.y, 'move'); hooks.sfx('cmd'); return;
    }
  }
  const n = units.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), sp = 22;
  units.forEach((u, i) => {
    const ox = ((i % cols) - (cols - 1) / 2) * sp, oy = (Math.floor(i / cols) - (rows - 1) / 2) * sp;
    setOrder(u, { t: am ? 'amove' : 'move', x: wx + ox, y: wy + oy });
  });
  mark(wx, wy, am ? 'atk' : 'move'); hooks.sfx('cmd');
}

export function selectSameType(e) {
  select(G.ents.filter(u => {
    if (u.dead || u.team !== 0 || u.type !== e.type) return false;
    const [sx, sy] = toScreen(u.x, u.y, 1);
    return sx >= 0 && sx <= view.w && sy >= 0 && sy <= view.h;
  }).map(u => u.id));
}

export function clickSelect(x, y, shift, dbl) {
  const [wx, wy] = toWorld(x, y), e = pickAt(wx, wy, 6);
  if (!e) { if (!shift) select([]); return; }
  hooks.sfx('click');
  if (dbl && e.team === 0 && e.kind === 'unit') { selectSameType(e); return; }
  if (shift && e.team === 0 && e.kind === 'unit') {
    const cur = selEnts().filter(s => s.kind === 'unit' && s.team === 0).map(s => s.id);
    select(cur.includes(e.id) ? cur.filter(i => i !== e.id) : cur.concat(e.id)); return;
  }
  select([e.id]);
}

export function boxSelect(d, shift) {
  // Der Rahmen gilt im Bildschirmraum, damit er auch bei geneigter Kamera genau trifft.
  const x0 = Math.min(d.sx, d.x), x1 = Math.max(d.sx, d.x), y0 = Math.min(d.sy, d.y), y1 = Math.max(d.sy, d.y);
  const inBox = (e, h) => { const [sx, sy] = toScreen(e.x, e.y, h); return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; };
  let us = G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && inBox(e, 1)).map(e => e.id);
  if (!us.length) {
    const b = G.ents.find(e => !e.dead && e.team === 0 && e.kind === 'bld' && inBox(e, 1));
    if (b) { select([b.id]); hooks.sfx('click'); } else if (!shift) select([]);
    return;
  }
  if (shift) us = [...new Set(selEnts().filter(s => s.kind === 'unit' && s.team === 0).map(s => s.id).concat(us))];
  select(us); hooks.sfx('click');
}

export function selectArmy() {
  const a = G.ents.filter(e => !e.dead && e.team === 0 && e.kind === 'unit' && e.type !== 'worker').map(e => e.id);
  if (a.length) { select(a); hooks.sfx('click'); } else hooks.toast('Noch keine Truppen', 'bad');
}
export function selectIdle() {
  const w = G.ents.filter(e => !e.dead && e.team === 0 && e.type === 'worker' && !e.order);
  if (!w.length) { hooks.toast('Keine untätigen Arbeiter'); return null; }
  G.idleI = (G.idleI + 1) % w.length;
  const u = w[G.idleI]; select([u.id]); hooks.sfx('click');
  return u;
}

/* ---------- Bauen ---------- */
export function buildBlock(tp) {
  const d = defOf(G.fac[0], tp);
  if (d.tier && tierOf(0) < d.tier) return 'Burgstufe ' + d.tier + ' nötig';
  if (d.needs && !hasBuilt(0, d.needs)) return defOf(G.fac[0], d.needs).name + ' nötig';
  return lack(0, costOf(d));
}
export function startPlace(tp) {
  const m = buildBlock(tp);
  if (m) { hooks.toast(m, 'bad'); return; }
  UI.mode = 'place'; UI.place = { type: tp, gx: 0, gy: 0, ok: false, has: false }; UI.sig = '';
  hooks.toast('Bauplatz wählen. Esc bricht ab.');
}
export function ghostAt(wx, wy) {
  const s = defOf(G.fac[0], UI.place.type).size;
  UI.place.gx = Math.round(wx / TS - s / 2); UI.place.gy = Math.round(wy / TS - s / 2);
  UI.place.ok = canPlaceAt(UI.place.type, UI.place.gx, UI.place.gy, 0); UI.place.has = true;
}
export function doPlace() {
  const p = UI.place;
  if (!p.ok) { hooks.toast('Hier kann nicht gebaut werden', 'bad'); return; }
  const d = defOf(G.fac[0], p.type), ws = selEnts().filter(e => e.type === 'worker');
  if (!ws.length || buildBlock(p.type)) return;
  pay(0, costOf(d));
  const s = mkBld(p.type, 0, p.gx, p.gy, false);
  ws.forEach(w => setOrder(w, { t: 'build', site: s.id }));
  UI.mode = null; UI.place = null; UI.sig = ''; hooks.sfx('place');
}
export function cancelSite(b) {
  refund(0, costOf(defOf(b.fac, b.type)), .75);
  kill(b); G.lost--; select([]);
}
export function cancelMode() { UI.mode = null; UI.place = null; UI.target = null; UI.sig = ''; }

/* ---------- Gezielte Fähigkeiten und Mächte ---------- */
export function beginTarget(kind, data) {
  UI.mode = 'target'; UI.target = { kind, ...data }; UI.sig = '';
  hooks.toast('Ziel wählen. Esc bricht ab.');
}
export function applyTarget(wx, wy) {
  const t = UI.target; if (!t) return;
  if (t.kind === 'ability') {
    const h = byId(t.hero);
    if (cast(h, t.i, wx, wy)) cancelMode();
  } else if (t.kind === 'power') {
    if (castPower(0, wx, wy)) cancelMode();
  }
}
export function usePower() {
  if (!canPower(0)) {
    const p = powerOf(0);
    hooks.toast(G.ppCd[0] > 0 ? p.name + ' lädt noch' : p.name + ' braucht ' + p.cost + ' Machtpunkte', 'bad');
    return;
  }
  beginTarget('power', {});
}

/* ---------- Befehlsknöpfe ---------- */
// Jeder Knopf trägt: grp (Überschrift der Gruppe), co (Kosten als Objekt), why() (Sperrgrund oder null), desc, stats (für den Hinweis)
const BLD_DESC = {
  farm: 'Erntet Vorräte und schafft Platz für mehr Truppen. Im Hartfrost ruht die Ernte fast ganz.',
  lumber: 'Abgabestelle für Holz. Dicht am Wald gebaut spart sie den Arbeitern lange Wege.',
  barracks: 'Bildet Truppen aus. Hier werden auch Waffen und Rüstungen verbessert.',
  workshop: 'Baut Belagerungsgerät gegen Mauern und Türme.',
  market: 'Tauscht Erz, Holz und Vorräte. Der Kurs lässt sich durch Forschung verbessern.',
  tower: 'Beschießt Feinde in Reichweite und deckt Arbeiter und Engstellen.',
  outpost: 'Abgabestelle für Erz an einer fernen Ader.'
};
const ROLE_DESC = {
  worker: 'Baut, schürft Erz und fällt Holz. Kämpft nur im Notfall.', melee: 'Standfeste Fußtruppe. Stark gegen Reiter.', ranged: 'Schießt aus der Ferne. Stark gegen Fußtruppen, verwundbar im Nahkampf.',
  cav: 'Schnell und wuchtig. Reitet Fernkämpfer nieder, scheitert an Speeren.', siege: 'Zerstört Gebäude und Mauern. Schwach gegen Truppen.', hero: 'Einzigartig. Sammelt Erfahrung, steigt auf und trägt zwei Fähigkeiten.'
};
const unitStats = d => [d.hp + ' Leben', d.dmg ? d.dmg + ' Schaden' + (d.cd ? ' alle ' + String(d.cd).replace('.', ',') + ' s' : '') : '', d.rng > 60 ? 'Reichweite ' + d.rng : d.dmg ? 'Nahkampf' : '', d.pop ? d.pop + (d.pop > 1 ? ' Plätze' : ' Platz') : ''].filter(Boolean).join(' · ');
export function cmdDefs() {
  if (!G || G.over) return [];
  const s = selEnts(), defs = [], fac = FACTIONS[G.fac[0]];
  if (UI.mode) defs.push({ id: 'cancel', label: 'Abbrechen', key: 'escape', en: () => true, fn: cancelMode });
  if (!s.length || s[0].team !== 0) return defs;
  const b = s.length === 1 && s[0].kind === 'bld' ? s[0] : null;
  if (b) {
    if (!b.built) { defs.push({ id: 'cs', label: 'Bau abbrechen', desc: 'Reißt die Baustelle ab. Drei Viertel der Kosten kommen zurück.', key: 'x', en: () => true, fn: () => cancelSite(b) }); return defs; }
    for (const tp of b.d.trains || []) {
      const d = defOf(b.fac, tp);
      defs.push({ id: 't' + tp, grp: 'Ausbilden', label: d.name, key: HK[tp], co: costOf(d), time: d.time, why: () => trainBlock(b, tp), desc: d.desc || ROLE_DESC[tp] || '', stats: unitStats(d), en: () => !trainBlock(b, tp), fn: () => train(b, tp) });
    }
    if (b.type === 'hq') { // Burg ausbauen
      if (b.up) defs.push({ id: 'upc', grp: 'Ausbau', label: 'Ausbau abbrechen', desc: 'Bricht den Ausbau ab und erstattet die Kosten.', en: () => true, fn: () => cancelUpgrade(b) });
      else if ((b.tier || 1) < 3) {
        const to = (b.tier || 1) + 1, f = FACTIONS[b.fac];
        defs.push({ id: 'up' + to, grp: 'Ausbau', label: f.tiers[to - 1], co: UPGRADE[to], time: UPGRADE[to].time, why: () => upgradeBlock(b), en: () => !upgradeBlock(b), fn: () => startUpgrade(b),
          desc: 'Burgstufe ' + to + ': mehr Leben und Versorgung, schaltet ' + (to === 2 ? 'Reiter, Werkstatt, Markt und die zweite Technikstufe' : 'die dritte Technikstufe und schnellere Machtpunkte') + ' frei.' });
      }
    }
    for (const id of techsAt(b.type)) {
      const n = techNext(b.team, id); if (!n) continue;
      const lv = TECH[id].levels[n - 1];
      defs.push({ id: 'r' + id + n, grp: 'Forschung', label: techName(b.fac, id, n), co: lv, time: lv.time, why: () => techBlock(b, id), en: () => !techBlock(b, id), fn: () => startResearch(b, id),
        desc: techDesc(b.fac, id) + (TECH[id].levels.length > 1 ? ' Stufe ' + n + ' von ' + TECH[id].levels.length + '.' : '') });
    }
    if (b.rs) defs.push({ id: 'rsc', grp: 'Forschung', label: 'Forschung abbrechen', desc: 'Bricht die laufende Forschung ab und erstattet die Kosten.', en: () => true, fn: () => cancelResearch(b) });
    if (b.type === 'market') for (const [from, to] of [['ore', 'wood'], ['wood', 'ore'], ['ore', 'food'], ['food', 'ore']]) {
      defs.push({ id: 'tr' + from + to, grp: 'Handel', label: RES_NAME[from] + ' → ' + RES_NAME[to], cost: '100 → ' + Math.floor(100 * tradeRate(b.team)), why: () => tradeBlock(b, from), en: () => !tradeBlock(b, from), fn: () => trade(b.team, from, to, 100),
        desc: 'Tauschkurs: 100 ' + RES_NAME[from] + ' gegen ' + Math.floor(100 * tradeRate(b.team)) + ' ' + RES_NAME[to] });
    }
    return defs;
  }
  const units = s.filter(e => e.kind === 'unit');
  if (units.some(u => u.type === 'worker')) {
    for (const tp of ['farm', 'lumber', 'barracks', 'workshop', 'market', 'tower', 'outpost']) {
      const d = fac.blds[tp];
      defs.push({ id: 'b' + tp, grp: 'Bauen', label: d.name, key: HK[tp], co: costOf(d), time: d.time, why: () => buildBlock(tp), desc: BLD_DESC[tp] || '', stats: d.dmg ? d.hp + ' Leben · ' + d.dmg + ' Schaden · Reichweite ' + d.rng : d.hp + ' Leben', en: () => !buildBlock(tp), fn: () => startPlace(tp) });
    }
  }
  if (units.some(u => u.type !== 'worker')) defs.push({ id: 'am', grp: 'Befehle', label: 'Angriffsmarsch', desc: 'Zum Ziel ziehen und unterwegs jeden Feind angreifen.', key: 'f', en: () => true, on: () => UI.mode === 'amove', fn: () => { UI.mode = 'amove'; UI.sig = ''; hooks.toast('Ziel wählen'); } });
  if (units.some(u => u.type !== 'worker')) defs.push({ id: 'hold', grp: 'Befehle', label: 'Stellung halten', desc: 'Die Truppe bleibt stehen und schlägt nur, was in Reichweite kommt. Stehendes Fußvolk ist von vorn schwerer zu treffen und fängt Reiter ab. Erneut drücken hebt den Befehl auf.', key: 'g', en: () => true, on: () => units.every(u => u.hold || u.type === 'worker'), fn: () => { const v = !units.every(u => u.hold || u.type === 'worker'); units.forEach(u => { if (u.type !== 'worker') { u.hold = v; if (v) setOrder(u, null); } }); } });
  if (units.length) defs.push({ id: 'halt', grp: 'Befehle', label: 'Halt', desc: 'Stehen bleiben. Die Truppen wehren sich weiter.', key: 'h', en: () => true, fn: () => units.forEach(u => setOrder(u, null)) });
  const hero = units.find(u => u.type === 'hero');
  if (hero) {
    abilityList(hero).forEach((a, i) => {
      defs.push({
        id: 'ab' + i, icon: a.id === 'wall' ? 'wall_ab' : a.id, grp: 'Fähigkeiten', label: a.name, key: a.key, time: a.cd, timeLabel: 'Abklingzeit',
        why: () => (hero.lvl < a.lvl ? 'Ab Heldenstufe ' + a.lvl : hero.abCd[i] > 0 ? 'Lädt noch ' + Math.ceil(hero.abCd[i]) + ' s' : null),
        en: () => canCast(hero, i), cd: () => hero.abCd[i], desc: a.desc,
        fn: () => { if (a.targeted) beginTarget('ability', { hero: hero.id, i }); else cast(hero, i); }
      });
    });
  }
  return defs;
}
export function hotkeyFor(k) { return cmdDefs().find(c => c.key === k); }
export { heroOf };
