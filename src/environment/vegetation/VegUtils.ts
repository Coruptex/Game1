import * as THREE from 'three';
import type { InstancedAsset } from '../PropTypes';
import { Noise2D } from '../../utils/noise';
import type { Rng } from '../../utils/random';

/**
 * Low-level mesh construction helpers for the vegetation / coral / rock builders.
 *
 * `GeoBuilder` accumulates raw vertex data (position, normal, uv, linear colour) so foliage can carry
 * hand-authored normals (spherical / "up-biased" normals are what make leaf cards read as soft,
 * painterly clumps). All colours handled here are LINEAR (use `lin()` to convert sRGB hex values).
 */

export const UP = new THREE.Vector3(0, 1, 0);
export const vegNoise = new Noise2D(9137);

/** sRGB hex -> linear THREE.Color (optionally scaled). */
export function lin(hex: number, scale = 1): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(scale);
}

/** Linear colour from raw multipliers (useful for "near white" texture tints, values may exceed 1). */
export function rgb(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/** Lerp between two colours into a new colour. */
export function mix(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return a.clone().lerp(b, THREE.MathUtils.clamp(t, 0, 1));
}

/** Multiply colour by a brightness factor and an optional hue push (warm > 0, cool < 0). */
export function shade(c: THREE.Color, k: number, warm = 0): THREE.Color {
  return new THREE.Color(c.r * k * (1 + warm), c.g * k * (1 + warm * 0.35), c.b * k * (1 - warm));
}

export function smooth01(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

const assetMemo = new Map<string, InstancedAsset>();

/** Builds an asset once per unique name (geometry is shared by every caller / instance). */
export function memoAsset(name: string, make: () => InstancedAsset): InstancedAsset {
  let a = assetMemo.get(name);
  if (!a) {
    a = make();
    assetMemo.set(name, a);
  }
  return a;
}

/** Wraps any variant index into [0, count). */
export function wrapVariant(variant: number, count: number): number {
  return ((Math.floor(variant) % count) + count) % count;
}

/** Piecewise-linear lookup in a sorted [x, y] table (texture envelopes). */
export function envelope(table: Array<[number, number]>, v: number): number {
  if (v <= table[0][0]) return table[0][1];
  for (let k = 1; k < table.length; k++) {
    if (v <= table[k][0]) {
      const [v0, a] = table[k - 1];
      const [v1, b] = table[k];
      return a + ((b - a) * (v - v0)) / (v1 - v0);
    }
  }
  return table[table.length - 1][1];
}

export class GeoBuilder {
  private readonly p: number[] = [];
  private readonly n: number[] = [];
  private readonly t: number[] = [];
  private readonly c: number[] = [];
  private readonly i: number[] = [];

  get vertexCount(): number {
    return this.p.length / 3;
  }

  get triangleCount(): number {
    return this.i.length / 3;
  }

  get empty(): boolean {
    return this.i.length === 0;
  }

  vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, c: THREE.Color): number {
    this.p.push(p.x, p.y, p.z);
    this.n.push(n.x, n.y, n.z);
    this.t.push(u, v);
    this.c.push(c.r, c.g, c.b);
    return this.p.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.i.push(a, b, c);
  }

  /** Quad a-b-c-d (counter-clockwise when seen from the front). */
  quad(a: number, b: number, c: number, d: number): void {
    this.i.push(a, b, c, a, c, d);
  }

  /** Applies `fn` to every vertex colour (by position / normal). */
  mapColors(fn: (c: THREE.Color, p: THREE.Vector3, n: THREE.Vector3, index: number) => void, from = 0): void {
    const c = new THREE.Color();
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let k = from; k < this.vertexCount; k++) {
      c.setRGB(this.c[k * 3], this.c[k * 3 + 1], this.c[k * 3 + 2], THREE.LinearSRGBColorSpace);
      p.set(this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2]);
      n.set(this.n[k * 3], this.n[k * 3 + 1], this.n[k * 3 + 2]);
      fn(c, p, n, k);
      this.c[k * 3] = c.r;
      this.c[k * 3 + 1] = c.g;
      this.c[k * 3 + 2] = c.b;
    }
  }

  /** Duplicates the triangles added since `fromTriangle` with reversed winding (for single-sided materials). */
  doubleSide(fromTriangle: number): void {
    const end = this.i.length;
    for (let k = fromTriangle * 3; k < end; k += 3) this.i.push(this.i[k], this.i[k + 2], this.i[k + 1]);
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.t, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    const count = this.vertexCount;
    geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

// ---------------------------------------------------------------------------
// Curves & frames
// ---------------------------------------------------------------------------

/** Parallel-transport frames along a polyline: returns per-point tangent / normal / binormal. */
export function transportFrames(pts: THREE.Vector3[], firstNormal?: THREE.Vector3): {
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
  binormals: THREE.Vector3[];
} {
  const n = pts.length;
  const tangents: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(n - 1, k + 1)];
    tangents.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let nrm = firstNormal ? firstNormal.clone() : new THREE.Vector3();
  if (!firstNormal) {
    const t0 = tangents[0];
    const helper = Math.abs(t0.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
    nrm.crossVectors(helper, t0).normalize();
  }
  // make perpendicular
  nrm.addScaledVector(tangents[0], -nrm.dot(tangents[0])).normalize();
  for (let k = 0; k < n; k++) {
    if (k > 0) {
      const q = new THREE.Quaternion().setFromUnitVectors(tangents[k - 1], tangents[k]);
      nrm = nrm.clone().applyQuaternion(q);
      nrm.addScaledVector(tangents[k], -nrm.dot(tangents[k])).normalize();
    }
    normals.push(nrm.clone());
    binormals.push(new THREE.Vector3().crossVectors(tangents[k], nrm).normalize());
  }
  return { tangents, normals, binormals };
}

/** Cumulative arc lengths of a polyline. */
export function arcLengths(pts: THREE.Vector3[]): number[] {
  const out = [0];
  for (let k = 1; k < pts.length; k++) out.push(out[k - 1] + pts[k].distanceTo(pts[k - 1]));
  return out;
}

export interface TubeOptions {
  radial: number;
  /** Radius per station (t = station / (n - 1)). */
  radius: (t: number, k: number) => number;
  /** Texture repeats around the circumference. */
  uRepeat?: number;
  /** V units per metre along the tube. */
  vPerMetre?: number;
  vOffset?: number;
  /** Per-vertex colour (linear). */
  color?: (t: number, p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
  /** Extra radial offset (gnarly bark) as a function of t and angle. */
  bump?: (t: number, angle: number) => number;
  /** Close the end with a cone (pointed), a rounded dome or a flat cap. */
  capEnd?: 'flat' | 'cone' | 'round' | 'none';
  capStart?: boolean;
  firstNormal?: THREE.Vector3;
  /** Constant UV (all vertices) instead of a mapped one. */
  fixedUV?: [number, number];
}

/** Generalised tube (branches, trunks, vines, coral) along a polyline. CCW outward winding. */
export function tube(b: GeoBuilder, pts: THREE.Vector3[], o: TubeOptions): void {
  const { tangents, normals, binormals } = transportFrames(pts, o.firstNormal);
  const lens = arcLengths(pts);
  const total = lens[lens.length - 1] || 1;
  const R = o.radial;
  const uRep = o.uRepeat ?? 1;
  const vpm = o.vPerMetre ?? 1;
  const white = new THREE.Color(1, 1, 1);
  const rows: number[][] = [];
  const p = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (let k = 0; k < pts.length; k++) {
    const t = lens[k] / total;
    const r = o.radius(t, k);
    const row: number[] = [];
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      nrm.set(0, 0, 0).addScaledVector(normals[k], ca).addScaledVector(binormals[k], sa).normalize();
      const rr = r * (1 + (o.bump ? o.bump(t, a) : 0));
      p.copy(pts[k]).addScaledVector(nrm, rr);
      const col = o.color ? o.color(t, p, nrm) : white;
      const u = o.fixedUV ? o.fixedUV[0] : (j / R) * uRep;
      const v = o.fixedUV ? o.fixedUV[1] : (o.vOffset ?? 0) + lens[k] * vpm;
      row.push(b.vert(p, nrm, u, v, col));
    }
    rows.push(row);
  }
  for (let k = 0; k < rows.length - 1; k++) {
    for (let j = 0; j < R; j++) {
      // outward-facing CCW: (k,j) -> (k,j+1) -> (k+1,j+1) -> (k+1,j)
      b.quad(rows[k][j], rows[k][j + 1], rows[k + 1][j + 1], rows[k + 1][j]);
    }
  }
  const last = pts.length - 1;
  const capMode = o.capEnd ?? 'none';
  if (capMode !== 'none') {
    const tEnd = 1;
    const rEnd = o.radius(tEnd, last);
    const tip = pts[last].clone().addScaledVector(tangents[last], capMode === 'cone' ? rEnd * 2.2 : capMode === 'round' ? rEnd * 0.9 : 0);
    const col = o.color ? o.color(1, tip, tangents[last]) : white;
    const uv = o.fixedUV ?? [0.5, (o.vOffset ?? 0) + total * vpm + rEnd * vpm];
    if (capMode === 'round') {
      // one intermediate ring for a rounded cap
      const mid: number[] = [];
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2;
        nrm.set(0, 0, 0).addScaledVector(normals[last], Math.cos(a)).addScaledVector(binormals[last], Math.sin(a)).normalize();
        const n2 = nrm.clone().multiplyScalar(0.7).addScaledVector(tangents[last], 0.7).normalize();
        p.copy(pts[last]).addScaledVector(nrm, rEnd * 0.72).addScaledVector(tangents[last], rEnd * 0.62);
        const c2 = o.color ? o.color(1, p, n2) : white;
        mid.push(b.vert(p, n2, o.fixedUV ? o.fixedUV[0] : (j / R) * uRep, uv[1] - rEnd * 0.4 * vpm, c2));
      }
      for (let j = 0; j < R; j++) b.quad(rows[last][j], rows[last][j + 1], mid[j + 1], mid[j]);
      const ti = b.vert(tip, tangents[last], uv[0], uv[1], col);
      for (let j = 0; j < R; j++) b.tri(mid[j], mid[j + 1], ti);
    } else {
      const ti = b.vert(tip, tangents[last], uv[0], uv[1], col);
      for (let j = 0; j < R; j++) b.tri(rows[last][j], rows[last][j + 1], ti);
    }
  }
  if (o.capStart) {
    const n0 = tangents[0].clone().negate();
    const col = o.color ? o.color(0, pts[0], n0) : white;
    const ci = b.vert(pts[0], n0, o.fixedUV ? o.fixedUV[0] : 0.5, o.fixedUV ? o.fixedUV[1] : 0, col);
    for (let j = 0; j < R; j++) b.tri(rows[0][j], ci, rows[0][j + 1]);
  }
}

