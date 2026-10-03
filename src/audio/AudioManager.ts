import type { SoundId } from './SoundIds';
import { SOUND_INFO, playSynth, type SoundInfo } from './SoundLibrary';
import { AMBIENCE_PRESETS, Ambience, type AmbienceMix } from './Ambience';
import { MixGraph, type VolumeChannel } from './MixGraph';
import { SAMPLE_MANIFEST } from './SampleManifest';
import { clamp, createPanner, preloadNoiseBuffers, type Panner } from './SynthKit';

export interface ListenerState {
  x: number;
  y: number;
  z: number;
  /** camera yaw (rad): camera looks along (-sin yaw, -cos yaw) on XZ, right vector is (cos yaw, -sin yaw) */
  yaw: number;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface PlayOptions {
  /** World position: enables distance attenuation and stereo panning relative to the listener. */
  position?: Vec3Like;
  /** Linear volume multiplier (default 1). */
  volume?: number;
  /** Playback-rate multiplier (default 1); a small random variation is added per sound. */
  pitch?: number;
}

export type { VolumeChannel };

const MUTE_KEY = 'ember.muted';
const MAX_VOICES = 24;
const FULL_VOLUME_DISTANCE = 4;
const SILENT_DISTANCE = 45;
/** Seconds between "now" and the scheduled start of a one-shot (keeps attacks intact). */
const START_OFFSET = 0.005;

/** Distance attenuation: full volume within 4 m, smooth roll-off, silent beyond 45 m. */
export function distanceGain(d: number): number {
  if (!(d > FULL_VOLUME_DISTANCE)) return 1;
  if (d >= SILENT_DISTANCE) return 0;
  const x = 1 - (d - FULL_VOLUME_DISTANCE) / (SILENT_DISTANCE - FULL_VOLUME_DISTANCE);
  return Math.pow(x, 1.6);
}

/**
 * Stereo pan (-1 … 1) of world point (x, z) relative to the listener, using the camera's right
 * vector (cos yaw, -sin yaw). Sounds right at the listener stay centred; panning is capped at ±0.85.
 */
export function panFor(listener: ListenerState, x: number, z: number): number {
  const dx = x - listener.x;
  const dz = z - listener.z;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 1e-3) return 0;
  const right = dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw);
  const u = clamp((horiz - 0.5) / 2.5, 0, 1);
  const width = u * u * (3 - 2 * u);
  return clamp((right / horiz) * 0.85 * width, -0.85, 0.85);
}

/** Air absorption: distant sounds lose their highs. */
function airCutoff(d: number): number {
  const u = clamp((d - 8) / 37, 0, 1);
  return 18000 * Math.pow(3200 / 18000, u);
}

function distanceTo(p: Vec3Like, l: ListenerState): number {
  return Math.hypot(p.x - l.x, (p.y - l.y) * 0.7, p.z - l.z);
}

function isFiniteVec(p: Vec3Like): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(m: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* storage unavailable (private mode) */
  }
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;
type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function offlineContextCtor(): OfflineCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  return w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null;
}

