import { JOINT_COUNT, JOINT_INDEX, type JointName } from '../rig/Joints';
import { wrapAngle } from '../../utils/math';

/** Sparse pose description used when authoring clips. */
export type PoseSpec = Partial<Record<JointName, [number, number, number]>> & {
  /** Body (pelvis) offsets in metres relative to the bind pose. */
  bodyX?: number;
  bodyY?: number;
  bodyZ?: number;
};

/**
 * Dense pose: Euler rotations for every joint + body translation offsets.
 * Blending uses shortest-path angle interpolation per component.
 */
export class Pose {
  readonly rot = new Float32Array(JOINT_COUNT * 3);
  bodyX = 0;
  bodyY = 0;
  bodyZ = 0;

  static from(spec: PoseSpec): Pose {
    const p = new Pose();
    p.setSpec(spec);
    return p;
  }

  reset(): this {
    this.rot.fill(0);
    this.bodyX = 0;
    this.bodyY = 0;
    this.bodyZ = 0;
    return this;
  }

  setSpec(spec: PoseSpec): this {
    this.reset();
    for (const key in spec) {
      if (key === 'bodyX' || key === 'bodyY' || key === 'bodyZ') continue;
      const v = spec[key as JointName];
      if (!v) continue;
      const i = JOINT_INDEX[key as JointName] * 3;
      this.rot[i] = v[0];
      this.rot[i + 1] = v[1];
      this.rot[i + 2] = v[2];
    }
    this.bodyX = spec.bodyX ?? 0;
    this.bodyY = spec.bodyY ?? 0;
    this.bodyZ = spec.bodyZ ?? 0;
    return this;
  }

  copy(o: Pose): this {
    this.rot.set(o.rot);
    this.bodyX = o.bodyX;
    this.bodyY = o.bodyY;
    this.bodyZ = o.bodyZ;
    return this;
  }

  set(j: JointName, x: number, y: number, z: number): this {
    const i = JOINT_INDEX[j] * 3;
    this.rot[i] = x;
    this.rot[i + 1] = y;
    this.rot[i + 2] = z;
    return this;
  }

  add(j: JointName, x: number, y: number, z: number): this {
    const i = JOINT_INDEX[j] * 3;
    this.rot[i] += x;
    this.rot[i + 1] += y;
    this.rot[i + 2] += z;
    return this;
  }

  get(j: JointName, axis: 0 | 1 | 2): number {
    return this.rot[JOINT_INDEX[j] * 3 + axis];
  }

  /** this = lerp(a, b, t) with shortest-path angles. */
  lerpPoses(a: Pose, b: Pose, t: number): this {
    const ra = a.rot;
    const rb = b.rot;
    const r = this.rot;
    for (let i = 0; i < r.length; i++) {
      const d = wrapAngle(rb[i] - ra[i]);
      r[i] = ra[i] + d * t;
    }
    this.bodyX = a.bodyX + (b.bodyX - a.bodyX) * t;
    this.bodyY = a.bodyY + (b.bodyY - a.bodyY) * t;
    this.bodyZ = a.bodyZ + (b.bodyZ - a.bodyZ) * t;
    return this;
  }

  /** this += o * w (additive layers). */
  addScaled(o: Pose, w: number): this {
    const r = this.rot;
    const ro = o.rot;
    for (let i = 0; i < r.length; i++) r[i] += ro[i] * w;
    this.bodyX += o.bodyX * w;
    this.bodyY += o.bodyY * w;
    this.bodyZ += o.bodyZ * w;
    return this;
  }
}
