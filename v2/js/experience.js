// Splash screen, background music and Story Mode (auto-scroll + narration + captions).
import { getLang, onLangChange, setLang, tr, applyI18n } from './i18n.js';
export { getLang, onLangChange };
const $ = id => document.getElementById(id);
const ROOT = '../';
const ORDER = ['hero', 'about', 'skills', 'portfolio', 'certifications', 'resume', 'contact'];
const LABELS = [['Prologue', 'The Crystal Shrine'], ['Chapter I', "The Adventurer's Camp"], ['Chapter II', 'The Training Grounds'], ['Chapter III', 'The Guild Isles'], ['Chapter IV', 'The Relic Vault'], ['Chapter V', 'The Long Road'], ['Chapter VI', 'The Beacon']];
const label = i => tr(LABELS[i][0]) + ' · ' + tr(LABELS[i][1]);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const splitSentences = t => (String(t).match(/.+?(?:[.!?…]+["')\]]*(?=\s|$)|$)/g) || [t]).map(s => s.trim()).filter(Boolean);

/* ================= language (see i18n.js) ================= */

let lang = getLang();
onLangChange(l => { lang = l; });

/* ================= music: a theme per island, generated live (or your own MP3s from Firestore) ================= */

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// Each theme: root note, scale, chord progression (scale degrees), tempo and which instruments play.
const THEMES = [
  { name: 'shrine', root: 62, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 60, pad: 'sine', padCut: 900, arp: 'bell', arpEvery: 2, arpPat: [0, 2, 4, 6, 4, 2], bass: false, drums: 'none', lead: false, sparkle: 0.35, padLvl: 0.05, wet: 0.9 },       // Prologue: dreamy lydian
  { name: 'camp', root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 84, pad: 'triangle', padCut: 1100, arp: 'pluck', arpEvery: 1, arpPat: [0, 2, 4, 2, 7, 4, 2, 4], bass: true, drums: 'shaker', lead: false, sparkle: 0, padLvl: 0, wet: 0.3, strum: true, gain: 1.6 }, // I: warm, acoustic
  { name: 'training', root: 52, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6], bpm: 100, pad: 'sawtooth', padCut: 700, arp: 'pluck', arpEvery: 0.5, arpPat: [0, 0, 7, 0, 3, 0, 7, 5], bass: true, drums: 'taiko', lead: false, sparkle: 0, padLvl: 0, wet: 0.25, stab: true }, // II: driving
  { name: 'guild', root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0, 5, 3, 4, 4], bpm: 92, pad: 'sawtooth', padCut: 1300, arp: 'pluck', arpEvery: 1, arpPat: [0, 4, 7, 4], bass: true, drums: 'march', lead: [7, 7, 9, 11, 12, 11, 9, 7, 5, 4, 5, 7], sparkle: 0, padLvl: 0, wet: 0.4, brass: true }, // III: adventure
  { name: 'vault', root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], bpm: 66, pad: 'choir', padCut: 1000, arp: 'musicbox', arpEvery: 1, arpPat: [7, 3, 5, 0, 3, 7, 10, 7], bass: false, drums: 'none', lead: false, sparkle: 0.25, padLvl: 0.045, wet: 0.95 }, // IV: mysterious
  { name: 'road', root: 53, scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 3, 5, 4], bpm: 72, pad: 'sine', padCut: 1000, arp: 'piano', arpEvery: 1, arpPat: [0, 4, 7, 9, 7, 4], bass: true, drums: 'none', lead: false, sparkle: 0, padLvl: 0, wet: 0.55, gain: 1.9 }, // V: reflective
  { name: 'beacon', root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3, 0, 4, 3, 4], bpm: 88, pad: 'sawtooth', padCut: 1600, arp: 'pluck', arpEvery: 0.5, arpPat: [0, 4, 7, 12, 7, 4], bass: true, drums: 'timpani', lead: [12, 11, 9, 7, 9, 11, 12, 14], sparkle: 0, padLvl: 0, wet: 0.5, brass: true }, // VI: triumphant
  { name: 'oracle', root: 59, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 4, 3], bpm: 56, pad: 'choir', padCut: 1400, arp: 'bell', arpEvery: 2, arpPat: [12, 7, 11, 4, 9, 6], bass: false, drums: 'none', lead: false, sparkle: 0.4, padLvl: 0.045, wet: 1 }  // Oracle: ethereal
];

