import { Synth, chance, clamp, createPanner, getNoiseBuffer, lerp, pick, rand, randInt, type NoiseKind } from './SynthKit';
import { bloop, burst, creak, modal, ping } from './SynthBlocks';

/** Target level (0..1) of each procedural ambience layer. */
export interface AmbienceMix {
  ocean: number;
  wind: number;
  jungle: number;
  birds: number;
  harbor: number;
}

export type AmbienceLayer = keyof AmbienceMix;
export const AMBIENCE_LAYERS: readonly AmbienceLayer[] = ['ocean', 'wind', 'jungle', 'birds', 'harbor'];

export type AmbiencePreset = 'harbor' | 'beach' | 'jungle' | 'ruins' | 'silent';

/** Ready-made mixes; the keys match world Region.ambience ('harbor' | 'jungle' | 'ruins'). */
export const AMBIENCE_PRESETS: Record<AmbiencePreset, AmbienceMix> = {
  harbor: { ocean: 0.55, wind: 0.3, jungle: 0, birds: 0.15, harbor: 0.9 },
  beach: { ocean: 0.95, wind: 0.45, jungle: 0.05, birds: 0.25, harbor: 0.15 },
  jungle: { ocean: 0.1, wind: 0.15, jungle: 0.9, birds: 0.85, harbor: 0 },
  ruins: { ocean: 0.2, wind: 0.65, jungle: 0.25, birds: 0.2, harbor: 0 },
  silent: { ocean: 0, wind: 0, jungle: 0, birds: 0, harbor: 0 },
};

/** Time constant of the mix smoothing: ~95 % of a change is reached after ~1.5 s. */
const SMOOTH_TAU = 0.5;
/** How far ahead (s) procedural events are scheduled. */
const LOOKAHEAD = 0.3;
/** Internal level calibration per layer (applied at the layer input). */
const LAYER_TRIM: Record<AmbienceLayer, number> = { ocean: 0.5, wind: 0.7, jungle: 1, birds: 2.2, harbor: 0.9 };

// ---------------------------------------------------------------------------------------------

/** Collects the nodes of a continuous layer so it can be stopped and released as a unit. */
class Bed {
  readonly sources: AudioScheduledSourceNode[] = [];
  readonly nodes: AudioNode[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly start: number,
  ) {}

  private keep<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  gain(value: number, dest: AudioNode): GainNode {
    const g = this.keep(new GainNode(this.ctx, { gain: value }));
    g.connect(dest);
    return g;
  }

  filter(type: BiquadFilterType, frequency: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = this.keep(new BiquadFilterNode(this.ctx, { type, frequency, Q: q }));
    f.connect(dest);
    return f;
  }

  pan(value: number, dest: AudioNode): AudioNode {
    const p = createPanner(this.ctx, value);
    this.keep(p.node);
    p.node.connect(dest);
    return p.node;
  }

  noise(kind: NoiseKind, dest: AudioNode, rate = 1): AudioBufferSourceNode {
    const buffer = getNoiseBuffer(this.ctx, kind);
    const src = this.keep(new AudioBufferSourceNode(this.ctx, { buffer, loop: true, playbackRate: rate }));
    src.connect(dest);
    src.start(this.start, Math.random() * buffer.duration);
    this.sources.push(src);
    return src;
  }

  osc(type: OscillatorType, frequency: number, dest: AudioNode): OscillatorNode {
    const o = this.keep(new OscillatorNode(this.ctx, { type, frequency }));
    o.connect(dest);
    o.start(this.start);
    this.sources.push(o);
    return o;
  }

  /** Gain node feeding an AudioParam (modulation depth). */
  mod(depth: number, param: AudioParam): GainNode {
    const g = this.keep(new GainNode(this.ctx, { gain: depth }));
    g.connect(param);
    return g;
  }

  /** LFO added onto `param` with a random start phase (so layers never pulse in sync). */
  lfo(param: AudioParam, rate: number, depth: number, type: OscillatorType = 'sine'): OscillatorNode {
    let o: OscillatorNode;
    if (type === 'sine') {
      const phi = Math.random() * Math.PI * 2;
      const wave = this.ctx.createPeriodicWave(new Float32Array([0, Math.sin(phi)]), new Float32Array([0, Math.cos(phi)]));
      o = new OscillatorNode(this.ctx, { periodicWave: wave, frequency: rate });
    } else {
      o = new OscillatorNode(this.ctx, { type, frequency: rate });
    }
    this.keep(o);
    const g = this.keep(new GainNode(this.ctx, { gain: depth }));
    o.connect(g);
    g.connect(param);
    o.start(this.start);
    this.sources.push(o);
    return o;
  }

