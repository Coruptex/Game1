import * as THREE from 'three';
import { Pose, type PoseSpec } from './Pose';
import { Ease, type EaseName } from '../../utils/math';

/**
 * Action clips. Body joints are key-framed (FK); weapon hands are driven by IK keys
 * (hand position + blade direction in character space: +X = character's left, +Y up, +Z forward),
 * so sword arcs are authored directly and hit timing matches what the player sees.
 */
type V3 = [number, number, number];

export interface FKKey {
  t: number;
  pose: PoseSpec;
  ease?: EaseName;
}

export interface IKKey {
  t: number;
  pos: V3;
  dir: V3;
  ease?: EaseName;
}

export interface ClipDef {
  name: string;
  duration: number;
  fk: FKKey[];
  ikR?: IKKey[];
  ikL?: IKKey[];
  /** IK weight keys [time, weight] for each hand (default 1 when an IK track exists). */
  ikRWeight?: Array<[number, number]>;
  ikLWeight?: Array<[number, number]>;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

export interface CompiledClip {
  def: ClipDef;
  name: string;
  duration: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
  fkTimes: number[];
  fkPoses: Pose[];
  fkEase: Array<(t: number) => number>;
  ikR: CompiledIK | null;
  ikL: CompiledIK | null;
  ikRWeight: Array<[number, number]> | null;
  ikLWeight: Array<[number, number]> | null;
}

interface CompiledIK {
  times: number[];
  pos: THREE.Vector3[];
  dir: THREE.Vector3[];
  ease: Array<(t: number) => number>;
}

function compileIK(keys: IKKey[] | undefined): CompiledIK | null {
  if (!keys || keys.length === 0) return null;
  return {
    times: keys.map((k) => k.t),
    pos: keys.map((k) => new THREE.Vector3(...k.pos)),
    dir: keys.map((k) => new THREE.Vector3(...k.dir).normalize()),
    ease: keys.map((k) => Ease[k.ease ?? 'inOutQuad']),
  };
}

export function compileClip(def: ClipDef): CompiledClip {
  return {
    def,
    name: def.name,
    duration: def.duration,
    loop: !!def.loop,
    fadeIn: def.fadeIn ?? 0.07,
    fadeOut: def.fadeOut ?? 0.14,
    fkTimes: def.fk.map((k) => k.t),
    fkPoses: def.fk.map((k) => Pose.from(k.pose)),
    fkEase: def.fk.map((k) => Ease[k.ease ?? 'inOutQuad']),
    ikR: compileIK(def.ikR),
    ikL: compileIK(def.ikL),
    ikRWeight: def.ikRWeight ?? null,
    ikLWeight: def.ikLWeight ?? null,
  };
}

function findSegment(times: number[], t: number): [number, number] {
  if (t <= times[0]) return [0, 0];
  for (let i = 0; i < times.length - 1; i++) {
    if (t < times[i + 1]) return [i, (t - times[i]) / (times[i + 1] - times[i])];
  }
  return [times.length - 1, 0];
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** Spherical interpolation between unit vectors. */
export function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const d = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (d > 0.9995) return out.copy(a).lerp(b, t).normalize();
  _axis.crossVectors(a, b);
  if (_axis.lengthSq() < 1e-8) _axis.set(0, 1, 0);
  _axis.normalize();
  _q.setFromAxisAngle(_axis, Math.acos(d) * t);
  return out.copy(a).applyQuaternion(_q);
}

/** Catmull-Rom position along keyed IK points for smooth weapon arcs. */
function catmull(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const t2 = t * t;
  const t3 = t2 * t;
  out.set(0, 0, 0);
  out.addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t);
  out.addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1);
  out.addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t);
  out.addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
  return out;
}

export function sampleFK(clip: CompiledClip, time: number, out: Pose): Pose {
  const [i, f] = findSegment(clip.fkTimes, time);
  if (i >= clip.fkPoses.length - 1 || f === 0) return out.copy(clip.fkPoses[Math.min(i, clip.fkPoses.length - 1)]);
  return out.lerpPoses(clip.fkPoses[i], clip.fkPoses[i + 1], clip.fkEase[i + 1](f));
}

export function sampleIK(ik: CompiledIK, time: number, pos: THREE.Vector3, dir: THREE.Vector3): void {
  const [i, f] = findSegment(ik.times, time);
  const n = ik.pos.length;
  if (i >= n - 1 || f === 0) {
    const k = Math.min(i, n - 1);
    pos.copy(ik.pos[k]);
    dir.copy(ik.dir[k]);
    return;
  }
  const e = ik.ease[i + 1](f);
  catmull(ik.pos[Math.max(0, i - 1)], ik.pos[i], ik.pos[i + 1], ik.pos[Math.min(n - 1, i + 2)], e, pos);
  _a.copy(ik.dir[i]);
  _b.copy(ik.dir[i + 1]);
  slerpDir(_a, _b, e, dir);
}

