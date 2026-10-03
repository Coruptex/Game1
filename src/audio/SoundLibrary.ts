import type { SoundId } from './SoundIds';
import { Synth, chance, clamp, midiHz, rand, randInt, saturationCurve, softClipCurve } from './SynthKit';
import {
  bellTone,
  bloop,
  brassStab,
  burst,
  click,
  coinsInto,
  creak,
  fall,
  fireCrackle,
  impact,
  modal,
  padChord,
  ping,
  thump,
  tone,
  vocal,
  whoosh,
} from './SynthBlocks';

/**
 * Synthesizer recipes for every SoundId. No audio files: everything is built from oscillators,
 * cached noise buffers, filters and envelopes. Recipes are slightly randomised on every call so
 * repeats never sound identical. All recipes peak below ~0.9 at volume 1.
 */

export interface SynthOptions {
  /** Linear gain multiplier (default 1). */
  volume?: number;
  /** Playback-rate style multiplier: frequencies × pitch, durations ÷ pitch (default 1). */
  pitch?: number;
  /** Absolute context time to start at (default: now). */
  when?: number;
}

export interface SoundInfo {
  /** Upper bound of the rendered length at pitch 1 (s). Voices are released after maxDuration / pitch. */
  maxDuration: number;
  /** Max simultaneous voices for this sound's group. */
  maxVoices: number;
  /** Voice group: ids sharing a group share `maxVoices` (e.g. every footstep). Defaults to the id. */
  group?: string;
  /** Global voice-stealing priority (higher survives). */
  priority: number;
  /** ± random pitch variation (fraction) applied by the AudioManager. */
  pitchVariation: number;
  /** Minimum seconds between two triggers of the same id (protects against double-fires). */
  cooldown: number;
  /** false → ignores `position` (UI, musical stingers). */
  spatial: boolean;
  /** Shared reverb send (0..1). */
  reverb: number;
}

const info = (
  maxDuration: number,
  maxVoices: number,
  priority: number,
  extra: Partial<Omit<SoundInfo, 'maxDuration' | 'maxVoices' | 'priority'>> = {},
): SoundInfo => ({
  maxDuration,
  maxVoices,
  priority,
  pitchVariation: 0.05,
  cooldown: 0.03,
  spatial: true,
  reverb: 0.18,
  ...extra,
});

export const SOUND_INFO: Record<SoundId, SoundInfo> = {
  swordSwing: info(0.6, 3, 6, { pitchVariation: 0.06 }),
  swordSwingHeavy: info(0.9, 2, 6, { pitchVariation: 0.05 }),
  swordHitFlesh: info(0.8, 4, 8, { pitchVariation: 0.07 }),
  swordHitHeavy: info(1.0, 3, 8, { pitchVariation: 0.06 }),
  swordClash: info(1.8, 3, 8, { pitchVariation: 0.05, reverb: 0.3 }),
  footstepSand: info(0.45, 4, 2, { group: 'footstep', cooldown: 0.05, pitchVariation: 0.08, reverb: 0.06 }),
  footstepWood: info(0.45, 4, 2, { group: 'footstep', cooldown: 0.05, pitchVariation: 0.06, reverb: 0.1 }),
  footstepStone: info(0.35, 4, 2, { group: 'footstep', cooldown: 0.05, pitchVariation: 0.07, reverb: 0.12 }),
  footstepGrass: info(0.4, 4, 2, { group: 'footstep', cooldown: 0.05, pitchVariation: 0.08, reverb: 0.05 }),
  footstepWater: info(0.45, 4, 2, { group: 'footstep', cooldown: 0.05, pitchVariation: 0.08, reverb: 0.08 }),
  dodgeRoll: info(0.8, 2, 5, { pitchVariation: 0.06 }),
  playerHurt: info(0.8, 2, 9, { pitchVariation: 0.04 }),
  playerDeath: info(2.2, 1, 10, { pitchVariation: 0.02, cooldown: 0.5 }),
  enemyHurt: info(0.8, 3, 7, { pitchVariation: 0.07 }),
  enemyDeath: info(2.2, 3, 8, { pitchVariation: 0.06 }),
  enemyAlert: info(1.3, 2, 7, { pitchVariation: 0.06, cooldown: 0.15 }),
  enemyTelegraph: info(1.2, 3, 9, { pitchVariation: 0.03, reverb: 0.25 }),
  bodyFall: info(1.0, 3, 5, { pitchVariation: 0.07 }),
  chestOpen: info(3.0, 1, 7, { pitchVariation: 0.03, cooldown: 0.3 }),
  coins: info(2.0, 3, 6, { pitchVariation: 0.04 }),
  shrineIgnite: info(4.6, 1, 9, { pitchVariation: 0.0, cooldown: 0.5, reverb: 0.3 }),
  shrineRest: info(6.4, 1, 9, { pitchVariation: 0.0, cooldown: 0.5, reverb: 0.3 }),
  uiMove: info(0.25, 2, 10, { spatial: false, pitchVariation: 0.01, cooldown: 0.025, reverb: 0 }),
  uiConfirm: info(0.8, 2, 10, { spatial: false, pitchVariation: 0.0, reverb: 0.05 }),
  uiBack: info(0.6, 2, 10, { spatial: false, pitchVariation: 0.0, reverb: 0.05 }),
  lockOn: info(0.6, 1, 9, { spatial: false, pitchVariation: 0.0, cooldown: 0.06, reverb: 0.05 }),
  lockOff: info(0.5, 1, 9, { spatial: false, pitchVariation: 0.0, cooldown: 0.06, reverb: 0.05 }),
  staminaEmpty: info(0.6, 1, 8, { spatial: false, pitchVariation: 0.03, cooldown: 0.3, reverb: 0.02 }),
  doorSealed: info(3.6, 1, 8, { pitchVariation: 0.02, cooldown: 0.6, reverb: 0.3 }),
  splash: info(1.6, 3, 6, { pitchVariation: 0.07 }),
  regionDiscovered: info(5.6, 1, 10, { spatial: false, pitchVariation: 0.0, cooldown: 1, reverb: 0.3 }),
  youDied: info(7.6, 1, 10, { spatial: false, pitchVariation: 0.0, cooldown: 1, reverb: 0.35 }),
  victory: info(2.8, 1, 10, { spatial: false, pitchVariation: 0.0, cooldown: 0.5, reverb: 0.3 }),
};

