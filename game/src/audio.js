// EMBERFALL — synthesized WebAudio sound effects. No audio files.
// The AudioContext is created lazily on the first user interaction
// (browser autoplay rule); every play method is a no-op until then
// and whenever muted.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    try {
      this.muted = window.localStorage.getItem('emberfall_muted') === '1';
    } catch (err) {
      this.muted = false;
    }
  }

  // Create/resume the context. Call from any user gesture.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = !!m;
    try {
      window.localStorage.setItem('emberfall_muted', this.muted ? '1' : '0');
    } catch (err) { /* storage unavailable: mute still applies in-memory */ }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // --- primitives -------------------------------------------------
  _tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, delay) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // --- game sounds ------------------------------------------------
  shoot() {
    this._tone(720, 0.07, 'square', 0.10, 240);
    this._noise(0.05, 0.05, 3200);
  }

  hit() {
    this._tone(190, 0.06, 'triangle', 0.14, 120);
  }

  explode(big) {
    this._noise(big ? 0.5 : 0.3, big ? 0.4 : 0.25, big ? 700 : 1000);
    this._tone(big ? 120 : 160, big ? 0.4 : 0.25, 'sine', 0.3, 40);
  }

  hurt() {
    this._tone(140, 0.25, 'sawtooth', 0.25, 60);
    this._noise(0.15, 0.18, 500);
  }

  dash() {
    this._noise(0.16, 0.14, 2400);
  }

  pickup() {
    this._tone(660, 0.09, 'sine', 0.18, 990);
    this._tone(990, 0.12, 'sine', 0.15, 1320, 0.07);
  }

  waveStart() {
    this._tone(196, 0.16, 'triangle', 0.22, 196);
    this._tone(294, 0.16, 'triangle', 0.22, 294, 0.12);
    this._tone(392, 0.28, 'triangle', 0.24, 392, 0.24);
  }

  upgrade() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this._tone(f, 0.14, 'sine', 0.18, f, i * 0.07));
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => this._tone(f, 0.3, 'triangle', 0.2, f, i * 0.13));
  }

  defeat() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this._tone(f, 0.4, 'sawtooth', 0.16, f * 0.9, i * 0.22));
  }

  click() {
    this._tone(880, 0.05, 'sine', 0.12, 880);
  }
}
