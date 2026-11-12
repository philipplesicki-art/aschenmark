// Prozeduraler Ton: Effekte aus Oszillatoren und Rauschen, Musik als generative Partitur, die bei
// Kämpfen dichter wird. Es werden keine Audiodateien geladen, das Spiel bleibt klein.
let AC = null, master, sfxG, musicG, fxIn, noiseBuf, timer = null, lastHit = 0, lastChop = 0;
const vol = { m: .6, s: .8 };
const st = { fac: 'wacht', intensity: 0, next: 0, beat: 0, chordEnd: 0, chord: 0, note: 3, on: false, mi: 0, ni: 0, wait: 4, oct: false, season: 'thaw', ambOn: false };

const SCALES = {
  wacht: [146.8, 164.8, 185, 220, 246.9, 293.7, 329.6, 370],        // D-Dur-Pentatonik
  asch:  [146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 311.1],       // D-Moll mit dunkler Farbe
  salz:  [146.8, 164.8, 174.6, 196, 220, 246.9, 261.6, 293.7]        // D-Dorisch, wie ein altes Seemannslied
};
const CHORDS = {
  wacht: [73.4, 55, 65.4, 49],
  asch:  [73.4, 58.3, 49, 55],
  salz:  [73.4, 65.4, 58.3, 49]
};

export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) { return; }
  master = AC.createGain(); master.connect(AC.destination);
  sfxG = AC.createGain(); sfxG.connect(master);
  musicG = AC.createGain(); musicG.connect(master);
  // Hall: Faltung mit einer erzeugten Impulsantwort (abklingendes Rauschen, 2,8 Sekunden) – klingt nach großem Raum.
  fxIn = AC.createGain();
  { const len = Math.floor(AC.sampleRate * 2.8), ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (.55 - .4 * k); d[i] = lp * Math.pow(1 - k, 2.6) * (i < 400 ? i / 400 : 1); } }
    const cv = AC.createConvolver(), wet = AC.createGain(); cv.buffer = ir; wet.gain.value = .55; fxIn.connect(cv); cv.connect(wet); wet.connect(musicG); }
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVol();
}
function applyVol() { if (!AC) return; musicG.gain.value = vol.m * .55; sfxG.gain.value = vol.s; }
export function setVolumes(m, s) { vol.m = m; vol.s = s; applyVol(); }

function tone(f, d, type, v, slide, dest, at) {
  if (!AC) return;
  const t0 = at || AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v || .05, t0 + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g); g.connect(dest || sfxG); o.start(t0); o.stop(t0 + d + .02);
}
function noise(d, v, ftype, ff, dest, at) {
  if (!AC) return;
  const t0 = at || AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = ftype || 'lowpass'; f.frequency.value = ff || 1200;
  g.gain.setValueAtTime(v || .05, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t0, Math.random() * .5); s.stop(t0 + d + .02);
}

const SF = {
  click: () => tone(520, .05, 'triangle', .05),
  cmd: () => tone(340, .07, 'triangle', .05),
  hit: () => {
    const n = performance.now(); if (n - lastHit < 60) return; lastHit = n;
    noise(.09, .07, 'bandpass', 900); tone(120, .08, 'sine', .08, 55);
  },
  shot: () => noise(.07, .03, 'highpass', 3000),
  chop: () => { const n = performance.now(); if (n - lastChop < 90) return; lastChop = n; noise(.06, .05, 'bandpass', 700); tone(170, .07, 'triangle', .05, 95); },
  alarm: () => { tone(300, .18, 'sawtooth', .05); setTimeout(() => tone(240, .25, 'sawtooth', .05), 180); },
  done: () => { tone(520, .1, 'triangle', .05); setTimeout(() => tone(780, .14, 'triangle', .05), 100); },
  place: () => { tone(200, .1, 'square', .04, 120); noise(.12, .04, 'lowpass', 500); },
  train: () => tone(620, .08, 'triangle', .05),
  horn: () => { tone(180, .6, 'sawtooth', .06, 140); tone(270, .6, 'sawtooth', .03, 210); },
  boom: () => { noise(.5, .16, 'lowpass', 400); tone(80, .5, 'sine', .14, 30); },
  level: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .18, 'triangle', .06), i * 90)); },
  win: () => { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, .35, 'triangle', .07), i * 160)); },
  lose: () => { [330, 262, 220, 165].forEach((f, i) => setTimeout(() => tone(f, .45, 'sawtooth', .05), i * 220)); }
};
export function sfx(k) { try { if (AC && SF[k]) SF[k](); } catch (_) {} }

