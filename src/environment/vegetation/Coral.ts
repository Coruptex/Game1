import * as THREE from 'three';
import type { InstancedAsset } from '../PropTypes';
import { Rng } from '../../utils/random';
import { GeoBuilder, UP, bentSpine, foldedStrip, leafStations, lin, memoAsset, mix, shade, smooth01, tube, vegNoise, wrapVariant } from './VegUtils';

/**
 * Stylised shallow-water corals (coral material: vertex colour + underwater caustics, single sided,
 * so every coral mesh is closed or explicitly double sided) and seaweed (flower material, sways).
 * Sizes 0.3–1.4 m, base at y = 0 (sink the instance ~5 cm into the seabed).
 */



/** Coral palettes: [base, body, tip]. */
const PALETTES: Record<string, [number, number, number]> = {
  pink: [0xc0245a, 0xff4f8e, 0xffb0d0],
  orange: [0xc8401a, 0xff6f1e, 0xffc24a],
  purple: [0x4a1a9a, 0x8a3ae8, 0xd0a0ff],
  yellow: [0xb08a00, 0xffcc1a, 0xfff08a],
  teal: [0x0a7a78, 0x14d0bc, 0x9afff0],
  red: [0x9a1010, 0xff3326, 0xffa070],
  tan: [0x8a6420, 0xe0a640, 0x6a9cff],
};

/**
 * Corals are seen through the shallow-water overlay (~50 % turquoise), so their vertex colours are
 * pushed above 1 (the scene renders to an HDR target and is tone mapped afterwards).
 */
const CORAL_BOOST = 1.3;

function cl(hex: number): THREE.Color {
  return lin(hex, CORAL_BOOST);
}

function pal(name: string): [THREE.Color, THREE.Color, THREE.Color] {
  const p = PALETTES[name];
  return [cl(p[0]), cl(p[1]), cl(p[2])];
}

/** Recursive chunky branch with rounded / pointed tips. */
function branch(
  b: GeoBuilder,
  rng: Rng,
  start: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  r0: number,
  depth: number,
  maxDepth: number,
  colors: [THREE.Color, THREE.Color, THREE.Color],
  opts: { spread: number; up: number; children: [number, number]; taper: number; radial: number; tipCap: 'round' | 'cone'; flat?: number },
): void {
  const end = start.clone().addScaledVector(dir, len);
  const bendAxis = new THREE.Vector3().crossVectors(dir, UP);
  if (bendAxis.lengthSq() < 1e-4) bendAxis.set(1, 0, 0);
  bendAxis.normalize();
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(rng.range(-0.08, 0.08), rng.range(0, 0.05), rng.range(-0.08, 0.08)).multiplyScalar(len));
  const pts = depth === 0 ? [start, mid, end] : [start, end];
  const r1 = r0 * opts.taper;
  const leaf = depth >= maxDepth;
  const totalDepth = maxDepth + 1;
  tube(b, pts, {
    radial: opts.radial,
    radius: (t) => THREE.MathUtils.lerp(r0, r1, t),
    color: (t, p) => {
      const g = (depth + t) / totalDepth;
      const c = g < 0.55 ? mix(colors[0], colors[1], g / 0.55) : mix(colors[1], colors[2], (g - 0.55) / 0.45);
      return shade(c, 0.85 + 0.15 * smooth01(p.y / 0.6) + 0.06 * vegNoise.noise(p.x * 9, p.z * 9));
    },
    capEnd: leaf ? opts.tipCap : 'flat',
  });
  if (leaf) return;
  const n = rng.int(opts.children[0], opts.children[1]);
  const az0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const az = az0 + (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const side = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const nd = dir.clone().multiplyScalar(1 - opts.spread).addScaledVector(side, opts.spread).add(new THREE.Vector3(0, opts.up, 0));
    if (opts.flat) nd.y *= opts.flat;
    nd.normalize();
    branch(b, rng, end.clone().addScaledVector(dir, -r1 * 0.3), nd, len * rng.range(0.7, 0.9), r1 * 0.95, depth + 1, maxDepth, colors, opts);
  }
}

const BRANCHING = ['pink', 'orange', 'purple'];

