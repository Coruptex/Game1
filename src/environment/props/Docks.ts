import * as THREE from 'three';
import { bakeGroundAO, jitterColors, paint } from '../../assets/geometry/GeometryUtils';
import { Palette } from '../../assets/materials/MaterialLibrary';
import { Rng } from '../../utils/random';
import type { LocalCollider, LocalPlatform, PropDefinition } from '../PropTypes';
import {
  PartSet,
  V3,
  beamBetween,
  box,
  chamferBox,
  grainUV,
  jitterCorners,
  kitNoise,
  lathe,
  lin,
  mix,
  plankUV,
  post,
  projectUV,
  rampColor,
  rodBetween,
  ropeAlong,
  ropeWrap,
  sagPoints,
  sagRope,
  seedOf,
  shade,
  tone,
  torus,
  woodTint,
  xf,
  type Geo,
} from './PropKit';

/**
 * Procedural harbour docks: pier sections, stairs, gangplanks and the stone quay wall.
 *
 * Frame conventions (prop-local, metres, +Y up):
 * - Sea level is y = 0. Dock decks are at `deckHeight` (default 1.75, see HarborLayout.docks.height).
 * - Dock sections, stairs and gangplanks run along local +Z starting at z = 0, centred on x = 0.
 *   "left" = +X side, "right" = -X side when walking toward +Z.
 * - The quay wall runs along local X (centred), its sea-facing front is at z = 0 facing +Z.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const WATERLINE: Array<[number, number, number, number]> = [
  [-0.7, 0.3, 0.42, 0.36],
  [-0.12, 0.38, 0.5, 0.34],
  [0.1, 0.48, 0.68, 0.28],
  [0.42, 0.62, 0.74, 0.42],
  [0.78, 0.82, 0.8, 0.68],
  [1.15, 1, 1, 1],
];

/** Wet / algae multiplier for timber near the water line (y relative to sea level). */
export function waterlineTint(y: number, out: THREE.Color): THREE.Color {
  return rampColor(WATERLINE, y, out);
}

