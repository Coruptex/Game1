import type * as THREE from 'three';

export interface InteractionPrompt {
  /** Short verb shown next to the button glyph, e.g. "Open". */
  verb: string;
  /** What is being interacted with, e.g. "Treasure Chest". */
  label: string;
}

/** Anything the player can use: chests, shrines, doors, levers, NPCs... */
export interface Interactable {
  readonly id: string;
  readonly position: THREE.Vector3;
  /** Max distance (m) from the player for the prompt to appear. */
  readonly radius: number;
  /** Current prompt, or null when it cannot be used right now. */
  prompt(): InteractionPrompt | null;
  /** Performs the interaction. */
  interact(): void;
  update?(dt: number): void;
}
