import * as THREE from 'three';
import type { MaterialName } from '../../assets/materials/MaterialLibrary';
import type { PropPart } from '../PropTypes';
import { ensureStandardAttributes, merge, sphericalNormals } from '../../assets/geometry/GeometryUtils';
import { Noise2D } from '../../utils/noise';
import type { Rng } from '../../utils/random';
import { clamp, smoothstep } from '../../utils/math';

/**
 * Shared toolkit for the procedural ancient architecture (gate, ruins, crypt, fortress).
 *
 * - `MeshBuilder`: tiny flat-shaded triangle soup builder with winding fixed by a normal hint.
 * - `boxUV` / `cylUV`: world-scale projections so the `stoneBlocks` texture reads as courses of
 *   ~0.7 m blocks on every face (V always runs up vertical faces).
 * - `shade`: painterly vertex colours (variation, moss on up-facing faces and creeping down from
 *   broken tops, damp/dirty bases).
 * - Chamfered blocks, prisms, strip walls with pointed-arch openings, voussoir rings, carved glyph
 *   reliefs (fictional "Ember Kings" motifs: suns, embers, waves, spirals, masks) and moss.
 */

export type Vec3 = [number, number, number];

const noise = new Noise2D(9137);
const _c = new THREE.Color();
const _m = new THREE.Color();

/** Colour constants for the ancient stone (sRGB hex). */
export const StoneColors = {
  /** Near-white warm tint for the textured `stoneBlocks` material. */
  blockTint: 0xfff0dc,
  /** Multiply tint for moss on textured blocks. */
  blockMoss: 0xa6c46a,
  /** Vertex colour for plain `stone` parts (matches the average of the block texture). */
  plain: 0xb6ae95,
  plainLight: 0xc9c0a4,
  plainDark: 0x8f8873,
  /** Moss target colour on plain `stone` parts. */
  plainMoss: 0x6a8a36,
  /** Faded red-ochre pigment left in carved panels. */
  ochre: 0xa45a3d,
  /** Moss cushion colours (vertexColor material). */
  moss: [0x587b2a, 0x668c30, 0x4b6d25, 0x7a9a3a, 0x86a145] as const,
  iron: 0x5b5853,
  rust: 0x7a4d31,
};

/** Metres per `stoneBlocks` texture tile for the hero ruins (6 courses -> 0.7 m blocks). */
export const BLOCK_TILE = 4.2;
export const COURSE = BLOCK_TILE / 6;

// ---------------------------------------------------------------------------
// Part collection
// ---------------------------------------------------------------------------

interface Bin {
  material: MaterialName;
  seeThrough: boolean;
  castShadow: boolean;
  geos: THREE.BufferGeometry[];
}

/** Collects geometries per material / see-through flag and merges them into PropParts. */
export class PartBin {
  private readonly bins = new Map<string, Bin>();

  add(material: MaterialName, geo: THREE.BufferGeometry, opts: { seeThrough?: boolean; castShadow?: boolean } = {}): void {
    const st = !!opts.seeThrough;
    const cs = opts.castShadow ?? true;
    const key = `${material}|${st ? 1 : 0}|${cs ? 1 : 0}`;
    let b = this.bins.get(key);
    if (!b) {
      b = { material, seeThrough: st, castShadow: cs, geos: [] };
      this.bins.set(key, b);
    }
    b.geos.push(geo);
  }

  parts(): PropPart[] {
    const out: PropPart[] = [];
    for (const b of this.bins.values()) {
      if (b.geos.length === 0) continue;
      const g = b.geos.length === 1 ? ensureStandardAttributes(b.geos[0]) : merge(b.geos);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const part: PropPart = { geometry: g, material: b.material, castShadow: b.castShadow };
      if (b.seeThrough) part.seeThrough = true;
      out.push(part);
    }
    return out;
  }
}

/** Counts triangles of a part list (for reports / budgets). */
export function triangleCount(parts: { geometry: THREE.BufferGeometry }[]): number {
  let n = 0;
  for (const p of parts) n += (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3;
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Mesh builder
// ---------------------------------------------------------------------------

/** Flat-shaded triangle soup. Winding is corrected against an optional outward hint. */
export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];

  tri(a: Vec3, b: Vec3, c: Vec3, hint?: Vec3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    nx /= len;
    ny /= len;
    nz /= len;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      this.pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      nx = -nx;
      ny = -ny;
      nz = -nz;
    } else {
      this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
    this.nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }

  /** Quad a-b-c-d (in order around its border). */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, hint?: Vec3): void {
    this.tri(a, b, c, hint);
    this.tri(a, c, d, hint);
  }

  /** Fan-triangulated convex polygon. */
  poly(pts: Vec3[], hint?: Vec3): void {
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], hint);
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    return ensureStandardAttributes(g);
  }
}

function mid(pts: Vec3[]): Vec3 {
  const m: Vec3 = [0, 0, 0];
  for (const p of pts) {
    m[0] += p[0];
    m[1] += p[1];
    m[2] += p[2];
  }
  m[0] /= pts.length;
  m[1] /= pts.length;
  m[2] /= pts.length;
  return m;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// ---------------------------------------------------------------------------
// UV projections
// ---------------------------------------------------------------------------

/**
 * Box projection by dominant normal axis: blocks keep the same world size on every face and
 * V runs up all vertical faces (the texture's mortar courses stay horizontal).
 */
export function boxUV(geo: THREE.BufferGeometry, tile: number, ou = 0, ov = 0): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const nx = n.getX(i);
    const ny = n.getY(i);
    const nz = n.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    let u: number;
    let v: number;
    if (ay > ax && ay > az) {
      u = x;
      v = z;
    } else if (ax >= az) {
      u = nx > 0 ? -z : z;
      v = y;
    } else {
      u = nz > 0 ? x : -x;
      v = y;
    }
    uv.setXY(i, u / tile + ou, v / tile + ov);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Cylindrical projection around (cx, cz); fixes the wrap seam per triangle (non-indexed or split geometry). */
export function cylUV(geo: THREE.BufferGeometry, tile: number, radius: number, cx = 0, cz = 0): THREE.BufferGeometry {
  let g = geo;
  if (g.index) g = g.toNonIndexed();
  ensureStandardAttributes(g);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const circ = (Math.PI * 2 * radius) / tile;
  for (let t = 0; t < p.count; t += 3) {
    const us: number[] = [];
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      const ang = Math.atan2(p.getZ(i) - cz, p.getX(i) - cx);
      us.push(((ang / (Math.PI * 2)) + 0.5) * circ);
    }
    const maxU = Math.max(us[0], us[1], us[2]);
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      if (Math.abs(n.getY(i)) > 0.8) {
        uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
        continue;
      }
      let u = us[k];
      if (maxU - u > circ * 0.5) u += circ;
      uv.setXY(i, u, p.getY(i) / tile);
    }
  }
  uv.needsUpdate = true;
  return ensureStandardAttributes(g);
}

