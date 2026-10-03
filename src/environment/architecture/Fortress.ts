import * as THREE from 'three';
import type { PropDefinition } from '../PropTypes';
import { Palette } from '../../assets/materials/MaterialLibrary';
import { Rng } from '../../utils/random';
import {
  MeshBuilder,
  PartBin,
  PointedArch,
  boxAt,
  boxUV,
  cylUV,
  dropFaces,
  mossClump,
  shade,
  stripWall,
  type Vec3,
} from './StoneKit';

/**
 * The distant pirate-occupied fortress on the mountain spur (seen from 120-250 m away).
 * Ancient stepped stonework of the Ember Kings re-used by pirates: curtain walls with
 * crenellations, round towers with conical red roofs, square towers, a central keep on a stepped
 * base with corner turrets, a tall watch tower, a gatehouse facing +Z, cannons, black jolly-roger
 * flags, red pennants/banners and glowing windows. Base at y = 0 (flattened plateau); rock
 * foundations reach down to y = -14 so the walls never float on a falling slope.
 * Silhouette first: few, chunky shapes. ~70 x 45 m footprint. No colliders.
 */

const TILE = 6.0; // 1 m courses at distance
const WALL_H = 9.5;
const WALL_T = 2.6;

const STONE_TINT = 0xfff4e4;
const STONE_DARK = 0xd8cdb9;
const MOSS_TINT = 0x9fb86a;
const ROOF = [0x8a3a26, 0x7a3322, 0x93432a];
const WOOD = 0x6b4a30;

type TowerKind = 'round' | 'square' | 'gate' | 'turret';
interface TowerSpec {
  x: number;
  z: number;
  kind: TowerKind;
  r: number;
  h: number;
}

/** Outline of the curtain wall (towers at the vertices), clockwise seen from above. */
const OUTLINE: TowerSpec[] = [
  { x: -27, z: 15, kind: 'round', r: 5, h: 17 },
  { x: -6.2, z: 19.5, kind: 'gate', r: 3.2, h: 13.5 },
  { x: 6.2, z: 19.5, kind: 'gate', r: 3.2, h: 13.5 },
  { x: 28, z: 13, kind: 'round', r: 4.5, h: 15.5 },
  { x: 30, z: -13.5, kind: 'square', r: 4.4, h: 18 },
  { x: 6, z: -19.5, kind: 'turret', r: 3, h: 12 },
  { x: -28, z: -16, kind: 'round', r: 5.4, h: 16.5 },
  { x: -32.5, z: -1, kind: 'turret', r: 3.2, h: 12.5 },
];

function stoneShade(g: THREE.BufferGeometry, seed: number, top: number, baseY = 0, tint: THREE.ColorRepresentation = STONE_TINT): THREE.BufferGeometry {
  return shade(g, {
    base: tint,
    vary: 0.14,
    varyScale: 0.18,
    moss: MOSS_TINT,
    mossAmount: 0.7,
    mossCreep: 1.6,
    creepTop: top,
    dirt: 0.3,
    dirtHeight: 5,
    baseY,
    dampGreen: 0.15,
    seed,
  });
}

function rockShade(g: THREE.BufferGeometry, seed: number, top: number): THREE.BufferGeometry {
  return shade(g, {
    base: 0x9a9282,
    vary: 0.2,
    varyScale: 0.12,
    moss: 0x6d8a3c,
    mossAmount: 0.8,
    mossUp: 0.35,
    mossCreep: 3,
    creepTop: top,
    dirt: 0.35,
    dirtHeight: 12,
    baseY: -14,
    seed,
  });
}

/** Box (bottom at y0) with world-scale block UVs and shading, rotated by `ry` about its centre. */
function block(bin: PartBin, w: number, h: number, d: number, x: number, y0: number, z: number, ry: number, seed: number, segY = 1): void {
  const g = boxAt(w, h, d, 0, y0, 0, 1, segY, 1);
  boxUV(g, TILE, (seed * 0.37) % 1, 0);
  stoneShade(g, seed, y0 + h);
  g.rotateY(ry);
  g.translate(x, 0, z);
  bin.add('stoneBlocks', g);
}

/** Merlons along a line (local frame of a wall: along +X, at local z offset). */
function merlons(bin: PartBin, x0: number, x1: number, y: number, zOff: number, cx: number, cz: number, ry: number, seed: number, mw = 1.3, gap = 1.0): void {
  const len = x1 - x0;
  const n = Math.max(1, Math.floor((len + gap) / (mw + gap)));
  const used = n * mw + (n - 1) * gap;
  const start = x0 + (len - used) / 2;
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const g = boxAt(mw, 1.35, 0.75, start + i * (mw + gap) + mw / 2, y, zOff, 1, 1, 1);
    geos.push(dropFaces(g, [0, -1, 0]));
  }
  for (const g of geos) {
    boxUV(g, TILE, (seed * 0.21) % 1, 0);
    stoneShade(g, seed, y + 1.35);
    g.rotateY(ry);
    g.translate(cx, 0, cz);
    bin.add('stoneBlocks', g);
  }
}

