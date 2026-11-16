// STARFORGE DEFENSE 3D — sound: a tiny WebAudio synth. No audio files;
// every effect is an oscillator blip shaped by an envelope. The context
// is created lazily on the first user gesture.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastPlay = {};
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type = 'square', vol = 0.05, slide = 0, key = '', gap = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (key) {
      if (this.lastPlay[key] && now - this.lastPlay[key] < gap) return;
      this.lastPlay[key] = now;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  click() { this.tone(660, 0.05, 'square', 0.03); }
  place() { this.tone(220, 0.12, 'triangle', 0.07, -60); }
  sell() { this.tone(520, 0.1, 'triangle', 0.05, 240); }
  upgrade() { this.tone(440, 0.09, 'square', 0.05); setTimeout(() => this.tone(660, 0.12, 'square', 0.05), 70); }
  coin() { this.tone(1180, 0.05, 'sine', 0.02, 0, 'coin', 0.09); }
  shoot(type) {
    if (type === 'bolt') this.tone(880, 0.06, 'sawtooth', 0.018, -300, 'sb', 0.05);
    else if (type === 'frost') this.tone(1320, 0.08, 'sine', 0.02, -500, 'sf', 0.07);
    else if (type === 'mortar') this.tone(140, 0.16, 'triangle', 0.05, -40, 'sm', 0.12);
  }
  zap() { this.tone(180, 0.12, 'sawtooth', 0.035, 700, 'zap', 0.08); }
  boom() { this.tone(90, 0.3, 'sine', 0.11, -50, 'boom', 0.1); }
  leak() { this.tone(300, 0.25, 'sawtooth', 0.06, -220); }
  horn() { this.tone(196, 0.22, 'square', 0.05); setTimeout(() => this.tone(262, 0.28, 'square', 0.05), 120); }
  bossDie() { this.tone(70, 0.6, 'sine', 0.13, -30); }
  victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.06), i * 110)); }
  defeat() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.06), i * 140)); }
}