const music = {
  ctx: null, master: null, on: store.get('pf-music') !== 'off', duckLevel: 1, tracks: {}, timer: 0,
  current: null, // { theme, bus, next, step, bar, idx }
  fileEl: null,
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.8;
    this.reverb.connect(wet).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  },
  // ---- instruments (each note routes through its theme's bus: dry + reverb)
  env(bus, t, a, peak, d, rev = 0.5) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(bus.dry); const s = this.ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(bus.wet);
    return g;
  },
  osc(type, f, t, dur, out, detune = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(t + dur + 0.1);
    return o;
  },
  pad(bus, th, freqs, t, dur) {
    const ctx = this.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = th.padCut; lp.Q.value = 0.5;
    const g = ctx.createGain();
    const lvl = th.padLvl || 0.03;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + Math.min(2.2, dur * 0.4)); g.gain.setValueAtTime(lvl, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    lp.connect(g); g.connect(bus.dry); const s = ctx.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(bus.wet);
    freqs.forEach(f => {
      if (th.pad === 'choir') { // soft vowel-ish stack with slow vibrato
        [0, 1].forEach(k => { const o = this.osc(k ? 'triangle' : 'sine', f * (k ? 2 : 1), t, dur + 1.6, lp, k ? 4 : -4); const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 4.5; vg.gain.value = 4; v.connect(vg).connect(o.detune); v.start(t); v.stop(t + dur + 1.7); });
      } else {
        this.osc(th.pad, f, t, dur + 1.6, lp, -6); this.osc(th.pad === 'sawtooth' ? 'triangle' : th.pad, f, t, dur + 1.6, lp, 6);
      }
    });
  },
  note(bus, kind, f, t) {
    const ctx = this.ctx;
    if (kind === 'pluck') { // bright attack that closes quickly, like a plucked string
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
      lp.connect(this.env(bus, t, 0.005, 0.07, 0.6, 0.35)); this.osc('sawtooth', f, t, 0.7, lp); this.osc('triangle', f * 2, t, 0.4, lp);
    } else if (kind === 'bell' || kind === 'musicbox') {
      const e = this.env(bus, t, 0.004, kind === 'bell' ? 0.045 : 0.035, kind === 'bell' ? 3.2 : 1.4, 0.8);
      this.osc('sine', f * (kind === 'musicbox' ? 2 : 1), t, 3.3, e); this.osc('sine', f * 2.76, t, 1.2, this.env(bus, t, 0.004, 0.012, 0.8, 0.8));
    } else if (kind === 'piano') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      lp.connect(this.env(bus, t, 0.006, 0.06, 1.8, 0.5)); this.osc('triangle', f, t, 2, lp); this.osc('sine', f * 2, t, 1.2, lp);
    } else if (kind === 'lead') { // horn-like
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const e = this.env(bus, t, 0.08, 0.04, 0.9, 0.6); lp.connect(e);
      const o = this.osc('sawtooth', f, t, 1, lp); const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 5; vg.gain.value = 6; v.connect(vg).connect(o.detune); v.start(t); v.stop(t + 1);
    } else if (kind === 'stab') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      lp.connect(this.env(bus, t, 0.01, 0.05, 0.35, 0.3)); this.osc('sawtooth', f, t, 0.45, lp, -8); this.osc('sawtooth', f, t, 0.45, lp, 8);
    } else if (kind === 'brass') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(1800, t + 0.12); lp.frequency.exponentialRampToValueAtTime(900, t + 0.8);
      lp.connect(this.env(bus, t, 0.06, 0.03, 1.1, 0.5)); this.osc('sawtooth', f, t, 1.2, lp, -5); this.osc('sawtooth', f, t, 1.2, lp, 5);
    } else if (kind === 'bass') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      lp.connect(this.env(bus, t, 0.01, 0.09, 1.1, 0.15)); this.osc('triangle', f, t, 1.2, lp);
    }
  },
  drum(bus, kind, t, accent) {
    const ctx = this.ctx;
    if (kind === 'kick' || kind === 'taiko' || kind === 'timpani') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const f0 = kind === 'timpani' ? 110 : kind === 'taiko' ? 140 : 120, f1 = kind === 'timpani' ? 70 : 45;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.22 : 0.13, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'timpani' ? 1.2 : 0.5));
      o.connect(g); g.connect(bus.dry); const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(bus.wet);
      o.start(t); o.stop(t + 1.3);
    } else { // shaker / snare-ish noise
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'snare' ? 1800 : 6000;
      n.connect(hp); hp.connect(this.env(bus, t, 0.002, kind === 'snare' ? 0.05 : 0.018, kind === 'snare' ? 0.18 : 0.07, 0.2));
      n.start(t); n.stop(t + 0.3);
    }
  },
  // ---- the scheduler: plays one theme bar by bar, a little ahead of time
  play(idx) {
    if (!this.ctx || (this.current && this.current.idx === idx)) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const fadeTo = (param, v, secs) => { param.cancelScheduledValues(now); param.setValueAtTime(Math.max(0.0001, param.value), now); param.linearRampToValueAtTime(v, now + secs); };
    if (this.current) { const old = this.current.bus; fadeTo(old.gain.gain, 0.0001, 3); fadeTo(old.wet.gain, 0.0001, 3); setTimeout(() => { old.gain.disconnect(); old.wet.disconnect(); }, 4500); }
    // each theme gets its own bus (dry + reverb send) so two themes can crossfade
    const gain = ctx.createGain(); gain.connect(this.master);
    const dry = ctx.createGain(); dry.connect(gain);
    const wet = ctx.createGain(); wet.connect(this.reverb);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.linearRampToValueAtTime(THEMES[idx].gain || 1, now + 3); // quieter themes get a little lift
    wet.gain.setValueAtTime(0.0001, now); wet.gain.linearRampToValueAtTime(THEMES[idx].wet ?? 0.7, now + 3);
    const bus = { gain, dry, wet };
    this.current = { theme: THEMES[idx], bus, next: now + 0.1, step: 0, idx };
    if (!this.timer) this.timer = setInterval(() => this.tick(), 100);
  },
  tick() {
    const cur = this.current;
    if (!cur || !this.ctx) return;
    const th = cur.theme, beat = 60 / th.bpm, ahead = this.ctx.currentTime + 0.35;
    while (cur.next < ahead) {
      const t = cur.next, s = cur.step, bar = Math.floor(s / 4), inBar = s % 4;
      const deg = th.prog[bar % th.prog.length];
      const chordNote = k => { const i = deg + k, oct = Math.floor(i / th.scale.length); return th.root + th.scale[i % th.scale.length] + 12 * oct; };
      const chord = [chordNote(0) - 12, chordNote(2), chordNote(4), chordNote(6)].map(midi);
      if (th.padLvl && inBar === 0) this.pad(cur.bus, th, chord, t, beat * 4);
      if (th.strum && (inBar === 0 || inBar === 2)) chord.forEach((f, k) => this.note(cur.bus, 'pluck', f, t + k * 0.028 + (inBar === 2 ? 0.01 : 0)));
      if (th.stab && (inBar === 0 || inBar === 3)) chord.slice(0, 3).forEach(f => this.note(cur.bus, 'stab', f / 2, t));
      if (th.brass && (inBar === 0 || (inBar === 2 && bar % 2 === 1))) chord.slice(1).forEach(f => this.note(cur.bus, 'brass', f, t));
      if (th.bass && (inBar === 0 || inBar === 2)) this.note(cur.bus, 'bass', midi(chordNote(0) - 24), t);
      // arpeggio: every `arpEvery` beats
      // arpeggio: one note every `arpEvery` beats (0.5 = two per beat)
      if (th.arpEvery >= 1) {
        const every = Math.round(th.arpEvery);
        if (s % every === 0) this.note(cur.bus, th.arp, midi(chordNote(0) + th.arpPat[Math.floor(s / every) % th.arpPat.length]), t);
      } else {
        for (let k = 0; k < 2; k++) this.note(cur.bus, th.arp, midi(chordNote(0) + th.arpPat[(s * 2 + k) % th.arpPat.length]), t + k * beat / 2);
      }
      // a melody on the second half of every 8 bars
      if (th.lead && bar % 8 >= 4 && inBar !== 3) this.note(cur.bus, 'lead', midi(th.root + th.lead[s % th.lead.length]), t);
      if (th.drums === 'shaker') { this.drum(cur.bus, 'shaker', t); this.drum(cur.bus, 'shaker', t + beat / 2); }
      if (th.drums === 'taiko' && (inBar === 0 || inBar === 2)) { this.drum(cur.bus, 'taiko', t, inBar === 0); if (inBar === 2) this.drum(cur.bus, 'taiko', t + beat * 0.75); }
      if (th.drums === 'march') { this.drum(cur.bus, 'kick', t, inBar === 0); if (inBar % 2 === 1) this.drum(cur.bus, 'snare', t); }
      if (th.drums === 'timpani' && inBar === 0 && bar % 2 === 0) this.drum(cur.bus, 'timpani', t, true);
      if (th.sparkle && Math.random() < th.sparkle) this.note(cur.bus, 'bell', midi(chordNote(0) + 12 + th.scale[[0, 2, 4][Math.floor(Math.random() * 3)]]), t + (Math.random() < 0.5 ? 0 : beat / 2));
      cur.next += beat; cur.step++;
    }
  },
  // ---- which theme: the current island, or the Oracle's Isle
  sync() {
    if (!this.on || !this.ctx) return;
    const sh = hooks.shared || {};
    const idx = sh.oracle ? 7 : Math.max(0, Math.min(6, sh.level || 0));
    const key = THEMES[idx].name;
    if (this.tracks[key] || this.tracks.all) return this.playFile(this.tracks[key] || this.tracks.all, key);
    this.stopFile();
    this.play(idx);
  },
  // ---- your own recordings: site/music { tracks: { shrine, camp, training, guild, vault, road, beacon, oracle, all } }
  playFile(url, key) {
    if (this.fileKey === key) return;
    this.fileKey = key;
    if (this.current) { this.current.bus.gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 2); this.current = null; }
    const prev = this.fileEl, next = new Audio(url);
    next.loop = true; next.volume = 0; next.play().catch(() => {});
    this.fileEl = next;
    const t0 = performance.now();
    const fade = now => {
      const k = Math.min(1, (now - t0) / 2500);
      next.volume = k * this.level() * 1.6;
      if (prev) prev.volume = Math.max(0, (1 - k) * prev.volume);
      if (k < 1) requestAnimationFrame(fade); else if (prev) prev.pause();
    };
    requestAnimationFrame(fade);
  },
  stopFile() { if (this.fileEl) { this.fileEl.pause(); this.fileEl = null; this.fileKey = null; } },
  level() { return this.on ? 0.55 * this.duckLevel : 0; },
  apply() {
    if (this.ctx) { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.6); }
    if (this.fileEl) this.fileEl.volume = Math.min(1, this.level() * 1.6);
  },
  start() {
    if (!this.on) return this.syncButton();
    this.claim();
    this.ensure();
    if (!this.ctx) return;
    this.ctx.resume();
    if (!this.watch) this.watch = setInterval(() => this.sync(), 700);
    this.sync(); this.apply(); this.syncButton();
  },
  toggle() {
    this.on = !this.on;
    store.set('pf-music', this.on ? 'on' : 'off');
    if (this.on) this.start(); else { this.apply(); if (this.fileEl) this.fileEl.pause(); this.syncButton(); }
  },
  duck(d) { this.duckLevel = d ? 0.3 : 1; this.apply(); },
  // only one tab plays music: starting here quiets the portfolio in any other open tab
  channel: 'BroadcastChannel' in window ? new BroadcastChannel('pf-music') : null,
  claim() { if (this.channel) this.channel.postMessage('playing'); },
  yieldToOtherTab() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    if (this.fileEl) this.fileEl.pause();
    setTimeout(() => this.ctx && this.ctx.suspend(), 1200);
  },
  syncButton() {
    const b = $('musicBtn');
    b.setAttribute('aria-pressed', String(this.on));
    b.setAttribute('aria-label', tr(this.on ? 'Turn music off' : 'Turn music on'));
    b.querySelector('use').setAttribute('href', this.on ? '#i-volume-2' : '#i-volume-x');
  }
};
document.addEventListener('visibilitychange', () => {
  if (music.ctx) document.hidden ? music.ctx.suspend() : music.on && music.ctx.resume();
  if (music.fileEl) document.hidden ? music.fileEl.pause() : music.on && music.fileEl.play().catch(() => {});
});
if (music.channel) music.channel.onmessage = e => { if (e.data === 'playing') music.yieldToOtherTab(); };
// coming back to this tab takes the music back
document.addEventListener('visibilitychange', () => { if (!document.hidden && music.ctx && music.on) { music.claim(); music.ctx.resume(); music.apply(); } });
export const duckMusic = d => music.duck(d);
export function setMusicTracks(tracks) { music.tracks = tracks || {}; if (music.ctx) { music.fileKey = null; music.sync(); } }