// ---------------------------------------------------------------------------
// Leaves, fronds, cards
// ---------------------------------------------------------------------------

export interface StripStation {
  /** Centre (rachis / midrib) position. */
  p: THREE.Vector3;
  /** Unit vector across the leaf (towards the right edge). */
  side: THREE.Vector3;
  /** Unit "upper surface" normal of the flat leaf. */
  up: THREE.Vector3;
  /** Physical half width. */
  hw: number;
  /** Fold angle (rad): > 0 edges droop below the midrib (Λ), < 0 edges rise (V channel). */
  fold: number;
  /** Half width in texture u (u = 0.5 ± uHalf). */
  uHalf: number;
  v: number;
  cCenter: THREE.Color;
  cEdge: THREE.Color;
}

/**
 * Folded leaf strip: 3 (sharp V) or 5 (arched) vertices per station, left edge -> midrib -> right
 * edge, u = 0.5 ± uHalf across and v along the midrib. Normals follow the fold and are blended with
 * `bias` (e.g. world up) so leaves catch the sun from both sides (foliage materials keep un-flipped
 * normals on back faces).
 */
export function foldedStrip(
  b: GeoBuilder,
  st: StripStation[],
  bias: THREE.Vector3,
  biasAmount: number,
  /** 1 = sharp V (3 vertices across), 2 = arched profile (5 vertices across, edges droop more). */
  segmentsPerSide: 1 | 2 = 1,
): void {
  const m = segmentsPerSide;
  const weights = m === 1 ? [1] : [0.45, 1.55];
  const rows: number[][] = [];
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const segN: THREE.Vector3[] = [];
  const white = new THREE.Color();
  for (const s of st) {
    const row: number[] = [];
    // build each side outward from the midrib
    const sideVerts: Array<Array<[THREE.Vector3, THREE.Vector3, number, THREE.Color]>> = [];
    for (const sgn of [-1, 1]) {
      const list: Array<[THREE.Vector3, THREE.Vector3, number, THREE.Color]> = [];
      pos.copy(s.p);
      segN.length = 0;
      for (let i = 0; i < m; i++) {
        const a = s.fold * weights[i];
        const seg = s.hw / m;
        pos.addScaledVector(s.side, sgn * seg * Math.cos(a)).addScaledVector(s.up, -seg * Math.sin(a));
        segN.push(s.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(s.side, sgn * Math.sin(a)).normalize());
        const f = (i + 1) / m;
        list.push([pos.clone(), new THREE.Vector3(), f, white.clone().copy(s.cCenter).lerp(s.cEdge, f)]);
      }
      // vertex normals: average of adjacent segment normals
      for (let i = 0; i < m; i++) {
        const n = segN[i].clone();
        if (i + 1 < m) n.add(segN[i + 1]).normalize();
        list[i][1] = n.addScaledVector(bias, biasAmount).normalize();
      }
      sideVerts.push(list);
    }
    // left edge -> midrib -> right edge
    const left = sideVerts[0];
    for (let i = m - 1; i >= 0; i--) {
      const [pp, nn, f, cc] = left[i];
      row.push(b.vert(pp, nn, 0.5 - s.uHalf * f, s.v, cc));
    }
    nrm.copy(s.up).addScaledVector(bias, biasAmount).normalize();
    row.push(b.vert(s.p, nrm, 0.5, s.v, s.cCenter));
    for (const [pp, nn, f, cc] of sideVerts[1]) row.push(b.vert(pp, nn, 0.5 + s.uHalf * f, s.v, cc));
    rows.push(row);
  }
  for (let k = 0; k < rows.length - 1; k++) {
    const r0 = rows[k];
    const r1 = rows[k + 1];
    for (let j = 0; j < r0.length - 1; j++) b.quad(r0[j], r0[j + 1], r1[j + 1], r1[j]);
  }
}

