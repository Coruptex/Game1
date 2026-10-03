import * as THREE from 'three';
import type { InstancedAsset, LocalCollider, LocalPlatform, PropDefinition, PropPart } from '../PropTypes';
import { Rng } from '../../utils/random';
import { clamp } from '../../utils/math';
import {
  BLOCK_TILE,
  COURSE,
  MeshBuilder,
  PartBin,
  PointedArch,
  StoneColors,
  bevelSlab,
  boxAt,
  boxUV,
  brokenTop,
  chamferBlock,
  dropFaces,
  glyph,
  irregularPoly,
  jitter,
  lathe,
  mossClump,
  mossDrape,
  placed,
  planarUV,
  prism,
  rubbleChunk,
  shade,
  stripWall,
  vineStrand,
  voussoirRing,
  type GlyphKind,
  type TopSegment,
  type Vec3,
} from './StoneKit';

/**
 * Ancient architecture of the fictional island civilisation (the "Ember Kings"):
 * monumental gate, ruined walls, columns, arches, stairs, paving, statues, stelae, the crypt
 * facade and the checkpoint shrine. Everything is authored in prop-local space: metres, +Y up,
 * ground contact at y = 0, front faces +Z.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface MasonryOptions {
  seed: number;
  tile?: number;
  /** Top height for moss creeping down the faces (default: geometry top). */
  top?: number;
  topAt?: (x: number, z: number) => number;
  creep?: number;
  moss?: number;
  dirt?: number;
  /** Align texture courses so that this height is a mortar line. */
  courseBase?: number;
}

/** Textured cut-stone masonry (`stoneBlocks`): world-scale UVs + near-white painterly tint with moss. */
function masonry(geo: THREE.BufferGeometry, o: MasonryOptions): THREE.BufferGeometry {
  const tile = o.tile ?? BLOCK_TILE;
  const rowV = 1 / 6;
  // shift V so that `courseBase` lands exactly on a mortar line of the texture
  const frac = o.courseBase !== undefined ? (((o.courseBase / tile) % rowV) + rowV) % rowV : 0;
  const ov = -frac;
  boxUV(geo, tile, (o.seed * 0.618) % 1, ov);
  geo.computeBoundingBox();
  const top = o.top ?? geo.boundingBox!.max.y;
  shadeWithTop(geo, {
    base: StoneColors.blockTint,
    vary: 0.1,
    moss: StoneColors.blockMoss,
    mossAmount: o.moss ?? 0.95,
    mossCreep: o.creep ?? 0.7,
    creepTop: top,
    dirt: o.dirt ?? 0.28,
    dirtHeight: 1.6,
    dampGreen: 0.14,
    seed: o.seed,
  }, o.topAt);
  return geo;
}

interface TrimOptions {
  seed: number;
  color?: THREE.ColorRepresentation;
  moss?: number;
  creep?: number;
  top?: number;
  dirt?: number;
  tile?: number;
}

/** Plain carved stone (`stone`): painterly detail texture x vertex colour. */
function trim(geo: THREE.BufferGeometry, o: TrimOptions): THREE.BufferGeometry {
  boxUV(geo, o.tile ?? 2.2, (o.seed * 0.37) % 1, (o.seed * 0.71) % 1);
  geo.computeBoundingBox();
  shade(geo, {
    base: o.color ?? StoneColors.plain,
    vary: 0.1,
    moss: StoneColors.plainMoss,
    mossAmount: o.moss ?? 0.85,
    mossCreep: o.creep ?? 0.25,
    creepTop: o.top ?? geo.boundingBox!.max.y,
    dirt: o.dirt ?? 0.25,
    dirtHeight: 1.2,
    dampGreen: 0.2,
    seed: o.seed,
  });
  return geo;
}

/** `shade` with an optional per-vertex top function (stepped broken tops). */
function shadeWithTop(
  geo: THREE.BufferGeometry,
  o: Parameters<typeof shade>[1],
  topAt?: (x: number, z: number) => number,
): THREE.BufferGeometry {
  if (!topAt) return shade(geo, o);
  // Shade twice (creeping moss from the per-column top), keep the mossier result per vertex.
  const p = geo.attributes.position;
  shade(geo, { ...o, mossCreep: 0 });
  const base = (geo.attributes.color as THREE.BufferAttribute).clone();
  const col = geo.attributes.color as THREE.BufferAttribute;
  const n = geo.attributes.normal;
  const moss = new THREE.Color(o.moss ?? 0xffffff);
  const creep = o.mossCreep ?? 1;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    c.setRGB(base.getX(i), base.getY(i), base.getZ(i));
    if (Math.abs(n.getY(i)) < 0.75) {
      const d = topAt(x, z) - y;
      if (d >= -0.05) {
        const wob = 0.65 + 0.35 * Math.sin(x * 2.7 + z * 1.3) * Math.sin(x * 0.9 - 1.7);
        const k = clamp(1 - Math.max(0, d) / (creep * wob), 0, 1);
        c.lerp(moss, k * k * 0.85 * (o.mossAmount ?? 0.85));
      }
    }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return geo;
}

/** Scatters moss cushions over a horizontal rectangle. */
function mossOnRect(
  bin: PartBin,
  rng: Rng,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  count: number,
  size = 0.6,
  seeThrough = y > 2.5,
): void {
  for (let i = 0; i < count; i++) {
    const w = size * rng.range(0.6, 1.4);
    const d = size * rng.range(0.6, 1.3);
    const g = mossClump(rng, w, d, size * rng.range(0.18, 0.32), w > 0.7 ? 1 : 0);
    g.rotateY(rng.range(0, Math.PI));
    g.translate(rng.range(x0, x1), y - 0.02, rng.range(z0, z1));
    bin.add('vertexColor', g, { castShadow: false, seeThrough });
  }
}

/** Overgrowth (drapes, vines, cushions) on tall structures: see-through like the stone it hangs on. */
const HIGH = { castShadow: false, seeThrough: true } as const;

/** Stone block with `stoneBlocks` texture aligned to its own base (one block per course). */
function looseBlock(rng: Rng, w: number, h: number, d: number, seed: number, mossy = 0.6): THREE.BufferGeometry {
  const g = chamferBlock(w, h, d, { bevel: Math.min(0.08, h * 0.15), rng, jitter: 0.02, chip: 0.5, bottom: true });
  boxUV(g, BLOCK_TILE, (seed * 0.618) % 1, 0);
  return shade(g, {
    base: StoneColors.blockTint,
    vary: 0.1,
    moss: StoneColors.blockMoss,
    mossAmount: mossy,
    mossCreep: h * 0.4,
    creepTop: h,
    dirt: 0.18,
    dirtHeight: h * 0.6,
    seed,
  });
}

/** Glyph tile: recessed darker background + lighter relief, facing +Z, centred at the origin. */
function glyphTile(kind: GlyphKind, size: number, seed: number, background: THREE.ColorRepresentation = StoneColors.plainDark): THREE.BufferGeometry[] {
  const bg = chamferBlock(size * 0.96, 0.025, size * 0.96, { bevel: 0.012 });
  bg.rotateX(Math.PI / 2);
  trim(bg, { seed, color: background, moss: 0.3, creep: 0 });
  const rel = glyph(kind, size * 0.78, 0.06);
  rel.translate(0, 0, 0.02);
  trim(rel, { seed: seed + 1, color: StoneColors.plainLight, moss: 0.5, creep: 0, dirt: 0 });
  return [bg, rel];
}

/** Adds a row/column of glyph tiles to the bin (tiles face +Z, then transformed by `m`). */
function glyphStrip(bin: PartBin, kinds: GlyphKind[], size: number, vertical: boolean, m: THREE.Matrix4, seed: number, background?: THREE.ColorRepresentation): void {
  const n = kinds.length;
  const y = new THREE.Vector3().setFromMatrixPosition(m).y;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * size;
    for (const g of glyphTile(kinds[i], size, seed + i * 7, background)) {
      if (vertical) g.translate(0, -off, 0);
      else g.translate(off, 0, 0);
      g.applyMatrix4(m);
      bin.add('stone', g, { seeThrough: y > 2.5 });
    }
  }
}

function mat(x: number, y: number, z: number, ry = 0): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
}

function boxCollider(x0: number, x1: number, z0: number, z1: number, yMin: number, yMax: number, tag?: string): LocalCollider {
  const c: LocalCollider = { type: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfX: (x1 - x0) / 2, halfZ: (z1 - z0) / 2, yaw: 0, yMin, yMax };
  if (tag) c.tag = tag;
  return c;
}

// ---------------------------------------------------------------------------
// Ancient gate
// ---------------------------------------------------------------------------

/** Key dimensions of the monumental gate (prop-local, front faces +Z). */
export const ANCIENT_GATE = {
  width: 15,
  height: 13,
  /** Clear pointed-arch opening: half width, springing height, apex height. */
  opening: { halfWidth: 2.75, springY: 3.6, apexY: 8.0 },
  /** The portcullis plane (z) inside the arch. */
  portcullisZ: 0,
  /** Central wall faces (z). */
  wallZ: [-1.2, 1.2] as const,
  /** Tower footprints (|x| range, |z| half depth). */
  towers: { innerX: 4.55, outerX: 7.5, halfZ: 2.0 },
};

/** Strip-wall breakpoints at even angles along an arch (keeps the soffit on the curve) + the jambs. */
function archBreaks(arch: PointedArch, n = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = arch.point(i / n)[0];
    out.push(x, -x);
  }
  return out;
}

function gateArch(): PointedArch {
  const o = ANCIENT_GATE.opening;
  return new PointedArch(o.halfWidth, o.springY, o.apexY - o.springY);
}

/** Anchor points (prop-local) along the gate's top edges where hanging vines / creepers look natural. */
export const GATE_VINE_ANCHORS: Array<{ x: number; y: number; z: number; length: number }> = [
  { x: -6.6, y: 10.4, z: 2.2, length: 4.5 },
  { x: -5.2, y: 10.4, z: 2.2, length: 3.0 },
  { x: -7.7, y: 10.4, z: 0.8, length: 5.0 },
  { x: -1.8, y: 9.6, z: 1.3, length: 2.6 },
  { x: 1.2, y: 9.6, z: 1.3, length: 2.0 },
  { x: 3.6, y: 9.6, z: 1.3, length: 3.4 },
  { x: 5.4, y: 10.4, z: 2.2, length: 3.8 },
  { x: 7.7, y: 10.4, z: -0.6, length: 4.2 },
  { x: 6.8, y: 10.4, z: -2.2, length: 3.5 },
];

/**
 * Iron portcullis of the gate (lowered), in the gate's local frame. Exposed separately so gameplay
 * can build it as its own (animatable) mesh with `buildAncientGate({ portcullis: false })`.
 */
export function buildPortcullis(): PropPart[] {
  const arch = gateArch();
  const rng = new Rng(404);
  const geos: THREE.BufferGeometry[] = [];
  const spacing = 0.43;
  const nBars = Math.floor((arch.a * 2 - 0.2) / spacing) + 1;
  const x0 = -((nBars - 1) * spacing) / 2;
  const z = ANCIENT_GATE.portcullisZ;
  for (let i = 0; i < nBars; i++) {
    const x = x0 + i * spacing;
    const top = arch.heightAt(x) + 0.5;
    const bar = boxAt(0.13, top - 0.3, 0.13, x, 0.3, z, 1, 2, 1);
    const spike = new THREE.ConeGeometry(0.095, 0.34, 4, 1);
    spike.rotateX(Math.PI);
    spike.rotateY(Math.PI / 4);
    spike.translate(x, 0.17, z);
    for (const g of [bar, spike]) {
      const rusty = rng.chance(0.35);
      shade(g, {
        base: rusty ? 0x7a6450 : StoneColors.iron,
        vary: 0.18,
        varyScale: 2.4,
        moss: StoneColors.rust,
        mossAmount: 0.7,
        mossUp: -0.2,
        dirt: 0.35,
        dirtHeight: 1.2,
        seed: i,
      });
      geos.push(g);
    }
  }
  for (let y = 0.62; y < arch.apexY - 0.45; y += 0.8) {
    const hw = arch.halfWidthAt(y + 0.06) + 0.18;
    const g = boxAt(hw * 2, 0.11, 0.19, 0, y, z, 2, 1, 1);
    shade(g, { base: StoneColors.iron, vary: 0.2, varyScale: 2.0, moss: StoneColors.rust, mossAmount: 0.75, mossUp: 0.3, seed: y * 10 });
    geos.push(g);
    // rivet plates at a few crossings
    for (let i = 0; i < nBars; i += 2) {
      const x = x0 + i * spacing;
      if (Math.abs(x) > hw - 0.2) continue;
      const r = boxAt(0.2, 0.2, 0.22, x, y - 0.045, z, 1, 1, 1);
      shade(r, { base: 0x4a4744, vary: 0.1, seed: i + y });
      geos.push(r);
    }
  }
  const bin = new PartBin();
  for (const g of geos) bin.add('metal', g, { seeThrough: true });
  return bin.parts();
}

/**
 * Monumental ruined gate (~15 m wide, ~13 m tall): two flanking towers with carved ochre relief
 * panels and glyph friezes, a pointed arch (5.5 m x 8 m clear) with voussoir archivolts and a
 * carved mask keystone, a lowered iron portcullis that blocks the passage, broken crowns with
 * missing blocks, rubble, moss cushions and hanging moss curtains.
 */
