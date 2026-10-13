// Gemeinsamer Zustand. G ist eine "live binding": Importeure sehen immer die aktuelle Partie.
export let G = null;
export function setG(g) { G = g; }

export const cam = { x: 0, y: 0, z: 1 };
export const view = { w: 300, h: 300, dpr: 1 };
// Projektion Bildschirm <-> Welt. Die 3D-Darstellung setzt diese Funktionen; ohne sie gilt die flache 2D-Abbildung.
export const proj = { toWorld: null, toScreen: null, sync: null };
// mode: null | 'place' | 'amove' | 'target'
export const UI = { mode: null, place: null, target: null, sig: '' };

const noop = () => {};
// Die Simulation kennt weder DOM noch Audio. Darstellung und Ton hängen sich hier ein.
export const hooks = {
  toast: noop, sfx: noop, burst: noop, float: noop, shake: noop, flash: noop,
  endGame: noop, achieve: noop, levelUp: noop, music: noop, regionsChanged: noop, chainDone: noop, setFx: noop, setQuality: noop, treeFelled: noop, battleEnd: noop
};

export const byId = id => G.map.get(id);
export const alive = e => !!e && !e.dead && e.hp > 0;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Zufall der Simulation: der Zustand liegt in G.rs und wird mit dem Spielstand gespeichert.
export function simR() {
  G.rs = (G.rs + 0x6D2B79F5) >>> 0;
  let t = G.rs;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
