import * as THREE from 'three';
import type { Character } from '../characters/Character';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import { PLAYER_TUNING } from '../player/PlayerConfig';

/**
 * Soulslike lock-on: picks the best target near the player (distance weighted by how close it is
 * to the camera's view direction), keeps it while valid and switches automatically when it dies.
 */
export class LockOnSystem {
  target: Character | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly physics: PhysicsWorld) {}

  /** Toggles lock-on; returns the new target (or null). */
  toggle(player: Character, candidates: readonly Character[], camForwardX: number, camForwardZ: number): Character | null {
    if (this.target) {
      this.target = null;
      return null;
    }
    this.target = this.findBest(player, candidates, camForwardX, camForwardZ, null);
    return this.target;
  }

  private findBest(player: Character, candidates: readonly Character[], fx: number, fz: number, exclude: Character | null): Character | null {
    let best: Character | null = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      if (c === exclude || c.isDead) continue;
      const dx = c.position.x - player.position.x;
      const dz = c.position.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > PLAYER_TUNING.lockOnRange) continue;
      if (Math.abs(c.position.y - player.position.y) > 5) continue;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      // favour targets in front of the camera, but allow behind when close
      const score = d * (1.6 - facing * 0.6);
      if (score >= bestScore) continue;
      if (!this.physics.lineOfSight(player.position.x, player.position.y + 1.5, player.position.z, c.position.x, c.position.y + 1.3, c.position.z)) continue;
      best = c;
      bestScore = score;
    }
    return best;
  }

  /** Validates the current target; auto-switches to the next enemy when it dies. */
  update(player: Character, candidates: readonly Character[], camForwardX: number, camForwardZ: number): { changed: boolean } {
    const t = this.target;
    if (!t) return { changed: false };
    const d = Math.hypot(t.position.x - player.position.x, t.position.z - player.position.z);
    if (t.isDead) {
      this.target = this.findBest(player, candidates, camForwardX, camForwardZ, t);
      return { changed: true };
    }
    if (d > PLAYER_TUNING.lockOnBreakRange || player.isDead) {
      this.target = null;
      return { changed: true };
    }
    return { changed: false };
  }

  /** World point the reticle and camera aim at. */
  targetPoint(out: THREE.Vector3): THREE.Vector3 | null {
    if (!this.target) return null;
    return this.target.chestPosition(out);
  }

  clear(): void {
    this.target = null;
  }

  get point(): THREE.Vector3 | null {
    return this.targetPoint(this.tmp);
  }
}
