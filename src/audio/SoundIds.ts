/**
 * Every one-shot sound the game can request. Each id has a synthesized recipe in SoundLibrary.ts
 * and can optionally be overridden by a sample file (see AudioManager.registerSample / SampleManifest.ts).
 */
export type SoundId =
  | 'swordSwing'
  | 'swordSwingHeavy'
  | 'swordHitFlesh'
  | 'swordHitHeavy'
  | 'swordClash'
  | 'footstepSand'
  | 'footstepWood'
  | 'footstepStone'
  | 'footstepGrass'
  | 'footstepWater'
  | 'dodgeRoll'
  | 'playerHurt'
  | 'playerDeath'
  | 'enemyHurt'
  | 'enemyDeath'
  | 'enemyAlert'
  /** Short metallic glint/whoosh warning right before an enemy attack lands. */
  | 'enemyTelegraph'
  | 'bodyFall'
  | 'chestOpen'
  | 'coins'
  | 'shrineIgnite'
  | 'shrineRest'
  | 'uiMove'
  | 'uiConfirm'
  | 'uiBack'
  | 'lockOn'
  | 'lockOff'
  | 'staminaEmpty'
  /** Deep stone rumble + magical hum. */
  | 'doorSealed'
  | 'splash'
  /** Soft brass/choir-like swell for region banners. */
  | 'regionDiscovered'
  /** Ominous low swell for the death screen. */
  | 'youDied'
  /** Short heroic brass-like stab ("ENEMY FELLED"). */
  | 'victory';

// A Record forces this table to list every SoundId exactly once (compile-time completeness check).
const ALL: Record<SoundId, true> = {
  swordSwing: true,
  swordSwingHeavy: true,
  swordHitFlesh: true,
  swordHitHeavy: true,
  swordClash: true,
  footstepSand: true,
  footstepWood: true,
  footstepStone: true,
  footstepGrass: true,
  footstepWater: true,
  dodgeRoll: true,
  playerHurt: true,
  playerDeath: true,
  enemyHurt: true,
  enemyDeath: true,
  enemyAlert: true,
  enemyTelegraph: true,
  bodyFall: true,
  chestOpen: true,
  coins: true,
  shrineIgnite: true,
  shrineRest: true,
  uiMove: true,
  uiConfirm: true,
  uiBack: true,
  lockOn: true,
  lockOff: true,
  staminaEmpty: true,
  doorSealed: true,
  splash: true,
  regionDiscovered: true,
  youDied: true,
  victory: true,
};

/** All sound ids, in declaration order. */
export const SOUND_IDS: readonly SoundId[] = Object.keys(ALL) as SoundId[];

export function isSoundId(value: string): value is SoundId {
  return Object.prototype.hasOwnProperty.call(ALL, value);
}

/**
 * Maps a physics surface name (see world/physics/PhysicsTypes SurfaceType) to its footstep sound.
 * Unknown surfaces fall back to sand.
 */
export function footstepForSurface(surface: string): SoundId {
  switch (surface) {
    case 'wood':
      return 'footstepWood';
    case 'stone':
    case 'rock':
      return 'footstepStone';
    case 'grass':
    case 'jungle':
      return 'footstepGrass';
    case 'water':
      return 'footstepWater';
    case 'sand':
    case 'dirt':
    default:
      return 'footstepSand';
  }
}
