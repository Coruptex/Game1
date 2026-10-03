import * as THREE from 'three';
import type { Interactable, InteractionPrompt } from '../Interactable';
import type { InteractionServices } from '../InteractionServices';

/**
 * Area transition door. Leads to another area (dungeon) when that area is registered with the
 * WorldManager; until then it stays sealed and tells the player so in-world.
 */
export class SealedDoor implements Interactable {
  readonly radius = 2.6;
  readonly position: THREE.Vector3;
  private cooldown = 0;

  constructor(
    readonly id: string,
    x: number,
    y: number,
    z: number,
    private readonly targetArea: string,
    private readonly sealedMessage: string,
    private readonly svc: InteractionServices,
  ) {
    this.position = new THREE.Vector3(x, y, z);
  }

  prompt(): InteractionPrompt | null {
    return this.cooldown > 0 ? null : { verb: 'Examine', label: 'Sealed Door' };
  }

  interact(): void {
    this.cooldown = 1.5;
    if (this.svc.travelTo(this.targetArea)) return;
    this.svc.player.beginInteract('interact', this.position.x, this.position.z);
    this.svc.after(0.5, () => {
      this.svc.sfx.play('doorSealed', { position: this.position });
      this.svc.effects.particles.burst('ember', this.position.clone().add(new THREE.Vector3(0, 2, 0)), 16, { speedScale: 0.8 });
      this.svc.message(this.sealedMessage);
    });
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
  }
}
