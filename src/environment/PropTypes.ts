import type * as THREE from 'three';
import type { MaterialName } from '../assets/materials/MaterialLibrary';
import type { SurfaceType } from '../world/physics/PhysicsTypes';

/**
 * Contract for procedural environment assets.
 *
 * - Geometry is authored in prop-local space: metres, +Y up, y = 0 is the ground contact,
 *   the prop "faces" +Z (front) unless stated otherwise.
 * - Geometries must carry position/normal/uv/color attributes (GeometryUtils helpers add them).
 *   Vertex colours multiply the material colour/texture, so tint pieces through vertex colours.
 * - Static props are merged by the StaticBatcher, so builders may return many small parts.
 */
export interface PropPart {
  geometry: THREE.BufferGeometry;
  material: MaterialName;
  /** Use the dithered see-through variant (tall pieces that can hide the player). */
  seeThrough?: boolean;
  /** Defaults to true. */
  castShadow?: boolean;
  /** Defaults to true. */
  receiveShadow?: boolean;
}

/** Obstacle in prop-local space (rotated/translated with the prop). */
export type LocalCollider =
  | { type: 'circle'; x: number; z: number; radius: number; yMin: number; yMax: number; tag?: string }
  | { type: 'box'; x: number; z: number; halfX: number; halfZ: number; yaw: number; yMin: number; yMax: number; tag?: string };

/** Walkable surface in prop-local space (decks, stairs as ramps, platforms). */
export interface LocalPlatform {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  yaw: number;
  /** Top height at the platform centre (prop-local). */
  height: number;
  /** Rise per metre along local +Z (ramps / stairs). */
  slope?: number;
  /** Solid depth below the top (things under it are blocked). */
  thickness: number;
  surface: SurfaceType;
}

export interface PropDefinition {
  name: string;
  parts: PropPart[];
  colliders?: LocalCollider[];
  platforms?: LocalPlatform[];
}

/**
 * Instanced asset (vegetation, coral, small rocks). Each part becomes an InstancedMesh; all
 * parts share the instance transforms. Keep these light: they are drawn many times.
 */
export interface InstancedAsset {
  name: string;
  parts: Array<{ geometry: THREE.BufferGeometry; material: MaterialName; castShadow?: boolean; seeThrough?: boolean }>;
  /** Optional trunk collider (radius in local units, scaled with the instance). */
  collider?: { radius: number; height: number };
}

/** What the asset viewer can display. */
export type ViewerAsset =
  | { kind: 'prop'; def: PropDefinition }
  | { kind: 'instanced'; asset: InstancedAsset; count?: number; spacing?: number }
  | { kind: 'object'; object: THREE.Object3D; update?: (dt: number, time: number) => void };

/** Modules named `*.assets.ts` export this so the viewer can discover them automatically. */
export type AssetCatalog = Record<string, () => ViewerAsset>;
