import * as THREE from 'three';
import { HumanoidRig } from './rig/HumanoidRig';
import type { Appearance } from './rig/Appearance';
import { Animator } from './animation/Animator';
import { ALL_CLIPS } from './animation/Clips';
import { HealthComponent } from '../combat/HealthComponent';
import { StaminaComponent } from '../combat/StaminaComponent';
import type { AttackDef } from '../combat/AttackDefs';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import { createGroundInfo, type BodyState, type GroundInfo, type SurfaceType } from '../world/physics/PhysicsTypes';
import { angleDelta, clamp, moveTowards, rotateTowards } from '../utils/math';

export type Faction = 'player' | 'enemy';

export interface CharacterStats {
  name: string;
  radius: number;
  height: number;
  maxHealth: number;
  maxStamina?: number;
  /** Poise: accumulated poise damage above this staggers. */
  poise: number;
  walkSpeed: number;
  runSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  deceleration: number;
  turnSpeed: number;
  /** Visual personality for locomotion (0 upright .. 1 hunched). */
  hunch?: number;
}

export interface HitInfo {
  attacker: Character;
  attack: AttackDef;
  damage: number;
  poiseDamage: number;
  /** Normalised XZ direction from attacker to target. */
  dirX: number;
  dirZ: number;
  knockback: number;
  heavy: boolean;
  point: THREE.Vector3;
}

export type HitResult = 'hit' | 'evaded' | 'ignored' | 'killed';

let nextId = 1;

/**
 * Shared base for the player and every humanoid enemy: rig + animator, kinematic body,
 * health/stamina/poise, attack execution with root motion, and damage reception.
 */
export abstract class Character {
  readonly id = nextId++;
  readonly root = new THREE.Group();
  readonly rig: HumanoidRig;
  readonly animator: Animator;
  readonly body: BodyState;
  readonly health: HealthComponent;
  readonly stamina: StaminaComponent;
  readonly ground: GroundInfo = createGroundInfo();
  abstract readonly faction: Faction;

  /** Facing yaw (0 = +Z). */
  yaw = 0;
  /** Horizontal velocity (world XZ). */
  readonly velocity = new THREE.Vector2();
  /** External impulse velocity (knockback), decays quickly. */
  readonly impulse = new THREE.Vector2();

  poiseDamageTaken = 0;
  private poiseRegenDelay = 0;
  invulnerable = 0;
  /** Super armour time: hits still damage but do not stagger. */
  hyperArmor = 0;

  // attack execution state
  attack: AttackDef | null = null;
  attackTime = 0;
  readonly attackHits: Array<Set<number>> = [];
  private telegraphed = false;

  deadTime = 0;
  private lastYaw = 0;
  turnRate = 0;

  onFootstep: ((c: Character, surface: SurfaceType, waterDepth: number) => void) | null = null;
  onTelegraph: ((c: Character) => void) | null = null;

  protected constructor(
    readonly stats: CharacterStats,
    appearance: Appearance,
    protected physics: PhysicsWorld,
  ) {
    this.rig = new HumanoidRig(appearance);
    this.root.add(this.rig.object);
    this.root.name = stats.name;
    this.animator = new Animator(this.rig);
    this.animator.loco.hunch = stats.hunch ?? 0;
    this.animator.onFootstep = () => this.onFootstep?.(this, this.ground.surface, this.ground.waterDepth);
    this.body = { x: 0, y: 0, z: 0, radius: stats.radius, height: stats.height };
    this.health = new HealthComponent(stats.maxHealth);
    this.stamina = new StaminaComponent(stats.maxStamina ?? 100);
  }

  get name(): string {
    return this.stats.name;
  }