/** Glowing window quad facing `dir` (unit XZ), centred at (x, y, z). */
function windowAt(mb: MeshBuilder, x: number, y: number, z: number, dx: number, dz: number, w = 0.9, h = 1.5): void {
  const px = -dz * (w / 2);
  const pz = dx * (w / 2);
  const ox = dx * 0.08;
  const oz = dz * 0.08;
  const hint: Vec3 = [dx, 0, dz];
  mb.quad([x - px + ox, y - h / 2, z - pz + oz], [x + px + ox, y - h / 2, z + pz + oz], [x + px + ox, y + h / 2 - w * 0.2, z + pz + oz], [x - px + ox, y + h / 2 - w * 0.2, z - pz + oz], hint);
  // pointed top
  mb.tri([x - px + ox, y + h / 2 - w * 0.2, z - pz + oz], [x + px + ox, y + h / 2 - w * 0.2, z + pz + oz], [x + ox, y + h / 2 + w * 0.15, z + oz], hint);
}

/** Flag on a pole: 'flag' (black jolly roger) or a red pennant ('cloth'); uv.x = 0 at the pole edge. */
function flagpole(bin: PartBin, x: number, y: number, z: number, poleH: number, size: number, black: boolean, dir = 1): void {
  const pole = new THREE.CylinderGeometry(0.09 * size, 0.12 * size, poleH, 5, 1);
  pole.translate(x, y + poleH / 2, z);
  shade(pole, { base: WOOD, vary: 0.1 });
  bin.add('vertexColor', pole);
  const knob = new THREE.SphereGeometry(0.2 * size, 6, 4);
  knob.translate(x, y + poleH + 0.1, z);
  shade(knob, { base: Palette.gold, vary: 0.05 });
  bin.add('vertexColor', knob);
  const fw = 3.0 * size;
  const fh = 2.0 * size;
  if (black) {
    const f = new THREE.PlaneGeometry(fw, fh, 10, 3);
    f.translate(fw / 2, 0, 0);
    if (dir < 0) {
      f.rotateY(Math.PI);
    }
    f.translate(x + 0.1 * dir, y + poleH - fh / 2 - 0.15, z);
    bin.add('flag', f, { castShadow: false });
  } else {
    // swallow-tailed red pennant
    const mb = new MeshBuilder();
    const segs = 6;
    const pts: Vec3[][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const half = (fh / 2) * (1 - t * 0.55);
      pts.push([
        [t * fw * dir, half, 0],
        [t * fw * dir, -half, 0],
      ]);
    }
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (i === segs - 1) {
        // swallow tail notch
        const m: Vec3 = [(b[0][0] + a[0][0]) / 2 + 0.2 * fw * dir * 0.5, 0, 0];
        mb.tri(a[0], b[0], m, [0, 0, 1]);
        mb.tri(a[1], m, b[1], [0, 0, 1]);
        mb.tri(a[0], m, a[1], [0, 0, 1]);
      } else mb.quad(a[0], b[0], b[1], a[1], [0, 0, 1]);
    }
    const g = mb.build();
    const p = g.attributes.position;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, Math.abs(p.getX(i)) / fw, p.getY(i) / fh + 0.5);
    shade(g, { base: Palette.pirateRed, vary: 0.12, varyScale: 1.5 });
    g.translate(x + 0.1 * dir, y + poleH - fh / 2 - 0.15, z);
    bin.add('cloth', g, { castShadow: false });
  }
}

/** Hanging red banner on a wall face (top edge at y, facing dir). uv.x = 0 along the top edge. */
function banner(bin: PartBin, x: number, y: number, z: number, dx: number, dz: number, w: number, h: number): void {
  const mb = new MeshBuilder();
  const px = -dz;
  const pz = dx;
  const off = 0.25;
  const rows = 4;
  for (let i = 0; i < rows; i++) {
    const y0 = y - (h * i) / rows;
    const y1 = y - (h * (i + 1)) / rows;
    const tip = i === rows - 1;
    const a: Vec3 = [x - px * w / 2 + dx * off, y0, z - pz * w / 2 + dz * off];
    const b: Vec3 = [x + px * w / 2 + dx * off, y0, z + pz * w / 2 + dz * off];
    const c: Vec3 = [x + px * w / 2 + dx * off, y1, z + pz * w / 2 + dz * off];
    const d: Vec3 = [x - px * w / 2 + dx * off, y1, z - pz * w / 2 + dz * off];
    if (tip) {
      const m: Vec3 = [x + dx * off, y1 + h * 0.12, z + dz * off];
      mb.tri(a, b, c, [dx, 0, dz]);
      mb.tri(a, c, m, [dx, 0, dz]);
      mb.tri(a, m, d, [dx, 0, dz]);
    } else mb.quad(a, b, c, d, [dx, 0, dz]);
  }
  const g = mb.build();
  const p = g.attributes.position;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (y - p.getY(i)) / h, 0.5);
  shade(g, { base: Palette.pirateRed, vary: 0.1, varyScale: 1.2 });
  const col = g.attributes.color as THREE.BufferAttribute;
  // golden ember-sun stripe near the top
  for (let i = 0; i < p.count; i++) {
    const t = (y - p.getY(i)) / h;
    if (t > 0.15 && t < 0.3) col.setXYZ(i, col.getX(i) * 1.6, col.getY(i) * 2.2, col.getZ(i) * 1.1);
  }
  bin.add('cloth', g, { castShadow: false });
}

