import * as THREE from 'three';
import { Pose } from './Pose';
import { createHandGoal, solveArm, type HandGoal } from './ArmIK';
import { sampleFK, sampleIK, sampleWeight, slerpDir, type CompiledClip } from './Clips';
import { computeLocomotion, strideLength, type LocomotionInput } from './Locomotion';
import type { HumanoidRig } from '../rig/HumanoidRig';
import { clamp } from '../../utils/math';

interface ActionState {
  clip: CompiledClip;
  time: number;
  speed: number;
  weight: number;
  ending: boolean;
  /** Keep the final pose after the clip ends (death). */
  hold: boolean;
}

export type FootstepCallback = (foot: 'L' | 'R') => void;

/**
 * Layered procedural animator:
 *   1. base layer   – procedural locomotion (idle / walk / run / sprint / strafe) + sword-hand IK
 *   2. action layer – key-framed clip (attacks, dodges, reactions) blended on top
 *   3. additive     – hit flinch
 * The final FK pose is written to the rig, then the hand IK goals are solved.
 */
export class Animator {
  readonly loco: LocomotionInput = { speed: 0, dirX: 0, dirZ: 1, phase: 0, time: 0, hunch: 0, turnRate: 0 };
  private readonly base = new Pose();
  private readonly actionPose = new Pose();
  private readonly out = new Pose();
  private readonly flinchPose = Pose.from({ spine: [-0.18, 0.12, 0], chest: [-0.14, 0.1, 0], head: [-0.2, 0, 0] });
  private readonly baseGoalR = createHandGoal();
  private readonly goalR = createHandGoal();
  private readonly goalL = createHandGoal();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private action: ActionState | null = null;
  private flinch = 0;
  private lastPhase = 0;
  onFootstep: FootstepCallback | null = null;

  constructor(readonly rig: HumanoidRig) {}

  get currentClip(): CompiledClip | null {
    return this.action && !this.action.ending ? this.action.clip : null;
  }

  get actionTime(): number {
    return this.action?.time ?? 0;
  }

  play(clip: CompiledClip, opts: { speed?: number; startTime?: number; hold?: boolean } = {}): void {
    const prevWeight = this.action ? this.action.weight : 0;
    this.action = {
      clip,
      time: opts.startTime ?? 0,
      speed: opts.speed ?? 1,
      // keep continuity when chaining actions (combo -> combo)
      weight: Math.min(prevWeight, 1),
      ending: false,
      hold: !!opts.hold,
    };
  }

  /** Fades the current action out. */
  stop(): void {
    if (this.action) this.action.ending = true;
  }

  /** Immediately clears the action layer (respawn). */
  clear(): void {
    this.action = null;
    this.flinch = 0;
  }

  addFlinch(amount = 1): void {
    this.flinch = Math.max(this.flinch, amount);
  }

  update(dt: number): void {
    // --- base layer ----------------------------------------------------------
    const l = this.loco;
    l.time += dt;
    const stride = strideLength(l.speed);
    this.lastPhase = l.phase;
    l.phase += (Math.PI * l.speed * dt) / stride;
    // footstep at each foot plant (phase crossing pi/2 + k*pi)
    if (this.onFootstep && l.speed > 0.4) {
      const k0 = Math.floor((this.lastPhase - Math.PI / 2) / Math.PI);
      const k1 = Math.floor((l.phase - Math.PI / 2) / Math.PI);
      if (k1 !== k0) this.onFootstep(k1 % 2 === 0 ? 'L' : 'R');
    }
    if (l.phase > 1000) l.phase -= Math.PI * 200;
    computeLocomotion(l, this.base, this.baseGoalR);

    // --- action layer ----------------------------------------------------------
    this.out.copy(this.base);
    this.goalR.pos.copy(this.baseGoalR.pos);
    this.goalR.dir.copy(this.baseGoalR.dir);
    this.goalR.weight = this.baseGoalR.weight;
    this.goalL.weight = 0;

    const a = this.action;
    if (a) {
      a.time += dt * a.speed;
      const clip = a.clip;
      if (a.time >= clip.duration) {
        if (clip.loop) a.time %= clip.duration;
        else if (!a.hold) a.ending = true;
        else a.time = clip.duration;
      }
      const target = a.ending ? 0 : 1;
      const fade = a.ending ? clip.fadeOut : clip.fadeIn;
      a.weight = fade <= 0 ? target : clamp(a.weight + (target > a.weight ? 1 : -1) * (dt / fade), 0, 1);
      if (a.ending && a.weight <= 0) {
        this.action = null;
      } else {
        const t = Math.min(a.time, clip.duration);
        sampleFK(clip, t, this.actionPose);
        const w = a.weight;
        this.out.lerpPoses(this.base, this.actionPose, w);
        // Right hand IK
        if (clip.ikR) {
          sampleIK(clip.ikR, t, this.tmpPos, this.tmpDir);
          const iw = sampleWeight(clip.ikRWeight, t, 1);
          this.goalR.pos.lerp(this.tmpPos, w);
          slerpDir(this.goalR.dir, this.tmpDir, w, this.goalR.dir);
          this.goalR.weight = this.baseGoalR.weight + (iw - this.baseGoalR.weight) * w;
        } else {
          const iw = sampleWeight(clip.ikRWeight, t, 0);
          this.goalR.weight = this.baseGoalR.weight + (iw - this.baseGoalR.weight) * w;
        }
        if (clip.ikL) {
          sampleIK(clip.ikL, t, this.goalL.pos, this.goalL.dir);
          this.goalL.weight = sampleWeight(clip.ikLWeight, t, 1) * w;
        }
      }
    }

    // --- additive flinch ---------------------------------------------------------
    if (this.flinch > 0) {
      this.out.addScaled(this.flinchPose, this.flinch);
      this.flinch = Math.max(0, this.flinch - dt * 4);
    }

    // --- apply --------------------------------------------------------------------
    this.rig.applyPose(this.out);
    solveArm(this.rig, 'R', this.goalR);
    solveArm(this.rig, 'L', this.goalL);
  }

  /** Current right-hand goal (useful for debugging). */
  get handGoal(): HandGoal {
    return this.goalR;
  }
}
