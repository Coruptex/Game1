import type { Character, HitInfo } from '../characters/Character';
import { ALL_CLIPS } from '../characters/animation/Clips';
import { ATTACKS } from '../combat/AttackDefs';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import type { AttackCoordinator } from './AttackCoordinator';
import type { Enemy } from './Enemy';
import { Rng } from '../utils/random';
import { angleDelta, distXZ, yawFromDir } from '../utils/math';

export type AIState = 'idle' | 'patrol' | 'alert' | 'chase' | 'strafe' | 'attack' | 'stagger' | 'return' | 'dead';

export interface AIContext {
  player: Character;
  coordinator: AttackCoordinator;
  physics: PhysicsWorld;
}

/**
 * Finite-state machine for melee humanoids:
 * idle/patrol -> (detect) alert -> chase -> strafe (wait for an opening) -> attack -> recover ...
 * Stagger interrupts everything; the enemy leashes back home if the player escapes.
 */
export class EnemyAI {
  state: AIState = 'idle';
  stateTime = 0;
  private readonly rng: Rng;
  private patrolIndex = 0;
  private waitTimer = 0;
  private attackCooldown = 0;
  private strafeSign = 1;
  private strafeSwitch = 0;
  private immunity = 0;
  private readonly probe = { x: 0, z: 0 };

  constructor(
    private readonly enemy: Enemy,
    seed: number,
  ) {
    this.rng = new Rng(seed * 31 + 7);
    this.waitTimer = this.rng.range(1, 3);
    this.strafeSign = this.rng.sign();
  }

  get isAware(): boolean {
    return this.state !== 'idle' && this.state !== 'patrol' && this.state !== 'return' && this.state !== 'dead';
  }

  private set(s: AIState): void {
    this.state = s;
    this.stateTime = 0;
  }

  reset(): void {
    this.set(this.enemy.spawn.patrol ? 'patrol' : 'idle');
    this.patrolIndex = 0;
    this.attackCooldown = 0;
    this.immunity = 0;
    this.waitTimer = this.rng.range(1, 3);
  }

  onHit(_hit: HitInfo, staggered: boolean): void {
    if (this.state === 'dead') return;
    if (staggered) {
      this.set('stagger');
      this.enemy.hyperArmor = 0;
    } else if (!this.isAware) {
      // being hit from behind always provokes
      this.set('alert');
    }
  }

  onDeath(): void {
    this.set('dead');
  }

  private canSeePlayer(ctx: AIContext): boolean {
    const e = this.enemy;
    const p = ctx.player;
    if (p.isDead) return false;
    const per = e.def.perception;
    const dx = p.position.x - e.position.x;
    const dz = p.position.z - e.position.z;
    const d = Math.hypot(dx, dz);
    if (d > per.sightRange) return false;
    if (Math.abs(p.position.y - e.position.y) > 4) return false;
    if (d > per.awarenessRange) {
      const ang = Math.abs(angleDelta(e.yaw, yawFromDir(dx, dz)));
      if (ang > per.sightAngle / 2) return false;
    }
    return ctx.physics.lineOfSight(e.position.x, e.position.y + 1.6, e.position.z, p.position.x, p.position.y + 1.4, p.position.z);
  }

  /** Picks a walkable direction close to the desired one (simple whisker avoidance). */
  private steer(dirX: number, dirZ: number, physics: PhysicsWorld): [number, number] {
    const e = this.enemy;
    const look = 0.9;
    const offsets = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
    for (const o of offsets) {
      const c = Math.cos(o);
      const s = Math.sin(o);
      const x = dirX * c + dirZ * s;
      const z = -dirX * s + dirZ * c;
      this.probe.x = e.body.x + x * look;
      this.probe.z = e.body.z + z * look;
      if (physics.canStand(this.probe.x, this.probe.z, e.body.y, e.body.height)) {
        const blocked = physics.queryColliders(this.probe.x, this.probe.z, e.body.radius * 0.9).some((col) => col.yMax > e.body.y + 0.4 && col.yMin < e.body.y + 1.6);
        if (!blocked) return [x, z];
      }
    }
    return [dirX, dirZ];
  }

