import type * as THREE from 'three';
import type { Player } from '../player/Player';
import type { GameState } from '../systems/GameState';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { Effects } from '../effects/Effects';
import type { MaterialLibrary } from '../assets/materials/MaterialLibrary';

/** Minimal audio surface interactables need (decoupled from the concrete AudioManager). */
export interface SfxPlayer {
  play(id: string, opts?: { position?: { x: number; y: number; z: number }; volume?: number; pitch?: number }): void;
}

/** Services the game exposes to interactable objects. */
export interface InteractionServices {
  player: Player;
  state: GameState;
  events: EventBus<GameEvents>;
  effects: Effects;
  sfx: SfxPlayer;
  materials: MaterialLibrary;
  /** Short coloured light flash at a position (chest opening, kindling). */
  flashLight(pos: THREE.Vector3, color: number, intensity: number, duration: number): void;
  /** Big centred Soulslike banner. */
  banner(text: string, kind: 'death' | 'victory' | 'ember' | 'treasure'): void;
  /** Rest sequence: fade out, restore, respawn enemies, fade in. */
  restAtShrine(shrineId: string, x: number, z: number, yaw: number): void;
  addGold(amount: number): void;
  /** Area transition (future dungeons); returns false when the area does not exist yet. */
  travelTo(areaId: string): boolean;
  /** Schedules a callback in gameplay time. */
  after(seconds: number, fn: () => void): void;
  message(text: string): void;
}
