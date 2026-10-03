/**
 * Frame timing with gameplay time-scale and hit-stop support.
 *
 * - `realDelta` is the unscaled frame delta (UI, camera smoothing).
 * - `delta` is the gameplay delta (characters, AI, physics, particles) and is affected by
 *   pause, hit-stop and slow motion.
 */
export class GameTime {
  /** Upper bound for a frame step so a tab switch never teleports characters through walls. */
  static readonly MAX_DELTA = 1 / 20;

  realDelta = 0;
  delta = 0;
  elapsed = 0;
  realElapsed = 0;
  frame = 0;

  /** Persistent gameplay speed multiplier (e.g. slow motion on death). */
  timeScale = 1;
  paused = false;

  private hitStopRemaining = 0;
  private hitStopScale = 0.05;

  /** Briefly freezes gameplay (in real seconds) to sell the weight of a hit. */
  hitStop(duration: number, scale = 0.04): void {
    if (duration > this.hitStopRemaining) {
      this.hitStopRemaining = duration;
      this.hitStopScale = scale;
    }
  }

  get inHitStop(): boolean {
    return this.hitStopRemaining > 0;
  }

  tick(realDt: number): void {
    const dt = Math.min(Math.max(realDt, 0), GameTime.MAX_DELTA);
    this.realDelta = dt;
    this.realElapsed += dt;
    this.frame++;

    let scale = this.paused ? 0 : this.timeScale;
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= dt;
      scale *= this.hitStopScale;
    }
    this.delta = dt * scale;
    this.elapsed += this.delta;
  }
}
