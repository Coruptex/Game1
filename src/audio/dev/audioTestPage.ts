/**
 * Dev-only audio test page (audio-test.html). Not imported by the game.
 *
 * - Manual: buttons for every sound, "Play all", positional demo, ambience faders/presets, volumes.
 * - Automated: window.__audioTest exposes offline analysis used by scripts/audio-check.mjs
 *   (every SoundId rendered through an OfflineAudioContext, ambience layers, master chain stress
 *   test and an AudioManager API smoke test).
 */
import { SOUND_IDS, type SoundId } from '../SoundIds';
import { SOUND_INFO, playSynth } from '../SoundLibrary';
import { AMBIENCE_LAYERS, AMBIENCE_PRESETS, Ambience, type AmbienceLayer, type AmbienceMix, type AmbiencePreset } from '../Ambience';
import { AudioManager, type ListenerState } from '../AudioManager';
import { MixGraph } from '../MixGraph';

// =============================================================================================
// Analysis
// =============================================================================================

export interface BufferStats {
  /** Max |sample| over all channels. */
  peak: number;
  /** RMS over the active region (first..last sample above -40 dB re peak). */
  rms: number;
  /** Audible duration from the scheduled start: last sample above -40 dB re peak (s). */
  duration: number;
  /** Last sample above -60 dB re peak (s from start). */
  tail: number;
  /** Seconds rendered. */
  rendered: number;
  nan: boolean;
  /** Spectral centroid of the active region (Hz). */
  centroid: number;
  /** Time from start until the 10 ms envelope first reaches 90 % of its maximum (s). */
  attack: number;
  /** Mean of the signal (DC offset). */
  dc: number;
  /** 10 ms RMS envelope in dBFS from the start to the tail. */
  env: number[];
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

function spectralCentroid(mono: Float32Array, sr: number, from: number, to: number): number {
  const N = 2048;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const power = new Float64Array(N / 2);
  let frames = 0;
  for (let start = from; start + N <= to || (frames === 0 && start < to); start += N) {
    for (let i = 0; i < N; i++) {
      const v = start + i < mono.length && start + i < to ? mono[start + i] : 0;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      re[i] = v * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
    if (frames > 400) break;
  }
  let num = 0;
  let den = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    num += f * power[k];
    den += power[k];
  }
  return den > 0 ? num / den : 0;
}

export function analyzeBuffer(buffer: AudioBuffer, startTime: number, fromTime = startTime, toTime = buffer.duration): BufferStats {
  const sr = buffer.sampleRate;
  const chans: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const len = buffer.length;
  const i0 = Math.max(0, Math.floor(fromTime * sr));
  const i1 = Math.min(len, Math.floor(toTime * sr));
  let peak = 0;
  let nan = false;
  let sum = 0;
  for (const d of chans) {
    for (let i = i0; i < i1; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) {
        nan = true;
        continue;
      }
      sum += v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
  }
  const dc = sum / Math.max(1, (i1 - i0) * chans.length);
  const thr40 = Math.max(peak * 0.01, 1e-6);
  const thr60 = Math.max(peak * 0.001, 1e-7);
  let first = -1;
  let last40 = -1;
  let last60 = -1;
  for (let i = i0; i < i1; i++) {
    let a = 0;
    for (const d of chans) a = Math.max(a, Math.abs(d[i]));
    if (a > thr40) {
      if (first < 0) first = i;
      last40 = i;
    }
    if (a > thr60) last60 = i;
  }
  let rms = 0;
  if (first >= 0) {
    let s2 = 0;
    for (const d of chans) for (let i = first; i <= last40; i++) s2 += d[i] * d[i];
    rms = Math.sqrt(s2 / ((last40 - first + 1) * chans.length));
  }
  const mono = new Float32Array(len);
  for (const d of chans) for (let i = 0; i < len; i++) mono[i] += d[i] / chans.length;
  const centroid = first >= 0 ? spectralCentroid(mono, sr, first, last40 + 1) : 0;

  const frame = Math.floor(sr * 0.01);
  const env: number[] = [];
  const startIdx = Math.floor(startTime * sr);
  const endIdx = Math.min(len, Math.max(last60, startIdx) + frame * 5);
  let envMax = 0;
  for (let f = startIdx; f < endIdx; f += frame) {
    let s2 = 0;
    let n = 0;
    for (const d of chans) {
      for (let i = f; i < Math.min(f + frame, len); i++) {
        s2 += d[i] * d[i];
        n++;
      }
    }
    const r = Math.sqrt(s2 / Math.max(1, n));
    envMax = Math.max(envMax, r);
    env.push(r);
  }
  let attack = 0;
  for (let k = 0; k < env.length; k++) {
    if (env[k] >= envMax * 0.9) {
      attack = k * 0.01;
      break;
    }
  }
  return {
    peak,
    rms,
    duration: last40 >= 0 ? (last40 - startIdx) / sr : 0,
    tail: last60 >= 0 ? (last60 - startIdx) / sr : 0,
    rendered: buffer.duration,
    nan,
    centroid,
    attack,
    dc,
    env: env.map((r) => (r > 0 ? Math.max(-90, 20 * Math.log10(r)) : -90)),
  };
}

const LEAD = 0.01;

export interface SoundReport extends BufferStats {
  id: SoundId;
  pitch: number;
  maxDuration: number;
}

/** Renders one sound offline through playSynth and analyses it. */
export async function renderSound(id: SoundId, pitch = 1, sampleRate = 48000, volume = 1): Promise<{ buffer: AudioBuffer; report: SoundReport }> {
  const maxDuration = SOUND_INFO[id].maxDuration / pitch;
  const seconds = LEAD + maxDuration + 0.6;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  playSynth(ctx, ctx.destination, id, { pitch, when: LEAD, volume });
  const buffer = await ctx.startRendering();
  return { buffer, report: { id, pitch, maxDuration, ...analyzeBuffer(buffer, LEAD) } };
}

export async function analyzeSounds(opts: { ids?: SoundId[]; pitches?: number[]; repeats?: number; sampleRate?: number } = {}): Promise<SoundReport[]> {
  const ids = opts.ids ?? [...SOUND_IDS];
  const pitches = opts.pitches ?? [1];
  const repeats = opts.repeats ?? 1;
  const out: SoundReport[] = [];
  for (const id of ids) {
    for (const p of pitches) {
      for (let r = 0; r < repeats; r++) {
        const { report } = await renderSound(id, p, opts.sampleRate ?? 48000);
        out.push(report);
      }
    }
  }
  return out;
}

export interface AmbienceReport {
  name: string;
  mix: Partial<AmbienceMix>;
  seconds: number;
  /** RMS over [2 s, end] (after the fade-in). */
  rms: number;
  peak: number;
  nan: boolean;
  centroid: number;
  /** RMS per 1 s window (shows swells / events). */
  windows: number[];
}

/** Renders the ambience offline with the given mix (layers fade in over ~1.5 s). */
export async function renderAmbience(name: string, mix: Partial<AmbienceMix>, seconds = 10, sampleRate = 48000, withReverb = false): Promise<AmbienceReport> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const graph = withReverb ? new MixGraph(ctx, ctx.destination) : null;
  const amb = graph ? new Ambience(ctx, graph.ambience, graph.ambienceSend) : new Ambience(ctx, ctx.destination);
  amb.start();
  amb.setMix(mix);
  amb.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  const stats = analyzeBuffer(buffer, 0, Math.min(2, seconds / 2), seconds);
  const windows: number[] = [];
  const sr = buffer.sampleRate;
  for (let w = 0; w < Math.floor(seconds); w++) {
    let s2 = 0;
    let n = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = w * sr; i < Math.min((w + 1) * sr, d.length); i++) {
        s2 += d[i] * d[i];
        n++;
      }
    }
    windows.push(Math.sqrt(s2 / Math.max(1, n)));
  }
  // Full-region RMS (not just above -40 dB) is the meaningful number for a continuous bed.
  let s2 = 0;
  let n = 0;
  const from = Math.floor(Math.min(2, seconds / 2) * sr);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = from; i < d.length; i++) {
      s2 += d[i] * d[i];
      n++;
    }
  }
  return { name, mix, seconds, rms: Math.sqrt(s2 / Math.max(1, n)), peak: stats.peak, nan: stats.nan, centroid: stats.centroid, windows };
}

