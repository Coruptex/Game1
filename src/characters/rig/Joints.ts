/**
 * Humanoid joint set shared by every humanoid character (pirates now; skeletons, island warriors,
 * captains later). Bones are rotated by the animator; meshes are rigidly skinned to one bone each.
 *
 * Rotation conventions (radians, Euler XYZ in the bone's local frame, character faces +Z):
 * - Limbs hanging down (arms, legs): +X swings the limb BACKWARD, -X swings it FORWARD.
 *   +Z moves the limb towards the character's LEFT (+X side), -Z towards its right.
 * - Upward segments (spine, chest, neck, head): +X leans FORWARD, -X leans back.
 * - Y twists: +Y turns towards the character's left.
 * The character's left side is +X, right side is -X.
 */
export const JOINTS = [
  'body',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'upperArmL',
  'forearmL',
  'handL',
  'upperArmR',
  'forearmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const;

export type JointName = (typeof JOINTS)[number];
export const JOINT_COUNT = JOINTS.length;
export const JOINT_INDEX: Record<JointName, number> = Object.fromEntries(JOINTS.map((j, i) => [j, i])) as Record<JointName, number>;

export const JOINT_PARENT: Record<JointName, JointName | null> = {
  body: null,
  hips: 'body',
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest',
  forearmL: 'upperArmL',
  handL: 'forearmL',
  upperArmR: 'chest',
  forearmR: 'upperArmR',
  handR: 'forearmR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
};

/** Body proportions in metres (bind pose offsets of each joint relative to its parent). */
export interface Proportions {
  hipHeight: number;
  spine: number;
  chest: number;
  neck: number;
  shoulderWidth: number;
  shoulderHeight: number;
  upperArm: number;
  forearm: number;
  hipWidth: number;
  thigh: number;
  shin: number;
  headSize: number;
  /** Overall girth multiplier for torso pieces. */
  girth: number;
}

export const DEFAULT_PROPORTIONS: Proportions = {
  hipHeight: 0.98,
  spine: 0.12,
  chest: 0.25,
  neck: 0.25,
  shoulderWidth: 0.23,
  shoulderHeight: 0.18,
  upperArm: 0.29,
  forearm: 0.27,
  hipWidth: 0.11,
  thigh: 0.45,
  shin: 0.44,
  headSize: 0.2,
  girth: 1,
};

/** Bind-pose local offset of each joint. */
export function jointOffsets(p: Proportions): Record<JointName, [number, number, number]> {
  return {
    body: [0, p.hipHeight, 0],
    hips: [0, 0, 0],
    spine: [0, p.spine, 0],
    chest: [0, p.chest, 0],
    neck: [0, p.neck, 0],
    head: [0, 0.07, 0],
    upperArmL: [p.shoulderWidth, p.shoulderHeight, 0],
    forearmL: [0, -p.upperArm, 0],
    handL: [0, -p.forearm, 0],
    upperArmR: [-p.shoulderWidth, p.shoulderHeight, 0],
    forearmR: [0, -p.upperArm, 0],
    handR: [0, -p.forearm, 0],
    thighL: [p.hipWidth, -0.03, 0],
    shinL: [0, -p.thigh, 0],
    footL: [0, -p.shin, 0],
    thighR: [-p.hipWidth, -0.03, 0],
    shinR: [0, -p.thigh, 0],
    footR: [0, -p.shin, 0],
  };
}