/* ================= splash ================= */

const WEIGHTS = { data: 25, fonts: 10, engine: 35, world: 20, frames: 10 };
const done = new Set();
let shown = 0, target = 0, entered = false, readyShown = false, onEnterCb = () => {};
function tickBar() {
  shown += (target - shown) * 0.12;
  if (target - shown < 0.3) shown = target;
  $('splashBar').style.width = shown + '%';
  document.querySelector('.splash-bar').setAttribute('aria-valuenow', String(Math.round(shown)));
  if (shown < 100 && !entered) requestAnimationFrame(tickBar);
}
const STATUS = { data: 'Gathering the chronicles…', fonts: 'Inking the runes…', engine: 'Raising the floating isles…', world: 'Lighting the crystals…', frames: 'The world awaits' };
export function progress(step) {
  if (done.has(step) || !(step in WEIGHTS)) return;
  done.add(step);
  target = [...done].reduce((a, k) => a + WEIGHTS[k], 0);
  const next = Object.keys(WEIGHTS).find(k => !done.has(k));
  $('splashStatus').textContent = tr(next ? STATUS[next] : STATUS.frames);
  requestAnimationFrame(tickBar);
  if (done.size === Object.keys(WEIGHTS).length) showReady();
}
function showReady() {
  if (readyShown) return;
  readyShown = true;
  if (window.__resume) return enter(false); // recovering from a GPU reset: straight back in, no splash
  target = 100;
  $('splashStatus').textContent = tr(STATUS.frames);
  $('splashActions').hidden = false;
  $('splashStory').focus({ preventScroll: true });
}
function enter(withStory) {
  if (entered) return;
  entered = true;
  if (withStory) unlockAudio(); // exploring loads no narration; the story button unlocks audio itself
  music.start();
  const sp = $('splash');
  sp.classList.add('is-leaving');
  setTimeout(() => sp.remove(), 900);
  document.documentElement.classList.remove('splash-lock');
  onEnterCb();
  if (withStory) story.start(0);
  else flyIn(3.2);
}
function flyIn(seconds) {
  if (reduceMotion || !hooks.shared) return;
  hooks.shared.introDur = seconds;
  hooks.shared.intro = 1;
}

