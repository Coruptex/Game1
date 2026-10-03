import { Character, type HitInfo } from '../characters/Character';
import { ALL_CLIPS } from '../characters/animation/Clips';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import type { EnemySpawn } from '../world/areas/AreaTypes';
import type { EnemyDefinition } from './EnemyDefinitions';
import { EnemyAI, type AIContext } from './EnemyAI';

export interface EnemyEvents {
  onDamaged?(enemy: Enemy, hit: HitInfo, staggered: boolean): void;
  onDeath?(enemy: Enemy, hit: HitInfo): void;
  onAlert?(enemy: Enemy): void;
  onAttackStart?(enemy: Enemy): void;
}

/** A humanoid enemy driven by EnemyAI. */
export class Enemy extends Character {
  readonly faction = 'enemy' as const;
  readonly ai: EnemyAI;
  events: EnemyEvents = {};
  /** Seconds the floating health bar stays visible. */
  barTimer = 0;
  /** Fully faded out and inactive (after death). */
  removed = false;
  private fade = 1;

  constructor(
    readonly def: EnemyDefinition,
    readonly spawn: EnemySpawn,
    physics: PhysicsWorld,
    seed: number,
  ) {
    super(def.stats, def.appearance(seed), physics);
    this.ai = new EnemyAI(this, seed);
    this.teleport(spawn.x, spawn.z, spawn.yaw);
  }

  update(dt: number, ctx: AIContext): void {
    if (this.removed) return;
    if (this.barTimer > 0) this.barTimer -= dt;
    if (this.isDead) {
      this.deadTime += dt;
      this.steerVelocity(0, 0, dt);
      if (this.deadTime > 2.6) {
        this.fade = Math.max(0, 1 - (this.deadTime - 2.6) / 1.4);
        this.rig.setOpacity(this.fade);
        this.root.position.y -= dt * 0.25;
        if (this.fade <= 0) {
          this.removed = true;
          this.root.visible = false;
        }
      }
      this.integrate(dt);
      this.updateCommon(dt);
      if (this.deadTime > 2.6) this.root.position.y = this.body.y - (this.deadTime - 2.6) * 0.25;
      return;
    }
    this.ai.update(dt, ctx);
    this.stamina.update(dt);
    this.integrate(dt);
    this.updateCommon(dt);
  }

  /** Called by the AI to perform movement (velocity is integrated by the base class). */
  drive(desiredX: number, desiredZ: number, dt: number): void {
    this.steerVelocity(desiredX, desiredZ, dt);
  }

  face(yaw: number, dt: number, speedMul = 1): void {
    this.faceTowards(yaw, this.stats.turnSpeed * speedMul * dt);
  }

  runAttack(dt: number, trackYaw: number | null): boolean {
    return this.updateAttack(dt, trackYaw);
  }

  protected onHit(hit: HitInfo, staggered: boolean): void {
    this.barTimer = 6;
    this.ai.onHit(hit, staggered);
    if (staggered) {
      if (this.attack) this.cancelAttack();
      this.animator.play(ALL_CLIPS.hit);
    }
    this.events.onDamaged?.(this, hit, staggered);
  }

  protected onDeath(hit: HitInfo): void {
    this.barTimer = 0;
    if (this.attack) this.cancelAttack();
    this.ai.onDeath();
    this.yaw = Math.atan2(-hit.dirX, -hit.dirZ);
    this.animator.play(ALL_CLIPS.death, { hold: true, speed: 1.1 });
    this.deadTime = 0;
    this.events.onDeath?.(this, hit);
  }

  /** Back to the spawn point at full health (checkpoint rest / player death). */
  reset(): void {
    this.health.reset();
    this.stamina.restore();
    this.poiseDamageTaken = 0;
    this.invulnerable = 0;
    this.attack = null;
    this.deadTime = 0;
    this.removed = false;
    this.fade = 1;
    this.barTimer = 0;
    this.rig.setOpacity(1);
    this.root.visible = true;
    this.animator.clear();
    this.ai.reset();
    this.teleport(this.spawn.x, this.spawn.z, this.spawn.yaw);
  }
}