/**
 * Builds stations for a leaf whose midrib follows `spine`, given a function returning the
 * half-width / fold / colours at t in [0, 1]. The leaf's flat "up" is derived from `upHint`
 * (projected perpendicular to the tangent), rolled by `roll(t)`.
 */
export function leafStations(
  spine: THREE.Vector3[],
  upHint: THREE.Vector3,
  f: (t: number) => { hw: number; fold: number; uHalf: number; v: number; cCenter: THREE.Color; cEdge: THREE.Color; roll?: number },
): StripStation[] {
  const out: StripStation[] = [];
  const lens = arcLengths(spine);
  const total = lens[lens.length - 1] || 1;
  const n = spine.length;
  for (let k = 0; k < n; k++) {
    const a = spine[Math.max(0, k - 1)];
    const c = spine[Math.min(n - 1, k + 1)];
    const tan = new THREE.Vector3().subVectors(c, a).normalize();
    const t = lens[k] / total;
    const s = f(t);
    let up = upHint.clone().addScaledVector(tan, -upHint.dot(tan));
    if (up.lengthSq() < 1e-6) up = new THREE.Vector3(1, 0, 0).addScaledVector(tan, -tan.x);
    up.normalize();
    let side = new THREE.Vector3().crossVectors(tan, up).normalize();
    if (s.roll) {
      const q = new THREE.Quaternion().setFromAxisAngle(tan, s.roll);
      up = up.applyQuaternion(q);
      side = side.applyQuaternion(q);
    }
    out.push({ p: spine[k].clone(), side, up, hw: s.hw, fold: s.fold, uHalf: s.uHalf, v: s.v, cCenter: s.cCenter, cEdge: s.cEdge });
  }
  return out;
}