/** Planar top-down projection (paving, slabs). */
export function planarUV(geo: THREE.BufferGeometry, tile: number, ou = 0, ov = 0): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile + ou, p.getZ(i) / tile + ov + p.getY(i) / tile);
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------
// Painterly shading
// ---------------------------------------------------------------------------

export interface ShadeOptions {
  /** Base vertex colour. */
  base: THREE.ColorRepresentation;
  /** Brightness noise amplitude (0.1 = +-10 %). */
  vary?: number;
  /** Spatial frequency of the brightness noise. */
  varyScale?: number;
  /** Colour blended in on up-facing faces (and creeping down from `creepTop`). */
  moss?: THREE.ColorRepresentation;
  /** Max moss blend on fully up-facing faces. */
  mossAmount?: number;
  /** Normal.y where moss starts. */
  mossUp?: number;
  /** Moss creeps this many metres down vertical faces below `creepTop`. */
  mossCreep?: number;
  creepTop?: number;
  /** Darkening towards `baseY` (fake ground AO / damp). */
  dirt?: number;
  dirtHeight?: number;
  baseY?: number;
  /** Greenish damp tint near the base (0..1). */
  dampGreen?: number;
  seed?: number;
}

const _damp = new THREE.Color(0x6b7a3e);

/** Writes painterly vertex colours based on position and normal. */
export function shade(geo: THREE.BufferGeometry, o: ShadeOptions): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const base = new THREE.Color(o.base);
  const moss = o.moss !== undefined ? new THREE.Color(o.moss) : null;
  const vary = o.vary ?? 0.08;
  const vs = o.varyScale ?? 0.9;
  const seed = o.seed ?? 0;
  const mossAmount = o.mossAmount ?? 0.85;
  const mossUp = o.mossUp ?? 0.45;
  const creep = o.mossCreep ?? 0;
  const creepTop = o.creepTop ?? Infinity;
  const dirt = o.dirt ?? 0;
  const dirtH = o.dirtHeight ?? 1.2;
  const baseY = o.baseY ?? 0;
  const dampGreen = o.dampGreen ?? 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const ny = n.getY(i);
    const n1 = noise.noise(x * vs + seed * 3.1, z * vs - y * vs * 0.8 + seed);
    const n2 = noise.noise(x * vs * 3.7 - 5.3, y * vs * 3.7 + z * vs * 2.1 + seed * 1.7);
    _c.copy(base).multiplyScalar(1 + (n1 * 0.7 + n2 * 0.3) * vary);
    if (moss) {
      const nm = noise.noise(x * 0.62 - seed * 1.3 + y * 0.35, z * 0.62 + seed * 0.7 - y * 0.2);
      let m = smoothstep(mossUp, mossUp + 0.3, ny) * clamp(0.62 + 0.5 * nm, 0, 1);
      if (creep > 0 && y <= creepTop + 0.05 && Math.abs(ny) < 0.75) {
        const d = Math.max(0, creepTop - y);
        const reach = creep * (0.55 + 0.45 * (nm * 0.5 + 0.5)) * (0.8 + 0.4 * noise.noise(x * 1.9 + seed, z * 1.9 + 3.3));
        const cm = clamp(1 - d / Math.max(0.05, reach), 0, 1);
        m = Math.max(m, cm * cm * 0.9);
      }
      _m.copy(moss);
      _c.lerp(_m, clamp(m * mossAmount, 0, 1));
    }
    if (dirt > 0 || dampGreen > 0) {
      const t = clamp((y - baseY) / dirtH, 0, 1);
      const k = (1 - t) * (1 - t);
      if (dampGreen > 0) _c.lerp(_damp, k * dampGreen * clamp(0.6 + 0.5 * n1, 0, 1));
      _c.multiplyScalar(1 - dirt * k);
    }
    col.setXYZ(i, _c.r, _c.g, _c.b);
  }
  col.needsUpdate = true;
  return geo;
}

/** Multiplies vertex colours by a colour (per-piece tint). */
export function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, amount = 1): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  _m.set(color);
  const col = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) {
    col.setXYZ(
      i,
      col.getX(i) * (1 + (_m.r - 1) * amount),
      col.getY(i) * (1 + (_m.g - 1) * amount),
      col.getZ(i) * (1 + (_m.b - 1) * amount),
    );
  }
  col.needsUpdate = true;
  return geo;
}

/** Deterministic noise jitter of positions (keeps coincident vertices together); recomputes flat normals. */
export function jitter(geo: THREE.BufferGeometry, amount: number, freq = 1.3, seed = 0, yScale = 0.6): THREE.BufferGeometry {
  let g = geo;
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const dx = noise.noise(y * freq + seed, z * freq - seed * 0.7) * amount;
    const dy = noise.noise(z * freq + 17.1 + seed, x * freq) * amount * yScale;
    const dz = noise.noise(x * freq - 9.3, y * freq + seed * 1.3) * amount;
    p.setXYZ(i, x + dx, y + dy, z + dz);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return ensureStandardAttributes(g);
}

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