function cannon(bin: PartBin, x: number, y: number, z: number, ry: number): void {
  const barrel = new THREE.CylinderGeometry(0.24, 0.34, 2.6, 8, 1);
  barrel.rotateX(Math.PI / 2 - 0.08);
  barrel.translate(0, 0.75, 0.9);
  const muzzle = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 8, 1);
  muzzle.rotateX(Math.PI / 2 - 0.08);
  muzzle.translate(0, 0.84, 2.15);
  for (const g of [barrel, muzzle]) {
    shade(g, { base: 0x3f3d3a, vary: 0.1 });
    g.rotateY(ry);
    g.translate(x, y, z);
    bin.add('metal', g);
  }
  const carriage = boxAt(1.0, 0.6, 1.6, 0, 0, 0.3, 1, 1, 1);
  shade(carriage, { base: WOOD, vary: 0.12 });
  carriage.rotateY(ry);
  carriage.translate(x, y, z);
  bin.add('vertexColor', carriage);
}

/** Conical roof (red tiles) with eaves; base at y. */
function cone(bin: PartBin, x: number, y: number, z: number, r: number, h: number, seed: number, seg = 16): void {
  const g = new THREE.ConeGeometry(r, h, seg, 3, true);
  g.translate(x, y + h / 2, z);
  shade(g, { base: ROOF[seed % ROOF.length], vary: 0.14, varyScale: 0.5, moss: 0x6a7a3a, mossAmount: 0.25, mossUp: 0.6, dirt: 0.25, dirtHeight: h * 0.5, baseY: y, seed });
  bin.add('vertexColor', g);
}

function pyramidRoof(bin: PartBin, x: number, y: number, z: number, w: number, d: number, h: number, seed: number): void {
  const g = new THREE.ConeGeometry(Math.SQRT1_2 * 1.0, 1, 4, 1, true);
  g.rotateY(Math.PI / 4);
  g.scale(w, h, d);
  g.translate(x, y + h / 2, z);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  shade(flat, { base: ROOF[(seed + 1) % ROOF.length], vary: 0.1, varyScale: 0.5, dirt: 0.2, dirtHeight: h * 0.5, baseY: y, seed });
  bin.add('vertexColor', flat);
}

function roundTower(bin: PartBin, glow: MeshBuilder, rng: Rng, t: TowerSpec, seed: number, roofed: boolean): void {
  const { x, z, r, h } = t;
  const seg = 18;
  const body = new THREE.CylinderGeometry(r, r * 1.07, h, seg, 3, true);
  body.translate(x, h / 2, z);
  const bodyG = cylUV(body, TILE, r, x, z);
  stoneShade(bodyG, seed, h);
  bin.add('stoneBlocks', bodyG);
  // string course
  const sc = new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.6, seg, 1, true);
  sc.translate(x, h * 0.55, z);
  const scG = cylUV(sc, TILE, r, x, z);
  stoneShade(scG, seed + 1, h * 0.55 + 0.6, 0, STONE_DARK);
  bin.add('stoneBlocks', scG);
  // corbel ring (machicolations) + parapet + merlons
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const g = boxAt(0.55, 1.0, 0.9, 0, h - 1.0, 0, 1, 1, 1);
    g.translate(0, 0, r + 0.25);
    g.rotateY(Math.PI / 2 - a);
    g.translate(x, 0, z);
    stoneShade(g, seed + i, h, 0, STONE_DARK);
    bin.add('stoneBlocks', g);
  }
  const par = new THREE.CylinderGeometry(r + 0.6, r + 0.6, 1.3, seg, 1, true);
  par.translate(x, h + 0.65, z);
  const parG = cylUV(par, TILE, r + 0.6, x, z);
  stoneShade(parG, seed + 2, h + 1.3);
  bin.add('stoneBlocks', parG);
  const ring = new THREE.RingGeometry(r - 0.2, r + 0.6, seg, 1);
  ring.rotateX(-Math.PI / 2);
  ring.translate(x, h + 1.3, z);
  shade(ring, { base: 0xc5bba6, vary: 0.1, moss: MOSS_TINT, mossAmount: 0.5, seed });
  bin.add('vertexColor', ring);
  const nm = Math.round(seg * 0.75);
  for (let i = 0; i < nm; i++) {
    const a = ((i + 0.5) / nm) * Math.PI * 2;
    const g = boxAt(1.1, 1.2, 0.6, 0, h + 1.3, 0, 1, 1, 1);
    g.translate(0, 0, r + 0.32);
    g.rotateY(Math.PI / 2 - a);
    g.translate(x, 0, z);
    boxUV(g, TILE, 0, 0);
    stoneShade(g, seed + 40 + i, h + 2.5);
    bin.add('stoneBlocks', g);
  }
  if (roofed) {
    const rh = r * 1.55;
    cone(bin, x, h + 1.0, z, r + 0.35, rh, seed);
    flagpole(bin, x, h + 1.0 + rh - 0.3, z, 3.2, 0.75, rng.chance(0.5), rng.sign());
  } else {
    flagpole(bin, x + r * 0.5, h + 1.3, z, 5, 0.8, false, 1);
  }
  // window slits (glowing) facing outwards, mostly towards +Z
  const nWin = 5;
  for (let i = 0; i < nWin; i++) {
    const a = Math.PI / 2 + (i - (nWin - 1) / 2) * 0.55 + rng.range(-0.1, 0.1);
    const yy = rng.range(h * 0.3, h * 0.85);
    windowAt(glow, x + Math.cos(a) * (r + 0.02), yy, z + Math.sin(a) * (r + 0.02), Math.cos(a), Math.sin(a), 0.7, 1.4);
  }
}

