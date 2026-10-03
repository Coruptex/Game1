import * as THREE from 'three';
import type { Interactable, InteractionPrompt } from '../Interactable';
import type { InteractionServices } from '../InteractionServices';
import type { PropPart } from '../../environment/PropTypes';
import { partsToObject } from './partsToObject';
import { paint, jitterColors } from '../../assets/geometry/GeometryUtils';
import { Ease } from '../../utils/math';

export interface ChestParts {
  base: PropPart[];
  lid: PropPart[];
  lidPivot: { y: number; z: number };
}

/** Simple fallback chest (used when no dedicated model builder is supplied). */
export function fallbackChestParts(): ChestParts {
  const base = new THREE.BoxGeometry(1.1, 0.55, 0.7);
  base.translate(0, 0.275, 0);
  paint(base, 0xf0e2cc);
  jitterColors(base, 0.1);
  const band = new THREE.BoxGeometry(1.14, 0.08, 0.74);
  band.translate(0, 0.45, 0);
  paint(band, 0xc9973a);
  const lid = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12, 1, false, 0, Math.PI);
  lid.rotateZ(Math.PI / 2);
  lid.scale(1, 0.6, 1);
  lid.translate(0, 0, 0.35);
  paint(lid, 0xf0e2cc);
  const gold = new THREE.SphereGeometry(0.3, 10, 6);
  gold.scale(1.4, 0.3, 0.8);
  gold.translate(0, 0.5, 0);
  paint(gold, 0xffffff);
  return {
    base: [
      { geometry: base, material: 'wood' },
      { geometry: band, material: 'brass' },
      { geometry: gold, material: 'gold' },
    ],
    lid: [{ geometry: lid, material: 'wood' }],
    lidPivot: { y: 0.55, z: -0.35 },
  };
}

/** Lootable chest: player opens it, the lid swings up, gold bursts out and is added to the purse. */
export class TreasureChest implements Interactable {
  readonly radius = 2.0;
  readonly object = new THREE.Group();
  readonly position: THREE.Vector3;
  private readonly lid = new THREE.Group();
  private opened: boolean;
  private openT = -1;

  constructor(
    readonly id: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    private readonly gold: number,
    private readonly svc: InteractionServices,
    parts: ChestParts = fallbackChestParts(),
  ) {
    this.position = new THREE.Vector3(x, y, z);
    this.object.position.copy(this.position);
    this.object.rotation.y = yaw;
    this.object.name = `chest:${id}`;
    this.object.add(partsToObject(parts.base, svc.materials));
    const lidMesh = partsToObject(parts.lid, svc.materials);
    // lid authored relative to its hinge axis
    this.lid.position.set(0, parts.lidPivot.y, parts.lidPivot.z);
    this.lid.add(lidMesh);
    this.object.add(this.lid);
    this.opened = svc.state.openedChests.has(id);
    if (this.opened) this.lid.rotation.x = -1.85;
  }

  prompt(): InteractionPrompt | null {
    return this.opened ? null : { verb: 'Open', label: 'Treasure Chest' };
  }

  interact(): void {
    if (this.opened) return;
    this.opened = true;
    const s = this.svc;
    s.player.beginInteract('interact', this.position.x, this.position.z);
    s.after(0.38, () => {
      this.openT = 0;
      s.sfx.play('chestOpen', { position: this.position });
    });
    s.after(0.82, () => {
      const p = this.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      s.effects.particles.burst('coin', p, 34, { dir: new THREE.Vector3(0, 1, 0), spread: 0.6 });
      s.effects.particles.burst('glint', p, 3);
      s.effects.particles.burst('ember', p, 12, { color: 0xffe08a });
      s.flashLight(p, 0xffc860, 18, 1.4);
      s.sfx.play('coins', { position: this.position });
      s.addGold(this.gold);
      s.state.openedChests.add(this.id);
      s.state.save();
      s.banner('Treasure Found', 'treasure');
      s.message(`+${this.gold} Doubloons`);
      s.events.emit('chest:opened', { id: this.id, gold: this.gold });
    });
  }

  update(dt: number): void {
    if (this.openT < 0) return;
    this.openT += dt;
    const k = Math.min(1, this.openT / 0.75);
    this.lid.rotation.x = -1.85 * Ease.outBack(k);
    if (k >= 1) this.openT = -1;
  }
}
