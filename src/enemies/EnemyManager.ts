import type * as THREE from 'three';
import { Enemy, type EnemyEvents } from './Enemy';
import { ENEMY_DEFINITIONS } from './EnemyDefinitions';
import { AttackCoordinator } from './AttackCoordinator';
import type { AIContext } from './EnemyAI';
import type { EnemySpawn } from '../world/areas/AreaTypes';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import type { Character } from '../characters/Character';
import type { CombatSystem } from '../combat/CombatSystem';

/** Spawns, updates and resets the enemies of the current area. */
export class EnemyManager {
  readonly enemies: Enemy[] = [];
  readonly coordinator = new AttackCoordinator(1, 0.5);
  private readonly ctx: AIContext;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly physics: PhysicsWorld,
    private readonly combat: CombatSystem,
    player: Character,
    private readonly events: EnemyEvents,
  ) {
    this.ctx = { player, coordinator: this.coordinator, physics };
  }

  spawnAll(spawns: EnemySpawn[]): void {
    spawns.forEach((s, i) => {
      const def = ENEMY_DEFINITIONS[s.type];
      if (!def) {
        console.warn(`Unknown enemy type ${s.type}`);
        return;
      }
      const e = new Enemy(def, s, this.physics, i + 1);
      e.events = this.events;
      this.parent.add(e.root);
      this.combat.register(e);
      this.enemies.push(e);
    });
  }

  /** Souls rule: resting or dying brings every enemy back. */
  resetAll(): void {
    this.coordinator.reset();
    for (const e of this.enemies) {
      e.reset();
      this.combat.register(e);
    }
  }

  get alive(): Enemy[] {
    return this.enemies.filter((e) => !e.isDead && !e.removed);
  }

  update(dt: number): void {
    this.coordinator.update(dt);
    for (const e of this.enemies) {
      if (e.removed) continue;
      e.update(dt, this.ctx);
      // a dead or staggered attacker must hand its attack token back
      if (e.isDead && this.coordinator.holds(e.id)) this.coordinator.release(e.id);
      if (e.removed) this.combat.unregister(e);
    }
    this.separate();
  }

  /** Soft push-apart between characters (enemies and player) so they never overlap. */
  private separate(): void {
    const list: Character[] = [...this.enemies.filter((e) => !e.removed && !e.isDead), this.ctx.player];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.body.x - a.body.x;
        const dz = b.body.z - a.body.z;
        const min = a.body.radius + b.body.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || Math.abs(a.body.y - b.body.y) > 1.2) continue;
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        // keep pushes on walkable ground
        if (this.physics.canStand(a.body.x - nx * push, a.body.z - nz * push, a.body.y, a.body.height)) {
          a.body.x -= nx * push;
          a.body.z -= nz * push;
        }
        if (this.physics.canStand(b.body.x + nx * push, b.body.z + nz * push, b.body.y, b.body.height)) {
          b.body.x += nx * push;
          b.body.z += nz * push;
        }
        a.root.position.x = a.body.x;
        a.root.position.z = a.body.z;
        b.root.position.x = b.body.x;
        b.root.position.z = b.body.z;
      }
    }
  }

  dispose(): void {
    for (const e of this.enemies) {
      this.combat.unregister(e);
      e.dispose();
    }
    this.enemies.length = 0;
  }
}
