import * as THREE from 'three';
import type { Character, HitInfo, HitResult } from '../characters/Character';
import { angleDelta, yawFromDir } from '../utils/math';

export interface CombatHooks {
  /** Called for every resolved hit (effects, sounds, events live outside the combat rules). */
  onHit(attacker: Character, target: Character, hit: HitInfo, result: HitResult): void;
}

/**
 * Resolves melee hits: every frame, attackers inside an active hit window test their weapon arc
 * (range + angle + height) against opposing combatants. Each window hits a target at most once.
 */
export class CombatSystem {
  private readonly combatants = new Set<Character>();
  private readonly point = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly hooks: CombatHooks) {}

  register(c: Character): void {
    this.combatants.add(c);
  }

  unregister(c: Character): void {
    this.combatants.delete(c);
  }

  get all(): ReadonlySet<Character> {
    return this.combatants;
  }

  /** Pure geometric test (exposed for AI decisions and tests). */
  static inReach(attacker: Character, target: Character, range: number, arc: number): boolean {
    const dx = target.position.x - attacker.position.x;
    const dz = target.position.z - attacker.position.z;
    const dy = target.position.y - attacker.position.y;
    if (Math.abs(dy) > 1.6) return false;
    const dist = Math.hypot(dx, dz) - target.body.radius;
    if (dist > range) return false;
    if (dist < 0.5) return true;
    const ang = Math.abs(angleDelta(attacker.yaw, yawFromDir(dx, dz)));
    return ang <= arc / 2;
  }

  update(): void {
    for (const attacker of this.combatants) {
      if (attacker.isDead || !attacker.attack) continue;
      const w = attacker.activeWindow();
      if (w < 0) continue;
      const atk = attacker.attack;
      for (const target of this.combatants) {
        if (target === attacker || target.faction === attacker.faction || target.isDead) continue;
        if (attacker.attackHits[w].has(target.id)) continue;
        if (!CombatSystem.inReach(attacker, target, atk.range, atk.arc)) continue;
        attacker.attackHits[w].add(target.id);
        const dx = target.position.x - attacker.position.x;
        const dz = target.position.z - attacker.position.z;
        const d = Math.hypot(dx, dz) || 1;
        // contact point: on the target's surface facing the attacker, at chest height
        target.chestPosition(this.point);
        this.tmp.set(-dx / d, 0, -dz / d).multiplyScalar(target.body.radius * 0.8);
        this.point.add(this.tmp);
        const hit: HitInfo = {
          attacker,
          attack: atk,
          damage: atk.damage,
          poiseDamage: atk.poiseDamage,
          dirX: dx / d,
          dirZ: dz / d,
          knockback: atk.knockback,
          heavy: !!atk.heavy,
          point: this.point.clone(),
        };
        const result = target.receiveHit(hit);
        this.hooks.onHit(attacker, target, hit, result);
      }
    }
  }
}
