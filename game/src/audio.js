// Skyline Courier — sound.
// One job: every sound the game makes, synthesised live with WebAudio.
// No audio files, no network: an engine hum that follows the throttle,
// a chime for a ring, a thud for a touchdown, a beep for a warning.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windGain = null;
    this.windSource = null;
  }

  // Call from a user gesture; browsers block audio before one.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: two detuned saws through a lowpass, gain follows throttle.
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 93;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.4;
      this.engineOsc.connect(filter);
      this.engineOsc2.connect(g2);
      g2.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.engineOsc2.start();
      // Wind: looped noise, louder with speed.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = buf;
      this.windSource.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windFilter.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      this.windSource.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, speed) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.0011, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(58 + throttle * 0.9, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(87 + throttle * 1.35, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0006), t, 0.2);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0, t, 0.05);
      this.windGain?.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  ringChime() {
    this.blip(880, 0.35);
    setTimeout(() => this.blip(1318, 0.4), 90);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.18;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }

  warn() {
    this.blip(660, 0.12, 'square', 0.08);
  }
}
