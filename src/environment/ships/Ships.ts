import * as THREE from 'three';
import type { MaterialName } from '../../assets/materials/MaterialLibrary';
import type { LocalCollider, LocalPlatform, PropDefinition } from '../PropTypes';
import { jitterColors, merge } from '../../assets/geometry/GeometryUtils';
import { lerp, smoothstep } from '../../utils/math';
import { Noise2D } from '../../utils/noise';
import { Rng } from '../../utils/random';
import { Hull, type HullParams, type ShellResult, type Station, buildDeck, buildInnerBulwark, buildShell, buildTransom, stationList } from './ShipHull';
import {
  PartBin,
  ShipColors,
  TILE,
  V,
  type Kit,
  type V3,
  anchorKit,
  barrelKit,
  barrelLyingKit,
  beam,
  box,
  capstanKit,
  cannonKit,
  coilKit,
  crateKit,
  fromArrays,
  gratingKit,
  grid,
  lanternKit,
  oarKit,
  plankBeam,
  plankBox,
  quad,
  setRGB,
  shade,
  shadeRGB,
  spar,
  stamp,
  stampMatrix,
  stairsKit,
  sweep,
  tone,
  tube,
  wheelKit,
} from './ShipKit';
import {
  crosstrees,
  crowsNest,
  deadeye,
  furledSail,
  gaffSail,
  jollyRoger,
  line,
  mastBands,
  mastCap,
  mastSegment,
  pennant,
  shroudFan,
  squareSail,
  topPlatform,
  triSail,
  yard,
} from './ShipRig';

/**
 * Procedural ships & boats: the hero galleon moored in the harbour hub, a smaller pirate sloop,
 * rowboats and a beached shipwreck.
 *
 * Local frame for every ship: metres, +Y up, bow towards +Z, port side = -X, starboard = +X.
 * Floating hulls have their origin on the hull centre line at the waterline (y = 0 = sea level);
 * the beached rowboat and the wreck have their origin at sand level.
 */

type RGB = [number, number, number];
/** Linear multipliers on the woodPlanks texture that read as weathered paint. */
const PAINT_RED: RGB = [1.32, 0.34, 0.27];
const PAINT_OCHRE: RGB = [1.95, 1.42, 0.62];
const ST = { seeThrough: true } as const;

function paintPlanks(g: THREE.BufferGeometry, rgb: RGB = [1, 1, 1], seed = 0, jitter = 0.12): THREE.BufferGeometry {
  setRGB(g, rgb[0], rgb[1], rgb[2]);
  jitterColors(g, jitter, 0.75, seed);
  return g;
}

/** Dark lower hull with a wet / algae band at the waterline. */
function paintBottom(g: THREE.BufferGeometry, seed = 0, waterY = 0): THREE.BufferGeometry {
  setRGB(g, 0.95, 0.92, 0.88);
  jitterColors(g, 0.12, 0.7, seed);
  shadeRGB(g, (_x, y, _z, o) => {
    const k = 1 - smoothstep(0, 0.45, Math.abs(y - waterY + 0.08));
    o[0] = 1 - 0.22 * k;
    o[1] = 1 - 0.06 * k;
    o[2] = 1 - 0.28 * k;
  });
  return g;
}

function ochre(g: THREE.BufferGeometry, seed = 0): THREE.BufferGeometry {
  return tone(g, ShipColors.ochre, 0.1, seed);
}

/** Orthonormal frame on the hull surface: Z = outward normal, Y = up, origin on the planking. */
function hullFrame(hull: Hull, z: number, y: number, side: 1 | -1, out = 0, flat = false): THREE.Matrix4 {
  const p = hull.pointAt(z, y);
  const n = hull.normalAt(z, y);
  if (flat) n.setY(0).normalize();
  p.x *= side;
  n.x *= side;
  p.addScaledVector(n, out);
  return frameAt(p, n);
}

function frameAt(p: V3, n: V3): THREE.Matrix4 {
  const up = V(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const xa = new THREE.Vector3().crossVectors(up, n).normalize();
  return new THREE.Matrix4().makeBasis(xa, up, n).setPosition(p);
}

/** Points along a polyline every `spacing` metres (first and last included). */
function resample(path: V3[], spacing: number): V3[] {
  const out: V3[] = [path[0].clone()];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const d = a.distanceTo(b);
    let t = 0;
    while (acc + (d - t) >= spacing) {
      t += spacing - acc;
      out.push(new THREE.Vector3().lerpVectors(a, b, t / d));
      acc = 0;
    }
    acc += d - t;
  }
  const last = path[path.length - 1];
  if (out[out.length - 1].distanceTo(last) > spacing * 0.45) out.push(last.clone());
  return out;
}

/** Open square prism (4 sides, no caps) of side w and height h, centred at the origin. */
function prism(w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(w / Math.SQRT2, w / Math.SQRT2, h, 4, 1, true);
  g.rotateY(Math.PI / 4);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((4 * w) / TILE.grainU), uv.getY(i) * (h / TILE.grainV));
  return g;
}

/** Posts + top rail along a path (path = base of the posts). */
function balustrade(bin: PartBin, path: V3[], h: number, spacing = 0.5, seed = 0): void {
  const posts: THREE.BufferGeometry[] = [];
  for (const p of resample(path, spacing)) {
    posts.push(prism(0.085, h).translate(p.x, p.y + h / 2, p.z));
    posts.push(prism(0.13, 0.12).translate(p.x, p.y + h * 0.45, p.z));
  }
  bin.add('wood', tone(merge(posts), 0xf2dfc4, 0.08, seed), ST);
  const top = path.map((p) => V(p.x, p.y + h + 0.03, p.z));
  const rail = sweep(top, [[-0.085, -0.05], [0.085, -0.05], [0.085, 0.045], [-0.085, 0.045]], { caps: true });
  bin.add('woodDark', tone(rail, 0xffffff, 0.06, seed), ST);
}

function windowKit(w: number, h: number, pane: 'glow' | 'glass', frame: MaterialName = 'woodPale'): Kit {
  const kit: Kit = [];
  const hw = w / 2;
  const hh = h / 2;
  const back = quad(V(-hw, -hh, 0.01), V(hw, -hh, 0.01), V(hw, hh, 0.01), V(-hw, hh, 0.01));
  if (pane === 'glow') kit.push({ m: 'emberGlow', g: back });
  else {
    kit.push({ m: 'vertexColor', g: setRGB(back, 0.05, 0.055, 0.06) });
    kit.push({ m: 'glass', g: quad(V(-hw, -hh, 0.03), V(hw, -hh, 0.03), V(hw, hh, 0.03), V(-hw, hh, 0.03)) });
  }
  const fr: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    fr.push(box(w + 0.14, 0.08, 0.08, 'x').translate(0, s * (hh + 0.03), 0.04));
    fr.push(box(0.08, h, 0.08, 'y').translate(s * (hw + 0.03), 0, 0.04));
  }
  kit.push({ m: frame, g: tone(merge(fr), 0xffffff, 0.06) });
  const mul = merge([box(0.035, h, 0.04, 'y').translate(0, 0, 0.04), box(w, 0.035, 0.04, 'x').translate(0, h * 0.12, 0.04)]);
  kit.push({ m: 'woodDark', g: tone(mul, 0xffffff, 0) });
  return kit;
}

function gunPortKit(open: boolean, lid: RGB): Kit {
  const kit: Kit = [];
  const rec = quad(V(-0.31, -0.27, 0.015), V(0.31, -0.27, 0.015), V(0.31, 0.27, 0.015), V(-0.31, 0.27, 0.015));
  kit.push({ m: 'vertexColor', g: setRGB(rec, 0.045, 0.035, 0.028) });
  const fr: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    fr.push(box(0.84, 0.1, 0.09, 'x').translate(0, s * 0.32, 0.03));
    fr.push(box(0.1, 0.54, 0.09, 'y').translate(s * 0.37, 0, 0.03));
  }
  kit.push({ m: 'woodDark', g: tone(merge(fr), 0xffffff, 0.06) });
  if (!open) {
    kit.push({ m: 'woodPlanks', g: setRGB(plankBox(0.64, 0.54, 0.06, 'x').translate(0, 0, 0.05), lid[0], lid[1], lid[2]) });
  } else {
    const a = V(0, 0.31, 0.07);
    const dir = V(0, 0.36, 0.93).normalize();
    kit.push({ m: 'woodPlanks', g: setRGB(plankBeam(a, a.clone().addScaledVector(dir, 0.55), 0.64, 0.06), lid[0], lid[1], lid[2]) });
    for (const k of cannonKit(1.5, 0.13)) {
      const g = k.g.clone();
      g.rotateX(Math.PI / 2);
      g.translate(0, -0.03, -0.55);
      kit.push({ m: k.m, g });
    }
  }
  return kit;
}

/** Bulkhead across the hull at z between y0 and y1 (vertical planks), facing +Z or -Z. */
function bulkhead(hull: Hull, z: number, y0: number, y1: number, t: number, facing: 1 | -1, segs = 2): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= segs; r++) {
    const y = lerp(y0, y1, r / segs);
    const xi = hull.innerPoint(hull.wAt(z, y), y, t).x;
    pos.push(-xi, y, z, xi, y, z);
    uv.push(y / TILE.plankU, -xi / TILE.plankV, y / TILE.plankU, xi / TILE.plankV);
  }
  for (let r = 0; r < segs; r++) {
    const L0 = r * 2;
    const R0 = L0 + 1;
    const L1 = L0 + 2;
    const R1 = L0 + 3;
    if (facing > 0) idx.push(L0, R0, R1, L0, R1, L1);
    else idx.push(L0, R1, R0, L0, L1, R1);
  }
  return fromArrays(pos, uv, idx);
}

function bezier(a: V3, b: V3, c: V3, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push(V(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z));
  }
  return out;
}

/** Thin collider boxes following a (starboard) outline, mirrored to port when side = -1. */
function railColliders(
  out: LocalCollider[],
  pts: V3[],
  side: 1 | -1,
  yMin: number,
  yMax: (z: number) => number,
  chunk: (z: number) => number,
  halfX = 0.16,
): void {
  let start = 0;
  while (start < pts.length - 1) {
    let end = start + 1;
    while (end < pts.length - 1 && pts[end].distanceTo(pts[start]) < chunk(pts[start].z)) end++;
    const a = pts[start];
    const b = pts[end];
    const dx = (b.x - a.x) * side;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      let ym = 0;
      for (let i = start; i <= end; i++) ym = Math.max(ym, yMax(pts[i].z));
      out.push({
        type: 'box',
        x: ((a.x + b.x) / 2) * side,
        z: (a.z + b.z) / 2,
        halfX,
        halfZ: len / 2 + 0.06,
        yaw: Math.atan2(dx, dz),
        yMin,
        yMax: ym,
        tag: 'ship',
      });
    }
    start = end;
  }
}

// ---------------------------------------------------------------------------
// Galleon
// ---------------------------------------------------------------------------

/** Key numbers of the galleon (prop-local metres, y = 0 at the waterline, bow +Z). */
export const GalleonLayout = {
  length: 30,
  beam: 8.6,
  keelY: -2.5,
  mainDeckY: 3.55,
  quarterDeckY: 5.6,
  forecastleY: 4.9,
  /** Quarterdeck spans z in [-15, quarterDeckZ]; forecastle z in [forecastleZ, 13.5]. */
  quarterDeckZ: -8.5,
  forecastleZ: 9.5,
  boarding: { x: -4.3, y: 3.55, z: -3, gapZ0: -4, gapZ1: -2 },
  masts: { fore: 11.2, main: 1.0, mizzen: -12.4 },
  quarterStairs: { x0: 2.0, x1: 3.5, zBottom: -5.3, zTop: -8.5 },
  foreStairs: { x0: -2.9, x1: -1.4, zBottom: 7.3, zTop: 9.5 },
} as const;

const gRise = (zn: number): number => 0.25 * ((zn - 1) / 14) ** 2;

const GALLEON_HULL: HullParams = {
  zStern: -15,
  zBow: 15,
  halfBeam: 4.3,
  keelY: -2.5,
  maxBeamY: 2.6,
  tumble: 0.04,
  sternBeam: 0.8,
  fullFrom: 0.32,
  fullTo: 0.55,
  bowBluff: 0.55,
  keelRiseStern: 0.3,
  keelRiseBow: 0.6,
  nMid: 2.6,
  nStern: 1.6,
  nBow: 1.8,
  bowRake: 2.8,
  sternRake: 0.9,
  sternOverhang: 0.25,
  sheer: (zn) => 4.55 + gRise(zn) + 1.38 * smoothstep(-7.4, -8.6, zn) + 0.71 * smoothstep(8.6, 9.6, zn),
};

