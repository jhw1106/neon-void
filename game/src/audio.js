// NEON VOID — synthesized sound.
// One job: every sound the game makes, built from oscillators and filtered
// noise at run time. No audio files, no network. The context is created
// lazily on the first user gesture (browsers block audio before that), and
// shot scenes never create one.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.pulseTimer = null;
    this.pulseStep = 0;
  }

  // Call from a click or keydown. Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
    // One shared noise buffer for all percussive sounds.
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  // A short oscillator blip that slides from f0 to f1.
  blip({ type = 'square', f0 = 440, f1 = 220, dur = 0.08, vol = 0.5, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A burst of filtered noise, for explosions and hits.
  noise({ dur = 0.2, vol = 0.5, freq = 1200, q = 0.8, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot() {
    this.blip({ type: 'square', f0: 880, f1: 320, dur: 0.07, vol: 0.16 });
  }

  enemyHit() {
    this.noise({ dur: 0.06, vol: 0.2, freq: 2400 });
  }

  explode(big) {
    this.noise({ dur: big ? 0.45 : 0.25, vol: big ? 0.55 : 0.35, freq: big ? 900 : 1400 });
    this.blip({ type: 'sine', f0: big ? 160 : 220, f1: 40, dur: big ? 0.4 : 0.25, vol: 0.5 });
  }

  playerHit() {
    this.blip({ type: 'sawtooth', f0: 220, f1: 55, dur: 0.35, vol: 0.5 });
    this.noise({ dur: 0.3, vol: 0.4, freq: 800 });
  }

  dash() {
    this.noise({ dur: 0.14, vol: 0.18, freq: 3200, q: 2 });
  }

  shard() {
    this.blip({ type: 'sine', f0: 1320, f1: 1760, dur: 0.09, vol: 0.18 });
  }

  upgrade() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.blip({ type: 'triangle', f0: f, f1: f, dur: 0.16, vol: 0.3, delay: i * 0.07 }));
  }

  waveStart() {
    this.blip({ type: 'triangle', f0: 392, f1: 392, dur: 0.12, vol: 0.3 });
    this.blip({ type: 'triangle', f0: 587, f1: 587, dur: 0.18, vol: 0.3, delay: 0.1 });
  }

  gameOver() {
    const notes = [392, 311, 233, 175];
    notes.forEach((f, i) => this.blip({ type: 'sawtooth', f0: f, f1: f * 0.94, dur: 0.3, vol: 0.28, delay: i * 0.22 }));
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.blip({ type: 'triangle', f0: f, f1: f, dur: 0.22, vol: 0.3, delay: i * 0.09 }));
  }

  click() {
    this.blip({ type: 'sine', f0: 660, f1: 660, dur: 0.05, vol: 0.2 });
  }

  // A quiet two-note bass pulse under play. Started on run start, stopped
  // on game over / title. Subtle by design: it never competes with SFX.
  startPulse() {
    if (!this.ctx || this.pulseTimer) return;
    this.pulseStep = 0;
    this.pulseTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const notes = [55, 55, 65.4, 49];
      const f = notes[this.pulseStep % notes.length];
      this.pulseStep++;
      this.blip({ type: 'sine', f0: f, f1: f, dur: 0.42, vol: 0.1 });
    }, 480);
  }

  stopPulse() {
    if (this.pulseTimer) {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }
}
