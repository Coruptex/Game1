import * as THREE from 'three';
import type { InstancedAsset } from '../PropTypes';
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
import { bractSpike, bromeliadWhorls, rosette } from './PlantParts';

/**
 * Understory plants, flowers, grass and vines. All instanced, base at y = 0 (hanging vines:
 * attachment at y = 0, strands hang down to negative y).
 *
 * Wind note: `flower` sways 0.15 m per (local height)^2 and `grass` 0.25 m per (1.2 h)^2, so plants
 * built from them stay below ~1.4 m; taller swaying parts use `broadLeaf` / `fern`.
 */



// ---------------------------------------------------------------------------
// Fern
// ---------------------------------------------------------------------------

/** Fern texture leaflet envelope (half width in u along v). */
const FERN_ENVELOPE: Array<[number, number]> = [
  [0, 0.08],
  [0.08, 0.36],
  [0.14, 0.48],
  [0.5, 0.47],
  [0.6, 0.43],
  [0.75, 0.3],
  [0.9, 0.2],
  [1, 0.08],
];


const FERNS = [
  { fronds: 10, len: 1.35, el: [1.05, 1.3], bend: [1.0, 1.35], width: 0.5, seed: 3, tint: rgb(1.05, 1.08, 1.0) },
  { fronds: 12, len: 1.85, el: [1.0, 1.25], bend: [1.05, 1.45], width: 0.5, seed: 7, tint: rgb(0.95, 1.04, 1.0) },
  { fronds: 9, len: 1.05, el: [1.1, 1.4], bend: [0.85, 1.2], width: 0.48, seed: 13, tint: rgb(1.12, 1.1, 0.88) },
];

/** Rosette of 8–12 arching fern fronds, 0.8–1.6 m. < 300 tris. */
export function fern(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, FERNS.length);
  return memoAsset(`veg.fern.${v}`, () => {
    const cfg = FERNS[v];
    const rng = new Rng(cfg.seed * 977 + 1);
    const b = new GeoBuilder();
    const az0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < cfg.fronds; i++) {
      const az = az0 + (i / cfg.fronds) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      const inner = i % 3 === 0;
      const len = cfg.len * rng.range(0.78, 1.08) * (inner ? 0.82 : 1);
      const el = rng.range(cfg.el[0], cfg.el[1]) + (inner ? 0.15 : 0);
      const spine = bentSpine(dir.clone().multiplyScalar(0.04), az, el, rng.range(cfg.bend[0], cfg.bend[1]), len, 4, 1.35, rng.range(-0.3, 0.3));
      const wFull = cfg.width * len;
      const tint = shade(cfg.tint, rng.range(0.88, 1.08), rng.range(-0.05, 0.05));
      const st = leafStations(spine, UP, (t) => {
        const e = envelope(FERN_ENVELOPE, t) + 0.02;
        const c = shade(tint, 0.55 + 0.55 * smooth01(t * 1.5));
        return { hw: e * wFull, uHalf: e, fold: 0.28 + 0.2 * t, v: t, cCenter: c, cEdge: shade(c, 1.08, 0.03), roll: 0 };
      });
      foldedStrip(b, st, dir.clone().multiplyScalar(0.3).add(UP).normalize(), 0.6);
    }
    return { name: `veg.fern.${v}`, parts: [{ geometry: b.build(), material: 'fern', castShadow: false }] };
  });
}

// ---------------------------------------------------------------------------
// Bush
// ---------------------------------------------------------------------------

const BUSHES = [
  { r: new THREE.Vector3(0.8, 0.62, 0.75), y: 0.58, cards: 58, size: [0.6, 0.9], main: 'canopyDark' as const, light: 'canopy' as const, bright: 1.45, seed: 5 },
  { r: new THREE.Vector3(0.66, 0.48, 0.62), y: 0.44, cards: 44, size: [0.5, 0.75], main: 'canopy' as const, light: 'canopyLight' as const, bright: 1.0, seed: 9 },
  { r: new THREE.Vector3(0.95, 0.7, 0.9), y: 0.76, cards: 86, size: [0.65, 1.0], main: 'canopyDark' as const, light: 'canopy' as const, bright: 1.4, seed: 15 },
];