export function buildGalleon(): PropDefinition {
  const L = GalleonLayout;
  const bin = new PartBin();
  const colliders: LocalCollider[] = [];
  const platforms: LocalPlatform[] = [];
  const hull = new Hull(GALLEON_HULL);
  const T = 0.18;
  const DECK = L.mainDeckY;
  const QD = L.quarterDeckY;
  const FC = L.forecastleY;
  const QZ = L.quarterDeckZ;
  const FZ = L.forecastleZ;
  const gap = L.boarding;
  const S = (z: number): number => hull.station(hull.wOf(z)).S;
  const hw = (z: number, y: number): number => hull.halfWidth(z, y);

  // ---------------------------------------------------------------- hull shell
  const steps = [-8.6, QZ, -8.3, -8.0, -7.7, -7.4, gap.gapZ0, gap.gapZ1, 8.6, 8.9, 9.2, FZ, 9.6, 13.5];
  const zs = stationList(-15, 15, [[-10, 0.75], [8, 1.0], [11, 0.75], [15.01, 0.36]], steps);
  // lighter station sets for swept trims (rails keep the sheer steps, wales do not need them)
  const zsRail = stationList(-15, 15, [[-9, 0.9], [8.5, 1.5], [11, 0.8], [15.01, 0.4]], steps);
  const zsWale = stationList(-15, 15, [[-11, 1.0], [9, 1.8], [12, 0.9], [15.01, 0.45]]);
  const shell = buildShell(hull, {
    zs,
    bands: [
      { top: () => 0.3, segs: 5 },
      { top: (st) => 1.95 + gRise(st.zn), segs: 3 },
      { top: (st) => 2.75 + gRise(st.zn), segs: 2 },
      { top: () => DECK, segs: 2 },
      { top: (st) => st.S, segs: 3 },
    ],
    gaps: [{ side: -1, z0: gap.gapZ0, z1: gap.gapZ1, fromBand: 4 }],
  });
  bin.add('woodDark', paintBottom(shell.bands[0], 1));
  bin.add('woodPlanks', paintPlanks(shell.bands[1], [1.02, 0.98, 0.93], 2), ST);
  bin.add('woodPlanks', paintPlanks(shell.bands[2], PAINT_RED, 3, 0.1), ST);
  bin.add('woodPlanks', paintPlanks(shell.bands[3], [1.1, 1.05, 0.98], 4), ST);
  bin.add('woodPlanks', paintPlanks(shell.bands[4], [1.14, 1.08, 1.0], 5), ST);
  const transom = buildTransom(shell);
  bin.add('woodDark', paintBottom(transom[0], 6));
  for (let k = 1; k < transom.length; k++) {
    bin.add('woodPlanks', paintPlanks(transom[k], k === 2 ? PAINT_RED : [0.9, 0.86, 0.82], 7 + k), ST);
  }

  // ---------------------------------------------------------------- bulwarks & decks
  const zsQ = zs.filter((z) => z <= QZ + 1e-6);
  const zsM = zs.filter((z) => z >= QZ - 1e-6 && z <= FZ + 1e-6);
  const zsF = zs.filter((z) => z >= FZ - 1e-6);
  const portGap = [{ side: -1 as const, z0: gap.gapZ0, z1: gap.gapZ1 }];
  const inQ = buildInnerBulwark(hull, zsQ, QD, T, 1);
  const inM = buildInnerBulwark(hull, zsM, DECK, T, 2, portGap);
  const inF = buildInnerBulwark(hull, zsF, FC, T, 1);
  for (const [ib, y0] of [
    [inQ, QD],
    [inM, DECK],
    [inF, FC],
  ] as const) {
    paintPlanks(ib.geo, [0.95, 0.9, 0.84], y0, 0.1);
    shade(ib.geo, (_x, y) => 0.72 + 0.28 * smoothstep(y0, y0 + 0.7, y));
    bin.add('woodPlanks', ib.geo, ST);
  }
  // stern bulwark inner face (quarterdeck side of the transom)
  {
    const a = hull.innerPoint(0, QD, T);
    const b = hull.innerPoint(0, S(-15), T);
    const g = quad(V(a.x, QD, a.z + 0.02), V(-a.x, QD, a.z + 0.02), V(-b.x, b.y, b.z + 0.02), V(b.x, b.y, b.z + 0.02), [
      [0, a.x / TILE.plankV],
      [0, -a.x / TILE.plankV],
      [0.2, -b.x / TILE.plankV],
      [0.2, b.x / TILE.plankV],
    ]);
    bin.add('woodPlanks', paintPlanks(g, [0.8, 0.76, 0.7], 9), ST);
  }
  const deckRGB: RGB = [1.08, 1.02, 0.94];
  const deckQ = buildDeck(inQ.deck, QD);
  const deckM = buildDeck(inM.deck, DECK);
  const deckF = buildDeck(inF.deck, FC);
  for (const [d, seed] of [
    [deckQ, 11],
    [deckM, 12],
    [deckF, 13],
  ] as const) {
    shadeRGB(d, (_x, _y, _z, o) => {
      o[0] = deckRGB[0];
      o[1] = deckRGB[1];
      o[2] = deckRGB[2];
    });
    jitterColors(d, 0.1, 0.55, seed);
  }
  shade(deckM, (_x, _y, z) => (1 - 0.32 * (1 - smoothstep(QZ, QZ + 0.9, z))) * (1 - 0.3 * smoothstep(FZ - 0.8, FZ, z)));
  bin.add('woodPlanks', [deckQ, deckM, deckF]);
  // boarding gap sill (covers the hull edge between deck and planking)
  {
    const z0 = gap.gapZ0;
    const z1 = gap.gapZ1;
    const xo = hw((z0 + z1) / 2, DECK) + 0.03;
    const xi = hull.innerPoint(hull.wAt(-3, DECK), DECK, T).x;
    const sill = plankBox(xo - xi + 0.06, 0.08, z1 - z0, 'z');
    sill.translate(-(xo + xi) / 2, DECK + 0.02, (z0 + z1) / 2);
    bin.add('woodPlanks', paintPlanks(sill, [0.95, 0.9, 0.85], 14));
    for (const z of [z0, z1]) {
      const post = box(0.24, 1.55, 0.24, 'y');
      post.translate(-(hw(z, DECK + 0.5) - 0.06), DECK + 0.75, z);
      bin.add('woodDark', tone(post, 0xffffff, 0.06), ST);
      const knob = new THREE.SphereGeometry(0.16, 6, 4);
      knob.translate(-(hw(z, DECK + 0.5) - 0.06), DECK + 1.62, z);
      bin.add('vertexColor', ochre(knob), ST);
    }
    // boarding cleats down the hull side
    const cleats: THREE.BufferGeometry[] = [];
    for (let y = 0.45; y < DECK - 0.2; y += 0.42) {
      const m = hullFrame(hull, -3, y, -1, 0.04);
      const c = box(0.7, 0.07, 0.1, 'x');
      c.applyMatrix4(m);
      cleats.push(c);
    }
    bin.add('woodDark', tone(merge(cleats), 0xffffff, 0.05), ST);
  }

  // ---------------------------------------------------------------- rails, wales, mouldings
  const topPath = (zl: number[], side: 1 | -1, yOff: number, inset: number): { path: V3[]; sides: V3[] } => {
    const path: V3[] = [];
    const sides: V3[] = [];
    for (const z of zl) {
      const w = hull.wOf(z);
      const st = hull.station(w);
      const o = hull.point(w, st.S);
      const i = hull.innerPoint(w, st.S, T);
      const n = hull.planNormal(w, st.S);
      const p = o.clone().lerp(i, inset);
      p.y = st.S + yOff;
      p.x *= side;
      n.x *= side;
      path.push(p);
      sides.push(n);
    }
    if (side < 0) {
      path.reverse();
      sides.reverse();
    }
    return { path, sides };
  };
  const railSegments: Array<{ side: 1 | -1; zl: number[] }> = [
    { side: 1, zl: zsRail },
    { side: -1, zl: zsRail.filter((z) => z <= gap.gapZ0 + 1e-6) },
    { side: -1, zl: zsRail.filter((z) => z >= gap.gapZ1 - 1e-6) },
  ];
  const hwCap = T / 2 + 0.08;
  for (const seg of railSegments) {
    const { path, sides } = topPath(seg.zl, seg.side, 0.035, 0.5);
    const cap = sweep(path, [[-hwCap, -0.05], [hwCap, -0.05], [hwCap, 0.06], [-hwCap, 0.06]], { sides, caps: true });
    bin.add('woodDark', tone(cap, 0xffffff, 0.06, seg.side), ST);
    // painted ochre moulding just below the cap rail (outside)
    const mo = topPath(seg.zl, seg.side, -0.13, 0);
    const mould = sweep(mo.path, [[-0.01, -0.05], [0.06, -0.04], [0.06, 0.04], [-0.01, 0.05]], { sides: mo.sides, closed: false });
    bin.add('vertexColor', ochre(mould, seg.side), ST);
  }
  // wales: thick dark strakes following the hull
  for (const yBase of [1.55, 3.22]) {
    for (const side of [1, -1] as const) {
      const path: V3[] = [];
      const sides: V3[] = [];
      for (const z of zsWale) {
        const w = hull.wOf(z);
        const y = yBase + gRise(z);
        const p = hull.point(w, y);
        const n = hull.normalAt(p.z, y);
        p.x *= side;
        n.x *= side;
        path.push(p);
        sides.push(n);
      }
      if (side < 0) {
        path.reverse();
        sides.reverse();
      }
      const wale = sweep(path, [[-0.02, -0.1], [0.1, -0.07], [0.1, 0.07], [-0.02, 0.1]], { sides, closed: false });
      bin.add('woodDark', tone(wale, 0xffffff, 0.08, yBase), ST);
    }
  }

  // ---------------------------------------------------------------- castle balustrades
  const balusterRow = (zl: number[], side: 1 | -1): void => {
    const { path } = topPath(zl, side, 0.09, 0.5);
    balustrade(bin, path, 0.52, 0.5, side);
  };
  const zQ = zsRail.filter((z) => z <= QZ + 0.01);
  const zF = zsRail.filter((z) => z >= FZ - 0.01);
  for (const side of [1, -1] as const) {
    balusterRow(zQ, side);
    balusterRow(zF, side);
  }
  // quarterdeck break rail (opening for the stairs) and forecastle break rail
  {
    const qs = L.quarterStairs;
    const xiQ = hull.innerPoint(hull.wAt(QZ, QD), QD, T).x;
    balustrade(bin, [V(-xiQ + 0.05, QD, QZ + 0.06), V(qs.x0 - 0.06, QD, QZ + 0.06)], 0.95, 0.42, 21);
    const fs = L.foreStairs;
    const xiF = hull.innerPoint(hull.wAt(FZ, FC), FC, T).x;
    balustrade(bin, [V(fs.x1 + 0.06, FC, FZ - 0.06), V(xiF - 0.05, FC, FZ - 0.06)], 0.95, 0.42, 22);
    // deck edge mouldings at the breaks
    bin.add('woodDark', tone(beam(V(-xiQ, QD - 0.07, QZ + 0.04), V(xiQ, QD - 0.07, QZ + 0.04), 0.16, 0.16), 0xffffff, 0.05), ST);
    bin.add('vertexColor', ochre(beam(V(-xiQ, QD - 0.2, QZ + 0.07), V(xiQ, QD - 0.2, QZ + 0.07), 0.06, 0.07)), ST);
    bin.add('woodDark', tone(beam(V(-xiF, FC - 0.07, FZ - 0.04), V(xiF, FC - 0.07, FZ - 0.04), 0.16, 0.16), 0xffffff, 0.05), ST);
    bin.add('vertexColor', ochre(beam(V(-xiF, FC - 0.2, FZ - 0.07), V(xiF, FC - 0.2, FZ - 0.07), 0.06, 0.07)), ST);
  }

  // ---------------------------------------------------------------- bulkheads, doors, windows
  {
    const bq = bulkhead(hull, QZ, DECK, QD, T, 1, 2);
    bin.add('woodPlanks', paintPlanks(bq, [0.92, 0.86, 0.8], 31), ST);
    const bf = bulkhead(hull, FZ, DECK, FC, T, -1, 2);
    bin.add('woodPlanks', paintPlanks(bf, [0.92, 0.86, 0.8], 32), ST);
    // captain's cabin door (quarterdeck front)
    const door = (x: number, z: number, w: number, h: number, facing: 1 | -1): void => {
      const f = facing;
      const back = quad(V(x - (f * w) / 2, DECK, z + f * 0.01), V(x + (f * w) / 2, DECK, z + f * 0.01), V(x + (f * w) / 2, DECK + h, z + f * 0.01), V(x - (f * w) / 2, DECK + h, z + f * 0.01));
      bin.add('vertexColor', setRGB(back, 0.05, 0.04, 0.03), ST);
      const leaf = plankBox(w - 0.1, h - 0.06, 0.06, 'y');
      leaf.translate(x, DECK + h / 2, z + f * 0.05);
      bin.add('woodPlanks', paintPlanks(leaf, [0.62, 0.5, 0.42], x), ST);
      const fr: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) fr.push(box(0.14, h + 0.1, 0.12, 'y').translate(x + (s * (w + 0.1)) / 2, DECK + h / 2, z + f * 0.05));
      fr.push(box(w + 0.4, 0.16, 0.14, 'x').translate(x, DECK + h + 0.08, z + f * 0.06));
      bin.add('woodDark', tone(merge(fr), 0xffffff, 0.06), ST);
      const handle = new THREE.SphereGeometry(0.045, 5, 4);
      handle.translate(x + (f * w) / 3, DECK + h * 0.5, z + f * 0.1);
      bin.add('brass', tone(handle, 0xc9973a, 0), ST);
    };
    door(-1.0, QZ, 1.1, 1.75, 1);
    door(1.35, FZ, 0.9, 1.12, -1);
    for (const x of [-2.75, 0.75]) {
      const m = frameAt(V(x, 4.75, QZ + 0.01), V(0, 0, 1));
      stampMatrix(bin, windowKit(0.55, 0.42, 'glass', 'woodDark'), m, ST);
    }
    // lantern next to the cabin door
    bin.add('woodDark', tone(beam(V(0.0, 5.15, QZ), V(0.0, 5.15, QZ + 0.32), 0.06, 0.06), 0xffffff, 0), ST);
    stamp(bin, lanternKit(), 0.0, 4.55, QZ + 0.32, 0, 0, 0, 1, ST);
  }

  // ---------------------------------------------------------------- stairs
  {
    const qs = L.quarterStairs;
    const qx = (qs.x0 + qs.x1) / 2;
    const run = Math.abs(qs.zTop - qs.zBottom);
    stamp(bin, stairsKit(qs.x1 - qs.x0, QD - DECK, run, 9, 1), qx, DECK, qs.zBottom, Math.PI, 0, 0, 1, ST);
    const fs = L.foreStairs;
    const fx = (fs.x0 + fs.x1) / 2;
    stamp(bin, stairsKit(fs.x1 - fs.x0, FC - DECK, fs.zTop - fs.zBottom, 6, 1), fx, DECK, fs.zBottom, 0, 0, 0, 1, ST);
  }

  // ---------------------------------------------------------------- deck furniture
  const barrel = barrelKit(0.3, 0.82, 1);
  const barrel2 = barrelKit(0.27, 0.74, 2);
  const crate = crateKit(0.85, 0.78, 0.85, 3);
  const crateS = crateKit(0.68, 0.6, 0.68, 4);
  const coil = coilKit(0.36);
  stamp(bin, gratingKit(1.9, 1.6), 0, DECK, -1.6);
  stamp(bin, gratingKit(2.0, 1.8), 0, DECK, 5.0);
  stamp(bin, gratingKit(1.3, 1.0), 0, QD, -14.0);
  stamp(bin, capstanKit(), 0.25, DECK, -5.6, 0.3);
  // fife rail around the main mast
  {
    const mz = L.masts.main;
    const fr: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fr.push(box(0.14, 0.82, 0.14, 'y').translate(sx * 0.72, DECK + 0.41, mz + sz * 0.62));
    for (const sz of [-1, 1]) fr.push(box(1.62, 0.1, 0.16, 'x').translate(0, DECK + 0.78, mz + sz * 0.62));
    for (const sx of [-1, 1]) fr.push(box(0.16, 0.1, 1.4, 'z').translate(sx * 0.72, DECK + 0.78, mz));
    bin.add('woodDark', tone(merge(fr), 0xffffff, 0.06));
    const pins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) pins.push(spar(V(-0.5 + i * 0.2, DECK + 0.7, mz - 0.62), V(-0.5 + i * 0.2, DECK + 1.0, mz - 0.62), 0.025, 0.035, 4));
    bin.add('woodPale', tone(merge(pins), 0xffffff, 0));
  }
  // cargo
  stamp(bin, crate, 3.05, DECK, -3.2, 0.1);
  stamp(bin, crate, 3.12, DECK, -2.25, -0.08);
  stamp(bin, crateS, 3.08, DECK + 0.78, -2.75, 0.35);
  stamp(bin, barrel, 3.3, DECK, 2.7);
  stamp(bin, barrel2, 3.35, DECK, 3.45, 1);
  stamp(bin, barrel, 2.62, DECK, 3.05, 2);
  stamp(bin, crate, -3.18, DECK, 3.45, -0.12);
  stamp(bin, crateS, -3.2, DECK, 4.35, 0.2);
  stamp(bin, barrel2, -3.25, DECK, 5.15);
  stamp(bin, barrel, -3.32, DECK, -6.2);
  stamp(bin, barrel2, -3.3, DECK, -6.95, 0.5);
  stamp(bin, barrel, -2.6, DECK, -6.6, 1.2);
  stamp(bin, coil, 1.3, DECK, -4.3);
  stamp(bin, coil, 1.6, DECK, 7.0, 1.0);
  stamp(bin, barrel, -2.3, QD, -13.9);
  stamp(bin, barrel2, -2.55, QD, -13.15, 0.7);
  stamp(bin, coil, 2.3, QD, -13.5, 0.4);
  stamp(bin, coil, 1.3, FC, 11.6, 2.0, 0, 0, 0.8);
  // ship's wheel on the quarterdeck (helmsman faces the bow)
  stamp(bin, wheelKit(0.62), 0, QD, -10.0);
  // bowsprit bitts on the forecastle
  {
    const bt: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) bt.push(box(0.26, 0.95, 0.26, 'y').translate(sx * 0.45, FC + 0.47, 12.35));
    bt.push(box(1.2, 0.18, 0.22, 'x').translate(0, FC + 0.78, 12.35));
    bin.add('woodDark', tone(merge(bt), 0xffffff, 0.06));
  }

  // ---------------------------------------------------------------- gun ports & cannons
  {
    const lidRGB = PAINT_RED;
    const ports = [-6.3, -0.6, 3.2, 6.7];
    const openSB = [true, true, true, false];
    const openPS = [false, true, true, true];
    ports.forEach((z, i) => {
      const y = 2.35 + gRise(z);
      stampMatrix(bin, gunPortKit(openSB[i], lidRGB), hullFrame(hull, z, y, 1, 0.03, true), ST);
      stampMatrix(bin, gunPortKit(openPS[i], lidRGB), hullFrame(hull, z, y, -1, 0.03, true), ST);
    });
  }

  // ---------------------------------------------------------------- stern
  {
    const st0 = hull.station(0);
    const S0 = st0.S;
    const zT = (y: number): number => hull.zOf(0, y);
    const xT = (y: number): number => hull.xOf(st0, y);
    const sternN = (y: number): V3 => V(0, (zT(y + 0.1) - zT(y - 0.1)) / 0.2, -1).normalize();
    const sternFrame = (x: number, y: number, out = 0): THREE.Matrix4 => frameAt(V(x, y, zT(y)).addScaledVector(sternN(y), out), sternN(y));
    // gallery windows (warm lamplight), pilasters, sill & cornice
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) stampMatrix(bin, windowKit(0.72, 0.95, 'glow'), sternFrame(x, 4.62, 0.02), ST);
    const pil: THREE.BufferGeometry[] = [];
    for (const x of [-2.75, -1.65, -0.55, 0.55, 1.65, 2.75]) {
      const g = box(0.13, 1.25, 0.08, 'y').translate(0, 0, 0.05);
      g.applyMatrix4(sternFrame(x, 4.65));
      pil.push(g);
    }
    bin.add('vertexColor', ochre(merge(pil), 41), ST);
    for (const y of [4.06, 5.24]) {
      const b = box(6.3, 0.13, 0.15, 'x').translate(0, 0, 0.06);
      b.applyMatrix4(sternFrame(0, y));
      bin.add('woodDark', tone(b, 0xffffff, 0.05), ST);
      const o = box(6.2, 0.05, 0.17, 'x').translate(0, -0.085, 0.06);
      o.applyMatrix4(sternFrame(0, y));
      bin.add('vertexColor', ochre(o, y), ST);
    }
    // painted taffrail panel with ochre border
    {
      const w = 2 * xT(5.72) - 0.5;
      const panel = plankBox(w, 0.74, 0.05, 'x').translate(0, 0, 0.03);
      panel.applyMatrix4(sternFrame(0, 5.73));
      bin.add('woodPlanks', paintPlanks(panel, PAINT_RED, 42, 0.08), ST);
      const bd: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) {
        bd.push(box(w + 0.1, 0.06, 0.07, 'x').translate(0, s * 0.39, 0.06));
        bd.push(box(0.07, 0.78, 0.07, 'y').translate((s * w) / 2, 0, 0.06));
      }
      for (const x of [-1.2, 0, 1.2]) {
        const dia = box(0.22, 0.22, 0.05, 'y');
        dia.rotateZ(Math.PI / 4);
        dia.translate(x, 0, 0.07);
        bd.push(dia);
      }
      const bdg = merge(bd);
      bdg.applyMatrix4(sternFrame(0, 5.73));
      bin.add('vertexColor', ochre(bdg, 43), ST);
    }
    // carved crest above the taffrail with a gold medallion
    {
      const zc = zT(S0) - 0.02;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const n = 12;
      const top: V3[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(-2.7, 2.7, u);
        const yt = S0 + 0.14 + 0.62 * Math.pow(Math.sin(Math.PI * u), 0.8);
        pos.push(x, S0 - 0.02, zc, x, yt, zc - 0.03);
        uv.push(x / TILE.grainU, 0, x / TILE.grainU, (yt - S0) / TILE.grainV);
        top.push(V(x, yt, zc - 0.03));
      }
      for (let i = 0; i < n; i++) {
        const a = i * 2;
        idx.push(a, a + 3, a + 2, a, a + 1, a + 3);
      }
      const crest = fromArrays(pos, uv, idx);
      bin.add('woodDark', tone(crest, 0xffffff, 0.06), ST);
      const back = fromArrays(pos.slice(), uv.slice(), idx.map((v, k) => (k % 3 === 1 ? idx[k + 1] : k % 3 === 2 ? idx[k - 1] : v)));
      for (let i = 2; i < back.attributes.position.count * 3; i += 3) (back.attributes.position.array as Float32Array)[i] += 0.06;
      back.computeVertexNormals();
      bin.add('woodDark', tone(back, 0xffffff, 0.06), ST);
      const rim = tube(top, () => 0.055, 5, { upRef: V(0, 0, 1) });
      bin.add('vertexColor', ochre(rim, 44), ST);
      const med = new THREE.CylinderGeometry(0.27, 0.27, 0.08, 14);
      med.rotateX(Math.PI / 2);
      med.translate(0, S0 + 0.43, zc - 0.07);
      bin.add('gold', tone(med, 0xf2c14e, 0.04), ST);
      const skull = new THREE.SphereGeometry(0.12, 7, 5);
      skull.scale(1, 1.05, 0.5);
      skull.translate(0, S0 + 0.45, zc - 0.12);
      bin.add('vertexColor', tone(skull, 0xece6d6, 0.03), ST);
      // corner posts + lanterns, big central lantern
      for (const s of [-1, 1]) {
        const x = s * (xT(S0) - 0.2);
        const post = box(0.18, 0.62, 0.18, 'y').translate(x, S0 + 0.31, zT(S0) + 0.12);
        bin.add('woodDark', tone(post, 0xffffff, 0.05), ST);
        stamp(bin, lanternKit(), x, S0 + 0.62, zT(S0) + 0.12, 0, 0, 0, 1.15, ST);
      }
      stamp(bin, lanternKit(), 0, S0 + 0.74, zc + 0.05, 0, 0, 0, 1.45, ST);
    }
    // taffrail balustrade across the stern
    {
      const xi = hull.innerPoint(0, S0, T).x;
      balustrade(bin, [V(-xi, S0 + 0.08, zT(S0) + 0.12), V(xi, S0 + 0.08, zT(S0) + 0.12)], 0.52, 0.5, 45);
      const cap = beam(V(-xT(S0) - 0.05, S0 + 0.03, zT(S0) + 0.1), V(xT(S0) + 0.05, S0 + 0.03, zT(S0) + 0.1), 0.34, 0.11);
      bin.add('woodDark', tone(cap, 0xffffff, 0.05), ST);
    }
    // stern gallery (balcony) under the windows
    {
      const kit: Kit = [];
      const floor = plankBox(6.3, 0.1, 0.82, 'x').translate(0, 0, 0.41);
      kit.push({ m: 'woodPlanks', g: paintPlanks(floor, [0.95, 0.9, 0.84], 46) });
      const posts: THREE.BufferGeometry[] = [];
      for (let x = -3.0; x <= 3.01; x += 0.43) posts.push(box(0.07, 0.5, 0.07, 'y').translate(x, 0.3, 0.76));
      for (const s of [-1, 1]) for (let z = 0.15; z < 0.7; z += 0.3) posts.push(box(0.07, 0.5, 0.07, 'y').translate(s * 3.05, 0.3, z));
      kit.push({ m: 'wood', g: tone(merge(posts), 0xf0dcc0, 0.08) });
      const rails: THREE.BufferGeometry[] = [box(6.25, 0.08, 0.13, 'x').translate(0, 0.58, 0.76)];
      for (const s of [-1, 1]) rails.push(box(0.13, 0.08, 0.8, 'z').translate(s * 3.08, 0.58, 0.38));
      for (const x of [-2.6, -0.9, 0.9, 2.6]) rails.push(beam(V(x, -0.85, 0.02), V(x, -0.06, 0.74), 0.14, 0.14, V(0, 0, 1)));
      kit.push({ m: 'woodDark', g: tone(merge(rails), 0xffffff, 0.06) });
      kit.push({ m: 'vertexColor', g: ochre(box(6.35, 0.07, 0.04, 'x').translate(0, -0.03, 0.83)) });
      stampMatrix(bin, kit, sternFrame(0, 3.9), ST);
    }
    // stern chasers
    for (const s of [-1, 1]) stampMatrix(bin, gunPortKit(true, PAINT_RED), sternFrame(s * 1.45, 2.5, 0.01), ST);
    // quarter galleries
    for (const side of [1, -1] as const) {
      const zc = -13.35;
      const xh = hw(zc, 4.6);
      const kit: Kit = [];
      const body = plankBox(0.56, 1.66, 1.85, 'z').translate(0, 0, 0);
      kit.push({ m: 'woodPlanks', g: paintPlanks(body, PAINT_RED, 47, 0.08) });
      const dark: THREE.BufferGeometry[] = [];
      dark.push(box(0.8, 0.14, 2.05, 'z').translate(0.06, 0.9, 0));
      dark.push(box(0.66, 0.12, 1.95, 'z').translate(0.02, -0.86, 0));
      kit.push({ m: 'woodDark', g: tone(merge(dark), 0xffffff, 0.05) });
      const drop = new THREE.ConeGeometry(0.4, 0.9, 8);
      drop.rotateX(Math.PI);
      drop.scale(0.8, 1, 1.6);
      drop.translate(0, -1.37, 0);
      kit.push({ m: 'woodDark', g: tone(drop, 0xffffff, 0.06) });
      const roof = new THREE.ConeGeometry(0.42, 0.55, 8);
      roof.scale(0.85, 1, 1.75);
      roof.translate(0.02, 1.24, 0);
      kit.push({ m: 'woodDark', g: tone(roof, 0xffffff, 0.06) });
      const fin = new THREE.SphereGeometry(0.11, 6, 4).translate(0.02, 1.56, 0);
      kit.push({ m: 'gold', g: tone(fin, 0xf2c14e, 0) });
      kit.push({ m: 'vertexColor', g: ochre(merge([box(0.62, 0.05, 1.9, 'z').translate(0.02, 0.8, 0), box(0.62, 0.05, 1.9, 'z').translate(0.02, -0.78, 0)])) });
      const m = new THREE.Matrix4().makeTranslation(side * (xh + 0.16), 4.6, zc);
      if (side < 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      stampMatrix(bin, kit, m, ST);
      for (const z of [-13.82, -12.9]) {
        const wm = frameAt(V(side * (xh + 0.45), 4.62, z), V(side, 0, 0));
        stampMatrix(bin, windowKit(0.48, 0.72, 'glass'), wm, ST);
      }
    }
    // rudder with iron straps
    {
      const path: V3[] = [];
      for (let i = 0; i <= 6; i++) {
        const y = lerp(-2.1, 3.45, i / 6);
        path.push(V(0, y, zT(y) - 0.04));
      }
      const sides = path.map(() => V(1, 0, 0));
      const rud = sweep(path, [[-0.15, 0], [0.15, 0], [0.15, 1.05], [-0.15, 1.05]], { sides, caps: true });
      bin.add('woodDark', paintBottom(rud, 48));
      const straps: THREE.BufferGeometry[] = [];
      for (const y of [0.5, 1.6, 2.7]) {
        const b = box(0.34, 0.1, 0.9, 'z');
        b.translate(0, y, zT(y) - 0.5);
        straps.push(b);
      }
      bin.add('metal', tone(merge(straps), ShipColors.ironDark, 0.05));
    }
  }

  // ---------------------------------------------------------------- bow
  const bowsprit0 = V(0, 5.25, 12.6);
  const bowsprit1 = V(0, 9.55, 24.3);
  {
    // stem post
    const st1 = hull.station(1);
    const stem: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const y = lerp(st1.D + 0.1, st1.S + 0.55, i / 12);
      stem.push(V(0, y, hull.zOf(1, y)));
    }
    const sides = stem.map(() => V(-1, 0, 0));
    bin.add('woodDark', paintBottom(sweep(stem, [[-0.17, -0.3], [0.17, -0.3], [0.17, 0.17], [-0.17, 0.17]], { sides, caps: true }), 51), ST);
    // knee of the head + beak platform
    const kneeA = V(0, 0.4, hull.zOf(1, 0.4) + 0.05);
    const kneeC = V(0, 3.95, 17.25);
    const knee = bezier(kneeA, V(0, 2.1, 17.1), kneeC, 8);
    bin.add('woodDark', paintBottom(sweep(knee, [[-0.13, -0.45], [0.13, -0.45], [0.13, 0.05], [-0.13, 0.05]], { sides: knee.map(() => V(-1, 0, 0)), caps: true }), 52), ST);
    const zb = hull.zOf(1, 4.0) - 0.4;
    const beak = fromArrays(
      [-0.95, 4.0, zb, 0.95, 4.0, zb, 0, 4.0, 17.3, -0.95, 3.88, zb, 0.95, 3.88, zb, 0, 3.88, 17.3],
      [-0.4, zb / 4, 0.4, zb / 4, 0, 17.3 / 4, -0.4, zb / 4, 0.4, zb / 4, 0, 17.3 / 4],
      [0, 2, 1, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4],
    );
    bin.add('woodPlanks', paintPlanks(beak, [0.9, 0.85, 0.8], 53), ST);
    // head rails (ochre)
    for (const side of [1, -1]) {
      for (const [y0, z0, y1, x1] of [
        [5.15, 13.9, 4.35, 0.22],
        [4.3, 14.35, 4.02, 0.14],
      ]) {
        const a = V(side * (hw(z0, y0) - 0.05), y0, z0);
        const b = V(side * 1.05, y0 - 0.85, 15.9);
        const c = V(side * x1, y1, 17.05);
        const pts = bezier(a, b, c, 8);
        bin.add('vertexColor', ochre(tube(pts, () => 0.065, 5)), ST);
      }
    }
    // figurehead: gilded lion
    const head = new THREE.SphereGeometry(0.34, 8, 6);
    head.scale(0.85, 1.0, 1.1);
    head.translate(0, 4.48, 17.38);
    const snout = new THREE.SphereGeometry(0.17, 6, 5);
    snout.translate(0, 4.38, 17.72);
    bin.add('gold', tone(merge([head, snout]), 0xe8b84a, 0.06), ST);
    const mane = new THREE.SphereGeometry(0.47, 8, 6);
    mane.scale(1.0, 1.05, 0.55);
    mane.translate(0, 4.52, 17.12);
    bin.add('vertexColor', tone(mane, ShipColors.ochreDark, 0.1), ST);
    const scroll = new THREE.TorusGeometry(0.24, 0.07, 4, 10, Math.PI * 1.4);
    scroll.rotateY(Math.PI / 2);
    scroll.translate(0, 3.92, 17.15);
    bin.add('vertexColor', ochre(scroll), ST);
    // catheads + catted anchors, hawse holes, mooring cable
    const anchor = anchorKit(1);
    for (const side of [1, -1] as const) {
      const a = V(side * (hw(12.55, 5.5) - 0.3), 5.55, 12.55);
      const b = V(side * 3.05, 5.72, 13.15);
      bin.add('woodDark', tone(beam(a, b, 0.26, 0.26), 0xffffff, 0.05), ST);
      const endCap = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8);
      endCap.rotateZ(Math.PI / 2);
      endCap.rotateY(-side * 0.45);
      endCap.translate(b.x + side * 0.02, b.y, b.z + 0.01);
      bin.add('gold', tone(endCap, 0xf2c14e, 0), ST);
      stamp(bin, anchor, b.x - side * 0.05, b.y - 0.12, b.z, side * 0.95 + Math.PI / 2, 0, 0, 0.95, ST);
      const hm = hullFrame(hull, 14.05, 3.55, side, 0.0);
      const ring = new THREE.CylinderGeometry(0.19, 0.19, 0.12, 8, 1, true);
      ring.rotateX(Math.PI / 2);
      ring.applyMatrix4(hm);
      bin.add('metal', tone(ring, ShipColors.iron, 0), ST);
      const hole = new THREE.CircleGeometry(0.16, 8);
      hole.translate(0, 0, 0.01);
      hole.applyMatrix4(hm);
      bin.add('vertexColor', setRGB(hole, 0.03, 0.03, 0.03), ST);
    }
    {
      const p = hull.pointAt(14.05, 3.55);
      const cable = tube(bezier(V(-p.x - 0.05, 3.55, p.z + 0.05), V(-p.x - 0.9, 1.4, p.z + 2.6), V(-p.x - 1.5, -0.8, p.z + 5.0), 8), () => 0.06, 4);
      bin.add('rope', tone(cable, 0x8a7458, 0.08));
    }
    // bowsprit, jib boom, gammoning, spritsail yard
    const bs = spar(bowsprit0, bowsprit1, 0.32, 0.15, 10, true);
    bin.add('wood', tone(bs, 0xf3e4cc, 0.08), ST);
    const jb0 = V(0, 8.75, 22.0);
    const jb1 = V(0, 10.75, 27.4);
    bin.add('wood', tone(spar(jb0, jb1, 0.12, 0.06, 7, true), 0xf3e4cc, 0.08), ST);
    const dir = new THREE.Vector3().subVectors(bowsprit1, bowsprit0).normalize();
    for (const t of [0.22, 0.27]) {
      const c = new THREE.Vector3().lerpVectors(bowsprit0, bowsprit1, t);
      const g = spar(c.clone().addScaledVector(dir, -0.1), c.clone().addScaledVector(dir, 0.1), 0.36, 0.35, 8);
      bin.add('rope', tone(g, 0x6e5c48, 0.05));
    }
    const capB = box(0.5, 0.42, 0.3, 'y').translate(0, 0, 0);
    capB.applyMatrix4(frameAt(V(0, 9.42, 23.9), dir));
    bin.add('woodDark', tone(capB, 0xffffff, 0.05), ST);
    yard(bin, V(0, 7.75, 20.9), 3.0, 0.11);
    furledSail(bin, V(0, 7.75, 20.9), 2.7, 0.17);
    line(bin, V(-2.9, 7.75, 20.9), V(0, 8.9, 22.6), 0.02);
    line(bin, V(2.9, 7.75, 20.9), V(0, 8.9, 22.6), 0.02);
  }

  // ---------------------------------------------------------------- masts, yards, sails
  const MZ = L.masts.main;
  const FZm = L.masts.fore;
  const ZZ = L.masts.mizzen;
  // main mast
  mastSegment(bin, V(0, DECK - 0.2, MZ), V(0, 17.3, MZ), 0.4, 0.3);
  mastBands(bin, 0, MZ, [5.4, 7.4, 9.4, 11.4, 13.4], 0.375);
  crowsNest(bin, V(0, 15.6, MZ), 1.25);
  mastCap(bin, 0, 17.35, MZ, MZ + 0.5);
  mastSegment(bin, V(0, 15.5, MZ + 0.5), V(0, 24.4, MZ + 0.5), 0.25, 0.17, 8);
  crosstrees(bin, 0, 23.6, MZ + 0.5, 1.05);
  mastCap(bin, 0, 24.45, MZ + 0.5, MZ + 0.8, 0.42);
  mastSegment(bin, V(0, 23.4, MZ + 0.8), V(0, 28.0, MZ + 0.8), 0.14, 0.07, 6);
  yard(bin, V(0, 14.6, MZ + 0.5), 6.5, 0.19);
  yard(bin, V(0, 21.5, MZ + 0.82), 5.0, 0.15);
  yard(bin, V(0, 25.8, MZ + 1.0), 3.3, 0.1);
  furledSail(bin, V(0, 14.6, MZ + 0.5), 6.1, 0.27);
  squareSail(bin, { yTop: 21.35, yBot: 15.05, halfTop: 4.8, halfBot: 6.1, z: MZ + 0.95, belly: 1.25, patches: [[0.14, 0.52, 0.3, 0.7], [0.63, 0.18, 0.76, 0.31]] });
  furledSail(bin, V(0, 25.8, MZ + 1.0), 3.05, 0.17);
  // fore mast
  mastSegment(bin, V(0, FC - 0.2, FZm), V(0, 15.8, FZm), 0.35, 0.27);
  mastBands(bin, 0, FZm, [6.6, 8.6, 10.6, 12.6], 0.33);
  topPlatform(bin, V(0, 14.3, FZm), 2.0, 1.6);
  mastCap(bin, 0, 15.9, FZm, FZm + 0.45);
  mastSegment(bin, V(0, 14.4, FZm + 0.45), V(0, 21.6, FZm + 0.45), 0.22, 0.15, 8);
  crosstrees(bin, 0, 20.9, FZm + 0.45, 0.9);
  mastSegment(bin, V(0, 20.6, FZm + 0.7), V(0, 24.6, FZm + 0.7), 0.12, 0.06, 6);
  yard(bin, V(0, 13.4, FZm + 0.45), 5.6, 0.17);
  yard(bin, V(0, 19.6, FZm + 0.72), 4.3, 0.14);
  yard(bin, V(0, 23.1, FZm + 0.9), 2.8, 0.09);
  furledSail(bin, V(0, 13.4, FZm + 0.45), 5.25, 0.25);
  squareSail(bin, { yTop: 19.45, yBot: 13.85, halfTop: 4.1, halfBot: 5.3, z: FZm + 0.86, belly: 1.05, flip: true, patches: [[0.55, 0.45, 0.7, 0.62]] });
  squareSail(bin, { yTop: 22.95, yBot: 19.95, halfTop: 2.65, halfBot: 3.95, z: FZm + 1.0, belly: 0.55 });
  // mizzen mast with a lateen sail
  mastSegment(bin, V(0, QD - 0.2, ZZ), V(0, 16.5, ZZ), 0.31, 0.24);
  mastBands(bin, 0, ZZ, [7.6, 9.6, 11.6, 13.6], 0.29);
  topPlatform(bin, V(0, 15.2, ZZ), 1.6, 1.3);
  mastSegment(bin, V(0, 15.1, ZZ + 0.4), V(0, 21.6, ZZ + 0.4), 0.18, 0.11, 8);
  crosstrees(bin, 0, 20.9, ZZ + 0.4, 0.7);
  {
    const yc = V(0.34, 13.1, ZZ + 0.15);
    const fwd = V(0.34, 8.4, -7.65);
    const aft = V(0.34, 17.8, -16.95);
    for (const end of [fwd, aft]) bin.add('woodDark', tone(spar(yc, end, 0.15, 0.07, 7, true), 0xffffff, 0.05), ST);
    triSail(bin, V(0.4, 8.3, -7.95), V(0.45, 7.35, -16.25), V(0.4, 17.45, -16.6), V(0.55, 0, 0));
  }
  yard(bin, V(0, 19.9, ZZ + 0.62), 3.0, 0.1);
  furledSail(bin, V(0, 19.9, ZZ + 0.62), 2.75, 0.16);
  // fore topmast staysail
  {
    const top = V(0, 21.3, FZm + 0.45);
    const end = bowsprit1;
    const at = (t: number): V3 => new THREE.Vector3().lerpVectors(top, end, t);
    triSail(bin, at(0.88).add(V(0.05, -0.15, 0)), V(0.25, 10.2, 17.3), at(0.4).add(V(0.05, -0.2, 0)), V(0.45, 0, -0.1));
  }
  // flag & pennants
  jollyRoger(bin, V(0.08, 27.85, MZ + 0.8), 2.5, 1.66);
  pennant(bin, V(0.06, 24.5, FZm + 0.7), 3.4, 0.42);
  pennant(bin, V(0.06, 21.5, ZZ + 0.4), 2.6, 0.36);
  for (const [x, y, z, r] of [
    [0, 28.05, MZ + 0.8, 0.13],
    [0, 24.65, FZm + 0.7, 0.11],
    [0, 21.65, ZZ + 0.4, 0.11],
  ]) {
    const truck = new THREE.CylinderGeometry(r, r, 0.12, 8).translate(x, y, z);
    bin.add('woodDark', tone(truck, 0xffffff, 0), ST);
  }

  // ---------------------------------------------------------------- standing & running rigging
  const chainPlate = (z: number): V3 => {
    const y = S(z);
    return V(hw(z, y) + 0.32, y + 0.02, z);
  };
  const lowerShrouds = (mz: number, topY: number, zOffsets: number[], ratTop: number): void => {
    for (const side of [1, -1] as const) {
      const feet = zOffsets.map((dz) => {
        const p = chainPlate(mz + dz);
        p.x *= side;
        return p;
      });
      const tops = zOffsets.map((_, k) => V(side * 0.36, topY, mz + (k - (zOffsets.length - 1) / 2) * 0.1));
      shroudFan(bin, tops, feet, Math.max(...feet.map((f) => f.y)) + 0.55, ratTop, 0.5);
      // channel board
      const z0 = feet[0].z - 0.35;
      const z1 = feet[feet.length - 1].z + 0.35;
      const ych = S((z0 + z1) / 2) - 0.14;
      const xa = hw((z0 + z1) / 2, ych);
      const ch = box(0.48, 0.09, z1 - z0, 'z').translate(side * (xa + 0.2), ych, (z0 + z1) / 2);
      bin.add('woodDark', tone(ch, 0xffffff, 0.05), ST);
      for (const f of feet) deadeye(bin, f, side);
    }
  };
  lowerShrouds(MZ, 15.05, [-1.9, -1.2, -0.5, 0.2, 0.9], 14.5);
  lowerShrouds(FZm, 13.75, [-1.3, -0.6, 0.1, 0.8], 13.2);
  lowerShrouds(ZZ, 14.65, [-1.3, -0.6, 0.1, 0.8], 14.1);
  const topShrouds = (cz: number, baseY: number, rimR: number, topY: number, topZ: number, ratFrom: number, ratTo: number): void => {
    for (const side of [1, -1]) {
      const feet = [-0.45, 0.02, 0.48].map((dz) => V(side * rimR, baseY, cz + dz));
      const tops = feet.map(() => V(side * 0.22, topY, topZ));
      shroudFan(bin, tops, feet, ratFrom, ratTo, 0.5, 0.03);
    }
  };
  topShrouds(MZ, 16.4, 1.15, 23.3, MZ + 0.5, 16.9, 22.6);
  topShrouds(FZm, 14.42, 0.95, 20.6, FZm + 0.45, 14.9, 20.0);
  topShrouds(ZZ, 15.32, 0.78, 21.0, ZZ + 0.4, 15.8, 20.4);
  // stays
  line(bin, V(0, 15.3, FZm), V(0, 7.45, 18.6), 0.045);
  line(bin, V(0, 21.3, FZm + 0.45), bowsprit1, 0.04);
  line(bin, V(0, 24.4, FZm + 0.7), V(0, 10.7, 27.3), 0.03);
  line(bin, V(0, 16.9, MZ), V(0, 5.6, 10.0), 0.05);
  line(bin, V(0, 24.0, MZ + 0.5), V(0, 15.6, FZm - 0.25), 0.04);
  line(bin, V(0, 27.6, MZ + 0.8), V(0, 21.0, FZm + 0.45), 0.03);
  line(bin, V(0, 16.2, ZZ), V(0, 8.0, MZ - 0.4), 0.04);
  line(bin, V(0, 21.3, ZZ + 0.4), V(0, 16.2, MZ - 0.3), 0.03);
  // backstays
  for (const side of [1, -1]) {
    const bsz: Array<[V3, number]> = [
      [V(side * 0.24, 23.8, MZ + 0.5), -5.6],
      [V(side * 0.22, 21.0, FZm + 0.45), 7.4],
      [V(side * 0.18, 21.0, ZZ + 0.4), -14.2],
    ];
    for (const [top, z] of bsz) {
      const f = chainPlate(z);
      line(bin, top, V(side * f.x, f.y, z), 0.035);
    }
  }
  // lifts & braces (running rigging, lighter hemp)
  const liftsAndBraces: Array<[V3, number, V3]> = [
    [V(0, 14.6, MZ + 0.5), 6.4, V(0, 17.2, MZ)],
    [V(0, 21.5, MZ + 0.82), 4.9, V(0, 24.3, MZ + 0.5)],
    [V(0, 13.4, FZm + 0.45), 5.5, V(0, 15.7, FZm)],
    [V(0, 19.6, FZm + 0.72), 4.2, V(0, 21.5, FZm + 0.45)],
    [V(0, 19.9, ZZ + 0.62), 2.9, V(0, 21.5, ZZ + 0.4)],
  ];
  for (const [c, half, head] of liftsAndBraces) {
    for (const s of [-1, 1]) {
      const end = V(s * half, c.y, c.z);
      line(bin, end, V(s * 0.25, head.y, head.z), 0.02, 0, false);
    }
  }
  const braces: Array<[V3, V3]> = [
    [V(6.4, 14.6, MZ + 0.5), V(0, -1, -7.2)],
    [V(4.9, 21.5, MZ + 0.82), V(0.3, 15.0, ZZ)],
    [V(5.5, 13.4, FZm + 0.45), V(0.3, 9.0, MZ)],
    [V(4.2, 19.6, FZm + 0.72), V(0.25, 19.0, MZ + 0.5)],
    [V(2.9, 19.9, ZZ + 0.62), V(0, -1, -14.6)],
  ];
  for (const [end, to] of braces) {
    for (const s of [-1, 1]) {
      let target: V3;
      if (to.y < 0) {
        const f = chainPlate(to.z);
        target = V(s * (f.x - 0.3), f.y + 0.1, to.z);
      } else target = V(s * to.x, to.y, to.z);
      line(bin, V(s * end.x, end.y, end.z), target, 0.02, 0.15, false);
    }
  }

  // ---------------------------------------------------------------- colliders
  const masts: Array<[number, number, number, number]> = [
    [MZ, 0.46, DECK, 28],
    [FZm, 0.4, FC, 24.6],
    [ZZ, 0.36, QD, 21.6],
  ];
  for (const [z, r, y0, y1] of masts) colliders.push({ type: 'circle', x: 0, z, radius: r, yMin: y0, yMax: y1, tag: 'mast' });
  // bulwarks (both sides, with the boarding gap on port) — from the waterline to the rail top
  const midOutline = (zl: number[], y: (z: number) => number): V3[] =>
    zl.map((z) => {
      const w = hull.wOf(z);
      const yy = y(z);
      return hull.point(w, yy).lerp(hull.innerPoint(w, yy, T), 0.5);
    });
  const deckAt = (z: number): number => (z < QZ ? QD : z > FZ ? FC : DECK);
  const allOutline = midOutline(zs, deckAt);
  const chunk = (z: number): number => (z > 9 || z < -12 ? 1.1 : 2.4);
  const railTop = (z: number): number => S(z) + (z < QZ + 0.2 || z > FZ - 0.2 ? 0.68 : 0.12);
  railColliders(colliders, allOutline, 1, 0, railTop, chunk);
  railColliders(colliders, allOutline.filter((p) => p.z <= gap.gapZ0 + 1e-6), -1, 0, railTop, chunk);
  railColliders(colliders, allOutline.filter((p) => p.z >= gap.gapZ1 - 1e-6), -1, 0, railTop, chunk);
  {
    const xs = hull.innerPoint(0, QD, T).x;
    colliders.push({ type: 'box', x: 0, z: hull.zOf(0, QD) + 0.12, halfX: xs + 0.1, halfZ: 0.16, yaw: 0, yMin: 0, yMax: S(-15) + 0.7, tag: 'ship' });
    const qs = L.quarterStairs;
    const xiQ = hull.innerPoint(hull.wAt(QZ, QD), QD, T).x;
    colliders.push({ type: 'box', x: (-xiQ + qs.x0) / 2, z: QZ + 0.06, halfX: (qs.x0 + xiQ) / 2, halfZ: 0.08, yaw: 0, yMin: QD, yMax: QD + 1.0, tag: 'rail' });
    colliders.push({ type: 'box', x: qs.x0 - 0.07, z: (QZ + qs.zBottom) / 2 - 0.5, halfX: 0.06, halfZ: Math.abs(QZ - qs.zBottom) / 2 - 0.5, yaw: 0, yMin: DECK, yMax: QD + 1.0, tag: 'rail' });
    const fs = L.foreStairs;
    const xiF = hull.innerPoint(hull.wAt(FZ, FC), FC, T).x;
    colliders.push({ type: 'box', x: (fs.x1 + xiF) / 2, z: FZ - 0.06, halfX: (xiF - fs.x1) / 2, halfZ: 0.08, yaw: 0, yMin: FC, yMax: FC + 1.0, tag: 'rail' });
    colliders.push({ type: 'box', x: fs.x1 + 0.07, z: (FZ + fs.zBottom) / 2 + 0.35, halfX: 0.06, halfZ: (FZ - fs.zBottom) / 2 - 0.35, yaw: 0, yMin: DECK, yMax: FC + 1.0, tag: 'rail' });
  }
  // deck furniture & cargo
  colliders.push(
    { type: 'box', x: 0, z: MZ, halfX: 0.82, halfZ: 0.72, yaw: 0, yMin: DECK, yMax: DECK + 0.95, tag: 'ship' },
    { type: 'circle', x: 0.25, z: -5.6, radius: 0.6, yMin: DECK, yMax: DECK + 1.05, tag: 'ship' },
    { type: 'box', x: 0, z: -10.0, halfX: 0.45, halfZ: 0.32, yaw: 0, yMin: QD, yMax: QD + 1.75, tag: 'ship' },
    { type: 'box', x: 3.1, z: -2.72, halfX: 0.48, halfZ: 0.98, yaw: 0, yMin: DECK, yMax: DECK + 1.4, tag: 'cargo' },
    { type: 'box', x: 3.0, z: 3.08, halfX: 0.68, halfZ: 0.72, yaw: 0, yMin: DECK, yMax: DECK + 0.85, tag: 'cargo' },
    { type: 'box', x: -3.2, z: 4.3, halfX: 0.46, halfZ: 1.25, yaw: 0, yMin: DECK, yMax: DECK + 0.85, tag: 'cargo' },
    { type: 'box', x: -3.0, z: -6.58, halfX: 0.68, halfZ: 0.72, yaw: 0, yMin: DECK, yMax: DECK + 0.85, tag: 'cargo' },
    { type: 'box', x: -2.42, z: -13.52, halfX: 0.4, halfZ: 0.72, yaw: 0, yMin: QD, yMax: QD + 0.85, tag: 'cargo' },
    { type: 'box', x: 0, z: 12.35, halfX: 0.62, halfZ: 0.2, yaw: 0, yMin: FC, yMax: FC + 0.95, tag: 'ship' },
    { type: 'box', x: 0, z: 13.7, halfX: 0.36, halfZ: 1.0, yaw: 0, yMin: FC, yMax: FC + 1.4, tag: 'ship' },
  );

  // ---------------------------------------------------------------- platforms
  const halfIn = (outline: V3[], z0: number, z1: number): number => {
    let m = 0;
    for (const p of outline) if (p.z >= z0 - 0.3 && p.z <= z1 + 0.3) m = Math.max(m, p.x);
    return Math.round(m * 100) / 100;
  };
  const deckBox = (outline: V3[], z0: number, z1: number, y: number): LocalPlatform => ({
    x: 0,
    z: (z0 + z1) / 2,
    halfX: halfIn(outline, z0, z1),
    halfZ: (z1 - z0) / 2,
    yaw: 0,
    height: y,
    thickness: 2.5,
    surface: 'wood',
  });
  platforms.push(
    deckBox(inM.deck, QZ, gap.gapZ0, DECK),
    deckBox(inM.deck, gap.gapZ0, 5.0, DECK),
    deckBox(inM.deck, 5.0, 7.5, DECK),
    deckBox(inM.deck, 7.5, FZ, DECK),
    deckBox(inQ.deck, -15, -12, QD),
    deckBox(inQ.deck, -12, QZ, QD),
    deckBox(inF.deck, FZ, 11.5, FC),
    deckBox(inF.deck, 11.5, 13.5, FC),
    deckBox(inF.deck, 13.5, 14.3, FC),
    // boarding step: the gangplank lands at (x = -4.3, y = 3.55, z = -3)
    { x: -4.05, z: (gap.gapZ0 + gap.gapZ1) / 2, halfX: 0.5, halfZ: (gap.gapZ1 - gap.gapZ0) / 2, yaw: 0, height: DECK, thickness: 2.5, surface: 'wood' },
  );
  {
    const qs = L.quarterStairs;
    const run = Math.abs(qs.zTop - qs.zBottom);
    platforms.push({
      x: (qs.x0 + qs.x1) / 2,
      z: (qs.zTop + qs.zBottom) / 2,
      halfX: (qs.x1 - qs.x0) / 2,
      halfZ: run / 2,
      yaw: 0,
      height: (QD + DECK) / 2,
      slope: -(QD - DECK) / run,
      thickness: 2.5,
      surface: 'wood',
    });
    const fs = L.foreStairs;
    const frun = fs.zTop - fs.zBottom;
    platforms.push({
      x: (fs.x0 + fs.x1) / 2,
      z: (fs.zTop + fs.zBottom) / 2,
      halfX: (fs.x1 - fs.x0) / 2,
      halfZ: frun / 2,
      yaw: 0,
      height: (FC + DECK) / 2,
      slope: (FC - DECK) / frun,
      thickness: 2.5,
      surface: 'wood',
    });
  }

  return { name: 'galleon', parts: bin.parts(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Sloop
// ---------------------------------------------------------------------------

const sRise = (zn: number): number => 0.32 * ((zn - 0.5) / 7.5) ** 2;

const SLOOP_HULL: HullParams = {
  zStern: -8,
  zBow: 8,
  halfBeam: 2.55,
  keelY: -1.45,
  maxBeamY: 1.1,
  tumble: 0.035,
  sternBeam: 0.74,
  fullFrom: 0.3,
  fullTo: 0.5,
  bowBluff: 0.68,
  keelRiseStern: 0.12,
  keelRiseBow: 0.45,
  nMid: 2.4,
  nStern: 1.6,
  nBow: 1.7,
  bowRake: 1.9,
  sternRake: 0.5,
  sternOverhang: 0.2,
  sheer: (zn) => 2.72 + sRise(zn) + 0.55 * smoothstep(-3.9, -4.7, zn),
};

/** Two-masted pirate sloop (~16 m). Origin at the waterline, bow +Z. Colliders only (no platforms). */
export function buildSloop(): PropDefinition {
  const bin = new PartBin();
  const hull = new Hull(SLOOP_HULL);
  const T = 0.14;
  const DECK = 2.0;
  const POOP = 2.6;
  const PZ = -4.6;
  const S = (z: number): number => hull.station(hull.wOf(z)).S;
  const hw = (z: number, y: number): number => hull.halfWidth(z, y);
  const steps = [-4.7, PZ, -4.3, -3.9];
  const zs = stationList(-8, 8, [[-4, 0.6], [4, 0.9], [8.01, 0.32]], steps);
  const zsRail = stationList(-8, 8, [[-4, 0.7], [4.5, 1.4], [8.01, 0.4]], steps);

  // hull
  const shell = buildShell(hull, {
    zs,
    bands: [
      { top: () => 0.25, segs: 4 },
      { top: (st) => 1.62 + sRise(st.zn), segs: 3 },
      { top: (st) => 1.86 + sRise(st.zn), segs: 1 },
      { top: (st) => st.S, segs: 3 },
    ],
  });
  bin.add('woodDark', paintBottom(shell.bands[0], 61));
  bin.add('woodPlanks', paintPlanks(shell.bands[1], [1.06, 1.0, 0.94], 62), ST);
  bin.add('woodDark', paintPlanks(shell.bands[2], [1, 1, 1], 63, 0.08), ST);
  bin.add('woodPlanks', paintPlanks(shell.bands[3], PAINT_OCHRE, 64, 0.1), ST);
  const tr = buildTransom(shell);
  bin.add('woodDark', paintBottom(tr[0], 65));
  bin.add('woodPlanks', paintPlanks(tr[1], [0.95, 0.9, 0.85], 66), ST);
  bin.add('woodDark', paintPlanks(tr[2], [1, 1, 1], 67), ST);
  bin.add('woodPlanks', paintPlanks(tr[3], [0.95, 0.9, 0.85], 68), ST);

  // bulwarks & decks
  const zsP = zs.filter((z) => z <= PZ + 1e-6);
  const zsM = zs.filter((z) => z >= PZ - 1e-6);
  const inP = buildInnerBulwark(hull, zsP, POOP, T, 1);
  const inM = buildInnerBulwark(hull, zsM, DECK, T, 1);
  for (const [ib, y0] of [
    [inP, POOP],
    [inM, DECK],
  ] as const) {
    paintPlanks(ib.geo, [0.95, 0.9, 0.84], y0, 0.1);
    shade(ib.geo, (_x, y) => 0.72 + 0.28 * smoothstep(y0, y0 + 0.6, y));
    bin.add('woodPlanks', ib.geo, ST);
  }
  {
    const a = hull.innerPoint(0, POOP, T);
    const b = hull.innerPoint(0, S(-8), T);
    const g = quad(V(a.x, POOP, a.z + 0.02), V(-a.x, POOP, a.z + 0.02), V(-b.x, b.y, b.z + 0.02), V(b.x, b.y, b.z + 0.02));
    bin.add('woodPlanks', paintPlanks(g, [0.8, 0.76, 0.7], 69), ST);
  }
  const deckP = buildDeck(inP.deck, POOP);
  const deckM = buildDeck(inM.deck, DECK);
  for (const d of [deckP, deckM]) {
    shadeRGB(d, (_x, _y, _z, o) => {
      o[0] = 1.08;
      o[1] = 1.02;
      o[2] = 0.94;
    });
    jitterColors(d, 0.1, 0.55, 70);
  }
  shade(deckM, (_x, _y, z) => 1 - 0.3 * (1 - smoothstep(PZ, PZ + 0.8, z)));
  bin.add('woodPlanks', [deckP, deckM]);
  // poop break bulkhead with a door, two steps up
  bin.add('woodPlanks', paintPlanks(bulkhead(hull, PZ, DECK, POOP, T, 1, 1), [0.9, 0.84, 0.78], 71), ST);
  {
    const back = quad(V(-0.95, DECK, PZ + 0.01), V(-0.15, DECK, PZ + 0.01), V(-0.15, POOP - 0.05, PZ + 0.01), V(-0.95, POOP - 0.05, PZ + 0.01));
    bin.add('vertexColor', setRGB(back, 0.05, 0.04, 0.03), ST);
    stamp(bin, stairsKit(1.0, POOP - DECK, 0.7, 2, 0), 1.1, DECK, PZ + 0.7, Math.PI, 0, 0, 1, ST);
    const xi = hull.innerPoint(hull.wAt(PZ, POOP), POOP, T).x;
    balustrade(bin, [V(-xi + 0.05, POOP, PZ + 0.05), V(0.55, POOP, PZ + 0.05)], 0.8, 0.42, 72);
    bin.add('woodDark', tone(beam(V(-xi, POOP - 0.06, PZ + 0.04), V(xi, POOP - 0.06, PZ + 0.04), 0.14, 0.14), 0xffffff, 0.05), ST);
  }

  // rails, wale, balustrade on the poop
  for (const side of [1, -1] as const) {
    const path: V3[] = [];
    const sides: V3[] = [];
    for (const z of zsRail) {
      const w = hull.wOf(z);
      const st = hull.station(w);
      const p = hull.point(w, st.S).lerp(hull.innerPoint(w, st.S, T), 0.5);
      const n = hull.planNormal(w, st.S);
      p.y = st.S + 0.03;
      p.x *= side;
      n.x *= side;
      path.push(p);
      sides.push(n);
    }
    if (side < 0) {
      path.reverse();
      sides.reverse();
    }
    const hc = T / 2 + 0.07;
    bin.add('woodDark', tone(sweep(path, [[-hc, -0.045], [hc, -0.045], [hc, 0.05], [-hc, 0.05]], { sides, caps: true }), 0xffffff, 0.05), ST);
    const poopPath = path.filter((p) => p.z <= PZ + 0.01).map((p) => V(p.x, p.y + 0.06, p.z));
    if (poopPath.length > 1) balustrade(bin, poopPath, 0.48, 0.5, side);
  }
  {
    const st0 = hull.station(0);
    const S0 = st0.S;
    const zT = (y: number): number => hull.zOf(0, y);
    const xi = hull.innerPoint(0, S0, T).x;
    balustrade(bin, [V(-xi, S0 + 0.06, zT(S0) + 0.1), V(xi, S0 + 0.06, zT(S0) + 0.1)], 0.48, 0.5, 73);
    bin.add('woodDark', tone(beam(V(-hull.xOf(st0, S0) - 0.04, S0 + 0.02, zT(S0) + 0.09), V(hull.xOf(st0, S0) + 0.04, S0 + 0.02, zT(S0) + 0.09), 0.26, 0.09), 0xffffff, 0.05), ST);
    // stern windows + lantern
    const sternN = V(0, (zT(2.4) - zT(2.2)) / 0.2, -1).normalize();
    for (const x of [-1.0, 0, 1.0]) stampMatrix(bin, windowKit(0.48, 0.42, 'glow'), frameAt(V(x, 2.3, zT(2.3)).addScaledVector(sternN, 0.02), sternN), ST);
    const sill = box(3.0, 0.1, 0.12, 'x');
    sill.applyMatrix4(frameAt(V(0, 2.02, zT(2.02)), sternN));
    bin.add('vertexColor', ochre(sill), ST);
    const post = box(0.12, 0.9, 0.12, 'y').translate(0, S0 + 0.45, zT(S0) + 0.1);
    bin.add('woodDark', tone(post, 0xffffff, 0.05), ST);
    stamp(bin, lanternKit(), 0, S0 + 0.9, zT(S0) + 0.1, 0, 0, 0, 1.2, ST);
    // rudder + tiller
    const path: V3[] = [];
    for (let i = 0; i <= 5; i++) {
      const y = lerp(-1.25, 2.3, i / 5);
      path.push(V(0, y, zT(y) - 0.03));
    }
    bin.add('woodDark', paintBottom(sweep(path, [[-0.11, 0], [0.11, 0], [0.11, 0.75], [-0.11, 0.75]], { sides: path.map(() => V(1, 0, 0)), caps: true }), 74));
    bin.add('woodDark', tone(beam(V(0, POOP + 0.45, -7.4), V(0, POOP + 0.62, -5.6), 0.1, 0.12), 0xffffff, 0.05), ST);
  }
  // wale
  for (const side of [1, -1] as const) {
    const path: V3[] = [];
    const sides: V3[] = [];
    for (const z of stationList(-8, 8, [[-5, 0.8], [5, 1.6], [8.01, 0.45]])) {
      const y = 1.62 + sRise(z);
      const p = hull.point(hull.wOf(z), y);
      const n = hull.normalAt(p.z, y);
      p.x *= side;
      n.x *= side;
      path.push(p);
      sides.push(n);
    }
    if (side < 0) {
      path.reverse();
      sides.reverse();
    }
    bin.add('woodDark', tone(sweep(path, [[-0.02, -0.08], [0.09, -0.06], [0.09, 0.06], [-0.02, 0.08]], { sides, closed: false }), 0xffffff, 0.06), ST);
  }

  // gun ports in the bulwark, cannons
  for (const [z, o1, o2] of [
    [-2.6, true, false],
    [0.4, true, true],
    [3.0, false, true],
  ] as const) {
    for (const side of [1, -1] as const) {
      const m = hullFrame(hull, z, 2.36, side, 0.02, true).multiply(new THREE.Matrix4().makeScale(0.72, 0.72, 0.72));
      stampMatrix(bin, gunPortKit(side > 0 ? o1 : o2, PAINT_RED), m, ST);
    }
  }

  // deck furniture
  stamp(bin, gratingKit(1.4, 1.2), 0, DECK, 0.9);
  stamp(bin, barrelKit(0.27, 0.74, 5), 1.75, DECK, -3.3);
  stamp(bin, barrelKit(0.27, 0.74, 6), 1.8, DECK, -2.6, 0.7);
  stamp(bin, crateKit(0.7, 0.62, 0.7, 7), -1.85, DECK, 1.6, 0.2);
  stamp(bin, crateKit(0.6, 0.55, 0.6, 8), -1.75, DECK, 2.35, -0.3);
  stamp(bin, coilKit(0.3), 1.2, DECK, 2.3);
  stamp(bin, coilKit(0.28), -0.9, POOP, -6.6, 1.0);
  // bow: stem, bowsprit, catted anchor
  const bs0 = V(0, 2.85, 6.4);
  const bs1 = V(0, 5.25, 13.0);
  {
    const st1 = hull.station(1);
    const stem: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = lerp(st1.D + 0.1, st1.S + 0.35, i / 10);
      stem.push(V(0, y, hull.zOf(1, y)));
    }
    bin.add('woodDark', paintBottom(sweep(stem, [[-0.12, -0.22], [0.12, -0.22], [0.12, 0.12], [-0.12, 0.12]], { sides: stem.map(() => V(-1, 0, 0)), caps: true }), 75), ST);
    bin.add('wood', tone(spar(bs0, bs1, 0.21, 0.1, 8, true), 0xf3e4cc, 0.08), ST);
    const a = V(hw(6.6, 3.0) - 0.2, 3.0, 6.6);
    const b = V(2.15, 3.1, 7.0);
    bin.add('woodDark', tone(beam(a, b, 0.18, 0.18), 0xffffff, 0.05), ST);
    stamp(bin, anchorKit(0.62), b.x - 0.04, b.y - 0.08, b.z, 0.95 + Math.PI / 2, 0, 0, 1, ST);
  }

  // rig
  const FMZ = 3.6;
  const MMZ = -1.4;
  mastSegment(bin, V(0, DECK - 0.2, FMZ), V(0, 11.1, FMZ - 0.25), 0.25, 0.18, 8);
  mastBands(bin, 0, FMZ - 0.1, [4.2, 6.2, 8.2], 0.235);
  topPlatform(bin, V(0, 9.95, FMZ - 0.22), 1.4, 1.1);
  mastSegment(bin, V(0, 9.8, FMZ + 0.1), V(0, 15.2, FMZ - 0.1), 0.15, 0.08, 7);
  yard(bin, V(0, 9.25, FMZ + 0.12), 3.7, 0.13);
  yard(bin, V(0, 13.7, FMZ + 0.2), 2.8, 0.1);
  furledSail(bin, V(0, 9.25, FMZ + 0.12), 3.45, 0.2);
  squareSail(bin, { yTop: 13.58, yBot: 9.6, halfTop: 2.68, halfBot: 3.5, z: FMZ + 0.32, belly: 0.75, patches: [[0.6, 0.4, 0.74, 0.58]] });
  mastSegment(bin, V(0, DECK - 0.2, MMZ), V(0, 12.7, MMZ - 0.3), 0.28, 0.2, 8);
  mastBands(bin, 0, MMZ - 0.1, [4.6, 6.8, 9.0], 0.26);
  crosstrees(bin, 0, 12.1, MMZ - 0.28, 0.75);
  mastSegment(bin, V(0, 11.7, MMZ - 0.05), V(0, 17.0, MMZ - 0.25), 0.15, 0.08, 7);
  yard(bin, V(0, 15.2, MMZ - 0.05), 2.2, 0.08);
  furledSail(bin, V(0, 15.2, MMZ - 0.05), 2.0, 0.14);
  // boom, gaff and gaff mainsail
  bin.add('woodDark', tone(spar(V(0, 3.2, MMZ - 0.3), V(0, 2.95, -9.2), 0.14, 0.09, 7, true), 0xffffff, 0.05), ST);
  bin.add('woodDark', tone(spar(V(0, 10.9, MMZ - 0.35), V(0, 13.1, -7.1), 0.12, 0.07, 7, true), 0xffffff, 0.05), ST);
  gaffSail(bin, V(0.05, 3.32, MMZ - 0.45), V(0.05, 3.08, -8.75), V(0.05, 12.92, -6.9), V(0.05, 10.75, MMZ - 0.5), V(0.55, 0, 0));
  // jib
  const foreTop = V(0, 15.0, FMZ - 0.1);
  triSail(bin, V(0.05, 5.0, 12.45), V(0.3, 3.85, 7.5), new THREE.Vector3().lerpVectors(foreTop, bs1, 0.32).add(V(0.05, -0.1, 0)), V(0.42, 0, 0));
  // flag & pennant
  jollyRoger(bin, V(0.06, 16.95, MMZ - 0.25), 1.7, 1.13);
  pennant(bin, V(0.05, 15.15, FMZ - 0.1), 2.4, 0.3);
  // standing rigging
  const plate = (z: number, side: number): V3 => {
    const y = S(z);
    return V(side * (hw(z, y) + 0.22), y + 0.02, z);
  };
  for (const side of [1, -1]) {
    const fFeet = [-0.9, -0.3, 0.3].map((dz) => plate(FMZ + dz, side));
    shroudFan(bin, fFeet.map((_, k) => V(side * 0.26, 9.6, FMZ - 0.22 + (k - 1) * 0.08)), fFeet, Math.max(...fFeet.map((f) => f.y)) + 0.5, 9.2, 0.5, 0.03);
    const mFeet = [-1.0, -0.4, 0.2].map((dz) => plate(MMZ + dz, side));
    shroudFan(bin, mFeet.map((_, k) => V(side * 0.28, 11.8, MMZ - 0.28 + (k - 1) * 0.08)), mFeet, Math.max(...mFeet.map((f) => f.y)) + 0.5, 11.3, 0.5, 0.03);
    for (const f of [...fFeet, ...mFeet]) deadeye(bin, f, side);
    line(bin, V(side * 0.15, 14.6, FMZ - 0.1), plate(1.6, side), 0.028);
    line(bin, V(side * 0.15, 16.4, MMZ - 0.24), plate(-4.0, side), 0.028);
  }
  line(bin, V(0, 10.9, FMZ - 0.24), V(0, 4.0, 10.0), 0.04);
  line(bin, foreTop, bs1, 0.035);
  line(bin, V(0, 12.5, MMZ - 0.3), V(0, 9.9, FMZ - 0.2), 0.035);
  line(bin, V(0, 16.8, MMZ - 0.25), V(0, 14.9, FMZ - 0.1), 0.028);
  line(bin, V(0, 13.0, -7.0), V(0, 16.6, MMZ - 0.24), 0.022, 0, false);
  line(bin, V(0, 2.95, -9.0), V(0, S(-8) + 0.1, -7.8), 0.022, 0, false);
  for (const s of [-1, 1]) {
    line(bin, V(s * 3.6, 9.25, FMZ + 0.12), V(s * 0.2, 11.0, FMZ - 0.24), 0.02, 0, false);
    line(bin, V(s * 2.7, 13.7, FMZ + 0.2), V(s * 0.15, 15.0, FMZ - 0.1), 0.02, 0, false);
    line(bin, V(s * 3.6, 9.25, FMZ + 0.12), V(s * 0.3, 8.0, MMZ - 0.2), 0.02, 0.1, false);
  }

  // colliders: hull footprint boxes + masts
  const colliders: LocalCollider[] = [];
  const maxHalf = (z0: number, z1: number): number => {
    let m = 0;
    for (let z = z0; z <= z1 + 1e-6; z += 0.25) for (const y of [0, 1.1, 2.0]) m = Math.max(m, hw(Math.min(z, 7.9), y));
    return Math.round((m + 0.02) * 100) / 100;
  };
  for (const [z0, z1] of [
    [-8.2, -4.5],
    [-4.5, 3.5],
    [3.5, 6.2],
    [6.2, 8.4],
  ]) {
    colliders.push({ type: 'box', x: 0, z: (z0 + z1) / 2, halfX: maxHalf(z0, z1), halfZ: (z1 - z0) / 2, yaw: 0, yMin: -1.5, yMax: 3.3, tag: 'ship' });
  }
  colliders.push({ type: 'circle', x: 0, z: FMZ, radius: 0.3, yMin: DECK, yMax: 15, tag: 'mast' });
  colliders.push({ type: 'circle', x: 0, z: MMZ, radius: 0.32, yMin: DECK, yMax: 17, tag: 'mast' });
  return { name: 'sloop', parts: bin.parts(), colliders };
}

// ---------------------------------------------------------------------------
// Rowboat
// ---------------------------------------------------------------------------

const ROWBOAT_HULL: HullParams = {
  zStern: -2.1,
  zBow: 2.1,
  halfBeam: 0.8,
  keelY: -0.24,
  maxBeamY: 0.5,
  tumble: 0,
  sternBeam: 0.64,
  fullFrom: 0.34,
  fullTo: 0.5,
  bowBluff: 0.82,
  keelRiseStern: 0.04,
  keelRiseBow: 0.16,
  nMid: 2.0,
  nStern: 1.7,
  nBow: 1.5,
  bowRake: 0.5,
  sternRake: 0.1,
  sternOverhang: 0.06,
  sheer: (zn) => 0.5 + 0.06 * (zn / 2.1) ** 2 + 0.16 * smoothstep(0.5, 2.1, zn),
};

const ROWBOAT_PAINT: RGB[] = [PAINT_RED, PAINT_OCHRE, [0.5, 0.95, 1.35]];
const FLOOR_Y = 0.06;

/** Open hull (outer + inner planking, gunwale, transom, floorboards) — shared by rowboat & wreck. */
function openHull(
  bin: PartBin,
  hull: Hull,
  zs: number[],
  bands: Array<{ top: (st: Station) => number; segs: number; mat: MaterialName; rgb: RGB; bottom?: boolean }>,
  t: number,
  opts: { keep?: (i: number, r: number, side: 1 | -1) => boolean; seeThrough?: boolean; seed?: number } = {},
): { shell: ShellResult; inner: THREE.BufferGeometry } {
  const seed = opts.seed ?? 0;
  const sto = { seeThrough: opts.seeThrough ?? false };
  const shell = buildShell(hull, { zs, bands, keep: opts.keep });
  bands.forEach((b, k) => {
    const g = b.bottom ? paintBottom(shell.bands[k], seed + k) : paintPlanks(shell.bands[k], b.rgb, seed + k, 0.1);
    bin.add(b.mat, g, sto);
  });
  // inner planking: offset along the surface normal, facing inwards
  const N = shell.grid.length;
  const R = shell.grid[0].length;
  const inner: THREE.Vector3[][] = shell.grid.map((col) =>
    col.map((p) => {
      const n = hull.normalAt(p.z, p.y);
      return p.clone().addScaledVector(n, -t);
    }),
  );
  for (const col of inner) for (const p of col) p.x = Math.max(0, p.x);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1] as const) {
    const base = pos.length / 3;
    for (let i = 0; i < N; i++) {
      for (let r = 0; r < R; r++) {
        const p = inner[i][r];
        pos.push(p.x * side, p.y, p.z);
        uv.push(p.z / TILE.plankU, (p.y + Math.abs(p.x) * 0.6) / TILE.plankV);
      }
    }
    for (let i = 0; i < N - 1; i++) {
      for (let r = 0; r < R - 1; r++) {
        if (opts.keep && !opts.keep(i, r, side)) continue;
        const a = base + i * R + r;
        const b = a + 1;
        const c = base + (i + 1) * R + r + 1;
        const d = base + (i + 1) * R + r;
        if (side === 1) idx.push(a, c, b, a, d, c);
        else idx.push(a, b, c, a, c, d);
      }
    }
  }
  const innerGeo = fromArrays(pos, uv, idx);
  paintPlanks(innerGeo, [1.02, 0.96, 0.9], seed + 9, 0.1);
  const yTop = Math.max(...shell.stations.map((s) => s.S));
  const yBot = Math.min(...shell.stations.map((s) => s.D));
  shade(innerGeo, (_x, y) => 0.6 + 0.4 * smoothstep(yBot, yTop, y));
  bin.add('woodPlanks', innerGeo, sto);
  return { shell, inner: innerGeo };
}

