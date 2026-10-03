import * as THREE from 'three';
import type { InstancedAsset, LocalCollider, PropDefinition } from '../PropTypes';
import { Rng } from '../../utils/random';
import {
  CORE_UV,
  GeoBuilder,
  UP,
  bentSpine,
  card,
  envelope,
  foldedStrip,
  foliageClump,
  icoBlob,
  leafStations,
  lin,
  memoAsset,
  mix,
  rgb,
  shade,
  smooth01,
  tube,
  vegNoise,
  wrapVariant,
} from './VegUtils';
import { bromeliadWhorls, rosette } from './PlantParts';

/**
 * Trees: coconut palms and giant rainforest trees.
 *
 * Wind note: palmBark & palmLeaf share the same sway (0.4 m per (0.1 * local height)^2), so the trunk,
 * crown, coconuts (palmBark) and frond bases move together. Canopy cards use `canopy` (smallest sway)
 * for high crowns; `canopyLight` only caps the upper clumps.
 */


// ---------------------------------------------------------------------------
// Palm
// ---------------------------------------------------------------------------

interface PalmConfig {
  height: number;
  /** Lean from vertical at the base / top (rad). */
  lean0: number;
  lean1: number;
  leanAz: number;
  sCurve: number;
  fronds: number;
  frondLen: number;
  rBase: number;
  rTop: number;
  coconuts: number;
  dead: number;
  seed: number;
}

const PALMS: PalmConfig[] = [
  { height: 9.4, lean0: 0.3, lean1: 0.05, leanAz: 0.4, sCurve: 0.0, fronds: 14, frondLen: 4.5, rBase: 0.46, rTop: 0.22, coconuts: 5, dead: 2, seed: 11 },
  { height: 8.0, lean0: 0.62, lean1: 0.1, leanAz: 2.3, sCurve: 0.04, fronds: 13, frondLen: 4.2, rBase: 0.44, rTop: 0.21, coconuts: 4, dead: 3, seed: 23 },
  { height: 10.8, lean0: 0.13, lean1: -0.05, leanAz: 4.1, sCurve: 0.07, fronds: 15, frondLen: 4.8, rBase: 0.48, rTop: 0.23, coconuts: 6, dead: 2, seed: 37 },
  { height: 7.1, lean0: 0.44, lean1: 0.2, leanAz: 5.4, sCurve: -0.05, fronds: 12, frondLen: 3.9, rBase: 0.42, rTop: 0.2, coconuts: 3, dead: 2, seed: 41 },
];

/** Leaflet envelope of palmFrondTexture: half width in u along v (measured from the painting code). */
const PALM_ENVELOPE: Array<[number, number]> = [
  [0, 0.07],
  [0.08, 0.13],
  [0.2, 0.215],
  [0.3, 0.28],
  [0.42, 0.34],
  [0.53, 0.335],
  [0.6, 0.29],
  [0.66, 0.235],
  [0.72, 0.17],
  [0.78, 0.13],
  [0.95, 0.125],
  [1, 0.07],
];


/**
 * Coconut palm, 7–11 m. Trunk ring texture spacing ≈ 0.35 m. Crown of drooping, V-folded fronds
 * (texture rachis along the strip, base at v = 0), coconut cluster and dead hanging fronds.
 */
export function palmTree(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, PALMS.length);
  return memoAsset(`veg.palm.${v}`, () => buildPalm(v, PALMS[v]));
}

