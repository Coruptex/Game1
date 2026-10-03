import * as THREE from 'three';
import type { InstancedAsset } from '../PropTypes';
import { Palette } from '../../assets/materials/MaterialLibrary';
import { Rng } from '../../utils/random';
import { GeoBuilder, icoBlob, lin, memoAsset, mix, shade, smooth01, vegNoise, wrapVariant } from './VegUtils';

/**
 * Boulders, cliff rocks and pebbles ('rock' material: the texture is a grayscale detail multiplier,
 * so the vertex colours ARE the rock colour). Moss = green vertex tint on upward-facing faces.
 * Shading is "soft faceted": face normals blended with smooth normals (chunky but painterly).
 */



/** Indexed unit icosphere (shared vertices). */
function icosphere(detail: number): { verts: THREE.Vector3[]; faces: number[] } {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const pos = ico.attributes.position;
  const map = new Map<string, number>();
  const verts: THREE.Vector3[] = [];
  const faces: number[] = [];
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    const z = pos.getZ(k);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length;
      map.set(key, id);
      verts.push(new THREE.Vector3(x, y, z));
    }
    faces.push(id);
  }
  ico.dispose();
  return { verts, faces };
}

interface RockShape {
  radii: THREE.Vector3;
  detail: number;
  /** Noise displacement (fraction of radius). */
  bumpy: number;
  freq: number;
  /** Planar cuts: count and how deep they bite (0.5 = deep, 0.9 = shallow). */
  cuts: number;
  cutDepth: [number, number];
  /** Horizontal-ish cut normals (cliffs) instead of random ones. */
  verticalFaces?: boolean;
  /** Horizontal strata ledges strength. */
  strata?: number;
  /** Fraction of the height sunk below y = 0. */
  sink: number;
  offset?: THREE.Vector3;
  rotY?: number;
}

interface RockLook {
  base: THREE.Color;
  alt: THREE.Color;
  moss: THREE.Color;
  mossAmount: number;
  /** Blend of face normal vs smooth normal (1 = fully faceted). */
  facet: number;
  /** Darker wet band height (sea cliffs), 0 = none. */
  wetBand?: number;
  uvScale: number;
}