function gunwale(bin: PartBin, hull: Hull, zs: number[], t: number, w: number, h: number, opts = {}): void {
  for (const side of [1, -1] as const) {
    const path: V3[] = [];
    const sides: V3[] = [];
    for (const z of zs) {
      const wv = hull.wOf(z);
      const st = hull.station(wv);
      const p = hull.point(wv, st.S);
      const n = hull.normalAt(p.z, st.S).setY(0).normalize();
      p.addScaledVector(n, -t / 2);
      p.y = st.S + h * 0.3;
      p.x *= side;
      n.x *= side;
      path.push(p);
      sides.push(n);
    }
    if (side < 0) {
      path.reverse();
      sides.reverse();
    }
    bin.add('woodDark', tone(sweep(path, [[-w, -h], [w, -h], [w, h * 0.5], [-w, h * 0.5]], { sides, caps: true }), 0xffffff, 0.06, side), opts);
  }
}

/**
 * ~4.2 m rowboat. variant 0: empty with oars inside; 1: crates & a barrel, oars shipped;
 * 2: beached (origin at sand level), tilted, oars lying beside it.
 * Variants 0 and 1 float: origin on the waterline (keel at y = -0.24).
 */
export function buildRowboat(variant: 0 | 1 | 2): PropDefinition {
  const bin = new PartBin();
  const hull = new Hull(ROWBOAT_HULL);
  const t = 0.04;
  const zs = stationList(-2.1, 2.1, [[-1.2, 0.3], [1.0, 0.45], [2.11, 0.2]]);
  const paint = ROWBOAT_PAINT[variant];
  openHull(
    bin,
    hull,
    zs,
    [
      { top: () => 0.03, segs: 4, mat: 'woodDark', rgb: [1, 1, 1], bottom: true },
      { top: () => 0.17, segs: 1, mat: 'woodPlanks', rgb: paint },
      { top: (st) => st.S, segs: 3, mat: 'woodPlanks', rgb: variant === 2 ? [1.12, 1.08, 1.02] : [1.06, 1.0, 0.94] },
    ],
    t,
    { seed: 80 + variant },
  );
  const S = (z: number): number => hull.station(hull.wOf(z)).S;
  const xin = (z: number, y: number): number => hull.innerPoint(hull.wAt(z, y), y, t + 0.01).x;
  // transom (outer face from the shell, inner face)
  const st0 = hull.station(0);
  const tGrid: THREE.BufferGeometry[] = [];
  {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const ys = [st0.D + 0.02, 0.0, 0.2, st0.S];
    ys.forEach((y, k) => {
      const x = Math.max(0.02, hull.xOf(st0, y) - t);
      const z = hull.zOf(0, y) + t;
      pos.push(-x, y, z, x, y, z);
      uv.push(-x / TILE.plankU, y / TILE.plankV, x / TILE.plankU, y / TILE.plankV);
      if (k > 0) {
        const L0 = (k - 1) * 2;
        idx.push(L0, L0 + 1, L0 + 3, L0, L0 + 3, L0 + 2);
      }
    });
    tGrid.push(fromArrays(pos, uv, idx));
  }
  const shellTransom = buildTransom(buildShell(hull, { zs: [-2.1, -2.0], bands: [{ top: () => 0.03, segs: 3 }, { top: (s) => s.S, segs: 3 }] }));
  bin.add('woodDark', paintBottom(shellTransom[0], 90));
  bin.add('woodPlanks', paintPlanks(shellTransom[1], [0.98, 0.93, 0.88], 91));
  bin.add('woodPlanks', paintPlanks(tGrid[0], [0.9, 0.85, 0.8], 92));
  gunwale(bin, hull, zs, t, 0.055, 0.05);
  // stem post
  {
    const st1 = hull.station(1);
    const stem: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const y = lerp(st1.D, st1.S + 0.06, i / 6);
      stem.push(V(0, y, hull.zOf(1, y)));
    }
    bin.add('woodDark', tone(sweep(stem, [[-0.05, -0.08], [0.05, -0.08], [0.05, 0.05], [-0.05, 0.05]], { sides: stem.map(() => V(-1, 0, 0)), caps: true }), 0xffffff, 0.05));
  }
  // floorboards, thwarts, seats, oarlocks
  {
    // floorboards sit just above the waterline so the sea plane never shows inside the boat
    const FLOOR = 0.035;
    const outline: V3[] = [];
    for (const z of stationList(-2.06, 2.0, [[2.01, 0.3]])) outline.push(hull.innerPoint(hull.wAt(z, FLOOR), FLOOR, t - 0.01));
    const fl = buildDeck(outline, FLOOR, [0, 0.12], [0.75, 0.95]);
    shadeRGB(fl, (_x, _y, _z, o) => {
      o[0] = 1.0;
      o[1] = 0.95;
      o[2] = 0.88;
    });
    bin.add('woodPlanks', fl);
    const seats: THREE.BufferGeometry[] = [];
    for (const [z, y] of [
      [-0.45, 0.34],
      [0.65, 0.34],
    ]) {
      const w = 2 * xin(z, y) - 0.02;
      seats.push(plankBox(w, 0.05, 0.26, 'x').translate(0, y, z));
    }
    const ys = 0.31;
    const zsSeat = -1.55;
    seats.push(plankBox(2 * xin(zsSeat, ys) - 0.02, 0.05, 0.62, 'x').translate(0, ys, zsSeat));
    seats.push(plankBox(2 * xin(1.65, 0.42) - 0.02, 0.05, 0.36, 'x').translate(0, 0.42, 1.62));
    bin.add('woodPlanks', paintPlanks(merge(seats), [1.08, 1.0, 0.92], 93));
    const knees: THREE.BufferGeometry[] = [];
    for (const z of [-0.45, 0.65]) for (const s of [-1, 1]) knees.push(box(0.05, 0.3, 0.05, 'y').translate(s * (xin(z, 0.2) - 0.03), 0.2, z));
    bin.add('woodDark', tone(merge(knees), 0xffffff, 0.05));
    const locks: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const z = 0.1;
      const x = s * (hull.halfWidth(z, S(z)) - 0.02);
      locks.push(box(0.03, 0.1, 0.03, 'y').translate(x, S(z) + 0.08, z - 0.05), box(0.03, 0.1, 0.03, 'y').translate(x, S(z) + 0.08, z + 0.05));
    }
    bin.add('metal', tone(merge(locks), ShipColors.iron, 0));
    // painter rope coil at the bow + ring
    const ring = new THREE.TorusGeometry(0.05, 0.012, 3, 8);
    ring.translate(0, S(2.0) - 0.05, hull.zOf(1, S(2.0) - 0.05) + 0.06);
    bin.add('metal', tone(ring, ShipColors.iron, 0));
  }
  const oar = oarKit(2.9);
  const colliders: LocalCollider[] = [];
  if (variant === 0) {
    // oars resting inside across the thwarts
    stamp(bin, oar, 0.22, 0.4, -1.35, 0.05, -0.04);
    stamp(bin, oar, -0.25, 0.4, -1.3, -0.04, -0.04);
    stamp(bin, coilKit(0.18), 0.05, FLOOR_Y, 1.15, 0.4);
  } else if (variant === 1) {
    // cargo + oars shipped in the oarlocks
    stamp(bin, crateKit(0.62, 0.5, 0.55, 94), -0.12, FLOOR_Y, 0.1, 0.12);
    stamp(bin, crateKit(0.5, 0.42, 0.48, 95), 0.15, FLOOR_Y, -1.0, -0.2);
    stamp(bin, crateKit(0.42, 0.36, 0.4, 96), 0.0, FLOOR_Y + 0.5, 0.12, 0.5);
    stamp(bin, barrelKit(0.22, 0.6, 97), -0.12, FLOOR_Y, 1.15);
    for (const s of [-1, 1]) {
      const x = s * (hull.halfWidth(0.1, S(0.1)) + 0.02);
      stamp(bin, oar, x - s * 0.95, S(0.1) + 0.12, 0.1, s * 1.3, 0.12, 0);
    }
  }
  let def: PropDefinition = { name: `rowboat-${variant}`, parts: bin.parts(), colliders };
  if (variant === 2) {
    // beached: roll & pitch, rest the keel on the sand, oars lying beside
    const m = new THREE.Matrix4().makeRotationZ(-0.21).premultiply(new THREE.Matrix4().makeRotationX(0.05));
    let minY = Infinity;
    for (const p of def.parts) {
      p.geometry.applyMatrix4(m);
      p.geometry.computeBoundingBox();
      minY = Math.min(minY, p.geometry.boundingBox!.min.y);
    }
    for (const p of def.parts) p.geometry.translate(0, -minY - 0.07, 0);
    const extra = new PartBin();
    stamp(extra, oar, 1.3, 0.03, -1.3, 0.1, 0, 0.0);
    stamp(extra, oar, 1.62, 0.05, -1.0, -0.06, 0, 0.1);
    stamp(extra, coilKit(0.2), -1.15, 0, 1.45, 0.3);
    for (const p of def.parts) bakeSandAO(p.geometry);
    def = { ...def, parts: [...def.parts, ...extra.parts()] };
    colliders.push({ type: 'box', x: 0.1, z: 0, halfX: 0.75, halfZ: 2.05, yaw: 0, yMin: 0, yMax: 0.85, tag: 'boat' });
  } else {
    colliders.push({ type: 'box', x: 0, z: 0, halfX: 0.78, halfZ: 2.1, yaw: 0, yMin: -0.3, yMax: 0.65, tag: 'boat' });
  }
  return def;
}

