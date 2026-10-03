import type * as THREE from 'three';
import type { GroundSampler } from '../physics/PhysicsTypes';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { MaterialLibrary } from '../../assets/materials/MaterialLibrary';
import type { QualitySettings } from '../../render/Quality';
import type { StaticBatcher } from '../building/StaticBatcher';
import type { InstancedScatter } from '../building/InstancedScatter';
import type { Rng } from '../../utils/random';
import type { ChestParts } from '../../interaction/objects/TreasureChest';
import type { ShrineModel } from '../../interaction/objects/EmberShrine';

/** A named zone of an area (drives region banners, atmosphere and ambient audio). */
export interface Region {
  id: string;
  name: string;
  subtitle?: string;
  /** Key into ATMOSPHERES. */
  atmosphere: string;
  /** Ambient sound-scape key. */
  ambience: 'harbor' | 'beach' | 'jungle' | 'ruins';
  /** Higher priority wins when regions overlap. */
  priority: number;
  contains(x: number, z: number): boolean;
}

export interface EnemySpawn {
  /** Enemy definition id (see enemies/EnemyDefinitions). */
  type: string;
  x: number;
  z: number;
  yaw: number;
  /** Optional patrol loop (world XZ points). */
  patrol?: Array<{ x: number; z: number }>;
  /** Radius around the spawn the enemy defends before returning home. */
  leash?: number;
}

/** Interactable placements are produced by the area and turned into objects by the game. */
export type InteractableSpawn =
  | { kind: 'chest'; id: string; x: number; z: number; yaw: number; gold: number }
  | { kind: 'shrine'; id: string; x: number; z: number; yaw: number; name: string }
  | { kind: 'sealedDoor'; id: string; x: number; z: number; yaw: number; targetArea: string; message: string };

/** Continuous particle source declared by an area (waterfall mist, campfire embers, pollen...). */
export interface AmbientEmitter {
  kind: 'mist' | 'ember' | 'leaf' | 'splash' | 'soul';
  x: number;
  y: number;
  z: number;
  /** Particles per second. */
  rate: number;
  /** Random spawn radius. */
  spread: number;
  /** Only emit when the player is closer than this (m). */
  range: number;
}

export interface AreaBuildContext {
  scene: THREE.Scene;
  materials: MaterialLibrary;
  quality: QualitySettings;
  rng: Rng;
  /** Called between heavy build steps so the loading screen can update. */
  progress(fraction: number, label: string): Promise<void>;
  createPhysics(ground: GroundSampler): PhysicsWorld;
  batcher: StaticBatcher;
  scatter: InstancedScatter;
}

export interface BuiltArea {
  id: string;
  root: THREE.Group;
  physics: PhysicsWorld;
  ground: GroundSampler;
  spawn: { x: number; z: number; yaw: number; cameraYaw: number };
  regions: Region[];
  enemySpawns: EnemySpawn[];
  interactables: InteractableSpawn[];
  /** Ambient particle sources driven by the game's particle system. */
  emitters?: AmbientEmitter[];
  /** Camera orbit for the title screen: around (x, z) at `radius`/`height`, looking at `look*`. */
  titleShot?: {
    x: number;
    z: number;
    radius: number;
    height: number;
    yaw: number;
    swing: number;
    lookX: number;
    lookY: number;
    lookZ: number;
  };
  /** Optional model factories for interactables (fallback models are used otherwise). */
  chestParts?: (seed: number) => ChestParts;
  shrineModel?: () => ShrineModel;
  /** Animated environment pieces (flags, birds, ...). */
  update(dt: number, time: number): void;
  dispose(): void;
}

export interface AreaDefinition {
  id: string;
  name: string;
  build(ctx: AreaBuildContext): Promise<BuiltArea>;
}