/** Chunky finger / tree coral, ~0.8 m. Variants: pink, orange, purple. */
export function coralBranching(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, BRANCHING.length);
  return memoAsset(`veg.coralBranching.${v}`, () => {
    const rng = new Rng(v * 97 + 400);
    const b = new GeoBuilder();
    const colors = pal(BRANCHING[v]);
    const trunks = 2;
    for (let i = 0; i < trunks; i++) {
      const start = new THREE.Vector3(i === 0 ? 0 : rng.range(-0.18, 0.18), -0.05, i === 0 ? 0 : rng.range(-0.18, 0.18));
      const dir = new THREE.Vector3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize();
      branch(b, rng, start, dir, i === 0 ? 0.34 : 0.24, i === 0 ? 0.095 : 0.075, 0, 2, colors, {
        spread: 0.55,
        up: 0.35,
        children: [2, 3],
        taper: 0.82,
        radial: 5,
        tipCap: 'round',
      });
    }
    return { name: `veg.coralBranching.${v}`, parts: [{ geometry: b.build(), material: 'coral', castShadow: false }] };
  });
}

const STAGHORN = ['tan', 'teal'];

/** Antler-like staghorn coral spreading outwards (~1.1 m wide). Variants: tan with blue tips, teal. */
export function coralStaghorn(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, STAGHORN.length);
  return memoAsset(`veg.coralStaghorn.${v}`, () => {
    const rng = new Rng(v * 131 + 500);
    const b = new GeoBuilder();
    const colors = pal(STAGHORN[v]);
    const arms = 4;
    for (let i = 0; i < arms; i++) {
      const az = (i / arms) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const dir = new THREE.Vector3(Math.sin(az), rng.range(0.55, 0.9), Math.cos(az)).normalize();
      branch(b, rng, new THREE.Vector3(0, -0.03, 0), dir, rng.range(0.3, 0.4), 0.075, 0, 2, colors, {
        spread: 0.45,
        up: 0.25,
        children: [2, 2],
        taper: 0.8,
        radial: 4,
        tipCap: 'cone',
      });
    }
    return { name: `veg.coralStaghorn.${v}`, parts: [{ geometry: b.build(), material: 'coral', castShadow: false }] };
  });
}

const BRAIN = [
  { body: 0xa8c030, groove: 0x34460a, ridge: 0xf2ff8a, r: 0.42 },
  { body: 0xff5a6e, groove: 0x6a0e30, ridge: 0xffc8bc, r: 0.36 },
];

/** Brain coral dome with meandering grooves (~0.8 m wide). Variants: lime, salmon. */
export function coralBrain(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, BRAIN.length);
  return memoAsset(`veg.coralBrain.${v}`, () => {
    const cfg = BRAIN[v];
    const b = new GeoBuilder();
    const body = cl(cfg.body);
    const groove = cl(cfg.groove);
    const ridge = cl(cfg.ridge);
    const seed = v * 13.7;
    const pattern = (d: THREE.Vector3): number => {
      // warped stripes -> meandering ridges
      const w = vegNoise.noise(d.x * 2.1 + seed, d.z * 2.1 - d.y * 1.3) * 2.2;
      return Math.sin((d.x * 0.8 + d.z * 0.6 + d.y * 0.4) * 11 + w * 3.2);
    };
    const r = cfg.r;
    const seg = 20;
    const rings = 8;
    const rows: number[][] = [];
    for (let i = 0; i <= rings; i++) {
      // from slightly below the ground (i = 0) to the pole (i = rings)
      const el = -0.18 + (i / rings) * (Math.PI / 2 + 0.18);
      const row: number[] = [];
      for (let j = 0; j <= seg; j++) {
        const az = (j / seg) * Math.PI * 2;
        const d = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
        const s2 = pattern(d);
        const k = 1 + 0.06 * s2 + 0.07 * vegNoise.noise(d.x * 3 + seed, d.z * 3);
        const p = new THREE.Vector3(d.x * r * 1.08 * k, d.y * r * 0.72 * k + 0.02, d.z * r * k);
        const n = new THREE.Vector3(d.x / 1.08, d.y / 0.72, d.z).normalize();
        const c = s2 > 0.25 ? mix(body, ridge, (s2 - 0.25) / 0.75) : mix(groove, body, smooth01((s2 + 1) / 1.25));
        row.push(b.vert(p, n, 0, 0, shade(c, 0.78 + 0.25 * Math.max(0, n.y) - (p.y < 0.06 ? 0.22 : 0))));
      }
      rows.push(row);
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
    }
    return { name: `veg.coralBrain.${v}`, parts: [{ geometry: b.build(), material: 'coral', castShadow: false }] };
  });
}