/* ================= story mode ================= */

let texts = {};              // chapter → [{ focus, en, id }] beats from Firestore
let hooks = { closeOverlays() {}, openOracle() {}, setFilter() {}, setResTab() {}, goCertByTitle() {}, shared: null };
let clipCache = {};
function setTitle(label, name) {
  const t = $('cineTitle');
  t.querySelector('.label-cinzel').textContent = label;
  t.querySelector('b').textContent = name;
}
const player = new Audio();
player.preload = 'auto';
function unlockAudio() {
  if (player.dataset.unlocked) return;
  player.dataset.unlocked = '1';
  // play a real clip muted for a moment during the tap; the element is then allowed to play later
  player.src = `${ROOT}assets/audio/story/${lang}/hero.mp3`;
  player.muted = true;
  player.play().then(() => { if (!story.audio) player.pause(); player.muted = false; }).catch(() => { player.muted = false; });
  if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
}
const stripTags = t => String(t).replace(/\[[^\]]*\]\s*/g, '').replace(/\s{2,}/g, ' ').trim();

// Pre-generated ElevenLabs narration (assets/audio/story/<lang>/<chapter>.mp3 + .json); null when missing.
async function loadClip(ch, l) {
  const key = l + '/' + ch;
  if (key in clipCache) return clipCache[key];
  let clip = null;
  try {
    const r = await fetch(`${ROOT}assets/audio/story/${l}/${ch}.json`);
    if (r.ok) { const j = await r.json(); clip = { src: `${ROOT}assets/audio/story/${l}/${ch}.mp3`, ...j }; }
  } catch (e) { /* offline or missing */ }
  return (clipCache[key] = clip);
}