export function sampleWeight(keys: Array<[number, number]> | null, time: number, fallback: number): number {
  if (!keys || keys.length === 0) return fallback;
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (time < keys[i + 1][0]) {
      const f = (time - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * Ease.smooth(f);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------------------
// Shared poses
// ---------------------------------------------------------------------------

/** Ready stance: left foot forward, sword held forward-up at the right hip. */
export const GUARD: PoseSpec = {
  bodyY: -0.04,
  hips: [0, 0.18, 0],
  spine: [0.06, -0.06, 0],
  chest: [0.05, -0.12, 0],
  head: [-0.04, 0.0, 0],
  upperArmL: [-0.15, 0, 0.32],
  forearmL: [-0.55, 0, 0],
  handL: [0, 0, 0.1],
  thighL: [-0.26, 0, 0.06],
  shinL: [0.32, 0, 0],
  footL: [-0.06, 0, 0],
  thighR: [0.18, 0, -0.08],
  shinR: [0.26, 0, 0],
  footR: [-0.16, 0, 0],
};

export const GUARD_HAND: { pos: V3; dir: V3 } = { pos: [-0.3, 1.02, 0.32], dir: [0.12, 0.62, 0.78] };

const g = (t: number, ease?: EaseName): IKKey => ({ t, pos: GUARD_HAND.pos, dir: GUARD_HAND.dir, ease });

const STANCE_WIDE: PoseSpec = {
  thighL: [-0.38, 0, 0.08],
  shinL: [0.42, 0, 0],
  footL: [-0.05, 0, 0],
  thighR: [0.3, 0, -0.1],
  shinR: [0.32, 0, 0],
  footR: [-0.25, 0, 0],
};

// ---------------------------------------------------------------------------
// Player attacks
// ---------------------------------------------------------------------------

export const PLAYER_LIGHT_1: ClipDef = {
  name: 'light1',
  duration: 0.64,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.15, pose: { ...STANCE_WIDE, bodyY: -0.07, hips: [0, -0.22, 0], spine: [0.06, -0.25, 0], chest: [0.06, -0.42, 0], head: [0, 0.48, 0], upperArmL: [-0.75, 0, 0.55], forearmL: [-0.55, 0, 0] }, ease: 'outQuad' },
    { t: 0.26, pose: { ...STANCE_WIDE, bodyY: -0.11, bodyZ: 0.06, hips: [0, 0.32, 0], spine: [0.12, 0.3, 0], chest: [0.12, 0.5, 0], head: [0, -0.62, 0], upperArmL: [0.35, 0, 0.45], forearmL: [-0.4, 0, 0] }, ease: 'outQuart' },
    { t: 0.38, pose: { ...STANCE_WIDE, bodyY: -0.1, bodyZ: 0.06, hips: [0, 0.38, 0], spine: [0.12, 0.36, 0], chest: [0.1, 0.62, 0], head: [0, -0.75, 0], upperArmL: [0.4, 0, 0.4], forearmL: [-0.45, 0, 0] }, ease: 'outQuad' },
    { t: 0.64, pose: GUARD, ease: 'inOutQuad' },
  ],
  ikR: [
    g(0),
    { t: 0.15, pos: [-0.62, 1.34, -0.1], dir: [-0.55, 0.25, -0.8], ease: 'outQuad' },
    { t: 0.21, pos: [-0.5, 1.26, 0.42], dir: [-0.7, 0.05, 0.7], ease: 'inQuad' },
    { t: 0.26, pos: [-0.02, 1.2, 0.72], dir: [0.3, 0.0, 0.95], ease: 'linear' },
    { t: 0.32, pos: [0.45, 1.15, 0.45], dir: [0.96, -0.08, -0.05], ease: 'outQuad' },
    { t: 0.42, pos: [0.42, 1.1, 0.28], dir: [0.7, -0.2, -0.6], ease: 'outQuad' },
    g(0.64),
  ],
};

export const PLAYER_LIGHT_2: ClipDef = {
  name: 'light2',
  duration: 0.68,
  fk: [
    { t: 0, pose: { ...STANCE_WIDE, bodyY: -0.1, hips: [0, 0.38, 0], spine: [0.12, 0.36, 0], chest: [0.1, 0.62, 0], head: [0, -0.75, 0] } },
    { t: 0.15, pose: { ...STANCE_WIDE, bodyY: -0.12, hips: [0, 0.42, 0], spine: [0.15, 0.4, 0], chest: [0.15, 0.6, 0], head: [0, -0.8, 0], upperArmL: [-0.2, 0, 0.6] }, ease: 'outQuad' },
    { t: 0.28, pose: { ...STANCE_WIDE, bodyY: -0.06, bodyZ: 0.08, hips: [0, -0.3, 0], spine: [0.0, -0.32, 0], chest: [-0.05, -0.5, 0], head: [0.05, 0.62, 0], upperArmL: [-0.5, 0, 0.7], forearmL: [-0.6, 0, 0] }, ease: 'outQuart' },
    { t: 0.4, pose: { ...STANCE_WIDE, bodyY: -0.05, bodyZ: 0.08, hips: [0, -0.34, 0], spine: [-0.02, -0.36, 0], chest: [-0.06, -0.58, 0], head: [0.05, 0.7, 0], upperArmL: [-0.4, 0, 0.6] }, ease: 'outQuad' },
    { t: 0.68, pose: GUARD },
  ],
  ikR: [
    { t: 0, pos: [0.42, 1.1, 0.28], dir: [0.7, -0.2, -0.6] },
    { t: 0.15, pos: [0.4, 0.98, 0.22], dir: [0.8, -0.4, -0.45], ease: 'outQuad' },
    { t: 0.22, pos: [0.02, 1.2, 0.4], dir: [0.4, 0.05, 0.92], ease: 'inQuad' },
    { t: 0.28, pos: [-0.3, 1.4, 0.38], dir: [-0.6, 0.35, 0.72], ease: 'linear' },
    { t: 0.34, pos: [-0.5, 1.52, 0.2], dir: [-0.9, 0.42, -0.1], ease: 'outQuad' },
    { t: 0.44, pos: [-0.5, 1.5, 0.12], dir: [-0.55, 0.6, -0.55], ease: 'outQuad' },
    g(0.68),
  ],
};

export const PLAYER_LIGHT_3: ClipDef = {
  name: 'light3',
  duration: 0.82,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.22, pose: { ...STANCE_WIDE, bodyY: -0.08, bodyZ: -0.1, hips: [0, -0.3, 0], spine: [-0.05, -0.3, 0], chest: [-0.05, -0.38, 0], head: [0, 0.6, 0], upperArmL: [-0.9, 0, 0.35], forearmL: [-0.9, 0, 0] }, ease: 'outQuad' },
    { t: 0.32, pose: { bodyY: -0.2, bodyZ: 0.22, hips: [0, 0.2, 0], spine: [0.28, 0.15, 0], chest: [0.12, 0.2, 0], head: [-0.3, -0.3, 0], upperArmL: [0.55, 0, 0.35], forearmL: [-0.35, 0, 0], thighL: [-0.85, 0, 0.06], shinL: [0.75, 0, 0], footL: [0.05, 0, 0], thighR: [0.55, 0, -0.08], shinR: [0.35, 0, 0], footR: [-0.3, 0, 0] }, ease: 'outQuart' },
    { t: 0.48, pose: { bodyY: -0.2, bodyZ: 0.2, hips: [0, 0.2, 0], spine: [0.26, 0.15, 0], chest: [0.12, 0.2, 0], head: [-0.28, -0.3, 0], upperArmL: [0.5, 0, 0.35], forearmL: [-0.4, 0, 0], thighL: [-0.85, 0, 0.06], shinL: [0.75, 0, 0], footL: [0.05, 0, 0], thighR: [0.55, 0, -0.08], shinR: [0.35, 0, 0], footR: [-0.3, 0, 0] } },
    { t: 0.82, pose: GUARD },
  ],
  ikR: [
    g(0),
    { t: 0.22, pos: [-0.36, 1.24, -0.22], dir: [0.05, 0.08, 1], ease: 'outQuad' },
    { t: 0.32, pos: [-0.12, 1.32, 1.02], dir: [0.06, 0.0, 1], ease: 'outQuart' },
    { t: 0.48, pos: [-0.12, 1.3, 0.98], dir: [0.06, -0.02, 1] },
    g(0.82),
  ],
};