/** Dense leafy bush built from leaf-cluster cards on a blob (spherical normals), 0.8–1.8 m. */
export function bush(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, BUSHES.length);
  return memoAsset(`veg.bush.${v}`, () => {
    const cfg = BUSHES[v];
    const rng = new Rng(cfg.seed * 331 + 7);
    const main = new GeoBuilder();
    const light = new GeoBuilder();
    const lobes = v === 2 ? 3 : 2;
    for (let l = 0; l < lobes; l++) {
      const off = l === 0 ? new THREE.Vector3() : new THREE.Vector3(rng.range(-0.5, 0.5), rng.range(-0.15, 0.2), rng.range(-0.5, 0.5)).multiply(cfg.r);
      const k = l === 0 ? 1 : rng.range(0.6, 0.8);
      const radii = cfg.r.clone().multiplyScalar(k);
      const center = new THREE.Vector3(off.x, cfg.y * k + off.y * 0.5, off.z);
      foliageClump(rng, main, light, {
        center,
        radii,
        count: Math.round(cfg.cards * (l === 0 ? 1 : 0.55)),
        cardSize: [cfg.size[0], cfg.size[1]],
        shell: [0.68, 1.05],
        bottom: rgb(0.55, 0.62, 0.66).multiplyScalar(cfg.bright),
        top: rgb(1.12, 1.12, 0.9).multiplyScalar(cfg.bright),
        jitter: 0.12,
        underside: 0.7,
        lightThreshold: 0.45,
        normalDrop: 0.25,
        upBlend: 0.15,
        randomness: 0.65,
        lightScale: 1 / cfg.bright,
        core: { detail: 1, scale: 0.62, uv: CORE_UV[cfg.main], bottom: rgb(0.4, 0.46, 0.48).multiplyScalar(cfg.bright), top: rgb(0.85, 0.9, 0.75).multiplyScalar(cfg.bright) },
      });
    }
    // ground contact darkening
    main.mapColors((c, p) => c.multiplyScalar(0.55 + 0.45 * smooth01(p.y / 0.5)));
    const parts: InstancedAsset['parts'] = [{ geometry: main.build(), material: cfg.main, castShadow: true }];
    if (!light.empty) parts.push({ geometry: light.build(), material: cfg.light, castShadow: true });
    return { name: `veg.bush.${v}`, parts, collider: v === 2 ? { radius: 0.5, height: 1.2 } : undefined };
  });
}

// ---------------------------------------------------------------------------
// Broad leaf plants (banana / elephant ear)
// ---------------------------------------------------------------------------

/** Midrib texel of broadLeafTexture (opaque light green stroke): stems in the same material. */
const MIDRIB_UV: [number, number] = [0.5, 0.35];

function broadLeafBlade(
  b: GeoBuilder,
  rng: Rng,
  origin: THREE.Vector3,
  az: number,
  el: number,
  bend: number,
  len: number,
  width: number,
  tint: THREE.Color,
  segs = 5,
): void {
  const spine = bentSpine(origin, az, el, bend, len, segs, 1.3, rng.range(-0.2, 0.2));
  const roll = rng.range(-0.35, 0.35);
  const st = leafStations(spine, UP, (t) => {
    // leaf outline from the texture: widest in the middle
    const e = Math.sin(Math.min(1, t * 1.02) * Math.PI) * 0.5 + 0.02;
    const c = shade(tint, 0.62 + 0.45 * smooth01(t * 1.4));
    return { hw: e * width, uHalf: Math.min(0.5, e), fold: 0.3 + 0.15 * t, v: Math.min(1, t * 0.98 + 0.01), cCenter: c, cEdge: shade(c, 1.05, 0.03), roll: roll * t };
  });
  foldedStrip(b, st, UP, 0.45);
}