function buildPalm(v: number, cfg: PalmConfig): InstancedAsset {
  const rng = new Rng(cfg.seed * 7919 + 13);
  const bark = new GeoBuilder();
  const leaf = new GeoBuilder();

  // ---- trunk spine: lean angle eases from lean0 (base) to lean1 (top), slight S-curve -------
  const steps = 40;
  const raw: THREE.Vector3[] = [new THREE.Vector3()];
  const dirH = new THREE.Vector3(Math.sin(cfg.leanAz), 0, Math.cos(cfg.leanAz));
  const perp = new THREE.Vector3(dirH.z, 0, -dirH.x);
  const wob = rng.range(0, 10);
  let p = new THREE.Vector3();
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps;
    const th = cfg.lean0 + (cfg.lean1 - cfg.lean0) * smooth01(t * 1.1) + cfg.sCurve * Math.sin(t * Math.PI * 2);
    const side = 0.05 * vegNoise.noise(t * 2.2 + wob, wob);
    const d = dirH.clone().multiplyScalar(Math.sin(th)).addScaledVector(perp, side).setY(Math.cos(th)).normalize();
    p = p.clone().addScaledVector(d, 1 / steps);
    raw.push(p);
  }
  const scaleY = cfg.height / p.y;
  for (const q of raw) q.multiplyScalar(scaleY);
  // resample stations by height: dense at the flared base
  const ys = [0, 0.12, 0.3, 0.55, 0.9];
  const top = cfg.height;
  const n = 14;
  for (let k = 1; k <= n; k++) ys.push(0.9 + ((top - 0.9) * k) / n);
  const spineAt = (y: number): THREE.Vector3 => {
    for (let k = 1; k < raw.length; k++) {
      if (raw[k].y >= y) {
        const a = raw[k - 1];
        const b = raw[k];
        return a.clone().lerp(b, (y - a.y) / Math.max(1e-6, b.y - a.y));
      }
    }
    return raw[raw.length - 1].clone();
  };
  const trunkPts = ys.map(spineAt);
  // crown shaft continues along the last direction
  const lastDir = trunkPts[trunkPts.length - 1].clone().sub(trunkPts[trunkPts.length - 2]).normalize();
  const crown = trunkPts[trunkPts.length - 1].clone();
  trunkPts.push(crown.clone().addScaledVector(lastDir, 0.22));
  trunkPts.push(crown.clone().addScaledVector(lastDir, 0.45));
  const nT = trunkPts.length;
  const rMid = cfg.rBase * 0.64;
  const radiusAtY = (y: number, k: number): number => {
    if (k === nT - 2) return cfg.rTop * 1.35;
    if (k === nT - 1) return cfg.rTop * 0.95;
    const flare = (cfg.rBase - rMid) * Math.exp(-y / 0.32);
    const taper = rMid + (cfg.rTop - rMid) * Math.min(1, y / top);
    const swell = 1 + 0.12 * smooth01((y - (top - 1.1)) / 0.9);
    const knob = 1 + 0.035 * vegNoise.noise(y * 1.7 + cfg.seed, 3.3);
    return (taper + flare) * swell * knob;
  };
  const trunkCol = (tt: number, q: THREE.Vector3, nrm: THREE.Vector3): THREE.Color => {
    const y = q.y;
    const ao = 0.55 + 0.45 * smooth01(y / 1.3);
    // lichen-grey lower trunk, warmer and darker under the crown
    const c = mix(rgb(1.32, 1.34, 1.36), rgb(1.08, 1.0, 0.9), smooth01((y - top * 0.55) / (top * 0.45)));
    const crownShade = y > top - 0.2 ? 0.8 : 1;
    const side = 0.92 + 0.08 * Math.max(0, nrm.dot(new THREE.Vector3(-0.42, 0.3, 0.46)));
    const j = 1 + 0.07 * vegNoise.noise(q.x * 3 + tt * 5, q.z * 3);
    return c.multiplyScalar(ao * crownShade * side * j);
  };
  tube(bark, trunkPts, {
    radial: 8,
    radius: (_t, k) => radiusAtY(trunkPts[k].y, k),
    uRepeat: 1,
    vPerMetre: 1 / 2.8,
    color: trunkCol,
    capEnd: 'cone',
  });

  // ---- coconuts (palmBark material with a constant light texel so they sway with the trunk) --
  const nutCols = [rgb(0.62, 1.55, 0.32), rgb(0.75, 1.4, 0.3), rgb(1.45, 1.15, 0.4), rgb(1.05, 0.78, 0.36)];
  const axisUp = lastDir.clone();
  const nutRef = new THREE.Vector3().crossVectors(axisUp, new THREE.Vector3(1, 0, 0)).normalize();
  for (let k = 0; k < cfg.coconuts; k++) {
    const ang = (k / cfg.coconuts) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const radial = nutRef.clone().applyAxisAngle(axisUp, ang);
    const r = cfg.rTop * 1.25 + rng.range(0.04, 0.1);
    const c = crown.clone().addScaledVector(radial, r).addScaledVector(axisUp, -0.28 - rng.range(0, 0.28));
    const rad = rng.range(0.12, 0.15);
    const col = nutCols[k % nutCols.length].clone().multiplyScalar(rng.range(0.85, 1.05));
    icoBlob(
      bark,
      c,
      new THREE.Vector3(rad, rad * 1.12, rad),
      0,
      (_q, nn) => col.clone().multiplyScalar(0.75 + 0.25 * Math.max(0, nn.y)),
      () => [0.05, 0.955],
    );
  }

  // ---- fronds ---------------------------------------------------------------------------------
  const golden = 2.39996;
  const az0 = rng.range(0, Math.PI * 2);
  const nF = cfg.fronds;
  for (let i = 0; i < nF; i++) {
    const age = nF === 1 ? 0.5 : i / (nF - 1);
    const az = az0 + i * golden + rng.range(-0.18, 0.18);
    const dirA = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const origin = crown
      .clone()
      .addScaledVector(dirA, cfg.rTop * 0.9)
      .addScaledVector(axisUp, 0.32 - age * 0.42);
    const el0 = THREE.MathUtils.lerp(1.08, 0.18, age) + rng.range(-0.12, 0.12);
    const bend = THREE.MathUtils.lerp(1.25, 1.8, age) + rng.range(-0.15, 0.15);
    const len = cfg.frondLen * THREE.MathUtils.lerp(0.86, 1.04, age) * rng.range(0.92, 1.07);
    const spine = bentSpine(origin, az, el0, bend, len, 8, 1.55, rng.range(-0.28, 0.28));
    const wFull = 0.7 * len;
    const twist = rng.range(-0.35, 0.35);
    // older fronds slightly yellower, young ones fresher
    const tintC = mix(rgb(0.96, 1.06, 0.95), rgb(0.98, 0.86, 0.6), age * 0.85 + rng.range(-0.1, 0.12)).multiplyScalar(rng.range(0.82, 1.04));
    const st = leafStations(spine, UP, (t) => {
      const base = 0.55 + 0.5 * smooth01(t * 1.6);
      const c = shade(tintC, base);
      return {
        hw: (envelope(PALM_ENVELOPE, t) + 0.015) * wFull,
        uHalf: envelope(PALM_ENVELOPE, t) + 0.015,
        fold: 0.2 + 0.4 * t,
        v: t,
        cCenter: c,
        cEdge: shade(c, 1.08, 0.04),
        roll: twist * t,
      };
    });
    const bias = dirA.clone().multiplyScalar(0.35).add(UP).normalize();
    foldedStrip(leaf, st, bias, 0.55, 2);
  }
  // dead fronds hanging down along the trunk
  for (let i = 0; i < cfg.dead; i++) {
    const az = az0 + (i + 0.5) * ((Math.PI * 2) / cfg.dead) + rng.range(-0.5, 0.5);
    const dirA = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const origin = crown.clone().addScaledVector(dirA, cfg.rTop * 1.1).addScaledVector(axisUp, -0.35 - rng.range(0, 0.2));
    const len = rng.range(2.0, 2.8);
    const spine = bentSpine(origin, az, -0.15, 1.25, len, 5, 0.7, rng.range(-0.2, 0.2));
    const wFull = 0.5 * len;
    const brown = rgb(1.45, 0.66, 0.3).multiplyScalar(rng.range(0.85, 1.05));
    const st = leafStations(spine, dirA, (t) => {
      const c = shade(brown, 0.6 + 0.45 * t);
      return {
        hw: envelope(PALM_ENVELOPE, t) * 0.55 * wFull,
        uHalf: envelope(PALM_ENVELOPE, t) + 0.01,
        fold: 1.0 + 0.2 * t,
        v: t,
        cCenter: c,
        cEdge: shade(c, 1.05),
        roll: 0,
      };
    });
    foldedStrip(leaf, st, dirA, 0.4);
  }

  return {
    name: `veg.palm.${v}`,
    parts: [
      { geometry: bark.build(), material: 'palmBark', castShadow: true },
      { geometry: leaf.build(), material: 'palmLeaf', castShadow: true },
    ],
    collider: { radius: 0.35, height: 6 },
  };
}