function octRing(w: number, d: number, c: number, y: number): Vec3[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    [hw - c, y, hd],
    [hw, y, hd - c],
    [hw, y, -hd + c],
    [hw - c, y, -hd],
    [-hw + c, y, -hd],
    [-hw, y, -hd + c],
    [-hw, y, hd - c],
    [-hw + c, y, hd],
  ];
}

export interface BlockOptions {
  /** Bevel size on top (and bottom) edges. */
  bevel?: number;
  /** Chamfer on the vertical edges. */
  chamfer?: number;
  /** Also bevel + cap the bottom (loose / fallen blocks). */
  bottom?: boolean;
  /** Random vertex jitter (needs rng). */
  jitter?: number;
  /** Chance of a chipped top corner (needs rng). */
  chip?: number;
  rng?: Rng;
}

/**
 * Chunky cut-stone block with bevelled top and chamfered vertical edges, origin at bottom centre.
 * 38 tris (60 with `bottom`).
 */
export function chamferBlock(w: number, h: number, d: number, o: BlockOptions = {}): THREE.BufferGeometry {
  const b = Math.min(o.bevel ?? 0.06, h * 0.3, w * 0.24, d * 0.24);
  const c = Math.min(o.chamfer ?? b, w * 0.24, d * 0.24);
  const rings: Vec3[][] = [];
  if (o.bottom) rings.push(octRing(w - 2 * b, d - 2 * b, c * 0.5, 0), octRing(w, d, c, b));
  else rings.push(octRing(w, d, c, 0));
  rings.push(octRing(w, d, c, h - b), octRing(w - 2 * b, d - 2 * b, c * 0.5, h));
  const rng = o.rng;
  if (rng && o.jitter) {
    const j = o.jitter;
    for (const r of rings) for (const p of r) {
      p[0] += rng.range(-j, j);
      p[1] += rng.range(-j, j) * 0.5;
      p[2] += rng.range(-j, j);
    }
  }
  if (rng && o.chip && rng.chance(o.chip)) {
    const top = rings[rings.length - 1];
    const upper = rings[rings.length - 2];
    const k = rng.int(0, 3) * 2;
    const depth = Math.min(h * 0.45, b * rng.range(2.5, 5));
    for (const idx of [k, k + 1]) {
      top[idx][1] -= depth;
      top[idx][0] *= 0.8;
      top[idx][2] *= 0.8;
      upper[idx][1] -= depth * 0.6;
    }
  }
  const mb = new MeshBuilder();
  const centre: Vec3 = [0, h / 2, 0];
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r];
    const B = rings[r + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const q: Vec3[] = [A[i], A[j], B[j], B[i]];
      mb.quad(q[0], q[1], q[2], q[3], sub(mid(q), centre));
    }
  }
  mb.poly(rings[rings.length - 1], [0, 1, 0]);
  if (o.bottom) mb.poly(rings[0], [0, -1, 0]);
  return mb.build();
}

/** Subdivided box with its base at y0 (indexed, per-face vertices). */
export function boxAt(w: number, h: number, d: number, x: number, y0: number, z: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz);
  g.translate(x, y0 + h / 2, z);
  return g;
}

export interface PrismOptions {
  segY?: number;
  top?: boolean;
  bottom?: boolean;
  /** Scale of the top outline about the centroid (battered walls / tapering towers). */
  topScale?: number;
}

/** Vertical prism from an XZ polygon (any winding), flat-shaded sides and optional caps. */
export function prism(pts: Array<[number, number]>, y0: number, y1: number, o: PrismOptions = {}): THREE.BufferGeometry {
  const n = pts.length;
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % n];
    area += x0 * z1 - x1 * z0;
    cx += x0;
    cz += z0;
  }
  cx /= n;
  cz /= n;
  const ccw = area > 0;
  const segY = Math.max(1, o.segY ?? 1);
  const ts = o.topScale ?? 1;
  const at = (i: number, k: number): Vec3 => {
    const t = k / segY;
    const s = 1 + (ts - 1) * t;
    const [x, z] = pts[i % n];
    return [cx + (x - cx) * s, y0 + (y1 - y0) * t, cz + (z - cz) * s];
  };
  const mb = new MeshBuilder();
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % n];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const hint: Vec3 = ccw ? [dz, (1 - ts) * 0.5, -dx] : [-dz, (1 - ts) * 0.5, dx];
    for (let k = 0; k < segY; k++) mb.quad(at(i, k), at(i + 1, k), at(i + 1, k + 1), at(i, k + 1), hint);
  }
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  if (o.top !== false) for (const f of faces) mb.tri(at(f[0], segY), at(f[1], segY), at(f[2], segY), [0, 1, 0]);
  if (o.bottom) for (const f of faces) mb.tri(at(f[0], 0), at(f[1], 0), at(f[2], 0), [0, -1, 0]);
  return mb.build();
}

/** Regular polygon in XZ. */
export function ngon(n: number, r: number, cx = 0, cz = 0, rot = 0): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pointed (gothic) arches
// ---------------------------------------------------------------------------

/** Two-centred pointed arch: clear half-span `a`, springing height and rise above it. */
export class PointedArch {
  readonly r: number;
  /** Arc centres sit at x = +-c on the springing line (opposite side of each half). */
  readonly c: number;

  constructor(
    readonly a: number,
    readonly springY: number,
    readonly rise: number,
  ) {
    this.r = (rise * rise + a * a) / (2 * a);
    this.c = this.r - a;
  }

  get apexY(): number {
    return this.springY + this.rise;
  }

  /** Top of the opening (offset o = 0) or of an outer ring (o > 0) at x; NaN outside. */
  heightAt(x: number, o = 0): number {
    const R = this.r + o;
    const dx = Math.abs(x) + this.c;
    if (dx > R) return NaN;
    return this.springY + Math.sqrt(R * R - dx * dx);
  }