export function buildAncientGate(opts: { portcullis?: boolean } = {}): PropDefinition {
  const G = ANCIENT_GATE;
  const arch = gateArch();
  const rng = new Rng(1307);
  const bin = new PartBin();
  const tall = { seeThrough: true };
  const [wz0, wz1] = G.wallZ;
  const T = G.towers;

  // ---- central wall with the arch opening --------------------------------------------------
  const wallX = T.innerX + 0.05;
  const tops = brokenTop(rng, -wallX, wallX, 9.8, 11.2, COURSE, 0.7, 1.6, (t) => 1 - Math.max(0, t - 0.55) * 1.4);
  const topAt = (x: number): number => {
    for (const s of tops) if (x >= s.x0 - 1e-4 && x <= s.x1 + 1e-4) return s.y;
    return 10;
  };
  const wall = stripWall({
    tops,
    z0: wz0,
    z1: wz1,
    bottom: (x) => (Math.abs(x) < arch.a ? arch.heightAt(x) : 0),
    breaks: archBreaks(arch),
    stripW: 0.42,
    rowH: 0.7,
    capLeft: false,
    capRight: false,
  });
  // (no positional jitter here: neighbouring strips form T-junctions that would crack open)
  bin.add('stoneBlocks', masonry(wall, { seed: 1, topAt: (x) => topAt(x), creep: 0.8 }), tall);
  // a few loose blocks still sitting on the broken top
  for (const s of tops) {
    if (rng.chance(0.45)) {
      const w = Math.min(s.x1 - s.x0, rng.range(0.6, 1.1));
      const b = looseBlock(rng, w, COURSE * 0.95, rng.range(0.9, 1.6), 20 + s.x0);
      b.rotateY(rng.range(-0.12, 0.12));
      b.translate((s.x0 + s.x1) / 2 + rng.range(-0.1, 0.1), s.y, rng.range(-0.4, 0.4));
      bin.add('stoneBlocks', b, tall);
    }
    mossOnRect(bin, rng, s.x0 + 0.1, s.x1 - 0.1, wz0 + 0.2, wz1 - 0.2, s.y, 2, 0.7);
  }

  // plinth under the jamb piers (both faces)
  for (const side of [-1, 1]) {
    const pl = chamferBlock(wallX - arch.a + 0.02, 1.0, (wz1 + 0.55) * 2, { bevel: 0.2, chamfer: 0.08, rng, jitter: 0.015 });
    pl.translate(side * (arch.a + (wallX - arch.a) / 2) + side * 0.01, 0, 0);
    bin.add('stoneBlocks', masonry(pl, { seed: 5 + side, creep: 0.3, dirt: 0.35 }));
  }

  // ---- archivolts (front) ----------------------------------------------------------------
  const ring1 = voussoirRing(arch, { inner: 0, thickness: 0.56, zBack: wz1 - 0.05, zFront: wz1 + 0.24, count: 7, gap: 0.03, bevel: 0.05, rng, stagger: 0.03 });
  bin.add('stone', trim(ring1, { seed: 11, color: StoneColors.plain, creep: 0.1 }), tall);
  const ring2 = voussoirRing(arch, { inner: 0.56, thickness: 0.42, zBack: wz1 - 0.05, zFront: wz1 + 0.42, count: 9, gap: 0.03, bevel: 0.06, rng, stagger: 0.035 });
  bin.add('stone', trim(ring2, { seed: 12, color: StoneColors.plainLight, creep: 0.1 }), tall);
  // back face ring
  const ringB = voussoirRing(arch, { inner: 0, thickness: 0.6, zBack: wz1 - 0.05, zFront: wz1 + 0.22, count: 8, gap: 0.03, rng, stagger: 0.03 });
  ringB.rotateY(Math.PI);
  bin.add('stone', trim(ringB, { seed: 13 }), tall);

  // jamb pilasters continuing both rings down to the plinth + impost blocks at the springing
  for (const side of [-1, 1]) {
    for (const [inner, th, depth, seed] of [
      [0, 0.56, 0.24, 21],
      [0.56, 0.42, 0.42, 22],
    ] as const) {
      let y = 1.0;
      let k = 0;
      while (y < arch.springY - 0.36) {
        const h = Math.min(rng.range(0.55, 0.7), arch.springY - 0.36 - y);
        if (h < 0.2) break;
        const b = chamferBlock(th - 0.03, h - 0.025, depth + 0.05, { bevel: 0.045, rng, jitter: 0.012, chip: 0.25 });
        b.translate(side * (arch.a + inner + th / 2), y, wz1 + (depth - 0.05) / 2);
        bin.add('stone', trim(b, { seed: seed + k * 3, color: inner > 0 ? StoneColors.plainLight : StoneColors.plain, creep: 0.05 }), tall);
        y += h;
        k++;
      }
    }
    const imp = chamferBlock(1.25, 0.38, 0.75, { bevel: 0.07, rng, jitter: 0.01 });
    imp.translate(side * (arch.a + 0.5), arch.springY - 0.37, wz1 + 0.22);
    bin.add('stone', trim(imp, { seed: 30 + side, color: StoneColors.plainLight }), tall);
    const impB = chamferBlock(1.0, 0.36, 0.5, { bevel: 0.06, rng });
    impB.translate(side * (arch.a + 0.4), arch.springY - 0.35, wz0 - 0.12);
    bin.add('stone', trim(impB, { seed: 33 + side }), tall);
  }

  // keystone with the Ember-King mask
  const key = chamferBlock(0.95, 1.45, 0.72, { bevel: 0.08, rng, jitter: 0.01 });
  key.translate(0, arch.apexY - 0.25, wz1 - 0.05);
  bin.add('stone', trim(key, { seed: 40, color: StoneColors.plainLight, creep: 0.2 }), tall);
  const mask = glyph('mask', 0.8, 0.09);
  mask.translate(0, arch.apexY + 0.5, wz1 + 0.67);
  bin.add('stone', trim(mask, { seed: 41, color: 0xd2c8a8, moss: 0.4, dirt: 0 }), tall);

  // spandrel sun discs
  for (const side of [-1, 1]) {
    const m = mat(side * 3.45, 7.75, wz1 + 0.01);
    glyphStrip(bin, ['sun'], 1.15, false, m, 50 + side, StoneColors.ochre);
  }

  // threshold slab under the portcullis
  const sill = chamferBlock(arch.a * 2 + 0.2, 0.12, (wz1 - wz0) + 0.3, { bevel: 0.03, rng, jitter: 0.01 });
  sill.translate(0, -0.04, 0);
  bin.add('stone', trim(sill, { seed: 45, color: StoneColors.plainDark, moss: 0.4 }));

  // ---- flanking towers -----------------------------------------------------------------------
  const towerTops = [12.75, 12.05];
  for (const side of [-1, 1]) {
    const si = side < 0 ? 0 : 1;
    const cx = side * (T.innerX + T.outerX) / 2;
    const tw = T.outerX - T.innerX;
    const td = T.halfZ * 2;
    const outerX = side * T.outerX;
    const seed = 100 + si * 50;

    // plinth
    const pl = chamferBlock(tw + 0.6, 1.4, td + 0.6, { bevel: 0.28, chamfer: 0.12, rng, jitter: 0.02 });
    pl.translate(cx + side * 0.15, 0, 0);
    bin.add('stoneBlocks', masonry(jitter(pl, 0.02, 1.4, seed), { seed: seed + 1, creep: 0.2, dirt: 0.35 }));

    // shaft
    const shaftTop = 10.5;
    const shaft = boxAt(tw, shaftTop - 1.3, td, cx, 1.3, 0, 4, 13, 5);
    bin.add('stoneBlocks', masonry(jitter(shaft, 0.03, 1.2, seed + 2), { seed: seed + 2, top: shaftTop, creep: 0.6, courseBase: 0 }), tall);

    // corner quoins (alternating long/short), front + outer corners
    for (let y = 1.4, k = 0; y < shaftTop - 0.3; y += COURSE, k++) {
      for (const zs of [-1, 1]) {
        const long = k % 2 === 0;
        const qw = long ? 0.95 : 0.55;
        const qd = long ? 0.55 : 0.95;
        const q = chamferBlock(qw, COURSE - 0.04, qd, { bevel: 0.05, rng, jitter: 0.012, chip: 0.2 });
        q.translate(outerX - side * (qw / 2 - 0.05), y + 0.02, zs * (T.halfZ - qd / 2 + 0.05));
        bin.add('stoneBlocks', masonry(q, { seed: seed + 10 + k, courseBase: y, creep: 0.15, moss: 0.6 }), tall);
      }
    }

    // carved ochre relief panel on the front face
    const panelW = 1.55;
    const panelY0 = 2.3;
    const panelY1 = 7.7;
    const pz = T.halfZ;
    const frame: Array<[number, number, number, number]> = [
      [cx - panelW / 2 - 0.12, cx - panelW / 2 + 0.06, panelY0 - 0.15, panelY1 + 0.15],
      [cx + panelW / 2 - 0.06, cx + panelW / 2 + 0.12, panelY0 - 0.15, panelY1 + 0.15],
      [cx - panelW / 2 - 0.12, cx + panelW / 2 + 0.12, panelY1, panelY1 + 0.22],
      [cx - panelW / 2 - 0.12, cx + panelW / 2 + 0.12, panelY0 - 0.22, panelY0],
    ];
    for (const [fx0, fx1, fy0, fy1] of frame) {
      const f = chamferBlock(fx1 - fx0, fy1 - fy0, 0.2, { bevel: 0.04, rng, jitter: 0.008 });
      f.translate((fx0 + fx1) / 2, fy0, pz + 0.08);
      bin.add('stone', trim(f, { seed: seed + 20, color: StoneColors.plainLight, creep: 0.05 }), tall);
    }
    const kinds: GlyphKind[] = si === 0 ? ['sun', 'mask', 'spiral', 'flame'] : ['eye', 'flame', 'wave', 'sun'];
    const tile = (panelY1 - panelY0) / kinds.length;
    glyphStrip(bin, kinds, Math.min(tile, panelW), true, mat(cx, (panelY0 + panelY1) / 2, pz + 0.005), seed + 30, StoneColors.ochre);

    // smaller panel on the outer side face
    const sideKinds: GlyphKind[] = ['steps', 'sun', 'wave'];
    glyphStrip(bin, sideKinds, 1.05, true, mat(outerX, 5.2, 0, side * Math.PI / 2), seed + 40, StoneColors.ochre);

    // string course + glyph frieze + cornice
    const sc = chamferBlock(tw + 0.32, 0.36, td + 0.32, { bevel: 0.08, rng, jitter: 0.012 });
    sc.translate(cx, 8.35, 0);
    bin.add('stone', trim(sc, { seed: seed + 50, color: StoneColors.plainLight, creep: 0.05 }), tall);
    const friezeKinds: GlyphKind[] = ['spiral', 'sun', 'wave'];
    glyphStrip(bin, friezeKinds, 0.92, false, mat(cx, 9.3, pz + 0.005), seed + 60);
    glyphStrip(bin, ['eye', 'spiral', 'sun', 'wave'], 0.92, false, mat(outerX + side * 0.005, 9.3, 0, side * Math.PI / 2), seed + 70);
    const cor = chamferBlock(tw + 0.42, 0.4, td + 0.42, { bevel: 0.1, rng, jitter: 0.015 });
    cor.translate(cx, shaftTop - 0.02, 0);
    bin.add('stone', trim(cor, { seed: seed + 80, color: StoneColors.plainLight, creep: 0.05, moss: 0.95 }), tall);

    // ruined crown: perimeter block courses with missing blocks
    const crownBase = shaftTop + 0.38;
    const crownTop = towerTops[si];
    const courses = Math.round((crownTop - crownBase) / COURSE);
    const ringDepth = 0.72;
    const hw = tw / 2 - 0.02;
    const hd = T.halfZ - 0.02;
    // interior fill
    const fill = boxAt(tw - ringDepth * 2 + 0.1, COURSE * (si === 0 ? 1 : 0.6), td - ringDepth * 2 + 0.1, cx, crownBase, 0, 2, 1, 2);
    bin.add('stoneBlocks', masonry(fill, { seed: seed + 90, creep: 0.1 }), tall);
    mossOnRect(bin, rng, cx - hw + ringDepth, cx + hw - ringDepth, -hd + ringDepth, hd - ringDepth, crownBase + COURSE * (si === 0 ? 1 : 0.6), 4, 0.8);
    const keep = (x: number, z: number, c: number): boolean => {
      // ruin profile: the right tower lost its front-inner corner, the left one keeps merlons
      if (si === 1) {
        const lx = (x - cx) * side;
        const broken = lx < 0.3 && z > -0.4;
        if (broken && c >= 1) return false;
        if (c === courses - 1 && (lx < 0.9 || rng.chance(0.35))) return false;
        return !rng.chance(0.12 + c * 0.08);
      }
      if (c === courses - 1) return Math.floor((x + z + 20) / 0.9) % 2 === 0 && !rng.chance(0.15);
      return !rng.chance(0.06 + c * 0.05);
    };
    for (let c = 0; c < courses; c++) {
      const y = crownBase + c * COURSE;
      const sides: Array<{ ax: number; az: number; bx: number; bz: number; nx: number; nz: number }> = [];
      const alongX = c % 2 === 0;
      // front/back runs (full width when alongX) and left/right runs
      const fx = alongX ? hw : hw - ringDepth;
      const fz = alongX ? hd - ringDepth : hd;
      sides.push({ ax: cx - fx, az: hd, bx: cx + fx, bz: hd, nx: 0, nz: 1 });
      sides.push({ ax: cx - fx, az: -hd, bx: cx + fx, bz: -hd, nx: 0, nz: -1 });
      sides.push({ ax: cx + hw, az: -fz, bx: cx + hw, bz: fz, nx: 1, nz: 0 });
      sides.push({ ax: cx - hw, az: -fz, bx: cx - hw, bz: fz, nx: -1, nz: 0 });
      for (const s of sides) {
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
        let t = 0;
        while (t < len - 0.05) {
          let bl = rng.range(0.75, 1.25);
          if (len - (t + bl) < 0.45) bl = len - t;
          const tm = (t + bl / 2) / len;
          const px = s.ax + (s.bx - s.ax) * tm;
          const pz2 = s.az + (s.bz - s.az) * tm;
          if (keep(px, pz2, c)) {
            const along = s.nx === 0;
            const bw = along ? bl - 0.03 : ringDepth;
            const bd = along ? ringDepth : bl - 0.03;
            const b = chamferBlock(bw, COURSE - 0.03, bd, { bevel: 0.06, chamfer: 0.05, rng, jitter: 0.02, chip: 0.35 });
            const out = rng.range(-0.04, 0.03);
            b.rotateY(rng.range(-0.03, 0.03));
            b.translate(px - s.nx * (ringDepth / 2 - out), y + 0.01, pz2 - s.nz * (ringDepth / 2 - out));
            bin.add('stoneBlocks', masonry(b, { seed: seed + 100 + c * 13 + t * 7, courseBase: y, creep: 0.35, moss: 1 }), tall);
            if (c === courses - 1 || rng.chance(0.3)) {
              const mg = mossClump(rng, Math.max(bw, 0.5) * 0.9, Math.max(bd, 0.5) * 0.9, 0.22, 1);
              mg.translate(px - s.nx * (ringDepth / 2), y + COURSE - 0.03, pz2 - s.nz * (ringDepth / 2));
              bin.add('vertexColor', mg, HIGH);
            }
          } else if (c > 0 && rng.chance(0.5)) {
            // mossy stub where a block fell
            const mg = mossClump(rng, 0.7, 0.6, 0.18, 0);
            mg.translate(px - s.nx * (ringDepth / 2), y - 0.02, pz2 - s.nz * (ringDepth / 2));
            bin.add('vertexColor', mg, HIGH);
          }
          t += bl;
        }
      }
    }

    // moss on the plinth / string course / cornice ledges
    mossOnRect(bin, rng, cx - hw - 0.1, cx + hw + 0.1, hd + 0.05, hd + 0.2, 1.38, 3, 0.45);
    mossOnRect(bin, rng, cx - hw, cx + hw, hd, hd + 0.12, 8.69, 2, 0.4);
    mossOnRect(bin, rng, cx - hw, cx + hw, -hd, hd, shaftTop + 0.36, 2, 0.5);

    // hanging moss curtains + vines
    const drapes = si === 0 ? [[-0.6, 3.6], [0.7, 2.2]] : [[0.5, 2.8]];
    for (const [dx, len] of drapes) {
      const d = mossDrape(rng, rng.range(0.9, 1.4), len, 5);
      bin.add('vertexColor', placed(d, cx + dx, shaftTop + 0.3, T.halfZ + 0.22), HIGH);
    }
    const dSide = mossDrape(rng, 1.6, si === 0 ? 4.2 : 3.0, 6);
    bin.add('vertexColor', placed(dSide, outerX + side * 0.22, shaftTop + 0.3, rng.range(-0.8, 0.6), 0, side * Math.PI / 2), HIGH);
    for (let v = 0; v < 2; v++) {
      const vs = vineStrand(rng, rng.range(2.5, 4.5), 0.25);
      bin.add('vertexColor', placed(vs, cx + rng.range(-1, 1), shaftTop + 0.35, T.halfZ + 0.25), HIGH);
    }
  }

  // moss curtains over the arch
  for (const [dx, len] of [[-1.7, 1.6], [2.0, 1.1]]) {
    const top = topAt(dx);
    const d = mossDrape(rng, 1.2, len, 5);
    bin.add('vertexColor', placed(d, dx, top + 0.05, wz1 + 0.04), HIGH);
  }
  const vs = vineStrand(rng, 3.2, 0.5);
  bin.add('vertexColor', placed(vs, -2.6, topAt(-2.6) + 0.05, wz1 + 0.05), HIGH);

  // ---- rubble ---------------------------------------------------------------------------------
  const rubble: Array<[number, number, number]> = [
    [5.6, 3.4, 1.3],
    [7.6, 2.8, 1.0],
    [8.5, 0.6, 0.9],
    [-8.2, 2.6, 0.8],
    [-6.4, 3.3, 0.6],
    [3.6, 4.5, 0.55],
    [-3.9, 5.2, 0.4],
  ];
  const colliders: LocalCollider[] = [];
  for (const [rx, rz, s] of rubble) {
    const n = Math.round(2 + s * 4);
    for (let i = 0; i < n; i++) {
      const w = rng.range(0.55, 1.1) * (0.6 + s * 0.4);
      const b = looseBlock(rng, w, rng.range(0.4, 0.62), rng.range(0.5, 0.9), 300 + i + rx);
      const tiltX = rng.range(-0.35, 0.35);
      const tiltZ = rng.range(-0.35, 0.35);
      const g = placed(b, rx + rng.range(-1, 1) * s, -0.06 + (i > n / 2 ? rng.range(0.2, 0.45) * s : 0), rz + rng.range(-0.8, 0.8) * s, tiltX, rng.range(0, Math.PI), tiltZ);
      bin.add('stoneBlocks', g);
    }
    for (let i = 0; i < n * 2; i++) {
      const g = rubbleChunk(rng, rng.range(0.15, 0.4));
      g.translate(rx + rng.range(-1.6, 1.6) * s, -0.03, rz + rng.range(-1.4, 1.4) * s);
      bin.add('stone', trim(g, { seed: 400 + i, color: StoneColors.plain, moss: 0.7, creep: 0 }));
    }
    mossOnRect(bin, rng, rx - s, rx + s, rz - s * 0.6, rz + s * 0.6, 0.02, 2, 0.5);
    if (s >= 0.8) colliders.push({ type: 'circle', x: rx, z: rz, radius: 0.75 * s + 0.25, yMin: 0, yMax: 0.9, tag: 'rubble' });
  }

  // ---- colliders -------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const x0 = side * T.innerX;
    const x1 = side * (T.outerX + 0.2);
    colliders.push(boxCollider(Math.min(x0, x1), Math.max(x0, x1), -T.halfZ - 0.2, T.halfZ + 0.2, 0, side < 0 ? 13 : 12.2, 'wall'));
    const j0 = side * arch.a;
    const j1 = side * (T.innerX + 0.05);
    colliders.push(boxCollider(Math.min(j0, j1), Math.max(j0, j1), wz0 - 0.3, wz1 + 0.4, 0, 11, 'wall'));
  }
  colliders.push(boxCollider(-arch.a, arch.a, -0.3, 0.3, 0, arch.apexY, 'portcullis'));

  const parts = bin.parts();
  if (opts.portcullis !== false) parts.push(...buildPortcullis());
  return { name: 'ancient-gate', parts, colliders };
}