/** Banana (variant 0, ~2.8 m) / elephant-ear clump (variant 1, ~1.6 m). broadLeaf material. */
export function broadLeafPlant(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.broadLeafPlant.${v}`, () => {
    const rng = new Rng(v * 911 + 31);
    const b = new GeoBuilder();
    if (v === 0) {
      // banana: pseudostems with huge arching leaves
      const stems = 2;
      for (let s = 0; s < stems; s++) {
        const h = s === 0 ? 1.75 : 1.1;
        const base = s === 0 ? new THREE.Vector3() : new THREE.Vector3(0.45, 0, 0.25);
        const lean = rng.range(0, Math.PI * 2);
        const top = base.clone().add(new THREE.Vector3(Math.sin(lean) * 0.12, h, Math.cos(lean) * 0.12));
        const pts = [base, base.clone().lerp(top, 0.5), top];
        tube(b, pts, {
          radial: 6,
          radius: (t) => (s === 0 ? 0.13 : 0.09) * (1.15 - 0.4 * t),
          fixedUV: MIDRIB_UV,
          color: (_t, p) => rgb(0.62, 0.68, 0.45).multiplyScalar(0.7 + 0.3 * smooth01(p.y / h)),
          capEnd: 'cone',
        });
        const leaves = s === 0 ? 7 : 4;
        const az0 = rng.range(0, Math.PI * 2);
        for (let i = 0; i < leaves; i++) {
          const az = az0 + i * 2.4 + rng.range(-0.2, 0.2);
          const age = i / leaves;
          const tint = mix(rgb(1.0, 1.06, 0.95), rgb(1.15, 1.08, 0.7), age * 0.6 + rng.range(-0.1, 0.15));
          const o = top.clone().add(new THREE.Vector3(0, -age * 0.25, 0));
          const len = (s === 0 ? 1.7 : 1.2) * rng.range(0.85, 1.1);
          broadLeafBlade(b, rng, o, az, THREE.MathUtils.lerp(1.15, 0.45, age), THREE.MathUtils.lerp(1.0, 1.9, age), len, len * 0.5, tint, 5);
        }
      }
    } else {
      // elephant ear: long petioles from the ground carrying broad drooping blades
      const leaves = 7;
      const az0 = rng.range(0, Math.PI * 2);
      for (let i = 0; i < leaves; i++) {
        const az = az0 + i * 2.4 + rng.range(-0.3, 0.3);
        const plen = rng.range(1.0, 1.55);
        const pEl = rng.range(1.12, 1.4);
        const pet = bentSpine(new THREE.Vector3(Math.sin(az) * 0.05, 0, Math.cos(az) * 0.05), az, pEl, 0.4, plen, 3, 1.2);
        tube(b, pet, {
          radial: 4,
          radius: (t) => 0.04 * (1 - 0.4 * t),
          fixedUV: MIDRIB_UV,
          color: () => rgb(0.6, 0.7, 0.45),
        });
        const end = pet[pet.length - 1];
        const len = rng.range(1.0, 1.3);
        const tint = shade(rgb(0.9, 1.0, 0.95), rng.range(0.85, 1.05), rng.range(-0.05, 0.04));
        broadLeafBlade(b, rng, end, az + rng.range(-0.3, 0.3), rng.range(0.15, 0.55), rng.range(1.0, 1.5), len, len * 0.85, tint, 4);
      }
    }
    return { name: `veg.broadLeafPlant.${v}`, parts: [{ geometry: b.build(), material: 'broadLeaf', castShadow: true }] };
  });
}

// ---------------------------------------------------------------------------
// Flowering plants (flower material: vertex colour, double sided, gentle sway)
// ---------------------------------------------------------------------------

/** Bromeliad: rosette of stiff channelled leaves with an orange-red flower spike (~0.6 m). */
export function bromeliad(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.bromeliad.${v}`, () => {
    const rng = new Rng(v * 613 + 77);
    const b = new GeoBuilder();
    rosette(b, rng, { center: new THREE.Vector3(0, 0.03, 0), scale: 1.3, whorls: bromeliadWhorls(rng, v), segments: 3, channel: -0.28 });
    const spikeLow = v === 1 ? lin(0xc8306a) : lin(0xe0362b);
    const spikeTip = v === 1 ? lin(0xf7a1c4) : lin(0xf7d23e);
    bractSpike(b, rng, new THREE.Vector3(0, 0.1, 0), 0.5, spikeLow, spikeTip, 6);
    return { name: `veg.bromeliad.${v}`, parts: [{ geometry: b.build(), material: 'flower', castShadow: false }] };
  });
}