const FANS = [
  { col: 'purple', h: 1.15, w: 1.35 },
  { col: 'red', h: 0.85, w: 1.1 },
];

/** Sea fan: undulating perforated lattice fan in a vertical plane (double sided). */
export function coralFan(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, FANS.length);
  return memoAsset(`veg.coralFan.${v}`, () => {
    const cfg = FANS[v];
    const rng = new Rng(v * 59 + 600);
    const b = new GeoBuilder();
    const [c0, c1, c2] = pal(cfg.col);
    const cols = 12;
    const rows = 7;
    const grid: number[][] = [];
    const base = new THREE.Vector3(0, 0.12, 0);
    for (let i = 0; i <= rows; i++) {
      const rr = 0.06 + (i / rows) * 0.94;
      const row: number[] = [];
      for (let j = 0; j <= cols; j++) {
        const a = (j / cols - 0.5) * 2.3;
        const x = Math.sin(a) * rr * cfg.w * 0.5;
        const y = Math.cos(a) * rr * cfg.h + (rr > 0.9 ? rng.range(-0.04, 0.04) : 0);
        const z = 0.07 * Math.sin(x * 9 + y * 4) * rr + 0.05 * vegNoise.noise(x * 4, y * 4);
        const p = new THREE.Vector3(x, y, z).add(base);
        const n = new THREE.Vector3(-Math.cos(x * 9 + y * 4) * 0.4, 0.45, 1).normalize();
        const t = i / rows;
        const col = shade(t < 0.5 ? mix(c0, c1, t * 2) : mix(c1, c2, (t - 0.5) * 1.4), rng.range(0.9, 1.08));
        row.push(b.vert(p, n, j / cols, t, col));
      }
      grid.push(row);
    }
    const t0 = b.triangleCount;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const keep = i < 2 || rng.chance(0.74);
        if (keep) b.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]);
      }
    }
    b.doubleSide(t0);
    // stem
    tube(b, [new THREE.Vector3(0, -0.04, 0), new THREE.Vector3(0, 0.08, 0.01), base.clone().add(new THREE.Vector3(0, 0.05, 0))], {
      radial: 5,
      radius: (t) => 0.045 * (1 - 0.4 * t),
      color: () => shade(c0, 0.8),
    });
    return { name: `veg.coralFan.${v}`, parts: [{ geometry: b.build(), material: 'coral', castShadow: false }] };
  });
}

const TUBES = [
  { body: 0xffc21a, rim: 0xff6a1e, inside: 0x6a3a08 },
  { body: 0x8a3ae8, rim: 0xff5aa8, inside: 0x240a50 },
];

