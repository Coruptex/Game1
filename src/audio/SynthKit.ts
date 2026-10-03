/**
 * Shared low-level synthesis helpers used by the one-shot recipes (SoundLibrary) and the
 * procedural ambience. Everything works on any BaseAudioContext so it can be rendered offline.
 */

// ---------------------------------------------------------------------------------------------
// Random / math helpers
// ---------------------------------------------------------------------------------------------

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const randInt = (min: number, maxInclusive: number): number => Math.floor(rand(min, maxInclusive + 1));
export const chance = (p: number): boolean => Math.random() < p;
export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
/** Frequency ratio for a detune in cents. */
export const cents = (c: number): number => Math.pow(2, c / 1200);
/** MIDI note number to Hz. */
export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const smooth = (x: number): number => x * x * (3 - 2 * x);

/** Deterministic PRNG (mulberry32) so noise banks are identical on every launch. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Cached noise buffers
// ---------------------------------------------------------------------------------------------

/**
 * white   – uniform white noise, peak 1 (RMS ≈ 0.58)
 * pink    – Paul Kellet pink noise, RMS 0.25
 * brown   – leaky-integrated (red) noise, RMS 0.25
 * crackle – sparse random grains/pops (sand, grass, fire, gravel), peak 1
 */
export type NoiseKind = 'white' | 'pink' | 'brown' | 'crackle';

const NOISE_SECONDS: Record<NoiseKind, number> = { white: 2.5, pink: 4, brown: 5, crackle: 3 };
const NOISE_SEED: Record<NoiseKind, number> = { white: 11, pink: 23, brown: 37, crackle: 53 };
const noiseCache = new Map<string, AudioBuffer>();

export function createBuffer(ctx: BaseAudioContext, channels: number, length: number): AudioBuffer {
  try {
    return new AudioBuffer({ numberOfChannels: channels, length, sampleRate: ctx.sampleRate });
  } catch {
    return ctx.createBuffer(channels, length, ctx.sampleRate);
  }
}

/**
 * Returns a cached, seamlessly loopable mono noise buffer for the context's sample rate.
 * AudioBuffers are context independent, so the cache is shared by every context with that rate.
 */
export function getNoiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  const key = `${kind}@${ctx.sampleRate}`;
  let buffer = noiseCache.get(key);
  if (!buffer) {
    buffer = generateNoise(ctx, kind);
    noiseCache.set(key, buffer);
  }
  return buffer;
}

/** Generates every noise buffer up front (call once at start-up to avoid a hitch on first use). */
export function preloadNoiseBuffers(ctx: BaseAudioContext): void {
  for (const kind of Object.keys(NOISE_SECONDS) as NoiseKind[]) getNoiseBuffer(ctx, kind);
}

function generateNoise(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(NOISE_SECONDS[kind] * sr);
  const fade = Math.floor(0.05 * sr);
  const raw = new Float32Array(n + fade);
  const rnd = mulberry32(NOISE_SEED[kind]);
  const white = (): number => rnd() * 2 - 1;

  if (kind === 'white') {
    for (let i = 0; i < raw.length; i++) raw[i] = white();
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      last = (last + 0.02 * white()) / 1.02;
      raw[i] = last;
    }
  } else {
    // Crackle: sparse grains with exponential-ish amplitude distribution and tiny decays.
    const density = 1400 / sr;
    let i = 0;
    while (i < raw.length) {
      if (rnd() < density) {
        const amp = Math.pow(rnd(), 2.2) * (rnd() < 0.5 ? -1 : 1);
        const len = 2 + Math.floor(rnd() * 10);
        for (let k = 0; k < len && i + k < raw.length; k++) {
          raw[i + k] += amp * Math.exp(-k / (len * 0.35)) * (k % 2 === 0 ? 1 : -0.6);
        }
        i += len;
      } else {
        i++;
      }
    }
  }

  // Remove DC, then normalise.
  let mean = 0;
  for (let i = 0; i < raw.length; i++) mean += raw[i];
  mean /= raw.length;
  for (let i = 0; i < raw.length; i++) raw[i] -= mean;

  const out = new Float32Array(n);
  out.set(raw.subarray(0, n));
  // Equal-power crossfade of the continuation into the head so the buffer loops without a click.
  for (let i = 0; i < fade; i++) {
    const x = i / fade;
    out[i] = raw[n + i] * Math.sqrt(1 - x) + raw[i] * Math.sqrt(x);
  }

  let peak = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = out[i];
    sum += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const rms = Math.sqrt(sum / n);
  let scale = 1 / Math.max(1e-9, peak);
  if (kind === 'pink' || kind === 'brown') scale = Math.min(0.25 / Math.max(1e-9, rms), 0.99 / Math.max(1e-9, peak));
  for (let i = 0; i < n; i++) out[i] *= scale;

  const buffer = createBuffer(ctx, 1, n);
  buffer.getChannelData(0).set(out);
  return buffer;
}

