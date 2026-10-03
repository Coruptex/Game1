import * as THREE from 'three';
import { Character, type HitInfo } from '../characters/Character';
import { PLAYER_APPEARANCE } from '../characters/rig/Appearance';
import { ALL_CLIPS } from '../characters/animation/Clips';
import { ATTACKS, type AttackDef } from '../combat/AttackDefs';
import type { PhysicsWorld } from '../world/physics/PhysicsWorld';
import { PLAYER_STATS, PLAYER_TUNING } from './PlayerConfig';
import { clamp, lerp, yawFromDir } from '../utils/math';

/** Per-frame intent produced from input (or scripted for tests / cutscenes). */
export interface PlayerIntent {
  /** World-space movement direction scaled by stick magnitude (length 0..1). */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  light: boolean;
  heavy: boolean;
  dodge: boolean;
}

export function emptyIntent(): PlayerIntent {
  return { moveX: 0, moveZ: 0, sprint: false, light: false, heavy: false, dodge: false };
}

export type PlayerState = 'move' | 'attack' | 'dodge' | 'stagger' | 'interact' | 'rest' | 'rise' | 'dead';

type BufferedAction = 'light' | 'heavy' | 'dodge';

export interface PlayerEvents {
  onAttackStart?(def: AttackDef): void;
  onDodge?(roll: boolean): void;
  onStaminaFail?(): void;
  onDamaged?(hit: HitInfo, staggered: boolean): void;
  onDeath?(): void;
}

/**
 * The captain. Movement is camera-relative (resolved by the caller into world intent),
 * combat follows Soulslike rules: committed attacks, stamina costs, buffered inputs,
 * rolls with invulnerability frames, stagger on hit.
 */
export class Player extends Character {
  readonly faction = 'player' as const;
  state: PlayerState = 'move';
  stateTime = 0;
  /** Current lock-on target (managed by LockOnSystem). */
  lockTarget: Character | null = null;
  events: PlayerEvents = {};

  private buffered: BufferedAction | null = null;
  private bufferTimer = 0;
  private dodgeDir = new THREE.Vector2();
  private dodgeIsRoll = true;
  private interactDuration = 0;
  private sprinting = false;
  readonly trailBase = new THREE.Vector3();
  readonly trailTip = new THREE.Vector3();

  constructor(physics: PhysicsWorld) {
    super(PLAYER_STATS, PLAYER_APPEARANCE, physics);
  }

  get isSprinting(): boolean {
    return this.sprinting;
  }

  get isBusy(): boolean {
    return this.state !== 'move';
  }

  /** True while the blade should leave a trail. */
  get trailActive(): boolean {
    const a = this.attack;
    if (!a || this.state !== 'attack') return false;
    const t = this.attackTime;
    return a.windows.some(([s, e]) => t >= s - 0.05 && t <= e + 0.06);
  }