  /** Clear half-width of the opening at height y (offset o widens it). */
  halfWidthAt(y: number, o = 0): number {
    if (y <= this.springY) return this.a + o;
    const R = this.r + o;
    const dy = y - this.springY;
    if (dy >= R) return 0;
    return Math.max(0, Math.sqrt(R * R - dy * dy) - this.c);
  }

  /** Point on the right half arc at parameter t in [0,1] (0 = springing, 1 = apex). */
  point(t: number, o = 0): [number, number] {
    const R = this.r + o;
    const thApex = Math.acos(clamp(this.c / R, -1, 1));
    const th = thApex * t;
    if (t >= 1) return [0, this.springY + Math.sqrt(Math.max(0, R * R - this.c * this.c))];
    return [-this.c + R * Math.cos(th), this.springY + R * Math.sin(th)];
  }
}

export interface VoussoirOptions {
  /** Inner radial offset from the clear opening. */
  inner: number;
  /** Ring thickness (radial). */
  thickness: number;
  zBack: number;
  zFront: number;
  /** Voussoirs per half arc. */
  count: number;
  gap?: number;
  bevel?: number;
  /** Radial in-and-out jitter of individual voussoirs. */
  stagger?: number;
  rng?: Rng;
  /** Skip voussoirs (broken arch) when this returns true; index from springing (0) to apex (count-1). */
  skip?: (side: number, index: number) => boolean;
}

/** Ring of wedge-shaped arch stones with bevelled front faces (both halves). */
export function voussoirRing(arch: PointedArch, o: VoussoirOptions): THREE.BufferGeometry {
  const mb = new MeshBuilder();
  const gap = o.gap ?? 0.025;
  const bevel = o.bevel ?? 0.05;
  const rng = o.rng;
  for (const side of [-1, 1]) {
    for (let i = 0; i < o.count; i++) {
      if (o.skip && o.skip(side, i)) continue;
      const t0 = i / o.count;
      const t1 = (i + 1) / o.count;
      const st = rng && o.stagger ? rng.range(-o.stagger, o.stagger) : 0;
      const zf = o.zFront + (rng && o.stagger ? rng.range(-o.stagger, o.stagger * 0.5) : 0);
      const pi0 = arch.point(t0, o.inner);
      const pi1 = arch.point(t1, o.inner);
      const po1 = arch.point(t1, o.inner + o.thickness + st);
      const po0 = arch.point(t0, o.inner + o.thickness + st);
      const corners2: Array<[number, number]> = [pi0, pi1, po1, po0].map(([x, y]) => [x * side, y]);
      const cxy = corners2.reduce((acc, p) => [acc[0] + p[0] / 4, acc[1] + p[1] / 4], [0, 0]);
      const shrink = (p: [number, number], d: number): [number, number] => {
        const dx = cxy[0] - p[0];
        const dy = cxy[1] - p[1];
        const l = Math.hypot(dx, dy) || 1;
        return [p[0] + (dx / l) * d, p[1] + (dy / l) * d];
      };
      const outer = corners2.map((p) => shrink(p, gap * 0.7));
      const inner = corners2.map((p) => shrink(p, gap * 0.7 + bevel * 1.2));
      const back: Vec3[] = outer.map(([x, y]) => [x, y, o.zBack]);
      const midR: Vec3[] = outer.map(([x, y]) => [x, y, zf - bevel]);
      const front: Vec3[] = inner.map(([x, y]) => [x, y, zf]);
      const c3: Vec3 = [cxy[0], cxy[1], (o.zBack + zf) / 2];
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        const qs: Vec3[] = [back[k], back[j], midR[j], midR[k]];
        const hs = sub(mid(qs), c3);
        hs[2] = 0;
        mb.quad(qs[0], qs[1], qs[2], qs[3], hs);
        const qb: Vec3[] = [midR[k], midR[j], front[j], front[k]];
        const hb = sub(mid(qb), c3);
        hb[2] = Math.abs(hb[2]) + 0.3;
        mb.quad(qb[0], qb[1], qb[2], qb[3], hb);
      }
      mb.quad(front[0], front[1], front[2], front[3], [0, 0, 1]);
    }
  }
  return mb.build();
}

// ---------------------------------------------------------------------------
// Strip walls (stepped broken tops, arch openings)
// ---------------------------------------------------------------------------

export interface TopSegment {
  x0: number;
  x1: number;
  y: number;
}

export interface StripWallOptions {
  /** Piecewise-constant top, covering the wall extent left to right. */
  tops: TopSegment[];
  z0: number;
  z1: number;
  /** Underside height (0 on the ground, the intrados inside an opening). */
  bottom?: (x: number) => number;
  /** Extra breakpoints (e.g. the jambs of an opening). */
  breaks?: number[];
  stripW?: number;
  rowH?: number;
  /** Cap the left / right ends. */
  capLeft?: boolean;
  capRight?: boolean;
  /** Emit underside faces where the bottom is above 0 (default true). */
  soffit?: boolean;
}

/**
 * Wall slab along X between z0 (back) and z1 (front) with a stepped top and an optional opening
 * cut from below. Front/back faces are subdivided so vertex colours can carry moss and dirt.
 */
