import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { SwordTrail } from './SwordTrail';

/** Owns transient visual effects: particles and per-character sword trails. */
export class Effects {
  readonly particles = new ParticleSystem();
  private readonly trails = new Map<number, SwordTrail>();
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Effects';
    this.group.add(this.particles.object);
    scene.add(this.group);
  }

  trail(id: number, color: THREE.ColorRepresentation): SwordTrail {
    let t = this.trails.get(id);
    if (!t) {
      t = new SwordTrail(color);
      this.trails.set(id, t);
      this.group.add(t.mesh);
    }
    return t;
  }

  removeTrail(id: number): void {
    const t = this.trails.get(id);
    if (!t) return;
    this.group.remove(t.mesh);
    this.trails.delete(id);
  }

  update(dt: number): void {
    this.particles.update(dt);
    for (const t of this.trails.values()) t.update(dt);
  }

  clear(): void {
    this.particles.clear();
    for (const t of this.trails.values()) t.clear();
  }
}