// ---------------------------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------------------------

/** Smooth asymmetric bell (0 → 1 → 0) peaking at `peakPos` (0..1). `power` > 1 makes it pointier. */
export function bellShape(x: number, peakPos: number, power = 1): number {
  const k = Math.log(0.5) / Math.log(clamp(peakPos, 0.02, 0.98));
  const v = Math.sin(Math.PI * Math.pow(clamp(x, 0, 1), k));
  return Math.pow(Math.max(0, v), power);
}

/** Piecewise exponential glide f0 → f1 (at peakPos) → f2 with smoothstep easing. */
export function glideShape(x: number, f0: number, f1: number, f2: number, peakPos: number): number {
  if (x <= peakPos) {
    const u = smooth(clamp(x / Math.max(1e-6, peakPos), 0, 1));
    return f0 * Math.pow(f1 / f0, u);
  }
  const u = smooth(clamp((x - peakPos) / Math.max(1e-6, 1 - peakPos), 0, 1));
  return f1 * Math.pow(f2 / f1, u);
}

/**
 * Transfer curve for a WaveShaper: linear below `knee`, smoothly saturating to `ceiling`.
 * Inputs beyond ±1 are clamped by the WaveShaper, so the output can never exceed `ceiling`.
 */
export function softClipCurve(knee = 0.7, ceiling = 0.9, size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const range = Math.max(1e-6, ceiling - knee);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + range * Math.tanh((a - knee) / range);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** Symmetric tanh saturation curve normalised so that input ±1 maps to ±ceiling. */
export function saturationCurve(drive: number, ceiling = 0.9, size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = (ceiling * Math.tanh(drive * x)) / norm;
  }
  return curve;
}

// ---------------------------------------------------------------------------------------------
// Panning with fallback
// ---------------------------------------------------------------------------------------------

export interface Panner {
  readonly node: AudioNode;
  /** Smoothly moves the pan position (-1 left … 1 right). */
  set(pan: number, when?: number, timeConstant?: number): void;
}

export function createPanner(ctx: BaseAudioContext, pan = 0): Panner {
  const p = clamp(pan, -1, 1);
  if (typeof ctx.createStereoPanner === 'function') {
    const node = new StereoPannerNode(ctx, { pan: p });
    return {
      node,
      set(v, when = ctx.currentTime, tc = 0.03) {
        node.pan.setTargetAtTime(clamp(v, -1, 1), when, tc);
      },
    };
  }
  // Old Safari fallback: equal-power PannerNode positioned on a unit circle in front of the listener.
  const node = ctx.createPanner();
  node.panningModel = 'equalpower';
  node.distanceModel = 'linear';
  node.refDistance = 1;
  node.maxDistance = 10000;
  node.rolloffFactor = 0;
  const place = (v: number): void => {
    const a = clamp(v, -1, 1) * (Math.PI / 2);
    node.setPosition(Math.sin(a), 0, -Math.cos(a));
  };
  place(p);
  return { node, set: (v) => place(v) };
}

// ---------------------------------------------------------------------------------------------
// Reverb impulse response
// ---------------------------------------------------------------------------------------------

export interface ImpulseOptions {
  /** IR length in seconds. */
  seconds?: number;
  /** Time for the tail to decay by 60 dB. */
  rt60?: number;
  preDelay?: number;
  /** 0..1, how quickly high frequencies die out compared to lows. */
  damping?: number;
  seed?: number;
}

/**
 * Procedural stereo impulse response: sparse early reflections followed by exponentially decaying,
 * progressively low-passed, decorrelated noise. Sounds like a soft outdoor/stone space.
 */