  stop(when: number): void {
    for (const s of this.sources) {
      try {
        s.stop(when);
      } catch {
        /* already stopped */
      }
    }
    const first = this.sources[0];
    const release = (): void => {
      for (const n of this.nodes) n.disconnect();
    };
    if (first) first.onended = release;
    else release();
  }
}

interface Stream {
  /** Context time of the next event (NaN = not scheduled). */
  next: number;
  readonly initial: () => number;
  readonly interval: () => number;
  readonly fire: (t: number) => void;
}

interface LayerState {
  readonly name: AmbienceLayer;
  /** Beds and events connect here (internal trim). */
  readonly input: GainNode;
  /** Mix fader (smoothed). */
  readonly fader: GainNode;
  /** Reverb-send input for events, followed by its own fader copy. */
  readonly sendIn: GainNode | null;
  readonly sendFader: GainNode | null;
  target: number;
  /** JS mirror of the smoothed fader value. */
  level: number;
  silentFor: number;
  bed: Bed | null;
  streams: Stream[];
}

interface Cricket {
  f: number;
  pan: number;
  pulses: number;
  gap: number;
  level: number;
}

/**
 * Continuous procedural soundscape: ocean surf, wind, jungle insects, birds and harbour life.
 * Each layer is a looping "bed" (filtered noise with slow LFO modulation) plus randomly timed
 * events (wave crashes, gusts, chirps, gull cries, creaks...). Layers fade smoothly (~1.5 s)
 * and are torn down while silent to save CPU.
 *
 * Works with any BaseAudioContext (an OfflineAudioContext can render it: call start(), setMix()
 * and scheduleUntil(seconds) before startRendering()).
 */
export class Ambience {
  readonly ctx: BaseAudioContext;
  private readonly bus: GainNode;
  private readonly send: AudioNode | null;
  private readonly layers: Record<AmbienceLayer, LayerState>;
  private readonly crickets: Cricket[];
  private started = false;

  /**
   * @param ctx         audio context (AudioContext in the game; OfflineAudioContext for tests)
   * @param out         destination for the dry ambience
   * @param reverbSend  optional shared reverb input; distant events (gulls, birds, bells) feed it
   */
  constructor(ctx: BaseAudioContext, out: AudioNode, reverbSend?: AudioNode) {
    this.ctx = ctx;
    this.bus = new GainNode(ctx, { gain: 0 });
    this.bus.connect(out);
    this.send = reverbSend ?? null;
    this.crickets = Array.from({ length: 3 }, () => ({
      f: rand(4200, 4900),
      pan: rand(-0.8, 0.8),
      pulses: randInt(2, 4),
      gap: rand(0.045, 0.062),
      level: rand(0.6, 1),
    }));

    this.layers = {
      ocean: this.makeLayer('ocean'),
      wind: this.makeLayer('wind'),
      jungle: this.makeLayer('jungle'),
      birds: this.makeLayer('birds'),
      harbor: this.makeLayer('harbor'),
    };
    const L = this.layers;
    L.ocean.streams = [stream(() => rand(1.5, 5), () => rand(6, 13), (t) => this.waveCrash(t))];
    L.wind.streams = [stream(() => rand(2, 6), () => rand(5, 12), (t) => this.gust(t))];
    L.jungle.streams = [
      stream(() => rand(0.1, 0.6), () => rand(0.3, 0.85), (t) => this.cricket(t)),
      stream(() => rand(2, 6), () => rand(4, 10), (t) => this.trill(t)),
      stream(() => rand(1, 4), () => rand(3, 8), (t) => this.frog(t)),
    ];
    L.birds.streams = [
      stream(() => rand(0.3, 1.5), () => rand(1.0, 4.0), (t) => this.birdCall(t)),
      stream(() => rand(5, 14), () => rand(14, 32), (t) => this.parrot(t)),
    ];
    L.harbor.streams = [
      stream(() => rand(0.2, 1), () => rand(0.7, 2.2), (t) => this.waterSlap(t)),
      stream(() => rand(1, 4), () => rand(3, 8), (t) => this.hullCreak(t)),
      stream(() => rand(2, 5), () => rand(3.5, 9), (t) => this.rigging(t)),
      stream(() => rand(2, 7), () => rand(6, 15), (t) => this.gull(t)),
      stream(() => rand(8, 20), () => rand(28, 60), (t) => this.shipBell(t)),
    ];
  }