// ---------------------------------------------------------------------------
// Rainforest trees
// ---------------------------------------------------------------------------

interface JungleConfig {
  /** Height where the main limbs fork. */
  trunkTop: number;
  /** Leader length above the fork. */
  leader: number;
  rTrunk: number;
  fins: number;
  finReach: [number, number];
  finHeight: [number, number];
  limbs: number;
  /** Horizontal crown radius. */
  crown: number;
  lean: number;
  leanAz: number;
  vines: number;
  loops: number;
  strands: number;
  cards: number;
  bromeliads: number;
  seed: number;
}

const JUNGLE: JungleConfig[] = [
  { trunkTop: 14.5, leader: 3.6, rTrunk: 1.05, fins: 5, finReach: [2.0, 3.0], finHeight: [5.0, 7.0], limbs: 5, crown: 9.4, lean: 0.03, leanAz: 0.6, vines: 10, loops: 2, strands: 3, cards: 1000, bromeliads: 2, seed: 5 },
  { trunkTop: 12.6, leader: 3.2, rTrunk: 0.95, fins: 6, finReach: [1.7, 2.6], finHeight: [3.8, 5.4], limbs: 4, crown: 8.0, lean: 0.05, leanAz: 2.0, vines: 12, loops: 2, strands: 6, cards: 900, bromeliads: 2, seed: 17 },
  { trunkTop: 11.2, leader: 3.0, rTrunk: 0.86, fins: 4, finReach: [1.6, 2.5], finHeight: [3.4, 5.0], limbs: 4, crown: 7.4, lean: 0.09, leanAz: 4.0, vines: 9, loops: 1, strands: 2, cards: 820, bromeliads: 2, seed: 29 },
];

interface Limb {
  pts: THREE.Vector3[];
  r0: number;
  r1: number;
}

/** Point along a polyline at normalised arc length t. */
function pointAt(pts: THREE.Vector3[], t: number): THREE.Vector3 {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  return pts[k].clone().lerp(pts[k + 1], f - k);
}

function tangentAt(pts: THREE.Vector3[], t: number): THREE.Vector3 {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  return pts[k + 1].clone().sub(pts[k]).normalize();
}

function wrapAngle(a: number): number {
  let x = (a + Math.PI) % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x - Math.PI;
}

const BARK_MOSS = rgb(1.3, 2.0, 0.78);

/** Bark tint with moss on upward-facing / low surfaces and contact darkening. */
function barkColor(p: THREE.Vector3, n: THREE.Vector3, mossBias: number, seed: number): THREE.Color {
  const ao = 0.62 + 0.38 * smooth01(p.y / 2.0);
  const patch = vegNoise.noise(p.x * 0.45 + seed, p.y * 0.35 + p.z * 0.45);
  const moss = THREE.MathUtils.clamp(0.3 + patch * 0.7 + Math.max(0, n.y) * 0.8 + mossBias - p.y * 0.035, 0, 1);
  // the jungleBark texture is dark: lift it to a warm grey-brown, lighter higher up
  const base = mix(rgb(2.0, 1.85, 1.62), rgb(2.05, 1.95, 1.8), smooth01(p.y / 14));
  const c = mix(base, BARK_MOSS, moss * 0.7);
  const j = 1 + 0.08 * vegNoise.noise(p.x * 2.1 - seed, p.z * 2.1 + p.y);
  return c.multiplyScalar(ao * j);
}

/**
 * Plank-like buttress fin: a thin curved wall from inside the trunk out to the ground.
 * Cross-section is a rounded blade (7 vertices), fibres run along the fin.
 */
function buttressFin(b: GeoBuilder, rng: Rng, az: number, rIn: number, rOut: number, h: number, seed: number): THREE.Vector3 {
  const nA = 8;
  const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
  const perp = new THREE.Vector3(dir.z, 0, -dir.x);
  const snake = rng.range(-0.45, 0.45);
  const centre = (a: number): THREE.Vector3 =>
    dir
      .clone()
      .multiplyScalar(rIn + (rOut - rIn) * a)
      .addScaledVector(perp, snake * Math.sin(a * Math.PI * 0.9) * a * 1.6);
  const thick0 = rng.range(0.38, 0.5);
  const rows: number[][] = [];
  const finLen = rOut - rIn;
  for (let i = 0; i <= nA; i++) {
    const a = i / nA;
    const c = centre(a);
    const tan = centre(Math.min(1, a + 0.02)).sub(centre(Math.max(0, a - 0.02))).normalize();
    const side = new THREE.Vector3(tan.z, 0, -tan.x);
    const yTop = Math.max(0.1, h * Math.pow(1 - a, 1.2) * (1 - 0.15 * a));
    const ht = THREE.MathUtils.lerp(thick0, 0.11, Math.pow(a, 1.1));
    // profile: L0 (buried) -> L1 -> L2 -> T -> R2 -> R1 -> R0
    const prof: Array<[number, number, number, number]> = [
      // [side offset, y, normal side, normal up]
      [ht * 1.35, -0.2, 1, 0.1],
      [ht * 1.05, yTop * 0.42, 1, 0.12],
      [ht * 0.8, yTop * 0.84, 0.75, 0.6],
      [0, yTop + ht * 0.35, 0, 1],
      [-ht * 0.8, yTop * 0.84, -0.75, 0.6],
      [-ht * 1.05, yTop * 0.42, -1, 0.12],
      [-ht * 1.35, -0.2, -1, 0.1],
    ];
    const row: number[] = [];
    let perim = 0;
    let prev: THREE.Vector3 | null = null;
    for (const [so, y, ns, nu] of prof) {
      const p = c.clone().addScaledVector(side, so);
      p.y = y;
      if (prev) perim += prev.distanceTo(p);
      prev = p.clone();
      const n = side.clone().multiplyScalar(ns).add(new THREE.Vector3(0, nu, 0)).addScaledVector(dir, 0.15).normalize();
      row.push(b.vert(p, n, perim / 2.2, (a * finLen) / 3.5, barkColor(p, n, 0.15, seed)));
    }
    rows.push(row);
  }
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < 6; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
  }
  return centre(1);
}

