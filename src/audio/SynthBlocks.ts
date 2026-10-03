import {
  Synth,
  clamp,
  midiHz,
  rand,
  randInt,
  type NoiseKind,
} from './SynthKit';

/**
 * Reusable synthesis building blocks (impacts, modal pings, creaks, voices, chords...) shared by
 * the one-shot recipes (SoundLibrary) and the procedural ambience. All times are absolute context
 * times; frequencies passed in are absolute Hz unless noted ("already pitched").
 */

/** Sine with an exponential pitch drop: kick / body thump. */
export function thump(s: Synth, start: number, f0: number, f1: number, sweepDur: number, peak: number, tau: number, dest: AudioNode = s.out): number {
  const g = s.gain(0, dest);
  const end = s.perc(g.gain, start, peak, 0.002, tau);
  const o = s.osc('sine', f0, start, end, g);
  s.sweep(o.frequency, start, sweepDur, f0, f1);
  return end;
}

/** Filtered noise burst with a percussive envelope. Returns the filter (for extra automation). */
export function burst(
  s: Synth,
  kind: NoiseKind,
  start: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  attack: number,
  tau: number,
  dest: AudioNode = s.out,
  rate = 1,
): BiquadFilterNode {
  const g = s.gain(0, dest);
  const f = s.filter(type, freq, q, g);
  const end = s.perc(g.gain, start, peak, attack, tau);
  s.noise(kind, start, end, f, rate);
  return f;
}

/** Sum of exponentially decaying sines (modal synthesis): knocks, pings, bells. */
export function modal(s: Synth, start: number, freqs: number[], amps: number[], taus: number[], dest: AudioNode = s.out, attack = 0.0015): number {
  let end = start;
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i] >= s.nyquist * 0.9 || amps[i] <= 0) continue;
    const g = s.gain(0, dest);
    const e = s.perc(g.gain, start + rand(0, 0.0012), amps[i], attack, taus[i]);
    s.osc('sine', freqs[i], start, e, g);
    end = Math.max(end, e);
  }
  return end;
}

/** Bubble: sine whose pitch rises while it decays. */
export function bloop(s: Synth, start: number, f: number, rise: number, dur: number, peak: number, dest: AudioNode = s.out): void {
  const g = s.gain(0, dest);
  const end = s.perc(g.gain, start, peak, 0.002, dur * 0.45);
  const o = s.osc('sine', s.safeHz(f), start, end, g);
  s.sweep(o.frequency, start, dur, s.safeHz(f), s.safeHz(f * rise));
}

/** Soft bell / chime tone (inharmonic partials). `f` is already pitched. */
export function bellTone(s: Synth, start: number, f: number, peak: number, tau: number, dest: AudioNode = s.out): number {
  return modal(s, start, [f, f * 2.76, f * 5.4], [peak, peak * 0.22, peak * 0.07], [tau, tau * 0.45, tau * 0.25], dest, 0.003);
}

/** Simple enveloped tone. */
export function tone(s: Synth, start: number, f: number, type: OscillatorType, peak: number, tau: number, dest: AudioNode = s.out, attack = 0.004): number {
  const g = s.gain(0, dest);
  const end = s.perc(g.gain, start, peak, attack, tau);
  s.osc(type, f, start, end, g);
  return end;
}

/** Band-passed noise whoosh with a doppler-like f0 → f1 → f2 sweep and bell envelope. */
export function whoosh(
  s: Synth,
  kind: NoiseKind,
  start: number,
  dur: number,
  f: [number, number, number],
  q: number,
  peak: number,
  peakPos: number,
  power: number,
  dest: AudioNode = s.out,
): void {
  const g = s.gain(0, dest);
  const bp = s.filter('bandpass', f[0], q, g);
  s.glide(bp.frequency, start, dur, f[0], f[1], f[2], peakPos);
  s.bell(g.gain, start, dur, peak, peakPos, power);
  s.noise(kind, start, start + dur + 0.01, bp);
}

/** Short sharp transient. */
export function click(s: Synth, start: number, hp: number, peak: number, tau: number, dest: AudioNode = s.out): void {
  burst(s, 'white', start, 'highpass', hp, 0.7, peak, 0.0004, tau, dest);
}