/** Shapes a displaced, plane-cut icosphere and emits soft-faceted triangles into `b`. */
function rockMesh(b: GeoBuilder, rng: Rng, shape: RockShape, look: RockLook): void {
  const { verts, faces } = icosphere(shape.detail);
  const seed = rng.range(0, 100);
  const pts = verts.map((d) => {
    const n = vegNoise.noise(d.x * shape.freq + seed, d.y * shape.freq * 1.3 - d.z * shape.freq) * 0.65 + vegNoise.noise(d.z * shape.freq * 2.1 - seed, d.x * shape.freq * 2.1 + d.y) * 0.35;
    const k = 1 + shape.bumpy * n;
    return new THREE.Vector3(d.x * shape.radii.x * k, d.y * shape.radii.y * k, d.z * shape.radii.z * k);
  });
  // planar cuts -> big flat facets
  for (let c = 0; c < shape.cuts; c++) {
    const ca = rng.range(0, Math.PI * 2);
    const n = shape.verticalFaces
      ? new THREE.Vector3(Math.cos(ca), rng.range(-0.25, 0.45), Math.sin(ca)).normalize()
      : new THREE.Vector3(rng.range(-1, 1), rng.range(-0.3, 1), rng.range(-1, 1)).normalize();
    const extent = Math.abs(n.x) * shape.radii.x + Math.abs(n.y) * shape.radii.y + Math.abs(n.z) * shape.radii.z;
    const o = extent * rng.range(shape.cutDepth[0], shape.cutDepth[1]);
    for (const p of pts) {
      const d = p.dot(n);
      if (d > o) p.addScaledVector(n, -(d - o) * 0.92);
    }
  }
  if (shape.strata) {
    for (const p of pts) {
      const y = p.y / shape.radii.y;
      const saw = (y * 4.5 + 10) % 1;
      const k = 1 + shape.strata * (saw < 0.25 ? -0.6 : 0.25) * smooth01(1 - Math.abs(y));
      p.x *= k;
      p.z *= k;
    }
  }
  // sit on the ground
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const h = maxY - minY;
  const lift = -minY - h * shape.sink;
  const rot = new THREE.Matrix4().makeRotationY(shape.rotY ?? 0);
  for (const p of pts) {
    p.y += lift;
    if (p.y < 0) p.y *= 0.4; // flatten the buried underside
    p.applyMatrix4(rot);
    if (shape.offset) p.add(shape.offset);
  }
  // smooth normals
  const smoothN = pts.map(() => new THREE.Vector3());
  const fn: THREE.Vector3[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (let f = 0; f < faces.length; f += 3) {
    const a = pts[faces[f]];
    const bb = pts[faces[f + 1]];
    const c = pts[faces[f + 2]];
    const n = new THREE.Vector3().crossVectors(e1.subVectors(bb, a), e2.subVectors(c, a));
    smoothN[faces[f]].add(n);
    smoothN[faces[f + 1]].add(n);
    smoothN[faces[f + 2]].add(n);
    fn.push(n.normalize());
  }
  for (const n of smoothN) n.normalize();
  const top = (shape.offset?.y ?? 0) + h * (1 - shape.sink);
  for (let f = 0; f < faces.length; f += 3) {
    const n0 = fn[f / 3];
    const ax = Math.abs(n0.x);
    const ay = Math.abs(n0.y);
    const az = Math.abs(n0.z);
    const faceJ = rng.range(0.92, 1.06);
    const ids: number[] = [];
    for (let k = 0; k < 3; k++) {
      const vi = faces[f + k];
      const p = pts[vi];
      const n = n0.clone().multiplyScalar(look.facet).addScaledVector(smoothN[vi], 1 - look.facet).normalize();
      // planar uv by dominant axis
      const s = look.uvScale;
      const uv: [number, number] = ay >= ax && ay >= az ? [p.x * s, p.z * s] : ax >= az ? [p.z * s, p.y * s] : [p.x * s, p.y * s];
      const patch = vegNoise.noise(p.x * 0.7 + seed, p.z * 0.7 + p.y * 0.5);
      let col = mix(look.base, look.alt, smooth01(0.5 + patch * 0.8));
      // moss on upward faces, broken up by noise
      const mossK = smooth01((n.y - 0.3) / 0.45) * smooth01(0.55 + vegNoise.noise(p.x * 1.3 - seed, p.z * 1.3 + p.y) * 0.9) * look.mossAmount;
      col = mix(col, shade(look.moss, 0.9 + 0.25 * patch), mossK);
      // streaks / crevice darkening
      const ao = 0.62 + 0.38 * smooth01(p.y / Math.max(0.4, Math.min(1.2, top * 0.35)));
      let lum = ao * faceJ * (0.94 + 0.08 * Math.max(0, n.y));
      if (look.wetBand && p.y < look.wetBand) lum *= THREE.MathUtils.lerp(0.55, 1, smooth01(p.y / look.wetBand));
      ids.push(b.vert(p, n, uv[0], uv[1], shade(col, lum)));
    }
    b.tri(ids[0], ids[1], ids[2]);
  }
}

const BOULDERS = [
  { r: 0.3, h: 0.62, detail: 1, sink: 0.2, collider: { radius: 0.24, height: 0.32 } },
  { r: 0.55, h: 0.66, detail: 1, sink: 0.18, collider: { radius: 0.48, height: 0.62 } },
  { r: 0.95, h: 0.66, detail: 2, sink: 0.16, collider: { radius: 0.85, height: 1.1 } },
  { r: 1.55, h: 0.7, detail: 3, sink: 0.15, collider: { radius: 1.4, height: 1.9 } },
];

/** Mossy boulder, small -> large (≈0.6 / 1.1 / 1.9 / 3.1 m wide). Circle collider. */
export function rock(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, BOULDERS.length);
  return memoAsset(`veg.rock.${v}`, () => {
    const cfg = BOULDERS[v];
    const rng = new Rng(v * 211 + 900);
    const b = new GeoBuilder();
    rockMesh(
      b,
      rng,
      {
        radii: new THREE.Vector3(cfg.r * rng.range(1.0, 1.2), cfg.r * cfg.h, cfg.r * rng.range(0.85, 1.0)),
        detail: cfg.detail,
        bumpy: 0.22,
        freq: 1.4,
        cuts: 4 + v,
        cutDepth: [0.6, 0.85],
        sink: cfg.sink,
      },
      {
        base: mix(lin(Palette.rock), lin(Palette.stone), 0.35),
        alt: lin(Palette.stone),
        moss: lin(0x6a9433),
        mossAmount: 0.9,
        facet: 0.42,
        uvScale: 1 / 1.4,
      },
    );
    return { name: `veg.rock.${v}`, parts: [{ geometry: b.build(), material: 'rock', castShadow: v >= 1 }], collider: cfg.collider };
  });
}

