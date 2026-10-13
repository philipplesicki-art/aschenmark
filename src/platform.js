// Schicht zwischen Spiel und Plattform. Im Browser passiert nichts, in der Desktop-Hülle gehen
// Erfolge an Steam. Die Erfolgs-IDs müssen im Steamworks-Partnerbereich genauso angelegt werden.
const p = typeof window !== 'undefined' ? window.aschenPlatform : null;

export const ACHIEVEMENTS = {
  WIN_FIRST: 'Erster Sieg',
  WIN_HARD: 'Sieg auf Schwer',
  WIN_BOTH: 'Mit zwei Fraktionen gesiegt',
  WIN_ALL: 'Mit allen drei Fraktionen gesiegt',
  CHAIN_DONE: 'Einen Handlungsfaden abgeschlossen',
  HERO_MAX: 'Held auf Stufe 5',
  POWER_USED: 'Macht entfesselt'
};

export const platform = {
  desktop: !!p,
  unlock(id) {
    if (!ACHIEVEMENTS[id]) return;
    try { if (p) p.unlockAchievement(id); } catch (_) {}
  },
  // Beenden gibt es nur in der Desktop-Hülle; im Browser schließt das Spiel kein Fenster.
  canQuit: !!(p && p.quit),
  quit() { try { if (p && p.quit) p.quit(); } catch (_) {} },
  async isFullscreen() {
    try { if (p && p.isFullscreen) return !!(await p.isFullscreen()); } catch (_) {}
    return typeof document !== 'undefined' && !!document.fullscreenElement;
  },
  async setFullscreen(on) {
    try {
      if (p && p.setFullscreen) return void (await p.setFullscreen(!!on));
      if (typeof document === 'undefined') return;
      if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else if (!on && document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch (_) {}
  },
  info() { try { return p && p.info ? p.info() : Promise.resolve({ steam: false, name: null }); } catch (_) { return Promise.resolve({ steam: false, name: null }); } }
};