  private setState(s: PlayerState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private bufferAction(a: BufferedAction): void {
    this.buffered = a;
    this.bufferTimer = PLAYER_TUNING.inputBuffer;
  }

  private consumeBuffer(): BufferedAction | null {
    const b = this.buffered;
    this.buffered = null;
    return b;
  }

  /** Desired facing for attacks: lock target, else stick direction, else current. */
  private aimYaw(intent: PlayerIntent): number | null {
    if (this.lockTarget && !this.lockTarget.isDead) {
      return yawFromDir(this.lockTarget.position.x - this.position.x, this.lockTarget.position.z - this.position.z);
    }
    if (Math.hypot(intent.moveX, intent.moveZ) > 0.3) return yawFromDir(intent.moveX, intent.moveZ);
    return null;
  }

  private tryAttack(kind: 'light' | 'heavy', intent: PlayerIntent, comboFrom: AttackDef | null): boolean {
    let def: AttackDef;
    if (kind === 'heavy') def = ATTACKS.heavy;
    else def = comboFrom?.next && comboFrom.id !== 'heavy' ? ATTACKS[comboFrom.next] : ATTACKS.light1;
    if (!this.stamina.spend(def.staminaCost)) {
      this.events.onStaminaFail?.();
      return false;
    }
    // Snap most of the way towards the aim direction at the start of a swing.
    const aim = this.aimYaw(intent);
    if (aim !== null) this.faceTowards(aim, 1.2);
    this.startAttack(def);
    this.setState('attack');
    this.sprinting = false;
    this.events.onAttackStart?.(def);
    return true;
  }

  private tryDodge(intent: PlayerIntent): boolean {
    const mag = Math.hypot(intent.moveX, intent.moveZ);
    const roll = mag > 0.2;
    const cfg = roll ? PLAYER_TUNING.roll : PLAYER_TUNING.backstep;
    if (!this.stamina.spend(cfg.staminaCost)) {
      this.events.onStaminaFail?.();
      return false;
    }
    if (this.attack) this.cancelAttack();
    this.dodgeIsRoll = roll;
    if (roll) {
      this.dodgeDir.set(intent.moveX / mag, intent.moveZ / mag);
      this.yaw = yawFromDir(this.dodgeDir.x, this.dodgeDir.y);
      this.animator.play(ALL_CLIPS.roll);
    } else {
      this.dodgeDir.set(-Math.sin(this.yaw), -Math.cos(this.yaw));
      this.animator.play(ALL_CLIPS.backstep);
    }
    this.setState('dodge');
    this.sprinting = false;
    this.events.onDodge?.(roll);
    return true;
  }

  /** Starts a scripted interaction animation (chest, shrine...). */
  beginInteract(kind: 'interact' | 'rest', faceX?: number, faceZ?: number): void {
    if (this.state === 'dead') return;
    if (faceX !== undefined && faceZ !== undefined) {
      this.yaw = yawFromDir(faceX - this.position.x, faceZ - this.position.z);
    }
    this.velocity.set(0, 0);
    if (this.attack) this.cancelAttack();
    const clip = kind === 'rest' ? ALL_CLIPS.rest : ALL_CLIPS.interact;
    this.animator.play(clip);
    this.interactDuration = clip.duration * (kind === 'rest' ? 0.95 : 0.85);
    this.setState(kind === 'rest' ? 'rest' : 'interact');
  }

  get canInteract(): boolean {
    return this.state === 'move';
  }

  update(dt: number, intent: PlayerIntent): void {
    this.stateTime += dt;
    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.bufferTimer <= 0) this.buffered = null;
    }
    if (this.state !== 'dead') {
      if (intent.dodge) this.bufferAction('dodge');
      else if (intent.heavy) this.bufferAction('heavy');
      else if (intent.light) this.bufferAction('light');
    }

    let regen = 1;
    switch (this.state) {
      case 'move':
        this.updateMove(dt, intent);
        break;
      case 'attack':
        regen = 0;
        this.updateAttackState(dt, intent);
        break;
      case 'dodge':
        regen = 0;
        this.updateDodge(dt, intent);
        break;
      case 'stagger':
        this.steerVelocity(0, 0, dt);
        if (this.stateTime >= PLAYER_TUNING.hitStagger) this.setState('move');
        break;
      case 'interact':
      case 'rest':
      case 'rise':
        this.velocity.set(0, 0);
        if (this.stateTime >= this.interactDuration) this.setState('move');
        break;
      case 'dead':
        this.steerVelocity(0, 0, dt);
        this.deadTime += dt;
        break;
    }

