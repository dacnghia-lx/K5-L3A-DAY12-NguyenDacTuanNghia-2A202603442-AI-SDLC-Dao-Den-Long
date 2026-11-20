// Synthesized music and sound effects (WebAudio, no audio files). Cosmetic only.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.8;
    this.musicNodes = null;
    this.musicTimer = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    this.applyVolume();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolume();
  }

  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  tone(freq, dur, { type = 'sine', gain = 0.12, delay = 0, slideTo = null, dest = null } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(dest || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, { from = 2000, to = 300, gain = 0.15 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  // Night music: a slow pentatonic arpeggio over a soft drone (generated, loops forever).
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const bus = ctx.createGain();
    bus.gain.value = 0.35;
    bus.connect(this.master);
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 110;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    drone.connect(dg).connect(bus);
    drone.start();
    this.musicNodes = { bus, drone };
    const notes = [220, 247, 294, 330, 392, 440, 392, 330];
    let i = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.tone(notes[i % notes.length], 1.4, { type: 'triangle', gain: 0.05, dest: bus });
      if (i % 4 === 0) this.tone(notes[(i / 4) % 3] / 2, 2.6, { gain: 0.04, dest: bus });
      i++;
    }, 700);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicNodes) {
      try { this.musicNodes.drone.stop(); } catch { /* already stopped */ }
      this.musicNodes.bus.disconnect();
      this.musicNodes = null;
    }
  }

  pickup(n = 1) { this.tone(700 + n * 60, 0.14, { type: 'triangle', gain: 0.09 }); }
  deposit() { this.tone(523, 0.18); this.tone(659, 0.22, { delay: 0.08 }); }
  lit() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.09, gain: 0.1 })); }
  pulse() { this.noise(0.45, { from: 3000, to: 400, gain: 0.2 }); this.tone(330, 0.3, { slideTo: 660, gain: 0.06 }); }
  hit() { this.tone(140, 0.35, { type: 'triangle', slideTo: 60, gain: 0.2 }); }
  jump() { this.tone(300, 0.15, { type: 'square', slideTo: 520, gain: 0.04 }); }
  dash() { this.noise(0.2, { from: 1200, to: 4000, gain: 0.12 }); }
  spawn() { this.tone(90, 0.6, { type: 'sawtooth', slideTo: 70, gain: 0.05 }); }
  steal() { this.tone(900, 0.25, { type: 'sawtooth', slideTo: 300, gain: 0.05 }); }
  charm() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.2, { delay: i * 0.06, type: 'triangle', gain: 0.08 })); }
  wind() { this.noise(1.6, { from: 400, to: 900, gain: 0.12 }); }
  tick() { this.tone(1000, 0.06, { type: 'square', gain: 0.05 }); }
  hoot() { this.tone(420, 0.18, { gain: 0.06 }); this.tone(370, 0.28, { delay: 0.2, gain: 0.06 }); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, { delay: i * 0.14, gain: 0.1 })); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, { delay: i * 0.2, type: 'triangle', gain: 0.1 })); }
}
