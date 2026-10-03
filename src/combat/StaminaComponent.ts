/**
 * Soulslike stamina: actions need *some* stamina (not the full cost) and drain it, regeneration
 * pauses briefly after spending, and running dry triggers a longer exhaustion delay.
 */
export class StaminaComponent {
  current: number;
  regenRate: number;
  regenDelay: number;
  exhaustedDelay: number;
  private delay = 0;
  /** True while recovering from a full depletion (blocks sprinting). */
  exhausted = false;

  constructor(
    public max: number,
    opts: { regenRate?: number; regenDelay?: number; exhaustedDelay?: number } = {},
  ) {
    this.current = max;
    this.regenRate = opts.regenRate ?? 46;
    this.regenDelay = opts.regenDelay ?? 0.55;
    this.exhaustedDelay = opts.exhaustedDelay ?? 1.1;
  }

  get fraction(): number {
    return this.current / this.max;
  }

  /** Whether an action costing `cost` may start (needs at least a sliver of stamina). */
  canAfford(cost: number): boolean {
    return cost <= 0 || this.current > 0.5;
  }

  /** Spends stamina. Returns false (and spends nothing) when the action cannot start. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.current = Math.max(0, this.current - cost);
    if (this.current <= 0) {
      this.exhausted = true;
      this.delay = this.exhaustedDelay;
    } else {
      this.delay = Math.max(this.delay, this.regenDelay);
    }
    return true;
  }

  /** Continuous drain (sprinting). */
  drain(amount: number): void {
    this.current = Math.max(0, this.current - amount);
    this.delay = Math.max(this.delay, 0.25);
    if (this.current <= 0) {
      this.exhausted = true;
      this.delay = this.exhaustedDelay;
    }
  }

  restore(): void {
    this.current = this.max;
    this.exhausted = false;
    this.delay = 0;
  }

  update(dt: number, regenMultiplier = 1): void {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    this.current = Math.min(this.max, this.current + this.regenRate * regenMultiplier * dt);
    if (this.exhausted && this.current > this.max * 0.3) this.exhausted = false;
  }
}