/* ---------- Musik ---------- */
// Eine kleine Partitur statt Zufallstönen: je Fraktion vier Motive (Stufe der Tonleiter, Länge in Schlägen), gespielt von
// Laute, Flöte oder Horn über einem Bordun. Mit der Spannung kommen Ostinato, Rahmentrommel, große Trommel und Hornstöße dazu.
// Die Jahreszeit färbt den Klang: im Frost Glocken und weniger Töne, in der milden Zeit Flöte und Vögel.
const MOTIFS = {
  wacht: [[[0, 1], [2, 1], [4, 2], [3, 1], [2, 1], [0, 2]], [[4, 1], [5, 1], [4, 1], [2, 1], [3, 2], [2, 2]], [[2, 2], [4, 1], [5, 1], [7, 2], [4, 2]], [[5, 1], [4, 1], [2, 2], [0, 4]]],
  asch: [[[0, 2], [1, 1], [0, 1], [3, 2], [1, 2]], [[4, 1], [3, 1], [1, 2], [0, 4]], [[0, 1], [0, 1], [3, 1], [4, 1], [3, 2], [1, 2]], [[1, 2], [0, 6]]],
  salz: [[[0, 1], [2, 1], [3, 1], [4, 1], [6, 2], [4, 2]], [[6, 1], [5, 1], [4, 2], [2, 2], [3, 2]], [[4, 1], [6, 1], [7, 2], [6, 1], [4, 1], [2, 2]], [[3, 2], [2, 2], [0, 4]]]
};
function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function out(g, wet) { g.connect(musicG); if (wet) { const w = AC.createGain(); w.gain.value = wet; g.connect(w); w.connect(fxIn); } }
// Laute: heller Anschlag, der schnell dumpf wird
function pluck(f, t, v) {
  const o = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
  o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 2.005;
  const g2 = AC.createGain(); g2.gain.value = .25; o2.connect(g2); g2.connect(lp); o.connect(lp);
  lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(Math.min(6000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + .5);
  env(g, t, .006, v, 1.3); lp.connect(g); out(g, .5); o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
}
// Flöte: weicher Ansatz, leichtes Beben, ein Hauch Atem
function flute(f, t, d, v) {
  const o = AC.createOscillator(), g = AC.createGain(), l = AC.createOscillator(), lg = AC.createGain();
  o.type = 'sine'; o.frequency.value = f; l.frequency.value = 5.2; lg.gain.value = f * .006; l.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .09); g.gain.setValueAtTime(v * .85, t + d * .7); g.gain.exponentialRampToValueAtTime(.0001, t + d + .25);
  o.connect(g); out(g, .7); o.start(t); l.start(t); o.stop(t + d + .3); l.stop(t + d + .3);
  const s = AC.createBufferSource(), bf = AC.createBiquadFilter(), bg = AC.createGain(); s.buffer = noiseBuf; bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 6;
  env(bg, t, .05, v * .12, d); s.connect(bf); bf.connect(bg); out(bg, .4); s.start(t, Math.random() * .5); s.stop(t + d + .1);
}
// Horn: dunkel, mit langsamem Ansatz
function horn(f, t, d, v) {
  const lp = AC.createBiquadFilter(), g = AC.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(200, t); lp.frequency.linearRampToValueAtTime(700, t + .2); lp.frequency.linearRampToValueAtTime(380, t + d);
  for (const det of [-5, 4]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + .3); }
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .14); g.gain.setValueAtTime(v * .8, t + d * .8); g.gain.exponentialRampToValueAtTime(.0001, t + d + .25);
  lp.connect(g); out(g, .6);
}
// Glocke für den Frost
function bell(f, t, v) {
  for (const [m, k] of [[1, 1], [2.76, .45], [5.4, .2]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * m; env(g, t, .004, v * k, 2.6 / m + .6); o.connect(g); out(g, .9); o.start(t); o.stop(t + 3.4); }
}
// Bordun: zwei verstimmte Stimmen und die Quinte, sehr langsam ein- und ausgeblendet
function drone(root, t, len) {
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220 + st.intensity * 500;
  const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.13, t + len * .3); g.gain.setValueAtTime(.13, t + len * .7); g.gain.exponentialRampToValueAtTime(.0001, t + len + 1.5);
  lp.connect(g); out(g, .35);
  for (const [m, det] of [[1, -5], [1, 4], [1.5, 2], [2, -2]]) { const o = AC.createOscillator(); o.type = st.fac === 'asch' ? 'sawtooth' : st.fac === 'salz' ? 'sine' : 'triangle'; o.frequency.value = root * m; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + len + 1.6); }
}
function drum(t, v) { tone(72, .4, 'sine', v, 36, musicG, t); noise(.14, v * .5, 'lowpass', 180, musicG, t); }
function frame(t, v) { noise(.07, v, 'bandpass', 950, musicG, t); }
function beatLen() { return .5 - st.intensity * .13; }
function sched(t) {
  const b = st.beat++, sc = SCALES[st.fac], I = st.intensity, frost = st.season === 'frost', mild = st.season === 'thaw' || st.season === 'melt';
  if (t >= st.chordEnd) { const len = beatLen() * 16; drone(CHORDS[st.fac][st.chord++ % 4], t, len); st.chordEnd = t + len; }
  // Melodie: ein Motiv Ton für Ton, danach eine Pause (in ruhigen Zeiten länger)
  if (st.wait > 0) st.wait--;
  else {
    const mo = MOTIFS[st.fac][st.mi % 4], n = mo[st.ni];
    const f = sc[n[0]] * (st.oct ? 2 : 1), d = n[1] * beatLen();
    const voice = st.fac === 'asch' ? (st.mi % 2 ? 'horn' : 'pluck') : st.fac === 'salz' ? (st.mi % 2 ? 'pluck' : 'flute') : (mild && st.mi % 4 === 2 ? 'flute' : 'pluck');
    if (voice === 'flute') flute(f * 2, t, d * .9, .05); else if (voice === 'horn') horn(f * .5, t, d * .9, .07); else { pluck(f, t, .11); if (n[1] >= 2 && Math.random() < .5) pluck(f * 1.5, t + beatLen(), .05); }
    if (frost && st.ni === 0) bell(sc[n[0]] * 4, t, .03);
    st.wait = n[1] - 1;
    if (++st.ni >= mo.length) { st.ni = 0; st.mi++; st.oct = Math.random() < .25; st.wait += Math.round((frost ? 6 : 3) * (1 - I) + 2 + Math.random() * 3); }
  }
  // Spannung: Ostinato in der Tiefe, Trommeln, Hornstöße
  if (I > .3) pluck(CHORDS[st.fac][(st.chord + 3) % 4] * (b % 2 ? 3 : 2), t, .05 + I * .04);
  if (I > .22) { if (b % 8 === 0 || b % 8 === 3 || (I > .6 && b % 8 === 6)) drum(t, .16 + I * .12); }
  if (I > .45 && b % 2 === 1) frame(t, .04 + I * .04);
  if (I > .7) { if (b % 16 === 0) horn(CHORDS[st.fac][(st.chord + 3) % 4] * 2, t, beatLen() * 3, .09); if (b % 16 === 15) { drum(t, .2); drum(t + beatLen() / 2, .24); } }
}
function tick() {
  if (!AC) return;
  ambience();
  if (!st.on) return;
  const now = AC.currentTime;
  if (st.next < now) st.next = now + .05;
  while (st.next < now + .6) { sched(st.next); st.next += beatLen(); }
}
export function startMusic(fac) {
  if (!AC) return;
  st.fac = fac || st.fac; st.on = true; st.next = 0; st.chordEnd = 0; st.beat = 0; st.mi = 0; st.ni = 0; st.wait = 4; st.oct = false;
  if (!timer) timer = setInterval(tick, 200);
}
export function stopMusic() { st.on = false; }
export function setIntensity(v) { st.intensity += (Math.max(0, Math.min(1, v)) - st.intensity) * .05; }
export const audioReady = () => !!AC;