// ---------------------------------------------------------------------------
// Ruined wall
// ---------------------------------------------------------------------------

/**
 * Crumbling wall segment along local X (centred), ~1 m thick, irregular stepped broken top,
 * a coping of loose blocks, fallen blocks at its foot. One box collider.
 */
export function ruinedWall(opts: { length: number; height: number; seed?: number }): PropDefinition {
  const L = Math.max(1, opts.length);
  const H = Math.max(0.8, opts.height);
  const seed = opts.seed ?? 1;
  const rng = new Rng(9001 + seed * 101);
  const bin = new PartBin();
  const tall = { seeThrough: H > 2.2 };
  const z0 = -0.5;
  const z1 = 0.5;
  const plinthH = Math.min(COURSE * 0.75, H * 0.35);

  const pl = chamferBlock(L + 0.25, plinthH, 1.28, { bevel: 0.12, chamfer: 0.06, rng, jitter: 0.015 });
  bin.add('stoneBlocks', masonry(jitter(pl, 0.02, 1.4, seed), { seed: seed + 1, creep: 0.15, dirt: 0.3 }));

  // stepped broken top: one or two "humps" survive, the ends crumble lower
  const peak = rng.range(0.25, 0.75);
  const minY = Math.max(plinthH + COURSE * 0.6, H * 0.38);
  const tops = brokenTop(rng, -L / 2, L / 2, minY, H, COURSE * 0.5, 0.55, 1.4, (t) => 1.15 - Math.abs(t - peak) * 1.3);
  const topAt = (x: number): number => {
    for (const s of tops) if (x >= s.x0 - 1e-4 && x <= s.x1 + 1e-4) return s.y;
    return minY;
  };
  const wall = stripWall({ tops, z0, z1, stripW: 0.5, rowH: 0.7 });
  bin.add('stoneBlocks', masonry(wall, { seed, topAt: (x) => topAt(x), creep: 0.6 }), tall);

  // coping / loose blocks on the broken top + moss
  for (const s of tops) {
    const w = s.x1 - s.x0;
    if (w > 0.5 && rng.chance(0.55)) {
      const bw = Math.min(w - 0.05, rng.range(0.55, 1.0));
      const b = looseBlock(rng, bw, COURSE * rng.range(0.6, 0.9), rng.range(0.6, 1.0), seed + s.x0 * 13, 0.85);
      b.rotateY(rng.range(-0.15, 0.15));
      b.translate(s.x0 + w / 2 + rng.range(-0.1, 0.1), s.y, rng.range(-0.15, 0.15));
      bin.add('stoneBlocks', b, tall);
    }
    if (rng.chance(0.7)) mossOnRect(bin, rng, s.x0 + 0.15, s.x1 - 0.15, z0 + 0.2, z1 - 0.2, s.y, 1 + Math.floor(w), 0.55);
  }
  // hanging moss on the taller part
  const hx = -L / 2 + peak * L;
  if (H > 1.8) {
    const d = mossDrape(rng, rng.range(0.7, 1.2), Math.min(H * 0.5, 1.8), 4);
    bin.add('vertexColor', placed(d, hx, topAt(hx) + 0.02, z1 + 0.02), { castShadow: false, seeThrough: H > 2.2 });
  }

  // fallen blocks + chunks on both sides
  const nFallen = Math.max(2, Math.round(L * 0.6));
  for (let i = 0; i < nFallen; i++) {
    const side = rng.chance(0.6) ? 1 : -1;
    const b = looseBlock(rng, rng.range(0.5, 0.9), rng.range(0.35, 0.55), rng.range(0.45, 0.75), seed + 50 + i);
    bin.add('stoneBlocks', placed(b, rng.range(-L / 2, L / 2), -0.05, side * rng.range(0.9, 1.8), rng.range(-0.3, 0.3), rng.range(0, Math.PI), rng.range(-0.3, 0.3)));
  }
  for (let i = 0; i < nFallen * 2; i++) {
    const g = rubbleChunk(rng, rng.range(0.12, 0.3));
    g.translate(rng.range(-L / 2, L / 2), -0.02, (rng.chance(0.6) ? 1 : -1) * rng.range(0.75, 1.6));
    bin.add('stone', trim(g, { seed: seed + i, moss: 0.6, creep: 0 }));
  }

  const yMax = Math.max(...tops.map((t) => t.y));
  return {
    name: 'ruined-wall',
    parts: bin.parts(),
    colliders: [{ type: 'box', x: 0, z: 0, halfX: L / 2, halfZ: 0.58, yaw: 0, yMin: 0, yMax, tag: 'wall' }],
  };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COL = { plinthW: 1.2, plinthH: 0.32, baseH: 0.26, rBottom: 0.42, rTop: 0.36, shaftH: 3.75, capH: 0.36, abacusH: 0.32 };

/** Fluted drum (axis +Y, base at 0). */
function drum(r0: number, r1: number, h: number, flutes = 12): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < flutes * 2; i++) {
    const a = (i / (flutes * 2)) * Math.PI * 2;
    const k = i % 2 === 0 ? 1 : 0.9;
    pts.push([Math.cos(a) * r0 * k, Math.sin(a) * r0 * k]);
  }
  return prism(pts, 0, h, { topScale: r1 / r0, bottom: true });
}

function columnStone(geo: THREE.BufferGeometry, seed: number, color: THREE.ColorRepresentation = StoneColors.plain, moss = 0.85): THREE.BufferGeometry {
  return trim(geo, { seed, color, moss, creep: 0.3, tile: 1.6 });
}

/** Base (plinth + torus-like ring) of a column, top at COL.plinthH + COL.baseH. */
function columnBase(bin: PartBin, rng: Rng, seed: number): number {
  const pl = chamferBlock(COL.plinthW, COL.plinthH, COL.plinthW, { bevel: 0.06, rng, jitter: 0.012, chip: 0.5 });
  bin.add('stone', columnStone(pl, seed, StoneColors.plainDark));
  const ring = lathe([[0.56, 0], [0.58, 0.08], [0.52, 0.16], [0.47, COL.baseH]], 12);
  ring.translate(0, COL.plinthH, 0);
  bin.add('stone', columnStone(ring, seed + 1));
  return COL.plinthH + COL.baseH;
}

/** Capital: flared echinus + carved abacus, built upright with its base at y = 0. */
function columnCapital(rng: Rng, seed: number): THREE.BufferGeometry[] {
  const ech = lathe([[COL.rTop + 0.02, 0], [COL.rTop + 0.06, 0.06], [0.5, 0.22], [0.6, COL.capH]], 12);
  columnStone(ech, seed, StoneColors.plain);
  const ab = chamferBlock(1.2, COL.abacusH, 1.2, { bevel: 0.05, rng, jitter: 0.01, chip: 0.4 });
  ab.translate(0, COL.capH, 0);
  columnStone(ab, seed + 1, StoneColors.plainLight, 1);
  const out = [ech, ab];
  // ember-sun medallions on the four abacus faces
  for (let i = 0; i < 4; i++) {
    const g = glyph(i % 2 === 0 ? 'sun' : 'flame', 0.26, 0.04);
    g.translate(0, COL.capH + COL.abacusH / 2, 0.6);
    g.rotateY((i * Math.PI) / 2);
    out.push(trim(g, { seed: seed + 3 + i, color: StoneColors.plainLight, moss: 0.4, creep: 0, dirt: 0 }));
  }
  return out;
}

/** Shaft drums stacked from y0 to y1 (last one may be broken). Returns drum heights used. */
function shaftDrums(bin: PartBin, rng: Rng, seed: number, y0: number, y1: number, brokenTopY?: number): void {
  let y = y0;
  let k = 0;
  const total = COL.shaftH;
  while (y < y1 - 0.05) {
    const h = Math.min(rng.range(0.78, 1.0), y1 - y);
    const t0 = (y - y0) / total;
    const t1 = (y + h - y0) / total;
    const r0 = COL.rBottom + (COL.rTop - COL.rBottom) * t0;
    const r1 = COL.rBottom + (COL.rTop - COL.rBottom) * t1;
    let g = drum(r0, r1, h - 0.02);
    g.rotateY(rng.range(0, 0.5));
    if (brokenTopY !== undefined && y + h >= y1 - 0.05) g = breakTop(g, rng, h - 0.02, 0.35);
    g.translate(rng.range(-0.015, 0.015), y, rng.range(-0.015, 0.015));
    const c = new THREE.Color(StoneColors.plain).multiplyScalar(rng.range(0.92, 1.06));
    bin.add('stone', columnStone(g, seed + k, c));
    // carved glyph band on the second drum
    if (k === 1) {
      for (let i = 0; i < 4; i++) {
        const gl = glyph((['sun', 'spiral', 'mask', 'wave'] as GlyphKind[])[i], 0.24, 0.04);
        gl.translate(0, y + h * 0.5, (r0 + r1) / 2 * 0.86);
        gl.rotateY((i * Math.PI) / 2 + 0.3);
        bin.add('stone', trim(gl, { seed: seed + 40 + i, color: StoneColors.plainLight, moss: 0.3, creep: 0, dirt: 0 }));
      }
    }
    y += h;
    k++;
  }
}

/** Jagged broken top: vertices near the top are displaced down randomly (flat shading keeps it chunky). */
function breakTop(geo: THREE.BufferGeometry, rng: Rng, h: number, depth: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const offs = new Map<string, number>();
  const tilt = rng.range(0, Math.PI * 2);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < h - 1e-3) continue;
    const x = p.getX(i);
    const z = p.getZ(i);
    const key = `${x.toFixed(3)},${z.toFixed(3)}`;
    let o = offs.get(key);
    if (o === undefined) {
      o = rng.range(0, depth) + Math.max(0, Math.cos(Math.atan2(z, x) - tilt)) * depth * 0.8;
      offs.set(key, o);
    }
    p.setY(i, y - o);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Lying drum (axis along local X rotated by yaw), resting on the ground. */
function lyingDrum(bin: PartBin, rng: Rng, seed: number, x: number, z: number, yaw: number, h: number, r: number, colliders: LocalCollider[]): void {
  const g = drum(r, r * 0.97, h);
  g.translate(0, -h / 2, 0);
  g.rotateY(rng.range(0, 1));
  g.rotateZ(Math.PI / 2);
  g.rotateY(yaw);
  g.translate(x, r * 0.93, z);
  bin.add('stone', columnStone(g, seed, StoneColors.plain, 0.9));
  colliders.push({ type: 'box', x, z, halfX: h / 2, halfZ: r * 0.9, yaw, yMin: 0, yMax: r * 1.8, tag: 'rubble' });
}

/**
 * ~5 m carved column with plinth, ring base, fluted drums (glyph band) and a flared capital.
 * 'broken': snapped at a random height with drums and capital on the ground.
 * 'fallen': only the base and first drum stand, the drums lie in a line.
 */