function decodeAudio(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    // Supports both the promise and the legacy callback form (old Safari).
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface Voice {
  id: SoundId;
  group: string;
  priority: number;
  start: number;
  end: number;
  stopping: boolean;
  /** Synth / sample output connects here; used for stealing fades. */
  input: GainNode;
  /** Distance attenuation. */
  dist: GainNode;
  air: BiquadFilterNode | null;
  panner: Panner | null;
  send: GainNode | null;
  position: Vec3Like | null;
  reverb: number;
  lastGain: number;
  lastPan: number;
  lastAir: number;
}

/**
 * Public audio API used by the game.
 *
 * - Everything is a silent no-op before unlock() and when Web Audio is unavailable; no method throws.
 * - One-shots are synthesized at runtime (SoundLibrary) unless a sample was registered for the id.
 * - Positional sounds get distance attenuation, air absorption and stereo panning relative to the
 *   listener's camera yaw, plus a distance-dependent send into a shared procedural reverb.
 * - Voices are limited per sound group (SOUND_INFO.maxVoices) and globally (24) with
 *   priority-based stealing.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private graph: MixGraph | null = null;
  private ambience: Ambience | null = null;
  private readonly voices: Voice[] = [];
  private readonly lastPlayed = new Map<SoundId, number>();
  private readonly samples = new Map<SoundId, AudioBuffer[]>();
  private readonly listener: ListenerState = { x: 0, y: 0, z: 0, yaw: 0 };
  private readonly volumes: Record<VolumeChannel, number> = { master: 1, sfx: 1, ambience: 1 };
  private readonly pendingMix: AmbienceMix = { ...AMBIENCE_PRESETS.harbor };
  private readonly warned = new Set<string>();
  private _muted: boolean;
  private everRan = false;
  private unavailable = false;
  private unlocking: Promise<void> | null = null;
  private hiddenSuspended = false;
  private listenersInstalled = false;
  private decodeCtx: BaseAudioContext | null = null;
  private static readonly GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

  constructor() {
    this._muted = readMuted();
    for (const [id, urls] of Object.entries(SAMPLE_MANIFEST) as Array<[SoundId, readonly string[] | undefined]>) {
      for (const url of urls ?? []) void this.registerSample(id, url);
    }
  }

  // ------------------------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------------------------

  /** True once the AudioContext has been created and has run (i.e. a user gesture unlocked it). */
  get unlocked(): boolean {
    return this.everRan;
  }

  /** Persisted to localStorage 'ember.muted'. Assigning is equivalent to setMuted(). */
  get muted(): boolean {
    return this._muted;
  }

  set muted(m: boolean) {
    this.setMuted(m);
  }

  /** The underlying AudioContext (null before unlock or when Web Audio is unavailable). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Number of currently sounding one-shot voices. */
  get activeVoices(): number {
    let n = 0;
    for (const v of this.voices) if (!v.stopping) n++;
    return n;
  }

  // ------------------------------------------------------------------------------------------
  // Unlock / lifecycle
  // ------------------------------------------------------------------------------------------

  /**
   * Must be called from a user gesture (e.g. the title screen "press any key"); creates/resumes the
   * AudioContext and starts the ambience. Safe to call multiple times; never rejects.
   */
  unlock(): Promise<void> {
    try {
      if (this.unavailable) return Promise.resolve();
      if (!this.ctx && !this.createContext()) return Promise.resolve();
      const ctx = this.ctx;
      if (!ctx) return Promise.resolve();
      if (ctx.state === 'running') {
        this.onRunning();
        return Promise.resolve();
      }
      // Everything up to here runs synchronously inside the gesture handler (required by Safari).
      this.primeOutput(ctx);
      if (!this.unlocking) {
        this.unlocking = withTimeout(ctx.resume(), 1500)
          .catch((err: unknown) => this.warnOnce('resume', 'AudioContext.resume() failed', err))
          .then(() => {
            this.unlocking = null;
            if (this.ctx?.state === 'running') this.onRunning();
          });
      }
      return this.unlocking;
    } catch (err) {
      this.warnOnce('unlock', 'unlock() failed; audio disabled', err);
      return Promise.resolve();
    }
  }

  private createContext(): boolean {
    const Ctor = audioContextCtor();
    if (!Ctor) {
      this.unavailable = true;
      return false;
    }
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      preloadNoiseBuffers(ctx);
      const graph = new MixGraph(ctx, ctx.destination);
      for (const ch of ['master', 'sfx', 'ambience'] as const) graph.setVolume(ch, this.volumes[ch], 0);
      graph.setMuted(this._muted, 0);
      const ambience = new Ambience(ctx, graph.ambience, graph.ambienceSend);
      ambience.setMix(this.pendingMix);
      this.ctx = ctx;
      this.graph = graph;
      this.ambience = ambience;
      ctx.addEventListener('statechange', () => {
        if (this.ctx?.state === 'running') this.onRunning();
      });
      this.installLifecycleListeners();
      return true;
    } catch (err) {
      this.unavailable = true;
      this.ctx = null;
      this.graph = null;
      this.ambience = null;
      this.warnOnce('create', 'Web Audio unavailable; audio disabled', err);
      return false;
    }
  }

  /** Plays one silent sample inside the gesture: unlocks output on iOS Safari. */
  private primeOutput(ctx: AudioContext): void {
    try {
      const src = new AudioBufferSourceNode(ctx, { buffer: ctx.createBuffer(1, 1, ctx.sampleRate) });
      src.connect(ctx.destination);
      src.start();
      src.onended = () => src.disconnect();
    } catch {
      /* ignore */
    }
  }

  private onRunning(): void {
    this.everRan = true;
    if (this.ambience && !this.ambience.isStarted) this.ambience.start();
  }

  private installLifecycleListeners(): void {
    if (this.listenersInstalled || typeof window === 'undefined') return;
    this.listenersInstalled = true;
    for (const type of AudioManager.GESTURES) {
      window.addEventListener(type, this.onGesture, { capture: true, passive: true });
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  /**
   * Browsers may suspend/interrupt the context later (iOS phone calls, audio route changes...):
   * resume it on the next user gesture.
   */
  private readonly onGesture = (): void => {
    const ctx = this.ctx;
    if (!ctx || this.hiddenSuspended || ctx.state === 'running' || ctx.state === 'closed') return;
    ctx.resume().catch(() => undefined);
  };

  private readonly onVisibility = (): void => {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || typeof document === 'undefined') return;
    try {
      if (document.hidden) {
        if (ctx.state !== 'running') return;
        this.hiddenSuspended = true;
        graph.fadeMaster(0, 0.03);
        setTimeout(() => {
          if (this.hiddenSuspended && this.ctx?.state === 'running') this.ctx.suspend().catch(() => undefined);
        }, 150);
      } else if (this.hiddenSuspended) {
        this.hiddenSuspended = false;
        ctx
          .resume()
          .catch(() => undefined)
          .then(() => graph.setMuted(this._muted, 0.15));
      }
    } catch (err) {
      this.warnOnce('visibility', 'visibility handling failed', err);
    }
  };

  /** Stops everything and releases the AudioContext. The manager is unusable afterwards. */
  dispose(): void {
    try {
      this.stopAll(0.02);
      this.ambience?.stop();
      if (this.listenersInstalled && typeof window !== 'undefined') {
        for (const type of AudioManager.GESTURES) window.removeEventListener(type, this.onGesture, { capture: true });
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
        this.listenersInstalled = false;
      }
      void this.ctx?.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.graph = null;
    this.ambience = null;
    this.voices.length = 0;
    this.unavailable = true;
  }

  // ------------------------------------------------------------------------------------------
  // Volume / mute / ambience
  // ------------------------------------------------------------------------------------------

  setMuted(m: boolean): void {
    this._muted = !!m;
    writeMuted(this._muted);
    try {
      this.graph?.setMuted(this._muted);
    } catch (err) {
      this.warnOnce('mute', 'setMuted failed', err);
    }
  }

  /** Channel volume 0..1 (smoothed). Applies immediately, or at unlock when called earlier. */
  setVolume(channel: VolumeChannel, v: number): void {
    if (channel !== 'master' && channel !== 'sfx' && channel !== 'ambience') return;
    this.volumes[channel] = clamp(Number.isFinite(v) ? v : 1, 0, 1);
    try {
      this.graph?.setVolume(channel, this.volumes[channel]);
    } catch (err) {
      this.warnOnce('volume', 'setVolume failed', err);
    }
  }

  getVolume(channel: VolumeChannel): number {
    return this.volumes[channel] ?? 1;
  }

  /** Sets ambience layer targets (0..1); changes crossfade over ~1.5 s. Remembered before unlock. */
  setAmbience(mix: Partial<AmbienceMix>): void {
    try {
      for (const key of Object.keys(this.pendingMix) as Array<keyof AmbienceMix>) {
        const v = mix[key];
        if (v !== undefined && Number.isFinite(v)) this.pendingMix[key] = clamp(v, 0, 1);
      }
      this.ambience?.setMix(mix);
    } catch (err) {
      this.warnOnce('ambience', 'setAmbience failed', err);
    }
  }

  // ------------------------------------------------------------------------------------------
  // One-shots
  // ------------------------------------------------------------------------------------------

  /**
   * One-shot. With `position`, apply distance attenuation (full volume < 4 m, silent beyond ~45 m)
   * and stereo panning (StereoPannerNode) relative to the listener's camera yaw.
   */
  play(id: SoundId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || this._muted || !this.canSchedule(ctx)) return;
    try {
      const info: SoundInfo | undefined = SOUND_INFO[id];
      if (!info) {
        this.warnOnce(`unknown:${String(id)}`, `unknown sound id "${String(id)}" (ignored)`);
        return;
      }
      const now = ctx.currentTime;
      const last = this.lastPlayed.get(id);
      if (last !== undefined && now - last < info.cooldown) return;
      const volume = clamp(opts.volume ?? 1, 0, 4);
      if (!(volume > 0)) return;

      let pos: Vec3Like | null = null;
      let gain = 1;
      let pan = 0;
      let air = 20000;
      if (info.spatial && opts.position && isFiniteVec(opts.position)) {
        pos = { x: opts.position.x, y: opts.position.y, z: opts.position.z };
        const d = distanceTo(pos, this.listener);
        gain = distanceGain(d);
        if (gain * volume < 0.004) return; // inaudible: don't spend a voice on it
        pan = panFor(this.listener, pos.x, pos.z);
        air = airCutoff(d);
      }

      this.prune(now);
      if (!this.allocate(id, info, now)) return;

      const pitch = clamp((opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * info.pitchVariation), 0.25, 4);
      const voice = this.createVoice(ctx, graph, id, info, now, pos, gain, pan, air);
      const when = now + START_OFFSET;
      const sample = this.pickSample(id);
      let duration: number;
      if (sample) {
        duration = this.playSample(ctx, sample, voice.input, when, pitch, volume);
      } else {
        playSynth(ctx, voice.input, id, { volume, pitch, when });
        duration = info.maxDuration / pitch;
      }
      voice.end = when + duration + 0.1;
      this.voices.push(voice);
      this.lastPlayed.set(id, now);
    } catch (err) {
      this.warnOnce(`play:${id}`, `play("${id}") failed`, err);
    }
  }

  /**
   * Sounds are scheduled while the context runs, and also while an unlock() is in flight: a sound
   * requested right after unlock() (e.g. the title-screen confirm) then starts as soon as the
   * context does instead of being dropped. Nothing queues up while the tab is hidden.
   */
  private canSchedule(ctx: AudioContext): boolean {
    if (ctx.state === 'running') return true;
    return this.unlocking !== null && !this.hiddenSuspended && ctx.state === 'suspended';
  }

  /** Fades out every playing one-shot (ambience keeps running). */
  stopAll(fade = 0.08): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      for (const v of this.voices) this.stopVoice(v, now, fade);
    } catch (err) {
      this.warnOnce('stopAll', 'stopAll failed', err);
    }
  }

  /** Call every frame. */
  update(dt: number, listener: ListenerState): void {
    if (listener && Number.isFinite(listener.x) && Number.isFinite(listener.z)) {
      this.listener.x = listener.x;
      this.listener.y = Number.isFinite(listener.y) ? listener.y : 0;
      this.listener.z = listener.z;
      this.listener.yaw = Number.isFinite(listener.yaw) ? listener.yaw : 0;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      this.ambience?.update(Number.isFinite(dt) ? clamp(dt, 0, 1) : 0);
      const now = ctx.currentTime;
      this.prune(now);
      for (const v of this.voices) if (v.position && !v.stopping) this.spatialize(v, now);
    } catch (err) {
      this.warnOnce('update', 'update failed', err);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Samples
  // ------------------------------------------------------------------------------------------

  /**
   * Optional sample override: future sample files can replace synth recipes. Calling it several
   * times for one id adds variants (picked at random). Works before unlock (decodes offline).
   * Never rejects: on failure a warning is logged and the synth recipe stays in use.
   */
  async registerSample(id: SoundId, url: string): Promise<void> {
    try {
      if (typeof fetch !== 'function') return;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const decoder = this.ctx ?? this.getDecodeContext();
      if (!decoder) throw new Error('no audio context available for decoding');
      const buffer = await decodeAudio(decoder, data);
      const list = this.samples.get(id);
      if (list) list.push(buffer);
      else this.samples.set(id, [buffer]);
    } catch (err) {
      console.warn(`[audio] could not load sample for "${id}" from ${url}; keeping the synthesized sound.`, err);
    }
  }

  /** Removes registered samples for `id` (back to the synth recipe). */
  clearSample(id: SoundId): void {
    this.samples.delete(id);
  }

  hasSample(id: SoundId): boolean {
    return (this.samples.get(id)?.length ?? 0) > 0;
  }

  private getDecodeContext(): BaseAudioContext | null {
    if (this.decodeCtx) return this.decodeCtx;
    const Ctor = offlineContextCtor();
    if (!Ctor) return null;
    try {
      this.decodeCtx = new Ctor(1, 1, 48000);
    } catch {
      this.decodeCtx = null;
    }
    return this.decodeCtx;
  }

  private pickSample(id: SoundId): AudioBuffer | null {
    const list = this.samples.get(id);
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  private playSample(ctx: AudioContext, buffer: AudioBuffer, dest: AudioNode, when: number, pitch: number, volume: number): number {
    const src = new AudioBufferSourceNode(ctx, { buffer, playbackRate: pitch });
    const g = new GainNode(ctx, { gain: volume });
    src.connect(g);
    g.connect(dest);
    src.start(when);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    return buffer.duration / pitch;
  }

  // ------------------------------------------------------------------------------------------
  // Voices
  // ------------------------------------------------------------------------------------------

  private allocate(id: SoundId, info: SoundInfo, now: number): boolean {
    const group = info.group ?? id;
    // Per-group limit: steal the oldest voice of the same group.
    let inGroup = 0;
    let oldest: Voice | null = null;
    for (const v of this.voices) {
      if (v.stopping || v.group !== group) continue;
      inGroup++;
      if (!oldest || v.start < oldest.start) oldest = v;
    }
    if (inGroup >= info.maxVoices && oldest) this.stopVoice(oldest, now);

    // Global limit: steal the lowest-priority (then oldest) voice, unless it outranks this one.
    let active = 0;
    let victim: Voice | null = null;
    for (const v of this.voices) {
      if (v.stopping) continue;
      active++;
      if (!victim || v.priority < victim.priority || (v.priority === victim.priority && v.start < victim.start)) victim = v;
    }
    if (active >= MAX_VOICES) {
      if (!victim || victim.priority > info.priority) return false;
      this.stopVoice(victim, now);
    }
    return true;
  }

  private createVoice(
    ctx: AudioContext,
    graph: MixGraph,
    id: SoundId,
    info: SoundInfo,
    now: number,
    pos: Vec3Like | null,
    gain: number,
    pan: number,
    air: number,
  ): Voice {
    const input = new GainNode(ctx, { gain: 1 });
    const dist = new GainNode(ctx, { gain });
    input.connect(dist);
    let airFilter: BiquadFilterNode | null = null;
    let panner: Panner | null = null;
    if (pos) {
      airFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: air, Q: 0.5 });
      panner = createPanner(ctx, pan);
      dist.connect(airFilter);
      airFilter.connect(panner.node);
      panner.node.connect(graph.sfx);
    } else {
      dist.connect(graph.sfx);
    }
    let send: GainNode | null = null;
    const sendLevel = this.sendLevel(info.reverb, gain, !!pos);
    if (sendLevel > 0) {
      send = new GainNode(ctx, { gain: sendLevel });
      input.connect(send);
      send.connect(graph.sfxSend);
    }
    return {
      id,
      group: info.group ?? id,
      priority: info.priority,
      start: now,
      end: now + info.maxDuration + 0.2,
      stopping: false,
      input,
      dist,
      air: airFilter,
      panner,
      send,
      position: pos,
      reverb: info.reverb,
      lastGain: gain,
      lastPan: pan,
      lastAir: air,
    };
  }

  private sendLevel(reverb: number, distGain: number, positional: boolean): number {
    return positional ? reverb * (0.35 + 0.65 * distGain) : reverb;
  }

  private spatialize(v: Voice, now: number): void {
    const pos = v.position;
    if (!pos) return;
    const d = distanceTo(pos, this.listener);
    const g = distanceGain(d);
    if (Math.abs(g - v.lastGain) > 0.005) {
      v.dist.gain.setTargetAtTime(g, now, 0.04);
      v.send?.gain.setTargetAtTime(this.sendLevel(v.reverb, g, true), now, 0.04);
      v.lastGain = g;
    }
    const pan = panFor(this.listener, pos.x, pos.z);
    if (Math.abs(pan - v.lastPan) > 0.01) {
      v.panner?.set(pan, now, 0.04);
      v.lastPan = pan;
    }
    const air = airCutoff(d);
    if (v.air && Math.abs(air - v.lastAir) > 60) {
      v.air.frequency.setTargetAtTime(air, now, 0.05);
      v.lastAir = air;
    }
  }

  private stopVoice(v: Voice, now: number, fade = 0.04): void {
    if (v.stopping) return;
    v.stopping = true;
    const g = v.input.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    v.end = Math.min(v.end, now + fade + 0.03);
  }

  /** Releases voices whose sound has finished. */
  private prune(now: number): void {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i];
      if (now < v.end) continue;
      v.input.disconnect();
      v.dist.disconnect();
      v.air?.disconnect();
      v.panner?.node.disconnect();
      v.send?.disconnect();
      this.voices.splice(i, 1);
    }
  }

  private warnOnce(key: string, message: string, err?: unknown): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`[audio] ${message}`, err ?? '');
  }
}
