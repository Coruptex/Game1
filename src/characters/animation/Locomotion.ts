import * as THREE from 'three';
import type { Pose } from './Pose';
import type { HandGoal } from './ArmIK';
import { GUARD_HAND } from './Clips';
import { clamp, smoothstep } from '../../utils/math';

export interface LocomotionInput {
  /** Horizontal speed (m/s). */
  speed: number;
  /** Movement direction in character space (x = left, z = forward), normalised. */
  dirX: number;
  dirZ: number;
  /** Gait phase in radians (advanced by the owner). */
  phase: number;
  /** Time for idle motion. */
  time: number;
  /** Personality: 0 = upright hero, 1 = hunched brawler. */
  hunch: number;
  /** Turn rate (rad/s) for leaning into turns. */
  turnRate: number;
}

const TRAIL_DIR = new THREE.Vector3(-0.25, -0.45, -0.86).normalize();

/** Stride length (m per step) as a function of speed. */
export function strideLength(speed: number): number {
  return 0.62 + clamp((speed - 1.5) / 6, 0, 1) * 0.75;
}

/**
 * Procedural locomotion: idle breathing, walk, run and sprint cycles with directional
 * (strafe / backpedal) leg swing. Also produces the sword-hand IK goal so the weapon is held
 * convincingly at every speed.
 */
export function computeLocomotion(i: LocomotionInput, out: Pose, goalR: HandGoal): void {
  out.reset();
  const walk = clamp(i.speed / 2.0, 0, 1);
  const run = smoothstep(2.6, 5.2, i.speed);
  const sprint = smoothstep(5.6, 7.4, i.speed);
  const moving = smoothstep(0.15, 0.9, i.speed);
  const s = Math.sin(i.phase);
  const c = Math.cos(i.phase);
  const t = i.time;

  // ---- idle stance ---------------------------------------------------------------
  const idle = 1 - moving;
  const breathe = Math.sin(t * 1.7);
  out.bodyY = -0.035 * idle + breathe * 0.006 * idle;
  out.set('hips', 0, 0.16 * idle, 0);
  out.set('spine', 0.05 + 0.08 * i.hunch, -0.06 * idle, 0);
  out.set('chest', 0.03 + breathe * 0.02 + 0.1 * i.hunch, -0.1 * idle, 0);
  out.set('neck', -0.05 * i.hunch, 0, 0);
  out.set('head', -0.05 * i.hunch + Math.sin(t * 0.5) * 0.03 * idle, Math.sin(t * 0.37) * 0.12 * idle, 0);
  out.set('thighL', -0.22 * idle, 0, 0.07 * idle);
  out.set('shinL', 0.26 * idle, 0, 0);
  out.set('footL', -0.04 * idle, 0, 0);
  out.set('thighR', 0.14 * idle, 0, -0.08 * idle);
  out.set('shinR', 0.22 * idle, 0, 0);
  out.set('footR', -0.12 * idle, 0, 0);
  out.set('upperArmL', -0.1 * idle + breathe * 0.02, 0, 0.26 * idle + 0.08);
  out.set('forearmL', -0.45 * idle, 0, 0);

  if (moving > 0) {
    // ---- gait ----------------------------------------------------------------------
    const legAmp = 0.42 * walk + 0.3 * run + 0.18 * sprint;
    const kneeAmp = 0.55 * walk + 0.75 * run + 0.25 * sprint;
    const sL = s * legAmp;
    const sR = -s * legAmp;
    const dz = i.dirZ;
    const dx = i.dirX;
    // swing in the movement direction (forward = -X rotation, left = +Z rotation)
    out.add('thighL', -sL * dz * moving, 0, sL * dx * moving * 0.8);
    out.add('thighR', -sR * dz * moving, 0, sR * dx * moving * 0.8);
    const liftL = Math.max(0, c);
    const liftR = Math.max(0, -c);
    out.add('shinL', (0.12 + kneeAmp * liftL * (0.6 + 0.4 * liftL)) * moving, 0, 0);
    out.add('shinR', (0.12 + kneeAmp * liftR * (0.6 + 0.4 * liftR)) * moving, 0, 0);
    out.add('footL', (-0.25 * liftL * walk + 0.15 * sL) * moving, 0, 0);
    out.add('footR', (-0.25 * liftR * walk + 0.15 * sR) * moving, 0, 0);

    // bob (two per cycle), forward lean, hip sway
    const bob = 0.035 * walk + 0.05 * run;
    out.bodyY += (-0.02 * walk - 0.06 * run - 0.03 * sprint - Math.abs(c) * bob + bob * 0.5) * moving;
    const lean = 0.08 * walk + 0.12 * run + 0.14 * sprint;
    out.add('spine', lean * moving * Math.max(0.2, dz), 0, -dx * 0.12 * run * moving);
    out.add('hips', 0, 0.14 * s * (walk + run * 0.5) * dz * moving, -i.turnRate * 0.02 * run);
    out.add('spine', 0, -0.07 * s * moving, i.turnRate * 0.03 * run);
    out.add('chest', 0.04 * run * moving, -0.1 * s * moving, 0);
    out.add('head', -lean * 0.6 * moving, 0.1 * s * moving, 0);

    // left arm swings opposite to the left leg
    const armAmp = 0.35 * walk + 0.45 * run + 0.25 * sprint;
    out.add('upperArmL', sL * armAmp * 1.1 * moving, 0, 0.05 * run);
    out.add('forearmL', (-0.35 - 0.7 * run - 0.2 * sprint) * moving, 0, 0);
  }

  // ---- sword hand (IK) ------------------------------------------------------------------
  // Guard at idle/walk; lowered and trailing behind while running/sprinting.
  const trail = run;
  const bobY = out.bodyY;
  const gx = GUARD_HAND.pos[0];
  const gy = GUARD_HAND.pos[1];
  const gz = GUARD_HAND.pos[2];
  goalR.pos.set(
    gx + (-0.06) * trail + s * 0.04 * moving,
    gy + bobY + 0.04 * Math.sin(t * 1.7) * idle - 0.1 * trail,
    gz - 0.32 * trail + s * 0.1 * walk * (1 - trail),
  );
  goalR.dir.set(GUARD_HAND.dir[0], GUARD_HAND.dir[1], GUARD_HAND.dir[2]);
  goalR.dir.normalize().lerp(TRAIL_DIR, trail * 0.9).normalize();
  goalR.weight = 1;
}