export function column(kind: 'intact' | 'broken' | 'fallen', seed = 1): PropDefinition {
  const rng = new Rng(7700 + seed * 37 + (kind === 'broken' ? 1 : kind === 'fallen' ? 2 : 0) * 1000);
  const bin = new PartBin();
  const colliders: LocalCollider[] = [];
  const y0 = columnBase(bin, rng, seed);
  const shaftTop = y0 + COL.shaftH;
  let height = shaftTop + COL.capH + COL.abacusH;

  if (kind === 'intact') {
    shaftDrums(bin, rng, seed + 10, y0, shaftTop);
    for (const g of columnCapital(rng, seed + 20)) {
      g.translate(0, shaftTop, 0);
      bin.add('stone', g, { seeThrough: true });
    }
    mossOnRect(bin, rng, -0.45, 0.45, -0.45, 0.45, height, 3, 0.55);
    const d = mossDrape(rng, 0.7, 1.6, 3);
    bin.add('vertexColor', placed(d, 0.1, shaftTop + COL.capH + 0.05, 0.62), HIGH);
  } else if (kind === 'broken') {
    const breakY = y0 + rng.range(1.4, 3.0);
    height = breakY;
    shaftDrums(bin, rng, seed + 10, y0, breakY, breakY);
    // fallen pieces: one or two drums and the capital
    const dir = rng.range(0, Math.PI * 2);
    let dist = 1.6;
    const pieces = rng.int(1, 2);
    for (let i = 0; i < pieces; i++) {
      const yaw = dir + rng.range(-0.5, 0.5) + Math.PI / 2;
      lyingDrum(bin, rng, seed + 60 + i, Math.cos(dir) * dist, Math.sin(dir) * dist, yaw, rng.range(0.8, 0.95), COL.rTop + 0.03, colliders);
      dist += 1.2 + rng.range(0, 0.4);
    }
    const capParts = columnCapital(rng, seed + 20);
    const cx = Math.cos(dir + 0.5) * (dist + 0.2);
    const cz = Math.sin(dir + 0.5) * (dist + 0.2);
    const tiltA = rng.range(-0.08, 0.08);
    const capYaw = rng.range(0, Math.PI);
    for (const g of capParts) {
      // upside down, resting on the abacus
      g.translate(0, -(COL.capH + COL.abacusH), 0);
      g.rotateX(Math.PI + tiltA);
      g.rotateY(capYaw);
      g.translate(cx, -0.02, cz);
      bin.add('stone', g);
    }
    colliders.push({ type: 'circle', x: cx, z: cz, radius: 0.6, yMin: 0, yMax: 0.8, tag: 'rubble' });
    for (let i = 0; i < 8; i++) {
      const g = rubbleChunk(rng, rng.range(0.12, 0.3));
      g.translate(Math.cos(dir) * rng.range(0.6, dist) + rng.range(-0.5, 0.5), -0.02, Math.sin(dir) * rng.range(0.6, dist) + rng.range(-0.5, 0.5));
      bin.add('stone', trim(g, { seed: seed + 80 + i, moss: 0.6, creep: 0 }));
    }
    mossOnRect(bin, rng, -0.3, 0.3, -0.3, 0.3, breakY - 0.25, 2, 0.4);
  } else {
    const standH = rng.range(0.75, 1.0);
    height = y0 + standH;
    shaftDrums(bin, rng, seed + 10, y0, y0 + standH, y0 + standH);
    const dir = rng.range(0, Math.PI * 2);
    const yaw = -dir;
    let dist = 0.9;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const h = rng.range(0.8, 0.95);
      dist += h / 2 + 0.06 + rng.range(0, 0.12);
      const off = rng.range(-0.12, 0.12);
      lyingDrum(bin, rng, seed + 60 + i, Math.cos(dir) * dist - Math.sin(dir) * off, Math.sin(dir) * dist + Math.cos(dir) * off, yaw + rng.range(-0.12, 0.12), h, COL.rBottom - i * 0.015, colliders);
      dist += h / 2;
    }
    dist += 0.7;
    const capParts = columnCapital(rng, seed + 20);
    for (const g of capParts) {
      g.translate(0, -0.34, 0);
      g.rotateX(Math.PI * 0.62);
      g.rotateY(yaw + rng.range(-0.3, 0.3));
      g.translate(Math.cos(dir) * dist, 0.42, Math.sin(dir) * dist);
      bin.add('stone', g);
    }
    colliders.push({ type: 'circle', x: Math.cos(dir) * dist, z: Math.sin(dir) * dist, radius: 0.6, yMin: 0, yMax: 1.1, tag: 'rubble' });
    mossOnRect(bin, rng, -0.3, 0.3, -0.3, 0.3, height - 0.2, 2, 0.4);
  }
  colliders.push({ type: 'circle', x: 0, z: 0, radius: 0.58, yMin: 0, yMax: height, tag: 'column' });
  return { name: `column-${kind}`, parts: bin.parts(), colliders };
}

// ---------------------------------------------------------------------------
// Free-standing archway
// ---------------------------------------------------------------------------

/**
 * Free-standing ruined pointed arch. `width` / `height` are the CLEAR opening (walkable) width
 * and apex height; the legs add ~1-1.5 m per side and the masonry ~1-2 m on top.
 * Colliders on the two legs only.
 */
export function archway(opts: { width: number; height: number; seed?: number }): PropDefinition {
  const w = Math.max(1.6, opts.width);
  const h = Math.max(2.4, opts.height);
  const seed = opts.seed ?? 3;
  const rng = new Rng(5100 + seed * 17);
  const bin = new PartBin();
  const a = w / 2;
  const rise = clamp(Math.max(a * 1.3, h * 0.42), a * 1.05, h - 1.0);
  const arch = new PointedArch(a, h - rise, rise);
  const lw = clamp(w * 0.3, 0.9, 1.6);
  const d = clamp(w * 0.32, 1.0, 1.6);
  const t = clamp(w * 0.15, 0.42, 0.75);
  const z0 = -d / 2;
  const z1 = d / 2;
  const xo = a + lw;
  const extApex = arch.point(1, t)[1];
  const tops = brokenTop(rng, -xo, xo, extApex + 0.55, extApex + 0.55 + COURSE * 2, COURSE * 0.5, 0.5, 1.1, (tt) => 1.2 - Math.abs(tt - 0.5) * 1.6);
  // the outer corners crumble lower (legs)
  for (const s of tops) {
    const edge = Math.min(s.x0 + xo, xo - s.x1);
    if (edge < lw * 0.7) s.y = Math.max(arch.springY + COURSE, s.y - COURSE * rng.int(1, 3) * 0.5);
  }
  const topAt = (x: number): number => {
    for (const s of tops) if (x >= s.x0 - 1e-4 && x <= s.x1 + 1e-4) return s.y;
    return extApex;
  };
  const wall = stripWall({
    tops,
    z0,
    z1,
    bottom: (x) => (Math.abs(x) < a ? arch.heightAt(x) : 0),
    breaks: archBreaks(arch),
    stripW: 0.42,
  });
  const tall = { seeThrough: true };
  bin.add('stoneBlocks', masonry(wall, { seed, topAt: (x) => topAt(x), creep: 0.7 }), tall);
  for (const s of tops) mossOnRect(bin, rng, s.x0 + 0.1, s.x1 - 0.1, z0 + 0.15, z1 - 0.15, s.y, 1, 0.55);

  for (const face of [1, -1]) {
    const ring = voussoirRing(arch, { inner: 0, thickness: t, zBack: z1 - 0.04, zFront: z1 + 0.16, count: Math.max(5, Math.round(arch.rise * 1.6)), rng, stagger: 0.03 });
    if (face < 0) ring.rotateY(Math.PI);
    bin.add('stone', trim(ring, { seed: seed + (face > 0 ? 5 : 6), color: face > 0 ? StoneColors.plainLight : StoneColors.plain, creep: 0.1 }), tall);
    for (const side of [-1, 1]) {
      const imp = chamferBlock(t + 0.35, 0.3, 0.3, { bevel: 0.05, rng });
      imp.translate(side * (a + t / 2), arch.springY - 0.3, face * (z1 + 0.06));
      bin.add('stone', trim(imp, { seed: seed + 9, color: StoneColors.plainLight }), tall);
    }
  }
  // keystone with a small sun
  const key = chamferBlock(t * 1.2, t * 1.9, d + 0.42, { bevel: 0.06, rng });
  key.translate(0, arch.apexY - t * 0.25, 0);
  bin.add('stone', trim(key, { seed: seed + 11, color: StoneColors.plainLight }), tall);
  for (const face of [1, -1]) {
    const g = glyph('sun', t * 0.95, 0.05);
    g.translate(0, arch.apexY + t * 0.65, d / 2 + 0.21);
    if (face < 0) g.rotateY(Math.PI);
    bin.add('stone', trim(g, { seed: seed + 12, color: 0xd6cdb0, moss: 0.3, dirt: 0 }), tall);
  }
  // leg plinths
  for (const side of [-1, 1]) {
    const pl = chamferBlock(lw + 0.25, 0.55, d + 0.3, { bevel: 0.12, rng, jitter: 0.015 });
    pl.translate(side * (a + lw / 2), 0, 0);
    bin.add('stoneBlocks', masonry(pl, { seed: seed + 20 + side, creep: 0.15 }));
  }
  // drapes & a vine
  const dx = rng.range(-a * 0.6, a * 0.6);
  bin.add('vertexColor', placed(mossDrape(rng, 1.0, Math.min(1.6, h * 0.3), 4), dx, topAt(dx) + 0.03, z1 + 0.03), HIGH);
  const vx = rng.chance(0.5) ? -a - lw * 0.5 : a + lw * 0.5;
  bin.add('vertexColor', placed(vineStrand(rng, Math.min(3, h * 0.6), 0.3), vx, topAt(vx), z1 + 0.05), HIGH);
  // rubble at the feet
  for (let i = 0; i < 6; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    const g = rubbleChunk(rng, rng.range(0.15, 0.35));
    g.translate(side * (a + lw * rng.range(0.2, 1.4)), -0.02, rng.range(-1.2, 1.2) * d);
    bin.add('stone', trim(g, { seed: seed + 30 + i, moss: 0.6, creep: 0 }));
  }
  const yMax = Math.max(...tops.map((s) => s.y));
  const colliders: LocalCollider[] = [];
  for (const side of [-1, 1]) {
    const x0 = side * a;
    const x1 = side * (a + lw + 0.1);
    colliders.push(boxCollider(Math.min(x0, x1), Math.max(x0, x1), z0 - 0.2, z1 + 0.2, 0, yMax, 'wall'));
  }
  return { name: 'archway', parts: bin.parts(), colliders };
}

// ---------------------------------------------------------------------------
// Stone stairs
// ---------------------------------------------------------------------------

/**
 * Stone steps rising along +Z from y = 0 (front edge at z = -run/2) to y = rise (back edge at
 * z = +run/2), centred on x = 0, with sloped cheek walls on both sides and moss in the corners.
 * Walkable as one ramp platform (slope = rise / run, thickness 3). Cheek walls are colliders.
 */
export function stoneStairs(opts: { width: number; steps: number; rise: number; run: number; seed?: number }): PropDefinition {
  const W = Math.max(1, opts.width);
  const N = Math.max(1, Math.round(opts.steps));
  const rise = Math.max(0.1, opts.rise);
  const run = Math.max(0.3, opts.run);
  const seed = opts.seed ?? 1;
  const rng = new Rng(3300 + seed * 13);
  const bin = new PartBin();
  const sr = rise / N;
  const tr = run / N;
  const cheekW = 0.62;
  const z0 = -run / 2;

  for (let k = 0; k < N; k++) {
    const zk = z0 + (k + 0.5) * tr;
    const zEnd = k === N - 1 ? run / 2 : zk + tr;
    const yTop = (k + 1) * sr;
    const yBot = Math.min(k * sr, yTop - sr) - 0.12;
    // 1-3 slabs across the width
    const nSlabs = Math.max(1, Math.round(W / rng.range(1.2, 1.8)));
    let x = -W / 2;
    for (let i = 0; i < nSlabs; i++) {
      const sw = i === nSlabs - 1 ? W / 2 - x : (W / nSlabs) * rng.range(0.85, 1.15);
      const dy = rng.range(-0.015, 0.012);
      const depth = zEnd - zk + 0.05;
      const b = chamferBlock(sw - 0.03, yTop - yBot + dy, depth, { bevel: Math.min(0.05, sr * 0.25), chamfer: 0.03, rng, jitter: 0.008, chip: 0.3 });
      b.rotateY(rng.range(-0.01, 0.01));
      b.translate(x + sw / 2, yBot, zk + depth / 2 - 0.02);
      const c = new THREE.Color(StoneColors.plain).multiplyScalar(rng.range(0.9, 1.07));
      bin.add('stone', trim(b, { seed: seed + k * 7 + i, color: c, moss: 0.35, creep: 0.05, tile: 1.8 }));
      x += sw;
    }
    // moss where the tread meets the next riser (strongest in the corners)
    if (k < N - 1) {
      const zc = zk + tr - 0.04;
      for (const side of [-1, 1]) {
        if (!rng.chance(0.75)) continue;
        const m = mossClump(rng, rng.range(0.35, 0.7), 0.28, 0.12, 0);
        m.translate(side * (W / 2 - rng.range(0.1, 0.25)), yTop - 0.02, zc - 0.08);
        bin.add('vertexColor', m, { castShadow: false });
      }
      if (rng.chance(0.4)) {
        const m = mossClump(rng, rng.range(0.3, 0.6), 0.22, 0.1, 0);
        m.translate(rng.range(-W / 2 + 0.4, W / 2 - 0.4), yTop - 0.02, zc - 0.06);
        bin.add('vertexColor', m, { castShadow: false });
      }
    }
  }

  // cheek walls with a sloped coping
  const slopeA = Math.atan2(rise, run);
  for (const side of [-1, 1]) {
    const xc = side * (W / 2 + cheekW / 2);
    const mb = new MeshBuilder();
    const xa = xc - cheekW / 2;
    const xb = xc + cheekW / 2;
    const za = z0 - 0.15;
    const zb = run / 2 + 0.05;
    const yA = 0.5;
    const yB = rise + 0.5;
    const prof: Array<[number, number]> = [
      [za, -0.15],
      [zb, -0.15],
      [zb, yB],
      [za, yA],
    ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const [pz0, py0] = prof[i];
      const [pz1, py1] = prof[j];
      const hint: Vec3 = [0, pz1 - pz0, -(py1 - py0)];
      // outward for a CCW profile in (z, y): (dy, -dz) -> here flip to point away from the centre
      const cz = (za + zb) / 2;
      const cy = (yA + yB) / 4;
      const mz = (pz0 + pz1) / 2 - cz;
      const my = (py0 + py1) / 2 - cy;
      if (hint[1] * mz + hint[2] * my < 0) {
        hint[1] = -hint[1];
        hint[2] = -hint[2];
      }
      mb.quad([xa, py0, pz0], [xa, py1, pz1], [xb, py1, pz1], [xb, py0, pz0], hint);
    }
    mb.poly(prof.map(([pz, py]): Vec3 => [xa, py, pz]), [-1, 0, 0]);
    mb.poly(prof.map(([pz, py]): Vec3 => [xb, py, pz]), [1, 0, 0]);
    const cheek = mb.build();
    bin.add('stoneBlocks', masonry(cheek, { seed: seed + 100 + side, creep: 0.4, top: rise + 0.5 }));
    // coping stones following the slope
    const len = Math.hypot(run + 0.2, rise);
    const nCope = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i < nCope; i++) {
      const t0 = i / nCope;
      const cl = len / nCope;
      const c = chamferBlock(cheekW + 0.12, 0.2, cl - 0.03, { bevel: 0.04, rng, jitter: 0.008, chip: 0.3 });
      c.translate(0, 0, cl / 2);
      c.rotateX(-slopeA);
      c.translate(xc, yA - 0.04 + t0 * (yB - yA), za + t0 * (zb - za));
      bin.add('stone', trim(c, { seed: seed + 120 + i, color: StoneColors.plainLight, moss: 0.95, creep: 0.05 }));
      if (rng.chance(0.5)) {
        const m = mossClump(rng, 0.5, 0.4, 0.12, 0);
        m.rotateX(-slopeA);
        m.translate(xc, yA + 0.14 + (t0 + 0.5 / nCope) * (yB - yA), za + (t0 + 0.5 / nCope) * (zb - za));
        bin.add('vertexColor', m, { castShadow: false });
      }
    }
  }

  const platform: LocalPlatform = { x: 0, z: 0, halfX: W / 2, halfZ: run / 2, yaw: 0, height: rise / 2, slope: rise / run, thickness: 3, surface: 'stone' };
  const colliders: LocalCollider[] = [];
  for (const side of [-1, 1]) {
    const x0 = side * (W / 2 + 0.04);
    const x1 = side * (W / 2 + cheekW);
    colliders.push(boxCollider(Math.min(x0, x1), Math.max(x0, x1), z0 - 0.1, run / 2, 0, rise + 0.6, 'wall'));
  }
  return { name: 'stone-stairs', parts: bin.parts(), colliders, platforms: [platform] };
}

