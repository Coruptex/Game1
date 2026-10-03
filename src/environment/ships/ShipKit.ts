import * as THREE from 'three';
import type { MaterialName } from '../../assets/materials/MaterialLibrary';
import { Palette } from '../../assets/materials/MaterialLibrary';
import type { PropPart } from '../PropTypes';
import { ensureStandardAttributes, jitterColors, merge, paint, place } from '../../assets/geometry/GeometryUtils';

/**
 * Small geometry kit shared by the ship builders: a part collector that merges by material,
 * UV-correct primitives (boxes, spars, sweeps, tubes, grids) and reusable ship props
 * (barrels, crates, rope coils, lanterns, cannons, wheel, anchor, capstan, hatch gratings).
 *
 * UV conventions (see ProceduralTextures):
 * - woodGrain ('wood', 'woodDark', 'woodPale'): grain runs along V.
 * - woodPlanks: planks run along U, 8 planks per tile in V.
 * - sail: u across the sail, v vertical (v = 1 at the head / yard, 0 at the foot).
 */

export type V3 = THREE.Vector3;
export const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/** Metres per texture tile. */
export const TILE = {
  grainU: 0.9,
  grainV: 2.6,
  plankU: 4.0,
  plankV: 2.2,
} as const;

// ---------------------------------------------------------------------------
// Part collector
// ---------------------------------------------------------------------------

export interface AddOpts {
  seeThrough?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

interface Group {
  material: MaterialName;
  seeThrough: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  geos: THREE.BufferGeometry[];
}

/** Collects geometries per material/flags and merges each group into a single PropPart. */
export class PartBin {
  private readonly groups = new Map<string, Group>();

