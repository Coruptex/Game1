import * as THREE from 'three';
import type { AreaBuildContext, AreaDefinition, BuiltArea, Region } from './areas/AreaTypes';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { StaticBatcher } from './building/StaticBatcher';
import { InstancedScatter } from './building/InstancedScatter';
import type { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import type { QualitySettings } from '../render/Quality';
import { Rng, hashString } from '../utils/random';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';

/**
 * Loads / unloads areas (the harbour hub now; dungeons and other islands later) and tracks
 * which region the player is in.
 */
export class WorldManager {
  private readonly definitions = new Map<string, AreaDefinition>();
  current: BuiltArea | null = null;
  currentRegion: Region | null = null;
  private readonly visitedRegions = new Set<string>();
  private regionCheckTimer = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: MaterialLibrary,
    private readonly events: EventBus<GameEvents>,
  ) {}

  register(def: AreaDefinition): void {
    this.definitions.set(def.id, def);
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  async load(id: string, quality: QualitySettings, onProgress: (f: number, label: string) => Promise<void>): Promise<BuiltArea> {
    const def = this.definitions.get(id);
    if (!def) throw new Error(`Unknown area ${id}`);
    this.unload();
    const batcher = new StaticBatcher();
    const scatter = new InstancedScatter(48);
    const ctx: AreaBuildContext = {
      scene: this.scene,
      materials: this.materials,
      quality,
      rng: new Rng(hashString(id)),
      progress: onProgress,
      createPhysics: (ground) => new PhysicsWorld(ground),
      batcher,
      scatter,
    };
    const area = await def.build(ctx);
    this.current = area;
    this.currentRegion = null;
    return area;
  }

  unload(): void {
    if (!this.current) return;
    this.current.dispose();
    this.scene.remove(this.current.root);
    this.current = null;
  }

  regionAt(x: number, z: number): Region | null {
    if (!this.current) return null;
    let best: Region | null = null;
    for (const r of this.current.regions) {
      if (r.contains(x, z) && (!best || r.priority > best.priority)) best = r;
    }
    return best;
  }

  /** Re-evaluates the player's region a few times per second and emits region events. */
  update(dt: number, time: number, playerPos: THREE.Vector3): Region | null {
    if (!this.current) return null;
    this.current.update(dt, time);
    this.regionCheckTimer -= dt;
    if (this.regionCheckTimer <= 0) {
      this.regionCheckTimer = 0.25;
      const r = this.regionAt(playerPos.x, playerPos.z);
      if (r && r.id !== this.currentRegion?.id) {
        this.currentRegion = r;
        const firstVisit = !this.visitedRegions.has(r.id);
        this.visitedRegions.add(r.id);
        this.events.emit('region:entered', { id: r.id, name: r.name, subtitle: r.subtitle, firstVisit });
      }
    }
    return this.currentRegion;
  }
}
