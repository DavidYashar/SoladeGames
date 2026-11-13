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
  private lastHitAt = 0;
  private lastBrickAt = 0;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollLevel = 0;
  private samples = new Map<BrickKind, AudioBuffer>();
  /** Where each recording's hit actually starts, and how loud it is. */
  private meta = new Map<BrickKind, { onset: number; gain: number }>();
  private loading = false;
  /** How much of each hit sample is used. A brick hit wants a snap, not a tail. */
  private sampleSeconds = 0.5;

  get state(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  /** Diagnostic: level of each recording, and where its energy actually starts. */
  analyse(): Record<string, { seconds: number; headLevel: number; peakAt: number }> {
    const out: Record<string, { seconds: number; headLevel: number; peakAt: number }> = {};
    for (const [kind, buffer] of this.samples) {
      const data = buffer.getChannelData(0);
      const rate = buffer.sampleRate;
      let peak = 0;
      let peakAt = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = Math.abs(data[i]);
        if (v > peak) {
          peak = v;
          peakAt = i / rate;
        }
      }
      // Energy inside the 0.5 s window we actually play.
      const window = Math.min(data.length, Math.floor(rate * 0.5));
      let sum = 0;
      for (let i = 0; i < window; i += 1) sum += data[i] * data[i];
      out[kind] = {
        seconds: Number(buffer.duration.toFixed(2)),
        headLevel: Number(Math.sqrt(sum / window).toFixed(3)),
        peakAt: Number(peakAt.toFixed(2)),
      };
    }
    return out;
  }

  /** Diagnostic: which recordings decoded, and how often each material has played. */
  private plays: Record<string, number> = {};
  get report(): { loaded: string[]; plays: Record<string, number> } {
    return { loaded: [...this.samples.keys()], plays: { ...this.plays } };
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
    void this.loadSamples();
  }

  /** Fetch and decode the recorded hits once. Missing files fall back to synthesis. */
  private async loadSamples(): Promise<void> {
    if (this.loading || !this.ctx) return;
    this.loading = true;

    const files: [BrickKind, string][] = [
      ["clay", "clay"],
      ["stone", "stone"],
      ["glass", "glass"],
      ["keg", "keg"],
      ["gold", "gold"],
      ["iron", "iron"],
    ];

    await Promise.all(
      files.map(async ([kind, file]) => {
        if (this.samples.has(kind)) return;
        try {
          const response = await fetch(`/audio/bricks/${file}.mp3`);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          const buffer = await this.ctx!.decodeAudioData(data);
          this.samples.set(kind, buffer);
          this.meta.set(kind, this.measure(buffer));
        } catch {
          // Keep the synthesised version for this material.
        }
      }),
    );
  }

  /**
   * Find where the hit is in a recording. Several of these files do not begin with the
   * transient — iron's lands 0.9 s in — so playing from zero and cutting at 0.5 s
   * produced near silence.
   */
  private measure(buffer: AudioBuffer): { onset: number; gain: number } {
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    let peak = 0;
    let peakIndex = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.abs(data[i]);
      if (v > peak) {
        peak = v;
        peakIndex = i;
      }
    }

    // Walk back to where the sound rises out of the noise floor.
    const threshold = peak * 0.25;
    let onsetIndex = peakIndex;
    while (onsetIndex > 0 && Math.abs(data[onsetIndex]) > threshold) onsetIndex -= 1;

    const peakAt = peakIndex / rate;
    const onset = Math.max(0, onsetIndex / rate - 0.01);

    // Even out the loudness differences between recordings.
    let sum = 0;
    const window = Math.min(data.length - onsetIndex, Math.floor(rate * 0.3));
    for (let i = onsetIndex; i < onsetIndex + window; i += 1) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / Math.max(1, window));
    const gain = Math.max(0.7, Math.min(2.6, 0.22 / Math.max(0.02, rms)));

    void peakAt;
    return { onset, gain };
  }

  /** Play a recorded hit, clipped to sampleSeconds so it stays percussive. */
  private playSample(kind: BrickKind, gain: number): boolean {
    const ctx = this.ctx;
    const buffer = this.samples.get(kind);
    if (!ctx || !buffer) return false;

    const at = ctx.currentTime;
    this.plays[kind] = (this.plays[kind] ?? 0) + 1;

    const meta = this.meta.get(kind) ?? { onset: 0, gain: 1 };
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Slight pitch variation so repeats do not sound like a loop.
    source.playbackRate.value = 0.96 + Math.random() * 0.08;

    const envelope = ctx.createGain();
    const length = this.sampleSeconds;
    const level = gain * meta.gain;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);

    source.connect(envelope);
    envelope.connect(this.master!);
    // Start at the hit, not at the start of the file.
    source.start(at, meta.onset);
    source.stop(at + length + 0.02);
    return true;
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

  /**
   * The ball rolling on the felt. Deliberately a low rumble, not a wash of noise: a
   * wide band centred high is what made the earlier version sound like wind.
   */
  private startRoll(): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise(2);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 210;
    filter.Q.value = 0.7;

    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowpass";
    shelf.frequency.value = 380;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(shelf);
    shelf.connect(gain);
    gain.connect(this.master!);
    source.start();

    this.rollFilter = filter;
    this.rollGain = gain;
  }

  /** Continuous roll, driven by the ball's speed. Quiet, and silent when stopped. */
  roll(speed: number): void {
    if (!this.rollGain || !this.rollFilter) return;
    const moving = Math.max(0, Math.min(1, (speed - 0.25) / 6));
    const target = moving * 0.085;
    this.rollLevel += (target - this.rollLevel) * 0.18;
    this.rollGain.gain.value = this.rollLevel;
    this.rollFilter.frequency.value = 170 + moving * 190;
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
    this.lastBrickAt = now;

    const at = this.ctx.currentTime;

    if (this.playSample(kind, breaking ? 1.0 : 0.85)) {
      if (breaking) this.tone(at + 0.01, 110, 0.16, 0.14, "sine", 55);
      return;
    }

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
    // A brick has just sounded; a rail thump on top of it only muddies the material.
    if (performance.now() - this.lastBrickAt < 90) return;
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