function squareTower(bin: PartBin, glow: MeshBuilder, rng: Rng, x: number, z: number, w: number, d: number, h: number, seed: number, opts: { turrets?: boolean; roof?: boolean; windowsFront?: number } = {}): void {
  const body = boxAt(w, h, d, x, 0, z, 1, 3, 1);
  boxUV(body, TILE, (seed * 0.3) % 1, 0);
  stoneShade(body, seed, h);
  bin.add('stoneBlocks', body);
  const sc = boxAt(w + 0.5, 0.6, d + 0.5, x, h * 0.6, z, 1, 1, 1);
  boxUV(sc, TILE, 0, 0);
  stoneShade(sc, seed + 1, h * 0.6 + 0.6, 0, STONE_DARK);
  bin.add('stoneBlocks', sc);
  // corbelled parapet
  const par = boxAt(w + 1.0, 1.4, d + 1.0, x, h - 0.6, z, 1, 1, 1);
  boxUV(par, TILE, 0, 0);
  stoneShade(par, seed + 2, h + 0.8, 0, STONE_DARK);
  bin.add('stoneBlocks', par);
  for (const [ry, len, off] of [
    [0, w + 1.0, d / 2 + 0.5],
    [Math.PI, w + 1.0, d / 2 + 0.5],
    [Math.PI / 2, d + 1.0, w / 2 + 0.5],
    [-Math.PI / 2, d + 1.0, w / 2 + 0.5],
  ] as const) {
    merlons(bin, -len / 2 + 0.2, len / 2 - 0.2, h + 0.8, off - 0.38, x, z, ry, seed + ry * 10, 1.1, 0.8);
  }
  if (opts.turrets) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const tx = x + sx * (w / 2 + 0.3);
      const tz = z + sz * (d / 2 + 0.3);
      const tb = new THREE.CylinderGeometry(1.3, 0.6, 3.2, 10, 1, true);
      tb.translate(tx, h + 1.0, tz);
      const tbG = cylUV(tb, TILE, 1.2, tx, tz);
      stoneShade(tbG, seed + sx * 3 + sz, h + 2.6);
      bin.add('stoneBlocks', tbG);
      cone(bin, tx, h + 2.6, tz, 1.6, 3.4, seed + sx + sz * 2, 10);
    }
  }
  if (opts.roof) pyramidRoof(bin, x, h + 0.9, z, w + 0.4, d + 0.4, w * 0.85, seed);
  const nw = opts.windowsFront ?? 2;
  for (let i = 0; i < nw; i++) {
    const wx = x + (i - (nw - 1) / 2) * (w / (nw + 0.5));
    for (const yy of [h * 0.42, h * 0.78]) windowAt(glow, wx, yy + rng.range(-0.3, 0.3), z + d / 2 + 0.02, 0, 1, 0.8, 1.5);
  }
  windowAt(glow, x + w / 2 + 0.02, h * 0.7, z + rng.range(-d / 4, d / 4), 1, 0, 0.7, 1.3);
  windowAt(glow, x - w / 2 - 0.02, h * 0.5, z + rng.range(-d / 4, d / 4), -1, 0, 0.7, 1.3);
}

function offsetPolygon(pts: Array<[number, number]>, d: number): Array<[number, number]> {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % n];
    area += x0 * z1 - x1 * z0;
  }
  const s = area > 0 ? 1 : -1;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const [xp, zp] = pts[(i - 1 + n) % n];
    const [x0, z0] = pts[i];
    const [xn, zn] = pts[(i + 1) % n];
    const e1 = [x0 - xp, z0 - zp];
    const e2 = [xn - x0, zn - z0];
    const l1 = Math.hypot(e1[0], e1[1]);
    const l2 = Math.hypot(e2[0], e2[1]);
    const n1 = [(s * e1[1]) / l1, (-s * e1[0]) / l1];
    const n2 = [(s * e2[1]) / l2, (-s * e2[0]) / l2];
    let bx = n1[0] + n2[0];
    let bz = n1[1] + n2[1];
    const bl = Math.hypot(bx, bz) || 1;
    bx /= bl;
    bz /= bl;
    const k = d / Math.max(0.3, bx * n1[0] + bz * n1[1]);
    out.push([x0 + bx * k, z0 + bz * k]);
  }
  return out;
}