const jungleAnchors = new Map<number, THREE.Vector3[]>();
const jungleColliders = new Map<number, LocalCollider[]>();

/**
 * Points under the main limbs of `jungleTree(variant)` (tree-local space, y = limb underside),
 * handy for hanging extra `hangingVines`, perching birds or placing epiphytes.
 */
export function jungleTreeAnchors(variant = 0): THREE.Vector3[] {
  const v = wrapVariant(variant, JUNGLE.length);
  jungleTree(v);
  return (jungleAnchors.get(v) ?? []).map((p) => p.clone());
}

/**
 * Giant rainforest tree, 18–26 m: flared plank buttresses, gnarled trunk with strangler roots,
 * big limbs, a layered painterly canopy (canopy + canopyLight cards on ellipsoid clumps with
 * ellipsoid normals), hanging vines with leaves and epiphytes (moss cushions, bromeliads).
 * Parts: jungleBark (trunk, fins, roots, limbs, vines), canopy (cards + vine leaves), canopyLight
 * (sunlit clump tops), canopy (clump cores, no shadow -> dappled light), vertexColor (epiphytes).
 * Collider r 1.6, h 8. See `jungleTreeProp` for a see-through static version with fin colliders.
 */
export function jungleTree(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, JUNGLE.length);
  return memoAsset(`veg.jungleTree.${v}`, () => buildJungleTree(v, JUNGLE[v]));
}

/**
 * The giant tree as a static `PropDefinition` (for trees next to walkable paths): every part uses
 * the dithered see-through variant so the canopy / trunk never hide the player, and the buttress
 * fins get their own box colliders (trunk circle r ≈ 1.2 × trunk radius, h 9).
 * (The StaticBatcher bakes the prop-local height for wind, so it sways like the instanced version.)
 */
export function jungleTreeProp(variant = 0): PropDefinition {
  const v = wrapVariant(variant, JUNGLE.length);
  const asset = jungleTree(v);
  return {
    name: `veg.jungleTreeProp.${v}`,
    parts: asset.parts.map((p) => ({ geometry: p.geometry, material: p.material, seeThrough: true, castShadow: p.castShadow ?? true })),
    colliders: (jungleColliders.get(v) ?? []).map((c) => ({ ...c })),
  };
}

interface ClumpSpec {
  c: THREE.Vector3;
  r: THREE.Vector3;
  weight: number;
}