/** Simple petal flower head (5–6 petals) facing `facing`. */
function flowerHead(
  b: GeoBuilder,
  center: THREE.Vector3,
  facing: THREE.Vector3,
  radius: number,
  petals: number,
  inner: THREE.Color,
  outer: THREE.Color,
  rot: number,
  cup = 0.25,
): void {
  const f = facing.clone().normalize();
  const helper = Math.abs(f.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  const r = new THREE.Vector3().crossVectors(helper, f).normalize();
  const u = new THREE.Vector3().crossVectors(f, r).normalize();
  const nrm = f.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize();
  const c0 = b.vert(center.clone().addScaledVector(f, -radius * cup * 0.4), nrm, 0.5, 0.5, inner);
  const ring: number[] = [];
  for (let i = 0; i < petals * 2; i++) {
    const a = rot + (i / (petals * 2)) * Math.PI * 2;
    const isTip = i % 2 === 0;
    const rr = isTip ? radius : radius * 0.42;
    const p = center
      .clone()
      .addScaledVector(r, Math.cos(a) * rr)
      .addScaledVector(u, Math.sin(a) * rr)
      .addScaledVector(f, isTip ? radius * cup : radius * cup * 0.3);
    ring.push(b.vert(p, nrm, 0.5, 0.5, isTip ? outer : mix(inner, outer, 0.5)));
  }
  for (let i = 0; i < ring.length; i++) b.tri(c0, ring[i], ring[(i + 1) % ring.length]);
}

/** Purple / pink orchid sprays on thin arching stems with strap leaves (~0.6 m). */
export function orchidCluster(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.orchid.${v}`, () => {
    const rng = new Rng(v * 271 + 5);
    const b = new GeoBuilder();
    const leafGreen = lin(0x3b6e2a);
    // strap leaves
    for (let i = 0; i < 5; i++) {
      const az = (i / 5) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const spine = bentSpine(new THREE.Vector3(), az, rng.range(0.6, 0.9), rng.range(0.9, 1.3), rng.range(0.32, 0.44), 3, 1.3);
      const st = leafStations(spine, UP, (t) => ({
        hw: 0.06 * Math.sin(Math.min(1, t * 1.1 + 0.15) * Math.PI) + 0.006,
        uHalf: 0.5,
        fold: -0.3,
        v: t,
        cCenter: shade(leafGreen, 0.75 + 0.4 * t),
        cEdge: shade(leafGreen, 0.65 + 0.35 * t),
      }));
      foldedStrip(b, st, UP, 0.6);
    }
    const purple = v === 0 ? lin(0xb35ad6) : lin(0xf07aa8);
    const pale = v === 0 ? lin(0xe6c4f2) : lin(0xfbe0ea);
    const throat = v === 0 ? lin(0x7a2a8a) : lin(0xc8306a);
    const sprays = 3;
    for (let s = 0; s < sprays; s++) {
      const az = (s / sprays) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const len = rng.range(0.7, 0.9);
      const stem = bentSpine(new THREE.Vector3(0, 0.05, 0), az, rng.range(1.3, 1.45), rng.range(1.0, 1.3), len, 4, 1.8);
      tube(b, stem, { radial: 3, radius: () => 0.012, color: () => lin(0x4d6b2a) });
      const nFl = rng.int(5, 6);
      for (let k = 0; k < nFl; k++) {
        const t = 0.4 + (k / nFl) * 0.6;
        const f = Math.min(stem.length - 1, Math.floor(t * (stem.length - 1)));
        const p = stem[f].clone().lerp(stem[Math.min(stem.length - 1, f + 1)], t * (stem.length - 1) - f);
        const facing = new THREE.Vector3(Math.sin(az + rng.range(-0.8, 0.8)), rng.range(-0.1, 0.5), Math.cos(az + rng.range(-0.8, 0.8)));
        const size = rng.range(0.1, 0.13) * (1 - 0.25 * (k / nFl));
        flowerHead(b, p.clone().add(new THREE.Vector3(0, -0.03, 0)), facing, size, 5, throat, mix(purple, pale, rng.range(0, 0.3)), rng.range(0, 6), 0.2);
      }
    }
    return { name: `veg.orchid.${v}`, parts: [{ geometry: b.build(), material: 'flower', castShadow: false }] };
  });
}

/** Heart-shaped leaf outline (half widths along the midrib), tip at t = 1. */
function heartHalfWidth(t: number): number {
  // lobed base (wide at t~0.15), pointed tip
  if (t < 0.12) return 0.55 + t * 3.0;
  return Math.max(0, Math.pow(1 - (t - 0.12) / 0.88, 0.75) * 0.92);
}

/** Anthurium: glossy red heart-shaped spathes with yellow spadices over dark heart leaves (~0.7 m). */
export function anthurium(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.anthurium.${v}`, () => {
    const rng = new Rng(v * 199 + 3);
    const b = new GeoBuilder();
    const leafCol = lin(0x2c5a26);
    const spathe = v === 0 ? lin(0xd8241c) : lin(0xf07aa8);
    const spadix = lin(0xf2c94e);
    const stemCol = lin(0x3f6a2a);
    const nLeaves = 6;
    for (let i = 0; i < nLeaves; i++) {
      const az = (i / nLeaves) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const plen = rng.range(0.38, 0.58);
      const pet = bentSpine(new THREE.Vector3(), az, rng.range(1.0, 1.3), 0.5, plen, 2, 1);
      tube(b, pet, { radial: 3, radius: () => 0.012, color: () => stemCol });
      const o = pet[pet.length - 1];
      const len = rng.range(0.4, 0.5);
      const blade = bentSpine(o, az + rng.range(-0.2, 0.2), rng.range(-0.25, 0.15), rng.range(0.5, 0.8), len, 4, 1.2);
      const st = leafStations(blade, UP, (t) => {
        const c = shade(leafCol, 0.75 + 0.45 * t, rng.range(-0.02, 0.02));
        return { hw: heartHalfWidth(t) * len * 0.42, uHalf: 0.5, fold: 0.25, v: t, cCenter: shade(c, 1.15), cEdge: c };
      });
      foldedStrip(b, st, UP, 0.5);
    }
    const nFlowers = 4;
    for (let i = 0; i < nFlowers; i++) {
      const az = (i / nFlowers) * Math.PI * 2 + rng.range(0.2, 0.8);
      const plen = rng.range(0.58, 0.78);
      const pet = bentSpine(new THREE.Vector3(), az, rng.range(1.15, 1.35), 0.45, plen, 2, 1);
      tube(b, pet, { radial: 3, radius: () => 0.011, color: () => stemCol });
      const o = pet[pet.length - 1];
      const len = rng.range(0.21, 0.26);
      // spathe: glossy heart, tipped outward and slightly up
      const blade = bentSpine(o, az, rng.range(0.1, 0.4), 0.5, len, 3, 1.1);
      const st = leafStations(blade, UP, (t) => ({
        hw: heartHalfWidth(t) * len * 0.5,
        uHalf: 0.5,
        fold: -0.15,
        v: t,
        cCenter: shade(spathe, 1.05 + 0.1 * t),
        cEdge: shade(spathe, 0.82),
      }));
      foldedStrip(b, st, UP, 0.35);
      // spadix: small yellow cone standing up from the spathe base
      const sp = [o.clone().add(new THREE.Vector3(0, 0.01, 0)), o.clone().add(new THREE.Vector3(Math.sin(az) * 0.04, 0.11, Math.cos(az) * 0.04))];
      tube(b, sp, { radial: 4, radius: (t) => 0.017 * (1 - 0.5 * t), color: (t) => shade(spadix, 0.9 + 0.2 * t), capEnd: 'cone' });
    }
    return { name: `veg.anthurium.${v}`, parts: [{ geometry: b.build(), material: 'flower', castShadow: false }] };
  });
}