/**
 * Bent spine (in a vertical plane given by azimuth) starting at `origin` with elevation `el0`
 * (rad above horizontal) that bends by `bend` radians (positive = droops downwards) following
 * t^bendPow. Optional sideways curl (rad) in the horizontal plane.
 */
export function bentSpine(
  origin: THREE.Vector3,
  azimuth: number,
  el0: number,
  bend: number,
  length: number,
  segments: number,
  bendPow = 1.4,
  curl = 0,
): THREE.Vector3[] {
  const pts = [origin.clone()];
  const step = length / segments;
  const p = origin.clone();
  for (let k = 0; k < segments; k++) {
    const t = (k + 0.5) / segments;
    const el = el0 - bend * Math.pow(t, bendPow);
    const az = azimuth + curl * t;
    const ce = Math.cos(el);
    p.x += Math.sin(az) * ce * step;
    p.z += Math.cos(az) * ce * step;
    p.y += Math.sin(el) * step;
    pts.push(p.clone());
  }
  return pts;
}

export interface CardOptions {
  center: THREE.Vector3;
  /** Facing direction of the card plane. */
  facing: THREE.Vector3;
  width: number;
  height: number;
  /** In-plane rotation. */
  roll: number;
  uv?: [number, number, number, number];
  /** Per-corner normal provider (default: facing). */
  normal?: (p: THREE.Vector3) => THREE.Vector3;
  color: (p: THREE.Vector3) => THREE.Color;
  /** Bend the card: corners pushed back along -facing by this amount (cupped card). */
  cup?: number;
}