function buildJungleTree(v: number, cfg: JungleConfig): InstancedAsset {
  const rng = new Rng(cfg.seed * 104729 + 7);
  const bark = new GeoBuilder();
  const leaves = new GeoBuilder();
  const light = new GeoBuilder();
  const cores = new GeoBuilder();
  const epi = new GeoBuilder();
  const seed = cfg.seed * 3.1;

  // ---- trunk spine --------------------------------------------------------------------------
  const top = cfg.trunkTop;
  const leanDir = new THREE.Vector3(Math.sin(cfg.leanAz), 0, Math.cos(cfg.leanAz));
  const spineAt = (y: number): THREE.Vector3 => {
    const w = 0.35 * smooth01(y / 6);
    return new THREE.Vector3(
      leanDir.x * cfg.lean * y + w * vegNoise.noise(y * 0.12 + seed, 1.7),
      y,
      leanDir.z * cfg.lean * y + w * vegNoise.noise(y * 0.12 - seed, 5.3),
    );
  };
  const finAz: number[] = [];
  const finH: number[] = [];
  const az0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < cfg.fins; i++) {
    finAz.push(az0 + (i / cfg.fins) * Math.PI * 2 + rng.range(-0.35, 0.35));
    finH.push(rng.range(cfg.finHeight[0], cfg.finHeight[1]));
  }
  const coreR = (y: number): number => {
    const flare = 1 + 0.42 * Math.exp(-y / 1.5);
    const taper = 1 - 0.34 * smooth01(y / top);
    const lead = y > top ? THREE.MathUtils.lerp(1, 0.38, (y - top) / cfg.leader) : 1;
    return cfg.rTrunk * flare * taper * lead;
  };
  const trunkBump = (y: number, a: number): number => {
    let bump = 0.075 * vegNoise.noise(Math.cos(a) * 1.4 + y * 0.22 + seed, Math.sin(a) * 1.4 - y * 0.1);
    bump += 0.05 * vegNoise.noise(a * 3.0 + seed, y * 0.9);
    for (let j = 0; j < finAz.length; j++) {
      const d = wrapAngle(a - finAz[j]);
      const k = Math.max(0, 1 - y / (finH[j] * 1.25));
      bump += 0.32 * Math.exp(-(d * d) / (0.3 * 0.3)) * Math.pow(k, 1.4);
    }
    return bump;
  };
  const ys = [0, 0.3, 0.75, 1.35, 2.1, 3.0, 4.1, 5.4, 6.9];
  for (let y = 8.5; y < top - 0.5; y += 1.7) ys.push(y);
  ys.push(top, top + cfg.leader * 0.5, top + cfg.leader);
  const trunkPts = ys.map(spineAt);
  tube(bark, trunkPts, {
    radial: 16,
    radius: (_t, k) => coreR(ys[k]),
    bump: (t, a) => trunkBump(t * (top + cfg.leader), a),
    uRepeat: 3,
    vPerMetre: 0.26,
    firstNormal: new THREE.Vector3(0, 0, 1),
    color: (_t, p, n) => barkColor(p, n, 0, seed),
    capEnd: 'cone',
  });

  // ---- buttress fins + surface roots --------------------------------------------------------
  const fins: LocalCollider[] = [];
  for (let j = 0; j < cfg.fins; j++) {
    const reach = rng.range(cfg.finReach[0], cfg.finReach[1]);
    const rIn = cfg.rTrunk * 0.55;
    const rOut = cfg.rTrunk * 1.3 + reach;
    const end = buttressFin(bark, rng, finAz[j], rIn, rOut, finH[j], seed);
    {
      // box over the tall inner 80 % of the fin (the low tip is stepped over)
      const r0 = cfg.rTrunk * 1.05;
      const r1 = rIn + (rOut - rIn) * 0.78;
      const mid = (r0 + r1) / 2;
      fins.push({ type: 'box', x: Math.sin(finAz[j]) * mid, z: Math.cos(finAz[j]) * mid, halfX: 0.32, halfZ: (r1 - r0) / 2, yaw: finAz[j], yMin: 0, yMax: finH[j] * 0.55, tag: 'tree' });
    }
    // root continues snaking over the ground
    const az = finAz[j] + rng.range(-0.3, 0.3);
    const len = rng.range(1.0, 2.0);
    const rootPts: THREE.Vector3[] = [end.clone().setY(0.04)];
    let raz = az;
    for (let k = 1; k <= 4; k++) {
      raz += rng.range(-0.35, 0.35);
      const prev = rootPts[k - 1];
      rootPts.push(new THREE.Vector3(prev.x + Math.sin(raz) * (len / 4), 0.03 - k * 0.015, prev.z + Math.cos(raz) * (len / 4)));
    }
    tube(bark, rootPts, {
      radial: 4,
      radius: (t) => THREE.MathUtils.lerp(0.17, 0.05, t),
      uRepeat: 1,
      vPerMetre: 0.3,
      color: (_t, p, n) => barkColor(p, n, 0.25, seed),
      capEnd: 'cone',
    });
  }
  // a few extra roots between the fins
  for (let j = 0; j < Math.min(2, cfg.fins); j++) {
    const az = finAz[j] + Math.PI / cfg.fins + rng.range(-0.2, 0.2);
    const start = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)).multiplyScalar(coreR(0) * 0.9);
    start.y = 0.12;
    const pts = [start];
    let raz = az;
    const len = rng.range(1.6, 3.0);
    for (let k = 1; k <= 3; k++) {
      raz += rng.range(-0.4, 0.4);
      const prev = pts[k - 1];
      pts.push(new THREE.Vector3(prev.x + Math.sin(raz) * (len / 3), Math.max(0.0, 0.1 - k * 0.05), prev.z + Math.cos(raz) * (len / 3)));
    }
    tube(bark, pts, {
      radial: 4,
      radius: (t) => THREE.MathUtils.lerp(0.18, 0.04, t),
      uRepeat: 1,
      vPerMetre: 0.3,
      color: (_t, p, n) => barkColor(p, n, 0.3, seed),
      capEnd: 'cone',
    });
  }

  // ---- strangler / liana strands hugging the trunk -------------------------------------------
  for (let s = 0; s < cfg.strands; s++) {
    const a0 = rng.range(0, Math.PI * 2);
    const twist = rng.range(-1.3, 1.3);
    const yEnd = top * rng.range(0.65, 1.02);
    const rs = rng.range(0.07, 0.11);
    const pts: THREE.Vector3[] = [];
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const y = (k / n) * yEnd;
      const a = a0 + twist * (y / top) + 0.15 * Math.sin(y * 0.7 + s);
      const r = coreR(y) * (1 + trunkBump(y, a)) + rs * 0.45 + (k === 0 ? 0.35 : 0);
      pts.push(spineAt(y).add(new THREE.Vector3(Math.sin(a) * r, k === 0 ? -0.05 : 0, Math.cos(a) * r)));
    }
    tube(bark, pts, {
      radial: 4,
      radius: (t) => rs * (1.25 - 0.5 * t),
      uRepeat: 0.5,
      vPerMetre: 0.35,
      color: (_t, p, nn) => barkColor(p, nn, 0.35, seed + 9).multiplyScalar(1.12),
    });
  }

  // ---- limbs, sub-branches and canopy clump centres -----------------------------------------
  const limbs: Limb[] = [];
  const clumps: ClumpSpec[] = [];
  const C = cfg.crown;
  const limbAz0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < cfg.limbs; i++) {
    const az = limbAz0 + (i / cfg.limbs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const y0 = top * rng.range(0.74, 0.97);
    const base = spineAt(y0);
    const el = rng.range(0.38, 0.7);
    const len = C * rng.range(0.6, 0.76);
    const pts = bentSpine(base, az, el, rng.range(0.2, 0.5), len, 5, 1.3, rng.range(-0.35, 0.35));
    const r0 = coreR(y0) * 0.5;
    limbs.push({ pts, r0, r1: 0.12 });
    tube(bark, pts, {
      radial: 6,
      radius: (t) => THREE.MathUtils.lerp(r0, 0.12, Math.pow(t, 0.8)),
      bump: (t, a) => 0.06 * vegNoise.noise(a * 2 + i, t * 4),
      uRepeat: 2,
      vPerMetre: 0.3,
      color: (_t, p, n) => barkColor(p, n, 0.2, seed),
      capEnd: 'round',
    });
    const tip = pts[pts.length - 1];
    clumps.push({ c: tip.clone().add(new THREE.Vector3(0, 0.8, 0)), r: new THREE.Vector3(C * 0.34, C * 0.19, C * 0.34), weight: 1 });
    // sub-branches
    const nSub = 2;
    for (let s = 0; s < nSub; s++) {
      const t0 = rng.range(0.42, 0.72);
      const sp = pointAt(pts, t0);
      const tan = tangentAt(pts, t0);
      const baseAz = Math.atan2(tan.x, tan.z) + (s === 0 ? 1 : -1) * rng.range(0.55, 1.0);
      const sl = C * rng.range(0.28, 0.4);
      const spts = bentSpine(sp, baseAz, el + rng.range(0.05, 0.35), rng.range(0.1, 0.35), sl, 3, 1.2);
      const sr0 = THREE.MathUtils.lerp(r0, 0.12, t0) * 0.62;
      limbs.push({ pts: spts, r0: sr0, r1: 0.05 });
      tube(bark, spts, {
        radial: 4,
        radius: (t) => THREE.MathUtils.lerp(sr0, 0.05, t),
        uRepeat: 1,
        vPerMetre: 0.3,
        color: (_t, p, n) => barkColor(p, n, 0.25, seed),
        capEnd: 'cone',
      });
      const st = spts[spts.length - 1];
      clumps.push({ c: st.clone().add(new THREE.Vector3(0, 0.5, 0)), r: new THREE.Vector3(C * 0.25, C * 0.15, C * 0.25), weight: 0.8 });
    }
  }
  // leader top + filler clumps over the fork
  const leaderTop = spineAt(top + cfg.leader);
  clumps.push({ c: leaderTop.clone().add(new THREE.Vector3(0, 1.0, 0)), r: new THREE.Vector3(C * 0.34, C * 0.24, C * 0.34), weight: 1.1 });
  for (let f = 0; f < 3; f++) {
    const az = limbAz0 + (f + 0.5) * ((Math.PI * 2) / 3) + rng.range(-0.3, 0.3);
    const c = spineAt(top + 1.2).add(new THREE.Vector3(Math.sin(az) * C * 0.38, rng.range(0.5, 2.0), Math.cos(az) * C * 0.38));
    clumps.push({ c, r: new THREE.Vector3(C * 0.28, C * 0.17, C * 0.28), weight: 0.7 });
  }

  // ---- canopy cards ---------------------------------------------------------------------------
  const totalW = clumps.reduce((s, c) => s + c.weight * c.r.x * c.r.z, 0);
  const crownMinY = Math.min(...clumps.map((c) => c.c.y - c.r.y));
  const crownMaxY = Math.max(...clumps.map((c) => c.c.y + c.r.y));
  for (const cl of clumps) {
    const count = Math.round((cfg.cards * cl.weight * cl.r.x * cl.r.z) / totalW);
    // per-clump hue variation: some clumps cooler, some warmer
    const warm = rng.range(-0.07, 0.07);
    const hgt = (cl.c.y - crownMinY) / Math.max(1, crownMaxY - crownMinY);
    foliageClump(rng, leaves, light, {
      center: cl.c,
      radii: cl.r,
      count,
      cardSize: [cl.r.x * 0.6, cl.r.x * 0.95],
      shell: [0.7, 1.02],
      bottom: shade(rgb(0.42, 0.52, 0.66), 0.9 + 0.2 * hgt, warm),
      top: shade(rgb(1.15, 1.12, 0.84), 0.95 + 0.1 * hgt, warm),
      jitter: 0.12,
      underside: 0.5,
      lightThreshold: 0.45,
      normalDrop: 0.3,
      upBlend: 0.12,
      randomness: 0.65,
      core: {
        detail: cl.r.x > 2.6 ? 1 : 0,
        scale: 0.66,
        uv: CORE_UV.canopy,
        bottom: shade(rgb(0.2, 0.27, 0.38), 1, warm),
        top: shade(rgb(0.42, 0.5, 0.4), 1, warm),
        // cores don't cast shadows: sun flecks get through the card gaps (dappled floor)
        target: cores,
      },
    });
  }

  // ---- hanging vines ------------------------------------------------------------------------
  const vineCol = rgb(2.1, 2.5, 1.25);
  const hangVine = (pts: THREE.Vector3[], r: number): void => {
    tube(bark, pts, {
      radial: 3,
      radius: (t) => r * (1 - 0.35 * t),
      uRepeat: 0.4,
      vPerMetre: 0.5,
      color: (_t, p) => vineCol.clone().multiplyScalar(0.85 + 0.15 * vegNoise.noise(p.y, p.x)),
      capEnd: 'cone',
    });
    // leafy tufts along the vine
    const n = pts.length;
    const len = pts[0].distanceTo(pts[n - 1]);
    const tufts = Math.max(2, Math.round(len / 1.0));
    for (let k = 0; k < tufts; k++) {
      const t = (k + 0.3 + rng.range(0, 0.4)) / tufts;
      const p = pointAt(pts, t * 0.96);
      const az = rng.range(0, Math.PI * 2);
      const off = new THREE.Vector3(Math.sin(az) * 0.12, 0, Math.cos(az) * 0.12);
      const size = rng.range(0.7, 1.05) * (1 - 0.35 * t);
      const u0 = rng.range(0.1, 0.35);
      const v0 = rng.range(0.1, 0.35);
      const facing = new THREE.Vector3(Math.sin(az), rng.range(-0.2, 0.5), Math.cos(az));
      const cc = shade(rgb(0.85, 0.95, 0.8), rng.range(0.8, 1.1), rng.range(-0.05, 0.05));
      const pc = p.clone().add(off);
      foliageCard(leaves, pc, facing, size, rng.range(0, Math.PI * 2), [u0, v0, u0 + 0.55, v0 + 0.55], cc);
    }
  };
  for (let k = 0; k < cfg.vines; k++) {
    const limb = limbs[rng.int(0, limbs.length - 1)];
    const t = rng.range(0.25, 0.95);
    const start = pointAt(limb.pts, t);
    start.y -= THREE.MathUtils.lerp(limb.r0, limb.r1, t) * 0.8;
    const maxLen = start.y - 0.5;
    const len = Math.min(maxLen, rng.chance(0.35) ? maxLen * rng.range(0.85, 1) : rng.range(3.5, 9));
    const swingAz = rng.range(0, Math.PI * 2);
    const swing = rng.range(0.2, 0.9);
    const pts: THREE.Vector3[] = [];
    const segs = 6;
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      pts.push(
        start
          .clone()
          .add(new THREE.Vector3(Math.sin(swingAz) * swing * Math.sin(f * 1.6), -len * f, Math.cos(swingAz) * swing * Math.sin(f * 1.6)))
          .add(new THREE.Vector3(0.12 * vegNoise.noise(f * 3 + k, 2), 0, 0.12 * vegNoise.noise(f * 3 - k, 7))),
      );
    }
    hangVine(pts, rng.range(0.045, 0.07));
  }
  // sagging loops between limbs
  for (let k = 0; k < cfg.loops; k++) {
    const a = limbs[k % limbs.length];
    const b2 = limbs[(k + 1 + rng.int(0, 1)) % limbs.length];
    const pa = pointAt(a.pts, rng.range(0.3, 0.7));
    const pb = pointAt(b2.pts, rng.range(0.3, 0.7));
    const sag = rng.range(2.0, 4.0);
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 8; s++) {
      const f = s / 8;
      const p = pa.clone().lerp(pb, f);
      p.y -= Math.sin(f * Math.PI) * sag;
      pts.push(p);
    }
    hangVine(pts, 0.045);
  }

  // ---- epiphytes: moss cushions + bromeliads (static vertexColor, double sided leaves) --------
  const mossC = lin(0x5d8a2c);
  for (let i = 0; i < limbs.length; i++) {
    const limb = limbs[i];
    if (limb.r1 < 0.1) continue; // main limbs only
    for (const t of [0.08, 0.38]) {
      const p = pointAt(limb.pts, t);
      const r = THREE.MathUtils.lerp(limb.r0, limb.r1, t);
      p.y += r * 0.75;
      const s = r * rng.range(1.0, 1.5);
      icoBlob(
        epi,
        p,
        new THREE.Vector3(s * 1.2, s * 0.45, s),
        0,
        (q, n) => shade(mossC, 0.75 + 0.35 * Math.max(0, n.y) + 0.1 * vegNoise.noise(q.x * 3, q.z * 3), rng.range(-0.05, 0.08)),
        undefined,
        (d) => 0.18 * vegNoise.noise(d.x * 2.5 + i, d.z * 2.5 + t),
      );
    }
  }
  const mainLimbs = limbs.filter((l) => l.r1 >= 0.1);
  for (let k = 0; k < cfg.bromeliads; k++) {
    const limb = mainLimbs[k % mainLimbs.length];
    const t = rng.range(0.12, 0.3);
    const p = pointAt(limb.pts, t);
    p.y += THREE.MathUtils.lerp(limb.r0, limb.r1, t) * 0.85;
    const t0 = epi.triangleCount;
    const wh = bromeliadWhorls(rng, k % 2).slice(1, 3);
    wh[0].count = 5;
    wh[1].count = 4;
    rosette(epi, rng, { center: p, scale: rng.range(1.5, 2.0), whorls: wh, segments: 2, channel: -0.5 });
    epi.doubleSide(t0);
  }

  jungleColliders.set(v, [{ type: 'circle', x: 0, z: 0, radius: cfg.rTrunk * 1.22, yMin: 0, yMax: 9, tag: 'tree' }, ...fins]);
  jungleAnchors.set(
    v,
    mainLimbs.flatMap((l) =>
      [0.5, 0.8].map((t) => {
        const p = pointAt(l.pts, t);
        p.y -= THREE.MathUtils.lerp(l.r0, l.r1, t) * 0.9;
        return p;
      }),
    ),
  );

  const parts: InstancedAsset['parts'] = [
    { geometry: bark.build(), material: 'jungleBark', castShadow: true },
    { geometry: leaves.build(), material: 'canopy', castShadow: true },
  ];
  if (!light.empty) parts.push({ geometry: light.build(), material: 'canopyLight', castShadow: true });
  if (!cores.empty) parts.push({ geometry: cores.build(), material: 'canopy', castShadow: false });
  if (!epi.empty) parts.push({ geometry: epi.build(), material: 'vertexColor', castShadow: false });
  return { name: `veg.jungleTree.${v}`, parts, collider: { radius: 1.6, height: 8 } };
}