export function stripWall(o: StripWallOptions): THREE.BufferGeometry {
  const mb = new MeshBuilder();
  const stripW = o.stripW ?? 0.45;
  const rowH = o.rowH ?? 0.7;
  const bottom = o.bottom ?? (() => 0);
  const xs = new Set<number>();
  for (const s of o.tops) {
    xs.add(s.x0);
    xs.add(s.x1);
  }
  for (const b of o.breaks ?? []) xs.add(b);
  const sorted = Array.from(xs).sort((a, b) => a - b);
  const xMin = sorted[0];
  const xMax = sorted[sorted.length - 1];
  const edges: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b - a < 1e-4) continue;
    const n = Math.max(1, Math.ceil((b - a) / stripW));
    for (let k = 0; k < n; k++) edges.push(a + ((b - a) * k) / n);
  }
  edges.push(xMax);
  const topAt = (x: number): number => {
    for (const s of o.tops) if (x >= s.x0 - 1e-6 && x <= s.x1 + 1e-6) return s.y;
    return o.tops[o.tops.length - 1].y;
  };
  const eps = 1e-4;
  const { z0, z1 } = o;
  interface Strip {
    xa: number;
    xb: number;
    ba: number;
    bb: number;
    t: number;
  }
  const strips: Strip[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const xa = edges[i];
    const xb = edges[i + 1];
    const t = topAt((xa + xb) / 2);
    const ba = Math.min(bottom(xa + eps), t);
    const bb = Math.min(bottom(xb - eps), t);
    strips.push({ xa, xb, ba, bb, t });
  }
  for (const s of strips) {
    const h = s.t - Math.min(s.ba, s.bb);
    if (h <= 1e-3) continue;
    const rows = Math.max(1, Math.ceil(h / rowH));
    for (let k = 0; k < rows; k++) {
      const f0 = k / rows;
      const f1 = (k + 1) / rows;
      const ya0 = s.ba + (s.t - s.ba) * f0;
      const ya1 = s.ba + (s.t - s.ba) * f1;
      const yb0 = s.bb + (s.t - s.bb) * f0;
      const yb1 = s.bb + (s.t - s.bb) * f1;
      mb.quad([s.xa, ya0, z1], [s.xb, yb0, z1], [s.xb, yb1, z1], [s.xa, ya1, z1], [0, 0, 1]);
      mb.quad([s.xa, ya0, z0], [s.xb, yb0, z0], [s.xb, yb1, z0], [s.xa, ya1, z0], [0, 0, -1]);
    }
    // top
    mb.quad([s.xa, s.t, z0], [s.xb, s.t, z0], [s.xb, s.t, z1], [s.xa, s.t, z1], [0, 1, 0]);
    // soffit (underside of an opening)
    if (o.soffit !== false && (s.ba > 1e-3 || s.bb > 1e-3)) {
      const dx = s.xb - s.xa;
      const dy = s.bb - s.ba;
      const hint: Vec3 = [dy, -dx, 0];
      if (hint[1] > 0) {
        hint[0] = -hint[0];
        hint[1] = -hint[1];
      }
      mb.quad([s.xa, s.ba, z0], [s.xb, s.bb, z0], [s.xb, s.bb, z1], [s.xa, s.ba, z1], hint);
    }
  }
  // vertical faces between strips (top steps and jambs): symmetric difference of the two columns
  for (let i = 0; i < strips.length - 1; i++) {
    const L = strips[i];
    const R = strips[i + 1];
    const x = L.xb;
    const a1 = Math.min(L.bb, L.t);
    const b1 = L.t;
    const a2 = Math.min(R.ba, R.t);
    const b2 = R.t;
    const face = (lo: number, hi: number, nx: number): void => {
      if (hi - lo > 1e-4) mb.quad([x, lo, z0], [x, hi, z0], [x, hi, z1], [x, lo, z1], [nx, 0, 0]);
    };
    if (b1 > b2 + 1e-4) face(Math.max(b2, a1), b1, 1);
    else if (b2 > b1 + 1e-4) face(Math.max(b1, a2), b2, -1);
    if (a1 < a2 - 1e-4) face(a1, Math.min(a2, b1), 1);
    else if (a2 < a1 - 1e-4) face(a2, Math.min(a1, b2), -1);
  }
  if (o.capLeft !== false && strips.length) {
    const s = strips[0];
    mb.quad([xMin, s.ba, z0], [xMin, s.t, z0], [xMin, s.t, z1], [xMin, s.ba, z1], [-1, 0, 0]);
  }
  if (o.capRight !== false && strips.length) {
    const s = strips[strips.length - 1];
    mb.quad([xMax, s.bb, z0], [xMax, s.t, z0], [xMax, s.t, z1], [xMax, s.bb, z1], [1, 0, 0]);
  }
  return mb.build();
}

/**
 * Random stepped broken top: block-aligned segments between [x0, x1] whose heights wander
 * between minY and maxY in multiples of `step`.
 */