/** Generic body impact used by hurt/death sounds: thump + fleshy slap + click. */
export function impact(s: Synth, start: number, level: number, dest: AudioNode = s.out): void {
  const g = s.gain(level, dest);
  thump(s, start, s.f(rand(115, 135)), s.f(rand(48, 58)), s.d(0.09), 0.5, s.d(0.05), g);
  const f = burst(s, 'pink', start, 'bandpass', s.f(1400), 0.9, 0.95, 0.002, s.d(0.032), g);
  s.sweep(f.frequency, start, s.d(0.1), s.f(rand(1300, 1600)), s.f(rand(550, 700)));
  click(s, start, s.f(2500), 0.22, s.d(0.004), g);
}

/** Two low thuds + cloth/gear rustle: a body hitting the ground. */
export function fall(s: Synth, start: number, level: number, dest: AudioNode = s.out): void {
  const g = s.gain(level, dest);
  const thud = (t0: number, a: number): void => {
    burst(s, 'brown', t0, 'lowpass', s.f(rand(220, 280)), 0.8, 1.1 * a, 0.004, s.d(0.065), g);
    thump(s, t0, s.f(rand(70, 82)), s.f(rand(40, 46)), s.d(0.08), 0.45 * a, s.d(0.07), g);
    burst(s, 'pink', t0, 'bandpass', s.f(rand(650, 850)), 1, 0.55 * a, 0.002, s.d(0.03), g);
  };
  thud(start, 1);
  thud(start + s.d(rand(0.1, 0.16)), rand(0.5, 0.7));
  const gr = s.gain(0, g);
  const bp = s.filter('bandpass', s.f(rand(1700, 2200)), 0.7, gr);
  const dur = s.d(rand(0.35, 0.45));
  s.bell(gr.gain, start, dur, 0.55, 0.22, 1.2);
  s.noise('crackle', start, start + dur + 0.01, bp, rand(1.0, 1.4));
}

/** Metallic ping (coin, buckle, ring). `f0` already pitched. */
export function ping(s: Synth, start: number, f0: number, peak: number, tau: number, dest: AudioNode = s.out): number {
  const ratios = [1, rand(1.45, 1.62), rand(2.2, 2.5), rand(3.0, 3.4)];
  const amps = [1, 0.62, 0.4, 0.25].map((a) => a * peak);
  const taus = [tau, tau * 0.7, tau * 0.45, tau * 0.3];
  burst(s, 'white', start, 'highpass', 6000, 0.7, peak * 1.1, 0.0003, 0.0018, dest);
  return modal(
    s,
    start,
    ratios.map((r) => f0 * r),
    amps,
    taus,
    dest,
    0.0006,
  );
}

/** Several coins clinking with random spacing. */
export function coinsInto(s: Synth, start: number, level: number, dest: AudioNode = s.out): void {
  const n = randInt(5, 8);
  let t = start;
  for (let i = 0; i < n; i++) {
    const a = level * rand(0.55, 1) * (1 - (i / n) * 0.55);
    const p = s.pan(rand(-0.35, 0.35), dest);
    ping(s, t, s.f(rand(2600, 4600)), 0.2 * a, s.d(rand(0.06, 0.13)), p);
    t += s.d(rand(0.03, 0.09) * (1 + i * 0.1));
  }
}

export interface Formant {
  f: number;
  /** Optional glide target. */
  to?: number;
  q: number;
  gain: number;
}

export interface VocalOptions {
  start: number;
  dur: number;
  /** Pitch contour [x 0..1, Hz] (already pitched). */
  contour: Array<[number, number]>;
  formants: Formant[];
  level: number;
  attack: number;
  /** Release time constant after `dur`. */
  release: number;
  /** 0..1 amplitude-modulation roughness (growl). */
  growl?: number;
  growlRate?: number;
  /** Aspiration noise level. */
  breath?: number;
  /** Random pitch wobble in Hz. */
  jitter?: number;
  dest?: AudioNode;
}

