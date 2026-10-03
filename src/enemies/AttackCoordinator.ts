/**
 * Limits how many enemies may attack the player at the same time (attack tokens), so group
 * fights stay readable and fair instead of everyone swinging at once.
 */
export class AttackCoordinator {
  private readonly holders = new Set<number>();
  private cooldown = 0;

  constructor(
    public maxAttackers = 1,
    public tokenGap = 0.45,
  ) {}

  request(id: number): boolean {
    if (this.holders.has(id)) return true;
    if (this.cooldown > 0 || this.holders.size >= this.maxAttackers) return false;
    this.holders.add(id);
    return true;
  }

  release(id: number): void {
    if (this.holders.delete(id)) this.cooldown = this.tokenGap;
  }

  holds(id: number): boolean {
    return this.holders.has(id);
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  reset(): void {
    this.holders.clear();
    this.cooldown = 0;
  }
}