/** Small leaf card (vines, tufts) with a soft up-biased normal. */
function foliageCard(
  b: GeoBuilder,
  center: THREE.Vector3,
  facing: THREE.Vector3,
  size: number,
  roll: number,
  uv: [number, number, number, number],
  col: THREE.Color,
): void {
  const nrm = facing.clone().setY(0).normalize().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.8, 0)).normalize();
  card(b, {
    center,
    facing,
    width: size,
    height: size,
    roll,
    uv,
    normal: () => nrm,
    color: (p) => col.clone().multiplyScalar(0.85 + 0.15 * smooth01((p.y - center.y) / size + 0.5)),
  });
}

// ---------------------------------------------------------------------------
// Understory tree
// ---------------------------------------------------------------------------

interface SmallTreeConfig {
  height: number;
  rTrunk: number;
  limbs: number;
  crown: number;
  lean: number;
  cards: number;
  flat: number;
  tint: THREE.Color;
  vines: number;
  seed: number;
}

const SMALL: SmallTreeConfig[] = [
  { height: 10.5, rTrunk: 0.27, limbs: 4, crown: 3.4, lean: 0.12, cards: 330, flat: 0.72, tint: rgb(1, 1, 1), vines: 1, seed: 3 },
  { height: 8.6, rTrunk: 0.22, limbs: 3, crown: 3.1, lean: 0.22, cards: 290, flat: 0.6, tint: rgb(0.86, 0.96, 1.0), vines: 2, seed: 8 },
];