/** Tiny formant voice: band-limited sawtooth → parallel formant band-passes (grunts, groans, barks). */
export function vocal(s: Synth, o: VocalOptions): void {
  const end = o.start + o.dur;
  const stop = end + o.release * 7;
  const env = s.gain(0, o.dest ?? s.out);
  env.gain.setValueAtTime(0, o.start);
  env.gain.linearRampToValueAtTime(o.level, o.start + o.attack);
  env.gain.setValueAtTime(o.level, Math.max(o.start + o.attack, end - o.release));
  env.gain.setTargetAtTime(0, Math.max(o.start + o.attack, end - o.release), o.release);

  const sum = s.gain(1, env);
  const tilt = s.filter('lowpass', 2600, 0.5, null);
  const growl = clamp(o.growl ?? 0, 0, 1);
  const pre = s.gain(1 - growl * 0.5, tilt);
  if (growl > 0) s.lfo(pre.gain, o.growlRate ?? 45, growl * 0.5, o.start, stop);

  const osc = s.osc('sawtooth', o.contour[0][1], o.start, stop, pre);
  const contour = o.contour;
  s.curve(osc.frequency, o.start, o.dur, (x) => {
    for (let i = 1; i < contour.length; i++) {
      if (x <= contour[i][0]) {
        const [x0, f0] = contour[i - 1];
        const [x1, f1] = contour[i];
        const u = (x - x0) / Math.max(1e-6, x1 - x0);
        return f0 * Math.pow(f1 / f0, u);
      }
    }
    return contour[contour.length - 1][1];
  });
  if (o.jitter) {
    // Slow random wobble: brown noise played back very slowly, scaled to ±jitter Hz (RMS).
    const n = s.noise('brown', o.start, stop, null, 0.12);
    const jitterGain = s.gain(o.jitter * 4, null);
    n.connect(jitterGain);
    jitterGain.connect(osc.frequency);
  }
  for (const fm of o.formants) {
    const g = s.gain(fm.gain, sum);
    const bp = s.filter('bandpass', fm.f, fm.q, g);
    if (fm.to !== undefined) s.sweep(bp.frequency, o.start, o.dur, fm.f, fm.to);
    tilt.connect(bp);
  }
  if (o.breath) {
    const g = s.gain(o.breath, sum);
    const bp = s.filter('bandpass', s.f(1700), 0.8, g);
    s.noise('pink', o.start, stop, bp);
  }
}

/** Wooden creak: sawtooth stick-slip pulse train with wandering rate through wood resonances. */
export function creak(s: Synth, start: number, dur: number, base: number, level: number, dest: AudioNode = s.out, bright = 1): void {
  const env = s.gain(0, dest);
  s.bell(env.gain, start, dur, level, rand(0.3, 0.6), 0.8);
  const sum = s.gain(1, env);
  const stop = start + dur + 0.02;
  const osc = s.osc('sawtooth', base, start, stop, null);
  const pts: number[] = [];
  let v = 1;
  for (let i = 0; i < 10; i++) {
    v = clamp(v * rand(0.86, 1.17), 0.6, 1.7);
    pts.push(v);
  }
  s.curve(osc.frequency, start, dur, (x) => {
    const fi = x * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(fi));
    return s.safeHz(base * (pts[i] + (pts[i + 1] - pts[i]) * (fi - i)));
  });
  s.lfo(osc.frequency, rand(7, 13), base * rand(0.08, 0.16), start, stop);
  // Irregular stick-slip: slow random wobble of the pulse rate (≈ ±10 % RMS; never drives it below 0).
  const jitter = s.noise('brown', start, stop, null, rand(0.08, 0.14));
  const jg = s.gain(base * 0.4, null);
  jitter.connect(jg);
  jg.connect(osc.frequency);
  const res: Array<[number, number, number]> = [
    [rand(480, 700), 5, 1],
    [rand(1050, 1450), 7, 0.7],
    [rand(2100, 2800), 9, 0.4],
  ];
  for (const [f, q, g] of res) {
    const gg = s.gain(g, sum);
    const bp = s.filter('bandpass', f * bright, q, gg);
    osc.connect(bp);
  }
}

/** Fire crackle: sparse crackle grains + random pops + a low roar. */
export function fireCrackle(s: Synth, start: number, dur: number, level: number, dest: AudioNode = s.out): void {
  const shape = (x: number): number => Math.min(1, x / 0.08) * (x < 0.55 ? 1 : Math.max(0, 1 - (x - 0.55) / 0.45));
  const g = s.gain(0, dest);
  const bp = s.filter('bandpass', s.f(2400), 0.5, g);
  s.curve(g.gain, start, dur, (x) => level * shape(x) * (0.8 + 0.2 * Math.sin(x * 37)));
  s.noise('crackle', start, start + dur + 0.01, bp, rand(0.45, 0.6));
  const roar = s.gain(0, dest);
  const lp = s.filter('lowpass', s.f(420), 0.6, roar);
  s.curve(roar.gain, start, dur, (x) => level * 0.45 * shape(x));
  s.noise('brown', start, start + dur + 0.01, lp);
  const pops = randInt(5, 9);
  for (let i = 0; i < pops; i++) {
    const tp = start + rand(0.04, 0.8) * dur;
    burst(s, 'white', tp, 'bandpass', s.f(rand(900, 3200)), 1.4, level * rand(0.6, 1.4), 0.0004, 0.006, dest);
  }
}