/** Battered rock foundation: side faces between two offset rings of the outline. */
function foundation(bin: PartBin, pts: Array<[number, number]>, yTop: number, yBot: number, dTop: number, dBot: number, seed: number): void {
  const top = offsetPolygon(pts, dTop);
  const bot = offsetPolygon(pts, dBot);
  const mb = new MeshBuilder();
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of pts) {
    cx += x / n;
    cz += z / n;
  }
  const levels = 3;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let k = 0; k < levels; k++) {
      const t0 = k / levels;
      const t1 = (k + 1) / levels;
      const lerpP = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const a0 = lerpP(top[i], bot[i], t0);
      const b0 = lerpP(top[j], bot[j], t0);
      const a1 = lerpP(top[i], bot[i], t1);
      const b1 = lerpP(top[j], bot[j], t1);
      const y0 = yTop + (yBot - yTop) * t0;
      const y1 = yTop + (yBot - yTop) * t1;
      const mx = (a0[0] + b0[0]) / 2 - cx;
      const mz = (a0[1] + b0[1]) / 2 - cz;
      mb.quad([a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], [mx, 0.2, mz]);
    }
  }
  const g = mb.build();
  // lumpy rock: push vertices outward with noise
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > yTop - 0.1) continue;
    const x = p.getX(i);
    const z = p.getZ(i);
    const dx = x - cx;
    const dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    const k = (Math.sin(x * 0.35 + seed) * Math.cos(z * 0.41 - y * 0.3) + Math.sin(y * 0.5 + x * 0.2)) * 0.9;
    p.setXYZ(i, x + (dx / l) * k, y, z + (dz / l) * k);
  }
  g.computeVertexNormals();
  boxUV(g, 8, 0, 0);
  rockShade(g, seed, yTop);
  bin.add('rock', g);
}

/**
 * Distant pirate fortress (~70 x 45 m footprint, keep ~24 m, watch tower ~40 m with flag).
 * Front (gatehouse) faces +Z.
 */
