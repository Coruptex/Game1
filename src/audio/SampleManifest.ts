import type { SoundId } from './SoundIds';

/**
 * Optional sample overrides for synthesized sounds.
 *
 * Map a SoundId to one or more audio file URLs (relative to the page, e.g. files placed in
 * `public/audio/` are served as `audio/<file>`). The AudioManager fetches and decodes every listed
 * file when it is constructed; as soon as at least one sample of an id has loaded, play() picks a
 * random variant (with the usual pitch variation, positional panning and voice limits) instead of
 * running the synth recipe. Sounds whose files fail to load keep using the synth.
 *
 * Example:
 *   swordSwing: ['audio/sword_swing_01.ogg', 'audio/sword_swing_02.ogg'],
 */
export const SAMPLE_MANIFEST: Partial<Record<SoundId, readonly string[]>> = {};