export interface PadOptions {
  notes: number[];
  /** Attack time constant (setTarget). */
  attack: number;
  /** Time (s, relative to start) at which the release starts. */
  hold: number;
  release: number;
  level: number;
  cutoff: number;
  detune: number;
  spread: number;
  wave: OscillatorType;
  /** Brass-like brightness: cutoff follows the envelope from cutoff*0.3 up to cutoff. */
  brassy?: boolean;
  vibrato?: number;
  /** Optional peaking EQ for a vocal ("ah"/"oo") formant. */
  formant?: { f: number; q: number; db: number };
  dest?: AudioNode;
}

/** Sustained chord with slow attack (pads, choir/brass swells). Note numbers are MIDI. */
export function padChord(s: Synth, start: number, o: PadOptions): number {
  const dest = o.dest ?? s.out;
  const n = o.notes.length;
  const stop = start + o.hold + o.release * 7;
  for (let i = 0; i < n; i++) {
    const pan = n > 1 ? ((i % 2 === 0 ? -1 : 1) * o.spread * (0.4 + (0.6 * i) / (n - 1))) : 0;
    const p = s.pan(pan, dest);
    const env = s.gain(0, p);
    env.gain.setValueAtTime(0, start);
    env.gain.setTargetAtTime(o.level, start, o.attack);
    env.gain.setTargetAtTime(0, start + o.hold, o.release);
    let into: AudioNode = env;
    if (o.formant) into = s.filter('peaking', s.f(o.formant.f), o.formant.q, env, o.formant.db);
    const lp = s.filter('lowpass', o.cutoff, 0.6, into);
    if (o.brassy) {
      lp.frequency.setValueAtTime(o.cutoff * 0.3, start);
      lp.frequency.setTargetAtTime(o.cutoff, start, o.attack * 1.1);
      lp.frequency.setTargetAtTime(o.cutoff * 0.3, start + o.hold, o.release);
    }
    const f = s.f(midiHz(o.notes[i]));
    // Three detuned voices per note: a full ensemble without the periodic total cancellation of a pair.
    for (const d of [-o.detune, rand(-1.5, 1.5), o.detune * 0.8]) {
      const osc = s.osc(o.wave, f, start, stop, lp, d + rand(-1.5, 1.5));
      if (o.vibrato) {
        const vg = new GainNode(s.ctx, { gain: 0 });
        vg.gain.setValueAtTime(0, start);
        vg.gain.linearRampToValueAtTime(o.vibrato, start + Math.min(o.hold, 0.9));
        const lfo = new OscillatorNode(s.ctx, { frequency: rand(4.6, 5.4) });
        lfo.connect(vg);
        vg.connect(osc.detune);
        lfo.start(start);
        lfo.stop(stop);
      }
    }
  }
  return stop;
}

/** Brass stab: saws with a pitch scoop and a filter "blat". */
export function brassStab(s: Synth, start: number, notes: number[], hold: number, release: number, level: number, dest: AudioNode = s.out): void {
  const n = notes.length;
  const stop = start + hold + release * 7;
  for (let i = 0; i < n; i++) {
    const p = s.pan(n > 1 ? (i / (n - 1) - 0.5) * 0.7 : 0, dest);
    const env = s.gain(0, p);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(level, start + 0.014);
    env.gain.setTargetAtTime(level * 0.72, start + 0.014, 0.08);
    env.gain.setTargetAtTime(0, start + hold, release);
    const lp = s.filter('lowpass', 600, 1.1, env);
    lp.frequency.setValueAtTime(450, start);
    lp.frequency.linearRampToValueAtTime(s.safeHz(3600 * s.p), start + 0.03);
    lp.frequency.setTargetAtTime(s.safeHz(1700 * s.p), start + 0.03, 0.12);
    lp.frequency.setTargetAtTime(500, start + hold, release);
    const f = s.f(midiHz(notes[i]));
    for (const d of [-7, 6]) {
      const o = s.osc('sawtooth', f * 0.97, start, stop, lp, d);
      o.frequency.setValueAtTime(f * 0.97, start);
      o.frequency.exponentialRampToValueAtTime(f, start + 0.045);
    }
  }
}
