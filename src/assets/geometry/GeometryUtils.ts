import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from '../../utils/noise';
import type { Rng } from '../../utils/random';

/**
 * Geometry helpers used by the procedural asset builders.
 * Convention: every environment geometry carries `position`, `normal`, `uv` and `color`
 * attributes and an index, so they can be merged by the StaticBatcher.
 */

const tmpColor = new THREE.Color();
const noise = new Noise2D(4242);

/** Adds missing `color` (white) / `uv` attributes and an index so geometries can be merged. */
export function ensureStandardAttributes(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geo.attributes.position.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  if (!geo.attributes.color) {
    const c = new Float32Array(count * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (!geo.index) {
    const idx = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  // Drop attributes that would make merging fail.
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') geo.deleteAttribute(name);
  }
  geo.morphAttributes = {};
  return geo;
}

/** Fills the colour attribute with a single colour (multiplied with existing values if `multiply`). */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, multiply = false): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  tmpColor.set(color);
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < c.count; i++) {
    if (multiply) c.setXYZ(i, c.getX(i) * tmpColor.r, c.getY(i) * tmpColor.g, c.getZ(i) * tmpColor.b);
    else c.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }
  c.needsUpdate = true;
  return geo;
}

/** Vertical colour gradient between two colours over [minY, maxY] (in geometry space). */
export function paintGradientY(
  geo: THREE.BufferGeometry,
  bottom: THREE.ColorRepresentation,
  top: THREE.ColorRepresentation,
  minY?: number,
  maxY?: number,
): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const y0 = minY ?? bb.min.y;
  const y1 = maxY ?? bb.max.y;
  const cb = new THREE.Color(bottom);
  const ct = new THREE.Color(top);
  const pos = geo.attributes.position;
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / Math.max(1e-5, y1 - y0), 0, 1);
    tmpColor.copy(cb).lerp(ct, t);
    c.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }
  c.needsUpdate = true;
  return geo;
}

/** Darkens vertices close to the bottom of the geometry (fake ground contact occlusion). */
export function bakeGroundAO(geo: THREE.BufferGeometry, height: number, strength = 0.45, baseY?: number): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  geo.computeBoundingBox();
  const y0 = baseY ?? geo.boundingBox!.min.y;
  const pos = geo.attributes.position;
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / height, 0, 1);
    const f = 1 - strength * (1 - t) * (1 - t);
    c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f);
  }
  c.needsUpdate = true;
  return geo;
}

/** Random per-vertex brightness / hue jitter, based on position so seams stay consistent. */
export function jitterColors(geo: THREE.BufferGeometry, amount: number, scale = 1.7, seed = 0): THREE.BufferGeometry {
  ensureStandardAttributes(geo);
  const pos = geo.attributes.position;
  const c = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * scale + seed;
    const y = pos.getY(i) * scale;
    const z = pos.getZ(i) * scale - seed;
    const n = (noise.noise(x, z) + noise.noise(y + 31.7, x - 11.3)) * 0.5;
    const f = 1 + n * amount;
    c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f);
  }
  c.needsUpdate = true;
  return geo;
}

/** Displaces vertices with smooth noise (organic rocks, roots, blobs). */
export function displace(geo: THREE.BufferGeometry, amount: number, frequency = 0.8, seed = 0): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = frequency;
    const dx = noise.noise(y * f + seed, z * f - seed) * amount;
    const dy = noise.noise(z * f + 17.1 + seed, x * f) * amount;
    const dz = noise.noise(x * f - 9.3, y * f + seed) * amount;
    pos.setXYZ(i, x + dx, y + dy, z + dz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Replaces normals with normalised (vertex - center): gives foliage blobs a soft, cloud-like shading. */
export function sphericalNormals(geo: THREE.BufferGeometry, center = new THREE.Vector3(), blend = 1): THREE.BufferGeometry {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center).normalize();
    n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    n.lerp(v, blend).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  return geo;
}

/** Converts to a non-indexed, flat-shaded geometry (faceted rocks, cut stone). */
export function flatShaded(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

export function transformed(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(m);
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Builds a TRS matrix (Euler XYZ in radians, uniform or per-axis scale). */
export function trs(
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = sx,
  sz = sx,
  out = new THREE.Matrix4(),
): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _p.set(x, y, z);
  return out.compose(_p, _q, _s);
}

/** Clone + transform in one call. */
export function place(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = sx,
  sz = sx,
): THREE.BufferGeometry {
  return transformed(geo, trs(x, y, z, rx, ry, rz, sx, sy, sz, _m));
}

/** Merges geometries after normalising their attribute sets. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => ensureStandardAttributes(g));
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error('mergeGeometries failed (attribute mismatch)');
  return merged;
}

/** Cylinder segment between two points (rope, beams, branches). */
export function cylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radiusA: number,
  radiusB = radiusA,
  radial = 6,
): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(radiusB, radiusA, len, radial, 1, false);
  geo.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(m);
  return geo;
}

/** A sagging rope (catenary-ish) tube between two points. */
export function ropeBetween(a: THREE.Vector3, b: THREE.Vector3, sag: number, radius = 0.03, segments = 10): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segments, radius, 4, false);
}

/** Irregular rock: displaced icosahedron, flattened a bit, flat shaded for chunky facets. */
export function rockGeometry(rng: Rng, radius = 1, detail = 1, squash = 0.7): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail);
  g = displace(g, radius * 0.28, 1.2 / radius, rng.range(0, 100));
  g.scale(rng.range(0.9, 1.25), squash * rng.range(0.85, 1.15), rng.range(0.9, 1.2));
  g = flatShaded(g);
  return g;
}
