import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, wrapAngle, yawFromDir } from '../utils/math';
import { Noise2D } from '../utils/noise';

export interface CameraInput {
  lookYaw: number;
  lookPitch: number;
  zoom: number;
}

export interface CameraGround {
  heightAt(x: number, z: number): number;
}

export const CameraConfig = {
  fov: 38,
  minDistance: 8,
  maxDistance: 30,
  defaultDistance: 15.5,
  /** Elevation angle (radians) when fully zoomed in / out. */
  pitchNear: 0.66,
  pitchFar: 1.02,
  /** User pitch offset range (right stick / mouse drag vertical). */
  pitchOffsetRange: 0.28,
  followLambdaXZ: 9,
  followLambdaY: 6,
  yawLambda: 12,
  zoomLambda: 7,
  lockYawLambda: 4.5,
  focusHeight: 1.35,
  terrainClearance: 1.4,
};

/**
 * Elevated action-RPG camera that orbits the player. Supports free 360° yaw rotation,
 * zoom, lock-on framing, terrain avoidance and trauma-based screen shake.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  /** Smoothed focus point (player chest). */
  readonly focus = new THREE.Vector3();

  yaw = 0.0;
  private targetYaw = 0.0;
  private pitchOffset = 0;
  private distance = CameraConfig.defaultDistance;
  private targetDistance = CameraConfig.defaultDistance;
  private trauma = 0;
  private shakeTime = 0;
  private readonly noise = new Noise2D(99);
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private heightCorrection = 0;
  private lockBlend = 0;
  private readonly lockFocus = new THREE.Vector3();

  constructor(
    aspect: number,
    private readonly ground: CameraGround,
  ) {
    this.camera = new THREE.PerspectiveCamera(CameraConfig.fov, aspect, 0.3, 2400);
  }

  /** Planar forward vector (direction the camera looks, projected on XZ). */
  get forwardX(): number {
    return -Math.sin(this.yaw);
  }
  get forwardZ(): number {
    return -Math.cos(this.yaw);
  }
  /** Planar right vector. */
  get rightX(): number {
    return Math.cos(this.yaw);
  }
  get rightZ(): number {
    return -Math.sin(this.yaw);
  }

  /** Converts a stick/WASD vector (x right, y forward) into a world-space XZ direction. */
  toWorldDirection(moveX: number, moveY: number, out: THREE.Vector2): THREE.Vector2 {
    return out.set(this.rightX * moveX + this.forwardX * moveY, this.rightZ * moveX + this.forwardZ * moveY);
  }

  /** Instantly places the camera behind `target` looking along `yaw`. */
  snapTo(target: THREE.Vector3, yaw = this.yaw): void {
    this.yaw = this.targetYaw = yaw;
    this.focus.set(target.x, target.y + CameraConfig.focusHeight, target.z);
    this.distance = this.targetDistance;
    this.heightCorrection = 0;
    this.computeDesired();
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.lookAt);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  setDistance(d: number, instant = false): void {
    this.targetDistance = clamp(d, CameraConfig.minDistance, CameraConfig.maxDistance);
    if (instant) this.distance = this.targetDistance;
  }

  get zoom01(): number {
    return (this.distance - CameraConfig.minDistance) / (CameraConfig.maxDistance - CameraConfig.minDistance);
  }

  update(dt: number, input: CameraInput | null, target: THREE.Vector3, lockTarget: THREE.Vector3 | null): void {
    // --- user input -------------------------------------------------------
    if (input && !lockTarget) {
      this.targetYaw += input.lookYaw;
      this.pitchOffset = clamp(this.pitchOffset + input.lookPitch, -CameraConfig.pitchOffsetRange, CameraConfig.pitchOffsetRange);
    }
    if (input && input.zoom !== 0) {
      this.targetDistance = clamp(this.targetDistance * (1 + input.zoom), CameraConfig.minDistance, CameraConfig.maxDistance);
    }

    // --- lock-on framing ----------------------------------------------------
    this.lockBlend = damp(this.lockBlend, lockTarget ? 1 : 0, 6, dt);
    if (lockTarget) {
      const dx = target.x - lockTarget.x;
      const dz = target.z - lockTarget.z;
      if (dx * dx + dz * dz > 0.25) {
        // Camera sits behind the player, opposite to the target, offset slightly to the side.
        const desiredYaw = yawFromDir(dx, dz) + 0.22;
        this.targetYaw = this.yaw + wrapAngle(desiredYaw - this.yaw);
        this.yaw = dampAngle(this.yaw, desiredYaw, CameraConfig.lockYawLambda, dt);
        this.targetYaw = this.yaw;
      }
      this.lockFocus.copy(lockTarget);
    } else {
      this.yaw = dampAngle(this.yaw, this.targetYaw, CameraConfig.yawLambda, dt);
    }
    // keep targetYaw close to yaw to avoid unwinding after many revolutions
    this.targetYaw = this.yaw + wrapAngle(this.targetYaw - this.yaw);

    this.distance = damp(this.distance, this.targetDistance, CameraConfig.zoomLambda, dt);

    // --- focus follow -----------------------------------------------------
    const fx = target.x;
    const fy = target.y + CameraConfig.focusHeight;
    const fz = target.z;
    let tx = fx;
    let ty = fy;
    let tz = fz;
    if (this.lockBlend > 0.01) {
      const w = 0.3 * this.lockBlend;
      tx = lerp(fx, this.lockFocus.x, w);
      ty = lerp(fy, this.lockFocus.y + CameraConfig.focusHeight, w * 0.5);
      tz = lerp(fz, this.lockFocus.z, w);
    }
    this.focus.x = damp(this.focus.x, tx, CameraConfig.followLambdaXZ, dt);
    this.focus.z = damp(this.focus.z, tz, CameraConfig.followLambdaXZ, dt);
    this.focus.y = damp(this.focus.y, ty, CameraConfig.followLambdaY, dt);

    this.computeDesired();

    // --- terrain avoidance ------------------------------------------------
    let needed = 0;
    for (const t of [0.35, 0.6, 0.85, 1]) {
      this.tmp.lerpVectors(this.focus, this.desired, t);
      const h = this.ground.heightAt(this.tmp.x, this.tmp.z) + CameraConfig.terrainClearance;
      if (this.tmp.y < h) needed = Math.max(needed, (h - this.tmp.y) / t);
    }
    this.heightCorrection = damp(this.heightCorrection, needed, needed > this.heightCorrection ? 14 : 3, dt);
    this.desired.y += this.heightCorrection;

    // --- shake --------------------------------------------------------------
    this.shakeTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const s = 0.55 * shake;
      this.desired.x += this.noise.noise(this.shakeTime * 25, 1.3) * s;
      this.desired.y += this.noise.noise(this.shakeTime * 25, 7.1) * s;
      this.desired.z += this.noise.noise(this.shakeTime * 25, 13.7) * s;
    }

    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.lookAt);
  }

  private computeDesired(): void {
    const z01 = clamp((this.distance - CameraConfig.minDistance) / (CameraConfig.maxDistance - CameraConfig.minDistance), 0, 1);
    const pitch = clamp(lerp(CameraConfig.pitchNear, CameraConfig.pitchFar, z01) + this.pitchOffset, 0.3, 1.35);
    const cp = Math.cos(pitch);
    this.desired.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.distance,
      this.focus.y + Math.sin(pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * cp * this.distance,
    );
    this.lookAt.copy(this.focus);
  }
}