// ---------------------------------------------------------------------------
// Paving
// ---------------------------------------------------------------------------

const PAVE_COLORS = [0xb9ad92, 0xaea58c, 0xc2b597, 0xa39c86, 0xb5ab8a, 0xa8a48a];

/**
 * Broken plaza paving covering a disc: irregular flat slabs raised 2-6 cm, some missing
 * (clustered), a green moss/grass bed showing in the joints and holes, a few tufts. No colliders.
 * Place on flat ground (slab bodies reach 10 cm below y = 0).
 */
export function pavingSlabs(opts: { radius: number; seed?: number; coverage?: number }): PropDefinition {
  const R = Math.max(1, opts.radius);
  const seed = opts.seed ?? 1;
  const coverage = clamp(opts.coverage ?? 0.85, 0, 1);
  const rng = new Rng(6100 + seed * 7);
  const bin = new PartBin();
  const slabs: THREE.BufferGeometry[] = [];
  const holeNoise = (x: number, z: number): number => Math.sin(x * 0.55 + seed) * Math.sin(z * 0.61 - seed * 0.7) + Math.sin(x * 1.3 - z * 0.9 + seed * 2.1) * 0.5;
  let z = -R;
  while (z < R) {
    const rowH = rng.range(0.6, 1.15);
    let x = -R - rng.range(0, 0.9);
    while (x < R) {
      const sw = rng.range(0.5, 1.35);
      const cx = x + sw / 2;
      const cz = z + rowH / 2;
      x += sw;
      const r = Math.hypot(cx, cz);
      const edge = R * (0.92 + 0.08 * Math.sin(Math.atan2(cz, cx) * 5 + seed));
      if (r > edge) continue;
      // missing slabs: clustered holes, more towards the rim
      const rim = clamp((r / R - 0.65) / 0.35, 0, 1);
      const missing = (1 - coverage) * (0.45 + 0.85 * Math.max(0, holeNoise(cx, cz))) + rim * rim * 0.35;
      if (rng.next() < missing) continue;
      const j = 0.035;
      const hw = sw / 2 - 0.022;
      const hd = rowH / 2 - 0.022;
      const quad: Array<[number, number]> = [
        [cx - hw + rng.range(-j, j), cz - hd + rng.range(-j, j)],
        [cx + hw + rng.range(-j, j), cz - hd + rng.range(-j, j)],
        [cx + hw + rng.range(-j, j), cz + hd + rng.range(-j, j)],
        [cx - hw + rng.range(-j, j), cz + hd + rng.range(-j, j)],
      ];
      const top = rng.range(0.02, 0.06);
      const pieces: Array<Array<[number, number]>> = [];
      if (rng.chance(0.12)) {
        // cracked slab: split along a diagonal-ish line with a small gap
        const m0: [number, number] = [(quad[0][0] + quad[1][0]) / 2 + rng.range(-0.1, 0.1), (quad[0][1] + quad[1][1]) / 2];
        const m1: [number, number] = [(quad[2][0] + quad[3][0]) / 2 + rng.range(-0.1, 0.1), (quad[2][1] + quad[3][1]) / 2];
        pieces.push([quad[0], [m0[0] - 0.02, m0[1]], [m1[0] - 0.02, m1[1]], quad[3]]);
        pieces.push([[m0[0] + 0.02, m0[1]], quad[1], quad[2], [m1[0] + 0.02, m1[1]]]);
      } else pieces.push(quad);
      for (const pc of pieces) {
        const t = top + rng.range(-0.01, 0.01);
        const g = bevelSlab(pc, -0.1, t, 0.03);
        const tiltX = rng.range(-0.012, 0.012);
        const tiltZ = rng.range(-0.012, 0.012);
        g.translate(-cx, 0, -cz);
        g.rotateX(tiltX);
        g.rotateZ(tiltZ);
        g.translate(cx, 0, cz);
        planarUV(g, 1.7, rng.next(), rng.next());
        const col = new THREE.Color(rng.pick(PAVE_COLORS)).multiplyScalar(rng.range(0.92, 1.06));
        shade(g, { base: col, vary: 0.08, varyScale: 1.6, moss: StoneColors.plainMoss, mossAmount: clamp(0.25 + rim * 0.5 + rng.range(-0.2, 0.25), 0, 0.9), mossUp: 0.9, seed: cx * 3 + cz });
        // darker worn edges (dirt in joints)
        const pos = g.attributes.position;
        const colA = g.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) if (pos.getY(i) < t - 0.025) colA.setXYZ(i, colA.getX(i) * 0.72, colA.getY(i) * 0.72, colA.getZ(i) * 0.68);
        slabs.push(g);
      }
      // grass tuft in a joint corner
      if (rng.chance(0.08)) {
        const corner = quad[rng.int(0, 3)];
        bin.add('vertexColor', grassTuft(rng, corner[0], corner[1]), { castShadow: false });
      }
    }
    z += rowH;
  }
  for (const g of slabs) bin.add('stone', g);

  // green bed under the slabs (visible in joints and holes)
  const bed = new MeshBuilder();
  const seg = 40;
  const ring: Vec3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const rr = R * (0.84 + 0.05 * Math.sin(a * 5 + seed));
    ring.push([Math.cos(a) * rr, 0.012, Math.sin(a) * rr]);
  }
  for (let i = 0; i < seg; i++) bed.tri([0, 0.012, 0], ring[i], ring[(i + 1) % seg], [0, 1, 0]);
  const bedG = bed.build();
  shade(bedG, { base: 0x5d6e36, vary: 0.25, varyScale: 0.5, seed });
  bin.add('vertexColor', bedG, { castShadow: false, });
  // a few moss cushions in holes
  for (let i = 0; i < Math.round(R * 1.5); i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * R * 0.95;
    const m = mossClump(rng, rng.range(0.3, 0.6), rng.range(0.25, 0.5), 0.07, 0);
    m.translate(Math.cos(a) * r, 0.0, Math.sin(a) * r);
    bin.add('vertexColor', m, { castShadow: false });
  }
  const parts = bin.parts();
  for (const p of parts) p.castShadow = false;
  return { name: 'paving', parts };
}

/** Tiny grass tuft (3 blades, vertexColor) - static, no wind (safe in batched props). */
function grassTuft(rng: Rng, x: number, z: number): THREE.BufferGeometry {
  const mb = new MeshBuilder();
  const n = 3 + rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const h = rng.range(0.12, 0.28);
    const lean = rng.range(0.03, 0.09);
    const bx = x + rng.range(-0.05, 0.05);
    const bz = z + rng.range(-0.05, 0.05);
    const w = 0.025;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    const tip: Vec3 = [bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean];
    mb.tri([bx - px, 0, bz - pz], [bx + px, 0, bz + pz], tip, [Math.cos(a + Math.PI / 2), 0.3, Math.sin(a + Math.PI / 2)]);
    mb.tri([bx - px, 0, bz - pz], [bx + px, 0, bz + pz], tip, [-Math.cos(a + Math.PI / 2), 0.3, -Math.sin(a + Math.PI / 2)]);
  }
  const g = mb.build();
  paintGradient(g, 0x4f7426, 0x9bbf4a);
  return g;
}

function paintGradient(g: THREE.BufferGeometry, bottom: THREE.ColorRepresentation, top: THREE.ColorRepresentation): void {
  g.computeBoundingBox();
  const y0 = g.boundingBox!.min.y;
  const y1 = g.boundingBox!.max.y;
  const cb = new THREE.Color(bottom);
  const ct = new THREE.Color(top);
  const c = new THREE.Color();
  const p = g.attributes.position;
  const col = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    c.copy(cb).lerp(ct, clamp((p.getY(i) - y0) / Math.max(1e-4, y1 - y0), 0, 1));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Guardian statue
// ---------------------------------------------------------------------------

/** Tapered box between two points (limbs), flat shaded. */
function limb(a: Vec3, b: Vec3, ra: number, rb: number, sides = 5): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rb, ra, 1, sides, 1, false);
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  g.scale(1, len, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyQuaternion(q);
  g.translate(va.x, va.y, va.z);
  return g.toNonIndexed();
}

function blob(rng: Rng, rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + rng.range(-0.06, 0.06);
    p.setXYZ(i, p.getX(i) * rx * k, p.getY(i) * ry * k, p.getZ(i) * rz * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Weathered guardian statue on a carved plinth (~4.3 m): a robed figure wearing an Ember-King
 * mask with a sun-ray crown. variant 0: holds a spear; variant 1: offers an ember bowl.
 * Circle collider.
 */
export function statue(variant = 0): PropDefinition {
  const v = Math.abs(Math.round(variant)) % 2;
  const rng = new Rng(8800 + v * 31);
  const bin = new PartBin();
  const fig: THREE.BufferGeometry[] = [];
  const stoneC = 0xb2ab94;

  // plinth: base slab, pedestal with glyph band, cap
  const base = chamferBlock(1.6, 0.3, 1.6, { bevel: 0.06, rng, jitter: 0.012, chip: 0.5 });
  bin.add('stone', trim(base, { seed: 1, color: StoneColors.plainDark, moss: 0.9 }));
  const ped = chamferBlock(1.2, 0.75, 1.2, { bevel: 0.05, rng, jitter: 0.01, chip: 0.3 });
  ped.translate(0, 0.3, 0);
  bin.add('stoneBlocks', masonry(ped, { seed: 2, creep: 0.2, courseBase: 0.3 }));
  const kinds: GlyphKind[] = v === 0 ? ['sun', 'mask', 'spiral', 'flame'] : ['flame', 'eye', 'wave', 'sun'];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Matrix4().makeRotationY((i * Math.PI) / 2).multiply(new THREE.Matrix4().makeTranslation(0, 0.67, 0.6));
    glyphStrip(bin, [kinds[i]], 0.55, false, m, 10 + i, StoneColors.ochre);
  }
  const cap = chamferBlock(1.42, 0.2, 1.42, { bevel: 0.05, rng, jitter: 0.01, chip: 0.4 });
  cap.translate(0, 1.05, 0);
  bin.add('stone', trim(cap, { seed: 3, color: StoneColors.plainLight, moss: 1 }));
  const y0 = 1.25;

  // feet block + robe
  const feet = chamferBlock(0.8, 0.14, 0.62, { bevel: 0.03, rng });
  feet.translate(0, y0, 0.02);
  fig.push(feet);
  const robe = prism(
    [[-0.42, -0.26], [0.42, -0.26], [0.46, 0.18], [0.2, 0.32], [-0.2, 0.32], [-0.46, 0.18]],
    y0 + 0.12,
    y0 + 1.35,
    { topScale: 0.78, segY: 2 },
  );
  fig.push(robe);
  // front robe panel (folds)
  for (const fx of [-0.12, 0, 0.12]) fig.push(limb([fx, y0 + 0.15, 0.31], [fx * 0.8, y0 + 1.25, 0.25], 0.06, 0.04, 4));
  // belt with ember buckle
  const belt = prism([[-0.36, -0.22], [0.36, -0.22], [0.38, 0.14], [0.17, 0.27], [-0.17, 0.27], [-0.38, 0.14]], y0 + 1.3, y0 + 1.44);
  fig.push(belt);
  const buckle = glyph('sun', 0.22, 0.04);
  buckle.translate(0, y0 + 1.37, 0.27);
  fig.push(buckle);
  // torso (wider at the shoulders) + chest plate
  const torso = prism([[-0.32, -0.2], [0.32, -0.2], [0.34, 0.14], [0.16, 0.24], [-0.16, 0.24], [-0.34, 0.14]], y0 + 1.42, y0 + 2.12, { topScale: 1.28, segY: 2 });
  fig.push(torso);
  // mantle hanging behind
  const mantle = chamferBlock(0.9, 1.75, 0.12, { bevel: 0.03, rng });
  mantle.rotateX(-0.08);
  mantle.translate(0, y0 + 0.3, -0.3);
  fig.push(mantle);
  // shoulders
  for (const side of [-1, 1]) {
    const sh = blob(rng, 0.2, 0.15, 0.2);
    sh.translate(side * 0.42, y0 + 2.08, 0);
    fig.push(sh);
  }
  // neck + head
  fig.push(limb([0, y0 + 2.1, 0], [0, y0 + 2.26, 0], 0.11, 0.1, 6));
  const head = chamferBlock(0.34, 0.4, 0.36, { bevel: 0.06, rng });
  head.translate(0, y0 + 2.22, -0.02);
  fig.push(head);
  // Ember-King mask (proud of the face) + sun-ray crown fanning behind the head
  const mask = glyph('mask', 0.5, 0.08);
  mask.translate(0, y0 + 2.43, 0.16);
  fig.push(mask);
  for (let i = 0; i < 9; i++) {
    const a = -1.15 + (i / 8) * 2.3;
    const len = i % 2 === 0 ? 0.55 : 0.38;
    const ray = limb([Math.sin(a) * 0.12, y0 + 2.5 + Math.cos(a) * 0.08, -0.06], [Math.sin(a) * (0.12 + len), y0 + 2.5 + Math.cos(a) * (0.08 + len), -0.1], 0.07, 0.015, 4);
    fig.push(ray);
  }
  const halo = lathe([[0.17, 0], [0.2, 0.05], [0.17, 0.1]], 10);
  halo.rotateX(Math.PI / 2);
  halo.translate(0, y0 + 2.5, -0.12);
  fig.push(halo);

  if (v === 0) {
    // spear in the right hand, left fist on the chest
    const sx = 0.62;
    fig.push(limb([0.44, y0 + 2.02, 0], [0.56, y0 + 1.6, 0.12], 0.09, 0.08, 5));
    fig.push(limb([0.56, y0 + 1.6, 0.12], [sx, y0 + 1.58, 0.3], 0.08, 0.07, 5));
    const fist = blob(rng, 0.09, 0.1, 0.09);
    fist.translate(sx, y0 + 1.6, 0.3);
    fig.push(fist);
    fig.push(limb([sx, y0 + 0.14, 0.3], [sx, y0 + 2.74, 0.3], 0.05, 0.045, 5));
    const blade = blob(rng, 0.11, 0.28, 0.035);
    blade.translate(sx, y0 + 2.96, 0.3);
    fig.push(blade);
    const guard = chamferBlock(0.24, 0.06, 0.08, { bevel: 0.015 });
    guard.translate(sx, y0 + 2.7, 0.3);
    fig.push(guard);
    fig.push(limb([-0.44, y0 + 2.02, 0], [-0.4, y0 + 1.62, 0.1], 0.09, 0.08, 5));
    fig.push(limb([-0.4, y0 + 1.62, 0.1], [-0.08, y0 + 1.82, 0.28], 0.08, 0.07, 5));
    const fistL = blob(rng, 0.09, 0.1, 0.09);
    fistL.translate(-0.06, y0 + 1.84, 0.28);
    fig.push(fistL);
  } else {
    // both hands offering a wide ember bowl
    for (const side of [-1, 1]) {
      fig.push(limb([side * 0.44, y0 + 2.02, 0], [side * 0.42, y0 + 1.64, 0.12], 0.09, 0.08, 5));
      fig.push(limb([side * 0.42, y0 + 1.64, 0.12], [side * 0.24, y0 + 1.6, 0.5], 0.08, 0.07, 5));
    }
    const bowl = lathe([[0.16, 0], [0.3, 0.06], [0.42, 0.2], [0.44, 0.26], [0.36, 0.25], [0.26, 0.12], [0.0, 0.1]], 12);
    bowl.translate(0, y0 + 1.52, 0.56);
    fig.push(bowl);
  }

  const figure = jitter(mergeLocal(fig), 0.012, 3.0, 7);
  bin.add('stone', trim(figure, { seed: 20 + v, color: stoneC, moss: 0.9, creep: 0.12, tile: 1.5, dirt: 0.1 }), { seeThrough: true });
  if (v === 1) {
    const m = mossClump(rng, 0.55, 0.55, 0.12, 1);
    m.translate(0, y0 + 1.6, 0.56);
    bin.add('vertexColor', m, { castShadow: false });
  }
  // moss on the plinth and shoulders
  mossOnRect(bin, rng, -0.6, 0.6, -0.6, 0.6, 1.25, 3, 0.45);
  mossOnRect(bin, rng, -0.75, 0.75, 0.62, 0.75, 0.3, 2, 0.4);
  for (const side of [-1, 1]) {
    if (!rng.chance(0.7)) continue;
    const m = mossClump(rng, 0.3, 0.3, 0.1, 0);
    m.translate(side * 0.42, y0 + 2.16, 0);
    bin.add('vertexColor', m, HIGH);
  }
  const d = mossDrape(rng, 0.7, 0.8, 3);
  bin.add('vertexColor', placed(d, rng.range(-0.3, 0.3), 1.26, 0.72), { castShadow: false });
  return {
    name: `statue-${v}`,
    parts: bin.parts(),
    colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.82, yMin: 0, yMax: 4.2, tag: 'statue' }],
  };
}

