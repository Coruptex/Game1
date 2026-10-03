import type { ClipName } from '../characters/animation/Clips';

/**
 * Data-driven attack definitions. Timings are in clip seconds. New weapons / enemies add entries
 * here instead of new code.
 */
export interface AttackDef {
  id: string;
  clip: ClipName;
  /** Animation playback speed. */
  speed?: number;
  staminaCost: number;
  damage: number;
  poiseDamage: number;
  /** Hit windows [start, end] in clip time; each window can hit a target once. */
  windows: Array<[number, number]>;
  /** Clip time after which a buffered follow-up attack may start. */
  comboTime: number;
  /** Clip time after which a dodge may cancel the recovery. */
  dodgeCancelTime: number;
  /** Clip time at which the attack is fully over (returns to locomotion). */
  endTime: number;
  /** Reach from the attacker's centre (m) and total arc (rad). */
  range: number;
  arc: number;
  knockback: number;
  /** Forward root motion: [start, end, speed m/s] segments in clip time. */
  lunge?: Array<[number, number, number]>;
  /** Max turn speed (rad/s) towards the target / input before `trackUntil`. */
  tracking: number;
  trackUntil: number;
  heavy?: boolean;
  next?: string;
  hitStop: number;
  /** Clip time of the enemy wind-up glint (readability). */
  telegraphAt?: number;
}

export const ATTACKS: Record<string, AttackDef> = {
  // --- player cutlass -------------------------------------------------------------
  light1: {
    id: 'light1',
    clip: 'light1',
    staminaCost: 15,
    damage: 22,
    poiseDamage: 14,
    windows: [[0.17, 0.31]],
    comboTime: 0.38,
    dodgeCancelTime: 0.34,
    endTime: 0.58,
    range: 2.35,
    arc: 2.7,
    knockback: 1.6,
    lunge: [[0.12, 0.27, 3.0]],
    tracking: 11,
    trackUntil: 0.16,
    next: 'light2',
    hitStop: 0.075,
  },
  light2: {
    id: 'light2',
    clip: 'light2',
    staminaCost: 15,
    damage: 24,
    poiseDamage: 14,
    windows: [[0.19, 0.34]],
    comboTime: 0.42,
    dodgeCancelTime: 0.36,
    endTime: 0.62,
    range: 2.35,
    arc: 2.7,
    knockback: 1.8,
    lunge: [[0.13, 0.29, 2.8]],
    tracking: 11,
    trackUntil: 0.18,
    next: 'light3',
    hitStop: 0.075,
  },
  light3: {
    id: 'light3',
    clip: 'light3',
    staminaCost: 19,
    damage: 31,
    poiseDamage: 24,
    windows: [[0.27, 0.42]],
    comboTime: 0.58,
    dodgeCancelTime: 0.5,
    endTime: 0.76,
    range: 2.9,
    arc: 1.2,
    knockback: 3.2,
    lunge: [[0.24, 0.38, 6.2]],
    tracking: 9,
    trackUntil: 0.24,
    next: 'light1',
    hitStop: 0.09,
  },
  heavy: {
    id: 'heavy',
    clip: 'heavy',
    staminaCost: 32,
    damage: 54,
    poiseDamage: 48,
    windows: [[0.57, 0.69]],
    comboTime: 0.86,
    dodgeCancelTime: 0.8,
    endTime: 1.0,
    range: 2.7,
    arc: 1.5,
    knockback: 4.6,
    lunge: [[0.5, 0.64, 3.6]],
    tracking: 6,
    trackUntil: 0.52,
    heavy: true,
    hitStop: 0.13,
  },

  // --- pirate swordsman -------------------------------------------------------------
  enemySlash: {
    id: 'enemySlash',
    clip: 'enemySlash',
    staminaCost: 0,
    damage: 19,
    poiseDamage: 30,
    windows: [[0.63, 0.75]],
    comboTime: 99,
    dodgeCancelTime: 99,
    endTime: 1.28,
    range: 2.35,
    arc: 2.2,
    knockback: 3.2,
    lunge: [[0.58, 0.7, 3.2]],
    tracking: 4.2,
    trackUntil: 0.52,
    hitStop: 0.08,
    telegraphAt: 0.4,
  },
  enemyLunge: {
    id: 'enemyLunge',
    clip: 'enemyLunge',
    staminaCost: 0,
    damage: 23,
    poiseDamage: 34,
    windows: [[0.66, 0.8]],
    comboTime: 99,
    dodgeCancelTime: 99,
    endTime: 1.38,
    range: 2.9,
    arc: 1.0,
    knockback: 3.6,
    lunge: [[0.62, 0.76, 7.4]],
    tracking: 3.5,
    trackUntil: 0.56,
    hitStop: 0.08,
    telegraphAt: 0.44,
  },
  enemyCombo: {
    id: 'enemyCombo',
    clip: 'enemyCombo',
    staminaCost: 0,
    damage: 14,
    poiseDamage: 18,
    windows: [
      [0.38, 0.52],
      [0.92, 1.08],
    ],
    comboTime: 99,
    dodgeCancelTime: 99,
    endTime: 1.52,
    range: 2.3,
    arc: 2.5,
    knockback: 2.0,
    lunge: [
      [0.32, 0.48, 2.6],
      [0.86, 1.02, 2.6],
    ],
    tracking: 5,
    trackUntil: 0.86,
    hitStop: 0.06,
    telegraphAt: 0.2,
  },
};