export const PLAYER_HEAVY: ClipDef = {
  name: 'heavy',
  duration: 1.08,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.42, pose: { ...STANCE_WIDE, bodyY: -0.02, bodyZ: -0.06, hips: [0, -0.05, 0], spine: [-0.18, -0.05, 0], chest: [-0.2, -0.08, 0], neck: [0.1, 0, 0], head: [0.15, 0.05, 0] }, ease: 'outQuad' },
    { t: 0.5, pose: { ...STANCE_WIDE, bodyY: -0.04, bodyZ: -0.04, hips: [0, -0.05, 0], spine: [-0.2, -0.05, 0], chest: [-0.22, -0.08, 0], neck: [0.1, 0, 0], head: [0.15, 0.05, 0] } },
    { t: 0.62, pose: { bodyY: -0.26, bodyZ: 0.18, hips: [0.1, 0.05, 0], spine: [0.42, 0.04, 0], chest: [0.3, 0.02, 0], head: [-0.4, 0, 0], thighL: [-0.8, 0, 0.08], shinL: [0.9, 0, 0], footL: [-0.1, 0, 0], thighR: [0.45, 0, -0.1], shinR: [0.75, 0, 0], footR: [-0.3, 0, 0] }, ease: 'inQuart' },
    { t: 0.84, pose: { bodyY: -0.24, bodyZ: 0.16, hips: [0.1, 0.05, 0], spine: [0.38, 0.04, 0], chest: [0.28, 0.02, 0], head: [-0.38, 0, 0], thighL: [-0.8, 0, 0.08], shinL: [0.9, 0, 0], footL: [-0.1, 0, 0], thighR: [0.45, 0, -0.1], shinR: [0.75, 0, 0], footR: [-0.3, 0, 0] } },
    { t: 1.08, pose: GUARD },
  ],
  ikR: [
    g(0),
    { t: 0.42, pos: [-0.14, 2.02, -0.18], dir: [0.0, 0.6, -0.8], ease: 'outQuad' },
    { t: 0.5, pos: [-0.12, 2.06, -0.14], dir: [0.0, 0.66, -0.75] },
    { t: 0.56, pos: [-0.1, 1.7, 0.36], dir: [0.0, 0.92, 0.38], ease: 'inQuad' },
    { t: 0.6, pos: [-0.1, 1.2, 0.66], dir: [0.0, -0.25, 0.97], ease: 'linear' },
    { t: 0.65, pos: [-0.06, 0.72, 0.8], dir: [0.0, -0.72, 0.69], ease: 'outQuad' },
    { t: 0.84, pos: [-0.06, 0.74, 0.78], dir: [0.0, -0.7, 0.71] },
    g(1.08),
  ],
  ikL: [
    { t: 0, pos: [0.1, 0.95, 0.3], dir: [0, 0, 1] },
    { t: 0.42, pos: [-0.04, 1.96, -0.12], dir: [0.0, 0.6, -0.8], ease: 'outQuad' },
    { t: 0.5, pos: [-0.02, 2.0, -0.08], dir: [0.0, 0.66, -0.75] },
    { t: 0.56, pos: [-0.02, 1.66, 0.32], dir: [0.0, 0.92, 0.38], ease: 'inQuad' },
    { t: 0.6, pos: [-0.02, 1.14, 0.6], dir: [0.0, -0.25, 0.97], ease: 'linear' },
    { t: 0.65, pos: [0.02, 0.72, 0.72], dir: [0.0, -0.72, 0.69], ease: 'outQuad' },
    { t: 0.84, pos: [0.02, 0.74, 0.7], dir: [0.0, -0.7, 0.71] },
    { t: 1.08, pos: [0.1, 0.95, 0.3], dir: [0, 0, 1] },
  ],
  ikLWeight: [
    [0, 0],
    [0.3, 1],
    [0.86, 1],
    [1.05, 0],
  ],
};

