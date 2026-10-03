import type { CharacterStats } from '../characters/Character';
import { pirateGruntAppearance, type Appearance } from '../characters/rig/Appearance';

export interface EnemyAttackChoice {
  attack: string;
  weight: number;
  /** Distance band (m, centre to centre) in which this attack is chosen. */
  minRange: number;
  maxRange: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  stats: CharacterStats;
  appearance: (seed: number) => Appearance;
  attacks: EnemyAttackChoice[];
  perception: {
    /** Forward sight distance and full cone angle (rad). */
    sightRange: number;
    sightAngle: number;
    /** Always notices the player within this distance. */
    awarenessRange: number;
    /** Gives up the chase when the player is this far from the enemy's home. */
    leashRange: number;
  };
  behaviour: {
    /** Preferred circling distance while waiting for an opening. */
    strafeDistance: number;
    /** Seconds between attacks [min, max]. */
    attackCooldown: [number, number];
    alertTime: number;
    /** Stagger immunity after recovering from a stagger (prevents stun-locks). */
    staggerImmunity: number;
    staggerTime: number;
  };
  gold: [number, number];
  trailColor: number;
}

/**
 * Registry of enemy archetypes. Planned additions (heavy pirate, pistol pirate, captain,
 * skeletons, island warriors, crabs, beasts, bosses) are new entries + appearance/attack data.
 */
export const ENEMY_DEFINITIONS: Record<string, EnemyDefinition> = {
  pirateSwordsman: {
    id: 'pirateSwordsman',
    name: 'Pirate Cutthroat',
    stats: {
      name: 'Pirate Cutthroat',
      radius: 0.42,
      height: 1.8,
      maxHealth: 90,
      poise: 16,
      walkSpeed: 1.6,
      runSpeed: 4.3,
      sprintSpeed: 4.3,
      acceleration: 16,
      deceleration: 18,
      turnSpeed: 7,
      hunch: 0.8,
    },
    appearance: pirateGruntAppearance,
    attacks: [
      { attack: 'enemySlash', weight: 3, minRange: 0, maxRange: 2.7 },
      { attack: 'enemyCombo', weight: 2, minRange: 0, maxRange: 2.5 },
      { attack: 'enemyLunge', weight: 2, minRange: 2.2, maxRange: 4.2 },
    ],
    perception: {
      sightRange: 14,
      sightAngle: 2.2,
      awarenessRange: 4.5,
      leashRange: 30,
    },
    behaviour: {
      strafeDistance: 3.4,
      attackCooldown: [1.2, 2.6],
      alertTime: 0.75,
      staggerImmunity: 1.1,
      staggerTime: 0.62,
    },
    gold: [55, 90],
    trailColor: 0xff9a5a,
  },
};