export function brokenTop(
  rng: Rng,
  x0: number,
  x1: number,
  minY: number,
  maxY: number,
  step = COURSE,
  segMin = 0.6,
  segMax = 1.5,
  profile?: (t: number) => number,
): TopSegment[] {
  const out: TopSegment[] = [];
  let x = x0;
  let y = maxY - step * rng.int(0, 1);
  while (x < x1 - 1e-4) {
    let w = rng.range(segMin, segMax);
    if (x1 - (x + w) < segMin * 0.6) w = x1 - x;
    const xe = Math.min(x1, x + w);
    const t = ((x + xe) / 2 - x0) / Math.max(1e-4, x1 - x0);
    const cap = profile ? minY + (maxY - minY) * clamp(profile(t), 0, 1) : maxY;
    y += step * (rng.chance(0.5) ? 1 : -1) * (rng.chance(0.3) ? 2 : 1);
    y = clamp(y, minY, Math.max(minY, cap));
    y = minY + Math.round((y - minY) / step) * step;
    out.push({ x0: x, x1: xe, y });
    x = xe;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Carved glyph reliefs (fictional Ember-King motifs)
// ---------------------------------------------------------------------------

export type GlyphKind = 'sun' | 'spiral' | 'wave' | 'mask' | 'flame' | 'eye' | 'steps';
export const GLYPH_KINDS: GlyphKind[] = ['sun', 'spiral', 'mask', 'wave', 'flame', 'eye', 'steps'];

function circlePath(path: THREE.Path, cx: number, cy: number, r: number, n: number, reverse = false): void {
  for (let i = 0; i <= n; i++) {
    const a = ((reverse ? -i : i) / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}

function polyShape(pts: Array<[number, number]>): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

/** Glyph outlines in a unit box [-0.5, 0.5]^2. */
export function glyphShapes(kind: GlyphKind): THREE.Shape[] {
  switch (kind) {
    case 'sun': {
      const rays = 8;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < rays * 2; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.3;
        const a = (i / (rays * 2)) * Math.PI * 2 + Math.PI / 2;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      const star = polyShape(pts);
      const hole = new THREE.Path();
      circlePath(hole, 0, 0, 0.2, 12, true);
      star.holes.push(hole);
      const disc = new THREE.Shape();
      circlePath(disc, 0, 0, 0.11, 10);
      return [star, disc];
    }
    case 'spiral': {
      const outer: Array<[number, number]> = [];
      const inner: Array<[number, number]> = [];
      const turns = 2.1;
      const n = 30;
      const w = 0.085;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = t * turns * Math.PI * 2;
        const r = 0.05 + t * 0.38;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        const ww = w * (0.6 + 0.4 * t);
        outer.push([x + nx * ww * 0.5, y + ny * ww * 0.5]);
        inner.push([x - nx * ww * 0.5, y - ny * ww * 0.5]);
      }
      return [polyShape([...outer, ...inner.reverse()])];
    }
    case 'wave': {
      const shapes: THREE.Shape[] = [];
      for (const y0 of [-0.2, 0.05, 0.3]) {
        const top: Array<[number, number]> = [];
        const bot: Array<[number, number]> = [];
        for (let i = 0; i <= 16; i++) {
          const x = -0.48 + (i / 16) * 0.96;
          const y = y0 + Math.sin((x + 0.48) * Math.PI * 2.5) * 0.07;
          top.push([x, y + 0.045]);
          bot.push([x, y - 0.045]);
        }
        shapes.push(polyShape([...top, ...bot.reverse()]));
      }
      return shapes;
    }
    case 'mask': {
      const pts: Array<[number, number]> = [];
      // crown rays across the brow
      const rays = 5;
      for (let i = 0; i <= rays * 2; i++) {
        const x = 0.34 - (i / (rays * 2)) * 0.68;
        const y = i % 2 === 1 ? 0.5 : 0.22;
        pts.push([x, y]);
      }
      pts.push([-0.36, 0.12], [-0.3, -0.18], [-0.14, -0.4], [0, -0.5], [0.14, -0.4], [0.3, -0.18], [0.36, 0.12]);
      const face = polyShape(pts);
      const eyeL = new THREE.Path();
      [[-0.24, 0.05], [-0.06, 0.08], [-0.08, 0.0], [-0.22, -0.01]].forEach(([x, y], i) => (i === 0 ? eyeL.moveTo(x, y) : eyeL.lineTo(x, y)));
      eyeL.closePath();
      const eyeR = new THREE.Path();
      [[0.24, 0.05], [0.22, -0.01], [0.08, 0.0], [0.06, 0.08]].forEach(([x, y], i) => (i === 0 ? eyeR.moveTo(x, y) : eyeR.lineTo(x, y)));
      eyeR.closePath();
      const mouth = new THREE.Path();
      [[-0.1, -0.22], [-0.1, -0.28], [0.1, -0.28], [0.1, -0.22]].forEach(([x, y], i) => (i === 0 ? mouth.moveTo(x, y) : mouth.lineTo(x, y)));
      mouth.closePath();
      face.holes.push(eyeL, eyeR, mouth);
      return [face];
    }
    case 'flame': {
      const pts: Array<[number, number]> = [];
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = t * Math.PI * 2;
        // teardrop: round bottom, sharp curling tip
        const r = 0.28 * (1 - 0.15 * Math.cos(a));
        let x = Math.sin(a) * r;
        let y = -0.18 - Math.cos(a) * r * 0.95;
        const up = Math.max(0, -Math.cos(a));
        y += up * up * 0.42;
        x *= 1 - up * up * 0.8;
        x += up * up * up * 0.08;
        pts.push([x, y]);
      }
      const outer = polyShape(pts);
      const hole = new THREE.Path();
      const ip = pts.map(([x, y]) => [x * 0.45, -0.2 + (y + 0.2) * 0.45] as [number, number]).reverse();
      ip.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
      hole.closePath();
      outer.holes.push(hole);
      return [outer];
    }
    case 'eye': {
      const pts: Array<[number, number]> = [];
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([Math.cos(a) * 0.48, Math.sin(a) * 0.22 * (1 - 0.25 * Math.cos(a) * Math.cos(a))]);
      }
      const almond = polyShape(pts);
      const hole = new THREE.Path();
      circlePath(hole, 0, 0, 0.15, 10, true);
      almond.holes.push(hole);
      const pupil = new THREE.Shape();
      circlePath(pupil, 0, 0, 0.08, 8);
      const lashes: THREE.Shape[] = [];
      for (const lx of [-0.24, 0, 0.24]) lashes.push(polyShape([[lx - 0.04, 0.24], [lx + 0.04, 0.24], [lx + 0.06, 0.44], [lx - 0.06, 0.44]]));
      return [almond, pupil, ...lashes];
    }
    case 'steps': {
      // stepped pyramid with an ember on top
      const pts: Array<[number, number]> = [
        [-0.48, -0.45], [0.48, -0.45], [0.48, -0.28], [0.34, -0.28], [0.34, -0.1], [0.2, -0.1], [0.2, 0.08], [0.08, 0.08], [0.08, 0.18],
        [-0.08, 0.18], [-0.08, 0.08], [-0.2, 0.08], [-0.2, -0.1], [-0.34, -0.1], [-0.34, -0.28], [-0.48, -0.28],
      ];
      const ember = new THREE.Shape();
      circlePath(ember, 0, 0.36, 0.11, 10);
      return [polyShape(pts), ember];
    }
  }
}

/** Extruded glyph relief in the XY plane, protruding from z = 0 to z = depth, centred on the origin. */
const glyphCache = new Map<string, THREE.BufferGeometry>();

export function glyph(kind: GlyphKind, size: number, depth: number): THREE.BufferGeometry {
  const key = `${kind}|${depth / size}`;
  let unit = glyphCache.get(key);
  if (!unit) {
    const g = new THREE.ExtrudeGeometry(glyphShapes(kind), { depth: depth / size, bevelEnabled: false, curveSegments: 4, steps: 1 });
    g.computeVertexNormals();
    unit = dropFaces(g, [0, 0, -1]);
    glyphCache.set(key, unit);
  }
  const out = unit.clone();
  out.scale(size, size, size);
  return out;
}

/** Removes triangles facing `dir` (hidden back caps against walls / the ground). */
export function dropFaces(geo: THREE.BufferGeometry, dir: Vec3, threshold = 0.7): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const keep: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < p.count; t += 3) {
    a.fromBufferAttribute(p, t);
    b.fromBufferAttribute(p, t + 1);
    c.fromBufferAttribute(p, t + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    if (n.x * dir[0] + n.y * dir[1] + n.z * dir[2] < threshold) keep.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.attributes[name] as THREE.BufferAttribute;
    const size = src.itemSize;
    const arr = new Float32Array(keep.length * 3 * size);
    let o = 0;
    for (const t of keep) for (let k = 0; k < 3; k++) for (let j = 0; j < size; j++) arr[o++] = src.array[(t + k) * size + j];
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return ensureStandardAttributes(out);
}

// ---------------------------------------------------------------------------
// Moss & rubble
// ---------------------------------------------------------------------------

/** Soft lumpy moss cushion with a flat underside, base at y = 0. */
export function mossClump(rng: Rng, w: number, d: number, h: number, detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const seed = rng.range(0, 100);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const k = 1 + noise.noise(x * 1.7 + seed, z * 1.7 + y * 1.3) * 0.28;
    x *= k;
    z *= k;
    y = y < 0 ? y * 0.12 : y * k;
    p.setXYZ(i, (x * w) / 2, (y + 0.12) * h * 0.9, (z * d) / 2);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  sphericalNormals(g, new THREE.Vector3(0, -h * 0.4, 0), 0.65);
  ensureStandardAttributes(g);
  const col = g.attributes.color as THREE.BufferAttribute;
  const a = new THREE.Color(rng.pick(StoneColors.moss));
  const b = new THREE.Color(rng.pick(StoneColors.moss));
  for (let i = 0; i < p.count; i++) {
    const t = clamp(p.getY(i) / Math.max(0.01, h), 0, 1);
    const nn = noise.noise(p.getX(i) * 2.3 + seed, p.getZ(i) * 2.3);
    _c.copy(a).lerp(b, clamp(0.5 + nn * 0.6, 0, 1)).multiplyScalar(0.72 + 0.38 * t);
    col.setXYZ(i, _c.r, _c.g, _c.b);
  }
  col.needsUpdate = true;
  return g;
}

/**
 * Hanging moss / ivy curtain in the local XY plane (hangs from y = 0 downwards, bulges towards +Z).
 * Rotate/translate it onto a wall face.
 */
export function mossDrape(rng: Rng, width: number, length: number, strands = 5): THREE.BufferGeometry {
  const mb = new MeshBuilder();
  const n = Math.max(2, Math.round(strands * 1.7));
  const ranges: Array<[number, number, number]> = [];
  for (let s = 0; s < n; s++) {
    const cx = -width / 2 + ((s + rng.range(0.1, 0.9)) / n) * width;
    const len = length * (0.25 + 0.75 * Math.pow(rng.next(), 0.6));
    const w0 = rng.range(0.07, 0.13) * clamp(width * 0.9 + 0.4, 0.6, 1.5);
    const segs = Math.max(3, Math.round(len / 0.22));
    const zs = 0.025 + rng.range(0, 0.05);
    const curl = rng.range(-0.15, 0.15);
    const ph = rng.range(0, 6);
    const start = mb.triangles;
    let prev: [Vec3, Vec3] | null = null;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const y = -len * t;
      const bulge = 0.7 + 0.5 * Math.sin(ph + t * 9);
      const hw = k === segs ? 0.004 : w0 * (1 - t * 0.8) * bulge;
      const x = cx + curl * t * t + Math.sin(ph + t * 5) * 0.025;
      const z = zs + Math.sin(t * Math.PI) * 0.045;
      const l: Vec3 = [x - hw, y, z];
      const r: Vec3 = [x + hw, y, z];
      if (prev) mb.quad(prev[0], prev[1], r, l, [0, 0, 1]);
      prev = [l, r];
    }
    ranges.push([start, mb.triangles, len]);
  }
  const g = mb.build();
  const p = g.attributes.position;
  const col = g.attributes.color as THREE.BufferAttribute;
  const tipC = new THREE.Color(0x34501d);
  const base = new THREE.Color();
  for (const [t0, t1] of ranges) {
    base.set(rng.pick([0x6f9136, 0x7f9c3c, 0x5c8030, 0x8aa443, 0x66883a]));
    for (let i = t0 * 3; i < t1 * 3; i++) {
      const t = clamp(-p.getY(i) / Math.max(0.01, length), 0, 1);
      _c.copy(base).lerp(tipC, clamp(t * 1.1, 0, 0.85));
      col.setXYZ(i, _c.r, _c.g, _c.b);
    }
  }
  col.needsUpdate = true;
  return g;
}

