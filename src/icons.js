// Bildzeichen für die Befehlsleiste: schlichte Wappenzeichen als SVG (24er Raster). Linien in der Schriftfarbe, Flächen halb gefüllt.
// iconFor(d) wählt nach d.icon oder nach der Kennung des Befehls.
const F = 'fill="currentColor" fill-opacity=".28"'; // gefüllte Fläche
const S = 'fill="currentColor" stroke="none"';       // volle Fläche
const P = {
  // --- Truppen ---
  worker: `<path d="M5 20 15 8"/><path ${F} d="M9 6c4-2 9 0 11 5-3-2-6-2.5-9-1.5z"/><path d="M4 21l2-2"/>`,
  hero: `<path ${F} d="M4 17 3 8l5 4 4-7 4 7 5-4-1 9z"/><path d="M4 20h16"/><circle ${S} cx="12" cy="13.5" r="1.2"/>`,
  melee: `<path d="M6 21 17 4"/><path ${S} d="M17 4l2.2-1.6-.4 4.2z"/><path ${F} d="M4 8h8v5c0 3-2 5-4 6-2-1-4-3-4-6z"/><path d="M8 9.5v8"/>`,
  ranged: `<path d="M7 3c7 3 7 15 0 18"/><path d="M7 3v18"/><path d="M3 12h16"/><path ${S} d="M21 12l-4-2.2v4.4z"/>`,
  cav: `<path ${F} d="M7 21c0-5 1-8 4-10l-1-5 4 2c4 1 6 4 6 8l-3 1-3-3c-1 3-1 5-1 7z"/><circle ${S} cx="15.5" cy="11" r=".9"/><path d="M10 6 8.5 3"/>`,
  siege: `<circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M4 15h16"/><path d="M8 15 18 5"/><path ${F} d="M16 3h5v5z"/><path d="M12 15V9"/>`,
  support: `<path d="M12 3v18"/><path d="M7 8h10"/><path ${F} d="M12 12c4 0 6 3 6 6H6c0-3 2-6 6-6z"/><circle ${S} cx="12" cy="4" r="1.6"/>`,
  elite: `<path ${F} d="M5 13c0-5 3-9 7-9s7 4 7 9v5l-4 2v-6h-6v6l-4-2z"/><path d="M12 4v10"/><path d="M12 4c1-2 3-2 4-1"/>`,
  // --- Bauwerke ---
  farm: `<path ${F} d="M3 12 9 7l6 5v8H3z"/><path d="M7 20v-5h4v5"/><path d="M18 20v-9"/><path d="M18 13c-2-1-2-3-2-3M18 13c2-1 2-3 2-3M18 17c-2-1-2-3-2-3M18 17c2-1 2-3 2-3"/>`,
  barracks: `<path ${F} d="M3 20V10l9-5 9 5v10z"/><path d="M10 20v-6h4v6"/><path d="M7 4l10 14M17 4 7 18" stroke-width="1.2"/>`,
  workshop: `<path ${F} d="M3 20v-8l5 3v-3l5 3V8h6v12z"/><path d="M16 8V4h2v4"/><circle cx="9" cy="17.5" r="1.4"/>`,
  tower: `<path ${F} d="M8 21V9H6V4h2.5v2h2V4h3v2h2V4H18v5h-2v12z"/><path d="M12 12v3"/>`,
  outpost: `<path d="M12 21V4"/><path ${F} d="M12 4h8l-2 3 2 3h-8z"/><path ${F} d="M5 21v-5h14v5z"/><path d="M5 16l2-2h10l2 2"/>`,
  lumber: `<path ${F} d="M3 19h18v-3H3z"/><circle cx="6" cy="14" r="2.4"/><circle cx="11" cy="14" r="2.4"/><circle cx="8.5" cy="10" r="2.4"/><path d="M15 12l5-7"/><path ${S} d="M20 5l1.5 3.5-3.5-.5z"/>`,
  market: `<path ${F} d="M3 9l2-5h14l2 5c0 1.5-1.5 2.5-3 2.500s-3-1-3-2.500c0 1.500-1.500 2.500-3 2.500s-3-1-3-2.500C9 10.500 7.500 11.500 6 11.500S3 10.500 3 9z"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>`,
  wall: `<path ${F} d="M2 20V9h3v2h3V9h3v2h2V9h3v2h3V9h3v11z"/><path d="M2 15h20M8 15v5M16 15v5M12 11v4"/>`,
  // --- Befehle ---
  am: `<path d="M4 4l12 12M20 4 8 16"/><path d="M13 17l3-3 4 4-3 3zM11 17l-3-3-4 4 3 3z" ${F}/><path ${S} d="M4 4l3 .500-2.500 2.500zM20 4l-3 .500 2.500 2.500z"/>`,
  halt: `<path ${F} d="M7 12V6a1.300 1.300 0 0 1 2.600 0v5V4.500a1.300 1.300 0 0 1 2.600 0V11 5.500a1.300 1.300 0 0 1 2.600 0V12 8a1.300 1.300 0 0 1 2.600 0v7c0 4-2.500 6-6 6-3 0-4.500-1.500-6-4l-2-3.500c-.6-1.200.9-2.300 2-1.300z"/>`,
  hold: `<path ${F} d="M12 3 4 6v6c0 5 3.500 8 8 9 4.500-1 8-4 8-9V6z"/><path d="M12 7v10M8 11h8"/>`,
  cancel: `<circle cx="12" cy="12" r="8.500" ${F}/><path d="M8 8l8 8M16 8l-8 8"/>`,
  up: `<path ${F} d="M12 3 5 11h4v9h6v-9h4z"/>`,
  research: `<path ${F} d="M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2z"/><path d="M10 9h5M10 12.500h5M10 16h3"/><path d="M5 4a2 2 0 0 0-2 2v2h4"/>`,
  trade: `<path d="M12 4v16M5 20h14"/><path d="M5 7h14"/><path ${F} d="M2.500 14 5 7l2.500 7a2.500 2.500 0 0 1-5 0zM16.500 14 19 7l2.500 7a2.500 2.500 0 0 1-5 0z"/><circle ${S} cx="12" cy="4" r="1.300"/>`,
  // --- Fähigkeiten und Mächte ---
  cry: `<path ${F} d="M3 10v4l3 1 9 5V4L6 9z"/><path d="M18 9c1 1 1 5 0 6M20 6.500c2.500 2.500 2.500 8.500 0 11"/>`,
  wall_ab: `<path ${F} d="M4 4h7v9c0 3-1.500 5-3.500 6C5.500 18 4 16 4 13zM13 4h7v9c0 3-1.500 5-3.500 6-2-1-3.500-3-3.500-6z"/><path d="M7.500 7v8M16.500 7v8"/>`,
  blast: `<path ${F} d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2.500-7 1.500 1 2 2.500 2 4 1.500-2 2-5 1.500-9z"/><path d="M12 21c-1.700 0-3-1.300-3-3 0-1.500 1.500-2.500 3-5 1.500 2.500 3 3.500 3 5 0 1.700-1.300 3-3 3z"/>`,
  dread: `<path ${F} d="M5 11a7 7 0 0 1 14 0c0 3-1 4.500-2.500 5.500V20h-9v-3.500C6 15.500 5 14 5 11z"/><circle ${S} cx="9.300" cy="11.500" r="1.700"/><circle ${S} cx="14.700" cy="11.500" r="1.700"/><path d="M10.500 20v-2.500M13.500 20v-2.500M12 14.500v1.500"/>`,
  tide: `<path d="M2 16c2.500-3 5-3 7 0s4.500 3 7 0 4.500-3 6 0"/><path ${F} d="M3 12c1-6 7-9 12-6-3 0-4.500 2-4 4 1.500-1.500 4-1.500 6 0-2.500 0-3.500 1-4.500 2z"/><path d="M2 20.500c2.500-2 5-2 7 0s4.500 2 7 0 4.500-2 6 0"/>`,
  bless: `<path ${F} d="M12 3l2.300 5.700L20 9.500l-4.300 4 1.300 6-5-3.200-5 3.200 1.300-6L4 9.500l5.700-.8z"/>`,
  power: `<path ${F} d="M13 2 5 13h5l-1 9 9-12h-5z"/>`,
  // --- Forschung ---
  carry: `<path ${F} d="M6 9h12l-1.5 11h-9z"/><path d="M8 9c0-6 8-6 8 0"/><path d="M6.5 13h11"/>`,
  felling: `<path d="M6 21 16 5"/><path ${F} d="M13 4c3-1.500 6 0 7 3-2 0-3.500 1-4.500 3z"/>`,
  storage: `<path ${F} d="M7 4h10c2 4 2 12 0 16H7C5 16 5 8 7 4z"/><path d="M5.700 9h12.600M5.700 15h12.600"/>`,
  weapons: `<path d="M5 19 17 7"/><path ${F} d="M17 7l3-3 0 4z"/><path d="M4 16l4 4"/><path d="M19 19 7 7"/><path ${F} d="M7 7 4 4l0 4z"/><path d="M20 16l-4 4"/>`,
  armor: `<path ${F} d="M8 3 4 6l2 4v10h12V10l2-4-4-3c-1 2-7 2-8 0z"/><path d="M12 9v11M6 14h12"/>`,
  def: `<circle cx="12" cy="12" r="7" ${F}/><circle ${S} cx="12" cy="12" r="1.500"/>`
};
// Dezimalzahlen wie 2.500 kürzen (Schreibweise oben bleibt gut lesbar, die Ausgabe schlank)
for (const k of Object.keys(P)) P[k] = P[k].replace(/(\.\d*?[1-9])0+(?=\D)/g, '$1').replace(/\.0+(?=\D)/g, '');
const svg = k => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[k] || P.def) + '</svg>';

const RT = { mining: 'worker', hero: 'hero', fort: 'wall', harvest: 'farm', sig: 'elite', siege: 'siege', trade: 'trade' }; // Forschung → Zeichen
export function iconKey(d) {
  if (d.icon && P[d.icon]) return d.icon;
  const id = d.id || '';
  if (P[id]) return id;
  if (id === 'cs' || id === 'upc' || id === 'rsc') return 'cancel';
  if (id.startsWith('tr')) return 'trade';
  if (id.startsWith('up')) return 'up';
  if (id[0] === 't' && P[id.slice(1)]) return id.slice(1);
  if (id[0] === 'b' && P[id.slice(1)]) return id.slice(1);
  if (id[0] === 'r') { const t = id.slice(1).replace(/\d+$/, ''); return RT[t] || (P[t] ? t : 'research'); }
  if (id.startsWith('ab')) return 'bless';
  return 'def';
}
export const iconFor = d => svg(iconKey(d));
export const icon = k => svg(k);