// ---- where each beat points the camera
const docTop = el => el.getBoundingClientRect().top + scrollY;
const SCENIC = ['world', 'obelisks', 'isles', 'beacon'];
const setScenic = on => document.body.classList.toggle('scenic', !!on);
const RES_GROUP = { summary: 0, work: 1, education: 2, achievement: 3, leadership: 4 };
function band() {
  const top = document.querySelector('.nav').getBoundingClientRect().bottom + 12;
  const bar = $('storybar');
  const bottom = (bar.hidden ? innerHeight : bar.getBoundingClientRect().top) - 12;
  return { top, bottom, h: Math.max(80, bottom - top) };
}
// scroll position that shows el between the nav and the subtitles: centred if it fits, else its top at the top of the band
function bandY(el) {
  const b = band(), h = el.offsetHeight || el.getBoundingClientRect().height;
  return h <= b.h ? docTop(el) + h / 2 - (b.top + b.h / 2) : docTop(el) - b.top;
}
function bringIntoView(el) {
  if (!el) return;
  const r = el.getBoundingClientRect(), b = band();
  if (r.top >= b.top - 2 && r.bottom <= b.bottom + 2) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollToY(Math.max(0, Math.min(max, bandY(el))), reduceMotion ? 0 : 700, () => !spots.some(x => x.el === el));
}
function focusY(focus, ch) {
  const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
  const center = el => bandY(el);
  const [kind, arg] = String(focus || '').split(':');
  let y;
  switch (kind) {
    case 'world': y = 0; break;
    case 'hero': y = 0; break; // the prologue's title page: name, roles and buttons
    case 'about': y = docTop($('about')) + Math.max(40, ($('about').offsetHeight - vh) / 2); break;
    case 'about-facts': y = center($('aboutFacts')); break;
    case 'about-text': y = center($('aboutText')); break;
    case 'obelisks': y = docTop($('skills')); break;
    case 'skill-grid': y = docTop($('skillGrid')) - band().top - 8; break;
    case 'traits': y = docTop($('traitsPanel')) - band().top + 4; break;
    case 'isles': y = docTop($('portfolio')); break;
    case 'filter': hooks.setFilter(arg); y = docTop(document.querySelector('#portfolio .filterbar')) - band().top + 4; break;
    case 'vault': y = docTop($('certifications')); break;
    case 'summary': case 'work': case 'education': case 'achievement': case 'leadership': {
      hooks.setResTab(RES_GROUP[kind] === 1 ? 0 : RES_GROUP[kind]);
      const g = document.querySelector(`.res-group[data-group="${RES_GROUP[kind]}"]`);
      y = g ? docTop(g) - band().top - 8 : docTop($('resume')) + 40; break;
    }
    case 'beacon': y = docTop($('contact')) + 40; break;
    case 'oracle': y = center(document.querySelector('.oracle-cta')); break;
    default: y = ch === 'hero' ? 0 : docTop($(ch)) + 40;
  }
  return Math.max(0, Math.min(max, y));
}

// ---- word-level cues: spotlight what the narrator names, the moment it is said
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '');
const normText = t => String(t).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim();

// word timings: exact when the clip has them, otherwise spread across each sentence by character position
function clipWords(clip) {
  if (Array.isArray(clip.words) && clip.words.length) return clip.words.map(w => ({ n: norm(w.w), t: w.t }));
  const out = [];
  (clip.sentences || []).forEach(s => {
    const len = Math.max(1, s.text.length);
    let pos = 0;
    s.text.split(/\s+/).forEach(w => {
      const at = s.text.indexOf(w, pos);
      pos = at + w.length;
      out.push({ n: norm(w), t: s.start + (s.end - s.start) * (Math.max(0, at) / len) });
    });
  });
  return out;
}
function timeCues(beats, words, times) {
  const found = [];
  beats.forEach((b, k) => {
    const start = (times[k] || {}).start || 0, end = (times[k] || {}).end;
    let from = words.findIndex(w => w.t >= start - 0.3);
    if (from < 0) from = 0;
    let prev = start + 0.4;
    (b.cues || []).forEach(c => {
      const toks = normText(c[lang] || c.en).split(' ').filter(Boolean).map(norm);
      for (let i = from; i < words.length; i++) {
        if (toks.every((tk, j) => words[i + j] && (words[i + j].n === tk || words[i + j].n.startsWith(tk)))) {
          let t = words[i].t;
          // a word said right before the screen moves on would only flash: light it up to 2 s earlier (never before the previous cue)
          if (end && end < 1e8 && end - t < 2) t = Math.max(prev, Math.min(t, end - 2));
          found.push({ t, show: c.show });
          prev = t + 0.9;
          return;
        }
      }
    });
  });
  return found.sort((x, y) => x.t - y.t);
}