/** Hanging vine strand: thin tube with moss lumps along it (vertexColor), hangs from (0,0,0) down. */
export function vineStrand(rng: Rng, length: number, out: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = 6;
  const ph = rng.range(0, 6);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(Math.sin(ph + t * 3) * 0.12, -length * t, out * Math.sin(t * Math.PI) * 0.6 + 0.05));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 8, 0.035, 4, false);
  ensureStandardAttributes(tube);
  const col = tube.attributes.color as THREE.BufferAttribute;
  _c.set(0x4c5a2a);
  for (let i = 0; i < col.count; i++) col.setXYZ(i, _c.r, _c.g, _c.b);
  const geos: THREE.BufferGeometry[] = [tube];
  const leaves = Math.max(2, Math.round(length * 2.2));
  for (let i = 0; i < leaves; i++) {
    const t = rng.range(0.05, 1);
    const pt = curve.getPoint(t);
    const s = rng.range(0.08, 0.16) * (1.1 - t * 0.4);
    const lump = mossClump(rng, s * 2.4, s * 1.2, s * 1.1, 0);
    lump.rotateZ(rng.range(-0.6, 0.6));
    lump.translate(pt.x + rng.range(-0.05, 0.05), pt.y - s * 0.5, pt.z + 0.02);
    tint(lump, 0x9aa088);
    geos.push(lump);
  }
  return merge(geos);
}

