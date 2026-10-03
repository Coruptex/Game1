import * as THREE from 'three';
import type { Interactable, InteractionPrompt } from '../Interactable';
import type { InteractionServices } from '../InteractionServices';
import type { PropDefinition } from '../../environment/PropTypes';
import { partsToObject } from './partsToObject';
import { EmberFlame } from '../../effects/EmberFlame';
import { paint, jitterColors } from '../../assets/geometry/GeometryUtils';

export interface ShrineModel {
  def: PropDefinition;
  flameY: number;
}

/** Fallback shrine model: stepped stone base with a carved bowl. */
export function fallbackShrineModel(): ShrineModel {
  const step = new THREE.CylinderGeometry(1.1, 1.25, 0.3, 8);
  step.translate(0, 0.15, 0);
  paint(step, 0xe8e2d0);
  jitterColors(step, 0.1);
  const pillar = new THREE.CylinderGeometry(0.42, 0.55, 1.0, 8);
  pillar.translate(0, 0.8, 0);
  paint(pillar, 0xe0dac8);
  const bowl = new THREE.CylinderGeometry(0.62, 0.38, 0.32, 10);
  bowl.translate(0, 1.45, 0);
  paint(bowl, 0xe8e2d0);
  return {
    def: {
      name: 'shrine-fallback',
      parts: [
        { geometry: step, material: 'stone' },
        { geometry: pillar, material: 'stoneBlocks' },
        { geometry: bowl, material: 'stone' },
      ],
      colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.85, yMin: 0, yMax: 1.7 }],
    },
    flameY: 1.6,
  };
}

/**
 * Ember Shrine — the checkpoint. Kindling it the first time sets it as respawn point;
 * resting restores health & stamina and brings every enemy back (Soulslike rule).
 */
export class EmberShrine implements Interactable {
  readonly radius = 2.4;
  readonly object = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly flame: EmberFlame;
  private kindled: boolean;
  private emberTimer = 0;
  private busy = 0;

  constructor(
    readonly id: string,
    x: number,
    y: number,
    z: number,
    private readonly yaw: number,
    private readonly svc: InteractionServices,
    light: THREE.PointLight | null,
    model: ShrineModel = fallbackShrineModel(),
  ) {
    this.position = new THREE.Vector3(x, y, z);
    this.object.position.copy(this.position);
    this.object.rotation.y = yaw;
    this.object.name = `shrine:${id}`;
    this.object.add(partsToObject(model.def.parts, svc.materials));
    this.flame = new EmberFlame(0.95, light, 9);
    this.flame.object.position.set(0, model.flameY, 0);
    this.object.add(this.flame.object);
    this.kindled = svc.state.kindledShrines.has(id);
    this.flame.setIntensity(this.kindled ? 1 : 0.18, true);
  }

  get isKindled(): boolean {
    return this.kindled;
  }

  prompt(): InteractionPrompt | null {
    if (this.busy > 0) return null;
    return this.kindled ? { verb: 'Rest', label: 'Ember Shrine' } : { verb: 'Kindle', label: 'Ember Shrine' };
  }

  /** Respawn point in front of the shrine. */
  get respawnPoint(): { x: number; z: number; yaw: number } {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return { x: this.position.x + fx * 1.9, z: this.position.z + fz * 1.9, yaw: this.yaw + Math.PI };
  }

  interact(): void {
    const s = this.svc;
    this.busy = 2.4;
    const flamePos = this.flame.object.getWorldPosition(new THREE.Vector3());
    if (!this.kindled) {
      this.kindled = true;
      s.state.kindledShrines.add(this.id);
      s.player.beginInteract('interact', this.position.x, this.position.z);
      s.after(0.45, () => {
        this.flame.setIntensity(1);
        s.sfx.play('shrineIgnite', { position: this.position });
        s.effects.particles.burst('ember', flamePos, 40, { speedScale: 2.2 });
        s.effects.particles.burst('soul', flamePos, 14);
        s.flashLight(flamePos, 0xff9a3a, 24, 1.6);
        s.banner('Ember Kindled', 'ember');
        const rp = this.respawnPoint;
        s.state.respawn = { x: rp.x, z: rp.z, yaw: rp.yaw, shrineId: this.id };
        s.state.save();
        s.events.emit('checkpoint:rested', { id: this.id, firstTime: true });
      });
      return;
    }
    const rp = this.respawnPoint;
    s.player.beginInteract('rest', this.position.x, this.position.z);
    s.after(0.5, () => {
      s.sfx.play('shrineRest', { position: this.position });
      s.effects.particles.burst('soul', flamePos, 10);
    });
    s.restAtShrine(this.id, rp.x, rp.z, rp.yaw);
  }

  update(dt: number): void {
    if (this.busy > 0) this.busy -= dt;
    this.flame.update(dt);
    this.emberTimer -= dt;
    if (this.emberTimer <= 0) {
      this.emberTimer = this.kindled ? 0.12 : 0.6;
      const p = this.flame.object.getWorldPosition(new THREE.Vector3());
      p.y += 0.3;
      this.svc.effects.particles.burst('ember', p, 1, { sizeScale: this.kindled ? 1 : 0.6 });
    }
  }
}