/** Single quad card (2 triangles). */
export function card(b: GeoBuilder, o: CardOptions): void {
  const f = o.facing.clone().normalize();
  const helper = Math.abs(f.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0);
  let right = new THREE.Vector3().crossVectors(helper, f).normalize();
  let up = new THREE.Vector3().crossVectors(f, right).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(f, o.roll);
  right = right.applyQuaternion(q);
  up = up.applyQuaternion(q);
  const [u0, v0, u1, v1] = o.uv ?? [0, 0, 1, 1];
  const hw = o.width / 2;
  const hh = o.height / 2;
  const corners: Array<[number, number, number, number]> = [
    [-hw, -hh, u0, v0],
    [hw, -hh, u1, v0],
    [hw, hh, u1, v1],
    [-hw, hh, u0, v1],
  ];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (const [x, y, u, v] of corners) {
    p.copy(o.center).addScaledVector(right, x).addScaledVector(up, y);
    if (o.cup) p.addScaledVector(f, -o.cup);
    const n = o.normal ? o.normal(p) : f;
    idx.push(b.vert(p, n, u, v, o.color(p)));
  }
  b.quad(idx[0], idx[1], idx[2], idx[3]);
}

/** Random unit vector. */
export function randomDir(rng: Rng, out = new THREE.Vector3()): THREE.Vector3 {
  const z = rng.range(-1, 1);
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(1 - z * z);
  return out.set(Math.cos(a) * r, z, Math.sin(a) * r);
}

