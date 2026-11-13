/**
 * Pinball audio.
 *
 * Everything is synthesised with the Web Audio API: no files to load, nothing to
 * licence, and the character can be tuned in code. The intent is physical rather than
 * chiptune — noise transients for impacts, struck resonators for the bells.
 *
 * Browsers refuse to start audio until the player interacts, so nothing is created
 * until unlock() is called from a key press.
 */

/** A minor pentatonic, so any order the bells are hit in stays musical. */
const BELL_SCALE = [220.0, 261.63, 293.66, 329.63, 392.0];

export class PinballAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollSource: AudioBufferSourceNode | null = null;
  private rollLevel = 0;
  private lastImpactAt = 0;

  /** Diagnostic: "none" until unlocked, then the AudioContext state. */
  get state(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  /** Called from the first key press. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.85;

      // A compressor keeps punch without clipping when several hits land together.
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
      this.startRolling();
    }

    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  private noiseBuffer(seconds = 2): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: rolling ball is low and granular, not hissy.
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  /** A permanent low channel for the ball rolling on the slate. */
  private startRolling(): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(2);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start();

    this.rollSource = source;
    this.rollFilter = filter;
    this.rollGain = gain;
  }

  /** Continuous rolling sound, driven by the ball's speed in m/s. */
  roll(speed: number): void {
    if (!this.ctx || !this.rollGain || !this.rollFilter) return;
    const target = Math.min(1, speed / 4) * 0.16;
    // Smooth so it does not chatter frame to frame.
    this.rollLevel += (target - this.rollLevel) * 0.2;
    this.rollGain.gain.value = this.rollLevel;
    this.rollFilter.frequency.value = 260 + Math.min(1, speed / 4) * 900;
  }

  private burst(at: number, duration: number, frequency: number, gain: number, q = 1.2): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.3);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
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
    envelope.gain.linearRampToValueAtTime(gain, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(envelope);
    envelope.connect(this.master!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  /** A bell: struck metal — a bright transient over two detuned partials. */
  bell(index: number): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    const f = BELL_SCALE[index % BELL_SCALE.length];

    this.burst(at, 0.05, 3200, 0.22, 1.8);
    this.tone(at, f, 0.75, 0.3, "sine");
    this.tone(at, f * 2.01, 0.5, 0.14, "sine");
    this.tone(at, f * 3.02, 0.32, 0.07, "sine");
    this.tone(at, f * 0.5, 0.9, 0.1, "triangle");
  }

  /** Ball hitting a solid object; strength 0..1. */
  impact(strength = 0.5): void {
    if (!this.ctx) return;
    const now = performance.now();
    // Impacts bunch up when the ball rattles; eight per 100 ms is plenty.
    if (now - this.lastImpactAt < 28) return;
    this.lastImpactAt = now;

    const s = Math.max(0.15, Math.min(1, strength));
    const at = this.ctx.currentTime;
    this.burst(at, 0.035 + s * 0.03, 1500 + s * 1800, 0.12 + s * 0.22, 1.4);
    this.tone(at, 160 + s * 120, 0.06, 0.08 * s, "sine", 90);
  }

  /** The chevrons: a short directional whoosh. */
  chevron(side: number): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.18, 900, 0.16, 0.8);
    this.tone(at, side > 0 ? 330 : 247, 0.16, 0.1, "triangle", side > 0 ? 520 : 180);
  }

  /** Flipper solenoid: a hard click and a body thud. */
  flipper(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.025, 2600, 0.28, 2.2);
    this.tone(at, 120, 0.09, 0.22, "sine", 70);
  }

  /** Plunger: the spring compressing, then the launch. */
  plunge(charge: number): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    const c = Math.max(0.15, Math.min(1, charge));
    this.burst(at, 0.05, 800 + c * 700, 0.18 * c, 1.1);
    this.tone(at, 90, 0.12, 0.3 * c, "sine", 55);
    this.tone(at + 0.01, 300 + c * 260, 0.2, 0.1, "triangle", 120);
  }

  /** Drain: descending, deliberately flat. */
  drain(): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.tone(at, 220, 0.45, 0.2, "triangle", 70);
    this.burst(at + 0.05, 0.25, 400, 0.08, 0.7);
  }

  /** Chain step: a short blip that climbs with the multiplier. */
  chain(level: number): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    const f = 440 * Math.pow(2, Math.min(6, level) / 12);
    this.tone(at, f, 0.14, 0.12, "triangle");
  }
}

export const audio = new PinballAudio();