// =============================================================================================
// Recipes
// =============================================================================================

type Recipe = (s: Synth) => void;

const RECIPES: Record<SoundId, Recipe> = {
  // ----------------------------------------------------------------- swords
  swordSwing: (s) => {
    const t = s.t(0);
    const dur = s.d(rand(0.25, 0.31));
    const pk = rand(0.36, 0.48);
    whoosh(s, 'white', t, dur, [s.f(rand(420, 560)), s.f(rand(1750, 2300)), s.f(rand(600, 820))], rand(1.6, 2.2), 0.85, pk, 1.5);
    whoosh(s, 'white', t, dur, [s.f(rand(1300, 1600)), s.f(rand(3000, 3700)), s.f(rand(1500, 1900))], rand(7, 10), 0.36, pk, 2.2);
    const g = s.gain(0);
    const lp = s.filter('lowpass', s.f(rand(500, 700)), 0.7, g);
    s.bell(g.gain, t, dur * 0.9, 0.18, pk * 0.9, 1.3);
    s.noise('brown', t, t + dur, lp);
  },

  swordSwingHeavy: (s) => {
    const t = s.t(0);
    const dur = s.d(rand(0.44, 0.52));
    const pk = rand(0.45, 0.55);
    const trem = s.gain(0.85);
    s.lfo(trem.gain, rand(24, 32), 0.15, t, t + dur + 0.02);
    whoosh(s, 'white', t, dur, [s.f(rand(240, 300)), s.f(rand(1000, 1250)), s.f(rand(330, 420))], rand(1.2, 1.5), 1.1, pk, 1.4, trem);
    whoosh(s, 'white', t, dur, [s.f(rand(750, 900)), s.f(rand(1800, 2200)), s.f(rand(900, 1100))], rand(5, 7), 0.26, pk, 2);
    const g = s.gain(0, trem);
    const lp = s.filter('lowpass', s.f(rand(320, 420)), 0.8, g);
    s.bell(g.gain, t, dur, 0.45, pk, 1.2);
    s.noise('brown', t, t + dur + 0.01, lp);
  },

  swordHitFlesh: (s) => {
    const t = s.t(0);
    const bus = s.shaper(softClipCurve(0.6, 0.88));
    click(s, t, s.f(2500), 0.4, s.d(0.004), bus);
    const f = burst(s, 'pink', t, 'bandpass', s.f(1600), 0.9, 1.5, 0.003, s.d(rand(0.035, 0.05)), bus);
    s.sweep(f.frequency, t, s.d(0.14), s.f(rand(1500, 2000)), s.f(rand(450, 600)));
    const sq = burst(s, 'white', t + s.d(0.004), 'bandpass', s.f(rand(650, 850)), 3, 0.35, 0.004, s.d(0.05), bus);
    s.lfo(sq.frequency, rand(45, 70), s.f(220), t, t + s.d(0.4));
    thump(s, t, s.f(rand(130, 160)), s.f(rand(45, 55)), s.d(0.09), 0.45, s.d(0.055), bus);
  },

  swordHitHeavy: (s) => {
    const t = s.t(0);
    const bus = s.shaper(saturationCurve(1.4, 0.88));
    const pre = s.gain(0.75, bus);
    click(s, t, s.f(1800), 0.5, s.d(0.005), pre);
    burst(s, 'crackle', t, 'bandpass', s.f(1800), 0.7, 0.9, 0.001, s.d(0.03), pre, 1.3);
    const f = burst(s, 'pink', t, 'bandpass', s.f(1300), 0.9, 1.4, 0.003, s.d(0.075), pre);
    s.sweep(f.frequency, t, s.d(0.22), s.f(rand(1200, 1500)), s.f(rand(300, 380)));
    thump(s, t, s.f(rand(110, 130)), s.f(rand(36, 42)), s.d(0.15), 0.75, s.d(0.11), pre);
    burst(s, 'brown', t, 'lowpass', s.f(170), 0.8, 0.9, 0.004, s.d(0.09), pre);
    modal(s, t, [s.f(rand(1800, 2000)), s.f(rand(2550, 2750))], [0.04, 0.03], [s.d(0.15), s.d(0.11)], pre);
  },

  swordClash: (s) => {
    const t = s.t(0);
    const bus = s.shaper(softClipCurve(0.65, 0.88));
    const fa = s.f(rand(1500, 2000));
    const fb = fa * rand(1.12, 1.3);
    const freqs: number[] = [];
    const amps: number[] = [];
    const taus: number[] = [];
    const add = (f: number, a: number, tau: number): void => {
      freqs.push(f);
      amps.push(a);
      taus.push(s.d(tau));
    };
    const bar = [1, 2.756, 5.404, 8.933];
    [0.18, 0.15, 0.08, 0.035].forEach((a, i) => add(fa * bar[i], a, 0.16 / Math.sqrt(bar[i])));
    add(fa * 1.0035, 0.08, 0.15);
    [0.12, 0.08, 0.04].forEach((a, i) => add(fb * bar[i], a, 0.14 / Math.sqrt(bar[i])));
    for (let i = 0; i < 6; i++) add(s.f(rand(2600, 9000)), rand(0.015, 0.04), rand(0.04, 0.12));
    modal(s, t, freqs, amps, taus, bus, 0.0008);
    click(s, t, s.f(3000), 0.5, s.d(0.006), bus);
    const sc = burst(s, 'white', t, 'bandpass', s.f(7000), 4, 0.5, 0.002, s.d(0.035), bus);
    s.sweep(sc.frequency, t, s.d(0.09), s.f(rand(6500, 7500)), s.f(rand(3000, 3600)));
    burst(s, 'pink', t, 'bandpass', s.f(rand(450, 650)), 1.2, 0.35, 0.001, s.d(0.02), bus);
  },

  // ----------------------------------------------------------------- footsteps
  footstepSand: (s) => {
    const t = s.t(0);
    const lvl = rand(0.8, 1);
    burst(s, 'pink', t, 'lowpass', s.f(rand(900, 1300)), 0.7, 0.55 * lvl, s.d(0.006), s.d(0.03));
    const t2 = s.t(rand(0.03, 0.055));
    burst(s, 'pink', t2, 'bandpass', s.f(rand(1500, 2400)), 0.6, 0.9 * lvl, s.d(0.015), s.d(rand(0.028, 0.04)));
    burst(s, 'crackle', t, 'bandpass', s.f(rand(2500, 3800)), 0.8, 0.6 * lvl, s.d(0.02), s.d(0.035), s.out, rand(0.8, 1.2));
  },

  footstepWood: (s) => {
    const lvl = rand(0.85, 1);
    const knock = (t0: number, a: number): void => {
      const g = s.gain(a * lvl);
      const base = rand(165, 215);
      modal(s, t0, [s.f(base), s.f(base * rand(2.0, 2.2)), s.f(base * rand(3.3, 3.7))], [0.18, 0.09, 0.04], [s.d(0.04), s.d(0.028), s.d(0.018)], g);
      burst(s, 'white', t0, 'bandpass', s.f(rand(1800, 2600)), 1.2, 0.18, 0.0005, s.d(0.005), g);
      thump(s, t0, s.f(100), s.f(70), s.d(0.04), 0.13, s.d(0.03), g);
    };
    knock(s.t(0), 1);
    knock(s.t(rand(0.04, 0.06)), rand(0.35, 0.5));
  },

  footstepStone: (s) => {
    const lvl = rand(0.85, 1);
    const tap = (t0: number, a: number): void => {
      click(s, t0, s.f(1800), 0.22 * a * lvl, s.d(0.004));
      const f = s.f(rand(1900, 2600));
      modal(s, t0, [f, f * 1.58, f * 2.4], [0.09 * a * lvl, 0.05 * a * lvl, 0.03 * a * lvl], [s.d(0.014), s.d(0.01), s.d(0.007)]);
      burst(s, 'brown', t0, 'lowpass', s.f(320), 0.7, 0.4 * a * lvl, 0.002, s.d(0.018));
    };
    tap(s.t(0), 1);
    tap(s.t(rand(0.04, 0.06)), rand(0.3, 0.45));
    burst(s, 'white', s.t(0.02), 'bandpass', s.f(4500), 1.2, 0.08 * lvl, s.d(0.006), s.d(0.02));
  },

  footstepGrass: (s) => {
    const t = s.t(0);
    const lvl = rand(0.85, 1);
    const g = s.gain(0);
    const bp = s.filter('bandpass', s.f(rand(2600, 3800)), 0.7, g);
    s.noise('crackle', t, s.ahr(g.gain, t, 1.3 * lvl, s.d(0.02), s.d(0.03), s.d(0.035)), bp, rand(1.2, 1.6));
    burst(s, 'white', t + s.d(0.01), 'highpass', s.f(3500), 0.7, 0.08 * lvl, s.d(0.02), s.d(0.04));
    const n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
      burst(s, 'white', s.t(rand(0, 0.12)), 'bandpass', s.f(rand(1800, 4500)), 1.5, rand(0.05, 0.1) * lvl, 0.003, s.d(0.012));
    }
    burst(s, 'brown', t, 'lowpass', s.f(180), 0.7, 0.22 * lvl, 0.003, s.d(0.025));
  },

  footstepWater: (s) => {
    const t = s.t(0);
    const lvl = rand(0.85, 1);
    const f = burst(s, 'white', t, 'bandpass', s.f(1500), 0.9, 0.35 * lvl, s.d(0.006), s.d(0.04));
    s.sweep(f.frequency, t, s.d(0.12), s.f(rand(1300, 1700)), s.f(rand(500, 650)));
    burst(s, 'white', t, 'highpass', s.f(3200), 0.7, 0.1 * lvl, s.d(0.004), s.d(0.03));
    burst(s, 'brown', t, 'lowpass', s.f(450), 0.7, 0.4 * lvl, s.d(0.008), s.d(0.05));
    const n = randInt(2, 3);
    for (let i = 0; i < n; i++) bloop(s, s.t(rand(0.01, 0.12)), s.f(rand(700, 1400)), rand(1.4, 1.9), s.d(rand(0.03, 0.05)), rand(0.04, 0.08) * lvl);
  },

  // ----------------------------------------------------------------- movement / bodies
  dodgeRoll: (s) => {
    const t = s.t(0);
    const dur = s.d(rand(0.34, 0.4));
    whoosh(s, 'pink', t, dur, [s.f(320), s.f(rand(850, 1050)), s.f(380)], 0.8, 0.9, 0.4, 1.3);
    const gr = s.gain(0);
    const bpr = s.filter('bandpass', s.f(rand(2200, 3000)), 0.8, gr);
    s.bell(gr.gain, t, dur * 1.1, 0.5, 0.45, 1);
    s.noise('crackle', t, t + dur * 1.1 + 0.01, bpr, 1.3);
    const thud = (t0: number, a: number): void => {
      burst(s, 'brown', t0, 'lowpass', s.f(260), 0.7, 0.7 * a, 0.004, s.d(0.04));
      thump(s, t0, s.f(90), s.f(52), s.d(0.05), 0.3 * a, s.d(0.045));
    };
    thud(s.t(0.05), 1);
    thud(s.t(rand(0.26, 0.31)), 0.65);
    if (chance(0.5)) ping(s, s.t(rand(0.08, 0.2)), s.f(rand(3000, 4200)), 0.025, s.d(0.06));
  },

  bodyFall: (s) => {
    fall(s, s.t(0), 0.75);
    if (chance(0.4)) {
      const n = randInt(1, 3);
      for (let i = 0; i < n; i++) ping(s, s.t(rand(0.02, 0.25)), s.f(rand(1800, 3200)), 0.03, s.d(0.08));
    }
  },

  playerHurt: (s) => {
    const t = s.t(0);
    impact(s, t, 0.85);
    vocal(s, {
      start: s.t(0.012),
      dur: s.d(rand(0.16, 0.2)),
      contour: [
        [0, s.f(165)],
        [0.15, s.f(rand(205, 225))],
        [1, s.f(rand(120, 135))],
      ],
      formants: [
        { f: s.f(650), to: s.f(560), q: 3, gain: 1 },
        { f: s.f(1150), to: s.f(1000), q: 5, gain: 0.55 },
        { f: s.f(2500), q: 8, gain: 0.25 },
      ],
      level: 0.9,
      attack: s.d(0.012),
      release: s.d(0.04),
      growl: 0.25,
      growlRate: rand(30, 40),
      breath: 0.25,
      jitter: 6,
    });
  },

  playerDeath: (s) => {
    const t = s.t(0);
    impact(s, t, 1);
    vocal(s, {
      start: s.t(0.02),
      dur: s.d(0.85),
      contour: [
        [0, s.f(150)],
        [0.08, s.f(175)],
        [0.35, s.f(140)],
        [1, s.f(82)],
      ],
      formants: [
        { f: s.f(780), to: s.f(520), q: 2.8, gain: 1 },
        { f: s.f(1200), to: s.f(900), q: 4.5, gain: 0.55 },
        { f: s.f(2600), to: s.f(2300), q: 7, gain: 0.22 },
      ],
      level: 0.75,
      attack: s.d(0.03),
      release: s.d(0.12),
      growl: 0.3,
      growlRate: 33,
      breath: 0.35,
      jitter: 7,
    });
    const g = s.gain(0);
    const bp = s.filter('bandpass', s.f(1200), 1, g);
    s.bell(g.gain, s.t(0.7), s.d(0.5), 0.6, 0.3, 1);
    s.noise('pink', s.t(0.7), s.t(1.21), bp);
    fall(s, s.t(0.55), 0.6);
  },

  enemyHurt: (s) => {
    const t = s.t(0);
    impact(s, t, 0.85);
    vocal(s, {
      start: s.t(0.01),
      dur: s.d(rand(0.18, 0.22)),
      contour: [
        [0, s.f(115)],
        [0.2, s.f(rand(130, 140))],
        [1, s.f(rand(78, 86))],
      ],
      formants: [
        { f: s.f(560), to: s.f(500), q: 2.5, gain: 1 },
        { f: s.f(950), to: s.f(850), q: 4, gain: 0.55 },
        { f: s.f(2300), q: 7, gain: 0.2 },
      ],
      level: 0.9,
      attack: s.d(0.01),
      release: s.d(0.045),
      growl: 0.55,
      growlRate: rand(42, 55),
      breath: 0.2,
      jitter: 9,
    });
  },

  enemyDeath: (s) => {
    const t = s.t(0);
    impact(s, t, 0.85);
    vocal(s, {
      start: s.t(0.015),
      dur: s.d(0.75),
      contour: [
        [0, s.f(125)],
        [0.1, s.f(140)],
        [0.5, s.f(105)],
        [1, s.f(58)],
      ],
      formants: [
        { f: s.f(700), to: s.f(480), q: 2.5, gain: 1 },
        { f: s.f(1050), to: s.f(820), q: 4, gain: 0.55 },
        { f: s.f(2400), to: s.f(2200), q: 7, gain: 0.2 },
      ],
      level: 0.65,
      attack: s.d(0.02),
      release: s.d(0.1),
      growl: 0.6,
      growlRate: 38,
      breath: 0.3,
      jitter: 10,
    });
    const g = s.gain(0);
    const bp = s.filter('bandpass', s.f(600), 2, g);
    s.bell(g.gain, s.t(0.5), s.d(0.5), 0.5, 0.4, 1);
    s.noise('crackle', s.t(0.5), s.t(1.01), bp, 0.7);
    fall(s, s.t(0.6), 0.6);
  },

  enemyAlert: (s) => {
    vocal(s, {
      start: s.t(0),
      dur: s.d(0.17),
      contour: [
        [0, s.f(140)],
        [0.25, s.f(175)],
        [1, s.f(125)],
      ],
      formants: [
        { f: s.f(800), q: 3, gain: 1 },
        { f: s.f(1250), q: 4, gain: 0.6 },
        { f: s.f(2500), q: 7, gain: 0.25 },
      ],
      level: 0.8,
      attack: s.d(0.01),
      release: s.d(0.04),
      growl: 0.4,
      growlRate: 50,
      breath: 0.35,
      jitter: 8,
    });
    // Blade being drawn: rising metallic scrape ending in a ring.
    const t2 = s.t(0.06);
    const dur = s.d(rand(0.28, 0.34));
    whoosh(s, 'white', t2, dur, [s.f(2400), s.f(4400), s.f(5200)], 7, 0.5, 0.7, 1.3);
    const g = s.gain(0);
    const bp = s.filter('bandpass', s.f(rand(3200, 3500)), 12, g);
    s.bell(g.gain, t2, dur, 0.35, 0.75, 1.5);
    s.noise('white', t2, t2 + dur + 0.01, bp);
    ping(s, t2 + dur * 0.85, s.f(rand(2900, 3400)), 0.05, s.d(0.12));
  },

  enemyTelegraph: (s) => {
    const t = s.t(0);
    const rise = s.d(0.14);
    // Reverse whoosh building into the glint.
    const gw = s.gain(0);
    const bp = s.filter('bandpass', s.f(1400), 2.5, gw);
    s.curve(bp.frequency, t, rise * 1.15, (x) => s.safeHz(s.f(1400) * Math.pow(6200 / 1400, x * x)));
    s.bell(gw.gain, t, rise * 1.15, 0.5, 0.85, 1.6);
    s.noise('white', t, t + rise * 1.15 + 0.01, bp);
    // Glint: bright inharmonic partials with a shimmer.
    const tg = t + rise;
    const trem = s.gain(0.85);
    s.lfo(trem.gain, 16, 0.15, tg, tg + s.d(0.6));
    const f0 = s.f(rand(1900, 2150));
    modal(s, tg, [f0, f0 * 1.006, f0 * 2.32, f0 * 3.81, f0 * 5.27], [0.14, 0.07, 0.11, 0.07, 0.045], [s.d(0.12), s.d(0.11), s.d(0.09), s.d(0.07), s.d(0.05)], trem, 0.002);
    click(s, tg, s.f(5000), 0.25, s.d(0.005));
  },

  // ----------------------------------------------------------------- treasure / shrines
  coins: (s) => {
    coinsInto(s, s.t(0), 1);
  },

  chestOpen: (s) => {
    // Latch: two small metallic clicks.
    for (const off of [0, 0.045]) {
      const tc = s.t(off);
      burst(s, 'white', tc, 'bandpass', s.f(3500), 2, 0.25, 0.0005, s.d(0.004));
      modal(s, tc, [s.f(rand(2700, 2900)), s.f(rand(4000, 4200))], [0.04, 0.025], [s.d(0.03), s.d(0.02)]);
    }
    // Hinge creak.
    creak(s, s.t(0.1), s.d(rand(0.55, 0.7)), s.f(rand(55, 75)), 0.5);
    // Lid thunk.
    const tl = s.t(0.78);
    modal(s, tl, [s.f(rand(135, 150)), s.f(rand(300, 330)), s.f(rand(520, 560))], [0.25, 0.13, 0.06], [s.d(0.06), s.d(0.04), s.d(0.025)]);
    burst(s, 'brown', tl, 'lowpass', s.f(300), 0.7, 0.5, 0.003, s.d(0.05));
    click(s, tl, s.f(1500), 0.12, s.d(0.004));
    // Coins spill.
    coinsInto(s, s.t(0.86), 0.8);
  },

  shrineIgnite: (s) => {
    const t = s.t(0);
    const gf = s.gain(0);
    const lpf = s.filter('lowpass', s.f(220), 0.9, gf);
    s.glide(lpf.frequency, t, s.d(0.8), s.f(220), s.f(rand(2400, 3000)), s.f(700), 0.18);
    s.noise('pink', t, s.perc(gf.gain, t, 0.9, s.d(0.07), s.d(0.22)), lpf);
    thump(s, t, s.f(75), s.f(42), s.d(0.15), 0.4, s.d(0.12));
    fireCrackle(s, s.t(0.05), s.d(2.8), 0.5);
    padChord(s, s.t(0.15), {
      notes: [50, 57, 62, 64, 69],
      attack: s.d(0.45),
      hold: s.d(1.5),
      release: s.d(0.45),
      level: 0.055,
      cutoff: s.f(1500),
      detune: 6,
      spread: 0.45,
      wave: 'sawtooth',
    });
  },

  shrineRest: (s) => {
    const t = s.t(0);
    const g = s.gain(0);
    const lp = s.filter('lowpass', s.f(900), 0.7, g);
    s.bell(g.gain, t, s.d(1.6), 0.25, 0.55, 1);
    s.noise('pink', t, t + s.d(1.6) + 0.01, lp);
    padChord(s, s.t(0.1), {
      notes: [50, 57, 62, 66, 73, 76],
      attack: s.d(0.55),
      hold: s.d(2.3),
      release: s.d(0.5),
      level: 0.05,
      cutoff: s.f(1700),
      detune: 6,
      spread: 0.5,
      wave: 'triangle',
      vibrato: 4,
    });
    [81, 86, 90, 93].forEach((m, i) => {
      const p = s.pan((i / 3 - 0.5) * 0.8);
      bellTone(s, s.t(0.45 + i * 0.28), s.f(midiHz(m)), 0.045, s.d(0.7), p);
    });
    fireCrackle(s, t, s.d(3.6), 0.22);
  },

  // ----------------------------------------------------------------- UI
  uiMove: (s) => {
    const t = s.t(0);
    tone(s, t, s.f(rand(1500, 1540)), 'sine', 0.13, 0.018, s.out, 0.002);
    tone(s, t, s.f(760), 'sine', 0.06, 0.012, s.out, 0.002);
    burst(s, 'white', t, 'bandpass', 4000, 1, 0.05, 0.0003, 0.0025);
  },

  uiConfirm: (s) => {
    const t = s.t(0);
    bellTone(s, t, s.f(880), 0.12, s.d(0.06));
    bellTone(s, s.t(0.075), s.f(1318.5), 0.14, s.d(0.09));
    const g = s.gain(0);
    const o = s.osc('sine', s.f(330), t, s.perc(g.gain, t, 0.08, 0.002, s.d(0.03)), g);
    s.sweep(o.frequency, t, s.d(0.06), s.f(330), s.f(240));
  },

  uiBack: (s) => {
    const t = s.t(0);
    const lp = s.filter('lowpass', s.f(2500), 0.7);
    tone(s, t, s.f(987.8), 'triangle', 0.1, s.d(0.035), lp);
    tone(s, s.t(0.06), s.f(740), 'triangle', 0.11, s.d(0.06), lp);
  },

  lockOn: (s) => {
    const t = s.t(0);
    burst(s, 'white', t, 'bandpass', s.f(4200), 1, 0.12, 0.0003, s.d(0.003));
    const g = s.gain(0);
    const o = s.osc('sine', s.f(900), t, s.perc(g.gain, t, 0.12, s.d(0.005), s.d(0.05)), g);
    s.sweep(o.frequency, t, s.d(0.07), s.f(900), s.f(1700));
    tone(s, s.t(0.055), s.f(2550), 'sine', 0.045, s.d(0.06), s.out, 0.002);
  },

  lockOff: (s) => {
    const t = s.t(0);
    burst(s, 'white', t, 'bandpass', s.f(3600), 1, 0.06, 0.0003, s.d(0.003));
    const g = s.gain(0);
    const o = s.osc('sine', s.f(1500), t, s.perc(g.gain, t, 0.1, s.d(0.004), s.d(0.045)), g);
    s.sweep(o.frequency, t, s.d(0.08), s.f(1500), s.f(780));
  },

  staminaEmpty: (s) => {
    const t = s.t(0);
    const env = s.gain(0);
    s.bell(env.gain, t, s.d(0.26), 0.9, 0.18, 1);
    const b1 = s.filter('bandpass', s.f(1300), 1.3, env);
    const b2g = s.gain(0.5, env);
    const b2 = s.filter('bandpass', s.f(2600), 3, b2g);
    const n = s.noise('pink', t, t + s.d(0.26) + 0.01, b1);
    n.connect(b2);
    const g1 = s.gain(0);
    const o1 = s.osc('sine', s.f(190), t, s.perc(g1.gain, t, 0.14, 0.002, s.d(0.035)), g1);
    s.sweep(o1.frequency, t, s.d(0.05), s.f(190), s.f(160));
    const t2 = s.t(0.085);
    const g2 = s.gain(0);
    const o2 = s.osc('sine', s.f(160), t2, s.perc(g2.gain, t2, 0.1, 0.002, s.d(0.035)), g2);
    s.sweep(o2.frequency, t2, s.d(0.05), s.f(160), s.f(130));
  },

  // ----------------------------------------------------------------- world
  doorSealed: (s) => {
    const t = s.t(0);
    const dur = s.d(2.3);
    const env = (x: number): number => Math.min(1, x / 0.16) * Math.min(1, (1 - x) / 0.3);
    // Stone rumble with grinding tremolo.
    const trem = s.gain(0.8);
    s.lfo(trem.gain, 5.3, 0.12, t, t + dur + 0.02);
    s.lfo(trem.gain, 8.9, 0.08, t, t + dur + 0.02);
    const gr = s.gain(0, trem);
    const lp = s.filter('lowpass', s.f(150), 0.8, gr);
    s.curve(gr.gain, t, dur, (x) => 0.6 * env(x));
    s.noise('brown', t, t + dur + 0.01, lp);
    const gs = s.gain(0);
    s.curve(gs.gain, t, dur, (x) => 0.15 * env(x));
    s.osc('sine', s.f(41), t, t + dur + 0.01, gs);
    const gg = s.gain(0, trem);
    const bp = s.filter('bandpass', s.f(420), 0.8, gg);
    s.curve(gg.gain, t, dur, (x) => 0.35 * env(x) * (0.6 + 0.4 * Math.sin(x * 23)));
    s.noise('crackle', t, t + dur + 0.01, bp, 0.6);
    // Magical hum: beating sine/triangle pairs with vibrato.
    const hum = s.gain(0);
    const humEnv = (x: number): number => Math.min(1, x / 0.25) * Math.min(1, (1 - x) / 0.3);
    s.curve(hum.gain, t, dur, (x) => humEnv(x));
    const notes = [45, 52, 57, 60];
    notes.forEach((m, i) => {
      const f = s.f(midiHz(m));
      const a = [0.07, 0.05, 0.045, 0.035][i];
      for (const d of [-4, 4]) {
        const g = s.gain(a, hum);
        const o = s.osc(i % 2 === 0 ? 'sine' : 'triangle', f, t, t + dur + 0.01, g, d);
        s.lfo(o.detune, rand(4.5, 5.5), 6, t, t + dur + 0.01);
      }
    });
    // Eerie high shimmer with tremolo.
    const sh = s.gain(0.5, hum);
    s.lfo(sh.gain, 7, 0.5, t, t + dur + 0.01);
    s.osc('sine', s.f(1760), t, t + dur + 0.01, s.gain(0.02, sh));
  },

  splash: (s) => {
    const t = s.t(0);
    const lp = burst(s, 'brown', t, 'lowpass', s.f(1400), 0.8, 0.6, s.d(0.005), s.d(0.09));
    s.sweep(lp.frequency, t, s.d(0.25), s.f(1500), s.f(300));
    thump(s, t, s.f(95), s.f(50), s.d(0.08), 0.3, s.d(0.05));
    burst(s, 'pink', t, 'bandpass', s.f(900), 0.7, 0.65, s.d(0.008), s.d(0.12));
    burst(s, 'white', t, 'highpass', s.f(2800), 0.7, 0.18, s.d(0.01), s.d(0.17));
    const nb = randInt(6, 10);
    for (let i = 0; i < nb; i++) bloop(s, s.t(rand(0.02, 0.5)), s.f(rand(450, 1600)), rand(1.4, 2.0), s.d(rand(0.03, 0.06)), rand(0.04, 0.1));
    const nd = randInt(4, 6);
    for (let i = 0; i < nd; i++) bloop(s, s.t(rand(0.3, 0.85)), s.f(rand(1800, 3400)), rand(1.3, 1.6), s.d(0.02), rand(0.02, 0.045));
  },

  // ----------------------------------------------------------------- stingers
  regionDiscovered: (s) => {
    const t = s.t(0);
    padChord(s, t, {
      notes: [50, 57, 62, 66, 69],
      attack: s.d(0.45),
      hold: s.d(1.6),
      release: s.d(0.5),
      level: 0.05,
      cutoff: s.f(2200),
      detune: 8,
      spread: 0.55,
      wave: 'sawtooth',
      brassy: true,
      vibrato: 10,
      formant: { f: 1100, q: 1.5, db: 5 },
    });
    const g = s.gain(0);
    const hp = s.filter('highpass', s.f(6000), 0.7, g);
    s.bell(g.gain, t, s.d(2.6), 0.02, 0.5, 1);
    s.noise('white', t, t + s.d(2.6) + 0.01, hp);
  },

  youDied: (s) => {
    const t = s.t(0);
    thump(s, t, s.f(58), s.f(32), s.d(0.6), 0.5, s.d(0.45));
    burst(s, 'brown', t, 'lowpass', s.f(140), 0.7, 0.6, 0.01, s.d(0.5));
    const g = s.gain(0);
    const lp = s.filter('lowpass', s.f(500), 0.7, g);
    s.bell(g.gain, t, s.d(2.5), 0.12, 0.4, 1);
    s.noise('pink', t, t + s.d(2.5) + 0.01, lp);
    padChord(s, s.t(0.1), {
      notes: [38, 45, 50, 53],
      attack: s.d(0.55),
      hold: s.d(2.9),
      release: s.d(0.6),
      level: 0.07,
      cutoff: s.f(900),
      detune: 5,
      spread: 0.4,
      wave: 'sawtooth',
      brassy: true,
      vibrato: 6,
      formant: { f: 450, q: 2, db: 5 },
    });
    padChord(s, s.t(0.6), {
      notes: [51],
      attack: s.d(0.8),
      hold: s.d(2.2),
      release: s.d(0.6),
      level: 0.025,
      cutoff: s.f(700),
      detune: 7,
      spread: 0,
      wave: 'sawtooth',
    });
  },

  victory: (s) => {
    const t = s.t(0);
    const t2 = s.t(0.14);
    brassStab(s, t, [55, 59, 62, 67], s.d(0.08), s.d(0.05), 0.07);
    brassStab(s, t2, [48, 55, 60, 64, 67, 72], s.d(0.45), s.d(0.28), 0.07);
    thump(s, t2, s.f(98), s.f(82), s.d(0.2), 0.4, s.d(0.28));
    burst(s, 'brown', t2, 'lowpass', s.f(400), 0.7, 0.4, 0.003, s.d(0.03));
    burst(s, 'white', t2, 'highpass', s.f(7000), 0.7, 0.06, 0.003, s.d(0.45));
  },
};