  // ------------------------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------------------------

  /** Fades the ambience in and starts every layer whose target is above zero. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.setTargetAtTime(1, now, 0.6);
    for (const name of AMBIENCE_LAYERS) {
      const layer = this.layers[name];
      if (layer.target > 0) this.startLayer(layer, now);
    }
  }

  /** Sets layer targets (0..1). Missing keys keep their current target. Changes fade over ~1.5 s. */
  setMix(mix: Partial<AmbienceMix>): void {
    const now = this.ctx.currentTime;
    for (const name of AMBIENCE_LAYERS) {
      const v = mix[name];
      if (v === undefined || !Number.isFinite(v)) continue;
      const layer = this.layers[name];
      const target = clamp(v, 0, 1);
      if (Math.abs(target - layer.target) < 1e-4) continue;
      layer.target = target;
      layer.fader.gain.setTargetAtTime(target, now, SMOOTH_TAU);
      layer.sendFader?.gain.setTargetAtTime(target, now, SMOOTH_TAU);
      if (this.started && target > 0 && !layer.bed) this.startLayer(layer, now);
    }
  }

  /** Call every frame: advances smoothing, schedules upcoming events, releases silent layers. */
  update(dt: number): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const k = 1 - Math.exp(-Math.max(0, dt) / SMOOTH_TAU);
    for (const name of AMBIENCE_LAYERS) {
      const layer = this.layers[name];
      layer.level += (layer.target - layer.level) * k;
      if (layer.target > 0) {
        layer.silentFor = 0;
        if (!layer.bed) this.startLayer(layer, now);
      } else if (layer.bed && layer.level < 0.003) {
        layer.silentFor += dt;
        if (layer.silentFor > 2) this.stopLayer(layer, now);
      }
    }
    this.scheduleUntil(now + LOOKAHEAD);
  }

  /** Schedules procedural events up to `until` (context time). update() calls this automatically. */
  scheduleUntil(until: number): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    for (const name of AMBIENCE_LAYERS) {
      const layer = this.layers[name];
      const active = !!layer.bed && Math.max(layer.target, layer.level) > 0.01;
      for (const s of layer.streams) {
        if (!active) {
          s.next = NaN;
          continue;
        }
        if (Number.isNaN(s.next) || s.next < now - 0.1) s.next = now + Math.max(0, s.initial());
        let guard = 0;
        while (s.next < until && guard++ < 256) {
          try {
            s.fire(Math.max(s.next, now));
          } catch (err) {
            console.warn(`[audio] ambience event (${name}) failed`, err);
          }
          s.next += Math.max(0.05, s.interval());
        }
      }
    }
  }

  /** Fades everything out and stops all layers. start() can be called again later. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.setTargetAtTime(0, now, 0.15);
    for (const name of AMBIENCE_LAYERS) this.stopLayer(this.layers[name], now + 0.9);
  }

  get isStarted(): boolean {
    return this.started;
  }

  /** Current smoothed layer levels (for debugging / UI). */
  get levels(): AmbienceMix {
    const L = this.layers;
    return { ocean: L.ocean.level, wind: L.wind.level, jungle: L.jungle.level, birds: L.birds.level, harbor: L.harbor.level };
  }

  /** Current layer targets. */
  get targets(): AmbienceMix {
    const L = this.layers;
    return { ocean: L.ocean.target, wind: L.wind.target, jungle: L.jungle.target, birds: L.birds.target, harbor: L.harbor.target };
  }

  // ------------------------------------------------------------------------------------------
  // Layer management
  // ------------------------------------------------------------------------------------------

  private makeLayer(name: AmbienceLayer): LayerState {
    const fader = new GainNode(this.ctx, { gain: 0 });
    fader.connect(this.bus);
    const input = new GainNode(this.ctx, { gain: LAYER_TRIM[name] });
    input.connect(fader);
    let sendIn: GainNode | null = null;
    let sendFader: GainNode | null = null;
    if (this.send) {
      sendFader = new GainNode(this.ctx, { gain: 0 });
      sendFader.connect(this.send);
      sendIn = new GainNode(this.ctx, { gain: LAYER_TRIM[name] });
      sendIn.connect(sendFader);
    }
    return { name, input, fader, sendIn, sendFader, target: 0, level: 0, silentFor: 0, bed: null, streams: [] };
  }

  private startLayer(layer: LayerState, now: number): void {
    if (layer.bed) return;
    const bed = new Bed(this.ctx, now);
    try {
      switch (layer.name) {
        case 'ocean':
          this.buildOcean(bed, layer.input);
          break;
        case 'wind':
          this.buildWind(bed, layer.input);
          break;
        case 'jungle':
          this.buildJungle(bed, layer.input);
          break;
        case 'harbor':
          this.buildHarbor(bed, layer.input);
          break;
        case 'birds':
          break; // purely event based
      }
    } catch (err) {
      console.warn(`[audio] ambience layer ${layer.name} failed to start`, err);
    }
    layer.bed = bed;
    layer.silentFor = 0;
    for (const s of layer.streams) s.next = NaN;
  }

  private stopLayer(layer: LayerState, when: number): void {
    if (!layer.bed) return;
    layer.bed.stop(when);
    layer.bed = null;
    layer.silentFor = 0;
    for (const s of layer.streams) s.next = NaN;
  }

  /** Builds a per-event chain (gain → distance low-pass → pan → layer, + reverb send) and runs `build`. */
  private event(layer: LayerState, t: number, pan: number, distance: number, send: number, build: (s: Synth) => void): void {
    const ctx = this.ctx;
    const out = new GainNode(ctx, { gain: lerp(1, 0.3, distance) });
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: lerp(16000, 2400, distance), Q: 0.5 });
    const p = createPanner(ctx, pan);
    out.connect(lp);
    lp.connect(p.node);
    p.node.connect(layer.input);
    let sg: GainNode | null = null;
    if (layer.sendIn && send > 0) {
      sg = new GainNode(ctx, { gain: send });
      p.node.connect(sg);
      sg.connect(layer.sendIn);
    }
    const s = new Synth(ctx, out, t, 1);
    build(s);
    s.onEnded(() => {
      out.disconnect();
      lp.disconnect();
      p.node.disconnect();
      sg?.disconnect();
    });
  }

  // ------------------------------------------------------------------------------------------
  // Ocean
  // ------------------------------------------------------------------------------------------

  private buildOcean(b: Bed, dest: AudioNode): void {
    // Deep rumble, two decorrelated sides with slow independent swells.
    for (const side of [-1, 1]) {
      const p = b.pan(side * 0.55, dest);
      const swell = b.gain(0.3, p);
      b.lfo(swell.gain, side < 0 ? 0.061 : 0.077, 0.11);
      b.lfo(swell.gain, side < 0 ? 0.13 : 0.11, 0.05);
      const lp = b.filter('lowpass', 330, 0.5, swell);
      b.noise('brown', lp);
    }
    // Surf wash: brightness follows the swell like waves running up the beach.
    for (const side of [-1, 1]) {
      const rate = side < 0 ? 0.083 : 0.071;
      const p = b.pan(side * 0.35, dest);
      const swell = b.gain(0.32, p);
      const o = b.lfo(swell.gain, rate, 0.2);
      b.lfo(swell.gain, 0.031, 0.07);
      const hp = b.filter('highpass', 140, 0.6, swell);
      const lp = b.filter('lowpass', 950, 0.6, hp);
      // Drive the cutoff with the same oscillator (phase-locked to the swell).
      o.connect(b.mod(420, lp.frequency));
      b.noise('pink', lp);
    }
  }

  private waveCrash(t: number): void {
    const intensity = rand(0.5, 1);
    this.event(this.layers.ocean, t, rand(-0.6, 0.6), rand(0, 0.4), 0.15, (s) => {
      const dur = rand(3, 5);
      // Surge + break + wash-out.
      const g = s.gain(0);
      const lp = s.filter('lowpass', 300, 0.6, g);
      s.glide(lp.frequency, t, dur, 280, 600 + 2200 * intensity, 650, 0.25);
      s.bell(g.gain, t, dur, 0.55 * intensity, 0.22, 1.2);
      s.noise('pink', t, t + dur + 0.01, lp);
      // Foam fizz.
      const gf = s.gain(0);
      const hp = s.filter('highpass', 3200, 0.6, gf);
      s.bell(gf.gain, t + dur * 0.15, dur * 0.8, 0.05 * intensity, 0.3, 1.6);
      s.noise('white', t + dur * 0.15, t + dur * 0.95 + 0.01, hp);
      // Low boom of the breaking wave.
      const gb = s.gain(0);
      const lpb = s.filter('lowpass', 160, 0.7, gb);
      s.bell(gb.gain, t + dur * 0.15, dur * 0.5, 0.5 * intensity, 0.2, 1.5);
      s.noise('brown', t + dur * 0.15, t + dur * 0.65 + 0.01, lpb);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Wind
  // ------------------------------------------------------------------------------------------

  private buildWind(b: Bed, dest: AudioNode): void {
    const sides: Array<[number, number, number]> = [
      [-1, 0.071, 0.113],
      [1, 0.093, 0.087],
    ];
    for (const [side, rateF, rateA] of sides) {
      const p = b.pan(side * 0.5, dest);
      const g = b.gain(0.5, p);
      b.lfo(g.gain, rateA, 0.22);
      b.lfo(g.gain, rateA * 2.7, 0.08);
      const bp = b.filter('bandpass', 480, 0.9, g);
      b.lfo(bp.frequency, rateF, 190);
      b.lfo(bp.frequency, rateF * 3.1, 60);
      const hp = b.filter('highpass', 90, 0.7, bp);
      b.noise('pink', hp);
    }
    // Howl / whistle through rigging and rocks: a resonant band that slowly changes pitch.
    const pw = b.pan(0.15, dest);
    const gw = b.gain(0.11, pw);
    b.lfo(gw.gain, 0.057, 0.07);
    const bpw = b.filter('bandpass', 1150, 6, gw);
    b.lfo(bpw.frequency, 0.049, 380);
    b.lfo(bpw.frequency, 0.21, 60);
    b.noise('white', bpw);
    // High air.
    const ga = b.gain(0.012, dest);
    const hpa = b.filter('highpass', 4500, 0.5, ga);
    b.noise('white', hpa);
  }

  private gust(t: number): void {
    const strength = rand(0.5, 1);
    this.event(this.layers.wind, t, rand(-0.6, 0.6), 0, 0, (s) => {
      const dur = rand(2.5, 4.5);
      const g = s.gain(0);
      const bp = s.filter('bandpass', 330, 1.1, g);
      s.glide(bp.frequency, t, dur, 330, rand(800, 1100), 380, 0.4);
      s.bell(g.gain, t, dur, 0.32 * strength, 0.4, 1.3);
      s.noise('pink', t, t + dur + 0.01, bp);
      const gw = s.gain(0);
      const bpw = s.filter('bandpass', 850, 6, gw);
      s.glide(bpw.frequency, t, dur, 850, rand(1500, 1900), 950, 0.45);
      s.bell(gw.gain, t, dur, 0.09 * strength, 0.45, 1.5);
      s.noise('white', t, t + dur + 0.01, bpw);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Jungle insects
  // ------------------------------------------------------------------------------------------

  private buildJungle(b: Bed, dest: AudioNode): void {
    const cicada = (f: number, q: number, am: number, swellRate: number, pan: number, level: number): void => {
      const p = b.pan(pan, dest);
      const swell = b.gain(level * 0.5, p);
      b.lfo(swell.gain, swellRate, level * 0.45);
      const amg = b.gain(0.5, swell);
      b.lfo(amg.gain, am, 0.5, 'square');
      const bp = b.filter('bandpass', f, q, amg);
      b.noise('white', bp);
    };
    cicada(5200, 8, 34, 0.12, -0.5, 1);
    cicada(6350, 10, 43, 0.085, 0.6, 0.8);
    // Dense distant insect chorus.
    const gc = b.gain(0.03, dest);
    const bpc = b.filter('bandpass', 7600, 1.5, gc);
    b.noise('white', bpc);
    // Low, humid jungle body.
    const gh = b.gain(0.035, dest);
    const bph = b.filter('bandpass', 260, 0.7, gh);
    b.noise('pink', bph);
  }

  private cricket(t: number): void {
    const c = pick(this.crickets);
    if (chance(0.25)) return; // irregular rhythm
    this.event(this.layers.jungle, t, c.pan, 0.3, 0.05, (s) => {
      const g = s.gain(0);
      const a = 0.1 * c.level;
      const n = c.pulses + (chance(0.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const tk = t + k * c.gap;
        g.gain.setValueAtTime(0, tk);
        g.gain.linearRampToValueAtTime(a, tk + 0.004);
        g.gain.linearRampToValueAtTime(a * 0.6, tk + 0.016);
        g.gain.linearRampToValueAtTime(0, tk + 0.022);
      }
      const o = s.osc('sine', c.f, t, t + n * c.gap + 0.03, g);
      o.frequency.setValueAtTime(c.f, t);
      o.frequency.linearRampToValueAtTime(c.f * 0.985, t + n * c.gap);
    });
  }

  private trill(t: number): void {
    this.event(this.layers.jungle, t, rand(-0.8, 0.8), rand(0.2, 0.6), 0.08, (s) => {
      const dur = rand(0.8, 2);
      const env = s.gain(0);
      s.bell(env.gain, t, dur, rand(0.04, 0.06), 0.3, 0.5);
      const am = s.gain(0.5, env);
      s.lfo(am.gain, rand(20, 28), 0.5, t, t + dur + 0.02, 'square');
      s.osc('sine', rand(3400, 4200), t, t + dur + 0.02, am);
    });
  }

  private frog(t: number): void {
    this.event(this.layers.jungle, t, rand(-0.8, 0.8), rand(0.1, 0.6), 0.1, (s) => {
      const n = randInt(2, 5);
      const f = rand(800, 1300);
      const gap = rand(0.12, 0.2);
      for (let k = 0; k < n; k++) {
        const tk = t + k * gap;
        const g = s.gain(0);
        const end = s.perc(g.gain, tk, rand(0.05, 0.08), 0.002, 0.02);
        const o = s.osc('sine', f, tk, end, g);
        s.sweep(o.frequency, tk, 0.03, f * 1.12, f * 0.92);
        const g2 = s.gain(0);
        const end2 = s.perc(g2.gain, tk, 0.02, 0.002, 0.012);
        s.osc('sine', f * 1.5, tk, end2, g2);
      }
    });
  }

  // ------------------------------------------------------------------------------------------
  // Birds
  // ------------------------------------------------------------------------------------------

  private birdCall(t: number): void {
    const distance = rand(0, 0.8);
    this.event(this.layers.birds, t, rand(-0.85, 0.85), distance, 0.1 + distance * 0.3, (s) => {
      const r = Math.random();
      if (r < 0.35) birdWhistle(s, t);
      else if (r < 0.6) birdWarble(s, t);
      else if (r < 0.85) birdChirps(s, t);
      else birdCoo(s, t);
    });
  }

  private parrot(t: number): void {
    const distance = rand(0.1, 0.7);
    this.event(this.layers.birds, t, rand(-0.8, 0.8), distance, 0.15 + distance * 0.3, (s) => {
      const d1 = parrotSquawk(s, t);
      if (chance(0.35)) parrotSquawk(s, t + d1 + rand(0.08, 0.2));
    });
  }

  // ------------------------------------------------------------------------------------------
  // Harbour
  // ------------------------------------------------------------------------------------------

  private buildHarbor(b: Bed, dest: AudioNode): void {
    // Water lapping against the pier: band-passed brown noise with irregular swells.
    for (const side of [-1, 1]) {
      const p = b.pan(side * 0.45, dest);
      const g = b.gain(0.2, p);
      b.lfo(g.gain, side < 0 ? 0.37 : 0.29, 0.1);
      b.lfo(g.gain, side < 0 ? 0.83 : 0.71, 0.08);
      const bp = b.filter('bandpass', 420, 1.0, g);
      b.lfo(bp.frequency, side < 0 ? 0.23 : 0.19, 120);
      b.noise('brown', bp);
    }
  }

  private waterSlap(t: number): void {
    this.event(this.layers.harbor, t, rand(-0.7, 0.7), rand(0, 0.5), 0.05, (s) => {
      burst(s, 'pink', t, 'bandpass', rand(500, 900), 1.4, rand(0.25, 0.45), 0.03, 0.09);
      if (chance(0.4)) bloop(s, t + rand(0.02, 0.1), rand(500, 900), rand(1.3, 1.7), 0.05, rand(0.02, 0.04));
    });
  }

  private hullCreak(t: number): void {
    const distance = rand(0.1, 0.7);
    this.event(this.layers.harbor, t, rand(-0.8, 0.8), distance, 0.12 + distance * 0.25, (s) => {
      creak(s, t, rand(0.4, 1.2), rand(45, 110), rand(0.1, 0.18), s.out, rand(0.8, 1.2));
      if (chance(0.3)) creak(s, t + rand(0.5, 1.4), rand(0.3, 0.7), rand(60, 130), rand(0.06, 0.12), s.out, rand(0.9, 1.3));
    });
  }

  private rigging(t: number): void {
    const distance = rand(0, 0.6);
    this.event(this.layers.harbor, t, rand(-0.8, 0.8), distance, 0.1 + distance * 0.2, (s) => {
      const r = Math.random();
      if (r < 0.35) {
        // Rope squeak under tension.
        const dur = rand(0.15, 0.4);
        const f = rand(600, 1100);
        const env = s.gain(0);
        s.bell(env.gain, t, dur, rand(0.03, 0.05), 0.5, 1);
        const am = s.gain(0.6, env);
        s.lfo(am.gain, rand(25, 40), 0.4, t, t + dur + 0.02);
        const bp = s.filter('bandpass', f * 1.2, 3, am);
        const o = s.osc('triangle', f, t, t + dur + 0.02, bp);
        s.sweep(o.frequency, t, dur, f, f * rand(1.1, 1.4));
      } else if (r < 0.7) {
        // Wooden blocks / pulleys knocking.
        const n = randInt(2, 3);
        let tt = t;
        for (let k = 0; k < n; k++) {
          const f = rand(650, 1000);
          modal(s, tt, [f, f * 1.6, f * 2.3], [0.06, 0.03, 0.015], [0.03, 0.02, 0.012]);
          tt += rand(0.12, 0.25);
        }
      } else if (r < 0.85) {
        // Metal fitting clink.
        ping(s, t, rand(2200, 3500), 0.02, 0.15);
        if (chance(0.5)) ping(s, t + rand(0.1, 0.3), rand(2200, 3500), 0.014, 0.12);
      } else {
        // Canvas / flag flapping.
        const dur = rand(0.6, 1.2);
        const env = s.gain(0);
        s.bell(env.gain, t, dur, 0.07, 0.4, 1);
        const am = s.gain(0.5, env);
        s.lfo(am.gain, rand(9, 14), 0.5, t, t + dur + 0.02, 'square');
        const bp = s.filter('bandpass', 900, 0.8, am);
        s.noise('pink', t, t + dur + 0.02, bp);
      }
    });
  }

  private gull(t: number): void {
    const distance = rand(0.35, 0.9);
    this.event(this.layers.harbor, t, rand(-0.9, 0.9), distance, 0.25 + distance * 0.3, (s) => {
      const laugh = chance(0.4);
      const n = laugh ? randInt(3, 6) : randInt(1, 3);
      let tt = t;
      for (let k = 0; k < n; k++) {
        const dur = laugh ? rand(0.1, 0.14) : rand(0.3, 0.5);
        const f0 = rand(1000, 1300) * (laugh ? 1 - k * 0.03 : 1);
        const stop = tt + dur + 0.02;
        const env = s.gain(0);
        s.bell(env.gain, tt, dur, 0.09, 0.25, 0.8);
        const b2 = s.gain(0.5, env);
        const bp1 = s.filter('bandpass', 1800, 2.5, env);
        const bp2 = s.filter('bandpass', 3000, 3, b2);
        const o = s.osc('sawtooth', f0, tt, stop, bp1);
        o.connect(bp2);
        const start = tt;
        // "kee-ow": quick rise then a long fall.
        s.curve(o.frequency, start, dur, (x) => f0 * (x < 0.15 ? 1 + 1.6 * x : 1.24 - 0.5 * (x - 0.15)));
        s.lfo(o.frequency, rand(9, 14), f0 * 0.025, tt, stop);
        tt += dur + (laugh ? rand(0.05, 0.09) : rand(0.25, 0.45));
      }
    });
  }

  private shipBell(t: number): void {
    this.event(this.layers.harbor, t, rand(-0.7, 0.7), rand(0.5, 0.9), 0.5, (s) => {
      const f = rand(560, 760);
      const ratios = [0.5, 1, 1.19, 1.5, 2, 2.52, 3.01, 4.17];
      const amps = [0.25, 1, 0.45, 0.35, 0.5, 0.18, 0.15, 0.08].map((a) => a * 0.035);
      const taus = [2.2, 1.6, 1.0, 0.9, 0.7, 0.45, 0.35, 0.25];
      for (const strike of [0, rand(0.45, 0.6)]) {
        modal(s, t + strike, ratios.map((r) => f * r), amps, taus, s.out, 0.002);
      }
    });
  }
}

function stream(initial: () => number, interval: () => number, fire: (t: number) => void): Stream {
  return { next: NaN, initial, interval, fire };
}

// ---------------------------------------------------------------------------------------------
// Bird voices (FM sweeps)
// ---------------------------------------------------------------------------------------------

/** 1-4 pure whistled notes with glides (and sometimes vibrato). */
function birdWhistle(s: Synth, t: number): void {
  const n = randInt(1, 4);
  const g = s.gain(0);
  const base = rand(1800, 3200);
  let tt = t;
  const notes: Array<[number, number, number, number]> = [];
  for (let k = 0; k < n; k++) {
    const dur = rand(0.08, 0.25);
    const f0 = base * rand(0.85, 1.2);
    const f1 = f0 * rand(0.75, 1.5);
    notes.push([tt, dur, f0, f1]);
    tt += dur + rand(0.04, 0.14);
  }
  const o = s.osc('sine', notes[0][2], t, tt + 0.02, g);
  const a = rand(0.05, 0.09);
  for (const [t0, dur, f0, f1] of notes) {
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(a, t0 + 0.012);
    g.gain.setValueAtTime(a, t0 + Math.max(0.013, dur - 0.025));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
  }
  if (chance(0.4)) s.lfo(o.frequency, rand(25, 40), base * 0.02, t, tt + 0.02);
}

/** Fast FM trill (warbler). */
function birdWarble(s: Synth, t: number): void {
  const dur = rand(0.3, 0.8);
  const fc = rand(2500, 4000);
  const env = s.gain(0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(rand(0.04, 0.07), t + 0.02);
  env.gain.setTargetAtTime(0, t + dur - 0.05, 0.03);
  const o = s.osc('sine', fc, t, t + dur + 0.2, env);
  s.sweep(o.frequency, t, dur, fc, fc * rand(0.8, 0.92));
  s.lfo(o.frequency, rand(18, 35), rand(200, 600), t, t + dur + 0.2);
}

/** Series of short descending chirps. */
function birdChirps(s: Synth, t: number): void {
  const n = randInt(3, 7);
  const gap = rand(0.06, 0.1);
  const fHi = rand(4200, 5600);
  const fLo = fHi * rand(0.5, 0.65);
  const a = rand(0.04, 0.07);
  for (let k = 0; k < n; k++) {
    const tk = t + k * gap;
    const g = s.gain(0);
    g.gain.setValueAtTime(0, tk);
    g.gain.linearRampToValueAtTime(a * (1 - k * 0.06), tk + 0.006);
    g.gain.linearRampToValueAtTime(0, tk + 0.04);
    const o = s.osc('sine', fHi, tk, tk + 0.045, g);
    s.sweep(o.frequency, tk, 0.035, fHi, fLo);
  }
}

/** Soft dove-like "hoo-hoo-hooo". */
function birdCoo(s: Synth, t: number): void {
  const n = randInt(2, 3);
  const f = rand(480, 650);
  let tt = t;
  for (let k = 0; k < n; k++) {
    const dur = k === n - 1 ? rand(0.3, 0.4) : rand(0.16, 0.22);
    const env = s.gain(0);
    s.bell(env.gain, tt, dur, rand(0.05, 0.07), 0.35, 0.8);
    const o = s.osc('sine', f, tt, tt + dur + 0.02, env);
    s.glide(o.frequency, tt, dur, f * 0.94, f * 1.04, f * 0.9, 0.3);
    const g2 = s.gain(0.15, env);
    const o2 = s.osc('sine', f * 2, tt, tt + dur + 0.02, g2);
    s.glide(o2.frequency, tt, dur, f * 1.88, f * 2.08, f * 1.8, 0.3);
    tt += dur + rand(0.12, 0.2);
  }
}

/** Harsh parrot squawk: FM-roughened sawtooth through beak formants. Returns its duration. */
function parrotSquawk(s: Synth, t: number): number {
  const dur = rand(0.22, 0.4);
  const f0 = rand(650, 900);
  const stop = t + dur + 0.02;
  const env = s.gain(0);
  s.bell(env.gain, t, dur, 0.1, 0.25, 0.7);
  const formants: Array<[number, number, number]> = [
    [rand(2000, 2400), 2, 1],
    [rand(3400, 3800), 3, 0.6],
    [rand(1200, 1400), 2, 0.5],
  ];
  const o = s.osc('sawtooth', f0, t, stop, null);
  s.glide(o.frequency, t, dur, f0, f0 * rand(1.25, 1.5), f0 * rand(0.8, 1.0), rand(0.3, 0.5));
  s.lfo(o.frequency, rand(80, 140), f0 * rand(0.25, 0.45), t, stop);
  for (const [f, q, g] of formants) {
    const gg = s.gain(g, env);
    const bp = s.filter('bandpass', f, q, gg);
    o.connect(bp);
  }
  const gn = s.gain(0.3, env);
  const bpn = s.filter('bandpass', 2600, 1, gn);
  s.noise('white', t, stop, bpn);
  return dur;
}
