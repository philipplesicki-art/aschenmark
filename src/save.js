// Speichern und Laden. Der Zustand der Partie wird als JSON abgelegt, Verweise auf Zahlentabellen (d) werden beim Laden neu gebunden.
import { G, setG } from './state.js';
import { defOf } from './factions.js';

const KEY = 'aschenmark.save.v1';
const VERSION = 2; // 2: Holz, Technik, Burgstufen, fällbare Bäume
const SKIP = new Set(['map', 'parts', 'floats']);

const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = s => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };

export function serialize() {
  return JSON.stringify({ v: VERSION, g: G }, function (k, val) {
    if (this === G && SKIP.has(k)) return undefined;
    if (k === 'd' && this && (this.kind === 'unit' || this.kind === 'bld' || this.kind === 'dep')) return undefined;
    if (val instanceof Uint8Array) return { __u8: b64(val) };
    return val;
  });
}

export function deserialize(text) {
  const o = JSON.parse(text, (k, val) => (val && typeof val === 'object' && val.__u8 !== undefined ? unb64(val.__u8) : val));
  if (!o || (o.v !== VERSION && o.v !== 1)) throw new Error('Spielstand passt nicht zu dieser Version');
  const g = o.g;
  // Version 1 kannte weder Holz noch Technik: mit Startwerten auffüllen
  if (!g.wood) g.wood = [200, 200];
  if (!g.tech) g.tech = [{}, {}];
  if (g.ai && g.ai.p && g.ai.p.tierAt === undefined) g.ai.p = { ...g.ai.p, tierAt: [420, 900], research: 1, trade: true, maxCamps: 2 };
  g.map = new Map(); g.parts = []; g.floats = [];
  for (const e of g.ents) {
    e.d = defOf(e.kind === 'dep' ? null : e.fac, e.kind === 'dep' ? 'mine' : e.type);
    g.map.set(e.id, e);
  }
  setG(g);
  return g;
}

export function saveGame() {
  try { localStorage.setItem(KEY, serialize()); return true; } catch (_) { return false; }
}
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } }
export function loadGame() {
  try { const t = localStorage.getItem(KEY); return t ? deserialize(t) : null; } catch (_) { return null; }
}