function mergeLocal(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    x = dropAttrs(x);
    return x;
  });
  const total = prepared.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  let o = 0;
  for (const g of prepared) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nrm.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}

function dropAttrs(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  return g;
}

// ---------------------------------------------------------------------------
// Stele, altar, rubble
// ---------------------------------------------------------------------------

/** Carved monument stone (~2.6 m) with a round-topped slab, glyph relief panel and moss. */
export function stele(seed = 1): PropDefinition {
  const rng = new Rng(4400 + seed * 11);
  const bin = new PartBin();
  const b1 = chamferBlock(1.55, 0.32, 0.95, { bevel: 0.06, rng, jitter: 0.015, chip: 0.5 });
  bin.add('stone', trim(b1, { seed, color: StoneColors.plainDark, moss: 1 }));
  const b2 = chamferBlock(1.28, 0.18, 0.72, { bevel: 0.04, rng, jitter: 0.01 });
  b2.translate(0, 0.32, 0);
  bin.add('stone', trim(b2, { seed: seed + 1, moss: 1 }));
  // slab: rectangle with a slightly pointed round top, bevelled edges
  const W = 1.06;
  const H = 2.08;
  const T = 0.4;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2 * 0.97, H - W * 0.42);
  const n = 10;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    const x = Math.cos(a) * (W / 2) * 0.97;
    const y = H - W * 0.42 + Math.sin(a) * W * 0.42 * (1 + 0.15 * Math.sin(a));
    shape.lineTo(x, y);
  }
  shape.closePath();
  let slab: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, { depth: T - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 4 });
  slab.translate(0, 0, -(T - 0.08) / 2);
  slab = jitter(slab, 0.012, 2.2, seed);
  slab.rotateZ(rng.range(-0.03, 0.03));
  slab.translate(0, 0.5, 0);
  bin.add('stone', trim(slab, { seed: seed + 2, color: 0xb0aa93, moss: 1, creep: 0.45, tile: 1.6 }), { seeThrough: true });
  // recessed relief panel: frame + 3 rows of glyph pairs + a sun in the arch
  const fz = T / 2 + 0.005;
  const panel = chamferBlock(0.8, 0.03, 1.32, { bevel: 0.01 });
  panel.rotateX(Math.PI / 2);
  panel.translate(0, 1.38, fz);
  bin.add('stone', trim(panel, { seed: seed + 3, color: StoneColors.plainDark, moss: 0.2, creep: 0 }));
  const rows: GlyphKind[][] = [['eye', 'flame'], ['spiral', 'wave'], ['steps', 'mask']];
  rows.forEach((row, r) => {
    row.forEach((k, c) => {
      const g = glyph(k, 0.34, 0.035);
      g.translate((c - 0.5) * 0.38, 1.85 - r * 0.42, fz + 0.025);
      bin.add('stone', trim(g, { seed: seed + 10 + r * 2 + c, color: StoneColors.plainLight, moss: 0.3, creep: 0, dirt: 0 }));
    });
  });
  const sun = glyph('sun', 0.46, 0.05);
  sun.translate(0, 2.3, fz - 0.005);
  bin.add('stone', trim(sun, { seed: seed + 20, color: 0xd0c6a8, moss: 0.4, creep: 0, dirt: 0 }));
  // moss: cap on top, drape down one side, cushions on the base
  const top = mossClump(rng, 0.85, 0.45, 0.18, 1);
  top.translate(0.05, 0.5 + H - 0.05, 0);
  bin.add('vertexColor', top, { castShadow: false });
  const d = mossDrape(rng, 0.42, 1.3, 3);
  bin.add('vertexColor', placed(d, 0.36, 0.5 + H - 0.25, T / 2 + 0.02), { castShadow: false });
  mossOnRect(bin, rng, -0.7, 0.7, -0.42, 0.42, 0.5, 3, 0.4);
  return {
    name: 'stele',
    parts: bin.parts(),
    colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.72, halfZ: 0.44, yaw: 0, yMin: 0, yMax: 2.6, tag: 'monument' }],
  };
}

/** Low carved altar / pedestal (~1 m) with a glyph band and a shallow offering basin. */
export function altar(seed = 1): PropDefinition {
  const rng = new Rng(4800 + seed * 7);
  const bin = new PartBin();
  const base = chamferBlock(1.95, 0.2, 1.35, { bevel: 0.05, rng, jitter: 0.012, chip: 0.5 });
  bin.add('stone', trim(base, { seed, color: StoneColors.plainDark, moss: 1 }));
  const body = chamferBlock(1.6, 0.62, 1.02, { bevel: 0.04, rng, jitter: 0.01, chip: 0.3 });
  body.translate(0, 0.2, 0);
  bin.add('stoneBlocks', masonry(body, { seed: seed + 1, creep: 0.2, courseBase: 0.2 }));
  glyphStrip(bin, ['flame', 'sun', 'flame'], 0.42, false, mat(0, 0.51, 0.51), seed + 10, StoneColors.ochre);
  glyphStrip(bin, ['wave', 'spiral', 'wave'], 0.42, false, mat(0, 0.51, -0.51, Math.PI), seed + 20, StoneColors.ochre);
  for (const side of [-1, 1]) glyphStrip(bin, ['eye', 'mask'], 0.42, false, mat(side * 0.8, 0.51, 0, side * Math.PI / 2), seed + 30 + side, StoneColors.ochre);
  const top = chamferBlock(1.86, 0.18, 1.26, { bevel: 0.05, rng, jitter: 0.012, chip: 0.4 });
  top.translate(0, 0.82, 0);
  bin.add('stone', trim(top, { seed: seed + 2, color: StoneColors.plainLight, moss: 0.8 }));
  const basin = lathe([[0.42, 0], [0.44, 0.06], [0.42, 0.1], [0.34, 0.1], [0.3, 0.04], [0.0, 0.03]], 12);
  basin.translate(0, 1.0, 0);
  bin.add('stone', trim(basin, { seed: seed + 3, color: StoneColors.plain, moss: 0.4 }));
  const water = lathe([[0.31, 0], [0.0, 0]], 12);
  water.translate(0, 1.075, 0);
  shade(water, { base: 0x3d5a3a, vary: 0.1 });
  bin.add('vertexColor', water, { castShadow: false });
  mossOnRect(bin, rng, -0.85, 0.85, -0.55, 0.55, 1.0, 2, 0.35);
  mossOnRect(bin, rng, -0.9, 0.9, -0.6, 0.6, 0.2, 3, 0.35);
  return {
    name: 'altar',
    parts: bin.parts(),
    colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.92, halfZ: 0.62, yaw: 0, yMin: 0, yMax: 1.05, tag: 'altar' }],
  };
}

/** Scattered pile of fallen cut blocks and chunks with moss. */
export function rubblePile(seed = 1): PropDefinition {
  const rng = new Rng(5600 + seed * 19);
  const bin = new PartBin();
  const n = rng.int(5, 8);
  let maxY = 0.5;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 1.1;
    const stacked = i >= n - 2;
    const w = rng.range(0.55, 1.0);
    const h = rng.range(0.38, 0.6);
    const b = looseBlock(rng, w, h, rng.range(0.45, 0.75), seed * 10 + i, stacked ? 0.8 : 0.5);
    const y = stacked ? rng.range(0.25, 0.45) : -0.06;
    maxY = Math.max(maxY, y + h);
    bin.add('stoneBlocks', placed(b, Math.cos(a) * r * (stacked ? 0.4 : 1), y, Math.sin(a) * r * (stacked ? 0.4 : 1), rng.range(-0.35, 0.35), rng.range(0, Math.PI), rng.range(-0.35, 0.35)));
  }
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 0.4 + Math.sqrt(rng.next()) * 1.4;
    const g = rubbleChunk(rng, rng.range(0.12, 0.34));
    g.rotateY(rng.range(0, Math.PI));
    g.translate(Math.cos(a) * r, -0.02, Math.sin(a) * r);
    bin.add('stone', trim(g, { seed: seed + i, moss: 0.7, creep: 0 }));
  }
  mossOnRect(bin, rng, -1, 1, -1, 1, 0.02, 3, 0.5);
  return {
    name: 'rubble',
    parts: bin.parts(),
    colliders: [{ type: 'circle', x: 0, z: 0, radius: 1.0, yMin: 0, yMax: Math.min(1.1, maxY), tag: 'rubble' }],
  };
}

// ---------------------------------------------------------------------------
// Instanced path stones
// ---------------------------------------------------------------------------

const COBBLE_COLORS = [0xb8ab8f, 0xa99f88, 0xc4b79b, 0x9f9883];

/**
 * Flat irregular rounded path stone (0.25-0.5 m wide, 6-12 cm thick, top at ~y = 0.05, base
 * below ground). `stone` material, warm grey/beige vertex colours. 35 tris.
 */
export function cobblestone(variant = 0): InstancedAsset {
  const v = ((Math.round(variant) % 4) + 4) % 4;
  const rng = new Rng(1200 + v * 13);
  const rx = [0.24, 0.17, 0.2, 0.14][v];
  const rz = [0.18, 0.15, 0.13, 0.12][v];
  const pts = irregularPoly(rng, 7, rx, rz, 0.16);
  const thick = [0.12, 0.09, 0.1, 0.07][v];
  const g = bevelSlab(pts, 0.05 - thick, 0.05 - 0.012, 0.035, 0.014);
  planarUV(g, 0.9, v * 0.31, v * 0.17);
  shade(g, { base: COBBLE_COLORS[v], vary: 0.1, varyScale: 4, seed: v * 5 });
  const p = g.attributes.position;
  const col = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) < 0.02 ? 0.68 : 1;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return { name: `cobblestone-${v}`, parts: [{ geometry: dropFaces(g, [0, -1, 0]), material: 'stone', castShadow: false }] };
}

/** Larger square-ish worn paving slab (~0.8-1.2 m). Variant 1 is cracked in two. */
export function pavingSlab(variant = 0): InstancedAsset {
  const v = ((Math.round(variant) % 2) + 2) % 2;
  const rng = new Rng(1300 + v * 29);
  const hw = v === 0 ? 0.5 : 0.56;
  const hd = v === 0 ? 0.45 : 0.5;
  const c = 0.08;
  const outline: Array<[number, number]> = [
    [-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c],
  ].map(([x, z]) => [x + rng.range(-0.025, 0.025), z + rng.range(-0.025, 0.025)] as [number, number]);
  const geos: THREE.BufferGeometry[] = [];
  if (v === 0) {
    geos.push(bevelSlab(outline, -0.08, 0.04, 0.04, 0.008));
  } else {
    // split along an irregular line across X
    const left = [outline[0], [0.05, -hd + 0.01], [-0.06, hd - 0.01], outline[5], outline[6], outline[7]] as Array<[number, number]>;
    const right = [[0.09, -hd + 0.01], outline[1], outline[2], outline[3], outline[4], [-0.02, hd - 0.01]] as Array<[number, number]>;
    geos.push(bevelSlab(left, -0.08, 0.045, 0.04, 0.006));
    const r = bevelSlab(right, -0.08, 0.035, 0.04, 0.006);
    r.rotateZ(0.015);
    geos.push(r);
  }
  const g = geos.length === 1 ? geos[0] : mergeLocal(geos);
  planarUV(g, 1.4, v * 0.37, 0.2);
  shade(g, { base: v === 0 ? 0xb6ac91 : 0xaaa28a, vary: 0.1, varyScale: 2.2, moss: StoneColors.plainMoss, mossAmount: 0.3, mossUp: 0.95, seed: 3 + v });
  const p = g.attributes.position;
  const col = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) < 0.0 ? 0.65 : 1;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return { name: `paving-slab-${v}`, parts: [{ geometry: dropFaces(g, [0, -1, 0]), material: 'stone', castShadow: false }] };
}

