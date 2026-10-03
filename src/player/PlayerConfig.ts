import type { CharacterStats } from '../characters/Character';

/** Player tuning (movement feel, combat costs). Adjust here, not in the controller. */
export const PLAYER_STATS: CharacterStats = {
  name: 'Captain',
  radius: 0.42,
  height: 1.85,
  maxHealth: 100,
  maxStamina: 100,
  poise: 1,
  walkSpeed: 2.0,
  runSpeed: 5.2,
  sprintSpeed: 7.6,
  acceleration: 36,
  deceleration: 30,
  turnSpeed: 13,
  hunch: 0,
};

export const PLAYER_TUNING = {
  sprintDrain: 13,
  /** Analog threshold below which the character walks. */
  walkThreshold: 0.55,
  /** How long a button press is remembered while the character is busy (s). */
  inputBuffer: 0.32,
  roll: {
    duration: 0.62,
    staminaCost: 20,
    speed: 7.4,
    /** [start, end] of invulnerability (s). */
    iframes: [0.04, 0.4] as [number, number],
    /** Time after which a buffered attack may start. */
    recoverAt: 0.5,
  },
  backstep: {
    duration: 0.44,
    staminaCost: 14,
    speed: 6.0,
    iframes: [0.02, 0.22] as [number, number],
    recoverAt: 0.36,
  },
  hitStagger: 0.42,
  /** Invulnerability after taking a hit (keeps it accessible: no juggling). */
  hitInvulnerability: 0.6,
  /** Seconds lying dead before the respawn sequence. */
  deathDelay: 3.4,
  lockOnRange: 18,
  lockOnBreakRange: 24,
};
