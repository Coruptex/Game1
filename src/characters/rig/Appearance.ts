import type { Proportions } from './Joints';
import { Rng } from '../../utils/random';

/**
 * Data-driven look of a humanoid. New characters (captains, skeletons, island warriors...) are
 * new Appearance presets (plus, if needed, new part builders) — not new code paths.
 */
export interface Appearance {
  proportions?: Partial<Proportions>;
  scale?: number;
  skin: number;
  shirt: number;
  /** Optional horizontal stripes on the shirt (sailor style). */
  shirtStripes?: number;
  coat?: { color: number; trim: number; length: number } | null;
  vest?: number | null;
  sash: number;
  belt: number;
  buckle: number;
  trousers: number;
  boots: number | null;
  bootCuff?: number;
  gloves?: number | null;
  hair: number;
  hairStyle: 'ponytail' | 'short' | 'bald' | 'long';
  beard: 'full' | 'goatee' | 'stubble' | 'none';
  headwear: 'tricorn' | 'bandana' | 'none';
  hat?: number;
  hatTrim?: number;
  feather?: number | null;
  bandana?: number;
  eyepatch?: boolean;
  earring?: boolean;
  neckerchief?: number | null;
  weapon: 'cutlass' | 'rustyCutlass' | 'none';
  /** Outline (ink) colour. */
  outline?: number;
}

export const PLAYER_APPEARANCE: Appearance = {
  proportions: { girth: 1.05, shoulderWidth: 0.24 },
  skin: 0xd09a72,
  shirt: 0xefe4cc,
  coat: { color: 0x23324d, trim: 0xd9a441, length: 0.58 },
  vest: 0x5a2a20,
  sash: 0xa82a22,
  belt: 0x3a2417,
  buckle: 0xe0b04a,
  trousers: 0x352d28,
  boots: 0x2a1c13,
  bootCuff: 0x4a3322,
  gloves: 0x4a3020,
  hair: 0x24170f,
  hairStyle: 'ponytail',
  beard: 'full',
  headwear: 'tricorn',
  hat: 0x1c1819,
  hatTrim: 0xd9a441,
  feather: 0xb3261e,
  eyepatch: false,
  earring: true,
  neckerchief: 0xa82a22,
  weapon: 'cutlass',
  outline: 0x140e0b,
};

const SHIRTS = [0xe9e0cc, 0xd8cdb2, 0xc9b99a, 0xe4ddd0];
const STRIPES = [0xa8302a, 0x2f4a78, 0x3b3b3b, 0x8a2f5a];
const BANDANAS = [0xb02a22, 0x2e5d9a, 0x7a2f8a, 0xc98a1e, 0x2f7a45, 0x9a2a2a];
const TROUSERS = [0x6b5a43, 0x4a4f5a, 0x7a6a4a, 0x5a4535, 0x3f4a3a];
const VESTS = [0x5b3a22, 0x3d2a1c, 0x6a4a2a, null, null];
const SASHES = [0x9a2a22, 0x2a4a7a, 0x6a2a6a, 0x8a6a1a];
const HAIRS = [0x24170f, 0x4a2e18, 0x6b4a2a, 0x1a1a1a, 0x8a5a2a];
const SKINS = [0xd09a72, 0xb97f58, 0xe0b090, 0x9a6a48, 0xc48c64];

/** Randomised look for the basic pirate swordsman enemy. */
export function pirateGruntAppearance(seed: number): Appearance {
  const r = new Rng(seed * 7919 + 13);
  const striped = r.chance(0.55);
  return {
    proportions: { girth: r.range(0.95, 1.18), shoulderWidth: r.range(0.22, 0.25) },
    scale: r.range(0.96, 1.05),
    skin: r.pick(SKINS),
    shirt: r.pick(SHIRTS),
    shirtStripes: striped ? r.pick(STRIPES) : undefined,
    coat: null,
    vest: r.pick(VESTS),
    sash: r.pick(SASHES),
    belt: 0x3a2417,
    buckle: 0x9a8a6a,
    trousers: r.pick(TROUSERS),
    boots: r.chance(0.7) ? 0x2e2119 : null,
    bootCuff: 0x3e2c1e,
    gloves: null,
    hair: r.pick(HAIRS),
    hairStyle: r.pick(['short', 'bald', 'long', 'ponytail'] as const),
    beard: r.pick(['full', 'goatee', 'stubble', 'none'] as const),
    headwear: 'bandana',
    bandana: r.pick(BANDANAS),
    eyepatch: r.chance(0.25),
    earring: r.chance(0.4),
    neckerchief: r.chance(0.4) ? r.pick(BANDANAS) : null,
    weapon: 'rustyCutlass',
    outline: 0x1a0d0a,
  };
}