// ---------------------------------------------------------------------------
// Movement / reactions
// ---------------------------------------------------------------------------

const TUCK = {
  thighL: [-1.75, 0, 0.1] as V3,
  shinL: [2.2, 0, 0] as V3,
  thighR: [-1.65, 0, -0.1] as V3,
  shinR: [2.1, 0, 0] as V3,
  spine: [0.55, 0, 0] as V3,
  chest: [0.45, 0, 0] as V3,
  neck: [0.3, 0, 0] as V3,
  head: [0.35, 0, 0] as V3,
  upperArmL: [-0.9, 0, 0.35] as V3,
  forearmL: [-1.7, 0, 0] as V3,
  upperArmR: [-0.9, 0, -0.35] as V3,
  forearmR: [-1.6, 0, 0] as V3,
};

export const DODGE_ROLL: ClipDef = {
  name: 'roll',
  duration: 0.66,
  fadeIn: 0.04,
  fadeOut: 0.12,
  fk: [
    { t: 0, pose: { bodyY: -0.12, spine: [0.3, 0, 0], thighL: [-0.5, 0, 0], shinL: [0.6, 0, 0], thighR: [-0.2, 0, 0], shinR: [0.5, 0, 0] } },
    { t: 0.06, pose: { ...TUCK, bodyY: -0.34, body: [0.45, 0, 0] }, ease: 'outQuad' },
    { t: 0.2, pose: { ...TUCK, bodyY: -0.42, body: [2.25, 0, 0] }, ease: 'linear' },
    { t: 0.34, pose: { ...TUCK, bodyY: -0.42, body: [4.1, 0, 0] }, ease: 'linear' },
    { t: 0.46, pose: { ...TUCK, bodyY: -0.34, body: [5.75, 0, 0] }, ease: 'linear' },
    { t: 0.56, pose: { bodyY: -0.2, body: [6.283, 0, 0], spine: [0.35, 0, 0], thighL: [-0.7, 0, 0.05], shinL: [0.9, 0, 0], thighR: [-0.1, 0, -0.05], shinR: [0.8, 0, 0] }, ease: 'outQuad' },
    { t: 0.66, pose: { ...GUARD, body: [6.283, 0, 0] } },
  ],
  ikR: [g(0), g(0.66)],
  ikRWeight: [
    [0, 1],
    [0.06, 0],
    [0.52, 0],
    [0.66, 1],
  ],
};

