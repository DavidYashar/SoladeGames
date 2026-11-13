/**
 * Brick Blitz audio.
 *
 * Six brick materials, a wooden table and a cue-tip handler, so the palette is
 * physical: each kind of brick gets its own body, and breaking one adds a shatter.
 * Synthesised with the Web Audio API — no files, nothing to licence.
 */

export type BrickKind = "clay" | "stone" | "glass" | "keg" | "gold" | "iron";

export class BrickAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollLevel = 0;
  private lastHitAt = 0;

  get state(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.9;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      master.connect(comp);
      comp.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.startRoll();
    }

    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  private noise(seconds = 1): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  private startRoll(): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise(2);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start();

    this.rollFilter = filter;
    this.rollGain = gain;
  }

  /** Continuous roll, driven by the ball's speed. */
  roll(speed: number): void {
    if (!this.rollGain || !this.rollFilter) return;
    const target = Math.min(1, speed / 7) * 0.11;
    this.rollLevel += (target - this.rollLevel) * 0.2;
    this.rollGain.gain.value = this.rollLevel;
    this.rollFilter.frequency.value = 300 + Math.min(1, speed / 7) * 700;
  }

  private burst(at: number, duration: number, frequency: number, gain: number, q = 1.2): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise(0.3);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, frequency * 0.35), at + duration);
    filter.Q.value = q;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master!);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  private tone(
    at: number,
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    endFrequency?: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(envelope);
    envelope.connect(this.master!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  /** The cue: a tip striking the ball. */
  serve(power = 1): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.03, 3000, 0.2 * power, 2.0);
    this.tone(at, 150, 0.09, 0.26 * power, "sine", 85);
  }

  /**
   * A brick taking a hit. Each material has its own body; `breaking` adds the crack.
   */
  brick(kind: BrickKind, breaking: boolean): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastHitAt < 22) return;
    this.lastHitAt = now;

    const at = this.ctx.currentTime;
    switch (kind) {
      case "clay":
        this.burst(at, 0.04, 900, 0.16, 1.6);
        this.tone(at, 380, 0.07, 0.1, "triangle", 240);
        break;
      case "stone":
        this.burst(at, 0.05, 420, 0.16, 1.1);
        this.tone(at, 210, 0.11, 0.2, "sine", 130);
        break;
      case "glass":
        this.burst(at, 0.02, 4200, 0.12, 2.4);
        this.tone(at, 2400, 0.22, 0.1, "sine");
        this.tone(at, 3600, 0.16, 0.06, "sine");
        break;
      case "keg":
        this.burst(at, 0.035, 700, 0.14, 1.4);
        this.tone(at, 160, 0.12, 0.2, "triangle", 110);
        break;
      case "gold":
        this.tone(at, 1240, 0.3, 0.1, "sine");
        this.tone(at, 1860, 0.22, 0.06, "sine");
        this.burst(at, 0.02, 5200, 0.07, 2.6);
        break;
      case "iron":
        this.tone(at, 820, 0.26, 0.09, "square");
        this.tone(at, 1270, 0.2, 0.06, "square");
        this.burst(at, 0.03, 2600, 0.1, 1.8);
        break;
    }

    if (breaking) {
      const weight = kind === "stone" || kind === "iron" ? 1.25 : 1;
      this.burst(at + 0.01, 0.22, 1800, 0.2 * weight, 0.8);
      this.tone(at + 0.01, 110, 0.18, 0.18 * weight, "sine", 55);
    }
  }

  /** A rail or cushion: felt-muted, low, short. */
  cushion(strength = 0.5): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    const s = Math.max(0.2, Math.min(1, strength));
    this.tone(at, 120, 0.09, 0.1 * s, "sine", 70);
    this.burst(at, 0.03, 320, 0.07 * s, 1.0);
  }

  /** The handler taking the ball: a wooden clack. */
  handler(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.03, 1500, 0.12, 1.8);
    this.tone(at, 220, 0.08, 0.12, "triangle", 140);
  }

  /** A new row arriving: a low warning. */
  rowAdvance(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.tone(at, 150, 0.32, 0.14, "triangle", 110);
    this.burst(at, 0.18, 400, 0.05, 0.9);
  }

  lose(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.tone(at, 220, 0.5, 0.2, "triangle", 70);
    this.burst(at + 0.05, 0.3, 380, 0.07, 0.7);
  }

  win(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone(at + i * 0.09, f, 0.28, 0.13, "triangle");
    });
  }
}

export const brickAudio = new BrickAudio();
