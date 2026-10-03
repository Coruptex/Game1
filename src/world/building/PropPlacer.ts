import * as THREE from 'three';
import type { MaterialLibrary } from '../../assets/materials/MaterialLibrary';
import type { InstancedAsset, LocalCollider, LocalPlatform, PropDefinition } from '../../environment/PropTypes';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { StaticBatcher } from './StaticBatcher';
import type { InstancedScatter } from './InstancedScatter';
import { trs } from '../../assets/geometry/GeometryUtils';

const SEE_THROUGH_DEFAULT = new Set<string>(['canopy', 'canopyLight', 'canopyDark', 'palmLeaf', 'palmBark', 'jungleBark']);

/**
 * Places prop definitions into the world: geometry goes to the static batcher, colliders and
 * walkable platforms are transformed into world space and registered with physics.
 */
export class PropPlacer {
  private readonly m = new THREE.Matrix4();
  private readonly registered = new Set<string>();

  constructor(
    private readonly materials: MaterialLibrary,
    private readonly batcher: StaticBatcher,
    private readonly physics: PhysicsWorld,
    private readonly scatter?: InstancedScatter,
  ) {}

  place(def: PropDefinition, x: number, y: number, z: number, yaw = 0, scale = 1): void {
    trs(x, y, z, 0, yaw, 0, scale, scale, scale, this.m);
    for (const part of def.parts) {
      const mat = this.materials.get(part.material, { seeThrough: part.seeThrough });
      this.batcher.add(part.geometry, mat, this.m, {
        castShadow: part.castShadow ?? true,
        receiveShadow: part.receiveShadow ?? true,
      });
    }
    for (const c of def.colliders ?? []) this.addCollider(c, x, y, z, yaw, scale);
    for (const p of def.platforms ?? []) this.addPlatform(p, x, y, z, yaw, scale);
  }

  addCollider(c: LocalCollider, x: number, y: number, z: number, yaw: number, scale = 1): void {
    const [wx, wz] = rotate(c.x * scale, c.z * scale, yaw);
    if (c.type === 'circle') {
      this.physics.addCircle(x + wx, z + wz, c.radius * scale, y + c.yMin * scale, y + c.yMax * scale, c.tag);
    } else {
      this.physics.addBox(x + wx, z + wz, c.halfX * scale, c.halfZ * scale, c.yaw + yaw, y + c.yMin * scale, y + c.yMax * scale, c.tag);
    }
  }

  addPlatform(p: LocalPlatform, x: number, y: number, z: number, yaw: number, scale = 1): void {
    const [wx, wz] = rotate(p.x * scale, p.z * scale, yaw);
    this.physics.addPlatform({
      x: x + wx,
      z: z + wz,
      halfX: p.halfX * scale,
      halfZ: p.halfZ * scale,
      yaw: p.yaw + yaw,
      height: y + p.height * scale,
      slope: p.slope,
      thickness: p.thickness * scale,
      surface: p.surface,
    });
  }

  /** Adds one instance of an instanced asset (registering the variant on first use). */
  instance(asset: InstancedAsset, x: number, y: number, z: number, yaw = 0, scale = 1, color?: THREE.ColorRepresentation, tilt = 0): void {
    if (!this.scatter) throw new Error('PropPlacer: no InstancedScatter');
    if (!this.registered.has(asset.name)) {
      this.scatter.register(asset.name, {
        parts: asset.parts.map((p) => ({
          geometry: p.geometry,
          // tall vegetation can hide the player from the elevated camera -> dithered see-through
          material: this.materials.get(p.material, { seeThrough: p.seeThrough ?? SEE_THROUGH_DEFAULT.has(p.material) }),
          castShadow: p.castShadow ?? false,
        })),
      });
      this.registered.add(asset.name);
    }
    const m = trs(x, y, z, tilt, yaw, tilt * 0.6, scale, scale, scale);
    this.scatter.add(asset.name, m, color);
    if (asset.collider) {
      this.physics.addCircle(x, z, asset.collider.radius * scale, y, y + asset.collider.height * scale, 'plant');
    }
  }
}

/** Rotates a local XZ offset by yaw (same convention as Object3D.rotation.y). */
export function rotate(lx: number, lz: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [lx * c + lz * s, -lx * s + lz * c];
}