export const BACKSTEP: ClipDef = {
  name: 'backstep',
  duration: 0.46,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.08, pose: { ...GUARD, bodyY: -0.12, spine: [0.15, 0, 0], thighL: [-0.4, 0, 0.06], shinL: [0.6, 0, 0], thighR: [-0.2, 0, -0.06], shinR: [0.5, 0, 0] } },
    { t: 0.2, pose: { ...GUARD, bodyY: 0.04, spine: [0.2, 0, 0], thighL: [0.2, 0, 0.06], shinL: [0.4, 0, 0], thighR: [0.4, 0, -0.06], shinR: [0.6, 0, 0] } },
    { t: 0.32, pose: { ...GUARD, bodyY: -0.14, spine: [0.2, 0, 0], thighL: [-0.35, 0, 0.06], shinL: [0.7, 0, 0], thighR: [0.1, 0, -0.06], shinR: [0.7, 0, 0] } },
    { t: 0.46, pose: GUARD },
  ],
  ikR: [g(0), { t: 0.2, pos: [-0.32, 1.1, 0.4], dir: [0.1, 0.5, 0.86] }, g(0.46)],
};

export const HIT_REACT: ClipDef = {
  name: 'hit',
  duration: 0.5,
  fadeIn: 0.03,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.07, pose: { bodyY: -0.1, bodyZ: -0.08, spine: [-0.35, 0.2, 0.05], chest: [-0.28, 0.15, 0], neck: [-0.2, 0, 0], head: [-0.3, 0.1, 0], upperArmL: [-0.5, 0, 0.95], forearmL: [-0.9, 0, 0], thighL: [-0.1, 0, 0.1], shinL: [0.4, 0, 0], thighR: [0.35, 0, -0.1], shinR: [0.5, 0, 0] }, ease: 'outQuart' },
    { t: 0.26, pose: { bodyY: -0.12, bodyZ: -0.05, spine: [-0.1, 0.1, 0], chest: [-0.1, 0.05, 0], head: [-0.1, 0, 0], upperArmL: [-0.3, 0, 0.6], forearmL: [-0.7, 0, 0], thighL: [-0.2, 0, 0.1], shinL: [0.45, 0, 0], thighR: [0.3, 0, -0.1], shinR: [0.5, 0, 0] } },
    { t: 0.5, pose: GUARD },
  ],
  ikR: [g(0), { t: 0.07, pos: [-0.45, 1.25, 0.05], dir: [-0.3, 0.8, 0.4] }, g(0.5)],
  ikRWeight: [
    [0, 1],
    [0.07, 0.7],
    [0.5, 1],
  ],
};

