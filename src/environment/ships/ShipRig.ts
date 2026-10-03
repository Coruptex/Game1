import * as THREE from 'three';
import { Palette } from '../../assets/materials/MaterialLibrary';
import { lerp } from '../../utils/math';
import { PartBin, V, type V3, beam, box, flipFaces, grid, rope, setRGB, spar, tone, tube } from './ShipKit';

/**
 * Masts, yards, sails, standing rigging and flags.
 *
 * Sail UVs: u across (0..1), v vertical with v = 1 at the head (yard) and v = 0 at the foot, so
 * the darker hem of the sail texture sits at the foot. The cloth shader ripples along the mesh
 * Z axis proportionally to uv.x, so square sails are built in the XY plane (billowing forward,
 * +Z) and furled sails use a tiny u range so they barely move.
 */

const MAST_TINT = 0xf3e4cc;
/** Tarred standing rigging (multiplies the rope material colour). */
export const RIG_DARK = 0x74624e;
const RIG_LIGHT = 0xe8dcc4;

export interface RigOpts {
  seeThrough?: boolean;
}

/** Round mast/spar segment with a darker band at the top. */
export function mastSegment(bin: PartBin, a: V3, b: V3, r0: number, r1: number, radial = 10): void {
  const g = spar(a, b, r0, r1, radial, true);
  tone(g, MAST_TINT, 0.08, a.y);
  bin.add('wood', g, { seeThrough: true });
}

/** Iron bands / wooldings around a mast. */
export function mastBands(bin: PartBin, x: number, z: number, ys: number[], r: number): void {
  const geos: THREE.BufferGeometry[] = [];
  for (const y of ys) {
    const c = new THREE.CylinderGeometry(r, r, 0.09, 10, 1, true);
    c.translate(x, y, z);
    geos.push(c);
  }
  for (const g of geos) tone(g, 0x4a4643, 0.05);
  bin.add('metal', geos, { seeThrough: true });
}

/** Tapered yard centred at c along X. */
export function yard(bin: PartBin, c: V3, half: number, r: number): void {
  for (const s of [-1, 1]) {
    const g = spar(c, V(c.x + s * half, c.y, c.z), r, r * 0.45, 7, true);
    tone(g, 0xffffff, 0.06, s);
    bin.add('woodDark', g, { seeThrough: true });
  }
  // yard-arm cleats
  const cl = box(0.08, 0.14, 0.14, 'x');
  for (const s of [-1, 1]) bin.add('woodDark', tone(cl.clone().translate(c.x + s * (half - 0.25), c.y, c.z), 0xffffff, 0), { seeThrough: true });
}

/** Mast cap / doubling block. */
export function mastCap(bin: PartBin, x: number, y: number, z0: number, z1: number, w = 0.62): void {
  const g = box(w, 0.32, Math.abs(z1 - z0) + 0.5, 'z');
  g.translate(x, y, (z0 + z1) / 2);
  bin.add('woodDark', tone(g, 0xffffff, 0.05), { seeThrough: true });
}

/** Crosstrees: two thin beams across X at the masthead. */
export function crosstrees(bin: PartBin, x: number, y: number, z: number, half: number): void {
  for (const dz of [-0.25, 0.25]) {
    bin.add('woodDark', tone(beam(V(x - half, y, z + dz), V(x + half, y, z + dz), 0.1, 0.12), 0xffffff, 0.05), { seeThrough: true });
  }
  bin.add('woodDark', tone(beam(V(x, y + 0.08, z - 0.6), V(x, y + 0.08, z + 0.6), 0.1, 0.1), 0xffffff, 0.05), { seeThrough: true });
}