  /** Moves the character into another area's physics world. */
  setPhysics(physics: PhysicsWorld): void {
    this.physics = physics;
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  get isDead(): boolean {
    return this.health.isDead;
  }

  /** World position of the chest (lock-on point, hit sparks). */
  chestPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.stats.height * 0.7, this.root.position.z);
  }

  teleport(x: number, z: number, yaw = this.yaw): void {
    const g = this.physics.groundAt(x, z, 50, this.ground, this.body.height);
    // Prefer the highest walkable surface near the requested point (docks / decks).
    this.body.x = x;
    this.body.z = z;
    this.body.y = g.height;
    this.yaw = yaw;
    this.velocity.set(0, 0);
    this.impulse.set(0, 0);
    this.syncRoot();
  }

  protected syncRoot(): void {
    this.root.position.set(this.body.x, this.body.y, this.body.z);
    this.root.rotation.y = this.yaw;
  }

  /** Accelerates horizontal velocity towards a desired velocity. */
  protected steerVelocity(desiredX: number, desiredZ: number, dt: number): void {
    const accelerating = desiredX * desiredX + desiredZ * desiredZ > this.velocity.lengthSq();
    const rate = (accelerating ? this.stats.acceleration : this.stats.deceleration) * dt;
    const dx = desiredX - this.velocity.x;
    const dz = desiredZ - this.velocity.y;
    const d = Math.hypot(dx, dz);
    if (d <= rate || d < 1e-6) {
      this.velocity.set(desiredX, desiredZ);
    } else {
      this.velocity.x += (dx / d) * rate;
      this.velocity.y += (dz / d) * rate;
    }
  }

  protected faceTowards(targetYaw: number, maxStep: number): void {
    this.yaw = rotateTowards(this.yaw, targetYaw, maxStep);
  }

  /** Integrates velocity + impulse through the physics world. */
  protected integrate(dt: number): void {
    const vx = this.velocity.x + this.impulse.x;
    const vz = this.velocity.y + this.impulse.y;
    if (vx !== 0 || vz !== 0) {
      const res = this.physics.moveBody(this.body, vx * dt, vz * dt);
      Object.assign(this.ground, res.ground);
      if (res.blocked && res.moved < 0.5) {
        // lose velocity into walls so characters don't keep "pushing"
        this.velocity.multiplyScalar(0.6);
      }
    } else {
      this.physics.groundAt(this.body.x, this.body.z, this.body.y, this.ground, this.body.height);
      if (Math.abs(this.ground.height - this.body.y) < 1.2) this.body.y = this.ground.height;
    }
    // impulse decay
    const decay = Math.exp(-7 * dt);
    this.impulse.multiplyScalar(decay);
    if (this.impulse.lengthSq() < 0.0004) this.impulse.set(0, 0);
    this.syncRoot();
  }

  // -------------------------------------------------------------------------
  // Attacks
  // -------------------------------------------------------------------------

  startAttack(def: AttackDef): void {
    this.attack = def;
    this.attackTime = 0;
    this.telegraphed = false;
    this.attackHits.length = 0;
    for (let i = 0; i < def.windows.length; i++) this.attackHits.push(new Set());
    this.animator.play(ALL_CLIPS[def.clip], { speed: def.speed ?? 1 });
  }

  cancelAttack(): void {
    this.attack = null;
    this.animator.stop();
  }

  /** Index of the active hit window, or -1. */
  activeWindow(): number {
    const a = this.attack;
    if (!a) return -1;
    for (let i = 0; i < a.windows.length; i++) {
      if (this.attackTime >= a.windows[i][0] && this.attackTime <= a.windows[i][1]) return i;
    }
    return -1;
  }

  /**
   * Advances the current attack: root-motion lunge, tracking towards `trackYaw` during the
   * wind-up, telegraph event. Returns false once the attack has finished.
   */
  protected updateAttack(dt: number, trackYaw: number | null): boolean {
    const a = this.attack;
    if (!a) return false;
    this.attackTime += dt * (a.speed ?? 1);
    const t = this.attackTime;
    if (trackYaw !== null && t < a.trackUntil) this.faceTowards(trackYaw, a.tracking * dt);
    if (a.telegraphAt !== undefined && !this.telegraphed && t >= a.telegraphAt) {
      this.telegraphed = true;
      this.onTelegraph?.(this);
    }
    let lunge = 0;
    for (const [s, e, v] of a.lunge ?? []) {
      if (t >= s && t <= e) {
        const k = (t - s) / (e - s);
        lunge = v * (1 - k * k);
      }
    }
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.velocity.set(fx * lunge, fz * lunge);
    if (t >= a.endTime) {
      this.attack = null;
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------

  /** Called by the CombatSystem. Subclasses add their reactions via onHit / onDeath. */
  receiveHit(hit: HitInfo): HitResult {
    if (this.isDead) return 'ignored';
    if (this.invulnerable > 0) return 'evaded';
    const dealt = this.health.damage(hit.damage);
    this.impulse.set(hit.dirX * hit.knockback, hit.dirZ * hit.knockback);
    this.rig.flash(this.faction === 'player' ? 0xff4a3a : 0xffffff, 0.14);
    this.animator.addFlinch(1);
    this.poiseDamageTaken += hit.poiseDamage;
    this.poiseRegenDelay = 2.0;
    if (this.health.isDead) {
      this.onDeath(hit);
      return 'killed';
    }
    const broken = this.hyperArmor <= 0 && (this.poiseDamageTaken >= this.stats.poise || hit.heavy);
    if (broken) this.poiseDamageTaken = 0;
    this.onHit(hit, broken, dealt);
    return 'hit';
  }

  protected abstract onHit(hit: HitInfo, staggered: boolean, dealt: number): void;
  protected abstract onDeath(hit: HitInfo): void;

  /** Common per-frame bookkeeping; subclasses call this at the end of their update. */
  protected updateCommon(dt: number): void {
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.hyperArmor > 0) this.hyperArmor -= dt;
    if (this.poiseRegenDelay > 0) this.poiseRegenDelay -= dt;
    else this.poiseDamageTaken = moveTowards(this.poiseDamageTaken, 0, this.stats.poise * 0.5 * dt);
    this.health.update(dt);

    const speed = this.velocity.length();
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const l = this.animator.loco;
    l.speed = this.attack ? 0 : speed;
    if (speed > 0.05) {
      l.dirX = (this.velocity.x * c - this.velocity.y * s) / speed;
      l.dirZ = (this.velocity.x * s + this.velocity.y * c) / speed;
    }
    this.turnRate = dt > 0 ? clamp(angleDelta(this.lastYaw, this.yaw) / dt, -10, 10) : 0;
    this.lastYaw = this.yaw;
    l.turnRate = this.turnRate;
    this.animator.update(dt);
    this.rig.update(dt);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.rig.dispose();
  }
}