export const DEATH: ClipDef = {
  name: 'death',
  duration: 1.7,
  fadeIn: 0.05,
  fadeOut: 0.0,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.12, pose: { bodyY: -0.1, bodyZ: -0.05, spine: [-0.4, 0.1, 0], chest: [-0.3, 0.1, 0], head: [-0.4, 0, 0], upperArmL: [-0.4, 0, 1.0], forearmL: [-0.6, 0, 0], upperArmR: [-0.3, 0, -0.9], forearmR: [-0.5, 0, 0], thighL: [-0.2, 0, 0.1], shinL: [0.4, 0, 0], thighR: [0.2, 0, -0.1], shinR: [0.5, 0, 0] }, ease: 'outQuart' },
    { t: 0.6, pose: { bodyY: -0.52, bodyZ: 0.05, spine: [0.35, 0, 0.05], chest: [0.3, 0, 0], head: [0.5, 0, 0.1], upperArmL: [0.1, 0, 0.3], forearmL: [-0.3, 0, 0], upperArmR: [0.1, 0, -0.3], forearmR: [-0.3, 0, 0], thighL: [-1.45, 0, 0.12], shinL: [2.35, 0, 0], footL: [0.6, 0, 0], thighR: [-1.4, 0, -0.12], shinR: [2.35, 0, 0], footR: [0.6, 0, 0] }, ease: 'inOutQuad' },
    { t: 0.85, pose: { bodyY: -0.55, bodyZ: 0.08, spine: [0.45, 0, 0.05], chest: [0.35, 0, 0], head: [0.55, 0, 0.1], upperArmL: [0.1, 0, 0.3], forearmL: [-0.3, 0, 0], upperArmR: [0.1, 0, -0.3], forearmR: [-0.3, 0, 0], thighL: [-1.45, 0, 0.12], shinL: [2.35, 0, 0], footL: [0.6, 0, 0], thighR: [-1.4, 0, -0.12], shinR: [2.35, 0, 0], footR: [0.6, 0, 0] } },
    { t: 1.3, pose: { body: [1.45, 0, 0.15], bodyY: -0.78, bodyZ: 0.25, spine: [0.1, 0, 0.1], chest: [0.05, 0.2, 0], head: [-0.2, 0.6, 0], upperArmL: [-1.4, 0, 0.6], forearmL: [-0.2, 0, 0], upperArmR: [-1.2, 0, -0.5], forearmR: [-0.4, 0, 0], thighL: [-0.4, 0, 0.12], shinL: [0.9, 0, 0], footL: [0.3, 0, 0], thighR: [-0.1, 0, -0.12], shinR: [0.5, 0, 0], footR: [0.3, 0, 0] }, ease: 'inQuad' },
    { t: 1.7, pose: { body: [1.5, 0, 0.15], bodyY: -0.8, bodyZ: 0.25, spine: [0.08, 0, 0.1], chest: [0.05, 0.2, 0], head: [-0.25, 0.6, 0], upperArmL: [-1.45, 0, 0.62], forearmL: [-0.15, 0, 0], upperArmR: [-1.25, 0, -0.5], forearmR: [-0.35, 0, 0], thighL: [-0.35, 0, 0.12], shinL: [0.85, 0, 0], footL: [0.3, 0, 0], thighR: [-0.08, 0, -0.12], shinR: [0.45, 0, 0], footR: [0.3, 0, 0] }, ease: 'outQuad' },
  ],
  ikRWeight: [[0, 0]],
};

export const INTERACT: ClipDef = {
  name: 'interact',
  duration: 1.0,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.3, pose: { bodyY: -0.38, spine: [0.5, 0, 0], chest: [0.3, 0, 0], head: [0.1, 0, 0], upperArmL: [-1.0, 0, 0.15], forearmL: [-0.5, 0, 0], thighL: [-1.1, 0, 0.1], shinL: [1.6, 0, 0], footL: [-0.4, 0, 0], thighR: [-0.35, 0, -0.1], shinR: [1.3, 0, 0], footR: [-0.7, 0, 0] } },
    { t: 0.55, pose: { bodyY: -0.38, spine: [0.45, 0, 0], chest: [0.15, 0, 0], head: [-0.1, 0, 0], upperArmL: [-1.5, 0, 0.15], forearmL: [-0.6, 0, 0], thighL: [-1.1, 0, 0.1], shinL: [1.6, 0, 0], footL: [-0.4, 0, 0], thighR: [-0.35, 0, -0.1], shinR: [1.3, 0, 0], footR: [-0.7, 0, 0] } },
    { t: 1.0, pose: GUARD },
  ],
  ikR: [g(0), { t: 0.3, pos: [-0.35, 0.65, 0.35], dir: [0.1, 0.1, 1] }, { t: 0.55, pos: [-0.3, 0.75, 0.4], dir: [0.1, 0.2, 1] }, g(1.0)],
};