/** Shortens one corner of a plank end (diagonal broken end). Plank must run along X, centred. */
function jagEnd(g: Geo, side: number, jag: number): void {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (x * side > 0 && z > 0) pos.setX(i, x - side * jag);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

export interface PlankDeckOptions {
  /** Plank span along X (planks run along X). */
  x0: number;
  x1: number;
  /** Deck extent along Z. */
  z0: number;
  z1: number;
  /** Top surface height. */
  top: number;
  thickness?: number;
  /** Average plank width (along Z). */
  plankWidth?: number;
  gap?: number;
  /** Random extra length at both plank ends (ragged edges). */
  overhang?: number;
  /** Chance per plank of a broken / shortened end. */
  broken?: number;
}

/** Individual weathered planks laid across X between z0 and z1 (one texture plank per plank). */
export function plankDeck(ps: PartSet, rng: Rng, o: PlankDeckOptions): void {
  const T = o.thickness ?? 0.09;
  const len = o.z1 - o.z0;
  const avgW = o.plankWidth ?? 0.29;
  const gap = o.gap ?? 0.024;
  const n = Math.max(1, Math.round(len / (avgW + gap)));
  const raw: number[] = [];
  for (let i = 0; i < n; i++) raw.push(rng.range(0.82, 1.18));
  const sum = raw.reduce((a, b) => a + b, 0);
  const avail = len - gap * n;
  const over = o.overhang ?? 0.07;
  let z = o.z0 + gap / 2;
  for (let i = 0; i < n; i++) {
    const pw = (raw[i] / sum) * avail;
    const zc = z + pw / 2;
    z += pw + gap;
    let a = o.x0 - rng.range(0, over);
    let b = o.x1 + rng.range(0, over);
    let broken = 0;
    if (o.broken && rng.chance(o.broken)) {
      broken = rng.sign();
      const cut = Math.min(rng.range(0.25, 0.7), (b - a) * 0.3);
      if (broken < 0) a += cut;
      else b -= cut;
    }
    const g = new THREE.BoxGeometry(b - a, T, pw);
    projectUV(g, plankUV('x', pw, rng));
    jitterCorners(g, 0.007, rng);
    if (broken !== 0) jagEnd(g, broken, rng.range(0.05, 0.14));
    paint(g, woodTint(rng, 0.8, 1.03));
    jitterColors(g, 0.14, 1.3, rng.range(0, 50));
    xf(
      g,
      (a + b) / 2,
      o.top - T / 2 + rng.range(-0.012, 0.004),
      zc + rng.range(-0.004, 0.004),
      rng.range(-0.01, 0.01),
      rng.range(-0.012, 0.012),
      rng.range(-0.006, 0.006),
    );
    ps.add('woodPlanks', g);
  }
}

// ---------------------------------------------------------------------------
// Dock section
// ---------------------------------------------------------------------------

export type DockRailing = 'none' | 'left' | 'right' | 'both';

export interface DockSectionOptions {
  /** Length along +Z (from z = 0 to z = length). */
  length: number;
  /** Deck width along X, centred on x = 0. */
  width: number;
  /** Deck top above sea level (default 1.75). */
  deckHeight?: number;
  /** How far the pilings reach below y = 0 (default 2.5). */
  seabedDepth?: number;
  /** Target distance between piling rows (default 2.4). */
  postSpacing?: number;
  /** Low rope railing: 'left' = +X side, 'right' = -X side (walking toward +Z). */
  railing?: DockRailing;
  seed?: number;
}

/** Deck plank thickness used by the dock builders. */
export const DOCK_PLANK_THICKNESS = 0.09;

/**
 * Straight wooden pier along +Z: weathered planks across the width (ragged ends, a few broken
 * edge planks), stringers + pile caps underneath, round pilings with a wet / algae band at the
 * water line, bollards with rope lashings and an optional low rope railing.
 *
 * Platform: the whole deck (thickness 2.5). Colliders: only bollards that stick up above the deck
 * and the railing sides.
 */
export function buildDockSection(opts: DockSectionOptions): PropDefinition {
  const L = Math.max(1, opts.length);
  const W = Math.max(0.8, opts.width);
  const H = opts.deckHeight ?? 1.75;
  const bed = Math.max(0.2, opts.seabedDepth ?? 2.5);
  const spacing = Math.max(0.8, opts.postSpacing ?? 2.4);
  const railing = opts.railing ?? 'none';
  const rng = new Rng(seedOf(opts.seed ?? 1, 11));
  const ps = new PartSet();
  const colliders: LocalCollider[] = [];
  const T = DOCK_PLANK_THICKNESS;
  const under = H - T;

  // --- deck planks ---
  plankDeck(ps, rng, { x0: -W / 2, x1: W / 2, z0: 0, z1: L, top: H, thickness: T, broken: 0.09 });

  // --- stringers (joists along Z) ---
  const nStr = Math.max(2, Math.round(W / 1.25) + 1);
  for (let s = 0; s < nStr; s++) {
    const x = -W / 2 + 0.22 + ((W - 0.44) * s) / (nStr - 1);
    ps.add(
      'wood',
      box(0.15, 0.22, L - 0.03, x, under - 0.11, L / 2, { uv: grainUV('z', rng, 2.2, 0.9), jitter: 0.01, rng, color: lin(rng.range(0.6, 0.72)) }),
    );
  }

  // --- piling rows (posts at both ends of the section) ---
  const nSpan = Math.max(1, Math.round((L - 0.5) / spacing));
  const rows: number[] = [];
  for (let i = 0; i <= nSpan; i++) rows.push(0.25 + ((L - 0.5) * i) / nSpan);
  const capY = under - 0.22 - 0.1;
  for (const zr of rows) {
    ps.add('wood', box(W + 0.85, 0.2, 0.2, 0, capY, zr, { uv: grainUV('x', rng, 2.2, 0.9), jitter: 0.012, rng, color: lin(rng.range(0.62, 0.74)) }));
  }

  const hasRail = (side: number) => railing === 'both' || (railing === 'left' && side > 0) || (railing === 'right' && side < 0);
  const railY = H + 0.8;
  const postX = W / 2 + 0.18;
  const railPts = new Map<number, THREE.Vector3[]>([
    [-1, []],
    [1, []],
  ]);
  const ringsY = [-0.7, -0.12, 0.1, 0.42, 0.78, 1.15, H - 0.3, H + 0.1];
  for (const zr of rows) {
    for (const side of [-1, 1]) {
      const r = rng.range(0.17, 0.215);
      const x = side * postX + rng.range(-0.015, 0.015);
      const z = zr + rng.range(-0.03, 0.03);
      const rail = hasRail(side);
      const bollard = !rail && rng.chance(0.4);
      const top = rail ? H + rng.range(0.92, 1.0) : bollard ? H + rng.range(0.45, 0.8) : H - rng.range(0.005, 0.035);
      const lean: [number, number] = [rng.range(-0.012, 0.012), rng.range(-0.012, 0.012)];
      const g = post({
        radius: r,
        radiusTop: r * 0.94,
        y0: -bed,
        y1: top,
        rings: ringsY,
        radial: 9,
        jitter: 0.07,
        seed: rng.range(0, 100),
        lean,
        along: 2.2,
        across: 1.0,
        u0: rng.next(),
        cap: 'dome',
        tint: waterlineTint,
      });
      xf(g, x, 0, z);
      ps.add('wood', g);
      const at = (y: number) => V3(x + lean[0] * (y + bed), y, z + lean[1] * (y + bed));
      if (top > H + 0.3) {
        const wr = r * 0.97 + 0.026;
        if (rail) {
          const p = at(railY);
          ps.add('rope', ropeWrap(p.x, p.y, p.z, wr, 0.033, rng));
          railPts.get(side)!.push(p);
        } else {
          const p1 = at(top - 0.17);
          const p2 = at(top - 0.27);
          ps.add('rope', [ropeWrap(p1.x, p1.y, p1.z, wr, 0.035, rng), ropeWrap(p2.x, p2.y, p2.z, wr, 0.035, rng)]);
          if (rng.chance(0.55)) {
            const s = at(top - 0.3).add(V3(side * wr, 0, 0));
            ps.add(
              'rope',
              ropeAlong([s, s.clone().add(V3(side * 0.05, -0.22, 0.04)), s.clone().add(V3(side * 0.03, -0.5, -0.03))], 0.03, {
                radial: 4,
                segments: 5,
              }),
            );
          }
          colliders.push({ type: 'circle', x, z, radius: r + 0.03, yMin: -bed, yMax: top });
        }
      }
    }
  }

  // --- middle pilings for wide decks (hidden under the deck, visible at the water line) ---
  if (W > 3.2) {
    const mids = W > 6 ? [-W / 4, 0, W / 4] : [0];
    for (const zr of rows) {
      for (const mx of mids) {
        const g = post({
          radius: rng.range(0.14, 0.17),
          y0: -bed,
          y1: capY - 0.095,
          rings: [-0.12, 0.1, 0.42, 0.78],
          radial: 7,
          jitter: 0.06,
          seed: rng.range(0, 100),
          along: 2.2,
          across: 1,
          u0: rng.next(),
          cap: 'flat',
          tint: waterlineTint,
        });
        xf(g, mx + rng.range(-0.05, 0.05), 0, zr);
        ps.add('wood', g);
      }
    }
  }

  // --- diagonal side bracing between piling rows ---
  const braceX = postX + 0.235;
  for (const side of [-1, 1]) {
    for (let i = 0; i + 1 < rows.length; i++) {
      const lo = -0.55;
      const hi = capY - 0.02;
      const up = (i + (side > 0 ? 0 : 1)) % 2 === 0;
      const a = V3(side * braceX, up ? lo : hi, rows[i] + 0.12);
      const b = V3(side * braceX, up ? hi : lo, rows[i + 1] - 0.12);
      const g = beamBetween(a, b, 0.07, 0.15, { rng, jitter: 0.008, color: lin(rng.range(0.68, 0.8)), extend: 0.1 });
      shade(g, (_x, y, _z, out) => {
        waterlineTint(y, out);
      });
      ps.add('wood', g);
    }
  }

  // --- rope railing ---
  for (const side of [-1, 1]) {
    const pts = railPts.get(side)!;
    for (let i = 0; i + 1 < pts.length; i++) ps.add('rope', sagRope(pts[i], pts[i + 1], 0.14, 0.032));
    if (hasRail(side)) {
      colliders.push({ type: 'box', x: side * postX, z: L / 2, halfX: 0.16, halfZ: L / 2, yaw: 0, yMin: -bed, yMax: H + 1.0 });
    }
  }

  const platforms: LocalPlatform[] = [{ x: 0, z: L / 2, halfX: W / 2, halfZ: L / 2, yaw: 0, height: H, thickness: 2.5, surface: 'wood' }];
  return { name: 'dock-section', parts: ps.build(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Stairs
// ---------------------------------------------------------------------------

export interface DockStairsOptions {
  width: number;
  /** Height gained between z = 0 (y = 0) and z = run (y = rise). */
  rise: number;
  run: number;
  seed?: number;
}

/**
 * Wooden steps rising along +Z from (z = 0, y = 0) to (z = run, y = rise): plank treads on two
 * diagonal side stringers, foot posts at the bottom. Platform: one ramp with slope rise / run.
 */
export function buildDockStairs(opts: DockStairsOptions): PropDefinition {
  const W = Math.max(0.5, opts.width);
  const R = Math.max(0.15, opts.rise);
  const D = Math.max(0.3, opts.run);
  const rng = new Rng(seedOf(opts.seed ?? 3, 23));
  const ps = new PartSet();
  const colliders: LocalCollider[] = [];
  const n = Math.max(2, Math.round(R / 0.21));
  const sr = D / n;
  const T = 0.07;

  // side stringers
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.05);
    const a = V3(x, -0.16, -0.06);
    const b = V3(x, R - T - 0.1, D + 0.04);
    const g = beamBetween(a, b, 0.09, 0.3, { rng, jitter: 0.01, color: lin(rng.range(0.7, 0.8)) });
    shade(g, (_x, y, _z, out) => {
      waterlineTint(y + 0.9, out);
    });
    ps.add('wood', g);
  }

  // treads (1-2 planks each) + cleats
  for (let i = 1; i <= n; i++) {
    const yTop = (i * R) / n;
    const z0 = (i - 1) * sr;
    const count = Math.max(1, Math.round(sr / 0.3));
    const gap = 0.018;
    const pw = (sr - gap * count) / count;
    for (let k = 0; k < count; k++) {
      const zc = z0 + gap / 2 + pw / 2 + k * (pw + gap);
      const g = new THREE.BoxGeometry(W + 0.1 + rng.range(-0.03, 0.04), T, pw);
      projectUV(g, plankUV('x', pw, rng));
      jitterCorners(g, 0.006, rng);
      paint(g, woodTint(rng, 0.8, 1.02));
      jitterColors(g, 0.14, 1.3, rng.range(0, 50));
      xf(g, rng.range(-0.02, 0.02), yTop - T / 2 + rng.range(-0.008, 0.003), zc, rng.range(-0.01, 0.01), rng.range(-0.015, 0.015), rng.range(-0.01, 0.01));
      ps.add('woodPlanks', g);
    }
    for (const side of [-1, 1]) {
      ps.add('wood', box(0.06, 0.06, sr * 0.7, side * (W / 2 - 0.02), yTop - T - 0.03, z0 + sr / 2, { uv: grainUV('z', rng), color: lin(0.6) }));
    }
  }

  // foot posts
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.17);
    const g = post({
      radius: 0.1,
      y0: -1.6,
      y1: 0.42,
      rings: [-0.7, -0.12, 0.1],
      radial: 7,
      jitter: 0.06,
      seed: rng.range(0, 99),
      along: 2,
      across: 0.8,
      u0: rng.next(),
      cap: 'dome',
      tint: waterlineTint,
    });
    xf(g, x, 0, 0.12);
    ps.add('wood', g);
    colliders.push({ type: 'circle', x, z: 0.12, radius: 0.12, yMin: -1.6, yMax: 0.42 });
  }

  const platforms: LocalPlatform[] = [
    { x: 0, z: D / 2, halfX: W / 2, halfZ: D / 2, yaw: 0, height: R / 2, slope: R / D, thickness: Math.max(0.5, R * 0.6), surface: 'wood' },
  ];
  return { name: 'dock-stairs', parts: ps.build(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Gangplank / rope bridge
// ---------------------------------------------------------------------------

export interface GangplankOptions {
  /** Horizontal length along +Z. */
  length: number;
  /** Height gained from z = 0 (y = 0) to z = length (y = rise). */
  rise: number;
  /** Walkway width (default 0.9). */
  width?: number;
  seed?: number;
}

/**
 * Narrow slatted plank bridge with rope hand-rails and vertical rope ties (like the coastal
 * reference). Platform: ramp; colliders: thin boxes along both sides so nobody falls off.
 */
export function buildGangplank(opts: GangplankOptions): PropDefinition {
  const L = Math.max(1, opts.length);
  const R = opts.rise;
  const W = Math.max(0.5, opts.width ?? 0.9);
  const rng = new Rng(seedOf(opts.seed ?? 5, 31));
  const ps = new PartSet();
  const slope = R / L;
  const ang = Math.atan2(R, L);
  const deckY = (z: number) => z * slope;

  // two long stringers under the slats
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.12);
    ps.add('wood', beamBetween(V3(x, -0.11, -0.06), V3(x, R - 0.11, L + 0.06), 0.1, 0.12, { rng, jitter: 0.008, color: lin(0.66) }));
  }

  // slats
  const nS = Math.max(2, Math.round(Math.hypot(L, R) / 0.29));
  for (let i = 0; i < nS; i++) {
    const z = ((i + 0.5) / nS) * L;
    const pw = 0.2 + rng.range(-0.015, 0.02);
    const g = new THREE.BoxGeometry(W + rng.range(-0.05, 0.05), 0.05, pw);
    projectUV(g, plankUV('x', pw, rng));
    jitterCorners(g, 0.006, rng);
    paint(g, woodTint(rng, 0.78, 1.02));
    jitterColors(g, 0.14, 1.3, rng.range(0, 50));
    xf(g, rng.range(-0.03, 0.03), deckY(z) - 0.025, z, -ang + rng.range(-0.025, 0.025), rng.range(-0.04, 0.04), rng.range(-0.015, 0.015));
    ps.add('woodPlanks', g);
  }

  // end posts + rope hand-rails
  const px = W / 2 + 0.07;
  const postH = 1.05;
  const tops = new Map<number, THREE.Vector3[]>([
    [-1, []],
    [1, []],
  ]);
  for (const ze of [0.06, L - 0.06]) {
    for (const side of [-1, 1]) {
      const yb = deckY(ze);
      const g = post({
        radius: 0.07,
        radiusTop: 0.06,
        y0: yb - 0.45,
        y1: yb + postH,
        radial: 7,
        jitter: 0.06,
        seed: rng.range(0, 99),
        along: 1.6,
        across: 0.6,
        u0: rng.next(),
        cap: 'dome',
      });
      xf(g, side * px, 0, ze);
      ps.add('wood', g);
      const top = V3(side * px, yb + postH - 0.1, ze);
      ps.add('rope', ropeWrap(top.x, top.y, top.z, 0.088, 0.026, rng));
      tops.get(side)!.push(top);
    }
  }
  for (const side of [-1, 1]) {
    const [a, b] = tops.get(side)!;
    const sag = 0.1 + L * 0.012;
    ps.add('rope', sagRope(a, b, sag, 0.03, { segments: Math.max(6, Math.round(L / 0.25)) }));
    const a2 = V3(side * (W / 2 + 0.01), deckY(0.06) + 0.01, 0.06);
    const b2 = V3(side * (W / 2 + 0.01), deckY(L - 0.06) + 0.01, L - 0.06);
    ps.add('rope', ropeAlong([a2, b2], 0.022, { radial: 4, segments: 2 }));
    const nT = Math.max(2, Math.round(L / 0.55));
    const hand = sagPoints(a, b, sag, nT);
    for (let k = 1; k < nT; k++) {
      const bot = new THREE.Vector3().lerpVectors(a2, b2, k / nT);
      ps.add('rope', rodBetween(bot, hand[k], 0.011, 0.011, 3));
    }
  }

  // side walls, split along the length so their vertical extent follows the slope
  const colliders: LocalCollider[] = [];
  const nSeg = Math.max(1, Math.ceil(L / 2.5));
  for (let k = 0; k < nSeg; k++) {
    const za = (k / nSeg) * L;
    const zb = ((k + 1) / nSeg) * L;
    for (const side of [-1, 1]) {
      colliders.push({
        type: 'box',
        x: side * (W / 2 + 0.1),
        z: (za + zb) / 2,
        halfX: 0.08,
        halfZ: (zb - za) / 2,
        yaw: 0,
        yMin: Math.min(deckY(za), deckY(zb)) - 0.4,
        yMax: Math.max(deckY(za), deckY(zb)) + 1.1,
      });
    }
  }
  const platforms: LocalPlatform[] = [{ x: 0, z: L / 2, halfX: W / 2, halfZ: L / 2, yaw: 0, height: R / 2, slope, thickness: 0.6, surface: 'wood' }];
  return { name: 'gangplank', parts: ps.build(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Quay wall
// ---------------------------------------------------------------------------

export interface QuayWallOptions {
  /** Length along X (from -length/2 to +length/2). */
  length: number;
  /** Top of the coping above sea level (default 1.75). */
  height?: number;
  /** How far the wall reaches below sea level (default 3). */
  depth?: number;
  seed?: number;
}

const QUAY_STOPS: Array<[number, number, number, number]> = [
  [-1.4, 0.42, 0.54, 0.5],
  [-0.3, 0.5, 0.62, 0.46],
  [0.0, 0.56, 0.74, 0.4],
  [0.35, 0.64, 0.8, 0.46],
  [0.7, 0.86, 0.88, 0.76],
  [1.05, 1, 1, 0.97],
];

function quayTint(x: number, y: number, out: THREE.Color): THREE.Color {
  const n = kitNoise.noise(x * 0.35, 7.7) * 0.16 + kitNoise.noise(x * 1.3, y * 0.9 + 3.1) * 0.07;
  rampColor(QUAY_STOPS, y - n, out);
  return out.multiplyScalar(1 + kitNoise.noise(x * 0.9 + 11, y * 0.9) * 0.08);
}

interface CourseOpts {
  x0: number;
  x1: number;
  nx: number;
  yb: number;
  yt: number;
  zf: number;
  zBack: number;
  chamfer: number;
  cuts: number[];
  tile: number;
  yRef: number;
  bump: (x: number, y: number) => number;
  tint: (x: number, y: number, out: THREE.Color) => THREE.Color;
}

/** One masonry course of the quay: bumpy front face, chamfered top edge, top ledge and end caps. */
function courseGeometry(o: CourseOpts): Geo {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const col = new THREE.Color();
  const xs: number[] = [];
  for (let i = 0; i <= o.nx; i++) xs.push(o.x0 + ((o.x1 - o.x0) * i) / o.nx);
  const yc = o.yt - o.chamfer;
  const ys = [o.yb, ...o.cuts.filter((y) => y > o.yb + 0.04 && y < yc - 0.04), yc];
  const push = (x: number, y: number, z: number, u: number, v: number) => {
    positions.push(x, y, z);
    uvs.push(u, v);
    o.tint(x, y, col);
    colors.push(col.r, col.g, col.b);
    return positions.length / 3 - 1;
  };
  const grid = (rowsDef: Array<{ y: number; z: number; bump: boolean; v: number }>) => {
    const base = positions.length / 3;
    for (const r of rowsDef) for (const x of xs) push(x, r.y, r.z + (r.bump ? o.bump(x, r.y) : 0), x / o.tile, r.v);
    const row = xs.length;
    for (let j = 0; j < rowsDef.length - 1; j++) {
      for (let i = 0; i < o.nx; i++) {
        const a = base + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        index.push(a, b, d, a, d, c);
      }
    }
  };
  const vOf = (y: number) => (y - o.yRef) / o.tile;
  grid(ys.map((y) => ({ y, z: o.zf, bump: true, v: vOf(y) })));
  grid([
    { y: yc, z: o.zf, bump: true, v: vOf(yc) },
    { y: o.yt, z: o.zf - o.chamfer, bump: true, v: vOf(o.yt) },
  ]);
  grid([
    { y: o.yt, z: o.zf - o.chamfer, bump: true, v: vOf(o.yt) },
    { y: o.yt, z: o.zBack, bump: false, v: vOf(o.yt) + (o.zf - o.zBack) / o.tile },
  ]);
  // end caps
  for (const [x, dir] of [
    [o.x0, -1],
    [o.x1, 1],
  ] as const) {
    const ring: number[] = [];
    ring.push(push(x, o.yb, o.zBack, o.zBack / o.tile, vOf(o.yb)));
    for (const y of ys) ring.push(push(x, y, o.zf + o.bump(x, y), o.zf / o.tile, vOf(y)));
    ring.push(push(x, o.yt, o.zf - o.chamfer + o.bump(x, o.yt), (o.zf - o.chamfer) / o.tile, vOf(o.yt)));
    ring.push(push(x, o.yt, o.zBack, o.zBack / o.tile, vOf(o.yt)));
    const pts = dir < 0 ? ring : [ring[0], ...ring.slice(1).reverse()];
    for (let i = 1; i < pts.length - 1; i++) index.push(pts[0], pts[i], pts[i + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const BOLLARD_PROFILE: Array<[number, number]> = [
  [0, 0],
  [0.25, 0],
  [0.26, 0.06],
  [0.21, 0.12],
  [0.165, 0.2],
  [0.16, 0.34],
  [0.19, 0.42],
  [0.255, 0.49],
  [0.265, 0.55],
  [0.21, 0.61],
  [0.1, 0.65],
  [0, 0.66],
];

/**
 * Massive stone harbour wall along X: masonry courses (~0.6 m, stoneBlocks rows aligned to the
 * geometry) with a slight batter, chamfered course edges, wet / algae band at the water line,
 * walkable coping stones on top, stone bollards (colliders) and iron mooring rings.
 * Front face at z = 0 (facing +Z), body back to z = -2, top at y = height, bottom at y = -depth.
 */
export function buildQuayWall(opts: QuayWallOptions): PropDefinition {
  const L = Math.max(2, opts.length);
  const Ht = opts.height ?? 1.75;
  const D = Math.max(0.5, opts.depth ?? 3);
  const zBack = -2;
  const rng = new Rng(seedOf(opts.seed ?? 9, 41));
  const ps = new PartSet();
  const colliders: LocalCollider[] = [];
  const copingH = 0.3;
  const faceTop = Ht - copingH;
  const y0 = -D;
  const nRows = Math.max(2, Math.round((faceTop - y0) / 0.6));
  const rowH = (faceTop - y0) / nRows;
  const tile = rowH * 6;
  const nx = Math.max(2, Math.ceil(L / 0.55));
  const cuts = [-0.9, -0.3, 0.05, 0.35, 0.65, 1.0];
  let topZf = 0;
  for (let r = 0; r < nRows; r++) {
    const yb = y0 + r * rowH;
    const zf = 0.12 * (1 - r / (nRows - 1)) + rng.range(-0.012, 0.012);
    if (r === nRows - 1) topZf = zf;
    const s = rng.range(0, 100);
    ps.add(
      'stoneBlocks',
      courseGeometry({
        x0: -L / 2,
        x1: L / 2,
        nx,
        yb,
        yt: yb + rowH,
        zf,
        zBack: zBack + 0.05,
        chamfer: 0.055,
        cuts,
        tile,
        yRef: y0,
        bump: (x, y) => 0.014 * kitNoise.noise(x * 1.9 + s, y * 2.3 - s),
        tint: quayTint,
      }),
    );
  }
  // back face (hidden by terrain, keeps the shadow volume closed)
  const back = new THREE.PlaneGeometry(L, faceTop - y0);
  back.rotateY(Math.PI);
  paint(back, lin(0.55));
  ps.add('stoneBlocks', xf(back, 0, (y0 + faceTop) / 2, zBack + 0.05));

  // coping stones (walkable top)
  let x = -L / 2;
  while (x < L / 2 - 0.02) {
    let len = rng.range(0.85, 1.45);
    if (L / 2 - (x + len) < 0.45) len = L / 2 - x;
    const g = chamferBox(len - 0.03, copingH, 2.12, 0.05, { jitter: 0.012, rng });
    projectUV(g, { grain: 'x', along: 1.3, across: 1.3, u0: rng.next(), v0: rng.next() });
    const c = tone(Palette.stone, rng.range(0.9, 1.08));
    if (rng.chance(0.35)) c.lerp(tone(Palette.moss), rng.range(0.08, 0.2));
    paint(g, c);
    jitterColors(g, 0.12, 2.2, rng.range(0, 99));
    xf(g, x + len / 2, Ht - copingH / 2 + rng.range(-0.01, 0.006), -0.96, 0, rng.range(-0.006, 0.006), rng.range(-0.004, 0.004));
    ps.add('stone', g);
    x += len;
  }

  // stone bollards
  const nB = Math.max(1, Math.round(L / 6.5));
  const bollardXs: number[] = [];
  for (let i = 0; i < nB; i++) {
    const bx = -L / 2 + (L * (i + 0.5)) / nB + rng.range(-0.3, 0.3);
    bollardXs.push(bx);
    const g = lathe(BOLLARD_PROFILE, 10, { along: 1.2, across: 1.2, u0: rng.next() });
    paint(g, tone(Palette.stoneDark, rng.range(1.0, 1.15)));
    jitterColors(g, 0.1, 3, rng.range(0, 99));
    bakeGroundAO(g, 0.25, 0.4, 0);
    ps.add('stone', xf(g, bx, Ht - 0.01, -0.55, 0, rng.range(0, 6), 0));
    colliders.push({ type: 'circle', x: bx, z: -0.55, radius: 0.27, yMin: Ht - 0.1, yMax: Ht + 0.68 });
  }
  // a mooring line tied to the first bollard, running over the edge into the water
  {
    const bx = bollardXs[0];
    ps.add('rope', ropeWrap(bx, Ht + 0.28, -0.55, 0.19, 0.035, rng));
    ps.add(
      'rope',
      ropeAlong([V3(bx + 0.15, Ht + 0.28, -0.42), V3(bx + 0.32, Ht + 0.06, 0.08), V3(bx + 0.5, Ht - 0.35, 0.3), V3(bx + 0.8, 0.1, 0.9), V3(bx + 1.0, -0.4, 1.4)], 0.035, {
        radial: 5,
        segments: 18,
      }),
    );
  }

  // iron mooring rings on the face
  const nR = Math.max(1, Math.round(L / 4.2));
  const yRing = faceTop - rowH * 0.42;
  for (let i = 0; i < nR; i++) {
    const rx = -L / 2 + (L * (i + 0.5)) / nR + rng.range(-0.2, 0.2);
    if (bollardXs.some((b) => Math.abs(b - rx) < 0.6) && nR > 1) continue;
    const zf = topZf + 0.03;
    const iron = (f = 1) => mix(Palette.iron, 0x7a4a2a, rng.range(0.15, 0.4)).multiplyScalar(f);
    ps.add('metal', box(0.17, 0.17, 0.035, rx, yRing + 0.05, zf, { color: iron(0.9) }));
    const eye = torus(0.042, 0.015, 4, 8);
    paint(eye, iron());
    ps.add('metal', xf(eye, rx, yRing - 0.02, zf + 0.04, 0, Math.PI / 2, 0));
    const ring = torus(0.15, 0.025, 6, 16);
    paint(ring, iron(1.1));
    ps.add('metal', xf(ring, rx, yRing - 0.17, zf + 0.07, -0.22, 0, 0));
  }

  const platforms: LocalPlatform[] = [
    { x: 0, z: (zBack + 0.1) / 2, halfX: L / 2, halfZ: (0.1 - zBack) / 2, yaw: 0, height: Ht, thickness: Ht + D, surface: 'stone' },
  ];
  return { name: 'quay-wall', parts: ps.build(), colliders, platforms };
}