/** Per-voice safety: transparent below 0.8, saturating smoothly towards 0.9 (never above). */
let voiceClipCurve: Float32Array<ArrayBuffer> | null = null;

/**
 * Plays the synthesized recipe for `id` into `out` at `opts.when` (absolute context time).
 * Every recipe ends in a soft clipper, so a voice can never peak above 0.9 even when its random
 * layers happen to align. Never throws for unknown ids or closed contexts.
 */
export function playSynth(ctx: BaseAudioContext, out: AudioNode, id: SoundId, opts: SynthOptions = {}): void {
  const recipe = RECIPES[id];
  if (!recipe) return;
  const volume = Math.max(0, opts.volume ?? 1);
  if (!(volume > 0)) return;
  const pitch = clamp(Number.isFinite(opts.pitch) ? (opts.pitch as number) : 1, 0.25, 4);
  const when = Math.max(Number.isFinite(opts.when) ? (opts.when as number) : ctx.currentTime, ctx.currentTime);
  try {
    voiceClipCurve ??= softClipCurve(0.8, 0.9);
    const clip = new WaveShaperNode(ctx, { curve: voiceClipCurve });
    clip.connect(out);
    const master = new GainNode(ctx, { gain: Math.min(volume, 4) });
    master.connect(clip);
    const synth = new Synth(ctx, master, when, pitch);
    recipe(synth);
    // Detach the finished sub-graph so it can be garbage collected.
    synth.onEnded(() => {
      master.disconnect();
      clip.disconnect();
    });
  } catch (err) {
    console.warn(`[audio] synth recipe "${id}" failed`, err);
  }
}