interface SlabLayer {
  /** Ring radii per side (irregular polygon). */
  radii: number[];
  y0: number;
  y1: number;
  dx: number;
  dz: number;
  taper: number;
}

/**
 * Stacked layered rock: irregular polygonal slabs with flat vertical faces, horizontal ledges
 * (mossy) between layers and a domed mossy top. Reads as angular sedimentary cliff rock.
 */
function layeredRock(b: GeoBuilder, rng: Rng, o: { sides: number; radius: number; height: number; layers: number; center: THREE.Vector3; squashX: number; seed: number }): void {
  const N = o.sides;
  const angles: number[] = [];
  for (let i = 0; i < N; i++) angles.push(((i + rng.range(-0.3, 0.3)) / N) * Math.PI * 2);
  const baseR = angles.map(() => o.radius * rng.range(0.78, 1.12));
  const layers: SlabLayer[] = [];
  let y = -0.4;
  const hs: number[] = [];
  for (let k = 0; k < o.layers; k++) hs.push(rng.range(0.7, 1.3));
  const hsum = hs.reduce((a, c) => a + c, 0);
  let shrink = 1;
  for (let k = 0; k < o.layers; k++) {
    const h = ((o.height + 0.4) * hs[k]) / hsum;
    layers.push({
      radii: baseR.map((r) => r * shrink * rng.range(0.9, 1.08)),
      y0: y,
      y1: y + h,
      dx: rng.range(-0.25, 0.25) * o.radius * 0.3,
      dz: rng.range(-0.25, 0.25) * o.radius * 0.3,
      taper: rng.range(0.88, 0.98),
    });
    y += h;
    shrink *= rng.range(0.8, 0.93);
  }
  const base = lin(Palette.rockWarm);
  const alt = lin(Palette.stone);
  const cool = lin(Palette.rock);
  const moss = lin(0x6f9a35);
  const ringPt = (L: SlabLayer, i: number, top: boolean): THREE.Vector3 => {
    const r = L.radii[i] * (top ? L.taper : 1);
    const a = angles[i];
    return new THREE.Vector3(Math.sin(a) * r * o.squashX + L.dx, top ? L.y1 : L.y0, Math.cos(a) * r + L.dz).add(o.center);
  };
  const face = (pts: THREE.Vector3[], layerIdx: number): void => {
    // flat-shaded polygon (triangle fan) with colour per vertex
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(pts[1], pts[0]), new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
    const band = layerIdx % 2 === 0 ? base : mix(alt, cool, 0.4);
    const ids = pts.map((p) => {
      const streak = vegNoise.noise(p.x * 0.9 + o.seed, p.z * 0.9 - p.y * 0.08);
      let c = mix(band, cool, smooth01(0.45 + streak * 0.6));
      const mossK = smooth01((n.y - 0.45) / 0.35) * smooth01(0.6 + vegNoise.noise(p.x * 0.8 - o.seed, p.z * 0.8) * 0.9);
      c = mix(c, shade(moss, 0.85 + 0.3 * streak), mossK);
      let lum = 0.82 + 0.18 * Math.max(0, n.y);
      if (p.y < 0.9) lum *= THREE.MathUtils.lerp(0.5, 1, smooth01(p.y / 0.9));
      lum *= 0.92 + 0.1 * vegNoise.noise(p.y * 1.7 + o.seed, layerIdx * 3.1);
      const s = 1 / 2.2;
      const uv: [number, number] = Math.abs(n.y) > 0.6 ? [p.x * s, p.z * s] : [(p.x + p.z) * s, p.y * s];
      return b.vert(p, n, uv[0], uv[1], shade(c, lum));
    });
    for (let k = 1; k < ids.length - 1; k++) b.tri(ids[0], ids[k], ids[k + 1]);
  };
  for (let k = 0; k < layers.length; k++) {
    const L = layers[k];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a0 = ringPt(L, i, false);
      const a1 = ringPt(L, j, false);
      const b1 = ringPt(L, j, true);
      const b0 = ringPt(L, i, true);
      // bend the face: push its middle in or out a little (chipped look)
      const mid = a0.clone().add(a1).add(b0).add(b1).multiplyScalar(0.25);
      const outward = mid.clone().sub(o.center).setY(0).normalize();
      mid.addScaledVector(outward, rng.range(-0.18, 0.12) * o.radius * 0.25);
      face([a0, a1, mid], k);
      face([a1, b1, mid], k);
      face([b1, b0, mid], k);
      face([b0, a0, mid], k);
    }
    // ledge to the next layer (or a domed cap on top)
    const top: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) top.push(ringPt(L, i, true));
    if (k + 1 < layers.length) {
      const nx = layers[k + 1];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const n0 = ringPt(nx, i, false);
        const n1 = ringPt(nx, j, false);
        n0.y = n1.y = L.y1 + 0.02;
        face([top[i], top[j], n1, n0], k);
      }
    } else {
      const c = top.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
      c.y += o.radius * 0.18;
      for (let i = 0; i < N; i++) face([top[i], top[(i + 1) % N], c], k);
    }
  }
}

