// Einstellungen und Fortschritt. localStorage kann fehlen oder blockiert sein, daher überall abgesichert.
const KEY = 'aschenmark.v2';
const defaults = { music: .6, sfx: .8, fac: 'wacht', opp: 'random', diff: 'normal', quality: null, fps: false, wins: {}, best: {}, chains: {}, ach: {} };
let cache = null;

export function loadSettings() {
  if (cache) return cache;
  try { cache = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { cache = { ...defaults }; }
  return cache;
}
export function saveSettings(patch) {
  cache = { ...loadSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
  return cache;
}