export async function analyzeAmbience(seconds = 10): Promise<AmbienceReport[]> {
  const out: AmbienceReport[] = [];
  for (const layer of AMBIENCE_LAYERS) {
    const mix: Partial<AmbienceMix> = { ocean: 0, wind: 0, jungle: 0, birds: 0, harbor: 0 };
    mix[layer] = 1;
    out.push(await renderAmbience(layer, mix, seconds));
  }
  for (const preset of ['harbor', 'beach', 'jungle', 'ruins'] as AmbiencePreset[]) {
    out.push(await renderAmbience(`preset:${preset}`, AMBIENCE_PRESETS[preset], seconds));
  }
  out.push(await renderAmbience('all layers @1', { ocean: 1, wind: 1, jungle: 1, birds: 1, harbor: 1 }, seconds));
  return out;
}

export interface ChainReport {
  id: SoundId;
  /** Peak / RMS of the synth alone. */
  dryPeak: number;
  dryRms: number;
  /** Peak / RMS after the full master chain (compressor, limiter, reverb send), in steady state. */
  chainPeak: number;
  chainRms: number;
  /** RMS of the reverb return alone (dry path muted). */
  wetRms: number;
}

const CHAIN_START = 1.0;

async function renderThroughChain(id: SoundId, mode: 'dry' | 'chain' | 'wet', start: number, sampleRate: number): Promise<BufferStats> {
  const info = SOUND_INFO[id];
  const seconds = start + info.maxDuration + 2.4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  if (mode === 'dry') {
    playSynth(ctx, ctx.destination, id, { when: start });
  } else {
    const graph = new MixGraph(ctx, ctx.destination);
    const voice = new GainNode(ctx);
    if (mode === 'chain') voice.connect(graph.sfx);
    if (info.reverb > 0) {
      const send = new GainNode(ctx, { gain: info.reverb });
      voice.connect(send);
      send.connect(graph.sfxSend);
    }
    playSynth(ctx, voice, id, { when: start });
  }
  return analyzeBuffer(await ctx.startRendering(), start);
}