// ---------------------------------------------------------------------------
// Crypt of the Ember Kings (facade)
// ---------------------------------------------------------------------------

/**
 * Sealed door of the crypt facade (prop-local): centre point of its front face plus size.
 * The door stands on the podium (sill at y = 0.9) and is a collider tagged 'crypt-door'.
 */
export const CRYPT_DOOR = { x: 0, y: 3.0, z: 0.3, width: 2.8, height: 4.2, sillY: 0.9 } as const;

/** Flame anchor points of the two stone braziers flanking the crypt stairs (prop-local). */
export const CRYPT_BRAZIERS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: -4.45, y: 2.2, z: 3.3 },
  { x: 4.45, y: 2.2, z: 3.3 },
];

/** Stone fire bowl on a short pedestal with glowing coals; base at y = 0, returns the coal top height. */
function brazier(bin: PartBin, rng: Rng, x: number, y: number, z: number, seed: number): number {
  const ped = lathe([[0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.24, 0.55], [0.3, 0.7], [0.34, 0.78]], 8, Math.PI / 8);
  ped.translate(x, y, z);
  bin.add('stone', trim(ped, { seed, color: StoneColors.plain, moss: 0.7 }));
  const bowl = lathe([[0.3, 0], [0.5, 0.12], [0.6, 0.34], [0.62, 0.4], [0.52, 0.38], [0.42, 0.18], [0.0, 0.16]], 10);
  bowl.translate(x, y + 0.76, z);
  bin.add('stone', trim(bowl, { seed: seed + 1, color: StoneColors.plainLight, moss: 0.3 }));
  for (let i = 0; i < 4; i++) {
    const g = glyph(i % 2 === 0 ? 'flame' : 'sun', 0.2, 0.03);
    g.translate(0, y + 1.02, 0.52);
    g.rotateY((i * Math.PI) / 2 + Math.PI / 4);
    g.translate(x, 0, z);
    bin.add('stone', trim(g, { seed: seed + 2 + i, color: 0xcfc4a5, moss: 0.2, dirt: 0 }));
  }
  // coals: a mound of glowing ember lumps with dark charcoal between
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 0.32);
    const lump = rubbleChunk(rng, rng.range(0.12, 0.2));
    lump.translate(x + Math.cos(a) * r, y + 0.92 + (0.32 - r) * 0.25, z + Math.sin(a) * r);
    if (i % 3 === 0) {
      shade(lump, { base: 0x2b2420, vary: 0.2 });
      bin.add('vertexColor', lump);
    } else bin.add('emberGlow', lump, { castShadow: false });
  }
  return y + 1.12;
}

/** Thin glowing line strip between points (XY plane facing +Z), for the ember seal. */
function glowStroke(mb: MeshBuilder, pts: Array<[number, number]>, w: number, z: number): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * w * 0.5;
    const ny = (dx / l) * w * 0.5;
    mb.quad([x0 - nx, y0 - ny, z], [x1 - nx, y1 - ny, z], [x1 + nx, y1 + ny, z], [x0 + nx, y0 + ny, z], [0, 0, 1]);
  }
}

/**
 * Entrance of the dungeon "Crypt of the Ember Kings": an ~11 m wide, ~9 m tall stepped temple
 * facade meant to sit against a cliff (back at z = -3 left unfinished). Four columns carry an
 * architrave with a glyph frieze, the upper tiers carry the carved ember-sun emblem, a broad
 * 4-step stair climbs to a podium (y = 0.9) with two stone braziers on its cheek blocks, and a
 * huge sealed stone door (2.8 x 4.2 m, front face z = 0.3) bears a glowing ember seal.
 * The door is a collider tagged 'crypt-door' (see CRYPT_DOOR).
 */
