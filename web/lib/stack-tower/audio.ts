/**
 * Stack Tower audio.
 *
 * Three events, all wood striking wood: a plank being drawn out, a plank being set on
 * the tower, and the tower coming down. Synthesised, with the palette built around
 * short resonant modes rather than a noise wash, because wood is a struck body.
 */

export class StackAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastKnockAt = 0;
  private collapseBuffer: AudioBuffer | null = null;
  private collapseOnset = 0;
  private placeBuffer: AudioBuffer | null = null;
  private placeOnset = 0;
  private loading = false;

  get state(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  /** Diagnostic: how often each of the three events has sounded. */
  private plays = { pull: 0, place: 0, collapse: 0 };
  get report(): { state: string; plays: typeof this.plays } {
    return { state: this.state, plays: { ...this.plays } };
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
      comp.threshold.value = -15;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;

      master.connect(comp);
      comp.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
    }

    if (this.ctx.state === "suspended") await this.ctx.resume();
    void this.loadCollapse();
    void this.loadPlace();
  }

  /** The recorded collapse. Falls back to the synthesised one if it cannot load. */
  private async loadCollapse(): Promise<void> {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    try {
      const response = await fetch("/audio/stack/plank-fall.wav");
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      this.collapseBuffer = buffer;
      this.collapseOnset = this.findOnset(buffer);
    } catch {
      // Keep the synthesised collapse.
    }
  }

  /** The recorded plank being set down. */
  private async loadPlace(): Promise<void> {
    if (!this.ctx || this.placeBuffer) return;
    try {
      const response = await fetch("/audio/stack/place.mp3");
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      this.placeBuffer = buffer;
      this.placeOnset = this.findOnset(buffer);
    } catch {
      // Keep the synthesised knock.
    }
  }

  /** Where the first impact is, so playback does not begin with silence. */
  private findOnset(buffer: AudioBuffer): number {
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
    const threshold = peak * 0.2;
    let onset = peakIndex;
    while (onset > 0 && Math.abs(data[onset]) > threshold) onset -= 1;
    return Math.max(0, onset / rate - 0.01);
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private burst(at: number, duration: number, frequency: number, gain: number, q = 1.4): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(duration + 0.05);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(120, frequency * 0.45),
      at + duration,
    );
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

  private mode(
    at: number,
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType = "triangle",
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    // A struck body drops slightly in pitch as it settles.
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.94, at + duration);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(envelope);
    envelope.connect(this.master!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  /** A single wooden knock: a contact click over three short resonant modes. */
  private knock(at: number, pitch: number, gain: number): void {
    this.burst(at, 0.035, 1500 * pitch, gain * 0.5, 1.6);
    this.mode(at, 190 * pitch, 0.16, gain * 0.5);
    this.mode(at, 330 * pitch, 0.11, gain * 0.3);
    this.mode(at, 520 * pitch, 0.07, gain * 0.18);
  }

  /** A plank being drawn out of the tower: wood sliding, then a knock as it clears. */
  pull(): void {
    if (!this.ctx) return;
    this.plays.pull += 1;
    const at = this.ctx.currentTime;

    // The slide: filtered noise, wavering as the grain catches.
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(720, at);
    filter.frequency.linearRampToValueAtTime(520, at + 0.3);
    filter.Q.value = 2.4;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.14, at + 0.03);
    // Two dips, so it reads as a scrape rather than a hiss.
    envelope.gain.linearRampToValueAtTime(0.08, at + 0.12);
    envelope.gain.linearRampToValueAtTime(0.12, at + 0.2);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.33);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master!);
    source.start(at);
    source.stop(at + 0.36);

    // The plank clearing the stack.
    this.knock(at + 0.3, 1.0, 0.22);
  }

  /** A plank set on the tower. Higher layers ring a little brighter. */
  place(layer = 0): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastKnockAt < 40) return;
    this.lastKnockAt = now;

    this.plays.place += 1;
    const at = this.ctx.currentTime;

    if (this.placeBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.placeBuffer;
      // A touch of pitch variation so repeated placements do not sound looped.
      source.playbackRate.value = 0.97 + Math.random() * 0.06;

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0.9, at);
      // Clipped to half a second: this is a knock, not a footstep to listen through.
      envelope.gain.setValueAtTime(0.9, at + 0.3);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);

      source.connect(envelope);
      envelope.connect(this.master!);
      source.start(at, this.placeOnset);
      source.stop(at + 0.52);
      return;
    }

    const pitch = 0.95 + Math.min(12, layer) * 0.02;
    this.knock(at, pitch, 0.34);
  }

  /** The tower coming down: many knocks over a low boom and a debris tail. */
  collapse(): void {
    if (!this.ctx) return;
    this.plays.collapse += 1;
    const at = this.ctx.currentTime;

    // The recording, played whole: a collapse has a tail worth hearing.
    if (this.collapseBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.collapseBuffer;

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0.85, at);

      source.connect(envelope);
      envelope.connect(this.master!);
      source.start(at, this.collapseOnset);
      return;
    }

    for (let i = 0; i < 14; i += 1) {
      const when = at + Math.random() * 0.75;
      const pitch = 0.7 + Math.random() * 1.1;
      this.knock(when, pitch, 0.18 + Math.random() * 0.22);
    }

    // The floor taking it.
    this.mode(at + 0.02, 72, 0.7, 0.32, "sine");
    this.mode(at + 0.04, 108, 0.5, 0.2, "sine");

    // Debris settling.
    this.burst(at + 0.25, 0.9, 900, 0.1, 0.7);
  }
}

export const stackAudio = new StackAudio();
