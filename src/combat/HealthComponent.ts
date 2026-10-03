/** Hit points with a delayed "damage trail" value for Soulslike health bars. */
export class HealthComponent {
  current: number;
  /** Lags behind `current` after damage (drawn as the yellow trail on bars). */
  trail: number;
  private trailDelay = 0;

  constructor(public max: number) {
    this.current = max;
    this.trail = max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  get fraction(): number {
    return this.current / this.max;
  }

  /** Applies damage and returns the amount actually removed. */
  damage(amount: number): number {
    if (this.current <= 0) return 0;
    const before = this.current;
    this.current = Math.max(0, this.current - amount);
    this.trailDelay = 0.7;
    return before - this.current;
  }

  heal(amount: number): void {
    if (this.current <= 0) return;
    this.current = Math.min(this.max, this.current + amount);
    if (this.trail < this.current) this.trail = this.current;
  }

  reset(): void {
    this.current = this.max;
    this.trail = this.max;
    this.trailDelay = 0;
  }

  update(dt: number): void {
    if (this.trail > this.current) {
      let drainTime = dt;
      if (this.trailDelay > 0) {
        this.trailDelay -= dt;
        drainTime = Math.max(0, -this.trailDelay);
      }
      if (drainTime > 0) this.trail = Math.max(this.current, this.trail - this.max * 0.6 * drainTime);
    } else {
      this.trail = this.current;
    }
  }
}