export function createImpulseResponse(ctx: BaseAudioContext, opts: ImpulseOptions = {}): AudioBuffer {
  const seconds = opts.seconds ?? 2.2;
  const rt60 = opts.rt60 ?? 1.7;
  const preDelay = opts.preDelay ?? 0.012;
  const damping = clamp(opts.damping ?? 0.6, 0, 1);
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * sr));
  const buffer = createBuffer(ctx, 2, len);
  const rnd = mulberry32(opts.seed ?? 7);
  const decayK = 6.907755 / rt60; // ln(1000)

  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let lp = 0;
    const start = Math.floor(preDelay * sr);
    for (let i = start; i < len; i++) {
      const t = (i - start) / sr;
      const env = Math.exp(-decayK * t);
      // One-pole low-pass whose cutoff falls over time (high frequencies decay faster).
      const coef = lerp(0.9, 0.9 - 0.82 * damping, Math.min(1, Math.pow(t / rt60, 0.55)));
      lp += coef * (rnd() * 2 - 1 - lp);
      // Fade the first few ms in so the diffuse tail swells out of the early reflections.
      const fadeIn = Math.min(1, t / 0.02);
      d[i] = lp * env * (0.35 + 0.65 * fadeIn);
    }
    // Early reflections (different per channel for width).
    const taps = 9;
    for (let k = 0; k < taps; k++) {
      const tt = preDelay + 0.004 + rnd() * 0.07;
      const idx = Math.floor(tt * sr);
      if (idx < len) d[idx] += (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5) * Math.exp(-decayK * (tt - preDelay)) * 0.9;
    }
    // Fade out the very end to avoid a truncation click.
    const tail = Math.floor(Math.min(0.1, seconds * 0.2) * sr);
    for (let i = 0; i < tail; i++) d[len - 1 - i] *= i / tail;
  }
  return buffer;
}

// ---------------------------------------------------------------------------------------------
// Synth: tiny node-graph builder used by every recipe
// ---------------------------------------------------------------------------------------------

/**
 * Helper bound to one context / output / start time / pitch. Recipe-relative times are scaled by
 * 1/pitch and frequencies by pitch, emulating a sample's playbackRate.
 */
