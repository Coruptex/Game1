/**
 * Shared physics types. The game uses lightweight kinematic "2.5D" physics:
 * - characters are vertical capsules (circle on XZ + height)
 * - static obstacles are circles / oriented boxes on XZ with a vertical extent
 * - the ground is the terrain heightfield plus walkable platforms (docks, decks, ramps, stairs)
 */

export type SurfaceType = 'sand' | 'grass' | 'dirt' | 'stone' | 'wood' | 'rock' | 'jungle' | 'water';

export interface CircleCollider {
  type: 'circle';
  x: number;
  z: number;
  radius: number;
  yMin: number;
  yMax: number;
  /** Optional tag for gameplay queries (e.g. 'tree', 'wall'). */
  tag?: string;
  /** Blocks line of sight for AI / lock-on. Defaults to true when tall enough. */
  blocksSight?: boolean;
}

export interface BoxCollider {
  type: 'box';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  /** Rotation around +Y (radians). */
  yaw: number;
  yMin: number;
  yMax: number;
  tag?: string;
  blocksSight?: boolean;
  /** Cached cos/sin of yaw (filled in by PhysicsWorld). */
  cos?: number;
  sin?: number;
}

export type Collider = CircleCollider | BoxCollider;

/**
 * Walkable surface with a box footprint. The top may slope along the local Z axis (ramps, stairs).
 * Anything under the platform (down to `top - thickness`) is treated as solid.
 */
export interface Platform {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  yaw: number;
  /** Height of the top surface at the platform centre. */
  height: number;
  /** Rise of the top surface per metre along local +Z. */
  slope?: number;
  thickness: number;
  surface: SurfaceType;
  tag?: string;
  cos?: number;
  sin?: number;
}

export interface GroundSampler {
  heightAt(x: number, z: number): number;
  /** Terrain gradient magnitude (rise / run). */
  slopeAt(x: number, z: number): number;
  surfaceAt(x: number, z: number): SurfaceType;
  /** Water surface height at this location, or -Infinity when there is no water body. */
  waterLevelAt(x: number, z: number): number;
}

export interface GroundInfo {
  height: number;
  surface: SurfaceType;
  onPlatform: boolean;
  slope: number;
  /** Depth of water above the ground (0 when dry). */
  waterDepth: number;
  walkable: boolean;
}

export interface BodyState {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export function createGroundInfo(): GroundInfo {
  return { height: 0, surface: 'grass', onPlatform: false, slope: 0, waterDepth: 0, walkable: true };
}