/** Round crow's nest: floor, planked wall, rim and tapered support. */
export function crowsNest(bin: PartBin, c: V3, r: number, wall = 0.72): void {
  // support (trestle trees) under the floor
  const sup = new THREE.CylinderGeometry(r * 0.92, 0.36, 0.9, 10, 1, true);
  sup.translate(c.x, c.y - 0.45, c.z);
  bin.add('woodDark', tone(sup, 0xffffff, 0.06), { seeThrough: true });
  const floor = new THREE.CylinderGeometry(r, r, 0.12, 12);
  floor.translate(c.x, c.y, c.z);
  bin.add('woodPlanks', tone(floor, 0xf2e6d6, 0.06), { seeThrough: true });
  // planked wall (slightly barrel shaped), outer and inner faces
  const prof: Array<[number, number]> = [
    [r * 0.98, 0],
    [r * 1.04, wall * 0.5],
    [r * 1.0, wall],
  ];
  const wallOut = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 14);
  const uv = wallOut.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 0.35, uv.getX(i) * 3.2);
  wallOut.translate(c.x, c.y + 0.05, c.z);
  bin.add('woodPlanks', tone(wallOut, 0xf6e6d0, 0.08), { seeThrough: true });
  const wallIn = flipFaces(new THREE.CylinderGeometry(r * 0.93, r * 0.93, wall, 14, 1, true));
  wallIn.translate(c.x, c.y + 0.05 + wall / 2, c.z);
  bin.add('woodPlanks', tone(wallIn, 0xb8a890, 0.05), { seeThrough: true });
  const rim = new THREE.TorusGeometry(r * 1.0, 0.07, 4, 16);
  rim.rotateX(Math.PI / 2);
  rim.translate(c.x, c.y + 0.05 + wall, c.z);
  bin.add('woodDark', tone(rim, 0xffffff, 0.05), { seeThrough: true });
  const band = new THREE.TorusGeometry(r * 1.04, 0.045, 4, 16);
  band.rotateX(Math.PI / 2);
  band.translate(c.x, c.y + 0.05 + wall * 0.5, c.z);
  bin.add('metal', tone(band, 0x4a4643, 0.04), { seeThrough: true });
}

/** Flat fighting top (square-ish platform with a small rim). */
export function topPlatform(bin: PartBin, c: V3, w: number, d: number): void {
  const p = box(w, 0.12, d, 'z');
  p.translate(c.x, c.y, c.z);
  bin.add('woodPlanks', tone(p, 0xf2e6d6, 0.06), { seeThrough: true });
  const rim = box(w + 0.08, 0.16, 0.1, 'x');
  bin.add('woodDark', tone(rim.clone().translate(c.x, c.y + 0.12, c.z - d / 2), 0xffffff, 0.04), { seeThrough: true });
  for (const s of [-1, 1]) {
    const side = box(0.1, 0.16, d, 'z');
    bin.add('woodDark', tone(side.translate(c.x + (s * w) / 2, c.y + 0.12, c.z), 0xffffff, 0.04), { seeThrough: true });
  }
  const sup = new THREE.CylinderGeometry(0.42, 0.3, 0.7, 8, 1, true);
  sup.translate(c.x, c.y - 0.4, c.z);
  bin.add('woodDark', tone(sup, 0xffffff, 0.05), { seeThrough: true });
}

export interface SquareSail {
  yTop: number;
  yBot: number;
  halfTop: number;
  halfBot: number;
  /** z of the head (just forward of the yard). */
  z: number;
  /** Forward billow depth (m). */
  belly: number;
  x?: number;
  flip?: boolean;
  /** Patches as [u0, v0, u1, v1] rectangles. */
  patches?: Array<[number, number, number, number]>;
  tint?: number;
}

function sailPoint(s: SquareSail, u: number, v: number, out: V3): V3 {
  const half = lerp(s.halfBot, s.halfTop, v);
  const sn = Math.sin(Math.PI * u);
  const x = (s.x ?? 0) + (u * 2 - 1) * half;
  const y = lerp(s.yBot, s.yTop, v) + (1 - v) * (1 - v) * 0.32 * sn;
  const bv = Math.sin((1 - v) * Math.PI * 0.74);
  const bu = 0.2 + 0.8 * Math.pow(sn, 0.75);
  return out.set(x, y, s.z + s.belly * bu * bv);
}

/** Set square sail hanging from a yard, billowed forward (+Z). */
export function squareSail(bin: PartBin, s: SquareSail): void {
  const g = grid(7, 6, (u, v, out) => sailPoint(s, u, v, out), (u, v) => [s.flip ? 1 - u : u, v]);
  tone(g, s.tint ?? 0xfffaf2, 0.05, s.yTop);
  bin.add('sail', g, { seeThrough: true });
  for (const [u0, v0, u1, v1] of s.patches ?? []) {
    const pg = grid(2, 2, (u, v, out) => {
      sailPoint(s, lerp(u0, u1, u), lerp(v0, v1, v), out);
      out.z += 0.025;
    }, (u, v) => {
      const uu = lerp(u0, u1, u);
      return [s.flip ? 1 - uu : uu, lerp(v0, v1, v)];
    });
    tone(pg, 0xe9dcc2, 0.05);
    bin.add('sail', pg, { seeThrough: true });
  }
}

/** Sail furled on top of a yard (a lumpy bundle). */
export function furledSail(bin: PartBin, c: V3, half: number, r: number): void {
  const path: V3[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    path.push(V(c.x - half + 2 * half * t, c.y + r * 0.55 - Math.sin(Math.PI * t) * 0.05, c.z + r * 0.35));
  }
  const g = tube(
    path,
    (t) => r * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * t), 0.55)) * (0.8 + 0.2 * Math.abs(Math.sin(Math.PI * t * 7))),
    7,
    { uMax: 0.1, tv: 3 },
  );
  tone(g, 0xf8f0e2, 0.06, c.y);
  bin.add('sail', g, { seeThrough: true });
}

