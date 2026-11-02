// Âm thanh tạm bằng WebAudio (không cần file). Khi có file ElevenLabs thì thay các hàm trong `sfx`.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    loadAll();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  unlocked = true; applyMusic();
}
export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; for (const k in tracks) tracks[k].muted = m; }
export function isMuted() { return muted; }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, slideTo?: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol = 0.3, freq = 1200, delay = 0, q = 0.7) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}


// ---------- FILE ÂM THANH THẬT ----------
const BASE = import.meta.env.BASE_URL + 'assets/audio/';
const SFX_FILES = ['ui_click','spin_start','reel_stop','slash_01','slash_heavy','slash_chain','blade_hit','win_big','final_slash','drop','scatter_land','multiplier','meter_charge','meter_full','freespins_start','coin_tally','glitch_start'];
const bufs: Record<string, AudioBuffer> = {};
let unlocked = false;
function loadAll() {
  for (const n of SFX_FILES) fetch(BASE + n + '.mp3').then(r => r.arrayBuffer()).then(b => ctx!.decodeAudioData(b)).then(d => { bufs[n] = d; }).catch(() => {});
}
function play(n: string, vol = 1, rate = 1, delay = 0): boolean {
  const b = bufs[n]; if (!ctx || !master || !b) return false;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(ctx.currentTime + delay); return true;
}
const rr = (a = 0.94, b = 1.06) => a + Math.random() * (b - a);

// ---------- NHẠC NỀN (HTMLAudio, vòng lặp, crossfade) ----------
type Track = 'intro' | 'game' | 'freespins';
const MUSIC_VOL: Record<Track, number> = { intro: 0.55, game: 0.4, freespins: 0.45 };
const tracks: Record<string, HTMLAudioElement> = {};
let want: Track | null = null; let cur: Track | null = null;
let rain: HTMLAudioElement | null = null; let wantRain = false;
function el(n: string) { if (!tracks[n]) { const a = new Audio(BASE + 'music_' + n + '.mp3'); a.loop = true; a.preload = 'auto'; a.volume = 0; a.muted = muted; tracks[n] = a; } return tracks[n]; }
function fade(a: HTMLAudioElement, to: number, ms: number, stop = false) {
  const from = a.volume, t0 = performance.now();
  const id = (a as any)._f = ((a as any)._f || 0) + 1;
  const step = () => { if ((a as any)._f !== id) return; const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (stop) a.pause(); };
  step();
}
function applyMusic() {
  if (!unlocked) return;
  if (want !== cur) {
    if (cur) fade(el(cur), 0, 600, true);
    cur = want;
    if (cur) { const a = el(cur); a.currentTime = 0; a.volume = 0; a.play().catch(() => {}); fade(a, MUSIC_VOL[cur], 900); }
  }
  if (!rain) { rain = new Audio(BASE + 'ambience_rai.mp3'); rain.loop = true; rain.volume = 0; rain.muted = muted; tracks['rain'] = rain; }
  if (wantRain) { rain.play().catch(() => {}); fade(rain, 0.22, 1200); } else fade(rain, 0, 600, true);
}
export const music = {
  play(t: Track | null) { want = t; applyMusic(); },
  rain(on: boolean) { wantRain = on; applyMusic(); },
};
// mở khoá âm thanh ở lần chạm đầu tiên (trình duyệt chặn autoplay)
if (typeof window !== 'undefined') {
  const un = () => { initAudio(); };
  window.addEventListener('pointerdown', un); window.addEventListener('keydown', un);
}

export const sfx = {
  click() { if (!play('ui_click', 0.8)) tone(520, 0.06, 'square', 0.12); },
  spinStart() { if (!play('spin_start', 0.9)) { noise(0.35, 0.25, 700); tone(180, 0.3, 'sawtooth', 0.12, 420); } },
  reelStop() { if (!play('reel_stop', 0.7, rr(0.95, 1.05))) { tone(120, 0.12, 'sine', 0.35, 60); noise(0.06, 0.2, 300); } },
  win() { if (!play('scatter_land', 0.9)) [660, 880, 1100].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, undefined, i * 0.07)); },
  coin() { if (!play('coin_tally', 0.35, rr(0.95, 1.1))) tone(1400 + Math.random() * 400, 0.09, 'square', 0.06); },
  drum(n = 1, gap = 0.12) { for (let i = 0; i < n; i++) { if (!play('meter_charge', 0.8, 1 + i * 0.04, i * gap)) { tone(90 + i * 6, 0.16, 'sine', 0.4, 50, i * gap); noise(0.05, 0.15, 200, i * gap); } } },
  hit(level = 1) { if (!play('blade_hit', 0.7 + level * 0.12, level >= 3 ? 0.85 : rr(0.95, 1.05))) { tone(70, 0.5, 'sine', 0.55, 30); noise(0.35, 0.35 + level * 0.1, 500 + level * 300); } },
  slash() { if (!play('slash_01', 0.9, rr(0.92, 1.08))) { noise(0.28, 0.45, 3500, 0, 1.4); tone(900, 0.22, 'sawtooth', 0.12, 120); } },
  slashHeavy() { if (!play('slash_heavy', 1)) this.slash(); },
  chain() { if (!play('slash_chain', 1)) this.slash(); },
  glitch() { if (!play('glitch_start', 1)) this.slash(); },
  drop() { if (!play('drop', 0.6, rr(0.95, 1.05))) tone(100, 0.1, 'sine', 0.25, 60); },
  multiplier() { if (!play('multiplier', 0.9)) tone(880, 0.15, 'triangle', 0.2); },
  meterFull() { if (!play('meter_full', 0.9)) this.fanfare(); },
  bannerFS() { if (!play('freespins_start', 1)) this.fanfare(); },
  riser(dur = 2) { tone(160, dur, 'sawtooth', 0.12, 900); noise(dur, 0.12, 2500); },
  finalSlash() { if (!play('final_slash', 1)) this.riser(1.4); },
  fanfare() { if (!play('win_big', 0.9)) [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, undefined, i * 0.1)); },
};
