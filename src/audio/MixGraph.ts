import { clamp, createImpulseResponse, softClipCurve } from './SynthKit';

export type VolumeChannel = 'master' | 'sfx' | 'ambience';

/** Mix-bus pre-gain compensating the compressors' automatic make-up gain (≈ unity for quiet sounds). */
const MIX_PREGAIN = 0.65;
/** Bypass level matching the compressed path's small-signal gain (1.217 × 1.251 measured). */
const BYPASS_GAIN = 1.52;

/**
 * Master signal chain shared by the AudioManager (and the offline test page):
 *
 *   sfx ──────────────┐
 *   ambience ─────────┼─► mix ─┬─► glue compressor ─► limiter ─► xfade ─┬─► master ─► safety clipper ─► out
 *   sfxSend ──┐       │        └──────────── start-up bypass ───────────┘
 *   ambSend ──┴► convolver reverb ─► return ┘
 *
 * The send buses carry the same channel volume as their dry buses so turning a channel down also
 * removes its reverb. DynamicsCompressorNode applies automatic make-up gain (measured: glue +1.7 dB,
 * limiter +1.95 dB), so the mix bus is pre-attenuated to keep quiet sounds at roughly unity gain.
 *
 * DynamicsCompressorNodes also start "fully clamped" and need ~0.3 s to release, which would
 * swallow the very first sound after the context starts (e.g. the UI confirm that unlocks audio).
 * A parallel bypass path therefore carries the signal for the first ~0.6 s of context time and
 * crossfades into the compressed path once the compressors have settled.
 */
export class MixGraph {
  readonly sfx: GainNode;
  readonly sfxSend: GainNode;
  readonly ambience: GainNode;
  readonly ambienceSend: GainNode;
  readonly mix: GainNode;
  readonly compressor: DynamicsCompressorNode;
  readonly limiter: DynamicsCompressorNode;
  readonly master: GainNode;
  readonly reverb: ConvolverNode;
  readonly reverbReturn: GainNode;
  private readonly compressed: GainNode;
  private readonly bypass: GainNode;
  private readonly safety: WaveShaperNode;
  private readonly volumes: Record<VolumeChannel, number> = { master: 1, sfx: 1, ambience: 1 };
  private muted = false;

  constructor(
    readonly ctx: BaseAudioContext,
    destination: AudioNode = ctx.destination,
    opts: { reverbReturn?: number } = {},
  ) {
    this.sfx = new GainNode(ctx, { gain: 1 });
    this.sfxSend = new GainNode(ctx, { gain: 1 });
    this.ambience = new GainNode(ctx, { gain: 1 });
    this.ambienceSend = new GainNode(ctx, { gain: 1 });
    this.mix = new GainNode(ctx, { gain: MIX_PREGAIN });

    this.compressor = new DynamicsCompressorNode(ctx, { threshold: -12, knee: 12, ratio: 2, attack: 0.006, release: 0.25 });
    this.limiter = new DynamicsCompressorNode(ctx, { threshold: -4, knee: 2, ratio: 20, attack: 0.001, release: 0.12 });
    this.master = new GainNode(ctx, { gain: 1 });
    this.safety = new WaveShaperNode(ctx, { curve: softClipCurve(0.85, 0.98) });
    this.compressed = new GainNode(ctx, { gain: 0 });
    this.bypass = new GainNode(ctx, { gain: BYPASS_GAIN });
    const t0 = ctx.currentTime;
    this.compressed.gain.setValueAtTime(0, t0 + 0.25);
    this.compressed.gain.linearRampToValueAtTime(1, t0 + 0.6);
    this.bypass.gain.setValueAtTime(BYPASS_GAIN, t0 + 0.25);
    this.bypass.gain.linearRampToValueAtTime(0, t0 + 0.6);

    this.reverb = new ConvolverNode(ctx, {
      buffer: createImpulseResponse(ctx, { seconds: 2.2, rt60: 1.6, preDelay: 0.014, damping: 0.65 }),
    });
    this.reverbReturn = new GainNode(ctx, { gain: opts.reverbReturn ?? 1.6 });

    this.sfx.connect(this.mix);
    this.ambience.connect(this.mix);
    this.sfxSend.connect(this.reverb);
    this.ambienceSend.connect(this.reverb);
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.mix);
    this.mix.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.compressed);
    this.compressed.connect(this.master);
    this.mix.connect(this.bypass);
    this.bypass.connect(this.master);
    this.master.connect(this.safety);
    this.safety.connect(destination);
  }

  setVolume(channel: VolumeChannel, v: number, smooth = 0.05): void {
    this.volumes[channel] = clamp(Number.isFinite(v) ? v : 1, 0, 1);
    this.apply(smooth);
  }

  getVolume(channel: VolumeChannel): number {
    return this.volumes[channel];
  }

  setMuted(m: boolean, smooth = 0.05): void {
    this.muted = m;
    this.apply(smooth);
  }

  /** Smoothly sets the master gain to 0 (or back) without touching the stored volumes. */
  fadeMaster(target: number, timeConstant = 0.05): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, timeConstant);
  }

  private apply(smooth: number): void {
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number): void => {
      p.cancelScheduledValues(now);
      if (smooth > 0) p.setTargetAtTime(v, now, smooth);
      else p.setValueAtTime(v, now);
    };
    set(this.master.gain, this.muted ? 0 : this.volumes.master);
    set(this.sfx.gain, this.volumes.sfx);
    set(this.sfxSend.gain, this.volumes.sfx);
    set(this.ambience.gain, this.volumes.ambience);
    set(this.ambienceSend.gain, this.volumes.ambience);
  }

  disconnect(): void {
    for (const n of [this.sfx, this.sfxSend, this.ambience, this.ambienceSend, this.mix, this.compressor, this.limiter, this.compressed, this.bypass, this.master, this.safety, this.reverb, this.reverbReturn]) {
      n.disconnect();
    }
  }
}