/**
 * Triangular fore-and-aft sail (jib / staysail / lateen). Corners: tack, clew, head.
 * `billow` is the sideways bulge vector at the sail centre.
 */
export function triSail(bin: PartBin, tack: V3, clew: V3, head: V3, billow: V3, tint = 0xfffaf2): void {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const g = grid(6, 6, (u, v, out) => {
    a.lerpVectors(tack, head, v);
    b.lerpVectors(clew, head, v);
    out.lerpVectors(a, b, u);
    const k = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1 + 0.08)) * (1 - v * 0.4);
    out.addScaledVector(billow, k);
  }, (u, v) => [u * (1 - v * 0.9), v]);
  tone(g, tint, 0.05, tack.z);
  bin.add('sail', g, { seeThrough: true });
}

/** Four-sided fore-and-aft sail (gaff sail): tack, clew, peak, throat. */
export function gaffSail(bin: PartBin, tack: V3, clew: V3, peak: V3, throat: V3, billow: V3): void {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const g = grid(7, 7, (u, v, out) => {
    a.lerpVectors(tack, throat, v);
    b.lerpVectors(clew, peak, v);
    out.lerpVectors(a, b, u);
    const k = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.12 + v * 0.8));
    out.addScaledVector(billow, k);
  }, (u, v) => [u, v]);
  tone(g, 0xfff8ee, 0.05, tack.z);
  bin.add('sail', g, { seeThrough: true });
}

/** Jolly roger: plane in local XY from the pole towards +X (uv.x = 0 at the pole). */
export function jollyRoger(bin: PartBin, pole: V3, w: number, h: number): void {
  const g = grid(8, 4, (u, v, out) => out.set(pole.x + u * w, pole.y - h + v * h - u * u * 0.12, pole.z + Math.sin(u * 4.5) * 0.1 * u), (u, v) => [u, v]);
  setRGB(g, 1, 1, 1);
  bin.add('flag', g, { seeThrough: true });
}

/** Long red pennant streaming towards +X. */
export function pennant(bin: PartBin, pole: V3, len: number, h: number): void {
  const g = grid(10, 1, (u, v, out) => {
    const w = h * (1 - u * 0.9);
    out.set(pole.x + u * len, pole.y + (v - 0.5) * w - u * u * 0.5, pole.z + Math.sin(u * 7) * 0.12 * u);
  }, (u, v) => [u, v]);
  tone(g, Palette.pirateRed, 0.08);
  bin.add('cloth', g, { seeThrough: true });
}

/** Point on segment a->b at height y (clamped). */
export function atHeight(a: V3, b: V3, y: number): V3 {
  const t = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y)));
  return new THREE.Vector3().lerpVectors(a, b, t);
}

/** Shroud fan with ratlines (rope ladder). `tops` and `feet` are paired per shroud. */
export function shroudFan(bin: PartBin, tops: V3[], feet: V3[], ratFrom: number, ratTo: number, spacing = 0.5, r = 0.034): void {
  const geos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < tops.length; k++) geos.push(rope(feet[k], tops[k], r));
  const last = tops.length - 1;
  for (let y = ratFrom; y <= ratTo; y += spacing) {
    const a = atHeight(feet[0], tops[0], y);
    const b = atHeight(feet[last], tops[last], y);
    a.addScaledVector(new THREE.Vector3().subVectors(a, b).normalize(), 0.03);
    b.addScaledVector(new THREE.Vector3().subVectors(b, a).normalize(), 0.03);
    geos.push(rope(a, b, r * 0.62));
  }
  for (const g of geos) tone(g, RIG_DARK, 0.06);
  bin.add('rope', geos, { castShadow: false });
}

/** Stays, backstays and other single lines. */
export function line(bin: PartBin, a: V3, b: V3, r = 0.035, sag = 0, dark = true): void {
  const g = rope(a, b, r, sag, sag > 0 ? 8 : 6);
  tone(g, dark ? RIG_DARK : RIG_LIGHT, 0.05);
  bin.add('rope', g, { castShadow: false });
}

/** Deadeye block at a shroud foot. */
export function deadeye(bin: PartBin, p: V3, side: number): void {
  const g = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 6);
  g.rotateZ(Math.PI / 2);
  g.translate(p.x + side * 0.02, p.y + 0.08, p.z);
  bin.add('woodDark', setRGB(g, 0.55, 0.5, 0.45));
}