    if (this.state !== 'dead') this.stamina.update(dt, regen * (this.sprinting ? 0 : 1) * (this.attack ? 0 : 1));
    this.integrate(dt);
    this.updateCommon(dt);
    if (this.trailActive) this.rig.getBladeWorld(this.trailBase, this.trailTip);
  }

  private updateMove(dt: number, intent: PlayerIntent): void {
    // buffered actions
    const b = this.buffered;
    if (b === 'dodge' && this.stamina.canAfford(1)) {
      this.consumeBuffer();
      if (this.tryDodge(intent)) return;
    } else if ((b === 'light' || b === 'heavy') && this.stamina.canAfford(1)) {
      this.consumeBuffer();
      if (this.tryAttack(b, intent, null)) return;
    } else if (b && !this.stamina.canAfford(1)) {
      this.consumeBuffer();
      this.events.onStaminaFail?.();
    }

    const mag = Math.min(1, Math.hypot(intent.moveX, intent.moveZ));
    const T = PLAYER_TUNING;
    const s = this.stats;
    let speed = 0;
    if (mag > 0.05) {
      speed = mag <= T.walkThreshold ? s.walkSpeed * Math.max(0.35, mag / T.walkThreshold) : lerp(s.walkSpeed, s.runSpeed, clamp((mag - T.walkThreshold) / 0.3, 0, 1));
    }
    const wantSprint = intent.sprint && mag > 0.5 && !this.stamina.exhausted && this.stamina.current > 0;
    this.sprinting = wantSprint;
    if (wantSprint) {
      speed = s.sprintSpeed;
      this.stamina.drain(T.sprintDrain * dt);
    }
    // shallow water slows you down
    if (this.ground.waterDepth > 0.25) speed *= 0.72;

    const dirX = mag > 0.001 ? intent.moveX / mag : 0;
    const dirZ = mag > 0.001 ? intent.moveZ / mag : 0;
    this.steerVelocity(dirX * speed, dirZ * speed, dt);

    const locked = this.lockTarget && !this.lockTarget.isDead && !this.sprinting;
    if (locked) {
      const ty = yawFromDir(this.lockTarget!.position.x - this.position.x, this.lockTarget!.position.z - this.position.z);
      this.faceTowards(ty, 10 * dt);
    } else if (mag > 0.05) {
      this.faceTowards(yawFromDir(dirX, dirZ), s.turnSpeed * dt);
    }
  }

  private updateAttackState(dt: number, intent: PlayerIntent): void {
    const current = this.attack;
    const t = this.attackTime;
    if (current) {
      const b = this.buffered;
      if ((b === 'light' || b === 'heavy') && t >= current.comboTime) {
        this.consumeBuffer();
        if (this.tryAttack(b, intent, current)) return;
      }
      if (b === 'dodge' && t >= current.dodgeCancelTime) {
        this.consumeBuffer();
        if (this.tryDodge(intent)) return;
      }
    }
    const aim = this.aimYaw(intent);
    if (!this.updateAttack(dt, aim)) {
      this.setState('move');
    }
  }

  private updateDodge(_dt: number, intent: PlayerIntent): void {
    const cfg = this.dodgeIsRoll ? PLAYER_TUNING.roll : PLAYER_TUNING.backstep;
    const t = this.stateTime;
    this.invulnerable = t >= cfg.iframes[0] && t <= cfg.iframes[1] ? Math.max(this.invulnerable, 0.02) : this.invulnerable;
    const k = clamp(t / (cfg.duration * 0.85), 0, 1);
    const speed = cfg.speed * (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
    this.velocity.set(this.dodgeDir.x * speed, this.dodgeDir.y * speed);
    if (t >= cfg.recoverAt) {
      const b = this.buffered;
      if (b === 'light' || b === 'heavy') {
        this.consumeBuffer();
        if (this.tryAttack(b, intent, null)) return;
      } else if (b === 'dodge' && t >= cfg.duration - 0.06) {
        this.consumeBuffer();
        if (this.tryDodge(intent)) return;
      }
    }
    if (t >= cfg.duration) this.setState('move');
  }

  protected onHit(hit: HitInfo, staggered: boolean): void {
    this.invulnerable = PLAYER_TUNING.hitInvulnerability;
    this.sprinting = false;
    void staggered;
    // The player always flinches (accessible: hits interrupt, but i-frames prevent juggling).
    if (this.attack) this.cancelAttack();
    this.animator.play(ALL_CLIPS.hit);
    this.setState('stagger');
    this.yaw = yawFromDir(-hit.dirX, -hit.dirZ);
    this.events.onDamaged?.(hit, true);
  }

  protected onDeath(hit: HitInfo): void {
    if (this.attack) this.cancelAttack();
    this.yaw = yawFromDir(-hit.dirX, -hit.dirZ);
    this.animator.play(ALL_CLIPS.death, { hold: true });
    this.setState('dead');
    this.deadTime = 0;
    this.lockTarget = null;
    this.events.onDamaged?.(hit, true);
    this.events.onDeath?.();
  }

  /** Full restore at a checkpoint / respawn. */
  respawnAt(x: number, z: number, yaw: number, kneel: boolean): void {
    this.health.reset();
    this.stamina.restore();
    this.poiseDamageTaken = 0;
    this.invulnerable = 1.0;
    this.attack = null;
    this.buffered = null;
    this.lockTarget = null;
    this.deadTime = 0;
    this.animator.clear();
    this.teleport(x, z, yaw);
    if (kneel) {
      this.animator.play(ALL_CLIPS.rise);
      this.interactDuration = ALL_CLIPS.rise.duration * 0.9;
      this.setState('rise');
    } else {
      this.setState('move');
    }
  }
}