/** Heliconia: upright stalks with red/yellow lobster-claw bracts + paddle leaves (~2 m). */
export function heliconia(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.heliconia.${v}`, () => {
    const rng = new Rng(v * 443 + 19);
    const leavesB = new GeoBuilder();
    const flowerB = new GeoBuilder();
    // paddle leaves (broadLeaf) on long petioles
    const nLeaves = 6;
    const az0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < nLeaves; i++) {
      const az = az0 + i * 2.4 + rng.range(-0.25, 0.25);
      const plen = rng.range(0.7, 1.1);
      const pet = bentSpine(new THREE.Vector3(Math.sin(az) * 0.06, 0, Math.cos(az) * 0.06), az, rng.range(1.25, 1.45), 0.25, plen, 2, 1);
      tube(leavesB, pet, { radial: 3, radius: () => 0.025, fixedUV: MIDRIB_UV, color: () => rgb(0.6, 0.68, 0.42) });
      const len = rng.range(0.85, 1.15);
      const tint = shade(rgb(0.95, 1.04, 0.92), rng.range(0.85, 1.05), rng.range(-0.04, 0.05));
      broadLeafBlade(leavesB, rng, pet[pet.length - 1], az + rng.range(-0.2, 0.2), rng.range(0.9, 1.25), rng.range(0.6, 1.0), len, len * 0.42, tint, 4);
    }
    // flower stalks (flower material: vertex colour, sways)
    const red = v === 0 ? lin(0xd8281e) : lin(0xf2a01e);
    const yellow = lin(0xf7d23e);
    const green = lin(0x4f8a34);
    const stalks = 3;
    for (let s = 0; s < stalks; s++) {
      const az = az0 + (s * Math.PI * 2) / 3 + rng.range(-0.4, 0.4);
      const base = new THREE.Vector3(Math.sin(az) * 0.14, 0, Math.cos(az) * 0.14);
      const h = [1.35, 1.12, 0.92][s];
      const stalk = bentSpine(base, az, 1.45, 0.15, h, 3, 1);
      tube(flowerB, stalk, { radial: 4, radius: (t) => 0.018 * (1 - 0.3 * t), color: () => green });
      const top = stalk[stalk.length - 1];
      // zig-zag rachis with alternating boat-shaped bracts
      const bracts = 6;
      for (let k = 0; k < bracts; k++) {
        const side = k % 2 === 0 ? 1 : -1;
        const y = top.y - 0.06 - k * 0.1;
        const sideAz = az + Math.PI / 2;
        const o = new THREE.Vector3(top.x + Math.sin(sideAz) * 0.02 * side, y, top.z + Math.cos(sideAz) * 0.02 * side);
        const bAz = sideAz + (side > 0 ? 0 : Math.PI);
        const len = 0.27 - k * 0.018;
        const spine = bentSpine(o, bAz, 0.55, -0.35, len, 2, 1);
        const st = leafStations(spine, UP, (t) => ({
          hw: 0.048 * (1 - t * 0.85),
          uHalf: 0.5,
          fold: -0.9,
          v: t,
          cCenter: mix(red, yellow, smooth01((t - 0.55) / 0.45)),
          cEdge: mix(shade(red, 0.85), lin(0x6fae3a), 0.25 + 0.5 * t),
        }));
        foldedStrip(flowerB, st, UP, 0.4);
      }
    }
    return {
      name: `veg.heliconia.${v}`,
      parts: [
        { geometry: leavesB.build(), material: 'broadLeaf', castShadow: true },
        { geometry: flowerB.build(), material: 'flower', castShadow: false },
      ],
    };
  });
}

const FLOWER_SETS = [
  [0xe0362b, 0xf7d23e, 0xf28a1e, 0xe0362b],
  [0xf07aa8, 0xffffff, 0xb35ad6, 0xf7a1c4],
  [0xf7d23e, 0xf28a1e, 0xffffff, 0xf7d23e],
];

/** Small mixed flowers for meadows (red/yellow, pink/white/purple, yellow/orange). < 150 tris. */
export function flowerPatch(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, FLOWER_SETS.length);
  return memoAsset(`veg.flowerPatch.${v}`, () => {
    const rng = new Rng(v * 157 + 11);
    const b = new GeoBuilder();
    const stem = lin(0x4f7f2e);
    const leaf = lin(0x4a8a30);
    // a few leaves at the base
    for (let i = 0; i < 5; i++) {
      const az = rng.range(0, Math.PI * 2);
      const r = rng.range(0, 0.25);
      const o = new THREE.Vector3(Math.sin(az) * r, 0.01, Math.cos(az) * r);
      const spine = bentSpine(o, rng.range(0, Math.PI * 2), 0.5, 0.6, rng.range(0.16, 0.24), 1, 1);
      const st = leafStations(spine, UP, (t) => ({ hw: 0.05 * Math.sin((t * 0.85 + 0.1) * Math.PI), uHalf: 0.5, fold: 0.2, v: t, cCenter: shade(leaf, 0.8 + 0.3 * t), cEdge: shade(leaf, 0.7) }));
      foldedStrip(b, st, UP, 0.6);
    }
    const n = 15;
    const set = FLOWER_SETS[v];
    for (let i = 0; i < n; i++) {
      const az = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 0.42;
      const base = new THREE.Vector3(Math.sin(az) * r, 0, Math.cos(az) * r);
      const h = rng.range(0.16, 0.38);
      const top = base.clone().add(new THREE.Vector3(rng.range(-0.06, 0.06), h, rng.range(-0.06, 0.06)));
      // stem: a single thin triangle
      const sd = new THREE.Vector3(0.01, 0, 0.01);
      b.tri(b.vert(base.clone().sub(sd), UP, 0.5, 0, shade(stem, 0.6)), b.vert(base.clone().add(sd), UP, 0.5, 0, shade(stem, 0.6)), b.vert(top, UP, 0.5, 1, stem));
      const col = shade(lin(set[i % set.length]), rng.range(0.9, 1.05));
      const centre = i % 3 === 0 ? lin(0x6b3a1a) : lin(0xf7d23e);
      // 6-triangle disc with petal tips / notches
      const rr = rng.range(0.06, 0.085);
      const f = new THREE.Vector3(rng.range(-0.35, 0.35), 1, rng.range(-0.35, 0.35)).normalize();
      const rx = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), f).normalize();
      const ry = new THREE.Vector3().crossVectors(f, rx).normalize();
      const c0 = b.vert(top, f, 0.5, 0.5, centre);
      const rim: number[] = [];
      const rot = rng.range(0, 6);
      for (let k = 0; k < 6; k++) {
        const a = rot + (k / 6) * Math.PI * 2;
        const rad = k % 2 === 0 ? rr : rr * 0.75;
        rim.push(b.vert(top.clone().addScaledVector(rx, Math.cos(a) * rad).addScaledVector(ry, Math.sin(a) * rad).addScaledVector(f, rr * 0.2), f, 0.5, 0.5, col));
      }
      for (let k = 0; k < 6; k++) b.tri(c0, rim[k], rim[(k + 1) % 6]);
    }
    return { name: `veg.flowerPatch.${v}`, parts: [{ geometry: b.build(), material: 'flower', castShadow: false }] };
  });
}

// ---------------------------------------------------------------------------
// Ground cover
// ---------------------------------------------------------------------------

const COVERS = [
  { mat: 'canopyDark' as const, cards: 22, r: 1.25, k: 1.5, seed: 3 },
  { mat: 'canopy' as const, cards: 20, r: 1.15, k: 1.05, seed: 8 },
];

/**
 * Low leafy carpet (~2.4 m patch, 0.1–0.45 m high) of up-facing leaf-cluster cards with dome
 * normals. Very cheap (~30 tris): scatter densely to hide bare jungle floor between plants.
 */
export function groundCover(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, COVERS.length);
  return memoAsset(`veg.groundCover.${v}`, () => {
    const cfg = COVERS[v];
    const rng = new Rng(cfg.seed * 433 + 9);
    const b = new GeoBuilder();
    const centre = new THREE.Vector3(0, -1.2, 0);
    for (let i = 0; i < cfg.cards; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * cfg.r;
      const edge = d / cfg.r;
      const pos = new THREE.Vector3(Math.sin(a) * d, rng.range(0.12, 0.32) * (1 - 0.55 * edge), Math.cos(a) * d);
      const facing = new THREE.Vector3(Math.sin(a) * edge * 0.6 + rng.range(-0.35, 0.35), 1, Math.cos(a) * edge * 0.6 + rng.range(-0.35, 0.35)).normalize();
      const size = rng.range(0.85, 1.2) * (1 - 0.25 * edge);
      const lum = rng.range(0.85, 1.08) * (1 - 0.25 * edge);
      const warm = rng.range(-0.05, 0.06);
      card(b, {
        center: pos,
        facing,
        width: size,
        height: size,
        roll: rng.range(0, Math.PI * 2),
        normal: (p) => p.clone().sub(centre).normalize().lerp(UP, 0.35).normalize(),
        color: (p) => shade(rgb(1.0, 1.04, 0.9).multiplyScalar(cfg.k), lum * (0.6 + 0.4 * smooth01(p.y / 0.3)), warm),
      });
    }
    // low dark leafy mound under the cards: gaps read as shadowed foliage instead of bare soil
    const seed = rng.range(0, 50);
    icoBlob(
      b,
      new THREE.Vector3(0, -0.03, 0),
      new THREE.Vector3(cfg.r * 0.62, 0.13, cfg.r * 0.62),
      1,
      (p) => shade(rgb(0.36, 0.42, 0.36).multiplyScalar(cfg.k), 0.7 + 0.3 * smooth01(p.y / 0.1)),
      () => CORE_UV[cfg.mat],
      (d) => 0.32 * vegNoise.noise(d.x * 2.6 + seed, d.z * 2.6),
    );
    return { name: `veg.groundCover.${v}`, parts: [{ geometry: b.build(), material: cfg.mat, castShadow: false }] };
  });
}

// ---------------------------------------------------------------------------
// Grass
// ---------------------------------------------------------------------------

/** Crossed grass cards (0.45 m lush / 0.85 m tall). grass material. */
export function grassClump(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.grass.${v}`, () => {
    const rng = new Rng(v * 59 + 2);
    const b = new GeoBuilder();
    const h = v === 0 ? 0.45 : 0.85;
    const w = v === 0 ? 0.6 : 0.85;
    const cards = v === 0 ? 4 : 5;
    const tintTop = v === 0 ? rgb(1.0, 1.06, 0.92) : rgb(1.12, 1.06, 0.78);
    for (let i = 0; i < cards; i++) {
      const az = (i / cards) * Math.PI + rng.range(-0.2, 0.2);
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const out = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(rng.sign());
      const ox = rng.range(-0.08, 0.08);
      const oz = rng.range(-0.08, 0.08);
      const hh = h * rng.range(0.85, 1.12);
      const lean = rng.range(0.05, 0.18) * hh;
      // 2 segments: bottom, middle, top rows
      const rows: number[][] = [];
      for (let k = 0; k <= 2; k++) {
        const t = k / 2;
        const y = hh * t;
        const bendOut = lean * t * t;
        const spread = 1 + 0.25 * t;
        const row: number[] = [];
        for (const sx of [-1, 1]) {
          const p = new THREE.Vector3(ox, y, oz).addScaledVector(dir, (sx * w * spread) / 2).addScaledVector(out, bendOut);
          const n = out.clone().multiplyScalar(0.35).add(UP).normalize();
          const c = mix(rgb(0.55, 0.62, 0.55), tintTop, smooth01(t * 1.2));
          row.push(b.vert(p, n, sx < 0 ? 0 : 1, t, c));
        }
        rows.push(row);
      }
      for (let k = 0; k < 2; k++) b.quad(rows[k][0], rows[k][1], rows[k + 1][1], rows[k + 1][0]);
    }
    return { name: `veg.grass.${v}`, parts: [{ geometry: b.build(), material: 'grass', castShadow: false }] };
  });
}