export const REST: ClipDef = {
  name: 'rest',
  duration: 2.2,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.5, pose: { bodyY: -0.48, spine: [0.25, 0, 0], chest: [0.2, 0, 0], neck: [0.2, 0, 0], head: [0.35, 0, 0], upperArmL: [-0.6, 0, 0.1], forearmL: [-0.9, 0, 0], thighL: [-1.35, 0, 0.08], shinL: [1.45, 0, 0], footL: [-0.1, 0, 0], thighR: [0.1, 0, -0.08], shinR: [1.9, 0, 0], footR: [0.4, 0, 0] } },
    { t: 1.6, pose: { bodyY: -0.48, spine: [0.22, 0, 0], chest: [0.2, 0, 0], neck: [0.25, 0, 0], head: [0.4, 0, 0], upperArmL: [-0.6, 0, 0.1], forearmL: [-0.9, 0, 0], thighL: [-1.35, 0, 0.08], shinL: [1.45, 0, 0], footL: [-0.1, 0, 0], thighR: [0.1, 0, -0.08], shinR: [1.9, 0, 0], footR: [0.4, 0, 0] } },
    { t: 2.2, pose: GUARD },
  ],
  ikR: [g(0), { t: 0.5, pos: [-0.25, 0.55, 0.42], dir: [0.0, -0.95, 0.3] }, { t: 1.6, pos: [-0.25, 0.55, 0.42], dir: [0.0, -0.95, 0.3] }, g(2.2)],
};

/** Getting up after respawn (starts kneeling). */
export const RISE: ClipDef = {
  name: 'rise',
  duration: 1.4,
  fk: [
    { t: 0, pose: REST.fk[2].pose },
    { t: 0.8, pose: REST.fk[2].pose },
    { t: 1.4, pose: GUARD },
  ],
  ikR: [{ t: 0, pos: [-0.25, 0.55, 0.42], dir: [0.0, -0.95, 0.3] }, { t: 0.8, pos: [-0.25, 0.55, 0.42], dir: [0.0, -0.95, 0.3] }, g(1.4)],
};

// ---------------------------------------------------------------------------
// Enemy (pirate swordsman) attacks — longer, readable wind-ups
// ---------------------------------------------------------------------------

export const ENEMY_SLASH: ClipDef = {
  name: 'enemySlash',
  duration: 1.3,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.55, pose: { ...STANCE_WIDE, bodyY: -0.04, bodyZ: -0.08, hips: [0, -0.3, 0], spine: [-0.12, -0.3, 0], chest: [-0.15, -0.35, 0], head: [0.1, 0.5, 0], upperArmL: [-0.8, 0, 0.6], forearmL: [-0.6, 0, 0] }, ease: 'outQuad' },
    { t: 0.66, pose: { ...STANCE_WIDE, bodyY: -0.16, bodyZ: 0.14, hips: [0, 0.3, 0], spine: [0.3, 0.3, 0], chest: [0.2, 0.4, 0], head: [-0.3, -0.55, 0], upperArmL: [0.3, 0, 0.5], forearmL: [-0.4, 0, 0] }, ease: 'inQuart' },
    { t: 0.9, pose: { ...STANCE_WIDE, bodyY: -0.16, bodyZ: 0.14, hips: [0, 0.32, 0], spine: [0.3, 0.32, 0], chest: [0.2, 0.42, 0], head: [-0.3, -0.6, 0], upperArmL: [0.3, 0, 0.5], forearmL: [-0.4, 0, 0] } },
    { t: 1.3, pose: GUARD },
  ],
  ikR: [
    g(0),
    { t: 0.55, pos: [-0.44, 1.86, -0.16], dir: [-0.35, 0.75, -0.55], ease: 'outQuad' },
    { t: 0.62, pos: [-0.3, 1.62, 0.3], dir: [-0.2, 0.75, 0.62], ease: 'inQuad' },
    { t: 0.68, pos: [0.08, 1.0, 0.75], dir: [0.45, -0.45, 0.77], ease: 'linear' },
    { t: 0.76, pos: [0.31, 0.87, 0.45], dir: [0.75, -0.55, -0.35], ease: 'outQuad' },
    { t: 0.9, pos: [0.32, 0.87, 0.43], dir: [0.72, -0.55, -0.4] },
    g(1.3),
  ],
};

