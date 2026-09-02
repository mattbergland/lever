const MUTED_KEY = "lever:muted";

class LeverAudio {
  private context?: AudioContext;
  private muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = window.localStorage.getItem(MUTED_KEY) === "true";
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTED_KEY, String(muted));
    }
  }

  private getContext() {
    if (typeof window === "undefined" || this.muted) return undefined;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    offset = 0,
  ) {
    const context = this.getContext();
    if (!context) return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private click(progress: number) {
    const context = this.getContext();
    if (!context) return;
    const start = context.currentTime;
    const length = Math.floor(context.sampleRate * 0.055);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200 - progress * 900, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.035, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(start);
    source.stop(start + 0.06);
  }

  tick(progress: number) {
    const clamped = Math.max(0, Math.min(1, progress));
    this.click(clamped);
    this.tone(240 - clamped * 85, 0.055 + clamped * 0.04, 0.012 + clamped * 0.01, "triangle");
  }

  lock() {
    this.tone(92, 0.2, 0.065, "sine");
    this.tone(510, 0.07, 0.025, "square", 0.012);
  }

  finalLock() {
    this.tone(64, 0.42, 0.11, "sine");
    this.tone(128, 0.28, 0.035, "sine", 0.015);
    this.tone(690, 0.09, 0.022, "triangle", 0.03);
  }
}

export const audio = new LeverAudio();
