import * as THREE from 'three';
import type { MaterialName } from '../../assets/materials/MaterialLibrary';
import { ensureStandardAttributes, merge, paint, trs } from '../../assets/geometry/GeometryUtils';
import { Noise2D } from '../../utils/noise';
import type { Rng } from '../../utils/random';
import type { PropPart } from '../PropTypes';

/**
 * Small geometry kit shared by the pirate props & dock builders (src/environment/props).
 *
 * Conventions (see docs/ASSET_GUIDE.md):
 * - Geometry is built around the origin first (so UV projection / corner jitter work in a clean
 *   local frame) and then moved into place with `xf` / `place*`.
 * - Textured wood: `wood` / `woodDark` / `woodPale` use a grain that runs along V,
 *   `woodPlanks` has planks running along U (8 planks per texture tile).
 * - Vertex colours are linear-space multipliers; `lin()` builds them without sRGB conversion.
 */

export type Geo = THREE.BufferGeometry;
export type Axis = 'x' | 'y' | 'z';

const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

export const kitNoise = new Noise2D(7331);

const _m = new THREE.Matrix4();
const _c = new THREE.Color();

export const V3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** Linear-space colour (no sRGB conversion): use for near-white multipliers on textured materials. */
export function lin(r: number, g: number = r, b: number = r): THREE.Color {
  return new THREE.Color().setRGB(r, g, b);
}

/** sRGB palette colour scaled by `f` (in linear space). */
export function tone(hex: THREE.ColorRepresentation, f = 1): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(f);
}