export const ENEMY_LUNGE: ClipDef = {
  name: 'enemyLunge',
  duration: 1.4,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.6, pose: { ...STANCE_WIDE, bodyY: -0.14, bodyZ: -0.14, hips: [0, -0.35, 0], spine: [-0.05, -0.32, 0], chest: [-0.05, -0.4, 0], head: [0, 0.65, 0], upperArmL: [-1.0, 0, 0.45], forearmL: [-0.9, 0, 0] }, ease: 'outQuad' },
    { t: 0.72, pose: { bodyY: -0.24, bodyZ: 0.3, hips: [0, 0.25, 0], spine: [0.32, 0.2, 0], chest: [0.15, 0.2, 0], head: [-0.35, -0.35, 0], upperArmL: [0.6, 0, 0.4], forearmL: [-0.3, 0, 0], thighL: [-0.95, 0, 0.06], shinL: [0.85, 0, 0], footL: [0.05, 0, 0], thighR: [0.6, 0, -0.08], shinR: [0.4, 0, 0], footR: [-0.3, 0, 0] }, ease: 'outQuart' },
    { t: 1.0, pose: { bodyY: -0.24, bodyZ: 0.28, hips: [0, 0.25, 0], spine: [0.3, 0.2, 0], chest: [0.15, 0.2, 0], head: [-0.32, -0.35, 0], upperArmL: [0.55, 0, 0.4], forearmL: [-0.35, 0, 0], thighL: [-0.95, 0, 0.06], shinL: [0.85, 0, 0], footL: [0.05, 0, 0], thighR: [0.6, 0, -0.08], shinR: [0.4, 0, 0], footR: [-0.3, 0, 0] } },
    { t: 1.4, pose: GUARD },
  ],
  ikR: [
    g(0),
    { t: 0.6, pos: [-0.4, 1.28, -0.3], dir: [0.05, 0.12, 1], ease: 'outQuad' },
    { t: 0.72, pos: [-0.1, 1.3, 1.08], dir: [0.06, -0.02, 1], ease: 'outQuart' },
    { t: 1.0, pos: [-0.1, 1.28, 1.02], dir: [0.06, -0.04, 1] },
    g(1.4),
  ],
};

export const ENEMY_COMBO: ClipDef = {
  name: 'enemyCombo',
  duration: 1.55,
  fk: [
    { t: 0, pose: GUARD },
    ...PLAYER_LIGHT_1.fk.slice(1, 4).map((k) => ({ ...k, t: k.t * 1.3 + 0.18 })),
    ...PLAYER_LIGHT_2.fk.slice(1, 4).map((k) => ({ ...k, t: k.t * 1.25 + 0.68 })),
    { t: 1.55, pose: GUARD },
  ],
  ikR: [
    g(0),
    ...PLAYER_LIGHT_1.ikR!.slice(1, 6).map((k) => ({ ...k, t: k.t * 1.3 + 0.18 })),
    ...PLAYER_LIGHT_2.ikR!.slice(1, 6).map((k) => ({ ...k, t: k.t * 1.25 + 0.68 })),
    g(1.55),
  ],
};

export const ENEMY_ALERT: ClipDef = {
  name: 'alert',
  duration: 0.7,
  fk: [
    { t: 0, pose: GUARD },
    { t: 0.2, pose: { ...STANCE_WIDE, bodyY: -0.06, spine: [-0.15, 0, 0], chest: [-0.2, 0, 0], head: [-0.25, 0, 0], upperArmL: [-0.4, 0, 1.0], forearmL: [-0.8, 0, 0] }, ease: 'outQuad' },
    { t: 0.45, pose: { ...STANCE_WIDE, bodyY: -0.06, spine: [-0.12, 0, 0], chest: [-0.18, 0, 0], head: [-0.2, 0, 0], upperArmL: [-0.35, 0, 0.95], forearmL: [-0.8, 0, 0] } },
    { t: 0.7, pose: GUARD },
  ],
  ikR: [g(0), { t: 0.2, pos: [-0.45, 1.75, 0.2], dir: [-0.2, 0.95, 0.2] }, { t: 0.45, pos: [-0.45, 1.72, 0.2], dir: [-0.2, 0.95, 0.2] }, g(0.7)],
};

export const ALL_CLIPS = {
  light1: compileClip(PLAYER_LIGHT_1),
  light2: compileClip(PLAYER_LIGHT_2),
  light3: compileClip(PLAYER_LIGHT_3),
  heavy: compileClip(PLAYER_HEAVY),
  roll: compileClip(DODGE_ROLL),
  backstep: compileClip(BACKSTEP),
  hit: compileClip(HIT_REACT),
  death: compileClip(DEATH),
  interact: compileClip(INTERACT),
  rest: compileClip(REST),
  rise: compileClip(RISE),
  enemySlash: compileClip(ENEMY_SLASH),
  enemyLunge: compileClip(ENEMY_LUNGE),
  enemyCombo: compileClip(ENEMY_COMBO),
  alert: compileClip(ENEMY_ALERT),
};

export type ClipName = keyof typeof ALL_CLIPS;