/** Renders every sound through the full MixGraph (as the AudioManager would, non-positional). */
export async function analyzeChain(sampleRate = 48000): Promise<ChainReport[]> {
  const out: ChainReport[] = [];
  for (const id of SOUND_IDS) {
    const dry = await renderThroughChain(id, 'dry', CHAIN_START, sampleRate);
    const chain = await renderThroughChain(id, 'chain', CHAIN_START, sampleRate);
    const wet = SOUND_INFO[id].reverb > 0 ? await renderThroughChain(id, 'wet', CHAIN_START, sampleRate) : null;
    out.push({ id, dryPeak: dry.peak, dryRms: dry.rms, chainPeak: chain.peak, chainRms: chain.rms, wetRms: wet?.rms ?? 0 });
  }
  return out;
}

/**
 * Start-up check: a sound played right when the context starts (t = 0.01 s) must not be swallowed
 * by the compressors' initial state. Returns peak at start-up vs. steady state (averaged).
 */
export async function startupTest(id: SoundId = 'uiConfirm', runs = 4): Promise<{ id: SoundId; startupPeak: number; steadyPeak: number }> {
  let a = 0;
  let b = 0;
  for (let i = 0; i < runs; i++) {
    a += (await renderThroughChain(id, 'chain', 0.01, 48000)).peak;
    b += (await renderThroughChain(id, 'chain', CHAIN_START, 48000)).peak;
  }
  return { id, startupPeak: a / runs, steadyPeak: b / runs };
}

/** Worst case: every layer at full + a pile of loud one-shots at once through the master chain. */
export async function stressTest(seconds = 6, sampleRate = 48000): Promise<{ peak: number; rms: number; nan: boolean }> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const graph = new MixGraph(ctx, ctx.destination);
  const amb = new Ambience(ctx, graph.ambience, graph.ambienceSend);
  amb.start();
  amb.setMix({ ocean: 1, wind: 1, jungle: 1, birds: 1, harbor: 1 });
  amb.scheduleUntil(seconds);
  const loud: SoundId[] = ['swordHitHeavy', 'swordClash', 'swordHitFlesh', 'playerDeath', 'enemyDeath', 'youDied', 'victory', 'splash', 'doorSealed', 'shrineIgnite', 'regionDiscovered', 'bodyFall'];
  for (let k = 0; k < 3; k++) {
    for (const id of loud) {
      const send = new GainNode(ctx, { gain: SOUND_INFO[id].reverb });
      send.connect(graph.sfxSend);
      const v = new GainNode(ctx);
      v.connect(graph.sfx);
      v.connect(send);
      playSynth(ctx, v, id, { when: 2 + k * 0.01 });
    }
  }
  const buffer = await ctx.startRendering();
  const s = analyzeBuffer(buffer, 0);
  return { peak: s.peak, rms: s.rms, nan: s.nan };
}