/** Cluster of tube sponges / organ-pipe coral (0.3–0.7 m). Variants: yellow-orange, violet-pink. */
export function coralTube(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, TUBES.length);
  return memoAsset(`veg.coralTube.${v}`, () => {
    const cfg = TUBES[v];
    const rng = new Rng(v * 71 + 700);
    const b = new GeoBuilder();
    const body = cl(cfg.body);
    const rim = cl(cfg.rim);
    const inside = cl(cfg.inside);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = i === 0 ? 0 : rng.range(0.1, 0.22);
      const base = new THREE.Vector3(Math.sin(az) * d, -0.04, Math.cos(az) * d);
      const h = i === 0 ? 0.68 : rng.range(0.28, 0.58);
      const r = rng.range(0.06, 0.1);
      const lean = new THREE.Vector3(Math.sin(az) * d * 0.5, h, Math.cos(az) * d * 0.5);
      const top = base.clone().add(lean);
      const pts = [base, base.clone().lerp(top, 0.5), top];
      const R = 7;
      tube(b, pts, {
        radial: R,
        radius: (t) => r * (0.85 + 0.3 * t * t),
        color: (t) => shade(mix(body, rim, smooth01((t - 0.6) / 0.4)), 0.75 + 0.3 * t),
      });
      // inner wall (reversed winding, dark) + rim ring
      const axis = top.clone().sub(base).normalize();
      const ref = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(1, 0, 0)).normalize();
      const ref2 = new THREE.Vector3().crossVectors(axis, ref).normalize();
      const rTop = r * 1.15;
      const rIn = rTop * 0.72;
      const outer: number[] = [];
      const innerTop: number[] = [];
      const innerLow: number[] = [];
      const low = top.clone().addScaledVector(axis, -h * 0.45);
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2;
        const dir = ref.clone().multiplyScalar(Math.cos(a)).addScaledVector(ref2, Math.sin(a));
        outer.push(b.vert(top.clone().addScaledVector(dir, rTop), axis.clone().add(dir).normalize(), 0, 0, rim));
        innerTop.push(b.vert(top.clone().addScaledVector(dir, rIn).addScaledVector(axis, 0.01), dir.clone().negate(), 0, 0, shade(rim, 0.6)));
        innerLow.push(b.vert(low.clone().addScaledVector(dir, rIn * 0.8), dir.clone().negate(), 0, 0, inside));
      }
      for (let j = 0; j < R; j++) {
        // rim annulus (faces up)
        b.quad(outer[j], outer[j + 1], innerTop[j + 1], innerTop[j]);
        // inner wall faces inwards
        b.quad(innerTop[j], innerTop[j + 1], innerLow[j + 1], innerLow[j]);
      }
      const bottom = b.vert(low, axis, 0, 0, shade(inside, 0.6));
      for (let j = 0; j < R; j++) b.tri(innerLow[j], innerLow[j + 1], bottom);
    }
    return { name: `veg.coralTube.${v}`, parts: [{ geometry: b.build(), material: 'coral', castShadow: false }] };
  });
}

const WEEDS = [
  { base: 0x2f5a12, tip: 0xa8d030, h: 1.15 },
  { base: 0x6a1020, tip: 0xff4a5a, h: 0.8 },
];

/** Kelp / seaweed ribbons (flower material so they sway gently). Variants: green kelp, red weed. */
export function seaweed(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, WEEDS.length);
  return memoAsset(`veg.seaweed.${v}`, () => {
    const cfg = WEEDS[v];
    const rng = new Rng(v * 37 + 800);
    const b = new GeoBuilder();
    const base = cl(cfg.base);
    const tip = cl(cfg.tip);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const az = rng.range(0, Math.PI * 2);
      const d = rng.range(0, 0.18);
      const o = new THREE.Vector3(Math.sin(az) * d, -0.03, Math.cos(az) * d);
      const h = cfg.h * rng.range(0.6, 1.1);
      const spine = bentSpine(o, rng.range(0, Math.PI * 2), 1.45, rng.range(0.1, 0.5), h, 6, 1.4, rng.range(-1.2, 1.2));
      // wavy sideways wiggle
      const ph = rng.range(0, 6);
      spine.forEach((p, k) => {
        const t = k / (spine.length - 1);
        p.x += Math.sin(t * 7 + ph) * 0.05 * t;
        p.z += Math.cos(t * 6 + ph) * 0.05 * t;
      });
      const w = rng.range(0.05, 0.085);
      const twist = rng.range(-1.5, 1.5);
      const st = leafStations(spine, new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), (t) => ({
        hw: w * (0.6 + 0.6 * Math.sin(Math.min(1, t * 1.15) * Math.PI)) * (1 - 0.7 * t * t),
        uHalf: 0.5,
        fold: 0.25 * Math.sin(t * 9 + ph),
        v: t,
        cCenter: shade(mix(base, tip, smooth01(t * 1.1)), 1.05),
        cEdge: shade(mix(base, tip, smooth01(t * 1.1)), 0.85),
        roll: twist * t,
      }));
      foldedStrip(b, st, UP, 0.5);
    }
    return { name: `veg.seaweed.${v}`, parts: [{ geometry: b.build(), material: 'flower', castShadow: false }] };
  });
}