// ---------------------------------------------------------------------------
// Hanging vines
// ---------------------------------------------------------------------------

/**
 * Vine curtain: strands 3–6 m long. ATTACHMENT AT LOCAL y = 0, strands hang down to negative y
 * (place the instance at the attachment height, e.g. under an arch or a branch). Strands use
 * jungleBark, leaves the `canopy` material (both effectively static below the origin).
 * Variant 0: 2.4 m wide curtain; variant 1: narrow cluster of long strands.
 */
export function hangingVines(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.hangingVines.${v}`, () => {
    const rng = new Rng(v * 811 + 23);
    const strands = new GeoBuilder();
    const leaves = new GeoBuilder();
    const n = v === 0 ? 7 : 5;
    const width = v === 0 ? 2.4 : 1.0;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * width + rng.range(-0.12, 0.12);
      const z = rng.range(-0.15, 0.15);
      const len = v === 0 ? rng.range(3.0, 5.2) : rng.range(4.2, 6.0);
      const pts: THREE.Vector3[] = [];
      const segs = 7;
      const swayA = rng.range(0, Math.PI * 2);
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        pts.push(
          new THREE.Vector3(
            x + Math.sin(swayA) * 0.25 * Math.sin(t * 2.2) + 0.06 * vegNoise.noise(t * 4 + i, 1),
            -len * t,
            z + Math.cos(swayA) * 0.25 * Math.sin(t * 2.2) + 0.06 * vegNoise.noise(t * 4 - i, 3),
          ),
        );
      }
      const sr = rng.range(0.025, 0.04);
      tube(strands, pts, {
        radial: 3,
        radius: (t) => sr * (1 - 0.4 * t),
        uRepeat: 0.4,
        vPerMetre: 0.5,
        color: () => rgb(2.1, 2.5, 1.25),
        capEnd: 'cone',
      });
      // leaf cards, denser near the top
      const cards = Math.round(len * 1.6);
      for (let k = 0; k < cards; k++) {
        const t = Math.pow((k + rng.range(0.1, 0.9)) / cards, 1.25);
        const f = t * segs;
        const s0 = Math.min(segs - 1, Math.floor(f));
        const p = pts[s0].clone().lerp(pts[s0 + 1], f - s0);
        const az = rng.range(0, Math.PI * 2);
        p.add(new THREE.Vector3(Math.sin(az) * 0.08, 0, Math.cos(az) * 0.08));
        const size = rng.range(0.42, 0.65) * (1 - 0.35 * t);
        const u0 = rng.range(0.12, 0.38);
        const v0 = rng.range(0.12, 0.38);
        const facing = new THREE.Vector3(Math.sin(az), rng.range(-0.1, 0.4), Math.cos(az));
        const nrm = facing.clone().setY(0).normalize().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.8, 0)).normalize();
        const c = shade(rgb(0.9, 1.0, 0.82), rng.range(0.8, 1.1) * (1 - 0.25 * t), rng.range(-0.05, 0.06));
        card(leaves, { center: p, facing, width: size, height: size, roll: rng.range(0, 6.28), uv: [u0, v0, u0 + 0.5, v0 + 0.5], normal: () => nrm, color: () => c });
      }
    }
    // tangle of leaves along the attachment line
    for (let k = 0; k < (v === 0 ? 9 : 5); k++) {
      const p = new THREE.Vector3(rng.range(-width / 2, width / 2), rng.range(-0.35, 0.05), rng.range(-0.2, 0.2));
      const az = rng.range(0, Math.PI * 2);
      const facing = new THREE.Vector3(Math.sin(az), rng.range(0, 0.6), Math.cos(az));
      const size = rng.range(0.6, 0.9);
      card(leaves, {
        center: p,
        facing,
        width: size,
        height: size,
        roll: rng.range(0, 6.28),
        uv: [0.1, 0.1, 0.9, 0.9],
        normal: () => UP,
        color: () => shade(rgb(0.95, 1.02, 0.85), rng.range(0.85, 1.05)),
      });
    }
    return {
      name: `veg.hangingVines.${v}`,
      parts: [
        { geometry: strands.build(), material: 'jungleBark', castShadow: true },
        { geometry: leaves.build(), material: 'canopy', castShadow: true },
      ],
    };
  });
}