/** Big angular cliff / coastline rock, 6–10 m tall (variant 0: tall stack, 1: broad wall). */
export function cliffRock(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.cliffRock.${v}`, () => {
    const rng = new Rng(v * 313 + 1000);
    const b = new GeoBuilder();
    const chunks =
      v === 0
        ? [
            { r: 2.3, h: 8.6, layers: 5, c: new THREE.Vector3(0, 0, 0), sx: 1.1 },
            { r: 1.8, h: 5.2, layers: 3, c: new THREE.Vector3(2.4, 0, 1.0), sx: 1.0 },
            { r: 1.5, h: 3.0, layers: 2, c: new THREE.Vector3(-2.0, 0, 1.6), sx: 1.2 },
            { r: 1.0, h: 1.6, layers: 2, c: new THREE.Vector3(0.6, 0, 2.9), sx: 1.0 },
          ]
        : [
            { r: 2.6, h: 6.2, layers: 4, c: new THREE.Vector3(0, 0, 0), sx: 1.35 },
            { r: 2.2, h: 4.8, layers: 3, c: new THREE.Vector3(3.9, 0, -0.3), sx: 1.2 },
            { r: 2.0, h: 3.6, layers: 3, c: new THREE.Vector3(-3.8, 0, 0.4), sx: 1.25 },
            { r: 1.3, h: 2.0, layers: 2, c: new THREE.Vector3(1.6, 0, 2.3), sx: 1.0 },
            { r: 1.1, h: 1.4, layers: 1, c: new THREE.Vector3(-1.7, 0, 2.4), sx: 1.1 },
          ];
    for (const ch of chunks) {
      layeredRock(b, rng, { sides: 8, radius: ch.r, height: ch.h, layers: ch.layers, center: ch.c, squashX: ch.sx, seed: rng.range(0, 50) });
    }
    return {
      name: `veg.cliffRock.${v}`,
      parts: [{ geometry: b.build(), material: 'rock', castShadow: true }],
      collider: v === 0 ? { radius: 2.8, height: 8 } : { radius: 3.4, height: 6 },
    };
  });
}

/** Cluster of 9 smooth pebbles in a ~1 m patch (beach / riverbed / path edges). */
export function pebbleCluster(variant = 0): InstancedAsset {
  const v = wrapVariant(variant, 2);
  return memoAsset(`veg.pebbles.${v}`, () => {
    const rng = new Rng(v * 29 + 1100);
    const b = new GeoBuilder();
    const cols = v === 0 ? [lin(Palette.rock), lin(Palette.stone), lin(Palette.rockDark), lin(0xc9bda0)] : [lin(0x9a9488), lin(0x6e6a60), lin(0xb8b0a0), lin(0x857e68)];
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 0.5;
      const s = rng.range(0.06, 0.17) * (i === 0 ? 1.4 : 1);
      const c = new THREE.Vector3(Math.sin(a) * d, s * 0.25, Math.cos(a) * d);
      const col = shade(cols[i % cols.length], rng.range(0.85, 1.1));
      const mossy = v === 1 && rng.chance(0.4);
      icoBlob(
        b,
        c,
        new THREE.Vector3(s * rng.range(1.0, 1.4), s * rng.range(0.45, 0.65), s),
        0,
        (_p, n) => shade(mossy && n.y > 0.5 ? mix(col, lin(Palette.moss), 0.6) : col, 0.75 + 0.3 * Math.max(0, n.y)),
        (p) => [p.x * 2, p.z * 2],
        undefined,
        new THREE.Matrix4().makeRotationY(rng.range(0, Math.PI * 2)),
      );
    }
    return { name: `veg.pebbles.${v}`, parts: [{ geometry: b.build(), material: 'rock', castShadow: false }] };
  });
}