  private moveTo(x: number, z: number, speed: number, dt: number, ctx: AIContext, faceMove = true): number {
    const e = this.enemy;
    const dx = x - e.position.x;
    const dz = z - e.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      e.drive(0, 0, dt);
      return d;
    }
    const [sx, sz] = this.steer(dx / d, dz / d, ctx.physics);
    const v = Math.min(speed, d * 3);
    e.drive(sx * v, sz * v, dt);
    if (faceMove) e.face(yawFromDir(sx, sz), dt);
    return d;
  }

  update(dt: number, ctx: AIContext): void {
    const e = this.enemy;
    const def = e.def;
    this.stateTime += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.immunity > 0) this.immunity -= dt;
    const p = ctx.player;
    const dx = p.position.x - e.position.x;
    const dz = p.position.z - e.position.z;
    const dist = Math.hypot(dx, dz);
    const toPlayerYaw = yawFromDir(dx, dz);
    const homeDist = distXZ(e.position.x, e.position.z, e.spawn.x, e.spawn.z);
    const playerHomeDist = distXZ(p.position.x, p.position.z, e.spawn.x, e.spawn.z);

    switch (this.state) {
      case 'idle': {
        e.drive(0, 0, dt);
        e.face(e.spawn.yaw, dt, 0.3);
        if (this.canSeePlayer(ctx)) this.becomeAlert();
        else if (e.spawn.patrol && this.stateTime > this.waitTimer) this.set('patrol');
        break;
      }
      case 'patrol': {
        const route = e.spawn.patrol;
        if (!route || route.length === 0) {
          this.set('idle');
          break;
        }
        const wp = route[this.patrolIndex % route.length];
        const d = this.moveTo(wp.x, wp.z, def.stats.walkSpeed, dt, ctx);
        if (d < 0.6) {
          this.patrolIndex++;
          this.waitTimer = this.rng.range(1.5, 3.5);
          this.set('idle');
        }
        if (this.canSeePlayer(ctx)) this.becomeAlert();
        break;
      }
      case 'alert': {
        e.drive(0, 0, dt);
        e.face(toPlayerYaw, dt, 1.5);
        if (this.stateTime >= def.behaviour.alertTime) this.set('chase');
        break;
      }
      case 'chase': {
        if (p.isDead || playerHomeDist > def.perception.leashRange || homeDist > def.perception.leashRange + 6) {
          this.giveUp(ctx);
          break;
        }
        if (dist <= def.behaviour.strafeDistance + 0.6) {
          this.set('strafe');
          this.strafeSwitch = this.rng.range(1.2, 2.6);
          break;
        }
        this.moveTo(p.position.x, p.position.z, def.stats.runSpeed, dt, ctx);
        if (dist < 4.5) this.tryAttack(dist, ctx);
        break;
      }
      case 'strafe': {
        if (p.isDead || playerHomeDist > def.perception.leashRange) {
          this.giveUp(ctx);
          break;
        }
        if (dist > def.behaviour.strafeDistance + 2.2) {
          this.set('chase');
          break;
        }
        if (this.tryAttack(dist, ctx)) break;
        // circle around the player at the preferred distance, facing them
        this.strafeSwitch -= dt;
        if (this.strafeSwitch <= 0) {
          this.strafeSign = -this.strafeSign;
          this.strafeSwitch = this.rng.range(1.0, 2.6);
        }
        const nx = dx / (dist || 1);
        const nz = dz / (dist || 1);
        const tx = -nz * this.strafeSign;
        const tz = nx * this.strafeSign;
        const radial = (dist - def.behaviour.strafeDistance) * 1.2;
        let vx = tx * def.stats.walkSpeed + nx * radial;
        let vz = tz * def.stats.walkSpeed + nz * radial;
        const vl = Math.hypot(vx, vz);
        if (vl > def.stats.walkSpeed * 1.3) {
          vx = (vx / vl) * def.stats.walkSpeed * 1.3;
          vz = (vz / vl) * def.stats.walkSpeed * 1.3;
        }
        const [sx, sz] = vl > 0.01 ? this.steer(vx / vl, vz / vl, ctx.physics) : [0, 0];
        e.drive(sx * Math.min(vl, def.stats.walkSpeed * 1.3), sz * Math.min(vl, def.stats.walkSpeed * 1.3), dt);
        e.face(toPlayerYaw, dt, 1.4);
        break;
      }
      case 'attack': {
        const running = e.runAttack(dt, p.isDead ? null : toPlayerYaw);
        if (!running) {
          ctx.coordinator.release(e.id);
          this.attackCooldown = this.rng.range(def.behaviour.attackCooldown[0], def.behaviour.attackCooldown[1]);
          this.set(dist > def.behaviour.strafeDistance + 1 ? 'chase' : 'strafe');
          this.strafeSwitch = this.rng.range(0.8, 1.8);
        }
        break;
      }
      case 'stagger': {
        ctx.coordinator.release(e.id);
        e.drive(0, 0, dt);
        if (this.stateTime >= def.behaviour.staggerTime) {
          this.immunity = def.behaviour.staggerImmunity;
          e.hyperArmor = def.behaviour.staggerImmunity;
          this.attackCooldown = Math.min(this.attackCooldown, 0.25);
          this.set('strafe');
        }
        break;
      }
      case 'return': {
        const d = this.moveTo(e.spawn.x, e.spawn.z, def.stats.runSpeed * 0.8, dt, ctx);
        // regenerate while walking home
        e.health.heal(e.health.max * 0.25 * dt);
        if (d < 0.7) {
          e.health.reset();
          this.set(e.spawn.patrol ? 'patrol' : 'idle');
        } else if (this.stateTime > 1.5 && playerHomeDist < def.perception.leashRange * 0.6 && this.canSeePlayer(ctx)) {
          this.becomeAlert();
        }
        break;
      }
      case 'dead':
        break;
    }
  }

  private becomeAlert(): void {
    this.set('alert');
    this.enemy.animator.play(ALL_CLIPS.alert);
    this.enemy.events.onAlert?.(this.enemy);
  }

  private giveUp(ctx: AIContext): void {
    ctx.coordinator.release(this.enemy.id);
    this.set('return');
  }

  private tryAttack(dist: number, ctx: AIContext): boolean {
    const e = this.enemy;
    if (this.attackCooldown > 0 || ctx.player.isDead) return false;
    const options = e.def.attacks.filter((a) => dist >= a.minRange && dist <= a.maxRange);
    if (options.length === 0) return false;
    if (!ctx.coordinator.request(e.id)) return false;
    let total = 0;
    for (const o of options) total += o.weight;
    let r = this.rng.range(0, total);
    let choice = options[0];
    for (const o of options) {
      r -= o.weight;
      if (r <= 0) {
        choice = o;
        break;
      }
    }
    const def = ATTACKS[choice.attack];
    e.startAttack(def);
    e.events.onAttackStart?.(e);
    this.set('attack');
    return true;
  }
}