  add(material: MaterialName, geo: THREE.BufferGeometry | THREE.BufferGeometry[], opts: AddOpts = {}): void {
    const seeThrough = !!opts.seeThrough;
    const castShadow = opts.castShadow ?? true;
    const receiveShadow = opts.receiveShadow ?? true;
    const key = `${material}|${seeThrough ? 1 : 0}${castShadow ? 1 : 0}${receiveShadow ? 1 : 0}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { material, seeThrough, castShadow, receiveShadow, geos: [] };
      this.groups.set(key, g);
    }
    if (Array.isArray(geo)) g.geos.push(...geo);
    else g.geos.push(geo);
  }

  parts(): PropPart[] {
    const out: PropPart[] = [];
    for (const g of this.groups.values()) {
      if (g.geos.length === 0) continue;
      const geometry = g.geos.length === 1 ? ensureStandardAttributes(g.geos[0]) : merge(g.geos);
      out.push({
        geometry,
        material: g.material,
        seeThrough: g.seeThrough,
        castShadow: g.castShadow,
        receiveShadow: g.receiveShadow,
      });
    }
    return out;
  }
}

export function triangles(parts: PropPart[]): number {
  let n = 0;
  for (const p of parts) {
    const g = p.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
  return Math.round(n);
}

/** A reusable multi-material prop: geometries in prop-local space keyed by material. */
export type Kit = Array<{ m: MaterialName; g: THREE.BufferGeometry }>;

/** Places clones of a kit into the bin (Euler order YXZ like GeometryUtils.place). */
export function stamp(
  bin: PartBin,
  kit: Kit,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0,
  s = 1,
  opts: AddOpts = {},
): void {
  for (const k of kit) bin.add(k.m, place(k.g, x, y, z, rx, ry, rz, s), opts);
}

/** Places clones of a kit with an arbitrary matrix. */
export function stampMatrix(bin: PartBin, kit: Kit, m: THREE.Matrix4, opts: AddOpts = {}): void {
  for (const k of kit) {
    const g = k.g.clone();
    g.applyMatrix4(m);
    bin.add(k.m, g, opts);
  }
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Sets every vertex colour to linear RGB (values > 1 brighten textured materials, e.g. paint). */
export function setRGB(geo: THREE.BufferGeometry, r: number, g: number, b: number): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, r, g, b);
  c.needsUpdate = true;
  return geo;
}

/** Multiplies vertex colours by a scalar function of the vertex position. */
export function shade(geo: THREE.BufferGeometry, f: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const p = geo.attributes.position;
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = f(p.getX(i), p.getY(i), p.getZ(i));
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  c.needsUpdate = true;
  return geo;
}

/** Multiplies vertex colours by an RGB function of the vertex position. */
export function shadeRGB(
  geo: THREE.BufferGeometry,
  f: (x: number, y: number, z: number, out: [number, number, number]) => void,
): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const p = geo.attributes.position;
  const c = geo.attributes.color as THREE.BufferAttribute;
  const k: [number, number, number] = [1, 1, 1];
  for (let i = 0; i < p.count; i++) {
    k[0] = 1;
    k[1] = 1;
    k[2] = 1;
    f(p.getX(i), p.getY(i), p.getZ(i), k);
    c.setXYZ(i, c.getX(i) * k[0], c.getY(i) * k[1], c.getZ(i) * k[2]);
  }
  c.needsUpdate = true;
  return geo;
}

/** paint + jitter in one call. */
export function tone(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0.08, seed = 0, scale = 1.3): THREE.BufferGeometry {
  paint(geo, color);
  if (jitter > 0) jitterColors(geo, jitter, scale, seed);
  return geo;
}

/** Reverses triangle winding and normals (inside-out surfaces). */
export function flipFaces(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new Array<number>(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(idx);
  }
  const index = geo.index!;
  for (let i = 0; i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
  index.needsUpdate = true;
  const nrm = geo.attributes.normal as THREE.BufferAttribute | undefined;
  if (nrm) {
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    nrm.needsUpdate = true;
  }
  return geo;
}

export function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number, ou = 0, ov = 0): THREE.BufferGeometry {
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type Axis = 'x' | 'y' | 'z';
const AXI: Record<Axis, number> = { x: 0, y: 1, z: 2 };

/**
 * Box with metre-based UVs: on faces parallel to `along`, V runs along that axis (wood grain /
 * plank direction); end faces get planar UVs. Size in metres, centred at the origin.
 */
export function box(w: number, h: number, d: number, along: Axis = 'y', tu: number = TILE.grainU, tv: number = TILE.grainV): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const ga = AXI[along];
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const fa = nx > 0.5 ? 0 : ny > 0.5 ? 1 : 2;
    let ua: number;
    let va: number;
    if (fa === ga) {
      ua = (fa + 1) % 3;
      va = (fa + 2) % 3;
    } else {
      va = ga;
      ua = 3 - fa - ga;
    }
    uv.setXY(i, p[ua] / tu + 0.37 * ga, p[va] / tv);
  }
  return g;
}

/** Box planks: like `box` but U runs along `along` (woodPlanks texture: planks along U). */
export function plankBox(w: number, h: number, d: number, along: Axis = 'z'): THREE.BufferGeometry {
  const g = box(w, h, d, along, TILE.plankV, TILE.plankU);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return g;
}

function basisBetween(a: V3, b: V3, up: V3): THREE.Matrix4 {
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const u = up.clone().addScaledVector(dir, -up.dot(dir));
  if (u.lengthSq() < 1e-6) {
    u.set(Math.abs(dir.y) < 0.9 ? 0 : 1, Math.abs(dir.y) < 0.9 ? 1 : 0, 0);
    u.addScaledVector(dir, -u.dot(dir));
  }
  u.normalize();
  const side = new THREE.Vector3().crossVectors(dir, u).normalize();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return new THREE.Matrix4().makeBasis(side, dir, u).setPosition(mid);
}

/** Rectangular beam from a to b: `w` across (side), `h` along the up hint. Grain along the beam. */
export function beam(a: V3, b: V3, w: number, h: number, up: V3 = UP): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = box(w, len, h, 'y');
  g.applyMatrix4(basisBetween(a, b, up));
  return g;
}

/** Plank (woodPlanks) beam from a to b. */
export function plankBeam(a: V3, b: V3, w: number, h: number, up: V3 = UP): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = plankBox(w, len, h, 'y');
  g.applyMatrix4(basisBetween(a, b, up));
  return g;
}

function alignY(g: THREE.BufferGeometry, a: V3, b: V3): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  g.applyMatrix4(new THREE.Matrix4().compose(a, q, ONE));
  return g;
}

/** Tapered round spar (masts, yards, booms): r0 at a, r1 at b. Grain along the spar. */
export function spar(a: V3, b: V3, r0: number, r1 = r0, radial = 8, capped = false): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, !capped);
  scaleUV(g, (Math.PI * (r0 + r1)) / TILE.grainU, len / TILE.grainV);
  g.translate(0, len / 2, 0);
  return alignY(g, a, b);
}

/** Thin rope: straight 3-sided prism, or a sagging tube when `sag` > 0. */
export function rope(a: V3, b: V3, r = 0.03, sag = 0, segs = 6): THREE.BufferGeometry {
  if (sag <= 0) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 3, 1, true);
    g.translate(0, len / 2, 0);
    return alignY(g, a, b);
  }
  const pts: V3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, 3, false);
}

/** (nu x nv) quad grid. `fn(u, v)` writes the position; front faces follow +u x +v. */
export function grid(
  nu: number,
  nv: number,
  fn: (u: number, v: number, out: V3) => void,
  uvFn?: (u: number, v: number) => [number, number],
): THREE.BufferGeometry {
  const n = (nu + 1) * (nv + 1);
  const pos = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  const tmp = new THREE.Vector3();
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      fn(u, v, tmp);
      pos[k * 3] = tmp.x;
      pos[k * 3 + 1] = tmp.y;
      pos[k * 3 + 2] = tmp.z;
      const t = uvFn ? uvFn(u, v) : [u, v];
      uvs[k * 2] = t[0];
      uvs[k * 2 + 1] = t[1];
      k++;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 2;
      const d = a + nu + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Builds an indexed geometry from raw arrays and computes normals. */
export function fromArrays(pos: number[], uv: number[], idx: number[], normals?: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else g.computeVertexNormals();
  return g;
}

export interface SweepOptions {
  /** Profile is a closed loop (default true). */
  closed?: boolean;
  /** Explicit side vectors (profile +x) per path point. */
  sides?: V3[];
  /** Reference up when `sides` is not given (default +Y). */
  upRef?: V3;
  caps?: boolean;
  tu?: number;
  tv?: number;
}

/**
 * Extrudes a 2D profile (x = side, y = up, counter-clockwise for outward faces) along a path.
 * Hard edges between profile segments; UV u around the profile, v along the path (grain).
 */
export function sweep(path: V3[], profile: Array<[number, number]>, o: SweepOptions = {}): THREE.BufferGeometry {
  const n = path.length;
  const closed = o.closed ?? true;
  const upRef = o.upRef ?? UP;
  const tu = o.tu ?? TILE.grainU;
  const tv = o.tv ?? TILE.grainV;
  const T: V3[] = [];
  const S: V3[] = [];
  const U: V3[] = [];
  const len: number[] = [0];
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3().subVectors(path[Math.min(i + 1, n - 1)], path[Math.max(i - 1, 0)]).normalize();
    const s = o.sides ? o.sides[i].clone() : new THREE.Vector3().crossVectors(upRef, t);
    s.addScaledVector(t, -s.dot(t));
    if (s.lengthSq() < 1e-8) s.set(1, 0, 0);
    s.normalize();
    T.push(t);
    S.push(s);
    U.push(new THREE.Vector3().crossVectors(t, s).normalize());
    if (i > 0) len.push(len[i - 1] + path[i].distanceTo(path[i - 1]));
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = profile.length;
  const edges = closed ? P : P - 1;
  let perim = 0;
  const tmp = new THREE.Vector3();
  const put = (i: number, p: [number, number], u: number): void => {
    tmp.copy(path[i]).addScaledVector(S[i], p[0]).addScaledVector(U[i], p[1]);
    pos.push(tmp.x, tmp.y, tmp.z);
    uv.push(u / tu, len[i] / tv);
  };
  for (let e = 0; e < edges; e++) {
    const p0 = profile[e];
    const p1 = profile[(e + 1) % P];
    const el = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      put(i, p0, perim);
      put(i, p1, perim + el);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + 2 * i;
      const b = a + 1;
      const c = base + 2 * (i + 1) + 1;
      const d = base + 2 * (i + 1);
      idx.push(a, b, c, a, c, d);
    }
    perim += el;
  }
  if (o.caps) {
    for (const end of [0, n - 1]) {
      const base = pos.length / 3;
      let cx = 0;
      let cy = 0;
      for (const p of profile) {
        cx += p[0] / P;
        cy += p[1] / P;
      }
      put(end, [cx, cy], 0);
      for (const p of profile) put(end, p, p[0] + p[1]);
      for (let j = 0; j < P; j++) {
        const a = base + 1 + j;
        const b = base + 1 + ((j + 1) % P);
        if (end === 0) idx.push(base, b, a);
        else idx.push(base, a, b);
      }
    }
  }
  const g = fromArrays(pos, uv, idx);
  return g;
}

/** Smooth round tube along a path with a radius function r(t), t in [0,1] along the path. */
export function tube(
  path: V3[],
  radius: (t: number) => number,
  radial = 6,
  o: { upRef?: V3; tu?: number; tv?: number; uMax?: number } = {},
): THREE.BufferGeometry {
  const n = path.length;
  const upRef = o.upRef ?? UP;
  const tu = o.tu ?? 1;
  const tv = o.tv ?? TILE.grainV;
  const len: number[] = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = len[n - 1] || 1;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const t = new THREE.Vector3();
  const s = new THREE.Vector3();
  const u = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    t.subVectors(path[Math.min(i + 1, n - 1)], path[Math.max(i - 1, 0)]).normalize();
    s.crossVectors(upRef, t);
    if (s.lengthSq() < 1e-8) s.set(1, 0, 0);
    s.normalize();
    u.crossVectors(t, s).normalize();
    const r = radius(len[i] / total);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      d.copy(s).multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a));
      pos.push(path[i].x + d.x * r, path[i].y + d.y * r, path[i].z + d.z * r);
      nrm.push(d.x, d.y, d.z);
      uv.push(o.uMax !== undefined ? (j / radial) * o.uMax : (j / radial) * ((Math.PI * 2 * r) / tu), len[i] / tv);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + 1;
      const c = a + radial + 2;
      const e = a + radial + 1;
      idx.push(a, e, b, b, e, c);
    }
  }
  return fromArrays(pos, uv, idx, nrm);
}

/** Lathe around +Y. Profile [radius, y] must go bottom -> top for outward faces. */
export function lathe(profile: Array<[number, number]>, segments: number, su = 1, sv = 1): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  return scaleUV(g, su, sv);
}

/** Horizontal disc facing +Y (or -Y). */
export function disc(r: number, segments: number, y = 0, down = false): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, segments);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Flat quad from 4 corners (a,b,c,d counter-clockwise when seen from the front). */
export function quad(a: V3, b: V3, c: V3, d: V3, uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]): THREE.BufferGeometry {
  return fromArrays(
    [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z],
    [uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1], uvs[3][0], uvs[3][1]],
    [0, 1, 2, 0, 2, 3],
  );
}

// ---------------------------------------------------------------------------
// Colours used by the ship props
// ---------------------------------------------------------------------------

export const ShipColors = {
  iron: 0x3f4245,
  ironDark: 0x2c2e31,
  ochre: 0xc28f40,
  ochreDark: 0xa8742a,
  deepRed: 0x8e2a20,
  window: 0x1b1712,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Barrel standing on y = 0. */
export function barrelKit(r = 0.3, h = 0.82, seed = 1): Kit {
  const prof: Array<[number, number]> = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    prof.push([r * (0.83 + 0.17 * Math.sin(Math.PI * t)), h * t]);
  }
  const body = lathe(prof, 10, (Math.PI * 2 * r) / TILE.grainU, h / TILE.grainV);
  tone(body, 0xf4e6d2, 0.12, seed);
  const lid = disc(r * 0.83, 10, h - 0.03);
  scaleUV(lid, r * 2, r * 2);
  tone(lid, 0xe0d0bb, 0.1, seed);
  const hoops: THREE.BufferGeometry[] = [];
  for (const t of [0.1, 0.33, 0.67, 0.9]) {
    const rr = r * (0.83 + 0.17 * Math.sin(Math.PI * t)) + 0.012;
    const hoop = new THREE.CylinderGeometry(rr, rr, 0.055, 10, 1, true);
    hoop.translate(0, h * t, 0);
    hoops.push(hoop);
  }
  const hoopGeo = tone(merge(hoops), 0x55504a, 0.1, seed);
  return [
    { m: 'wood', g: body },
    { m: 'woodDark', g: lid },
    { m: 'metal', g: hoopGeo },
  ];
}

/** Barrel lying on its side (axis along X), resting on y = 0. */
export function barrelLyingKit(r = 0.3, h = 0.82, seed = 2): Kit {
  const k = barrelKit(r, h, seed);
  const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const t = new THREE.Matrix4().makeTranslation(h / 2, r * 0.99, 0);
  return k.map(({ m: mat, g }) => {
    const c = g.clone();
    c.applyMatrix4(m);
    c.applyMatrix4(t);
    return { m: mat, g: c };
  });
}

/** Wooden crate sitting on y = 0. */
export function crateKit(w = 0.8, h = 0.75, d = 0.8, seed = 3): Kit {
  const body = plankBox(w - 0.03, h - 0.03, d - 0.03, 'x');
  // planks horizontal on all sides: U along the horizontal face axis
  const uv = body.attributes.uv as THREE.BufferAttribute;
  const pos = body.attributes.position as THREE.BufferAttribute;
  const nrm = body.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const ny = Math.abs(nrm.getY(i));
    const nx = Math.abs(nrm.getX(i));
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / TILE.plankU, pos.getZ(i) / TILE.plankV);
    else if (nx > 0.5) uv.setXY(i, pos.getZ(i) / TILE.plankU + 0.3, pos.getY(i) / TILE.plankV);
    else uv.setXY(i, pos.getX(i) / TILE.plankU + 0.6, pos.getY(i) / TILE.plankV);
  }
  body.translate(0, h / 2, 0);
  tone(body, 0xf6e8d4, 0.1, seed);
  const frame: THREE.BufferGeometry[] = [];
  for (const y of [0.05, h - 0.05]) {
    const b = box(w + 0.012, 0.1, d + 0.012, 'x');
    b.translate(0, y, 0);
    frame.push(b);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = box(0.085, h, 0.085, 'y');
      p.translate(sx * (w / 2 - 0.035), h / 2, sz * (d / 2 - 0.035));
      frame.push(p);
    }
  }
  const fr = tone(merge(frame), 0xffffff, 0.1, seed);
  return [
    { m: 'woodPlanks', g: body },
    { m: 'woodDark', g: fr },
  ];
}

/** Coiled rope lying on y = 0. */
export function coilKit(R = 0.36, seed = 4): Kit {
  const geos: THREE.BufferGeometry[] = [];
  const rings: Array<[number, number, number]> = [
    [R, 0.055, 0.055],
    [R * 0.74, 0.05, 0.13],
    [R * 0.5, 0.045, 0.19],
  ];
  for (const [rr, tr, y] of rings) {
    const t = new THREE.TorusGeometry(rr, tr, 3, 11);
    t.rotateX(Math.PI / 2);
    t.translate(0, y, 0);
    geos.push(t);
  }
  const g = tone(merge(geos), 0xf0e4cc, 0.1, seed);
  return [{ m: 'rope', g }];
}

/** Hanging/standing lantern: origin at its base, ~0.55 m tall. */
export function lanternKit(): Kit {
  const core = new THREE.CylinderGeometry(0.095, 0.095, 0.26, 6);
  core.translate(0, 0.2, 0);
  const frame: THREE.BufferGeometry[] = [];
  const cap = new THREE.ConeGeometry(0.17, 0.15, 6);
  cap.translate(0, 0.405, 0);
  frame.push(cap);
  const base = new THREE.CylinderGeometry(0.14, 0.12, 0.06, 6);
  base.translate(0, 0.04, 0);
  frame.push(base);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const bar = box(0.022, 0.3, 0.022);
    bar.translate(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12);
    frame.push(bar);
  }
  const ring = new THREE.TorusGeometry(0.05, 0.012, 3, 8);
  ring.translate(0, 0.52, 0);
  frame.push(ring);
  return [
    { m: 'emberGlow', g: core },
    { m: 'brass', g: tone(merge(frame), Palette.brass, 0.06) },
  ];
}

/** Cannon barrel along +Y (breech at y = 0, muzzle at y = len). */
export function cannonKit(len = 1.5, r = 0.14): Kit {
  const prof: Array<[number, number]> = [
    [0.001, -0.12],
    [r * 0.45, -0.07],
    [r * 1.15, 0.0],
    [r * 1.15, 0.28],
    [r * 0.98, 0.32],
    [r * 0.82, len * 0.9],
    [r * 1.08, len * 0.93],
    [r * 1.06, len],
    [r * 0.55, len],
    [r * 0.55, len - 0.2],
  ];
  const g = lathe(prof, 7);
  tone(g, ShipColors.iron, 0.12);
  return [{ m: 'metal', g }];
}

/** Ship's wheel on a pedestal standing on y = 0, wheel plane = XY (helmsman on -Z side). */
export function wheelKit(R = 0.62): Kit {
  const axleY = 1.08;
  const wood: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const rim = new THREE.TorusGeometry(R, 0.05, 5, 22);
  rim.translate(0, axleY, -0.22);
  wood.push(rim);
  const inner = new THREE.TorusGeometry(R * 0.42, 0.03, 4, 14);
  inner.translate(0, axleY, -0.22);
  wood.push(inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = box(0.05, R + 0.22, 0.05, 'y');
    s.translate(0, (R + 0.22) / 2, 0);
    s.rotateZ(a);
    s.translate(0, axleY, -0.22);
    dark.push(s);
    const knob = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 5);
    knob.translate(0, R + 0.26, 0);
    knob.rotateZ(a);
    knob.translate(0, axleY, -0.22);
    dark.push(knob);
  }
  // pedestal
  const baseB = box(0.7, 0.14, 0.55, 'x');
  baseB.translate(0, 0.07, 0.05);
  dark.push(baseB);
  for (const sx of [-1, 1]) {
    const post = box(0.13, axleY + 0.12, 0.16, 'y');
    post.translate(sx * 0.2, (axleY + 0.12) / 2, 0.05);
    wood.push(post);
  }
  const top = box(0.56, 0.12, 0.22, 'x');
  top.translate(0, axleY + 0.14, 0.05);
  dark.push(top);
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, axleY, -0.08);
  return [
    { m: 'wood', g: tone(merge(wood), 0xfff0dc, 0.08) },
    { m: 'woodDark', g: tone(merge(dark), 0xffffff, 0.08) },
    { m: 'brass', g: tone(hub, Palette.brass, 0.05) },
  ];
}

/** Admiralty anchor hanging from its ring at the origin (shank down -Y, arms in the XY plane). */
export function anchorKit(s = 1): Kit {
  const iron: THREE.BufferGeometry[] = [];
  const shankLen = 2.3 * s;
  iron.push(spar(V(0, -0.15 * s, 0), V(0, -shankLen, 0), 0.075 * s, 0.09 * s, 6, true));
  const C = V(0, -1.4 * s, 0);
  const R = 0.88 * s;
  const arc: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = THREE.MathUtils.degToRad(208 + (124 * i) / 10);
    arc.push(V(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R, 0));
  }
  iron.push(tube(arc, (t) => (0.07 + 0.03 * Math.sin(Math.PI * t)) * s, 6, { upRef: V(0, 0, 1) }));
  for (const side of [0, arc.length - 1]) {
    const tip = arc[side];
    const prev = arc[side === 0 ? 1 : arc.length - 2];
    const dir = new THREE.Vector3().subVectors(tip, prev).normalize();
    const a = tip.clone().addScaledVector(dir, -0.36 * s);
    const b = tip.clone().addScaledVector(dir, 0.12 * s);
    iron.push(beam(a, b, 0.34 * s, 0.06 * s, V(0, 0, 1)));
  }
  const ring = new THREE.TorusGeometry(0.17 * s, 0.035 * s, 4, 10);
  ring.rotateY(Math.PI / 2);
  ring.translate(0, -0.02 * s, 0);
  iron.push(ring);
  const stock = box(0.13 * s, 0.15 * s, 1.9 * s, 'z');
  stock.translate(0, -0.42 * s, 0);
  return [
    { m: 'metal', g: tone(merge(iron), ShipColors.iron, 0.1) },
    { m: 'woodDark', g: tone(stock, 0xffffff, 0.08) },
  ];
}

/** Capstan standing on y = 0. */
export function capstanKit(): Kit {
  const drum = lathe(
    [
      [0.001, 0],
      [0.46, 0],
      [0.46, 0.08],
      [0.36, 0.16],
      [0.3, 0.36],
      [0.29, 0.56],
      [0.36, 0.74],
      [0.44, 0.82],
      [0.001, 0.82],
    ],
    10,
    2,
    0.6,
  );
  const head = new THREE.CylinderGeometry(0.42, 0.44, 0.16, 10);
  head.translate(0, 0.9, 0);
  const bars: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const b = box(0.07, 0.07, 1.25, 'z');
    b.translate(0, 0.93, 0.62 + 0.3);
    b.rotateY(a);
    bars.push(b);
  }
  return [
    { m: 'wood', g: tone(drum, 0xf2e2cc, 0.1) },
    { m: 'woodDark', g: tone(head, 0xffffff, 0.06) },
    { m: 'woodPale', g: tone(merge(bars), 0xffffff, 0.08) },
  ];
}

/** Hatch with a raised coaming and a slatted grating, sitting on y = 0 (size w x d). */
export function gratingKit(w = 1.8, d = 1.6): Kit {
  const dark: THREE.BufferGeometry[] = [];
  const t = 0.14;
  const h = 0.24;
  for (const sz of [-1, 1]) {
    const b = box(w, h, t, 'x');
    b.translate(0, h / 2, sz * (d / 2 - t / 2));
    dark.push(b);
  }
  for (const sx of [-1, 1]) {
    const b = box(t, h, d - 2 * t, 'z');
    b.translate(sx * (w / 2 - t / 2), h / 2, 0);
    dark.push(b);
  }
  const hole = box(w - 2 * t, 0.04, d - 2 * t, 'x');
  hole.translate(0, 0.1, 0);
  const holeG = setRGB(hole, 0.1, 0.07, 0.05);
  const slats: THREE.BufferGeometry[] = [];
  const iw = w - 2 * t;
  const id = d - 2 * t;
  const nx = Math.max(2, Math.round(iw / 0.2));
  const nz = Math.max(2, Math.round(id / 0.2));
  for (let i = 0; i < nx; i++) {
    const x = -iw / 2 + ((i + 0.5) * iw) / nx;
    const b = box(0.055, 0.05, id, 'z');
    b.translate(x, h - 0.045, 0);
    slats.push(b);
  }
  for (let i = 0; i < nz; i++) {
    const z = -id / 2 + ((i + 0.5) * id) / nz;
    const b = box(iw, 0.045, 0.055, 'x');
    b.translate(0, h - 0.035, z);
    slats.push(b);
  }
  return [
    { m: 'woodDark', g: tone(merge(dark), 0xffffff, 0.08) },
    { m: 'woodDark', g: holeG },
    { m: 'wood', g: tone(merge(slats), 0xf0dcc0, 0.1) },
  ];
}

/**
 * Ship stairs rising along +Z from (0,0,0) to (0, rise, run), centred on x = 0.
 * `rail`: -1 / +1 adds a hand rail on that side, 0 none.
 */
export function stairsKit(width: number, rise: number, run: number, steps: number, rail: -1 | 0 | 1 = 0): Kit {
  const treads: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const sr = rise / steps;
  const sd = run / steps;
  for (let k = 0; k < steps; k++) {
    const t = plankBox(width - 0.14, 0.07, sd + 0.07, 'x');
    t.translate(0, (k + 1) * sr - 0.035, (k + 0.5) * sd + 0.02);
    treads.push(t);
  }
  for (const sx of [-1, 1]) {
    const x = sx * (width / 2 - 0.05);
    dark.push(beam(V(x, -0.1, -0.05), V(x, rise + 0.02, run + 0.05), 0.09, 0.3, V(0, 1, 0)));
  }
  if (rail !== 0) {
    const x = rail * (width / 2 - 0.04);
    const h = 0.9;
    dark.push(beam(V(x, 0, 0.12), V(x, h + 0.05, 0.12), 0.08, 0.08, V(0, 0, 1)));
    dark.push(beam(V(x, rise, run - 0.1), V(x, rise + h + 0.05, run - 0.1), 0.08, 0.08, V(0, 0, 1)));
    dark.push(beam(V(x, h, 0.05), V(x, rise + h, run), 0.07, 0.09, V(0, 1, 0)));
    const mid = beam(V(x, h * 0.5, 0.1), V(x, rise + h * 0.5, run - 0.05), 0.05, 0.05, V(0, 1, 0));
    dark.push(mid);
  }
  return [
    { m: 'woodPlanks', g: tone(merge(treads), 0xfff2e2, 0.08) },
    { m: 'woodDark', g: tone(merge(dark), 0xffffff, 0.08) },
  ];
}

/** Oar lying along +Z (handle at z = 0), blade at the far end, flat in the XZ plane. */
export function oarKit(len = 2.9): Kit {
  const shaft = spar(V(0, 0, 0), V(0, 0, len * 0.72), 0.035, 0.03, 6, true);
  const blade = box(0.17, 0.025, len * 0.3, 'z');
  blade.translate(0, 0, len * 0.84);
  const grip = spar(V(0, 0, -0.02), V(0, 0, 0.22), 0.038, 0.038, 6, true);
  return [
    { m: 'woodPale', g: tone(merge([shaft, blade]), 0xffffff, 0.06) },
    { m: 'woodDark', g: tone(grip, 0xffffff, 0.05) },
  ];
}
