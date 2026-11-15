// STARFORGE DEFENSE — procedural sound: every effect is synthesised with
// WebAudio oscillators and noise, so the game ships zero audio files and
// makes zero network requests. Created lazily on first user gesture.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot(kind) {
    if (kind === 'mortar') this.tone(180, 0.18, 'sine', 0.5, 60);
    else if (kind === 'frost') this.tone(880, 0.12, 'sine', 0.25, 1320);
    else this.tone(720, 0.06, 'square', 0.12, 420);
  }

  zap() {
    this.noise(0.12, 0.3, 3200);
    this.tone(1400, 0.1, 'sawtooth', 0.12, 220);
  }

  boom() {
    this.noise(0.35, 0.55, 700);
    this.tone(90, 0.3, 'sine', 0.6, 35);
  }

  coin() {
    this.tone(990, 0.07, 'sine', 0.2);
    setTimeout(() => this.tone(1320, 0.09, 'sine', 0.2), 55);
  }

  place() {
    this.tone(320, 0.08, 'triangle', 0.35, 520);
  }

  upgrade() {
    this.tone(440, 0.1, 'triangle', 0.3, 660);
    setTimeout(() => this.tone(660, 0.12, 'triangle', 0.3, 880), 80);
  }

  sell() {
    this.tone(660, 0.1, 'triangle', 0.25, 330);
  }

  horn() {
    this.tone(196, 0.35, 'sawtooth', 0.22, 196);
    setTimeout(() => this.tone(294, 0.3, 'sawtooth', 0.18, 294), 120);
  }

  leak() {
    this.tone(220, 0.25, 'sawtooth', 0.3, 110);
  }

  bossDie() {
    this.boom();
    setTimeout(() => this.tone(523, 0.15, 'triangle', 0.3), 150);
    setTimeout(() => this.tone(784, 0.25, 'triangle', 0.3), 300);
  }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.32), i * 130));
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.2), i * 160));
  }

  click() {
    this.tone(600, 0.04, 'square', 0.08);
  }
}