export function buildFortress(): PropDefinition {
  const rng = new Rng(4646);
  const bin = new PartBin();
  const glow = new MeshBuilder();
  const pts = OUTLINE.map((t): [number, number] => [t.x, t.z]);

  // ---- plateau platform + rock foundations ------------------------------------------------------------
  foundation(bin, pts, 1.2, -14, 1.6, 7.5, 1);
  for (const t of OUTLINE) {
    if (t.kind === 'gate') continue;
    const r = t.kind === 'square' ? t.r * 1.45 : t.r;
    const fnd = new THREE.CylinderGeometry(r * 1.12, r * 1.75, 15.2, 12, 2, true);
    fnd.translate(t.x, 1.2 - 7.6, t.z);
    const g = cylUV(fnd, 8, r, t.x, t.z);
    rockShade(g, t.x, 1.2);
    bin.add('rock', g);
  }
  // courtyard floor
  {
    const inner = offsetPolygon(pts, -1.0);
    const mb = new MeshBuilder();
    let cx = 0;
    let cz = 0;
    for (const [x, z] of inner) {
      cx += x / inner.length;
      cz += z / inner.length;
    }
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      mb.tri([cx, 0.25, cz], [inner[i][0], 0.25, inner[i][1]], [inner[j][0], 0.25, inner[j][1]], [0, 1, 0]);
    }
    const floor = mb.build();
    shade(floor, { base: 0xa39a84, vary: 0.2, varyScale: 0.15, moss: 0x6f8a3f, mossAmount: 0.35, mossUp: 0.9, seed: 3 });
    bin.add('vertexColor', floor, { castShadow: false });
  }

  // ---- curtain walls ---------------------------------------------------------------------------------
  let ccx = 0;
  let ccz = 0;
  for (const [x, z] of pts) {
    ccx += x / pts.length;
    ccz += z / pts.length;
  }
  for (let i = 0; i < OUTLINE.length; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % OUTLINE.length];
    if (a.kind === 'gate' && b.kind === 'gate') continue; // gate block between the gate towers
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const ry = -ang;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    // local +Z after rotation = (-sin ang, cos ang): pick the outward side
    const px = -Math.sin(ang);
    const pz = Math.cos(ang);
    const outward = (mx - ccx) * px + (mz - ccz) * pz > 0 ? 1 : -1;
    const wl = len - (a.r + b.r) * 0.6;
    const wall = boxAt(wl + 1.0, WALL_H, WALL_T, 0, 0, 0, 2, 3, 1);
    boxUV(wall, TILE, (i * 0.37) % 1, 0);
    stoneShade(wall, 10 + i, WALL_H);
    wall.rotateY(ry);
    wall.translate(mx, 0, mz);
    bin.add('stoneBlocks', wall);
    // battered base
    const bat = boxAt(wl + 1.4, 2.2, WALL_T + 1.4, 0, 0, 0, 1, 1, 1);
    const batG = dropFaces(bat, [0, -1, 0]);
    boxUV(batG, TILE, 0, 0);
    stoneShade(batG, 20 + i, 2.2, 0, STONE_DARK);
    batG.rotateY(ry);
    batG.translate(mx, 0, mz);
    bin.add('stoneBlocks', batG);
    // outer crenellations + low inner parapet
    merlons(bin, -wl / 2, wl / 2, WALL_H, outward * (WALL_T / 2 - 0.38), mx, mz, ry, 30 + i);
    const inner = boxAt(wl, 0.7, 0.5, 0, WALL_H, -outward * (WALL_T / 2 - 0.25), 1, 1, 1);
    boxUV(inner, TILE, 0, 0);
    stoneShade(inner, 40 + i, WALL_H + 0.7);
    inner.rotateY(ry);
    inner.translate(mx, 0, mz);
    bin.add('stoneBlocks', inner);
    // braziers / lanterns on the wall-walk
    for (let k = 0; k < 2; k++) {
      const t = (k + 1) / 3;
      const bx = a.x + dx * t;
      const bz = a.z + dz * t;
      const lamp = new THREE.IcosahedronGeometry(0.35, 0);
      lamp.translate(bx, WALL_H + 0.6, bz);
      bin.add('emberGlow', lamp, { castShadow: false });
    }
    // moss cushions on the wall-walk
    for (let k = 0; k < Math.floor(wl / 8); k++) {
      const t = rng.range(0.1, 0.9);
      const m = mossClump(rng, rng.range(1.2, 2.2), 1.2, 0.35, 0);
      m.translate(a.x + dx * t - px * outward * 0.4, WALL_H, a.z + dz * t - pz * outward * 0.4);
      bin.add('vertexColor', m, { castShadow: false });
    }
    // cannons on the front walls
    if (a.z > 5 && b.z > 5) {
      for (const t of [0.3, 0.7]) {
        const cx = a.x + dx * t;
        const cz = a.z + dz * t;
        cannon(bin, cx - px * outward * 0.2, WALL_H, cz - pz * outward * 0.2, outward > 0 ? ry : ry + Math.PI);
      }
    }
  }

  // ---- towers ------------------------------------------------------------------------------------------
  OUTLINE.forEach((t, i) => {
    if (t.kind === 'round') roundTower(bin, glow, rng, t, 100 + i * 10, true);
    else if (t.kind === 'turret') roundTower(bin, glow, rng, t, 100 + i * 10, i % 2 === 1);
    else if (t.kind === 'square') {
      squareTower(bin, glow, rng, t.x, t.z, t.r * 2, t.r * 2, t.h, 200 + i, { turrets: true });
      // pirate lookout hut (wood + thatch) on top
      const hut = boxAt(3.2, 2.4, 3.2, t.x - 1.2, t.h + 1.3, t.z + 1.0, 1, 1, 1);
      shade(hut, { base: WOOD, vary: 0.15 });
      bin.add('vertexColor', hut);
      const roof = new THREE.ConeGeometry(2.9, 2.2, 4, 1, true);
      roof.rotateY(Math.PI / 4);
      roof.translate(t.x - 1.2, t.h + 3.7 + 1.1, t.z + 1.0);
      boxUV(roof, 2, 0, 0);
      shade(roof, { base: 0xb5a58a, vary: 0.1 });
      bin.add('thatch', roof);
      flagpole(bin, t.x + 2.5, t.h + 1.3, t.z - 2.5, 6, 1.0, true, 1);
    }
  });

  // ---- gatehouse (two square towers + arched gate block) -------------------------------------------------
  const gz = OUTLINE[1].z;
  for (const side of [-1, 1]) squareTower(bin, glow, rng, side * 6.2, gz, 6.0, 7.0, 13.5, 300 + side, { windowsFront: 1 });
  {
    const arch = new PointedArch(2.1, 3.6, 3.0);
    const gw = stripWall({
      tops: [{ x0: -3.3, x1: 3.3, y: 11.2 }],
      z0: gz - 3.0,
      z1: gz + 3.0,
      bottom: (x) => (Math.abs(x) < arch.a ? arch.heightAt(x) : 0),
      breaks: [-arch.a, arch.a, -1.4, 1.4, -0.7, 0.7],
      stripW: 0.6,
      capLeft: false,
      capRight: false,
    });
    boxUV(gw, TILE, 0.3, 0);
    stoneShade(gw, 310, 11.2);
    bin.add('stoneBlocks', gw);
    merlons(bin, -3.3, 3.3, 11.2, 2.6, 0, gz, 0, 311, 1.1, 0.8);
    // dark timber gate + iron portcullis inside the arch
    const door = new MeshBuilder();
    const n = 10;
    for (let i = 0; i < n; i++) {
      const x0 = -arch.a + (i / n) * arch.a * 2;
      const x1 = -arch.a + ((i + 1) / n) * arch.a * 2;
      const y0a = arch.heightAt(x0 + 1e-3);
      const y0b = arch.heightAt(x1 - 1e-3);
      door.quad([x0, 0, gz + 0.5], [x1, 0, gz + 0.5], [x1, y0b, gz + 0.5], [x0, y0a, gz + 0.5], [0, 0, 1]);
    }
    const doorG = door.build();
    shade(doorG, { base: 0x3a2a1c, vary: 0.2, varyScale: 1.5 });
    bin.add('vertexColor', doorG);
    const bars = new MeshBuilder();
    for (let i = 0; i < 7; i++) {
      const x = -arch.a + 0.3 + (i * (arch.a * 2 - 0.6)) / 6;
      const top = arch.heightAt(x);
      const bz = gz + 1.6;
      bars.quad([x - 0.08, 0, bz], [x + 0.08, 0, bz], [x + 0.08, top, bz], [x - 0.08, top, bz], [0, 0, 1]);
    }
    for (let y = 1; y < arch.apexY - 0.5; y += 1.1) {
      const hw = arch.halfWidthAt(y);
      bars.quad([-hw, y - 0.07, gz + 1.62], [hw, y - 0.07, gz + 1.62], [hw, y + 0.07, gz + 1.62], [-hw, y + 0.07, gz + 1.62], [0, 0, 1]);
    }
    const barsG = bars.build();
    shade(barsG, { base: 0x45423e, vary: 0.1 });
    bin.add('metal', barsG);
    banner(bin, 0, 10.6, gz + 3.0, 0, 1, 2.4, 4.0);
    cannon(bin, -2.2, 11.2, gz + 1.2, 0);
    cannon(bin, 2.2, 11.2, gz + 1.2, 0);
    for (const side of [-1, 1]) flagpole(bin, side * 6.2, 14.9, gz, 4.5, 0.7, false, side);
  }

  // ---- keep on a stepped ancient base ------------------------------------------------------------------------
  const kx = -3;
  const kz = -4;
  const KW = 17;
  const KD = 12;
  const KH = 22;
  block(bin, KW + 7, 2.2, KD + 6, kx, 0, kz, 0, 400);
  block(bin, KW + 3.5, 2.0, KD + 3, kx, 2.2, kz, 0, 401);
  squareTower(bin, glow, rng, kx, kz, KW, KD, KH, 410, { turrets: true, windowsFront: 4 });
  // stepped ancient crown in the middle of the keep roof
  block(bin, 7, 2.2, 5, kx, KH + 0.8, kz, 0, 420);
  block(bin, 4, 1.6, 3, kx, KH + 3.0, kz, 0, 421);
  // ember-sun emblem + banners on the keep front
  {
    const ez = kz + KD / 2 + 0.06;
    const disc = new THREE.CircleGeometry(2.2, 16);
    disc.translate(kx, KH * 0.62, ez);
    shade(disc, { base: 0xb0623e, vary: 0.1 });
    bin.add('vertexColor', disc);
    const rays = new MeshBuilder();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = 2.1;
      const r1 = i % 2 === 0 ? 3.4 : 2.8;
      rays.tri(
        [kx + Math.cos(a - 0.14) * r0, KH * 0.62 + Math.sin(a - 0.14) * r0, ez + 0.02],
        [kx + Math.cos(a + 0.14) * r0, KH * 0.62 + Math.sin(a + 0.14) * r0, ez + 0.02],
        [kx + Math.cos(a) * r1, KH * 0.62 + Math.sin(a) * r1, ez + 0.02],
        [0, 0, 1],
      );
    }
    const raysG = rays.build();
    shade(raysG, { base: 0xd8c9a0, vary: 0.08 });
    bin.add('vertexColor', raysG);
    for (const bx of [-6.2, 6.2]) banner(bin, kx + bx, KH - 1.2, ez, 0, 1, 2.6, 8.5);
    // lit gallery of windows
    for (let i = 0; i < 5; i++) windowAt(glow, kx - 6 + i * 3, KH * 0.34, ez, 0, 1, 1.0, 1.9);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) windowAt(glow, kx + side * (KW / 2 + 0.03), KH * (0.35 + i * 0.2), kz - 3 + i * 3, side, 0, 0.9, 1.7);
  }
  // keep door
  {
    const d = boxAt(3.2, 4.8, 0.3, kx, 4.2, kz + KD / 2 + 0.1, 1, 1, 1);
    shade(d, { base: 0x3a2a1c, vary: 0.1 });
    bin.add('vertexColor', d);
  }

  // ---- watch tower (tallest silhouette, like the reference) ---------------------------------------------
  {
    const wx = kx + KW / 2 - 1.5;
    const wz = kz - KD / 2 - 1.5;
    const ww = 6;
    const wh = 31;
    const body = boxAt(ww, wh, ww, wx, 0, wz, 1, 4, 1);
    boxUV(body, TILE, 0.17, 0);
    stoneShade(body, 500, wh);
    bin.add('stoneBlocks', body);
    for (const yy of [wh * 0.45, wh * 0.75]) {
      const sc = boxAt(ww + 0.5, 0.6, ww + 0.5, wx, yy, wz, 1, 1, 1);
      boxUV(sc, TILE, 0, 0);
      stoneShade(sc, 501, yy + 0.6, 0, STONE_DARK);
      bin.add('stoneBlocks', sc);
    }
    // open belfry: 4 corner piers + lintel ring + glowing lantern inside
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = boxAt(1.3, 4.0, 1.3, wx + sx * (ww / 2 - 0.65), wh, wz + sz * (ww / 2 - 0.65), 1, 1, 1);
      boxUV(p, TILE, 0, 0);
      stoneShade(p, 502, wh + 4);
      bin.add('stoneBlocks', p);
    }
    const lint = boxAt(ww + 0.6, 1.0, ww + 0.6, wx, wh + 4.0, wz, 1, 1, 1);
    boxUV(lint, TILE, 0, 0);
    stoneShade(lint, 503, wh + 5, 0, STONE_DARK);
    bin.add('stoneBlocks', lint);
    const lantern = new THREE.IcosahedronGeometry(1.1, 0);
    lantern.translate(wx, wh + 1.8, wz);
    bin.add('emberGlow', lantern, { castShadow: false });
    const floor = boxAt(ww - 0.2, 0.4, ww - 0.2, wx, wh - 0.2, wz, 1, 1, 1);
    stoneShade(floor, 504, wh + 0.2);
    bin.add('stoneBlocks', boxUV(floor, TILE, 0, 0));
    pyramidRoof(bin, wx, wh + 5.0, wz, ww + 1.2, ww + 1.2, 6.5, 5);
    flagpole(bin, wx, wh + 11.2, wz, 6.5, 1.7, true, -1);
    for (const yy of [wh * 0.3, wh * 0.6, wh * 0.85]) windowAt(glow, wx, yy, wz + ww / 2 + 0.02, 0, 1, 0.8, 1.5);
  }

  // ---- courtyard buildings (pirate halls, timber + thatch) ------------------------------------------------
  const halls: Array<[number, number, number, number, number]> = [
    [16, 3, 11, 6, 0.05],
    [-18, 4, 9, 5.5, -0.08],
    [19, -8, 6, 4.5, 0.3],
    [-16, -10, 6.5, 4, -0.2],
  ];
  halls.forEach(([hx, hz, hw, hd, ry], i) => {
    const wallsG = boxAt(hw, 3.6, hd, 0, 0, 0, 1, 1, 1);
    shade(wallsG, { base: i % 2 === 0 ? 0x7a5a3a : 0xa89c86, vary: 0.12 });
    wallsG.rotateY(ry);
    wallsG.translate(hx, 0, hz);
    bin.add('vertexColor', wallsG);
    // gable roof (two slopes) along X
    const mb = new MeshBuilder();
    const ox = hw / 2 + 0.5;
    const oz = hd / 2 + 0.6;
    const rh = hd * 0.55;
    const A: Vec3 = [-ox, 3.6, -oz];
    const B: Vec3 = [ox, 3.6, -oz];
    const C: Vec3 = [ox, 3.6 + rh, 0];
    const D: Vec3 = [-ox, 3.6 + rh, 0];
    const E: Vec3 = [ox, 3.6, oz];
    const F: Vec3 = [-ox, 3.6, oz];
    mb.quad(A, B, C, D, [0, 1, -1]);
    mb.quad(F, E, C, D, [0, 1, 1]);
    mb.tri([-hw / 2, 3.6, -hd / 2], [-hw / 2, 3.6, hd / 2], [-hw / 2, 3.6 + rh * 0.9, 0], [-1, 0, 0]);
    mb.tri([hw / 2, 3.6, -hd / 2], [hw / 2, 3.6, hd / 2], [hw / 2, 3.6 + rh * 0.9, 0], [1, 0, 0]);
    const roof = mb.build();
    boxUV(roof, 3, 0, 0);
    if (i % 2 === 0) {
      shade(roof, { base: 0xb5a58a, vary: 0.12 });
      roof.rotateY(ry);
      roof.translate(hx, 0, hz);
      bin.add('thatch', roof);
    } else {
      shade(roof, { base: ROOF[i % ROOF.length], vary: 0.12 });
      roof.rotateY(ry);
      roof.translate(hx, 0, hz);
      bin.add('vertexColor', roof);
    }
    windowAt(glow, hx, 1.8, hz + hd / 2 + 0.02, 0, 1, 0.8, 1.0);
  });

  bin.add('emberGlow', glow.build(), { castShadow: false });
  return { name: 'fortress', parts: bin.parts() };
}