/* ---------- Stimmung der Landschaft: Wind als Grundton, Vögel in der milden Zeit, Krähen und Böen im Frost ---------- */
let amb = null;
export function setAmbience(season, on) { st.season = season; st.ambOn = !!on; }
function chirp(t, v, pan) {
  const p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain(); if (p.pan) p.pan.value = pan; p.connect(sfxG);
  const base = 2300 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) { const o = AC.createOscillator(), g = AC.createGain(), a = t + i * (.09 + Math.random() * .05); o.type = 'sine'; o.frequency.setValueAtTime(base * (1 + Math.random() * .2), a); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .4), a + .06); env(g, a, .008, v, .07); o.connect(g); g.connect(p); o.start(a); o.stop(a + .12); }
}
function crow(t, v, pan) {
  const p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain(); if (p.pan) p.pan.value = pan; p.connect(sfxG);
  for (let i = 0; i < 2 + (Math.random() < .5 ? 1 : 0); i++) { const a = t + i * .32, o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, a); o.frequency.exponentialRampToValueAtTime(380, a + .2); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3; env(g, a, .02, v, .2); o.connect(f); f.connect(g); g.connect(p); o.start(a); o.stop(a + .26); }
}
function ambience() {
  if (!amb) { // Wind: durchgehendes Rauschen, dessen Klangfarbe langsam wandert
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = .6; g.gain.value = 0;
    lfo.frequency.value = .07; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); src.connect(f); f.connect(g); g.connect(sfxG); src.start(); amb = { g, f, next: 0 };
  }
  const t = AC.currentTime, frost = st.season === 'frost', chill = st.season === 'chill', quiet = st.intensity < .35;
  amb.g.gain.setTargetAtTime(st.ambOn ? (frost ? .075 : chill ? .05 : .028) : 0, t, 1.5);
  if (!st.ambOn || t < amb.next) return;
  if (frost || chill) { if (quiet && Math.random() < .5) crow(t + .1, .018, Math.random() * 1.6 - .8); amb.next = t + 9 + Math.random() * 16; }
  else { if (quiet) { chirp(t + .1, .02, Math.random() * 1.8 - .9); if (Math.random() < .4) chirp(t + .7 + Math.random(), .014, Math.random() * 1.8 - .9); } amb.next = t + 2.5 + Math.random() * 6; }
}

/* ---------- Wetter: dauerhaftes Rauschen, Stärke und Klang je Ereignis ---------- */
let wx = null;
const WX = { storm: ['bandpass', 520, .5, .22], ash: ['lowpass', 160, .8, .28], dust: ['bandpass', 1300, .9, .2], flood: ['highpass', 2600, .5, .14], saltfog: ['lowpass', 380, .6, .1] };
export function setWeather(id, k) {
  if (!AC) return;
  if (!wx) {
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0;
    lfo.frequency.value = .13; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    src.connect(f); f.connect(g); g.connect(sfxG); src.start(); wx = { f, g, id: null };
  }
  const t = AC.currentTime;
  if (!id || k <= .01) { wx.g.gain.setTargetAtTime(0, t, .6); return; }
  const p = WX[id]; if (!p) return;
  if (wx.id !== id) { wx.f.type = p[0]; wx.f.Q.value = p[2] * 4; wx.id = id; }
  wx.f.frequency.setTargetAtTime(p[1], t, .5);
  wx.g.gain.setTargetAtTime(p[3] * k, t, .6);
}
