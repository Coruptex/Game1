import type { GameAudio } from './AudioTypes';
import { AudioManager } from './AudioManager';

/**
 * Creates the game's audio backend: Web Audio synthesis (AudioManager). It is a silent no-op
 * until unlocked by a user gesture and when Web Audio is unavailable.
 */
export function createAudio(): GameAudio {
  return new AudioManager();
}