/** Understory tree 8–12 m with a rounded canopy (canopy + canopyLight cards). < 2500 tris. */
export function jungleTreeSmall(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, SMALL.length);
  return memoAsset(`veg.jungleTreeSmall.${v}`, () => buildSmallTree(v, SMALL[v]));
}

function buildSmallTree(v: number, cfg: SmallTreeConfig): InstancedAsset {
  const rng = new Rng(cfg.seed * 7727 + 3);
  const bark = new GeoBuilder();
  const leaves = new GeoBuilder();
  const light = new GeoBuilder();
  const seed = cfg.seed * 1.7;
  const leanAz = rng.range(0, Math.PI * 2);
  const forkY = cfg.height * 0.52;
  const trunkLen = cfg.height * 0.72;
  const trunkPts = bentSpine(new THREE.Vector3(), leanAz, Math.PI / 2 - cfg.lean, -cfg.lean * 0.8, trunkLen, 8, 1.2);
  tube(bark, trunkPts, {
    radial: 9,
    radius: (t) => cfg.rTrunk * (1 + 0.5 * Math.exp(-t * 14)) * (1 - 0.55 * t),
    bump: (t, a) => 0.08 * vegNoise.noise(a * 2 + seed, t * 6),
    uRepeat: 1,
    vPerMetre: 0.35,
    firstNormal: new THREE.Vector3(0, 0, 1),
    color: (_t, p, n) => barkColor(p, n, 0.1, seed),
    capEnd: 'cone',
  });
  const trunkAt = (y: number): THREE.Vector3 => {
    for (let k = 1; k < trunkPts.length; k++) if (trunkPts[k].y >= y) return trunkPts[k - 1].clone().lerp(trunkPts[k], (y - trunkPts[k - 1].y) / (trunkPts[k].y - trunkPts[k - 1].y));
    return trunkPts[trunkPts.length - 1].clone();
  };
  const clumps: ClumpSpec[] = [];
  const C = cfg.crown;
  const az0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < cfg.limbs; i++) {
    const az = az0 + (i / cfg.limbs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const y0 = forkY + rng.range(-0.4, 1.6);
    const base = trunkAt(y0);
    const len = C * rng.range(0.65, 0.9);
    const pts = bentSpine(base, az, rng.range(0.55, 0.95), rng.range(0.2, 0.5), len, 4, 1.2, rng.range(-0.3, 0.3));
    const r0 = cfg.rTrunk * 0.5;
    tube(bark, pts, {
      radial: 5,
      radius: (t) => THREE.MathUtils.lerp(r0, 0.04, t),
      uRepeat: 1,
      vPerMetre: 0.35,
      color: (_t, p, n) => barkColor(p, n, 0.2, seed),
      capEnd: 'cone',
    });
    const tip = pts[pts.length - 1];
    clumps.push({ c: tip.clone().add(new THREE.Vector3(0, 0.45, 0)), r: new THREE.Vector3(C * 0.52, C * 0.52 * cfg.flat, C * 0.52), weight: 1 });
  }
  const topP = trunkPts[trunkPts.length - 1];
  clumps.push({ c: topP.clone().add(new THREE.Vector3(0, 0.5, 0)), r: new THREE.Vector3(C * 0.6, C * 0.6 * cfg.flat, C * 0.6), weight: 1.2 });
  const totalW = clumps.reduce((s, c) => s + c.weight * c.r.x * c.r.z, 0);
  for (const cl of clumps) {
    const count = Math.round((cfg.cards * cl.weight * cl.r.x * cl.r.z) / totalW);
    const warm = rng.range(-0.06, 0.06);
    foliageClump(rng, leaves, light, {
      center: cl.c,
      radii: cl.r,
      count,
      cardSize: [C * 0.34, C * 0.52],
      shell: [0.68, 1.02],
      bottom: shade(rgb(0.44, 0.54, 0.68).multiply(cfg.tint), 1, warm),
      top: shade(rgb(1.12, 1.1, 0.84).multiply(cfg.tint), 1, warm),
      jitter: 0.13,
      underside: 0.45,
      lightThreshold: 0.45,
      normalDrop: 0.3,
      upBlend: 0.14,
      randomness: 0.65,
      core: { detail: 1, scale: 0.64, uv: CORE_UV.canopy, bottom: shade(rgb(0.22, 0.29, 0.4).multiply(cfg.tint), 1, warm), top: shade(rgb(0.46, 0.55, 0.43).multiply(cfg.tint), 1, warm) },
    });
  }
  // a vine or two
  for (let k = 0; k < cfg.vines; k++) {
    const cl = clumps[k % clumps.length];
    const start = cl.c.clone().add(new THREE.Vector3(rng.range(-0.5, 0.5), -cl.r.y * 0.6, rng.range(-0.5, 0.5)));
    const len = rng.range(2.5, Math.max(2.6, start.y - 1.2));
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 5; s++) pts.push(start.clone().add(new THREE.Vector3(0.1 * Math.sin(s + k), (-len * s) / 5, 0.1 * Math.cos(s * 1.3 + k))));
    tube(bark, pts, { radial: 3, radius: () => 0.035, uRepeat: 0.3, vPerMetre: 0.5, color: () => rgb(2.1, 2.5, 1.25), capEnd: 'cone' });
    for (let s = 1; s <= 3; s++) {
      const p = pointAt(pts, s / 3.4);
      const az = rng.range(0, Math.PI * 2);
      foliageCard(leaves, p, new THREE.Vector3(Math.sin(az), 0.3, Math.cos(az)), rng.range(0.5, 0.75), rng.range(0, 6), [0.2, 0.2, 0.75, 0.75], rgb(0.8, 0.9, 0.78));
    }
  }
  const parts: InstancedAsset['parts'] = [
    { geometry: bark.build(), material: 'jungleBark', castShadow: true },
    { geometry: leaves.build(), material: 'canopy', castShadow: true },
  ];
  if (!light.empty) parts.push({ geometry: light.build(), material: 'canopyLight', castShadow: true });
  return { name: `veg.jungleTreeSmall.${v}`, parts, collider: { radius: 0.4, height: 5 } };
}