/** Darkens vertices near y = 0 (sand contact) after a geometry has been placed. */
function bakeSandAO(g: THREE.BufferGeometry): void {
  shade(g, (_x, y) => 0.62 + 0.38 * smoothstep(-0.05, 0.45, y));
}


// ---------------------------------------------------------------------------
// Shipwreck
// ---------------------------------------------------------------------------

const wRise = (zn: number): number => 0.28 * (zn / 5) ** 2;

const WRECK_HULL: HullParams = {
  zStern: -5,
  zBow: 5,
  halfBeam: 1.95,
  keelY: -1.15,
  maxBeamY: 0.55,
  tumble: 0.05,
  sternBeam: 0.8,
  fullFrom: 0.3,
  fullTo: 0.52,
  bowBluff: 0.62,
  keelRiseStern: 0.08,
  keelRiseBow: 0.35,
  nMid: 2.3,
  nStern: 1.6,
  nBow: 1.7,
  bowRake: 1.25,
  sternRake: 0.3,
  sternOverhang: 0.12,
  sheer: (zn) => 1.5 + wRise(zn) + 0.3 * smoothstep(3.0, 5.0, zn),
};

/**
 * Broken, half-buried hull on a beach (~10 m incl. the bowsprit stub). Origin at sand level
 * (y = 0); the hull is rolled ~17 degrees onto its starboard side, bow slightly raised, the stern
 * broken off. Colliders follow the footprint.
 */