/** Linear blend of two colours (returns a new colour). */
export function mix(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export function smooth01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Derives a stable seed from a user seed and a salt. */
export function seedOf(seed: number, salt: number): number {
  return ((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0) || 1;
}

// ---------------------------------------------------------------------------
// Part accumulation
// ---------------------------------------------------------------------------

export interface PartOptions {
  seeThrough?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Collects geometries per material and merges them into a compact PropPart list. */
export class PartSet {
  private readonly groups = new Map<string, { material: MaterialName; opts: PartOptions; geos: Geo[] }>();

  add(material: MaterialName, geo: Geo | Geo[], opts: PartOptions = {}): this {
    const key = `${material}|${opts.seeThrough ? 1 : 0}|${opts.castShadow === false ? 0 : 1}|${opts.receiveShadow === false ? 0 : 1}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { material, opts, geos: [] };
      this.groups.set(key, g);
    }
    if (Array.isArray(geo)) g.geos.push(...geo);
    else g.geos.push(geo);
    return this;
  }

  /** Adds already built parts, transformed by `m` (geometries are cloned). */
  addParts(parts: PropPart[], m?: THREE.Matrix4, override: PartOptions = {}): this {
    for (const p of parts) {
      const g = p.geometry.clone();
      if (m) g.applyMatrix4(m);
      this.add(p.material, g, {
        seeThrough: override.seeThrough ?? p.seeThrough,
        castShadow: override.castShadow ?? p.castShadow,
        receiveShadow: override.receiveShadow ?? p.receiveShadow,
      });
    }
    return this;
  }

  build(): PropPart[] {
    const out: PropPart[] = [];
    for (const g of this.groups.values()) {
      if (g.geos.length === 0) continue;
      const geometry = g.geos.length === 1 ? ensureStandardAttributes(g.geos[0]) : merge(g.geos);
      const part: PropPart = { geometry, material: g.material };
      if (g.opts.seeThrough) part.seeThrough = true;
      if (g.opts.castShadow === false) part.castShadow = false;
      if (g.opts.receiveShadow === false) part.receiveShadow = false;
      out.push(part);
    }
    return out;
  }
}

/** Triangle count of a part list (debug / budgets). */
export function triangleCount(parts: PropPart[]): number {
  let n = 0;
  for (const p of parts) {
    const g = p.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Transforms & colour
// ---------------------------------------------------------------------------

/** Transforms a geometry in place (Euler YXZ like GeometryUtils.trs). */
export function xf(geo: Geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): Geo {
  geo.applyMatrix4(trs(x, y, z, rx, ry, rz, sx, sy, sz, _m));
  return geo;
}

/** Multiplies vertex colours by a colour computed from the vertex position. */
export function shade(geo: Geo, fn: (x: number, y: number, z: number, out: THREE.Color) => void): Geo {
  ensureStandardAttributes(geo);
  const pos = geo.attributes.position;
  const col = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    _c.setRGB(1, 1, 1);
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), _c);
    col.setXYZ(i, col.getX(i) * _c.r, col.getY(i) * _c.g, col.getZ(i) * _c.b);
  }
  col.needsUpdate = true;
  return geo;
}

/** Reverses triangle winding and normals (inside surfaces). */
export function flipFaces(geo: Geo): Geo {
  ensureStandardAttributes(geo);
  const idx = geo.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  idx.needsUpdate = true;
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  n.needsUpdate = true;
  return geo;
}

/** Rewrites the uv.x channel (cloth / flag shaders ripple by uv.x). */
export function setUvX(geo: Geo, fn: (x: number, y: number, z: number, u: number, v: number) => number): Geo {
  ensureStandardAttributes(geo);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setX(i, fn(pos.getX(i), pos.getY(i), pos.getZ(i), uv.getX(i), uv.getY(i)));
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------
// UVs
// ---------------------------------------------------------------------------

export interface GrainUV {
  /** Local axis the grain / planks run along. */
  grain: Axis;
  /** Metres per texture tile along the grain. */
  along: number;
  /** Metres per texture tile across the grain. */
  across: number;
  /** woodPlanks: true (planks run along U). wood/woodDark/woodPale: false (grain along V). */
  grainOnU?: boolean;
  u0?: number;
  v0?: number;
}

/**
 * Box-style planar UV projection chosen per vertex from its normal. The grain follows `grain` on
 * every face that contains that axis; end faces use the two remaining axes (vertical as "across").
 * Call on geometry centred at the origin, before moving it into place.
 */
export function projectUV(geo: Geo, o: GrainUV): Geo {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  let uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  const gi = AXIS_INDEX[o.grain];
  const p = [0, 0, 0];
  const i1 = gi === 0 ? 2 : 0;
  const i2 = gi === 1 ? 2 : 1;
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    const ni = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    let a: number;
    let b: number;
    if (ni !== gi) {
      a = p[gi] / o.along;
      b = p[3 - gi - ni] / o.across;
    } else {
      a = p[i1] / o.along;
      b = p[i2] / o.across;
    }
    const u = o.grainOnU ? a : b;
    const v = o.grainOnU ? b : a;
    uv.setXY(i, u + (o.u0 ?? 0), v + (o.v0 ?? 0));
  }
  uv.needsUpdate = true;
  return geo;
}

/** UV options mapping one geometric plank of width `w` onto exactly one plank of the woodPlanks texture. */
export function plankUV(grain: Axis, w: number, rng: Rng, along = 2.6): GrainUV {
  return { grain, along, across: 8 * w, grainOnU: true, u0: rng.next(), v0: (rng.int(0, 7) + 0.5) / 8 };
}

/** Typical `wood` grain mapping (grain along `grain`). */
export function grainUV(grain: Axis, rng?: Rng, along = 1.6, across = 0.8): GrainUV {
  return { grain, along, across, grainOnU: false, u0: rng ? rng.next() : 0, v0: rng ? rng.next() : 0 };
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

/** Moves the 8 corners of a (segment-less, origin-centred) box by random offsets. */
export function jitterCorners(geo: Geo, amount: number, rng: Rng): Geo {
  const offs: number[] = [];
  for (let i = 0; i < 24; i++) offs.push(rng.range(-amount, amount));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const c = (x > 0 ? 1 : 0) | (y > 0 ? 2 : 0) | (z > 0 ? 4 : 0);
    pos.setXYZ(i, x + offs[c * 3], y + offs[c * 3 + 1], z + offs[c * 3 + 2]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export interface BoxOpts {
  uv?: GrainUV;
  jitter?: number;
  rng?: Rng;
  rx?: number;
  ry?: number;
  rz?: number;
  color?: THREE.ColorRepresentation;
}

/** Box centred at (x, y, z) with optional grain UVs, corner jitter, colour and rotation. */
export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, o: BoxOpts = {}): Geo {
  const g = new THREE.BoxGeometry(w, h, d);
  if (o.uv) projectUV(g, o.uv);
  if (o.jitter && o.rng) jitterCorners(g, o.jitter, o.rng);
  paint(g, o.color ?? 0xffffff);
  return xf(g, x, y, z, o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
}

/** Builds a flat-shaded convex solid from polygons (any winding; fixed against the origin). */
export function convexPolys(polys: THREE.Vector3[][]): Geo {
  const positions: number[] = [];
  const normals: number[] = [];
  const n = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const poly0 of polys) {
    let poly = poly0;
    c.set(0, 0, 0);
    for (const p of poly) c.add(p);
    c.multiplyScalar(1 / poly.length);
    n.set(0, 0, 0);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    if (n.dot(c) < 0) {
      poly = [...poly].reverse();
      n.negate();
    }
    n.normalize();
    for (let i = 1; i < poly.length - 1; i++) {
      for (const p of [poly[0], poly[i], poly[i + 1]]) {
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  return g;
}

/**
 * Box with all 12 edges chamfered (44 tris). Edges catch light, which reads far better than a
 * plain box in the stylised look. Optional per-corner jitter for hand-cut stone / timber.
 */
export function chamferBox(w: number, h: number, d: number, c: number, o: { jitter?: number; rng?: Rng; uv?: GrainUV } = {}): Geo {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const ch = Math.min(c, hx * 0.8, hy * 0.8, hz * 0.8);
  const pts = new Map<string, THREE.Vector3>();
  const k = (sx: number, sy: number, sz: number, f: string) => `${sx}${sy}${sz}${f}`;
  const j = o.jitter && o.rng ? o.jitter : 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const jx = j ? o.rng!.range(-j, j) : 0;
        const jy = j ? o.rng!.range(-j, j) : 0;
        const jz = j ? o.rng!.range(-j, j) : 0;
        pts.set(k(sx, sy, sz, 'x'), V3(sx * hx + jx, sy * (hy - ch) + jy, sz * (hz - ch) + jz));
        pts.set(k(sx, sy, sz, 'y'), V3(sx * (hx - ch) + jx, sy * hy + jy, sz * (hz - ch) + jz));
        pts.set(k(sx, sy, sz, 'z'), V3(sx * (hx - ch) + jx, sy * (hy - ch) + jy, sz * hz + jz));
      }
    }
  }
  const P = (sx: number, sy: number, sz: number, f: string) => pts.get(k(sx, sy, sz, f))!;
  const polys: THREE.Vector3[][] = [];
  const quad: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const s of [-1, 1]) {
    polys.push(quad.map(([a, b]) => P(s, a, b, 'x')));
    polys.push(quad.map(([a, b]) => P(a, s, b, 'y')));
    polys.push(quad.map(([a, b]) => P(a, b, s, 'z')));
  }
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      // edges along z (between x and y faces)
      polys.push([P(s1, s2, -1, 'x'), P(s1, s2, 1, 'x'), P(s1, s2, 1, 'y'), P(s1, s2, -1, 'y')]);
      // edges along y (between x and z faces)
      polys.push([P(s1, -1, s2, 'x'), P(s1, 1, s2, 'x'), P(s1, 1, s2, 'z'), P(s1, -1, s2, 'z')]);
      // edges along x (between y and z faces)
      polys.push([P(-1, s1, s2, 'y'), P(1, s1, s2, 'y'), P(1, s1, s2, 'z'), P(-1, s1, s2, 'z')]);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) polys.push([P(sx, sy, sz, 'x'), P(sx, sy, sz, 'y'), P(sx, sy, sz, 'z')]);
  const g = convexPolys(polys);
  if (o.uv) projectUV(g, o.uv);
  return g;
}

/** Box oriented from `a` to `b` (local Z along the segment, local Y kept close to world up). */
export function beamBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  w: number,
  h: number,
  o: { uv?: Partial<GrainUV>; jitter?: number; rng?: Rng; roll?: number; color?: THREE.ColorRepresentation; extend?: number } = {},
): Geo {
  const len = a.distanceTo(b) + (o.extend ?? 0) * 2;
  const g = new THREE.BoxGeometry(w, h, len);
  projectUV(g, { grain: 'z', along: 1.6, across: 0.8, u0: o.rng ? o.rng.next() : 0, v0: o.rng ? o.rng.next() : 0, ...o.uv });
  if (o.jitter && o.rng) jitterCorners(g, o.jitter, o.rng);
  paint(g, o.color ?? 0xffffff);
  orientAlong(g, a, b, o.roll ?? 0, 0.5);
  return g;
}

/** Rotates local +Z onto (b - a) with local +Y as close to world up as possible, then moves it. */
export function orientAlong(g: Geo, a: THREE.Vector3, b: THREE.Vector3, roll = 0, at = 0.5): Geo {
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const up = Math.abs(dir.y) > 0.985 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(up, dir).normalize();
  const yAxis = new THREE.Vector3().crossVectors(dir, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, dir);
  if (roll) m.multiply(new THREE.Matrix4().makeRotationZ(roll));
  const p = new THREE.Vector3().lerpVectors(a, b, at);
  m.setPosition(p);
  g.applyMatrix4(m);
  return g;
}

// ---------------------------------------------------------------------------
// Round shapes
// ---------------------------------------------------------------------------

export interface PostOpts {
  radius: number;
  radiusTop?: number;
  y0: number;
  y1: number;
  /** Extra ring heights (for colour gradients such as the water line). */
  rings?: number[];
  radial?: number;
  /** Radius noise (fraction of the radius). */
  jitter?: number;
  seed?: number;
  /** Horizontal offset per metre of height (leaning posts). */
  lean?: [number, number];
  /** Metres per texture tile along / around (grain along V). */
  along?: number;
  across?: number;
  u0?: number;
  v0?: number;
  cap?: 'flat' | 'dome' | 'none';
  bottomCap?: boolean;
  tint?: (y: number, out: THREE.Color) => void;
}

/** Vertical wooden post / piling / log with controllable rings, lean, radius noise and grain UVs. */
export function post(o: PostOpts): Geo {
  const radial = Math.max(3, o.radial ?? 8);
  const r0 = o.radius;
  const r1 = o.radiusTop ?? o.radius;
  const ys = [o.y0, ...(o.rings ?? []).filter((y) => y > o.y0 + 0.02 && y < o.y1 - 0.02), o.y1].sort((a, b) => a - b);
  const lean = o.lean ?? [0, 0];
  const seed = o.seed ?? 0;
  const jit = o.jitter ?? 0;
  const along = o.along ?? 1.6;
  const across = o.across ?? 0.8;
  const uTiles = Math.max(1, Math.round((Math.PI * 2 * Math.max(r0, r1)) / across));
  const u0 = o.u0 ?? 0;
  const v0 = o.v0 ?? 0;
  const angJ: number[] = [];
  for (let i = 0; i < radial; i++) angJ.push(1 + jit * kitNoise.noise(i * 1.37 + seed * 3.1, seed * 0.7 + 5.3));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const col = new THREE.Color();
  const span = Math.max(1e-4, o.y1 - o.y0);
  const ringR = (y: number) => {
    const t = (y - o.y0) / span;
    return (r0 + (r1 - r0) * t) * (1 + jit * 0.5 * kitNoise.noise(y * 1.3 + seed, seed * 1.9 - 2.1));
  };
  for (const y of ys) {
    const r = ringR(y);
    const cx = lean[0] * (y - o.y0);
    const cz = lean[1] * (y - o.y0);
    col.setRGB(1, 1, 1);
    if (o.tint) o.tint(y, col);
    for (let i = 0; i <= radial; i++) {
      const th = (i / radial) * Math.PI * 2;
      const f = angJ[i % radial];
      const s = Math.sin(th);
      const c = Math.cos(th);
      positions.push(cx + s * r * f, y, cz + c * r * f);
      normals.push(s, 0, c);
      uvs.push((i / radial) * uTiles + u0, y / along + v0);
      colors.push(col.r, col.g, col.b);
    }
  }
  const row = radial + 1;
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      index.push(a, b, d, a, d, c);
    }
  }
  const capRing = (y: number, up: boolean, dome: number) => {
    const r = ringR(y);
    const cx = lean[0] * (y - o.y0);
    const cz = lean[1] * (y - o.y0);
    col.setRGB(1, 1, 1);
    if (o.tint) o.tint(y, col);
    const base = positions.length / 3;
    positions.push(cx, y + (up ? dome : -dome), cz);
    normals.push(0, up ? 1 : -1, 0);
    uvs.push(0.5 + u0, 0.5 + v0);
    colors.push(col.r * 0.92, col.g * 0.9, col.b * 0.86);
    for (let i = 0; i <= radial; i++) {
      const th = (i / radial) * Math.PI * 2;
      const f = angJ[i % radial];
      const s = Math.sin(th);
      const c = Math.cos(th);
      positions.push(cx + s * r * f, y, cz + c * r * f);
      const tilt = dome > 0 ? 0.45 : 0;
      const nl = Math.hypot(tilt, 1);
      normals.push((s * tilt) / nl, (up ? 1 : -1) / nl, (c * tilt) / nl);
      uvs.push(0.5 + (s * r) / 0.5 + u0, 0.5 + (c * r) / 0.5 + v0);
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 0; i < radial; i++) {
      if (up) index.push(base, base + 1 + i, base + 2 + i);
      else index.push(base, base + 2 + i, base + 1 + i);
    }
  };
  const cap = o.cap ?? 'flat';
  if (cap !== 'none') capRing(o.y1, true, cap === 'dome' ? Math.max(r0, r1) * 0.28 : 0);
  if (o.bottomCap) capRing(o.y0, false, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}

/** Round rod (log, pole, bone, rope segment) from `a` to `b`. */
export function rodBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  rA: number,
  rB = rA,
  radial = 6,
  o: { caps?: boolean; along?: number; across?: number; jitter?: number; seed?: number; u0?: number; v0?: number } = {},
): Geo {
  const len = Math.max(1e-4, a.distanceTo(b));
  const g = post({
    radius: rA,
    radiusTop: rB,
    y0: 0,
    y1: len,
    radial,
    cap: o.caps ? 'flat' : 'none',
    bottomCap: !!o.caps,
    along: o.along ?? 1.6,
    across: o.across ?? 0.8,
    jitter: o.jitter ?? 0,
    seed: o.seed ?? 0,
    u0: o.u0,
    v0: o.v0,
  });
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Lathe around +Y from (radius, y) pairs. Optional metric UVs (grain along the profile). */
export function lathe(
  profile: Array<[number, number]>,
  segments: number,
  o: { along?: number; across?: number; u0?: number; v0?: number; phiStart?: number; phiLength?: number } = {},
): Geo {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const g = new THREE.LatheGeometry(pts, segments, o.phiStart ?? 0, o.phiLength ?? Math.PI * 2);
  if (o.along) {
    const cum: number[] = [0];
    for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + pts[j].distanceTo(pts[j - 1]));
    let maxR = 0;
    for (const p of pts) maxR = Math.max(maxR, p.x);
    const uTiles = Math.max(1, Math.round((Math.PI * 2 * maxR) / (o.across ?? 0.8)));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < pts.length; j++) {
        uv.setXY(i * pts.length + j, (i / segments) * uTiles + (o.u0 ?? 0), cum[j] / o.along + (o.v0 ?? 0));
      }
    }
    uv.needsUpdate = true;
  }
  return g;
}

/** Torus in the XY plane (rings, rope wraps, chain links). */
export function torus(radius: number, tube: number, radialSeg = 5, tubularSeg = 12, arc = Math.PI * 2): Geo {
  return new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg, arc);
}

/** Horizontal disc at height y facing up (or down). */
export function disc(radius: number, segments: number, y = 0, up = true): Geo {
  const g = new THREE.CircleGeometry(radius, segments);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// ---------------------------------------------------------------------------
// Rope
// ---------------------------------------------------------------------------

/** Tube along a smooth curve through `points`, with subtle twisted-strand shading. */
export function ropeAlong(
  points: THREE.Vector3[],
  radius: number,
  o: { segments?: number; radial?: number; closed?: boolean; color?: THREE.ColorRepresentation; twist?: number } = {},
): Geo {
  const closed = o.closed ?? false;
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const len = curve.getLength();
  const segs = o.segments ?? Math.max(3, Math.min(64, Math.round(len / 0.14)));
  const radial = o.radial ?? 5;
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
  paint(g, o.color ?? 0xffffff);
  const uv = g.attributes.uv;
  const col = g.attributes.color as THREE.BufferAttribute;
  const pitch = o.twist ?? 0.09;
  for (let i = 0; i < col.count; i++) {
    const s = (uv.getX(i) * len) / pitch + uv.getY(i) * 2;
    const f = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(s * Math.PI * 2));
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  col.needsUpdate = true;
  return g;
}

/** Points of a hanging rope between a and b (parabolic sag). */
export function sagPoints(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 8): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= 4 * sag * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

/** Sagging rope between two points. */
export function sagRope(a: THREE.Vector3, b: THREE.Vector3, sag: number, radius = 0.03, o: { radial?: number; segments?: number } = {}): Geo {
  const len = a.distanceTo(b);
  return ropeAlong(sagPoints(a, b, sag, Math.max(2, Math.min(10, Math.round(len / 0.35)))), radius, {
    radial: o.radial ?? 4,
    segments: o.segments ?? Math.max(4, Math.min(24, Math.round(len / 0.22))),
  });
}

/** Horizontal rope lashing (torus) around a vertical post at height y. */
export function ropeWrap(x: number, y: number, z: number, radius: number, thickness = 0.03, rng?: Rng): Geo {
  const g = torus(radius, thickness, 4, 10);
  paint(g, lin(rng ? rng.range(0.85, 1) : 1));
  return xf(g, x, y, z, Math.PI / 2 + (rng ? rng.range(-0.12, 0.12) : 0), rng ? rng.range(0, 3) : 0, rng ? rng.range(-0.1, 0.1) : 0);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Extruded 2D outline: shape in (x, y), extruded along +Z by `depth` and centred on z = 0. */
export function extrudeShape(points: Array<[number, number]>, depth: number, bevel = 0): Geo {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Linear interpolation of colours given as [r,g,b] stops at positions (used for wet / algae bands). */
export function rampColor(stops: Array<[number, number, number, number]>, t: number, out: THREE.Color): THREE.Color {
  if (t <= stops[0][0]) return out.setRGB(stops[0][1], stops[0][2], stops[0][3]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1];
      const b = stops[i];
      const k = smooth01((t - a[0]) / Math.max(1e-5, b[0] - a[0]));
      return out.setRGB(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    }
  }
  const l = stops[stops.length - 1];
  return out.setRGB(l[1], l[2], l[3]);
}

/** Weathered timber tint (near white, linear): brightness and a slight sun-bleached shift. */
export function woodTint(rng: Rng, lo = 0.82, hi = 1.02): THREE.Color {
  const b = rng.range(lo, hi);
  const bleach = rng.chance(0.25) ? rng.range(0.02, 0.06) : 0;
  return lin(b * (1 - bleach * 0.4), b * (1 - bleach * 0.2) * rng.range(0.97, 1), b * (1 + bleach * 0.5) * rng.range(0.93, 1));
}

/**
 * Indexed surface from a grid of points (rows[j][i]). Winding is flipped automatically so the
 * summed face normal agrees with `expect`. `uv` defaults to (i / (cols - 1), j / (rows - 1)).
 */
export function gridSurface(
  rows: THREE.Vector3[][],
  o: {
    expect?: THREE.Vector3;
    uv?: (i: number, j: number, p: THREE.Vector3) => [number, number];
    color?: (i: number, j: number, p: THREE.Vector3, out: THREE.Color) => void;
  } = {},
): Geo {
  const nj = rows.length;
  const ni = rows[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const col = new THREE.Color();
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      const p = rows[j][i];
      positions.push(p.x, p.y, p.z);
      const [u, v] = o.uv ? o.uv(i, j, p) : [i / Math.max(1, ni - 1), j / Math.max(1, nj - 1)];
      uvs.push(u, v);
      col.setRGB(1, 1, 1);
      if (o.color) o.color(i, j, p, col);
      colors.push(col.r, col.g, col.b);
    }
  }
  let flip = false;
  if (o.expect) {
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();
    const acc = new THREE.Vector3();
    for (let j = 0; j < nj - 1; j++) {
      for (let i = 0; i < ni - 1; i++) {
        const a = rows[j][i];
        e1.subVectors(rows[j][i + 1], a);
        e2.subVectors(rows[j + 1][i + 1], a);
        acc.add(n.crossVectors(e1, e2));
      }
    }
    flip = acc.dot(o.expect) < 0;
  }
  for (let j = 0; j < nj - 1; j++) {
    for (let i = 0; i < ni - 1; i++) {
      const a = j * ni + i;
      const b = a + 1;
      const c = a + ni;
      const d = c + 1;
      if (flip) index.push(a, d, b, a, c, d);
      else index.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Flat double-row strip along a polyline (net strands, straps); `side(i)` is the half-width offset. */
export function ribbon(points: THREE.Vector3[], side: (i: number) => THREE.Vector3, expect?: THREE.Vector3): Geo {
  const a = points.map((p, i) => p.clone().sub(side(i)));
  const b = points.map((p, i) => p.clone().add(side(i)));
  return gridSurface([a, b], { expect });
}