/** Small rough stone chunk (plain `stone` material), base near y = 0. */
export function rubbleChunk(rng: Rng, size: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(size * 0.5, 0);
  const p = g.attributes.position;
  const sx = rng.range(0.8, 1.3);
  const sy = rng.range(0.45, 0.8);
  const sz = rng.range(0.8, 1.2);
  for (let i = 0; i < p.count; i++) {
    const k = 1 + noise.noise(p.getX(i) * 3 + size * 10, p.getZ(i) * 3 + p.getY(i) * 2) * 0.22;
    p.setXYZ(i, p.getX(i) * sx * k, p.getY(i) * sy * k, p.getZ(i) * sz * k);
  }
  p.needsUpdate = true;
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  g.translate(0, size * 0.5 * sy * 0.7, 0);
  return ensureStandardAttributes(g);
}

/** Places a clone of `geo` with TRS (yaw-first Euler like GeometryUtils.trs). */
export function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(s, s, s),
  );
  const g = geo.clone();
  g.applyMatrix4(m);
  return g;
}

/**
 * Convex XZ polygon slab from y0 to y1 with a bevelled top edge (paving, cobbles, steps).
 * `dome` raises the top centre (rounded cobbles). Tris: n (top) + 2n (bevel) + 2n (sides).
 */
export function bevelSlab(pts: Array<[number, number]>, y0: number, y1: number, bevel: number, dome = 0): THREE.BufferGeometry {
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  const inset = pts.map(([x, z]): [number, number] => {
    const dx = cx - x;
    const dz = cz - z;
    const l = Math.hypot(dx, dz) || 1;
    const k = Math.min(bevel, l * 0.45);
    return [x + (dx / l) * k, z + (dz / l) * k];
  });
  const b = Math.min(bevel, (y1 - y0) * 0.45);
  const mb = new MeshBuilder();
  const centre: Vec3 = [cx, (y0 + y1) / 2, cz];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const s: Vec3[] = [
      [pts[i][0], y0, pts[i][1]],
      [pts[j][0], y0, pts[j][1]],
      [pts[j][0], y1 - b, pts[j][1]],
      [pts[i][0], y1 - b, pts[i][1]],
    ];
    const hs = sub(mid(s), centre);
    hs[1] = 0;
    mb.quad(s[0], s[1], s[2], s[3], hs);
    const t: Vec3[] = [
      [pts[i][0], y1 - b, pts[i][1]],
      [pts[j][0], y1 - b, pts[j][1]],
      [inset[j][0], y1, inset[j][1]],
      [inset[i][0], y1, inset[i][1]],
    ];
    const ht = sub(mid(t), centre);
    ht[1] = Math.abs(ht[1]) + 0.2;
    mb.quad(t[0], t[1], t[2], t[3], ht);
  }
  if (dome > 0) {
    const apex: Vec3 = [cx, y1 + dome, cz];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      mb.tri(apex, [inset[i][0], y1, inset[i][1]], [inset[j][0], y1, inset[j][1]], [0, 1, 0]);
    }
  } else {
    mb.poly(inset.map(([x, z]): Vec3 => [x, y1, z]), [0, 1, 0]);
  }
  return mb.build();
}

/** Irregular convex polygon (jittered n-gon) with radii rx/rz. */
export function irregularPoly(rng: Rng, n: number, rx: number, rz: number, jitterAmt = 0.18): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const rot = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = rot + ((i + rng.range(-0.25, 0.25)) / n) * Math.PI * 2;
    const k = 1 + rng.range(-jitterAmt, jitterAmt);
    out.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]);
  }
  return out;
}

/** Flat-shaded lathe from (radius, y) profile points (bottom to top), `seg` sides. */
export function lathe(profile: Array<[number, number]>, seg: number, rot = 0): THREE.BufferGeometry {
  const mb = new MeshBuilder();
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, y0] = profile[k];
    const [r1, y1] = profile[k + 1];
    for (let i = 0; i < seg; i++) {
      const a0 = rot + (i / seg) * Math.PI * 2;
      const a1 = rot + ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p0: Vec3 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0];
      const p1: Vec3 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0];
      const p2: Vec3 = [Math.cos(a1) * r1, y1, Math.sin(a1) * r1];
      const p3: Vec3 = [Math.cos(a0) * r1, y1, Math.sin(a0) * r1];
      // outward hint: radial, tilted by the profile slope (inner surfaces of bowls flip naturally)
      const dr = r1 - r0;
      const dy = y1 - y0;
      const ny = -dr;
      const nr = dy;
      const len = Math.hypot(nr, ny) || 1;
      mb.quad(p0, p1, p2, p3, [(Math.cos(am) * nr) / len, ny / len, (Math.sin(am) * nr) / len]);
    }
  }
  const [rt, yt] = profile[profile.length - 1];
  if (rt > 1e-3) {
    const cap: Vec3[] = [];
    for (let i = 0; i < seg; i++) {
      const a = rot + (i / seg) * Math.PI * 2;
      cap.push([Math.cos(a) * rt, yt, Math.sin(a) * rt]);
    }
    mb.poly(cap, [0, 1, 0]);
  }
  return mb.build();
}