export function buildCryptFacade(): PropDefinition {
  const rng = new Rng(6606);
  const bin = new PartBin();
  const tall = { seeThrough: true };
  const D = CRYPT_DOOR;
  const P = D.sillY; // podium top
  const halfW = 5.5;
  const zBack = -3;
  const zF = 0.9; // facade front face
  const doorHW = D.width / 2;
  const doorTop = P + D.height;
  const colliders: LocalCollider[] = [];
  const platforms: LocalPlatform[] = [];

  // ---- podium, stairs and cheek blocks --------------------------------------------------------
  const zPod = 2.3;
  const stairHW = 3.5;
  const nSteps = 4;
  const sr = P / nSteps;
  const tr = 0.6;
  const pod = chamferBlock(halfW * 2 + 0.6, P, zPod - zBack, { bevel: 0.06, chamfer: 0.04, rng, jitter: 0.01 });
  pod.translate(0, 0, (zPod + zBack) / 2);
  bin.add('stoneBlocks', masonry(pod, { seed: 601, creep: 0.1, courseBase: 0, dirt: 0.2 }));
  // paving slabs on the podium
  for (let x = -halfW + 0.05; x < halfW - 0.2; ) {
    const w = rng.range(0.9, 1.4);
    for (let z = zF + 0.05; z < zPod - 0.1; ) {
      const d = Math.min(rng.range(0.6, 0.9), zPod - z);
      if (d < 0.25) break;
      const s = bevelSlab([[x, z], [x + w - 0.03, z], [x + w - 0.03, z + d - 0.03], [x, z + d - 0.03]], P - 0.05, P + rng.range(0.01, 0.025), 0.025);
      planarUV(s, 1.6, rng.next(), rng.next());
      bin.add('stone', shade(s, { base: new THREE.Color(rng.pick(PAVE_COLORS)).multiplyScalar(0.95), vary: 0.08, moss: StoneColors.plainMoss, mossAmount: 0.25, mossUp: 0.95, seed: x + z }));
      z += d;
    }
    x += w;
  }
  for (let k = 0; k < nSteps; k++) {
    const yTop = (nSteps - k) * sr; // k = 0 is the highest step (just in front of the podium edge)
    if (k === 0) continue; // the podium itself is the top tread
    const z0 = zPod + (k - 1) * tr;
    let x = -stairHW;
    while (x < stairHW - 0.05) {
      const w = Math.min(rng.range(1.1, 1.8), stairHW - x);
      const b = chamferBlock(w - 0.03, yTop + 0.1, tr + 0.04, { bevel: 0.04, chamfer: 0.025, rng, jitter: 0.008, chip: 0.3 });
      b.translate(x + w / 2, -0.1, z0 + tr / 2);
      bin.add('stone', trim(b, { seed: 610 + k * 10 + x, color: new THREE.Color(StoneColors.plain).multiplyScalar(rng.range(0.92, 1.05)), moss: 0.35, creep: 0.03 }));
      x += w;
    }
  }
  // risers at z = zPod + k*tr (k = 0..3); the walkable ramp passes through the riser midpoints,
  // reaching the podium height P at zA and the ground at zB
  const zStairEnd = zPod + (nSteps - 1) * tr;
  const slope = -sr / tr;
  const zA = zPod - (0.5 * sr) / -slope;
  const zB = zStairEnd + (0.5 * sr) / -slope;
  platforms.push({ x: 0, z: (zA + zB) / 2, halfX: stairHW, halfZ: (zB - zA) / 2, yaw: 0, height: P / 2, slope, thickness: 2, surface: 'stone' });
  // podium top, reaching back into the door recess (up to the door face at z = D.z)
  platforms.push({ x: 0, z: (D.z + zPod) / 2, halfX: halfW + 0.3, halfZ: (zPod - D.z) / 2, yaw: 0, height: P, thickness: 1.6, surface: 'stone' });
  // cheek blocks carrying the braziers
  for (const side of [-1, 1]) {
    const cx = side * (stairHW + (halfW + 0.3 - stairHW) / 2);
    const cw = halfW + 0.3 - stairHW;
    const cb = chamferBlock(cw, P + 0.25, zStairEnd - zPod + 0.05, { bevel: 0.07, chamfer: 0.05, rng, jitter: 0.012 });
    cb.translate(cx, 0, (zPod + zStairEnd) / 2);
    bin.add('stoneBlocks', masonry(cb, { seed: 660 + side, creep: 0.25, courseBase: 0 }));
    glyphStrip(bin, ['sun', 'flame'], 0.62, false, mat(cx, (P + 0.25) / 2, zStairEnd + 0.03), 670 + side, StoneColors.ochre);
    platforms.push({ x: cx, z: (zPod + zStairEnd) / 2, halfX: cw / 2, halfZ: (zStairEnd - zPod) / 2, yaw: 0, height: P + 0.25, thickness: 1.8, surface: 'stone' });
    // low solid flank (podium side + cheek block): blocks from the ground and the stairs, but is
    // stepped over (< 0.3 m) by someone already standing on the podium
    const fx0 = side * (stairHW + 0.05);
    const fx1 = side * (halfW + 0.3);
    colliders.push(boxCollider(Math.min(fx0, fx1), Math.max(fx0, fx1), D.z + 0.05, zStairEnd, 0, P + 0.25, 'podium'));
    const bx = CRYPT_BRAZIERS[side < 0 ? 0 : 1];
    brazier(bin, rng, bx.x, P + 0.25, bx.z, 680 + side * 5);
    colliders.push({ type: 'circle', x: bx.x, z: bx.z, radius: 0.5, yMin: 0, yMax: bx.y, tag: 'brazier' });
    mossOnRect(bin, rng, cx - cw / 2 + 0.1, cx + cw / 2 - 0.1, zPod + 0.1, zStairEnd - 0.1, P + 0.25, 2, 0.4);
  }

  // ---- facade body (tier 0) with the door opening ----------------------------------------------------
  const t0Top = 6.3;
  const body = stripWall({
    tops: [{ x0: -halfW, x1: halfW, y: t0Top }],
    z0: zBack,
    z1: zF,
    bottom: (x) => (Math.abs(x) < doorHW ? doorTop : 0),
    breaks: [-doorHW, doorHW],
    stripW: 0.5,
  });
  bin.add('stoneBlocks', masonry(body, { seed: 700, creep: 0.4, top: t0Top }), tall);
  // stepped side buttresses blending into the cliff
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const w = 0.8 - k * 0.15;
      const h = 5.2 - k * 1.5;
      const b = chamferBlock(w, h, zF - zBack - 0.2 - k * 0.5, { bevel: 0.1, chamfer: 0.06, rng, jitter: 0.015 });
      b.translate(side * (halfW + w / 2 - 0.05 + k * 0.6), 0, (zF - 0.2 - k * 0.5 + zBack) / 2);
      bin.add('stoneBlocks', masonry(b, { seed: 710 + k + side * 3, creep: 0.5 }), tall);
      mossOnRect(bin, rng, side * (halfW + k * 0.6) - 0.3, side * (halfW + k * 0.6) + 0.3, zBack + 0.5, zF - 0.6 - k * 0.5, h, 2, 0.6);
    }
  }

  // ---- door frame: jambs + lintel + corbelled relieving stones ------------------------------------------
  for (const side of [-1, 1]) {
    let y = P;
    let k = 0;
    while (y < doorTop - 0.05) {
      const h = Math.min(doorTop - y, rng.range(0.95, 1.2));
      const jb = chamferBlock(0.85, h - 0.02, 0.95, { bevel: 0.06, chamfer: 0.05, rng, jitter: 0.01, chip: 0.25 });
      jb.translate(side * (doorHW + 0.42), y, zF - 0.05 + 0.475 - 0.45);
      bin.add('stone', trim(jb, { seed: 720 + k + side * 7, color: StoneColors.plainLight, creep: 0.05, moss: 0.6 }), tall);
      y += h;
      k++;
    }
  }
  const lintel = chamferBlock(doorHW * 2 + 2.3, 0.95, 1.05, { bevel: 0.08, chamfer: 0.06, rng, jitter: 0.01 });
  lintel.translate(0, doorTop, zF - 0.02);
  bin.add('stone', trim(lintel, { seed: 730, color: StoneColors.plainLight, creep: 0.1 }), tall);
  glyphStrip(bin, ['wave', 'eye', 'mask', 'eye', 'wave'], 0.72, false, mat(0, doorTop + 0.47, zF + 0.505), 735);

  // ---- the sealed door ----------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const leaf = chamferBlock(doorHW - 0.025, D.height - 0.02, 0.4, { bevel: 0.04, chamfer: 0.02, rng, jitter: 0.005 });
    leaf.translate(side * (doorHW / 2 + 0.0125), P + 0.01, D.z - 0.2);
    bin.add('stone', trim(leaf, { seed: 740 + side, color: 0x8c8572, moss: 0.25, creep: 0, dirt: 0.15 }), tall);
    // raised border + carved bands on each leaf
    const lx = side * (doorHW / 2);
    for (const [bw, bh, by] of [[doorHW - 0.25, 0.12, P + 0.25], [doorHW - 0.25, 0.12, doorTop - 0.37], [doorHW - 0.25, 0.1, P + 1.45], [doorHW - 0.25, 0.1, doorTop - 1.35]] as const) {
      const band = chamferBlock(bw, bh, 0.05, { bevel: 0.015 });
      band.translate(lx, by, D.z);
      bin.add('stone', trim(band, { seed: 750 + by, color: 0x9a927c, moss: 0.2, creep: 0, dirt: 0 }), tall);
    }
    glyphStrip(bin, side < 0 ? ['steps', 'flame'] : ['flame', 'steps'], 0.5, true, mat(lx, P + 0.82 + 0.25, D.z), 760 + side, 0x7e7765);
    glyphStrip(bin, ['spiral'], 0.5, true, mat(lx, doorTop - 0.85, D.z), 765 + side, 0x7e7765);
  }
  colliders.push({ type: 'box', x: 0, z: D.z - 0.22, halfX: doorHW + 0.05, halfZ: 0.25, yaw: 0, yMin: 0, yMax: doorTop, tag: 'crypt-door' });

  // glowing ember seal across both leaves
  {
    const mb = new MeshBuilder();
    const cy = D.y;
    const z = D.z + 0.03;
    const ring = (r: number, n = 28): Array<[number, number]> => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return pts;
    };
    glowStroke(mb, ring(0.62), 0.07, z);
    glowStroke(mb, ring(0.4, 20), 0.045, z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const r0 = 0.72;
      const r1 = i % 2 === 0 ? 1.15 : 0.95;
      glowStroke(mb, [[Math.cos(a) * r0, cy + Math.sin(a) * r0], [Math.cos(a) * r1, cy + Math.sin(a) * r1]], 0.06, z);
    }
    // flame / eye at the centre
    const flame: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const a = t * Math.PI * 2;
      const up = Math.max(0, -Math.cos(a));
      flame.push([Math.sin(a) * 0.17 * (1 - up * up * 0.85), cy - 0.05 - Math.cos(a) * 0.17 + up * up * 0.2]);
    }
    glowStroke(mb, flame, 0.05, z);
    // vertical seam glow
    glowStroke(mb, [[0, P + 0.15], [0, cy - 0.66]], 0.025, D.z + 0.005);
    glowStroke(mb, [[0, cy + 0.66], [0, doorTop - 0.15]], 0.025, D.z + 0.005);
    bin.add('emberGlow', mb.build(), { castShadow: false });
  }

  // ---- portico: four columns + architrave with glyph frieze + cornice ------------------------------------
  const colZ = 1.55;
  const colTop = 5.55;
  for (const cx of [-4.55, -2.85, 2.85, 4.55]) {
    const base = chamferBlock(0.95, 0.32, 0.95, { bevel: 0.05, rng, jitter: 0.01, chip: 0.4 });
    base.translate(cx, P, colZ);
    bin.add('stone', trim(base, { seed: 800 + cx, color: StoneColors.plainDark, moss: 0.9 }));
    let y = P + 0.32;
    let k = 0;
    while (y < colTop - 0.45) {
      const h = Math.min(rng.range(0.85, 1.05), colTop - 0.45 - y);
      const t0 = (y - P) / (colTop - P);
      const g = drum(0.38 - t0 * 0.05, 0.38 - ((y + h - P) / (colTop - P)) * 0.05, h - 0.02);
      g.rotateY(rng.range(0, 0.5));
      g.translate(cx, y, colZ);
      bin.add('stone', trim(g, { seed: 810 + cx * 3 + k, color: new THREE.Color(StoneColors.plain).multiplyScalar(rng.range(0.93, 1.05)), moss: 0.7, creep: 0.1, tile: 1.6 }), tall);
      y += h;
      k++;
    }
    const capG = lathe([[0.33, 0], [0.36, 0.06], [0.48, 0.25], [0.52, 0.45]], 10);
    capG.translate(cx, colTop - 0.45, colZ);
    bin.add('stone', trim(capG, { seed: 830 + cx, color: StoneColors.plainLight }), tall);
    colliders.push({ type: 'circle', x: cx, z: colZ, radius: 0.44, yMin: 0, yMax: colTop, tag: 'column' });
  }
  const archi = chamferBlock(halfW * 2 + 0.2, 0.75, 1.25, { bevel: 0.07, chamfer: 0.05, rng, jitter: 0.012 });
  archi.translate(0, colTop, zF + 0.6);
  bin.add('stoneBlocks', masonry(archi, { seed: 840, creep: 0.25, courseBase: colTop }), tall);
  const friezeKinds: GlyphKind[] = ['spiral', 'sun', 'wave', 'flame', 'eye', 'mask', 'eye', 'flame', 'wave', 'sun', 'spiral'];
  glyphStrip(bin, friezeKinds, 0.62, false, mat(0, colTop + 0.38, zF + 1.225), 845);
  const cornice = chamferBlock(halfW * 2 + 0.6, 0.3, 1.6, { bevel: 0.08, chamfer: 0.06, rng, jitter: 0.012 });
  cornice.translate(0, colTop + 0.75, zF + 0.5);
  bin.add('stone', trim(cornice, { seed: 850, color: StoneColors.plainLight, moss: 1, creep: 0.08 }), tall);
  mossOnRect(bin, rng, -halfW, halfW, zF - 0.2, zF + 1.2, colTop + 1.05, 7, 0.65);

  // ---- upper tiers + ember-sun emblem + crest ----------------------------------------------------------
  const tiers: Array<{ hw: number; y0: number; y1: number; zf: number }> = [
    { hw: 4.3, y0: t0Top, y1: 7.45, zf: 0.45 },
    { hw: 3.0, y0: 7.45, y1: 8.4, zf: 0.05 },
    { hw: 1.7, y0: 8.4, y1: 9.05, zf: -0.3 },
  ];
  tiers.forEach((t, i) => {
    const tops: TopSegment[] = brokenTop(rng, -t.hw, t.hw, t.y1 - COURSE * (i === 2 ? 1 : 0.5), t.y1, COURSE * 0.5, 0.6, 1.4);
    const g = stripWall({ tops, z0: zBack, z1: t.zf, stripW: 0.6, bottom: () => t.y0, soffit: false });
    const topAt = (x: number): number => {
      for (const s of tops) if (x >= s.x0 - 1e-4 && x <= s.x1 + 1e-4) return s.y;
      return t.y1;
    };
    bin.add('stoneBlocks', masonry(g, { seed: 860 + i, topAt: (x) => topAt(x), creep: 0.5, courseBase: t.y0 }), tall);
    for (const s of tops) mossOnRect(bin, rng, s.x0 + 0.1, s.x1 - 0.1, t.zf - 0.8, t.zf - 0.1, s.y, 1, 0.55);
    // ledge moss + small drapes
    if (i < 2) {
      const dx = rng.range(-t.hw * 0.8, t.hw * 0.8);
      bin.add('vertexColor', placed(mossDrape(rng, 1.1, 1.2, 4), dx, t.y1 - 0.05, t.zf + 0.03), HIGH);
    }
  });
  // emblem: big sunburst disc with an Ember-King mask whose eyes glow
  {
    const ex = 0;
    const ey = 7.55;
    const ez = 0.47;
    const disc = lathe([[1.05, 0], [1.05, 0.1], [0.9, 0.16], [0.0, 0.16]], 20);
    disc.rotateX(Math.PI / 2);
    disc.translate(ex, ey, ez);
    bin.add('stone', trim(disc, { seed: 880, color: StoneColors.ochre, moss: 0.3, creep: 0 }), tall);
    const rays = new MeshBuilder();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r0 = 0.98;
      const r1 = i % 2 === 0 ? 1.65 : 1.35;
      const wa = 0.11;
      const p0: Vec3 = [ex + Math.cos(a - wa) * r0, ey + Math.sin(a - wa) * r0, ez + 0.02];
      const p1: Vec3 = [ex + Math.cos(a + wa) * r0, ey + Math.sin(a + wa) * r0, ez + 0.02];
      const p2: Vec3 = [ex + Math.cos(a) * r1, ey + Math.sin(a) * r1, ez + 0.02];
      const back = (p: Vec3): Vec3 => [p[0], p[1], ez - 0.2];
      rays.tri(p0, p1, p2, [0, 0, 1]);
      rays.quad(back(p0), p0, p2, back(p2), [Math.cos(a - Math.PI / 2), Math.sin(a - Math.PI / 2), 0]);
      rays.quad(back(p1), p1, p2, back(p2), [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), 0]);
    }
    bin.add('stone', trim(rays.build(), { seed: 881, color: StoneColors.plainLight, moss: 0.6, creep: 0 }), tall);
    const mask = glyph('mask', 1.25, 0.12);
    mask.translate(ex, ey, ez + 0.16);
    bin.add('stone', trim(mask, { seed: 882, color: 0xd8cfb2, moss: 0.4, creep: 0, dirt: 0 }), tall);
    const eyes = new MeshBuilder();
    for (const side of [-1, 1]) {
      const cx = ex + side * 0.19;
      const cy = ey + 0.03;
      eyes.quad([cx - 0.09, cy - 0.025, ez + 0.2], [cx + 0.09, cy - 0.025, ez + 0.2], [cx + 0.08, cy + 0.035, ez + 0.2], [cx - 0.08, cy + 0.035, ez + 0.2], [0, 0, 1]);
    }
    bin.add('emberGlow', eyes.build(), { castShadow: false });
  }
  // crest finials
  for (const side of [-1, 1]) {
    const f = lathe([[0.22, 0], [0.26, 0.1], [0.12, 0.35], [0.18, 0.5], [0.0, 0.75]], 6);
    f.translate(side * 1.35, 9.0, -0.75);
    bin.add('stone', trim(f, { seed: 890 + side, color: StoneColors.plainLight, moss: 0.8 }), tall);
  }

  // ---- overgrowth & rubble ---------------------------------------------------------------------------------
  for (const [x, len] of [[-3.6, 3.2], [3.9, 2.4], [-0.9, 1.6]] as const) {
    bin.add('vertexColor', placed(mossDrape(rng, 1.3, len, 5), x, colTop + 1.0, zF + 1.32), HIGH);
  }
  for (const x of [-5.3, 5.1, 1.9]) {
    bin.add('vertexColor', placed(vineStrand(rng, rng.range(2.5, 4), 0.3), x, colTop + 1.0, zF + 1.35), HIGH);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const b = looseBlock(rng, rng.range(0.5, 0.85), rng.range(0.35, 0.55), rng.range(0.45, 0.7), 900 + i + side * 10);
      bin.add('stoneBlocks', placed(b, side * rng.range(6.3, 7.6), -0.05, rng.range(0.5, 3.5), rng.range(-0.3, 0.3), rng.range(0, Math.PI), rng.range(-0.3, 0.3)));
    }
    for (let i = 0; i < 6; i++) {
      const g = rubbleChunk(rng, rng.range(0.15, 0.35));
      g.translate(side * rng.range(5.9, 7.8), -0.02, rng.range(0.3, 4.2));
      bin.add('stone', trim(g, { seed: 920 + i, moss: 0.6, creep: 0 }));
    }
  }

  // ---- colliders --------------------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const x0 = side * doorHW;
    const x1 = side * (halfW + 1.9);
    colliders.push(boxCollider(Math.min(x0, x1), Math.max(x0, x1), zBack, zF + 0.05, 0, t0Top + 2.5, 'wall'));
    const j0 = side * doorHW;
    const j1 = side * (doorHW + 0.85);
    colliders.push(boxCollider(Math.min(j0, j1), Math.max(j0, j1), zF - 0.1, zF + 0.4, 0, doorTop + 0.9, 'wall'));
  }
  return { name: 'crypt-facade', parts: bin.parts(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Ember Shrine (checkpoint)
// ---------------------------------------------------------------------------

/**
 * Checkpoint "Ember Shrine": stepped octagonal stone platform with a carved pedestal and fire
 * bowl (runes, moss). Gameplay adds the flame + light at (0, flameY, 0). Collider radius 0.9.
 */
export function buildEmberShrineBase(): { def: PropDefinition; flameY: number } {
  const rng = new Rng(7070);
  const bin = new PartBin();
  // two octagonal steps
  const step1 = prism(octagon(1.05), 0, 0.26, { top: true });
  bin.add('stone', trim(jitter(step1, 0.012, 2, 1), { seed: 1, color: StoneColors.plainDark, moss: 0.95, creep: 0.08, tile: 1.6 }));
  const step2 = prism(octagon(0.8), 0.26, 0.5, { top: true });
  bin.add('stone', trim(jitter(step2, 0.01, 2, 2), { seed: 2, color: StoneColors.plain, moss: 0.9, creep: 0.06, tile: 1.6 }));
  // runes on the step risers (8 faces)
  const runeKinds: GlyphKind[] = ['flame', 'sun', 'spiral', 'eye', 'flame', 'wave', 'steps', 'sun'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const g = glyph(runeKinds[i], 0.17, 0.02);
    const apo = 0.8 * Math.cos(Math.PI / 8);
    g.translate(0, 0.38, apo);
    g.rotateY(Math.PI / 2 - a);
    bin.add('stone', trim(g, { seed: 10 + i, color: 0xd2c7a6, moss: 0.2, creep: 0, dirt: 0 }));
  }
  // pedestal (octagonal, tapering) with rune tiles
  const ped = prism(octagon(0.4), 0.5, 1.12, { topScale: 0.82, segY: 2 });
  bin.add('stone', trim(jitter(ped, 0.008, 2.5, 3), { seed: 3, color: StoneColors.plain, moss: 0.6, creep: 0.1, tile: 1.4 }));
  const pedKinds: GlyphKind[] = ['flame', 'sun', 'mask', 'spiral'];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Matrix4().makeRotationY((i * Math.PI) / 2).multiply(new THREE.Matrix4().makeTranslation(0, 0.8, 0.355));
    const tilt = new THREE.Matrix4().makeRotationX(-0.1);
    m.multiply(tilt);
    for (const g of glyphTile(pedKinds[i], 0.3, 20 + i, StoneColors.ochre)) {
      g.applyMatrix4(m);
      bin.add('stone', g);
    }
  }
  // collar + flared bowl with a thick lip and a carved band of ember glyphs
  const collar = lathe([[0.36, 0], [0.42, 0.06], [0.42, 0.12], [0.34, 0.16]], 8, Math.PI / 8);
  collar.translate(0, 1.1, 0);
  bin.add('stone', trim(collar, { seed: 4, color: StoneColors.plainLight, moss: 0.5 }));
  const bowl = lathe([[0.28, 0], [0.46, 0.08], [0.58, 0.2], [0.64, 0.3], [0.7, 0.33], [0.7, 0.4], [0.6, 0.41], [0.5, 0.28], [0.0, 0.24]], 12);
  bowl.translate(0, 1.22, 0);
  bin.add('stone', trim(bowl, { seed: 5, color: StoneColors.plainLight, moss: 0.4, creep: 0.04 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const g = glyph(i % 2 === 0 ? 'flame' : 'sun', 0.16, 0.025);
    g.rotateX(0.78);
    g.translate(0, 1.37, 0.515);
    g.rotateY(Math.PI / 2 - a);
    bin.add('stone', trim(g, { seed: 30 + i, color: StoneColors.ochre, moss: 0.1, creep: 0, dirt: 0 }));
  }
  // charcoal bed (gameplay adds the flame)
  const bedY = 1.5;
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 0.36);
    const lump = rubbleChunk(rng, rng.range(0.1, 0.18));
    lump.translate(Math.cos(a) * r, bedY - 0.04 + (0.36 - r) * 0.15, Math.sin(a) * r);
    shade(lump, { base: i % 3 === 0 ? 0x4a2a1c : 0x2a2522, vary: 0.25 });
    bin.add('vertexColor', lump);
  }
  // moss
  mossOnRect(bin, rng, -0.95, 0.95, -0.95, 0.95, 0.25, 4, 0.4);
  mossOnRect(bin, rng, -0.7, 0.7, -0.7, 0.7, 0.5, 2, 0.32);
  const d = mossDrape(rng, 0.5, 0.45, 3);
  bin.add('vertexColor', placed(d, 0.2, 0.5, 0.75), { castShadow: false });
  const flameY = 1.6;
  return {
    def: {
      name: 'ember-shrine',
      parts: bin.parts(),
      colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.9, yMin: 0, yMax: 1.62, tag: 'shrine' }],
    },
    flameY,
  };
}

/** Regular octagon (flat sides facing +-X / +-Z) with the given apothem-ish radius. */
function octagon(r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}