export interface ClumpOptions {
  center: THREE.Vector3;
  radii: THREE.Vector3;
  count: number;
  cardSize: [number, number];
  /** Shell depth range as a fraction of the radius. */
  shell?: [number, number];
  /** Colour at the bottom / top of the clump (linear). */
  bottom: THREE.Color;
  top: THREE.Color;
  /** Brightness jitter per card. */
  jitter?: number;
  /** Probability of dropping cards on the underside (0..1). */
  underside?: number;
  /** Normal-y threshold above which cards go to the "light" builder (if given). */
  lightThreshold?: number;
  /** How far down the shading centre is moved (fraction of ry): flatter, brighter tops. */
  normalDrop?: number;
  /** Blend between the ellipsoid normal (0) and plain up (1). */
  upBlend?: number;
  /** Fraction of the texture used per card (1 = whole cluster texture). */
  uvScale?: number;
  /** Extra colour modulation per vertex. */
  tint?: (p: THREE.Vector3, c: THREE.Color) => void;
  /** Optional dark inner core (same material, constant opaque texel) that fills gaps between cards. */
  core?: { detail: number; scale: number; uv: [number, number]; bottom: THREE.Color; top: THREE.Color; target?: GeoBuilder };
  /** Card facing randomness (0 = tangent to the shell, 1 = very random). */
  randomness?: number;
  /** Colour multiplier for cards that go to the light builder (balances different textures). */
  lightScale?: number;
}

/**
 * Opaque texels (centre of the last painted leaf) of leafClusterTexture(0 | 1 | 2), used to give
 * clump cores a solid leaf colour in the very same (wind-swayed) material as the cards.
 */
export const CORE_UV: Record<'canopy' | 'canopyLight' | 'canopyDark', [number, number]> = {
  canopy: [0.676, 0.442],
  canopyLight: [0.3746, 0.2016],
  canopyDark: [0.4729, 0.8258],
};

/**
 * Fluffy foliage clump: many alpha-tested leaf-cluster cards on/in an ellipsoid shell, with
 * ellipsoid (spherical) normals so the whole clump shades like one soft painted volume.
 */