/** Encodes mono float samples as a 16-bit PCM WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Exercises the AudioManager public API. Call after a user gesture (or with autoplay allowed).
 * Returns a list of check results; never leaves the manager muted.
 */
export async function managerSmokeTest(): Promise<Array<{ check: string; ok: boolean; detail?: string }>> {
  const results: Array<{ check: string; ok: boolean; detail?: string }> = [];
  const check = (name: string, fn: () => boolean | string): void => {
    try {
      const r = fn();
      results.push({ check: name, ok: r === true, detail: typeof r === 'string' ? r : undefined });
    } catch (err) {
      results.push({ check: name, ok: false, detail: `threw: ${String(err)}` });
    }
  };
  const listener: ListenerState = { x: 0, y: 0, z: 0, yaw: 0 };
  const am = new AudioManager();
  const prevMuted = am.muted;

  check('no-op before unlock', () => {
    am.play('swordSwing');
    am.play('footstepSand', { position: { x: 3, y: 0, z: 2 } });
    am.setVolume('sfx', 0.9);
    am.setVolume('master', 1);
    am.setAmbience({ ocean: 0.5 });
    am.update(0.016, listener);
    am.stopAll();
    return !am.unlocked && am.context === null;
  });

  // Sample registration before unlock (decoded with an OfflineAudioContext).
  const sr = 48000;
  const tone = new Float32Array(sr * 0.2);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.3 * Math.sin((2 * Math.PI * 660 * i) / sr) * (1 - i / tone.length);
  const url = URL.createObjectURL(encodeWav(tone, sr));
  await am.registerSample('uiConfirm', url);
  check('registerSample before unlock', () => am.hasSample('uiConfirm'));
  await am.registerSample('uiBack', 'does-not-exist.wav');
  check('registerSample bad url keeps synth (no throw)', () => !am.hasSample('uiBack'));

  await am.unlock();
  await am.unlock(); // idempotent
  check('unlock() → context running', () => (am.unlocked && am.context?.state === 'running') || `state=${am.context?.state}`);

  check('setMuted persists', () => {
    am.setMuted(true);
    const a = localStorage.getItem('ember.muted') === '1';
    am.muted = false;
    const b = localStorage.getItem('ember.muted') === '0';
    return (a && b && !am.muted) || `stored=${localStorage.getItem('ember.muted')}`;
  });

  check('play every id (positional) without throwing', () => {
    for (const id of SOUND_IDS) am.play(id, { position: { x: Math.random() * 20 - 10, y: 0, z: Math.random() * 20 - 10 } });
    return true;
  });
  check(`global voice limit (<= 24)`, () => am.activeVoices <= 24 || `active=${am.activeVoices}`);

  await sleep(80);
  am.stopAll(0.01);
  await sleep(120);
  am.update(0.016, listener);

  check('footstep group limited to 4', () => {
    const ids: SoundId[] = ['footstepSand', 'footstepWood', 'footstepStone', 'footstepGrass', 'footstepWater'];
    for (let i = 0; i < 10; i++) am.play(ids[i % ids.length]);
    return am.activeVoices <= 4 || `active=${am.activeVoices}`;
  });

  check('far sound is skipped (> 45 m)', () => {
    am.stopAll(0.01);
    const before = am.activeVoices;
    am.play('swordClash', { position: { x: 100, y: 0, z: 0 } });
    return am.activeVoices === before || `active=${am.activeVoices}`;
  });

  check('sample override plays', () => {
    am.play('uiConfirm');
    return true;
  });

  check('ambience + volumes + update', () => {
    am.setAmbience(AMBIENCE_PRESETS.jungle);
    am.setVolume('ambience', 0.7);
    for (let i = 0; i < 30; i++) am.update(0.016, { x: i * 0.1, y: 0, z: 0, yaw: i * 0.05 });
    return true;
  });

  check('bad input does not throw', () => {
    am.play('nope' as SoundId);
    am.play('coins', { position: { x: NaN, y: 0, z: 0 }, volume: -1, pitch: Infinity });
    am.setVolume('master', NaN);
    am.update(NaN, { x: NaN, y: 0, z: 0, yaw: 0 });
    return true;
  });

  await sleep(300);
  am.setMuted(prevMuted);
  am.dispose();
  URL.revokeObjectURL(url);

  // Web Audio unavailable: every call must be a silent no-op.
  const w = window as unknown as Record<string, unknown>;
  const saved = { AudioContext: w.AudioContext, webkitAudioContext: w.webkitAudioContext };
  try {
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    const none = new AudioManager();
    await none.unlock();
    check('no Web Audio → silent no-op', () => {
      none.play('swordClash', { position: { x: 1, y: 0, z: 1 } });
      none.setAmbience({ ocean: 1 });
      none.setVolume('master', 0.5);
      none.setMuted(none.muted);
      none.update(0.016, listener);
      none.stopAll();
      return !none.unlocked && none.context === null;
    });
  } finally {
    w.AudioContext = saved.AudioContext;
    w.webkitAudioContext = saved.webkitAudioContext;
  }
  return results;
}

