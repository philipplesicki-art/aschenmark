// Prozeduraler Ton: Effekte aus Oszillatoren und Rauschen, Musik als generative Partitur, die bei
// Kämpfen dichter wird. Es werden keine Audiodateien geladen, das Spiel bleibt klein.
let AC = null, master, sfxG, musicG, fxIn, noiseBuf, timer = null, lastHit = 0;
const vol = { m: .6, s: .8 };
const st = { fac: 'wacht', intensity: 0, next: 0, beat: 0, chordEnd: 0, chord: 0, note: 3, on: false };

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
  // Einfacher Hall: Echo mit Rückkopplung und Tiefpass.
  fxIn = AC.createGain();
  const dl = AC.createDelay(1), fb = AC.createGain(), lp = AC.createBiquadFilter();
  dl.delayTime.value = .38; fb.gain.value = .42; lp.type = 'lowpass'; lp.frequency.value = 1800;
  fxIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicG);
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
function chord(t) {
  const root = CHORDS[st.fac][st.chord++ % 4];
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260 + st.intensity * 700;
  const g = AC.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + 2.5); g.gain.exponentialRampToValueAtTime(.0001, t + 8.5);
  lp.connect(g); g.connect(musicG);
  for (const [m, det] of [[1, -4], [1.5, 3], [2, 0]]) {
    const o = AC.createOscillator(); o.type = st.fac === 'asch' ? 'sawtooth' : st.fac === 'salz' ? 'sine' : 'triangle';
    o.frequency.value = root * m; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + 9);
  }
}
function beatLen() { return .52 - st.intensity * .2; }
function sched(t) {
  const b = st.beat++;
  if (t >= st.chordEnd) { chord(t); st.chordEnd = t + 8; }
  const sc = SCALES[st.fac];
  if (Math.random() < .42 + st.intensity * .35) {
    st.note = Math.max(0, Math.min(sc.length - 1, st.note + Math.floor(Math.random() * 5) - 2));
    const f = sc[st.note] * (Math.random() < .2 ? 2 : 1);
    tone(f, .9, 'triangle', .08, null, fxIn, t);
    tone(f, .9, 'triangle', .04, null, musicG, t);
  }
  if (st.intensity > .3) {
    if (b % 2 === 0) { tone(90, .25, 'sine', .22, 40, musicG, t); }
    if (st.intensity > .6 && b % 2 === 1) noise(.05, .05, 'highpass', 5000, musicG, t);
    if (st.intensity > .45 && b % 4 === 3) noise(.12, .07, 'bandpass', 1800, musicG, t);
  }
}
function tick() {
  if (!AC || !st.on) return;
  const now = AC.currentTime;
  if (st.next < now) st.next = now + .05;
  while (st.next < now + .6) { sched(st.next); st.next += beatLen(); }
}
export function startMusic(fac) {
  if (!AC) return;
  st.fac = fac || st.fac; st.on = true; st.next = 0; st.chordEnd = 0; st.beat = 0;
  if (!timer) timer = setInterval(tick, 200);
}
export function stopMusic() { st.on = false; }
export function setIntensity(v) { st.intensity += (Math.max(0, Math.min(1, v)) - st.intensity) * .05; }
export const audioReady = () => !!AC;

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