let spots = [];                 // [{ el, kind }]
function clearSpots(kind) {
  spots = spots.filter(x => { if (kind && x.kind !== kind) return true; x.el.classList.remove('is-spot'); return false; });
  document.body.classList.toggle('has-spot', spots.length > 0);
  if (hooks.shared && (!kind || kind === 'skill')) hooks.shared.hoverSkill = -1;
}
const visible = el => el && el.offsetParent !== null;
let spotKind = '';
// the element the narrator is talking about glows; its neighbours dim (see .has-spot in the CSS)
function spot(el) { if (el) { el.classList.add('is-spot'); spots.push({ el, kind: spotKind }); document.body.classList.add('has-spot'); } }
function spotlight(show) {
  const i = show.indexOf(':'), kind = i < 0 ? show : show.slice(0, i), arg = i < 0 ? '' : show.slice(i + 1);
  clearSpots(kind);
  spotKind = kind;
  // "a|b" tries each text (one per language); "#id" picks a resume entry by its Firestore id
  const find = (sel, text) => text.startsWith('#') ? document.querySelector(`${sel}[data-rid="${CSS.escape(text.slice(1))}"]`) : text.split('|').map(t => [...document.querySelectorAll(sel)].filter(visible).find(el => normText(el.textContent).includes(normText(t)))).find(Boolean);
  switch (kind) {
    case 'skill': {
      const tiles = [...document.querySelectorAll('.skill')], nameOf = t => normText(t.querySelector('.skill-name b').dataset.full || '');
      const el = tiles.find(t => nameOf(t) === normText(arg)) || tiles.find(t => nameOf(t).split(' ')[0] === normText(arg)) || tiles.find(t => nameOf(t).startsWith(normText(arg)));
      if (el) { spot(el); bringIntoView(el); if (hooks.shared) hooks.shared.hoverSkill = +el.dataset.skill; }
      break;
    }
    case 'card': {
      const el = document.querySelector(`.card[data-quest="${CSS.escape(arg)}"]`);
      if (el) {
        spot(el);
        // phones: the quest row is a horizontal carousel — slide the card in without moving the page
        const row = el.parentElement;
        if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
        bringIntoView(el);
      }
      break;
    }
    case 'cert': hooks.goCertByTitle(arg); spot(document.querySelector('.cert-ctrl')); break;
    case 'res': {
      const el = find('.tl-item', arg);
      if (el) { spot(el); bringIntoView(el); }
      break;
    }
    case 'text': { const el = find('#aboutText p', arg); spot(el); bringIntoView(el); break; }
    case 'fact': { const el = find('#aboutFacts .glist-row', arg); spot(el); bringIntoView(el); break; }
    case 'trait': {
      const el = find('.trait', arg);
      spot(el);
      if (el && el.parentElement.scrollWidth > el.parentElement.clientWidth) el.parentElement.scrollTo({ left: el.offsetLeft - (el.parentElement.clientWidth - el.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      bringIntoView(el);
      break;
    }
    case 'form': spot($('contactForm')); bringIntoView($('contactForm')); break;
    case 'oracle': spot(document.querySelector('.oracle-cta')); bringIntoView(document.querySelector('.oracle-cta')); break;
  }
}

const story = {
  on: false, i: 0, paused: false, token: 0, audio: null, pan: null, beat: -1, beatEnd: 0,
  start(from = 0) {
    hooks.closeOverlays();
    this.on = true; this.paused = false;
    document.body.classList.add('story-on');
    $('storybar').hidden = false;
    this.renderDots();
    if (from === 0) return this.prologue();
    this.play(from);
  },
  // letterbox, only the floating world on screen, the camera glides in under a title card — then the narrator begins
  async prologue() {
    const token = ++this.token;
    this.halt();
    this.i = 0; this.beat = -1; this.renderDots();
    $('storyChap').textContent = label(0);
    $('storyCap').textContent = '';
    setTitle(tr('Level 1 · The beginning of a dream'), tr('The Tale of Doddy Suryadharma'));
    document.body.classList.add('cinematic');
    if (hooks.shared) hooks.shared.heroFocus = 1;
    window.scrollTo(0, 0);
    flyIn(7);
    await sleep(reduceMotion ? 0 : 700);
    if (token !== this.token) return;
    $('cineTitle').classList.add('is-on');
    await sleep(reduceMotion ? 1500 : 4200);
    $('cineTitle').classList.remove('is-on');
    await sleep(reduceMotion ? 0 : 900);
    if (token === this.token) this.play(0);
  },
  endCinematic() {
    if (hooks.shared) hooks.shared.heroFocus = 0;
    document.body.classList.remove('cinematic');
    $('cineTitle').classList.remove('is-on');
  },
  stop() {
    this.token++;
    this.on = false; this.paused = false;
    this.halt();
    document.body.classList.remove('story-on');
    setScenic(false);
    clearSpots();
    this.endCinematic();
    $('storybar').hidden = true;
    duckMusic(false);
    hooks.setFilter('all');
  },
  halt() {
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.pan = null;
  },
  renderDots() {
    $('storyDots').innerHTML = ORDER.map((_, k) => `<i class="${k < this.i ? 'is-past' : k === this.i ? 'is-on' : ''}"></i>`).join('');
  },
  setPlayIcon() {
    $('storyPlay').querySelector('use').setAttribute('href', this.paused ? '#i-play' : '#i-pause');
    $('storyPlay').setAttribute('aria-label', tr(this.paused ? 'Resume story' : 'Pause story'));
    $('storybar').classList.toggle('is-paused', this.paused);
  },
  pause() {
    if (!this.on || this.paused) return;
    this.paused = true;
    if (this.audio) this.audio.pause();
    if ('speechSynthesis' in window) speechSynthesis.pause();
    duckMusic(false);
    setScenic(false);
    this.setPlayIcon();
  },
  // continue exactly where the narrator stopped, after bringing the current beat back into view
  async resume() {
    if (!this.on || !this.paused) return;
    const token = this.token;
    this.paused = false; this.setPlayIcon();
    const beats = texts[ORDER[this.i]] || [];
    if (beats[this.beat]) setScenic(SCENIC.includes(beats[this.beat].focus));
    if (beats[this.beat]) await scrollToY(focusY(beats[this.beat].focus, ORDER[this.i]), reduceMotion ? 0 : 900, () => token !== this.token);
    if (token !== this.token || this.paused) return;
    duckMusic(true);
    if (this.audio) this.audio.play().catch(() => {});
    else if ('speechSynthesis' in window) speechSynthesis.resume();
  },
  next() { if (this.on) this.play(this.i + 1); },
  async play(i) {
    const token = ++this.token;
    this.halt();
    this.paused = false; this.setPlayIcon();
    if (i >= ORDER.length) return this.finish();
    this.i = i; this.beat = -1;
    clearSpots();
    this.renderDots();
    const ch = ORDER[i], beats = texts[ch] || [{ focus: '', en: '', id: '' }];
    if (ch !== 'portfolio') hooks.setFilter('all');
    $('storyChap').textContent = label(i);
    $('storyCap').textContent = '';
    const landing = focusY(beats[0].focus, ch), cancelled = () => token !== this.token;
    if (i > 0 && !reduceMotion) {
      // chapter cutscene: panels hidden, title card, the camera circles this chapter's island, then the page returns
      const num = tr(LABELS[i][0]), name = tr(LABELS[i][1]), lv = hooks.levelOf ? hooks.levelOf(i) : null;
      setTitle(lv ? `${num} · Lv ${lv[0]}` : num, name);
      document.body.classList.add('cinematic');
      if (hooks.shared) hooks.shared.heroFocus = 1;
      if (hooks.shared) { hooks.shared.orbitDur = 4.4; hooks.shared.orbitDir = i % 2 ? 1 : -1; hooks.shared.orbit = 1; }
      await sleep(250);
      if (cancelled()) return;
      $('cineTitle').classList.add('is-on');
      await scrollToY(landing, 1500, cancelled);
      await sleep(2100);
      if (cancelled()) return;
      $('cineTitle').classList.remove('is-on');
      await sleep(600);
      if (cancelled()) return;
      this.endCinematic();
      await sleep(700);
    } else {
      if (i > 0) this.endCinematic();
      await scrollToY(landing, reduceMotion ? 0 : 1600, cancelled);
    }
    if (token !== this.token) return;
    duckMusic(true);
    const clip = await loadClip(ch, lang);
    if (token !== this.token) return;
    const ok = clip ? await this.speakClip(clip, beats, token) : await this.speakTts(beats, token);
    if (!ok || token !== this.token) return;
    duckMusic(false);
    await sleep(800);
    if (token === this.token && !this.paused) this.play(i + 1);
  },
  // move the screen to what the narrator is about to talk about
  enterBeat(k, beats, seconds, token) {
    if (k === this.beat) return;
    this.beat = k;
    clearSpots();
    const b = beats[k], ch = ORDER[this.i];
    if (!b) return;
    setScenic(SCENIC.includes(b.focus));
    if (b.focus === 'hero') this.endCinematic(); // the prologue opens as a cutscene, then reveals the title page
    const y = focusY(b.focus, ch);
    this.pan = null;
    scrollToY(y, reduceMotion ? 0 : 1100, () => token !== this.token || this.beat !== k).then(() => {
      // without word cues, the vault simply turns through every relic while it is described
      if (b.focus === 'vault' && !(b.cues || []).length && token === this.token && this.beat === k) {
        const el = $('certifications'), end = docTop(el) + Math.max(0, el.offsetHeight - innerHeight) - 2;
        this.sweep(y, end, Math.max(2, seconds - 1.1));
      }
    });
  },
  sweep(from, to, seconds) {
    if (reduceMotion || to <= from + 4) return;
    const p = this.pan = { from, to, dur: seconds * 1000, t: 0, last: performance.now() };
    const step = now => {
      if (this.pan !== p) return;
      if (!this.paused) { p.t += now - p.last; window.scrollTo(0, p.from + (p.to - p.from) * Math.min(1, p.t / p.dur)); }
      p.last = now;
      if (p.t < p.dur) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  speakClip(clip, beats, token) {
    return new Promise(resolve => {
      const a = this.audio = player;
      a.muted = false;
      a.src = clip.src;
      // a dramatic pause ('...') is heard, not captioned
      const sents = (clip.sentences || [{ text: stripTags(clip.text), start: 0, end: 1e9 }]).filter(x => /[\p{L}\p{N}]/u.test(x.text));
      const times = clip.beats || [{ start: 0, end: 1e9 }];
      const cues = timeCues(beats, clipWords(clip), times);
      const LEAD = 0.6; // start moving a little early so the target is on screen when its words are heard
      let fired = 0, running = false;
      const frame = () => {
        if (this.audio !== a || token !== this.token || a.paused || a.ended) { running = false; return; }
        const tm = a.currentTime;
        let k = 0;
        for (let j = 0; j < times.length; j++) if (tm >= times[j].start - (j ? LEAD : 0)) k = j;
        this.enterBeat(k, beats, (times[k].end || a.duration || 5) - tm, token);
        while (fired < cues.length && tm >= cues[fired].t - 0.15) spotlight(cues[fired++].show);
        const s = sents.find(x => tm >= x.start - 0.1 && tm < x.end + 0.25) || sents.find(x => tm < x.start) || sents[sents.length - 1];
        if (s && $('storyCap').textContent !== s.text) $('storyCap').textContent = s.text;
        requestAnimationFrame(frame);
      };
      const onPlaying = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
      const cleanup = () => { a.removeEventListener('playing', onPlaying); a.removeEventListener('ended', onEnded); a.removeEventListener('error', fallback); };
      const onEnded = () => { cleanup(); resolve(token === this.token); };
      const fallback = () => { cleanup(); if (this.audio !== a || token !== this.token) return resolve(false); this.audio = null; this.speakTts(beats, token).then(resolve); };
      a.addEventListener('playing', onPlaying);
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', fallback);
      a.play().catch(e => { if (e && e.name === 'AbortError') return; fallback(); });
    });
  },
  // Fallback when no MP3 exists: the browser's own voice, beat by beat, one sentence at a time.
  async speakTts(beats, token) {
    const synth = 'speechSynthesis' in window ? speechSynthesis : null;
    const voice = synth && synth.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
    for (let k = 0; k < beats.length; k++) {
      const text = stripTags(beats[k][lang] || beats[k].en);
      this.enterBeat(k, beats, Math.max(3, text.length / 14), token);
      for (const s of splitSentences(text).filter(x => /[\p{L}\p{N}]/u.test(x))) {
        if (token !== this.token) return false;
        $('storyCap').textContent = s;
        (beats[k].cues || []).forEach(c => { if (norm(s).includes(norm(c[lang] || c.en))) spotlight(c.show); });
        if (synth) {
          await new Promise(res => {
            const u = new SpeechSynthesisUtterance(s);
            u.lang = lang === 'id' ? 'id-ID' : 'en-US';
            if (voice) u.voice = voice;
            u.rate = 0.97; u.onend = u.onerror = res;
            synth.speak(u);
          });
        } else await sleep(s.length / 14 * 1000);
        while (this.paused && token === this.token) await sleep(200);
      }
    }
    return token === this.token;
  },
  finish() {
    this.stop();
    hooks.openOracle({ fromStory: true });
  }
};

let scrollGen = 0;
function scrollToY(y, ms, cancelled = () => false) {
  const id = ++scrollGen;
  return new Promise(resolve => {
    const from = scrollY, t0 = performance.now();
    if (!ms || Math.abs(y - from) < 2) { window.scrollTo(0, y); return resolve(); }
    const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const step = now => {
      if (cancelled() || id !== scrollGen) return resolve();
      const p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + (y - from) * ease(p));
      p < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  });
}

/* ================= wiring ================= */

function trackStorybar() {
  const bar = $('storybar');
  const set = () => document.documentElement.style.setProperty('--story-h', (bar.hidden ? 0 : bar.offsetHeight) + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(bar);
  new MutationObserver(set).observe(bar, { attributes: true, attributeFilter: ['hidden'] });
  set();
}
export function initExperience(opts) {
  hooks = { ...hooks, ...opts };
  trackStorybar();
  onEnterCb = opts.onEnter || onEnterCb;
  document.documentElement.classList.add('splash-lock');
  applyI18n();
  music.syncButton();
  requestAnimationFrame(tickBar);
  // write the signature once its script font is in, so it never draws in a fallback face
  const draw = () => $('sig') && $('sig').classList.add('is-drawing');
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('80px "Great Vibes"'), sleep(1500)]).then(draw); else draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => progress('fonts')); else progress('fonts');
  // never keep anyone out: if the 3D world is slow or fails, let them in anyway
  setTimeout(showReady, 15000);

  $('splashStory').addEventListener('click', () => enter(true));
  $('splashEnter').addEventListener('click', () => enter(false));
  $('musicBtn').addEventListener('click', () => { music.on ? music.toggle() : (music.toggle(), music.start()); });
  document.addEventListener('click', e => {
    const l = e.target.closest('[data-lang],#langBtn');
    if (l) {
      const was = lang;
      setLang(l.id === 'langBtn' ? (lang === 'id' ? 'en' : 'id') : l.dataset.lang);
      music.syncButton();
      if (story.on && was !== lang) story.play(story.i);
    }
    if (e.target.closest('[data-story="start"]')) { unlockAudio(); music.start(); story.start(0); }
  });
  $('storyPlay').addEventListener('click', () => story.paused ? story.resume() : story.pause());
  $('storyNext').addEventListener('click', () => story.next());
  $('storyStop').addEventListener('click', () => story.stop());

  // taking the wheel pauses the story
  const interrupt = () => { if (story.on && !story.paused) story.pause(); };
  addEventListener('wheel', interrupt, { passive: true });
  addEventListener('touchstart', e => { if (!e.target.closest('#storybar')) interrupt(); }, { passive: true });
  addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key) && !e.target.closest('input,textarea')) interrupt();
    if (e.key === 'Escape' && story.on) story.stop();
  });
  if ('speechSynthesis' in window) speechSynthesis.getVoices(); // warm up the voice list
}

export function setStoryTexts(list) {
  texts = {};
  (list || []).forEach(s => { texts[s.chapter] = s.beats; });
}
export const stopStory = () => story.stop();