/**
 * Draws a log-frequency spectrogram (50 Hz – 20 kHz, 60 dB range) with the waveform envelope on top.
 * Returns a PNG data URL (used by humans on the page and by dev scripts to eyeball timbres).
 */
export function drawSpectrogram(buffer: AudioBuffer, title: string, width = 900, height = 300, from = 0, to = buffer.duration): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) return '';
  const sr = buffer.sampleRate;
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels;
  }
  const N = 2048;
  const i0 = Math.floor(from * sr);
  const i1 = Math.min(mono.length, Math.floor(to * sr));
  const cols = width;
  const hop = Math.max(1, Math.floor((i1 - i0) / cols));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const img = g.createImageData(width, height);
  const fMin = 50;
  const fMax = Math.min(20000, sr / 2);
  for (let x = 0; x < cols; x++) {
    const start = i0 + x * hop - N / 2;
    for (let i = 0; i < N; i++) {
      const k = start + i;
      const v = k >= 0 && k < mono.length ? mono[k] : 0;
      re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
      im[i] = 0;
    }
    fft(re, im);
    for (let y = 0; y < height; y++) {
      const f = fMin * Math.pow(fMax / fMin, 1 - y / (height - 1));
      const bin = Math.min(N / 2 - 1, Math.round((f * N) / sr));
      const mag = Math.hypot(re[bin], im[bin]) / (N / 4);
      const db = mag > 0 ? 20 * Math.log10(mag) : -120;
      const v = Math.max(0, Math.min(1, (db + 72) / 60));
      const o = (y * width + x) * 4;
      img.data[o] = Math.round(255 * Math.min(1, v * 1.6));
      img.data[o + 1] = Math.round(255 * Math.max(0, v * 1.4 - 0.4));
      img.data[o + 2] = Math.round(255 * Math.max(0, 0.35 - v) + 255 * Math.max(0, v - 0.85) * 4);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Waveform envelope (peak per column) in the top band.
  g.strokeStyle = 'rgba(120,220,255,0.9)';
  g.beginPath();
  for (let x = 0; x < cols; x++) {
    let p = 0;
    for (let i = i0 + x * hop; i < Math.min(i1, i0 + (x + 1) * hop); i++) p = Math.max(p, Math.abs(mono[i]));
    const y = 40 - p * 38;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#fff';
  g.font = '12px monospace';
  g.fillText(`${title}  (${(to - from).toFixed(2)} s, 50 Hz–${Math.round(fMax / 1000)} kHz log)`, 6, height - 6);
  for (const f of [100, 1000, 10000]) {
    const y = (1 - Math.log(f / fMin) / Math.log(fMax / fMin)) * (height - 1);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(0, y, 8, 1);
    g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, 10, y + 4);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Spectrogram of one sound (rendered offline) or of the ambience:
 * `amb:<layer>` solo layer, `amb:all` every layer at 1, `preset:<name>` an AMBIENCE_PRESETS mix.
 */
export async function spectrogram(target: string, seconds = 0, pitch = 1): Promise<string> {
  if (target.startsWith('amb:') || target.startsWith('preset:')) {
    const what = target.slice(target.indexOf(':') + 1);
    const sec = seconds || 12;
    const ctx = new OfflineAudioContext(2, Math.ceil(sec * 48000), 48000);
    const amb = new Ambience(ctx, ctx.destination);
    amb.start();
    const mix: AmbienceMix = { ocean: 0, wind: 0, jungle: 0, birds: 0, harbor: 0 };
    if (target.startsWith('preset:')) Object.assign(mix, AMBIENCE_PRESETS[what as AmbiencePreset]);
    else if (what === 'all') for (const l of AMBIENCE_LAYERS) mix[l] = 1;
    else mix[what as AmbienceLayer] = 1;
    amb.setMix(mix);
    amb.scheduleUntil(sec);
    const buffer = await ctx.startRendering();
    return drawSpectrogram(buffer, target, 1200, 360, 1.5, sec);
  }
  const id = target as SoundId;
  const { buffer, report } = await renderSound(id, pitch);
  const end = Math.min(buffer.duration, LEAD + (seconds || Math.max(0.15, report.tail + 0.05)));
  return drawSpectrogram(buffer, `${id} peak ${report.peak.toFixed(2)} rms ${report.rms.toFixed(3)}`, 900, 300, 0, end);
}

declare global {
  interface Window {
    __audioTest?: {
      ready: boolean;
      soundIds: readonly SoundId[];
      analyzeSounds: typeof analyzeSounds;
      analyzeAmbience: typeof analyzeAmbience;
      renderAmbience: typeof renderAmbience;
      analyzeChain: typeof analyzeChain;
      startupTest: typeof startupTest;
      stressTest: typeof stressTest;
      managerSmokeTest: typeof managerSmokeTest;
      spectrogram: typeof spectrogram;
      /** The page's own AudioManager (used by the manual UI). */
      manager: AudioManager;
    };
  }
}

// =============================================================================================
// Manual UI
// =============================================================================================

const audio = new AudioManager();

window.__audioTest = {
  ready: true,
  manager: audio,
  soundIds: SOUND_IDS,
  analyzeSounds,
  analyzeAmbience,
  renderAmbience,
  analyzeChain,
  startupTest,
  stressTest,
  managerSmokeTest,
  spectrogram,
};

const listener: ListenerState = { x: 0, y: 0, z: 0, yaw: 0 };
let last = performance.now();
const tick = (now: number): void => {
  audio.update((now - last) / 1000, listener);
  last = now;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { textContent: label, className: cls });
  b.addEventListener('click', () => {
    void audio.unlock();
    onClick();
  });
  return b;
}

function slider(label: string, value: number, onInput: (v: number) => void): HTMLLabelElement {
  const input = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(value) });
  const out = el('span', { className: 'val', textContent: value.toFixed(2) });
  input.addEventListener('input', () => {
    out.textContent = Number(input.value).toFixed(2);
    onInput(Number(input.value));
  });
  return el('label', { className: 'slider' }, el('span', { className: 'lbl', textContent: label }), input, out);
}