export function foliageClump(rng: Rng, main: GeoBuilder, light: GeoBuilder | null, o: ClumpOptions): void {
  const shell = o.shell ?? [0.55, 1.0];
  const jitter = o.jitter ?? 0.12;
  const under = o.underside ?? 0.55;
  const drop = o.normalDrop ?? 0.35;
  const upBlend = o.upBlend ?? 0.12;
  const uvs = o.uvScale ?? 1;
  const shadeCenter = o.center.clone();
  shadeCenter.y -= o.radii.y * drop;
  const rx2 = 1 / (o.radii.x * o.radii.x);
  const ry2 = 1 / (o.radii.y * o.radii.y);
  const rz2 = 1 / (o.radii.z * o.radii.z);
  const d = new THREE.Vector3();
  let placed = 0;
  let guard = 0;
  while (placed < o.count && guard++ < o.count * 6) {
    randomDir(rng, d);
    if (d.y < -0.25 && rng.chance(under)) continue;
    const depth = shell[0] + (shell[1] - shell[0]) * Math.sqrt(rng.next());
    const pos = new THREE.Vector3(d.x * o.radii.x, d.y * o.radii.y, d.z * o.radii.z).multiplyScalar(depth).add(o.center);
    // facing: mostly outward, with plenty of randomness so silhouettes stay fluffy
    const outward = new THREE.Vector3(d.x * rx2, d.y * ry2, d.z * rz2).normalize();
    const facing = outward.clone().add(randomDir(rng).multiplyScalar(o.randomness ?? 0.8)).normalize();
    const size = rng.range(o.cardSize[0], o.cardSize[1]);
    const k = 1 + rng.range(-jitter, jitter);
    const warm = rng.range(-0.04, 0.05);
    const target = light && o.lightThreshold !== undefined && outward.y > o.lightThreshold ? light : main;
    const u0 = uvs < 1 ? rng.range(0, 1 - uvs) : 0;
    const v0 = uvs < 1 ? rng.range(0, 1 - uvs) : 0;
    card(target, {
      center: pos,
      facing,
      width: size,
      height: size * rng.range(0.85, 1.1),
      roll: rng.range(0, Math.PI * 2),
      uv: [u0, v0, u0 + uvs, v0 + uvs],
      normal: (p) => {
        const rel = p.clone().sub(shadeCenter);
        const n = new THREE.Vector3(rel.x * rx2, rel.y * ry2, rel.z * rz2).normalize();
        return n.lerp(UP, upBlend).normalize();
      },
      color: (p) => {
        const ty = (p.y - (o.center.y - o.radii.y)) / (2 * o.radii.y);
        const c = mix(o.bottom, o.top, smooth01(ty * 1.1 - 0.05));
        const inner = 0.78 + 0.22 * THREE.MathUtils.clamp((depth - shell[0]) / Math.max(0.01, shell[1] - shell[0]), 0, 1);
        const out = shade(c, k * inner * (target === light ? (o.lightScale ?? 1) : 1), warm);
        if (o.tint) o.tint(p, out);
        return out;
      },
    });
    placed++;
  }
  if (o.core) {
    const k = o.core;
    const r = o.radii.clone().multiplyScalar(k.scale);
    const seed = rng.range(0, 100);
    icoBlob(
      k.target ?? main,
      o.center.clone().add(new THREE.Vector3(0, -o.radii.y * 0.05, 0)),
      r,
      k.detail,
      (p) => {
        const ty = (p.y - (o.center.y - r.y)) / (2 * r.y);
        return mix(k.bottom, k.top, smooth01(ty));
      },
      () => k.uv,
      (d) => 0.16 * vegNoise.noise(d.x * 1.7 + seed, d.z * 1.7 + d.y),
    );
  }
}

/**
 * Low-poly blob (indexed icosphere) with smooth ellipsoid normals: coconuts, clump cores, pebbles,
 * moss cushions. `radii` scales the unit sphere per axis; `rot` is an optional rotation matrix.
 */
export function icoBlob(
  b: GeoBuilder,
  center: THREE.Vector3,
  radii: THREE.Vector3,
  detail: number,
  color: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color,
  uv: (p: THREE.Vector3, n: THREE.Vector3) => [number, number] = () => [0.5, 0.5],
  displaceFn?: (dir: THREE.Vector3) => number,
  rot?: THREE.Matrix4,
): void {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  // merge duplicated vertices so the blob is smooth and indexed
  const pos = ico.attributes.position;
  const keyMap = new Map<string, number>();
  const verts: THREE.Vector3[] = [];
  const index: number[] = [];
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    const z = pos.getZ(k);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let id = keyMap.get(key);
    if (id === undefined) {
      id = verts.length;
      keyMap.set(key, id);
      verts.push(new THREE.Vector3(x, y, z));
    }
    index.push(id);
  }
  ico.dispose();
  const base = b.vertexCount;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = rot ? new THREE.Matrix3().setFromMatrix4(rot) : null;
  for (const dir of verts) {
    const k = 1 + (displaceFn ? displaceFn(dir) : 0);
    p.set(dir.x * radii.x * k, dir.y * radii.y * k, dir.z * radii.z * k);
    n.set(dir.x / radii.x, dir.y / radii.y, dir.z / radii.z).normalize();
    if (rot && nm) {
      p.applyMatrix4(rot);
      n.applyMatrix3(nm).normalize();
    }
    p.add(center);
    const [u, v] = uv(p, n);
    b.vert(p, n, u, v, color(p, n));
  }
  for (let k = 0; k < index.length; k += 3) b.tri(base + index[k], base + index[k + 1], base + index[k + 2]);
}