export function buildShipwreck(): PropDefinition {
  const bin = new PartBin();
  const hull = new Hull(WRECK_HULL);
  const t = 0.07;
  const Z0 = -3.3;
  const noise = new Noise2D(913);
  const rng = new Rng(4242);
  const zs = stationList(Z0, 5, [[3, 0.45], [5.01, 0.3]]);
  const cut = new Map<string, number>();
  const cutAt = (r: number, side: number): number => {
    const k = `${r}|${side}`;
    if (!cut.has(k)) cut.set(k, rng.int(0, 3));
    return cut.get(k)!;
  };
  const keep = (i: number, r: number, side: 1 | -1): boolean => {
    if (i < cutAt(r, side)) return false;
    const n = noise.noise(i * 0.29 + 3.1, r * 0.5);
    if (side < 0 && r >= 7 && n > 0.22) return false;
    if (side < 0 && r >= 5 && r < 7 && n > 0.5) return false;
    if (side > 0 && r >= 9 && noise.noise(i * 0.4 - 7.3, r * 0.6) > 0.42) return false;
    return true;
  };
  const weathered: RGB = [0.9, 0.88, 0.86];
  openHull(
    bin,
    hull,
    zs,
    [
      { top: () => 0.0, segs: 4, mat: 'woodDark', rgb: [1, 1, 1], bottom: true },
      { top: (st) => st.S, segs: 6, mat: 'woodPlanks', rgb: weathered },
    ],
    t,
    { keep, seed: 120 },
  );
  // ribs (frames), some standing proud of the broken planking
  const ribs: THREE.BufferGeometry[] = [];
  for (let z = Z0 + 0.25; z < 4.4; z += 0.62) {
    const w = hull.wOf(z);
    const st = hull.station(w);
    for (const side of [1, -1] as const) {
      const ext = side < 0 ? rng.range(0.15, 0.85) : rng.range(-0.1, 0.3);
      const path: V3[] = [];
      const sTop = hull.sigmaOf(st, st.S + ext);
      for (let k = 0; k <= 9; k++) {
        const s = (sTop * k) / 9;
        const y = hull.yOfSigma(st, s);
        const p = V(hull.xOfSigma(st, s), y, hull.zOf(w, y));
        const n = hull.normalAt(p.z, Math.min(y, st.S));
        p.addScaledVector(n, -(t + 0.06));
        p.x = Math.max(0.02, p.x) * side;
        path.push(p);
      }
      ribs.push(sweep(path, [[-0.065, -0.06], [0.065, -0.06], [0.065, 0.06], [-0.065, 0.06]], { sides: path.map(() => V(0, 0, 1)), caps: true }));
    }
  }
  bin.add('woodPale', paintPlanks(merge(ribs), [0.92, 0.9, 0.88], 121, 0.14));
  // keelson, deck beams, stem, mast stump, bowsprit stub
  const dark: THREE.BufferGeometry[] = [];
  dark.push(beam(V(0, hull.station(0.3).D + 0.12, Z0 + 0.1), V(0, hull.station(0.9).D + 0.12, 4.4), 0.22, 0.2));
  const pale: THREE.BufferGeometry[] = [];
  for (const [z, x0, x1] of [
    [-2.1, -1, 1],
    [0.9, -1, 1],
    [2.9, -1, -0.15],
  ]) {
    const y = hull.station(hull.wOf(z)).S - 0.14;
    const xi = hull.innerPoint(hull.wAt(z, y), y, t).x;
    pale.push(beam(V(x0 * xi, y, z), V(x1 * xi, y + (x1 < 0 ? 0.05 : 0), z), 0.2, 0.18));
  }
  {
    const st1 = hull.station(1);
    const stem: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = lerp(st1.D, st1.S + 0.3, i / 8);
      stem.push(V(0, y, hull.zOf(1, y)));
    }
    dark.push(sweep(stem, [[-0.12, -0.2], [0.12, -0.2], [0.12, 0.12], [-0.12, 0.12]], { sides: stem.map(() => V(-1, 0, 0)), caps: true }));
    const bsA = V(0, st1.S + 0.05, 4.4);
    const bsB = V(0, st1.S + 0.75, 6.3);
    pale.push(spar(bsA, bsB, 0.17, 0.14, 7, true));
  }
  // mast stump with splintered top
  const mz = 0.7;
  const mastTop = hull.station(hull.wOf(mz)).S + 1.55;
  pale.push(spar(V(0, -0.6, mz), V(0, mastTop, mz), 0.21, 0.19, 9, false));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const h = rng.range(0.25, 0.7);
    const b0 = V(Math.cos(a) * 0.12, mastTop - 0.05, mz + Math.sin(a) * 0.12);
    const b1 = V(Math.cos(a) * rng.range(0.03, 0.12), mastTop + h, mz + Math.sin(a) * rng.range(0.03, 0.12));
    pale.push(beam(b0, b1, rng.range(0.05, 0.09), 0.05, V(Math.cos(a), 0, Math.sin(a))));
  }
  const band = new THREE.CylinderGeometry(0.215, 0.215, 0.1, 9, 1, true).translate(0, mastTop - 0.5, mz);
  bin.add('metal', tone(band, 0x5a4e44, 0.1));
  // splintered plank ends at the broken stern
  for (let k = 0; k < 7; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const y = rng.range(0.0, 1.4);
    const st = hull.station(hull.wOf(Z0 + 0.2));
    const x = side * hull.xOf(st, y);
    const len = rng.range(0.5, 1.2);
    pale.push(plankBeam(V(x, y, Z0 + 0.3), V(x + side * rng.range(-0.1, 0.25), y + rng.range(-0.25, 0.3), Z0 + 0.3 - len), 0.24, 0.05, V(side, 0.3, 0)));
  }
  bin.add('woodDark', tone(merge(dark), 0xe8e0d6, 0.1));
  bin.add('woodPale', paintPlanks(merge(pale), [0.9, 0.88, 0.86], 122, 0.12));

  // ----- place the wreck: roll onto starboard, bow up, sink into the sand
  const M = new THREE.Matrix4().makeRotationZ(-0.3);
  M.premultiply(new THREE.Matrix4().makeRotationX(-0.07));
  M.premultiply(new THREE.Matrix4().makeTranslation(0.15, 0.02, 0));
  const parts = bin.parts();
  for (const p of parts) {
    p.geometry.applyMatrix4(M);
    // wet sand line + algae
    shadeRGB(p.geometry, (_x, y, _z, o) => {
      const k = 1 - smoothstep(-0.1, 0.55, y);
      o[0] = 1 - 0.38 * k;
      o[1] = 1 - 0.22 * k;
      o[2] = 1 - 0.4 * k;
    });
  }
  const toWorld = (p: V3): V3 => p.clone().applyMatrix4(M);
  let bin2Sand: THREE.BufferGeometry | null = null;

  // ----- sand: fills the hull and banks up against it (world space)
  {
    // footprint of the hull at sand level: x-range of hull points below y = 0.3, per z row
    const rows = 34;
    const zMin = -4.9;
    const zMax = 6.0;
    const foot: Array<[number, number] | null> = [];
    for (let j = 0; j <= rows; j++) {
      const z = lerp(zMin, zMax, j / rows);
      if (z < Z0 - 0.05 || z > 5.0) {
        foot.push(null);
        continue;
      }
      const w = hull.wAt(z, 0.4);
      const st = hull.station(w);
      let a = Infinity;
      let b = -Infinity;
      for (let k = 0; k <= 16; k++) {
        const y = lerp(st.D, st.S, k / 16);
        for (const side of [-1, 1]) {
          const q = toWorld(V(side * hull.xOf(st, y), y, z));
          if (q.y > 0.3) continue;
          a = Math.min(a, q.x);
          b = Math.max(b, q.x);
        }
      }
      foot.push(Number.isFinite(a) ? [a, b] : null);
    }
    const footAt = (z: number): [number, number] | null => foot[Math.round(((z - zMin) / (zMax - zMin)) * rows)] ?? null;
    const sandH = (x: number, z: number): number => {
      const n = noise.noise(x * 0.9 + 11.7, z * 0.9 - 4.2) * 0.06 + noise.noise(x * 2.3, z * 2.3) * 0.02;
      // distance outside the footprint (0 inside), searching neighbouring rows for the ends
      let d = Infinity;
      let inside = -1;
      for (let dz = -1.4; dz <= 1.41; dz += 0.2) {
        const f = footAt(z + dz);
        if (!f) continue;
        const dx = x < f[0] ? f[0] - x : x > f[1] ? x - f[1] : 0;
        const dd = Math.hypot(dx, dz);
        if (dd < d) d = dd;
        if (Math.abs(dz) < 0.11 && dx === 0) inside = (x - (f[0] + f[1]) / 2) / Math.max(0.5, (f[1] - f[0]) / 2);
      }
      const level = 0.16 + 0.14 * Math.max(-1, Math.min(1, inside)) + n;
      if (inside > -1 || d === 0) return level;
      const reach = z < Z0 + 0.3 ? 1.3 : 0.55;
      return lerp(0.2 + n, -0.07, smoothstep(0, reach, d));
    };
    const g = grid(26, 34, (u, v, out) => {
      const x = lerp(-3.4, 4.2, u);
      const z = lerp(-4.9, 6.0, v);
      out.set(x, sandH(x, z), z);
    }, (u, v) => [u * 3, v * 3]);
    // grid faces +u x +v = +x x +z = -y: flip to face up
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    g.computeVertexNormals();
    tone(g, 0xe3ce99, 0.06, 7, 0.8);
    shadeRGB(g, (_x, y, _z, o) => {
      const k = 1 - 0.12 * (1 - smoothstep(-0.05, 0.12, y));
      o[0] = k;
      o[1] = k * 0.99;
      o[2] = k * 0.96;
    });
    bin2Sand = g;
  }

  // ----- debris on the sand (already in world space)
  const deb = new PartBin();
  deb.add('vertexColor', bin2Sand!, { castShadow: false });
  const loose: THREE.BufferGeometry[] = [];
  const planks: Array<[number, number, number, number]> = [
    [-2.7, -1.6, 0.4, 2.1],
    [-3.3, 0.2, -0.25, 1.6],
    [2.9, -3.9, 1.1, 2.4],
    [-1.6, -4.6, 0.9, 1.8],
    [3.4, 3.6, -0.6, 1.5],
    [0.6, -5.4, 1.5, 2.0],
  ];
  for (const [x, z, yaw, len] of planks) {
    const g = plankBox(0.26, 0.05, len, 'z');
    g.rotateX(rng.range(-0.06, 0.06));
    g.rotateZ(rng.range(-0.08, 0.08));
    g.rotateY(yaw);
    g.translate(x, 0.02, z);
    loose.push(g);
  }
  deb.add('woodPlanks', paintPlanks(merge(loose), [0.95, 0.9, 0.84], 123, 0.14));
  stamp(deb, barrelKit(0.3, 0.82, 124), 2.75, -0.32, -2.3, 0.4, 0.22, 0.18);
  stamp(deb, barrelLyingKit(0.3, 0.82, 125), -2.9, -0.05, 2.0, 0.9);
  stamp(deb, crateKit(0.8, 0.72, 0.8, 126), 2.75, -0.22, 2.1, 0.6, 0.12, -0.2);
  // torn sail scrap draped over the port gunwale
  {
    const zA = -0.6;
    const zB = 1.5;
    const tear = [0.82, 0.95, 0.7, 1.0, 0.78, 0.9, 0.74];
    const g = grid(6, 6, (u, v, out) => {
      const z = lerp(zA, zB, u);
      const w = hull.wAt(z, 1.2);
      const st = hull.station(w);
      const vm = Math.min(v, tear[Math.round(u * 6)]);
      let p: V3;
      if (vm < 0.25) {
        const y = st.S - 0.45 * (1 - vm / 0.25);
        p = hull.innerPoint(w, y, t + 0.03);
        p.y = y;
      } else {
        const y = st.S + 0.05 - (vm - 0.25) * 1.9;
        const q = hull.point(w, y);
        const n = hull.normalAt(q.z, y);
        p = q.addScaledVector(n, 0.04 + 0.05 * Math.sin(u * 9));
        if (vm < 0.32) p.y += 0.06;
      }
      p.x = -p.x;
      out.copy(toWorld(p));
    }, (u, v) => [u * 0.14, 1 - v]);
    tone(g, 0xe8dcc2, 0.08);
    shade(g, (_x, y) => 0.72 + 0.28 * smoothstep(0, 0.8, y));
    deb.add('sail', g);
  }
  // rope from the mast stump down to the sand
  {
    const a = toWorld(V(0.1, mastTop - 0.4, mz + 0.1));
    const b = V(-2.4, 0.03, 0.4);
    deb.add('rope', tone(tube(bezier(a, V((a.x + b.x) / 2, a.y * 0.35, (a.z + b.z) / 2 + 0.6), b, 8), () => 0.045, 4), 0xd8c8a8, 0.1));
  }
  const allParts = [...parts, ...deb.parts()];

  // ----- colliders following the footprint
  const colliders: LocalCollider[] = [];
  const segs: Array<[number, number]> = [
    [Z0 - 0.2, -0.5],
    [-0.5, 2.4],
    [2.4, 4.2],
    [4.2, 5.4],
  ];
  for (const [z0, z1] of segs) {
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    for (let z = z0; z <= z1 + 1e-6; z += 0.2) {
      const zz = Math.min(Math.max(z, Z0), 5);
      const w = hull.wAt(zz, 0.6);
      const st = hull.station(w);
      for (let y = st.D; y <= st.S + 1e-6; y += 0.2) {
        for (const side of [-1, 1]) {
          const p = toWorld(V(side * hull.xOf(st, y), y, hull.zOf(w, y)));
          if (p.y < -0.05) continue;
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    if (!Number.isFinite(minX)) continue;
    colliders.push({
      type: 'box',
      x: Math.round(((minX + maxX) / 2) * 100) / 100,
      z: (z0 + z1) / 2,
      halfX: Math.max(0.3, Math.round(((maxX - minX) / 2 - 0.08) * 100) / 100),
      halfZ: (z1 - z0) / 2,
      yaw: 0,
      yMin: -0.5,
      yMax: Math.round((maxY + 0.1) * 100) / 100,
      tag: 'wreck',
    });
  }
  const mastW = toWorld(V(0, 1.2, mz));
  colliders.push({ type: 'circle', x: mastW.x, z: mastW.z, radius: 0.32, yMin: 0, yMax: 3.4, tag: 'wreck' });
  colliders.push({ type: 'circle', x: 2.75, z: -2.3, radius: 0.34, yMin: 0, yMax: 0.6, tag: 'barrel' });
  colliders.push({ type: 'box', x: -2.9 + 0.41 * Math.cos(0.9), z: 2.0 - 0.41 * Math.sin(0.9), halfX: 0.44, halfZ: 0.32, yaw: 0.9, yMin: 0, yMax: 0.6, tag: 'barrel' });
  colliders.push({ type: 'box', x: 2.75, z: 2.1, halfX: 0.42, halfZ: 0.42, yaw: 0.6, yMin: 0, yMax: 0.55, tag: 'crate' });
  return { name: 'shipwreck', parts: allParts, colliders };
}