function drawEnvelope(canvas: HTMLCanvasElement, env: number[]): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffb35c';
  const n = env.length;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, (env[i] + 60) / 60);
    const x0 = (i / n) * w;
    g.fillRect(x0, h - v * h, Math.max(1, w / n), v * h);
  }
}

function buildUi(): void {
  const app = document.getElementById('app');
  if (!app) return;
  const status = el('div', { className: 'status', textContent: 'Audio locked — click any button (user gesture) to unlock.' });
  setInterval(() => {
    status.textContent = audio.unlocked
      ? `AudioContext ${audio.context?.state} · ${audio.context?.sampleRate} Hz · voices ${audio.activeVoices} · muted ${audio.muted}`
      : 'Audio locked — click any button (user gesture) to unlock.';
  }, 250);

  // Sounds
  const grid = el('div', { className: 'grid' });
  for (const id of SOUND_IDS) grid.append(button(id, () => audio.play(id)));

  let playingAll = false;
  const playAll = button('▶ Play all', () => {
    if (playingAll) return;
    playingAll = true;
    void (async () => {
      for (const id of SOUND_IDS) {
        status.textContent = `Playing ${id}`;
        audio.play(id);
        await sleep(Math.min(3200, SOUND_INFO[id].maxDuration * 1000 * 0.75 + 450));
      }
      playingAll = false;
    })();
  }, 'primary');

  // Positional demo: a sound circling the listener.
  const posSel = el('select');
  for (const id of SOUND_IDS) posSel.append(el('option', { value: id, textContent: id, selected: id === 'swordClash' }));
  let orbit = 0;
  const posDemo = button('◎ Orbit (12 m)', () => {
    const steps = 12;
    let k = 0;
    const timer = setInterval(() => {
      const a = (k / steps) * Math.PI * 2;
      orbit = a;
      audio.play(posSel.value as SoundId, { position: { x: Math.cos(a) * 12, y: 0, z: Math.sin(a) * 12 } });
      if (++k >= steps) clearInterval(timer);
    }, 450);
  });
  const distDemo = button('↔ Distance sweep (2→44 m, right)', () => {
    const steps = 8;
    let k = 0;
    const timer = setInterval(() => {
      const d = 2 + (42 * k) / (steps - 1);
      audio.play(posSel.value as SoundId, { position: { x: d, y: 0, z: 0 } });
      if (++k >= steps) clearInterval(timer);
    }, 600);
  });
  void orbit;

  // Ambience
  const amb = el('div', { className: 'panel' }, el('h3', { textContent: 'Ambience' }));
  const faders: Record<AmbienceLayer, HTMLInputElement> = {} as Record<AmbienceLayer, HTMLInputElement>;
  const mix: AmbienceMix = { ...AMBIENCE_PRESETS.harbor };
  for (const layer of AMBIENCE_LAYERS) {
    const s = slider(layer, mix[layer], (v) => {
      mix[layer] = v;
      void audio.unlock();
      audio.setAmbience({ [layer]: v });
    });
    faders[layer] = s.querySelector('input') as HTMLInputElement;
    amb.append(s);
  }
  const presets = el('div', { className: 'row' });
  for (const p of Object.keys(AMBIENCE_PRESETS) as AmbiencePreset[]) {
    presets.append(
      button(p, () => {
        Object.assign(mix, AMBIENCE_PRESETS[p]);
        for (const layer of AMBIENCE_LAYERS) {
          faders[layer].value = String(mix[layer]);
          faders[layer].dispatchEvent(new Event('input'));
        }
        audio.setAmbience(AMBIENCE_PRESETS[p]);
      }),
    );
  }
  amb.append(presets);

  // Volumes
  const vol = el('div', { className: 'panel' }, el('h3', { textContent: 'Mix' }));
  vol.append(slider('master', 1, (v) => audio.setVolume('master', v)));
  vol.append(slider('sfx', 1, (v) => audio.setVolume('sfx', v)));
  vol.append(slider('ambience', 1, (v) => audio.setVolume('ambience', v)));
  const mute = el('input', { type: 'checkbox', checked: audio.muted });
  mute.addEventListener('change', () => audio.setMuted(mute.checked));
  vol.append(el('label', { className: 'slider' }, mute, ' muted (persisted)'));
  const yaw = slider('camera yaw', 0, (v) => (listener.yaw = v * Math.PI * 2));
  vol.append(yaw);

  // Offline analysis table
  const table = el('table');
  const analyze = button('Analyze all (offline render)', () => {
    void (async () => {
      table.innerHTML = '<tr><th>id</th><th>peak</th><th>rms</th><th>dur (s)</th><th>tail (s)</th><th>centroid</th><th>envelope</th><th></th></tr>';
      for (const id of SOUND_IDS) {
        const { report } = await renderSound(id);
        const canvas = el('canvas', { width: 220, height: 28 });
        drawEnvelope(canvas, report.env);
        const ok = report.peak < 0.95 && report.rms > 0.003 && !report.nan;
        const tr = el(
          'tr',
          { className: ok ? '' : 'bad' },
          el('td', { textContent: id }),
          el('td', { textContent: report.peak.toFixed(3) }),
          el('td', { textContent: report.rms.toFixed(4) }),
          el('td', { textContent: report.duration.toFixed(3) }),
          el('td', { textContent: report.tail.toFixed(3) }),
          el('td', { textContent: `${Math.round(report.centroid)} Hz` }),
          el('td', {}, canvas),
          el('td', {}, button('▶', () => audio.play(id))),
        );
        table.append(tr);
      }
    })();
  });

  app.append(
    el('h1', { textContent: 'Ember of Retribution — synthesized audio test' }),
    status,
    el('div', { className: 'row' }, playAll, button('■ Stop all', () => audio.stopAll()), analyze),
    el('div', { className: 'panel' }, el('h3', { textContent: 'One-shots' }), grid),
    el('div', { className: 'panel' }, el('h3', { textContent: 'Positional' }), el('div', { className: 'row' }, posSel, posDemo, distDemo)),
    el('div', { className: 'cols' }, amb, vol),
    el('div', { className: 'panel' }, el('h3', { textContent: 'Offline analysis' }), table),
  );
}

buildUi();
