import type { Interactable } from './Interactable';
import type { Character } from '../characters/Character';
import { angleDelta, yawFromDir } from '../utils/math';

/** Finds the interactable the player is facing / standing next to and triggers it on demand. */
export class InteractionSystem {
  readonly items: Interactable[] = [];
  focus: Interactable | null = null;
  private onFocusChange: ((i: Interactable | null) => void) | null = null;

  add(i: Interactable): void {
    this.items.push(i);
  }

  clear(): void {
    this.items.length = 0;
    this.focus = null;
  }

  onFocus(fn: (i: Interactable | null) => void): void {
    this.onFocusChange = fn;
  }

  update(dt: number, player: Character, enabled: boolean): void {
    for (const it of this.items) it.update?.(dt);
    let best: Interactable | null = null;
    let bestScore = Infinity;
    if (enabled && !player.isDead) {
      for (const it of this.items) {
        if (!it.prompt()) continue;
        const dx = it.position.x - player.position.x;
        const dz = it.position.z - player.position.z;
        const d = Math.hypot(dx, dz);
        if (d > it.radius || Math.abs(it.position.y - player.position.y) > 2.5) continue;
        const facing = Math.abs(angleDelta(player.yaw, yawFromDir(dx, dz)));
        if (d > 1.1 && facing > 1.9) continue;
        const score = d + facing * 0.4;
        if (score < bestScore) {
          best = it;
          bestScore = score;
        }
      }
    }
    if (best !== this.focus) {
      this.focus = best;
      this.onFocusChange?.(best);
    }
  }

  /** Interacts with the focused item; returns true if something happened. */
  tryInteract(): boolean {
    const f = this.focus;
    if (!f || !f.prompt()) return false;
    f.interact();
    return true;
  }
}