export class Synth {
  /** Latest scheduled stop time (absolute). */
  end: number;
  /** Source with the latest stop time: its `onended` marks the end of the whole sound. */
  lastSource: AudioScheduledSourceNode | null = null;
  readonly nyquist: number;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
    /** Absolute start time. */
    readonly t0: number,
    /** Pitch / playback-rate multiplier. */
    readonly p = 1,
  ) {
    this.end = t0;
    this.nyquist = ctx.sampleRate / 2;
  }

  /** Absolute time for a recipe-relative offset (seconds at pitch 1). */
  t(offset: number): number {
    return this.t0 + offset / this.p;
  }

  /** Real duration of a recipe duration. */
  d(seconds: number): number {
    return seconds / this.p;
  }

  /** Pitched frequency, kept below Nyquist. */
  f(hz: number): number {
    return Math.min(hz * this.p, this.nyquist * 0.92);
  }

  /** Clamp an absolute frequency (already pitched) below Nyquist. */
  safeHz(hz: number): number {
    return clamp(hz, 1, this.nyquist * 0.92);
  }

  private track(stop: number, src: AudioScheduledSourceNode): void {
    if (stop >= this.end || !this.lastSource) {
      this.end = Math.max(this.end, stop);
      this.lastSource = src;
    }
  }

  /**
   * Calls `cb` once every source of this sound has stopped (via the last source's `onended`).
   * Used to disconnect the sound's output so the whole sub-graph can be garbage collected.
   */
  onEnded(cb: () => void): void {
    const last = this.lastSource;
    if (!last) {
      cb();
      return;
    }
    last.onended = () => {
      last.onended = null;
      cb();
    };
  }

  gain(value = 1, dest: AudioNode | null = this.out): GainNode {
    const g = new GainNode(this.ctx, { gain: value });
    if (dest) g.connect(dest);
    return g;
  }

  filter(type: BiquadFilterType, frequency: number, q = 0.707, dest: AudioNode | null = this.out, gainDb = 0): BiquadFilterNode {
    const f = new BiquadFilterNode(this.ctx, { type, frequency: this.safeHz(frequency), Q: q, gain: gainDb });
    if (dest) f.connect(dest);
    return f;
  }

  osc(type: OscillatorType, frequency: number, start: number, stop: number, dest: AudioNode | null = this.out, detune = 0): OscillatorNode {
    const o = new OscillatorNode(this.ctx, { type, frequency: this.safeHz(frequency), detune });
    if (dest) o.connect(dest);
    o.start(start);
    o.stop(stop);
    this.track(stop, o);
    return o;
  }

  /** Looping noise source starting at a random offset of the cached buffer. */
  noise(kind: NoiseKind, start: number, stop: number, dest: AudioNode | null = this.out, rate = 1): AudioBufferSourceNode {
    const buffer = getNoiseBuffer(this.ctx, kind);
    const src = new AudioBufferSourceNode(this.ctx, { buffer, loop: true, playbackRate: rate });
    if (dest) src.connect(dest);
    src.start(start, Math.random() * buffer.duration * 0.9);
    src.stop(stop);
    this.track(stop, src);
    return src;
  }

  pan(value: number, dest: AudioNode | null = this.out): AudioNode {
    const p = createPanner(this.ctx, value);
    if (dest) p.node.connect(dest);
    return p.node;
  }

  shaper(curve: Float32Array<ArrayBuffer>, dest: AudioNode | null = this.out): WaveShaperNode {
    const w = new WaveShaperNode(this.ctx, { curve });
    if (dest) w.connect(dest);
    return w;
  }

  /** Sine LFO added onto `param` (depth in the param's units). */
  lfo(param: AudioParam, rate: number, depth: number, start: number, stop: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = new OscillatorNode(this.ctx, { type, frequency: rate });
    const g = new GainNode(this.ctx, { gain: depth });
    o.connect(g);
    g.connect(param);
    o.start(start);
    o.stop(stop);
    this.track(stop, o);
    return o;
  }

  // ----- envelopes (absolute times) -----

  /** Percussive envelope: linear attack, exponential decay (time constant `tau`). Returns ~-60 dB time. */
  perc(param: AudioParam, start: number, peak: number, attack: number, tau: number): number {
    param.setValueAtTime(0, start);
    if (attack > 0) param.linearRampToValueAtTime(peak, start + attack);
    else param.setValueAtTime(peak, start);
    param.setTargetAtTime(0, start + attack, tau);
    return start + attack + tau * 7;
  }

  /** Attack / hold / exponential release envelope. Returns ~-60 dB time. */
  ahr(param: AudioParam, start: number, peak: number, attack: number, hold: number, tau: number): number {
    param.setValueAtTime(0, start);
    param.linearRampToValueAtTime(peak, start + attack);
    param.setValueAtTime(peak, start + attack + hold);
    param.setTargetAtTime(0, start + attack + hold, tau);
    return start + attack + hold + tau * 7;
  }

  /** Smooth bell envelope over [start, start+dur]. */
  bell(param: AudioParam, start: number, dur: number, peak: number, peakPos = 0.5, power = 1, points = 64): void {
    const c = new Float32Array(points);
    for (let i = 0; i < points; i++) c[i] = peak * bellShape(i / (points - 1), peakPos, power);
    c[0] = 0;
    c[points - 1] = 0;
    param.setValueCurveAtTime(c, start, Math.max(0.001, dur));
  }

  /** Arbitrary curve fn(x∈[0,1]) over [start, start+dur]. */
  curve(param: AudioParam, start: number, dur: number, fn: (x: number) => number, points = 48): void {
    const c = new Float32Array(points);
    for (let i = 0; i < points; i++) c[i] = fn(i / (points - 1));
    param.setValueCurveAtTime(c, start, Math.max(0.001, dur));
  }

  /** f0 → f1 (at peakPos) → f2 glide on a frequency param (absolute Hz, clamped below Nyquist). */
  glide(param: AudioParam, start: number, dur: number, f0: number, f1: number, f2: number, peakPos = 0.5): void {
    this.curve(param, start, dur, (x) => this.safeHz(glideShape(x, f0, f1, f2, peakPos)));
  }

  /** Exponential sweep from → to over dur. */
  sweep(param: AudioParam, start: number, dur: number, from: number, to: number): void {
    param.setValueAtTime(Math.max(1e-4, from), start);
    param.exponentialRampToValueAtTime(Math.max(1e-4, to), start + Math.max(0.001, dur));
  }
}
