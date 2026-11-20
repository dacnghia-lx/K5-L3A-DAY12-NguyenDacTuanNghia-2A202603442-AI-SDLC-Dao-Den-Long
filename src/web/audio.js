// Synthesized sound effects (WebAudio, no audio files). Cosmetic only.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, { type = 'sine', gain = 0.12, delay = 0, slideTo = null } = {}) {
    if (this.muted) return;
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
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, { from = 2000, to = 300, gain = 0.15 } = {}) {
    if (this.muted) return;
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
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  pickup(n = 1) { this.tone(880 + n * 90, 0.14, { type: 'triangle', gain: 0.09 }); }
  deposit() { this.tone(523, 0.18); this.tone(659, 0.22, { delay: 0.08 }); }
  lit() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.09, gain: 0.1 })); }
  pulse() { this.noise(0.45, { from: 3000, to: 400, gain: 0.2 }); this.tone(330, 0.3, { slideTo: 660, gain: 0.06 }); }
  hit() { this.tone(140, 0.35, { type: 'triangle', slideTo: 60, gain: 0.2 }); }
  spawn() { this.tone(90, 0.6, { type: 'sawtooth', slideTo: 70, gain: 0.03 }); }
  hoot() { this.tone(420, 0.18, { gain: 0.06 }); this.tone(370, 0.28, { delay: 0.2, gain: 0.06 }); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, { delay: i * 0.14, gain: 0.1 })); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, { delay: i * 0.2, type: 'triangle', gain: 0.1 })); }
}
