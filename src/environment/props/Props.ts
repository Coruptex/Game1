import * as THREE from 'three';
import { bakeGroundAO, displace, flatShaded, jitterColors, paint, rockGeometry, trs } from '../../assets/geometry/GeometryUtils';
import { Palette } from '../../assets/materials/MaterialLibrary';
import { Rng } from '../../utils/random';
import type { LocalCollider, LocalPlatform, PropDefinition, PropPart } from '../PropTypes';
import { plankDeck } from './Docks';
import {
  PartSet,
  V3,
  beamBetween,
  box,
  chamferBox,
  extrudeShape,
  flipFaces,
  grainUV,
  gridSurface,
  jitterCorners,
  kitNoise,
  lathe,
  lin,
  mix,
  plankUV,
  post,
  projectUV,
  ribbon,
  rodBetween,
  ropeAlong,
  ropeWrap,
  seedOf,
  setUvX,
  shade,
  smooth01,
  tone,
  torus,
  woodTint,
  xf,
  type Geo,
} from './PropKit';

/**
 * Procedural pirate props (crates, barrels, cannon, treasure, camp & harbour dressing).
 *
 * Every builder returns a PropDefinition in prop-local space: metres, +Y up, ground contact at
 * y = 0, front facing +Z (unless noted). Materials are MaterialLibrary names; textured woods
 * keep near-white vertex colours, untextured materials (metal, gold, brass, cloth, vertexColor)
 * carry Palette colours. Tall pieces that can hide the player are flagged `seeThrough`.
 */

const TAU = Math.PI * 2;
const ST = { seeThrough: true } as const;

/** TRS matrix (Euler YXZ like GeometryUtils.trs): yaw first in the argument list. */
function M(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1): THREE.Matrix4 {
  return trs(x, y, z, rx, ry, rz, s, s, s);
}

function ironColor(rng: Rng, rust = 0.3): THREE.Color {
  return mix(Palette.iron, 0x6b4630, rng.range(0, rust)).multiplyScalar(rng.range(1.25, 1.5));
}

/** Small indexed mesh from explicit triangles, painted with one colour. */
function polyGeo(points: THREE.Vector3[], faces: number[], color: THREE.ColorRepresentation): Geo {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setIndex(faces);
  g.computeVertexNormals();
  return paint(g, color);
}

/** Orients a geometry built around +Y so that +Y points along `dir`, then moves it to `at`. */
function alignY(g: Geo, at: THREE.Vector3, dir: THREE.Vector3, spin = 0): Geo {
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), spin));
  g.applyMatrix4(new THREE.Matrix4().compose(at, q, V3(1, 1, 1)));
  return g;
}

function coinGeo(rng: Rng, r = 0.046): Geo {
  const g = new THREE.CylinderGeometry(r, r, 0.012, 7);
  return paint(g, tone(Palette.gold, rng.range(0.9, 1.15)));
}

const GEM_COLORS = [0xd81e3a, 0x1fa866, 0x2f6fe0, 0x9b45d8, 0xe0362b];

function gemGeo(rng: Rng, r: number): Geo {
  const g = new THREE.OctahedronGeometry(r, 0);
  g.scale(1, 1.25, 1);
  return paint(g, rng.pick(GEM_COLORS));
}

// ---------------------------------------------------------------------------
// Crates
// ---------------------------------------------------------------------------

export type CrateVariant = 0 | 1 | 2;

function crateParts(w: number, h: number, d: number, style: 0 | 1, rng: Rng): PropPart[] {
  const ps = new PartSet();
  const inset = 0.035;
  const body = new THREE.BoxGeometry(w - inset * 2, h - inset * 2, d - inset * 2);
  const plankH = h / Math.max(3, Math.round(h / 0.22));
  projectUV(body, { grain: 'x', along: 1.9, across: plankH * 8, grainOnU: true, u0: rng.next(), v0: rng.int(0, 7) / 8 });
  jitterCorners(body, 0.006, rng);
  paint(body, woodTint(rng, 0.92, 1.08));
  jitterColors(body, 0.1, 2.2, rng.range(0, 60));
  xf(body, 0, h / 2, 0);
  bakeGroundAO(body, h * 0.6, 0.35, 0);
  ps.add('woodPlanks', body);
  const bt = 0.085;
  const frame = () => woodTint(rng, 0.55, 0.68);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ps.add('wood', box(bt, h, bt, sx * (w / 2 - bt / 2 + 0.006), h / 2, sz * (d / 2 - bt / 2 + 0.006), { uv: grainUV('y', rng), jitter: 0.006, rng, color: frame() }));
    }
  }
  const rimYs = style === 0 ? [bt / 2, h - bt / 2] : [h - bt / 2];
  for (const y of rimYs) {
    for (const sz of [-1, 1]) ps.add('wood', box(w - bt * 2 + 0.01, bt, 0.05, 0, y, sz * (d / 2 - 0.019), { uv: grainUV('x', rng), jitter: 0.005, rng, color: frame() }));
    for (const sx of [-1, 1]) ps.add('wood', box(0.05, bt, d - bt * 2 + 0.01, sx * (w / 2 - 0.019), y, 0, { uv: grainUV('z', rng), jitter: 0.005, rng, color: frame() }));
  }
  if (style === 0) {
    for (const sz of [-1, 1]) {
      const z = sz * (d / 2 - 0.012);
      const f = rng.chance(0.5) ? -1 : 1;
      ps.add('wood', beamBetween(V3(f * (-w / 2 + bt), bt * 0.9, z), V3(f * (w / 2 - bt), h - bt * 0.9, z), 0.035, bt * 0.8, { rng, jitter: 0.004, color: frame() }));
    }
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.012);
      const f = rng.chance(0.5) ? -1 : 1;
      ps.add('wood', beamBetween(V3(x, bt * 0.9, f * (-d / 2 + bt)), V3(x, h - bt * 0.9, f * (d / 2 - bt)), 0.035, bt * 0.8, { rng, jitter: 0.004, color: frame() }));
    }
  } else {
    for (const fx of [-0.3, 0.3]) {
      const c = ironColor(rng);
      ps.add('metal', box(0.07, 0.016, d + 0.03, fx * w, h + 0.004, 0, { color: c }));
      for (const sz of [-1, 1]) ps.add('metal', box(0.07, h - 0.01, 0.016, fx * w, h / 2, sz * (d / 2 + 0.008), { color: c }));
    }
    for (const sx of [-1, 1]) {
      const g = torus(0.1, 0.022, 4, 6, Math.PI);
      paint(g, lin(rng.range(0.85, 1)));
      ps.add('rope', xf(g, sx * (w / 2 + 0.03), h * 0.66, 0, 0, Math.PI / 2, Math.PI));
    }
  }
  return ps.build();
}

/** Wooden crate. 0: braced cube (0.9 m), 1: long cargo crate with iron straps, 2: stack of three. */
export function crate(variant: CrateVariant = 0, seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 101 + variant));
  if (variant === 2) {
    const ps = new PartSet();
    ps.addParts(crateParts(0.95, 0.95, 0.95, 0, rng), M(-0.5, 0, 0, 0.06));
    ps.addParts(crateParts(0.82, 0.8, 0.82, 0, rng), M(0.46, 0, 0.12, -0.2));
    ps.addParts(crateParts(1.1, 0.6, 0.66, 1, rng), M(-0.44, 0.95, -0.03, 0.34));
    return {
      name: 'crate-stack',
      parts: ps.build(),
      colliders: [
        { type: 'box', x: -0.5, z: 0, halfX: 0.46, halfZ: 0.46, yaw: 0.06, yMin: 0, yMax: 1.55 },
        { type: 'box', x: 0.46, z: 0.12, halfX: 0.39, halfZ: 0.39, yaw: -0.2, yMin: 0, yMax: 0.8 },
      ],
    };
  }
  const [w, h, d] = variant === 0 ? [0.9, 0.9, 0.9] : [1.25, 0.72, 0.78];
  return {
    name: `crate-${variant}`,
    parts: crateParts(w, h, d, variant === 0 ? 0 : 1, rng),
    colliders: [{ type: 'box', x: 0, z: 0, halfX: w / 2 - 0.02, halfZ: d / 2 - 0.02, yaw: 0, yMin: 0, yMax: h }],
  };
}

// ---------------------------------------------------------------------------
// Barrels
// ---------------------------------------------------------------------------

export type BarrelVariant = 'upright' | 'lying' | 'rum';

interface BarrelOpts {
  h?: number;
  rEnd?: number;
  rMid?: number;
  /** Must be a multiple of 4 (lid / chime vertices line up). */
  staves?: number;
  rum?: boolean;
  bottom?: boolean;
  ao?: boolean;
}

/** Upright barrel (y = 0 .. h) built from individual staves with darker seams, iron hoops and a lid. */
function barrelParts(rng: Rng, o: BarrelOpts = {}): PropPart[] {
  const h = o.h ?? 1.0;
  const rEnd = o.rEnd ?? 0.32;
  const rMid = o.rMid ?? 0.39;
  const N = o.staves ?? 12;
  const ps = new PartSet();
  const radiusAt = (t: number) => rEnd + (rMid - rEnd) * Math.sin(Math.PI * t);
  const slopeAt = (t: number) => ((rMid - rEnd) * Math.PI * Math.cos(Math.PI * t)) / h;
  const ts = [0, 0.1, 0.27, 0.5, 0.73, 0.9, 1];
  const P: number[] = [];
  const Nn: number[] = [];
  const U: number[] = [];
  const C: number[] = [];
  const I: number[] = [];
  const col = new THREE.Color();
  const sw = (TAU * rMid) / N;
  const red = lin(1.0, 0.42, 0.36);
  for (let s = 0; s < N; s++) {
    const a0 = (s / N) * TAU;
    const a1 = ((s + 1) / N) * TAU;
    const am = (a0 + a1) / 2;
    const angles = [a0, am, a1];
    const bright = rng.range(0.84, 1.06);
    const u0 = rng.next();
    const v0 = rng.next();
    for (let k = 0; k < ts.length - 1; k++) {
      const base = P.length / 3;
      const painted = !!o.rum && ts[k] >= 0.26 && ts[k + 1] <= 0.74;
      for (const t of [ts[k], ts[k + 1]]) {
        const r = radiusAt(t);
        const y = t * h;
        const sl = slopeAt(t);
        const nl = Math.hypot(1, sl);
        for (let c = 0; c < 3; c++) {
          const a = angles[c];
          const rr = c === 1 ? r : r - 0.004;
          P.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
          Nn.push(Math.sin(am) / nl, -sl / nl, Math.cos(am) / nl);
          U.push(u0 + (c / 2) * (sw / 0.8), v0 + y / 1.6);
          const e = c === 1 ? 1 : 0.66;
          col.setRGB(bright * e, bright * e * 0.98, bright * e * 0.94);
          if (painted) col.multiply(red);
          C.push(col.r, col.g, col.b);
        }
      }
      for (let c = 0; c < 2; c++) {
        const a = base + c;
        const b = a + 1;
        const cc = base + 3 + c;
        const d = cc + 1;
        I.push(a, b, d, a, d, cc);
      }
    }
  }
  const staves = new THREE.BufferGeometry();
  staves.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  staves.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  staves.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  staves.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  staves.setIndex(I);
  if (o.ao !== false) bakeGroundAO(staves, 0.35, 0.35, 0);
  ps.add('wood', staves);

  // iron hoops (12-gon rotated half a step so stave centres stay inside)
  const iron = ironColor(rng, 0.35);
  for (const t of [0.09, 0.27, 0.73, 0.91]) {
    const hh = 0.055;
    const g = new THREE.CylinderGeometry(radiusAt(t + hh / (2 * h)) + 0.016, radiusAt(t - hh / (2 * h)) + 0.016, hh, N, 1, true, Math.PI / N);
    paint(g, iron);
    ps.add('metal', xf(g, 0, t * h, 0));
  }

  // recessed lid(s) with chime
  const endCap = (top: boolean) => {
    const rIn = rEnd - 0.022;
    const lid = new THREE.CircleGeometry(rIn, N);
    lid.rotateX(top ? -Math.PI / 2 : Math.PI / 2);
    projectUV(lid, { grain: 'x', along: 1.2, across: 8 * 0.11, grainOnU: true, u0: rng.next(), v0: 0.02 });
    paint(lid, lin(rng.range(0.78, 0.92)));
    ps.add('woodPlanks', xf(lid, 0, top ? h - 0.035 : 0.035, 0, 0, rng.int(0, N - 1) * (TAU / N), 0));
    const inner = new THREE.CylinderGeometry(rIn, rIn, 0.035, N, 1, true);
    flipFaces(inner);
    paint(inner, lin(0.55));
    ps.add('wood', xf(inner, 0, top ? h - 0.0175 : 0.0175, 0));
    const rim = new THREE.RingGeometry(rIn, rEnd + 0.002, N, 1);
    rim.rotateX(top ? -Math.PI / 2 : Math.PI / 2);
    paint(rim, lin(0.85));
    ps.add('wood', xf(rim, 0, top ? h : 0, 0));
  };
  endCap(true);
  if (o.bottom) endCap(false);

  if (o.rum) {
    const rt = radiusAt(0.2);
    const brass = tone(Palette.brass, 1.05);
    const tap = rodBetween(V3(0, h * 0.2, rt - 0.03), V3(0, h * 0.2, rt + 0.09), 0.024, 0.02, 7, { caps: true });
    ps.add('brass', paint(tap, brass));
    ps.add('brass', box(0.03, 0.07, 0.03, 0, h * 0.2 + 0.05, rt + 0.06, { color: tone(Palette.brass, 0.9) }));
    ps.add('brass', paint(rodBetween(V3(0, h * 0.2, rt + 0.085), V3(0, h * 0.2 - 0.06, rt + 0.1), 0.014, 0.012, 6), brass));
    const wax = new THREE.SphereGeometry(0.06, 8, 4, 0, TAU, 0, Math.PI / 2);
    paint(wax, tone(Palette.pirateRed, 0.9));
    ps.add('vertexColor', xf(wax, 0.08, h - 0.035, -0.05, 0, 0, 0, 1, 0.35, 1));
    const mark = tone(0x2a1a10);
    const r = radiusAt(0.5) + 0.003;
    for (let k = -1; k <= 1; k++) {
      const phi = k * 0.28;
      for (const rz of [Math.PI / 4, -Math.PI / 4]) {
        const g = paint(new THREE.PlaneGeometry(0.12, 0.024), mark);
        ps.add('vertexColor', g.applyMatrix4(M(Math.sin(phi) * r, h * 0.5, Math.cos(phi) * r, phi, 0, rz)));
      }
    }
  }
  return ps.build();
}

/** Single barrel: 'upright' (1 m), 'lying' (on its side along X, with chocks), 'rum' (red band, XXX, brass tap facing +Z). */
export function barrel(variant: BarrelVariant = 'upright', seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 211));
  if (variant === 'lying') {
    const ps = new PartSet();
    ps.addParts(barrelParts(rng, { bottom: true, ao: false }), M(0.5, 0.39, 0, 0, 0, Math.PI / 2));
    for (const sx of [-0.27, 0.27]) {
      for (const sz of [-1, 1]) {
        ps.add('wood', box(0.12, 0.09, 0.14, sx, 0.04, sz * 0.3, { uv: grainUV('x', rng), jitter: 0.01, rng, color: woodTint(rng, 0.55, 0.7), rx: sz * 0.45 }));
      }
    }
    const parts = ps.build();
    for (const p of parts) if (p.material === 'wood' || p.material === 'woodPlanks') bakeGroundAO(p.geometry, 0.3, 0.3, 0);
    return { name: 'barrel-lying', parts, colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.5, halfZ: 0.37, yaw: 0, yMin: 0, yMax: 0.78 }] };
  }
  return {
    name: variant === 'rum' ? 'barrel-rum' : 'barrel',
    parts: barrelParts(rng, { rum: variant === 'rum' }),
    colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.37, yMin: 0, yMax: 1.0 }],
  };
}

/** Cluster of barrels: three upright (one rum), a small keg and one lying in front. */
export function barrelGroup(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 307));
  const ps = new PartSet();
  const colliders: LocalCollider[] = [];
  const upright = (x: number, z: number, yaw: number, s: number, rum = false) => {
    ps.addParts(barrelParts(rng, { rum, h: 1.0 * s, rEnd: 0.32 * s, rMid: 0.39 * s }), M(x, 0, z, yaw));
    colliders.push({ type: 'circle', x, z, radius: 0.37 * s, yMin: 0, yMax: s });
  };
  upright(-0.45, -0.3, rng.range(0, TAU), 1);
  upright(0.38, -0.42, 0.35, 1, true);
  upright(-0.02, 0.42, rng.range(0, TAU), 0.84);
  ps.addParts(barrelParts(rng, { h: 0.5, rEnd: 0.17, rMid: 0.205, staves: 8 }), M(-0.72, 0, 0.42, 0.3));
  colliders.push({ type: 'circle', x: -0.72, z: 0.42, radius: 0.2, yMin: 0, yMax: 0.5 });
  ps.addParts(barrelParts(rng, { bottom: true, ao: false }), M(0.82, 0.39, 0.62, -0.55).multiply(M(0.5, 0, 0, 0, 0, Math.PI / 2)));
  colliders.push({ type: 'box', x: 0.82, z: 0.62, halfX: 0.5, halfZ: 0.37, yaw: -0.55, yMin: 0, yMax: 0.78 });
  const parts = ps.build();
  return { name: 'barrel-group', parts, colliders };
}

// ---------------------------------------------------------------------------
// Cannon
// ---------------------------------------------------------------------------

const CANNON_PROFILE: Array<[number, number]> = [
  [0, -0.24],
  [0.05, -0.225],
  [0.055, -0.17],
  [0.03, -0.12],
  [0.12, -0.07],
  [0.19, -0.015],
  [0.2, 0.05],
  [0.18, 0.065],
  [0.175, 0.56],
  [0.193, 0.57],
  [0.193, 0.61],
  [0.165, 0.625],
  [0.155, 0.95],
  [0.172, 0.96],
  [0.172, 0.995],
  [0.148, 1.005],
  [0.127, 1.5],
  [0.142, 1.525],
  [0.13, 1.56],
  [0.162, 1.7],
  [0.162, 1.75],
  [0.082, 1.75],
  [0.072, 1.6],
  [0, 1.6],
];

/** Iron cannon on a wooden naval truck carriage with four wheels. Faces +Z (muzzle at z ~ 1.27). */
export function cannon(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 401));
  const ps = new PartSet();
  const iron = mix(Palette.iron, 0x2a2c30, 0.15);

  const lg = lathe(CANNON_PROFILE, 12);
  paint(lg, iron);
  shade(lg, (x, y, z, out) => {
    if (y > 1.58 && Math.hypot(x, z) < 0.085) out.setRGB(0.12, 0.12, 0.12);
    else out.setScalar(0.9 + 0.2 * (0.5 + 0.5 * kitNoise.noise(x * 7 + 3, y * 4.3)));
  });
  const sT = 0.6;
  const elev = 0.05;
  const mb = new THREE.Matrix4()
    .makeTranslation(0, 0.63, 0.12)
    .multiply(new THREE.Matrix4().makeRotationX(-elev))
    .multiply(new THREE.Matrix4().makeTranslation(0, 0, -sT))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  ps.add('metal', lg.applyMatrix4(mb));
  const tr = post({ radius: 0.05, y0: -0.31, y1: 0.31, radial: 8, cap: 'flat', bottomCap: true });
  ps.add('metal', xf(paint(tr, iron), 0, 0.63, 0.12, 0, 0, Math.PI / 2));

  const cheek: Array<[number, number]> = [
    [-0.62, 0.1],
    [0.46, 0.1],
    [0.46, 0.5],
    [0.34, 0.6],
    [0.05, 0.6],
    [0.05, 0.48],
    [-0.26, 0.48],
    [-0.26, 0.37],
    [-0.62, 0.37],
  ];
  for (const side of [-1, 1]) {
    const g = extrudeShape(cheek, 0.09);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    projectUV(g, grainUV('z', rng, 1.4, 0.7));
    paint(g, woodTint(rng, 0.82, 0.96));
    jitterColors(g, 0.1, 3, rng.range(0, 50));
    ps.add('wood', xf(g, side * 0.245, 0, 0));
    ps.add('metal', box(0.1, 0.03, 0.17, side * 0.245, 0.69, 0.12, { color: iron }));
    const rb = torus(0.04, 0.011, 4, 8);
    paint(rb, iron);
    ps.add('metal', xf(rb, side * 0.3, 0.33, 0.3, 0, Math.PI / 2, 0));
  }
  const dark = () => woodTint(rng, 0.62, 0.74);
  ps.add('wood', box(0.86, 0.13, 0.15, 0, 0.17, 0.3, { uv: grainUV('x', rng), jitter: 0.008, rng, color: dark() }));
  ps.add('wood', box(0.86, 0.13, 0.15, 0, 0.15, -0.46, { uv: grainUV('x', rng), jitter: 0.008, rng, color: dark() }));
  ps.add('wood', box(0.42, 0.05, 0.56, 0, 0.275, -0.33, { uv: grainUV('z', rng), jitter: 0.006, rng, color: dark() }));
  const quoin = extrudeShape(
    [
      [-0.66, 0.3],
      [-0.24, 0.3],
      [-0.24, 0.33],
      [-0.66, 0.47],
    ],
    0.22,
  );
  quoin.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  projectUV(quoin, grainUV('z', rng));
  ps.add('wood', paint(quoin, woodTint(rng, 0.85, 1)));
  ps.add('wood', paint(rodBetween(V3(0, 0.4, -0.66), V3(0, 0.42, -0.77), 0.025, 0.03, 6, { caps: true }), woodTint(rng, 0.7, 0.8)));

  const wheel = (x: number, z: number, r: number) => {
    const g = new THREE.CylinderGeometry(r, r, 0.09, 12);
    projectUV(g, { grain: 'z', along: 0.8, across: 0.8, u0: rng.next(), v0: rng.next() });
    paint(g, woodTint(rng, 0.62, 0.78));
    ps.add('wood', xf(g, x, r, z, 0, 0, Math.PI / 2));
    const tyre = new THREE.CylinderGeometry(r + 0.013, r + 0.013, 0.07, 12, 1, true);
    ps.add('metal', xf(paint(tyre, iron), x, r, z, 0, 0, Math.PI / 2));
    const hub = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 8);
    ps.add('metal', xf(paint(hub, iron), x, r, z, 0, 0, Math.PI / 2));
  };
  for (const side of [-1, 1]) {
    wheel(side * 0.38, 0.3, 0.17);
    wheel(side * 0.38, -0.46, 0.15);
  }
  return {
    name: 'cannon',
    parts: ps.build(),
    colliders: [{ type: 'box', x: 0, z: 0.25, halfX: 0.46, halfZ: 0.98, yaw: 0, yMin: 0, yMax: 0.85 }],
  };
}

/** Square pyramid of 14 iron cannonballs in a low wooden frame. */
export function cannonballPile(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 431));
  const ps = new PartSet();
  const r = 0.1;
  const balls: Geo[] = [];
  const layer = (n: number, y: number) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const g = new THREE.IcosahedronGeometry(r * rng.range(0.97, 1.03), 1);
        paint(g, ironColor(rng, 0.4));
        balls.push(xf(g, (i - (n - 1) / 2) * 2 * r, y, (j - (n - 1) / 2) * 2 * r, rng.range(0, 3), rng.range(0, 3), 0));
      }
    }
  };
  const dy = Math.SQRT2 * r;
  const y0 = r + 0.025;
  layer(3, y0);
  layer(2, y0 + dy);
  layer(1, y0 + 2 * dy);
  ps.add('metal', balls);
  const fw = 6 * r + 0.1;
  ps.add('wood', box(fw - 0.02, 0.03, fw - 0.02, 0, 0.015, 0, { uv: plankUV('x', 0.2, rng), color: woodTint(rng, 0.6, 0.7) }));
  for (const s of [-1, 1]) {
    ps.add('wood', box(fw, 0.09, 0.05, 0, 0.045, s * (3 * r + 0.025), { uv: grainUV('x', rng), jitter: 0.006, rng, color: woodTint(rng, 0.7, 0.85) }));
    ps.add('wood', box(0.05, 0.09, fw - 0.1, s * (3 * r + 0.025), 0.045, 0, { uv: grainUV('z', rng), jitter: 0.006, rng, color: woodTint(rng, 0.7, 0.85) }));
  }
  return { name: 'cannonball-pile', parts: ps.build(), colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.36, halfZ: 0.36, yaw: 0, yMin: 0, yMax: 0.5 }] };
}

// ---------------------------------------------------------------------------
// Weapons (shared by the weapon rack and the treasure heap)
// ---------------------------------------------------------------------------

/** Cutlass in local space: guard at the origin, blade pointing down (-Y), edge toward +X. */
function cutlassInto(ps: PartSet, m: THREE.Matrix4, rng: Rng): void {
  const L = 0.68;
  const spine: Array<[number, number]> = [];
  const edge: Array<[number, number]> = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const xc = 0.07 * t * t;
    spine.push([xc - 0.008, -L * t]);
    edge.push([xc + 0.048 * (1 - 0.25 * t), -L * t * (i === n ? 0.94 : 1)]);
  }
  const outline: Array<[number, number]> = [...spine, [0.08, -L - 0.02], ...edge.reverse()];
  const blade = extrudeShape(outline, 0.008);
  paint(blade, lin(rng.range(0.72, 0.8), 0.8, 0.85));
  ps.add('metal', blade.applyMatrix4(m));
  const brass = tone(Palette.brass, rng.range(1, 1.1));
  const cup = new THREE.SphereGeometry(0.05, 8, 3, 0, TAU, 0, Math.PI / 2);
  paint(cup, brass);
  ps.add('brass', xf(cup, 0.02, 0.0, 0, Math.PI, 0, 0, 1, 0.35, 0.75).applyMatrix4(m));
  const bow = torus(0.065, 0.009, 4, 9, Math.PI);
  paint(bow, brass);
  ps.add('brass', xf(bow, 0.02, 0.065, 0, 0, 0, -Math.PI / 2).applyMatrix4(m));
  ps.add('wood', paint(rodBetween(V3(0.02, 0.0, 0), V3(0.02, 0.125, 0), 0.016, 0.014, 6), lin(0.35, 0.28, 0.24)).applyMatrix4(m));
  const pommel = new THREE.IcosahedronGeometry(0.022, 0);
  paint(pommel, brass);
  ps.add('brass', xf(pommel, 0.02, 0.138, 0).applyMatrix4(m));
}

// ---------------------------------------------------------------------------
// Treasure
// ---------------------------------------------------------------------------

const GOBLET_PROFILE: Array<[number, number]> = [
  [0, 0],
  [0.055, 0],
  [0.055, 0.01],
  [0.015, 0.03],
  [0.012, 0.09],
  [0.02, 0.1],
  [0.05, 0.12],
  [0.06, 0.18],
  [0.053, 0.18],
  [0.045, 0.125],
  [0, 0.115],
];

function gobletGeo(s: number): Geo {
  const g = lathe(GOBLET_PROFILE, 9);
  paint(g, tone(Palette.gold, 1.05));
  return xf(g, 0, 0, 0, 0, 0, 0, s);
}

/** Chunky mound of gold coins with goblets, a crown, gems and a cutlass stuck in the top. */
export function treasureHeap(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 503));
  const ps = new PartSet();
  const rx = 0.95;
  const rz = 0.75;
  const hm = 0.52;
  const s0 = rng.range(0, 50);
  const lumps = (x: number, z: number) =>
    0.05 * kitNoise.noise(x * 3.1 + s0, z * 3.1 - s0) + 0.025 * kitNoise.noise(x * 7.3 - s0, z * 7.3 + 2) + 0.012 * kitNoise.noise(x * 15 + 3, z * 15 - s0);
  const height = (x: number, z: number) => {
    const q = Math.hypot(x / rx, z / rz);
    if (q >= 1) return -0.02;
    return hm * Math.pow(1 - q * q, 0.8) + lumps(x, z) * (1 - q * 0.7);
  };
  const normalAt = (x: number, z: number) => {
    const e = 0.02;
    return V3(-(height(x + e, z) - height(x - e, z)) / (2 * e), 1, -(height(x, z + e) - height(x, z - e)) / (2 * e)).normalize();
  };
  const nr = 9;
  const ns = 24;
  const rows: THREE.Vector3[][] = [];
  for (let k = 0; k <= nr; k++) {
    const q = k / nr;
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= ns; i++) {
      const a = (i / ns) * TAU;
      const f = k === nr ? 1.04 : 1;
      const x = rx * q * Math.cos(a) * f;
      const z = -rz * q * Math.sin(a) * f;
      row.push(V3(x, k === nr ? -0.02 : height(x, z), z));
    }
    rows.push(row);
  }
  // faceted on purpose: every facet catches the sun differently, which reads as a glittering coin pile
  ps.add(
    'gold',
    flatShaded(
      gridSurface(rows, {
        expect: V3(0, 1, 0),
        color: (_i, _j, p, out) => {
          out.copy(tone(Palette.gold, THREE.MathUtils.clamp(0.85 + lumps(p.x, p.z) * 5, 0.65, 1.2)));
        },
      }),
    ),
  );
  const onMound = (g: Geo, x: number, z: number, lift: number, tilt: number) => {
    const n = normalAt(x, z);
    n.x += rng.range(-tilt, tilt);
    n.z += rng.range(-tilt, tilt);
    return alignY(g, V3(x, height(x, z) + lift, z), n, rng.range(0, TAU));
  };
  for (let i = 0; i < 34; i++) {
    const a = rng.range(0, TAU);
    const q = Math.sqrt(rng.next()) * 0.92;
    ps.add('gold', onMound(coinGeo(rng), rx * q * Math.cos(a), rz * q * Math.sin(a), 0.004, 0.8));
  }
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, TAU);
    const q = rng.range(1.0, 1.4);
    const lean = q < 1.12 ? rng.range(0.5, 1.1) : rng.range(-0.35, 0.35);
    ps.add('gold', coinGeo(rng).applyMatrix4(M(rx * q * Math.cos(a), 0.012 + Math.abs(lean) * 0.03, rz * q * Math.sin(a), rng.range(0, TAU), lean, rng.range(-0.3, 0.3))));
  }
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + i * 1.9;
    const hgt = rng.range(0.05, 0.11);
    const g = new THREE.CylinderGeometry(0.048, 0.048, hgt, 7);
    paint(g, tone(Palette.gold, 1.0));
    ps.add('gold', xf(g, rx * 1.12 * Math.cos(a), hgt / 2, rz * 1.12 * Math.sin(a), rng.range(-0.05, 0.05), 0, rng.range(-0.05, 0.05)));
  }
  ps.add('gold', onMound(gobletGeo(1.6), 0.4, 0.12, -0.015, 0.1));
  ps.add('gold', gobletGeo(1.5).applyMatrix4(M(-0.86, 0.09, 0.45, 0.6, 0, Math.PI / 2 - 0.12)));

  // crown
  {
    const cx = -0.18;
    const cz = -0.1;
    const n = normalAt(cx, cz).add(V3(0.25, 0, 0.15)).normalize();
    const cm = new THREE.Matrix4().compose(V3(cx, height(cx, cz) - 0.02, cz), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n), V3(1.25, 1.25, 1.25));
    const band = lathe(
      [
        [0.1, 0],
        [0.12, 0],
        [0.126, 0.075],
        [0.11, 0.075],
        [0.1, 0.005],
      ],
      10,
    );
    ps.add('gold', paint(band, tone(Palette.gold, 1.1)).applyMatrix4(cm));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      const spike = new THREE.ConeGeometry(0.03, 0.08, 4);
      ps.add('gold', xf(paint(spike, tone(Palette.gold, 1.1)), Math.sin(a) * 0.116, 0.11, Math.cos(a) * 0.116).applyMatrix4(cm));
      const ball = new THREE.IcosahedronGeometry(0.018, 0);
      ps.add('gold', xf(paint(ball, tone(Palette.gold, 1.15)), Math.sin(a) * 0.116, 0.155, Math.cos(a) * 0.116).applyMatrix4(cm));
      const gem = new THREE.OctahedronGeometry(0.024, 0);
      paint(gem, k % 2 ? 0xd2283c : 0x2ab070);
      const ga = a + TAU / 10;
      ps.add('vertexColor', xf(gem, Math.sin(ga) * 0.127, 0.038, Math.cos(ga) * 0.127, 0, ga, 0, 1, 1, 0.45).applyMatrix4(cm));
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, TAU);
    const q = rng.range(0.15, 0.9);
    ps.add('vertexColor', onMound(gemGeo(rng, rng.range(0.035, 0.055)), rx * q * Math.cos(a), rz * q * Math.sin(a), 0.02, 0.6));
  }
  // cutlass stuck in the heap
  cutlassInto(ps, new THREE.Matrix4().compose(V3(0.12, height(0.12, 0.18) + 0.42, 0.18), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.6, -0.3)), V3(1.15, 1.15, 1.15)), rng);
  return { name: 'treasure-heap', parts: ps.build(), colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.85, yMin: 0, yMax: 0.55 }] };
}

// ---------------------------------------------------------------------------
// Treasure chest (interactable parts + static decor)
// ---------------------------------------------------------------------------

export interface ChestParts {
  /** Chest body (faces +Z, bottom at y = 0) including the gold inside. */
  base: PropPart[];
  /** Lid authored relative to its hinge: rotate around local X through the origin (negative = open). */
  lid: PropPart[];
  /** Hinge axis position (prop-local): the lid group goes to (0, y, z). */
  lidPivot: { y: number; z: number };
  size: { w: number; d: number; h: number };
}

/**
 * Classic ~1.1 m pirate chest: dark planked wood, iron straps, brass corners and lock plate, gold
 * heaped inside. The lid is a hollow barrel-vault authored with its hinge axis on local X through the
 * origin: place a group at (0, lidPivot.y, lidPivot.z) and set rotation.x = -angle to open (~ -1.75).
 */
export function buildChestParts(seed = 1): ChestParts {
  const rng = new Rng(seedOf(seed, 601));
  const w = 1.1;
  const d = 0.68;
  const hb = 0.5;
  const lidH = 0.27;
  const wall = 0.05;
  const st = 0.045;
  const base = new PartSet();
  const lid = new PartSet();
  const wood = () => woodTint(rng, 0.52, 0.64);
  const iron = () => ironColor(rng, 0.25);
  const brass = () => tone(Palette.brass, rng.range(0.98, 1.1));

  // --- base: planked walls ---
  const by0 = 0.06;
  const nP = 3;
  const ph = (hb - by0) / nP;
  for (let k = 0; k < nP; k++) {
    const yc = by0 + ph * (k + 0.5);
    const hh = ph - 0.012;
    for (const sz of [-1, 1]) {
      base.add('wood', box(w - 0.004, hh, wall, 0, yc, sz * (d / 2 - wall / 2), { uv: grainUV('x', rng, 1.4, 0.7), jitter: 0.004, rng, color: wood() }));
    }
    for (const sx of [-1, 1]) {
      base.add('wood', box(wall, hh, d - wall * 2, sx * (w / 2 - wall / 2), yc, 0, { uv: grainUV('z', rng, 1.4, 0.7), jitter: 0.004, rng, color: wood() }));
    }
  }
  base.add('wood', box(w - 0.1, 0.04, d - 0.1, 0, by0 + 0.02, 0, { uv: grainUV('x', rng), color: lin(0.4) }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      base.add('wood', box(0.13, by0 + 0.01, 0.13, sx * (w / 2 - 0.06), (by0 + 0.01) / 2, sz * (d / 2 - 0.06), { uv: grainUV('y', rng), color: lin(0.42) }));
      base.add('wood', box(0.065, hb - by0 + 0.005, 0.065, sx * (w / 2 - 0.022), (hb + by0) / 2, sz * (d / 2 - 0.022), { uv: grainUV('y', rng), jitter: 0.003, rng, color: lin(0.42) }));
      const bh = hb - by0 - 0.04;
      base.add('brass', box(0.1, bh, 0.012, sx * (w / 2 - 0.04), (hb + by0) / 2, sz * (d / 2 + 0.012), { color: brass() }));
      base.add('brass', box(0.012, bh, 0.1, sx * (w / 2 + 0.012), (hb + by0) / 2, sz * (d / 2 - 0.04), { color: brass() }));
    }
  }
  for (const fx of [-0.28, 0.28]) {
    for (const sz of [-1, 1]) base.add('metal', box(0.07, hb - by0 - 0.02, 0.012, fx, (hb + by0) / 2, sz * (d / 2 + 0.008), { color: iron() }));
  }
  for (const sz of [-1, 1]) base.add('metal', box(w + 0.02, 0.045, 0.014, 0, hb - 0.03, sz * (d / 2 + 0.009), { color: iron() }));
  for (const sx of [-1, 1]) base.add('metal', box(0.014, 0.045, d + 0.02, sx * (w / 2 + 0.009), hb - 0.03, 0, { color: iron() }));
  const lock = chamferBox(0.17, 0.2, 0.025, 0.012);
  base.add('brass', xf(paint(lock, brass()), 0, hb - 0.13, d / 2 + 0.016));
  base.add('vertexColor', box(0.028, 0.06, 0.006, 0, hb - 0.15, d / 2 + 0.03, { color: 0x15100c }));
  for (const sx of [-1, 1]) {
    const g = torus(0.075, 0.014, 4, 8, Math.PI);
    base.add('metal', xf(paint(g, iron()), sx * (w / 2 + 0.03), hb * 0.66, 0, 0, Math.PI / 2, Math.PI));
    base.add('metal', box(0.012, 0.06, 0.2, sx * (w / 2 + 0.014), hb * 0.66 + 0.01, 0, { color: iron() }));
  }

  // --- gold heaped inside (visible when the lid is open) ---
  const ix = w / 2 - wall - 0.004;
  const iz = d / 2 - wall - 0.004;
  const goldY = (x: number, z: number) => hb - 0.07 + 0.15 * (1 - (x / ix) ** 2) * (1 - (z / iz) ** 2) + 0.018 * kitNoise.noise(x * 9 + 4, z * 9);
  const gRows: THREE.Vector3[][] = [];
  for (let j = 0; j <= 5; j++) {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = -ix + (2 * ix * i) / 8;
      const z = -iz + (2 * iz * j) / 5;
      row.push(V3(x, goldY(x, z), z));
    }
    gRows.push(row);
  }
  base.add(
    'gold',
    gridSurface(gRows, {
      expect: V3(0, 1, 0),
      color: (_i, _j, p, out) => {
        out.copy(tone(Palette.gold, THREE.MathUtils.clamp(0.8 + 2.2 * (p.y - (hb - 0.07)), 0.7, 1.15)));
      },
    }),
  );
  for (let i = 0; i < 12; i++) {
    const x = rng.range(-ix * 0.85, ix * 0.85);
    const z = rng.range(-iz * 0.8, iz * 0.8);
    base.add('gold', xf(coinGeo(rng, 0.044), x, goldY(x, z) + 0.006, z, rng.range(-0.5, 0.5), rng.range(0, TAU), rng.range(-0.5, 0.5)));
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.range(-ix * 0.7, ix * 0.7);
    const z = rng.range(-iz * 0.6, iz * 0.6);
    base.add('vertexColor', xf(gemGeo(rng, 0.04), x, goldY(x, z) + 0.02, z, rng.range(0, 1), rng.range(0, 3), 0));
  }
  base.add('gold', gobletGeo(1.25).applyMatrix4(M(ix * 0.55, goldY(ix * 0.55, -iz * 0.2) - 0.06, -iz * 0.2, 0.4, 0.2, -0.35)));

  // --- lid (relative to the hinge at the back top edge) ---
  const R = d / 2;
  const arc = (th: number, off = 0) => V3(0, (lidH + off) * Math.sin(th), d / 2 - (R + off) * Math.cos(th));
  const nS = 5;
  for (let i = 0; i < nS; i++) {
    const p0 = arc((i / nS) * Math.PI);
    const p1 = arc(((i + 1) / nS) * Math.PI);
    const dz = p1.z - p0.z;
    const dy = p1.y - p0.y;
    const ang = Math.atan2(-dy, dz);
    const outN = V3(0, Math.cos(ang), Math.sin(ang));
    const g = new THREE.BoxGeometry(w - 0.1, st, Math.hypot(dz, dy) + 0.012);
    projectUV(g, grainUV('x', rng, 1.4, 0.7));
    jitterCorners(g, 0.003, rng);
    paint(g, wood());
    jitterColors(g, 0.12, 3, rng.range(0, 40));
    const c = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(outN, st / 2);
    lid.add('wood', xf(g, 0, c.y, c.z, ang, 0, 0));
  }
  const capPts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const p = arc((i / 12) * Math.PI, st);
    capPts.push([-p.z, p.y]);
  }
  for (const sx of [-1, 1]) {
    const g = extrudeShape(capPts, 0.05);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    projectUV(g, grainUV('z', rng, 1.4, 0.7));
    paint(g, wood());
    lid.add('wood', xf(g, sx * (w / 2 - 0.025), 0, 0));
  }
  for (const bx of [-0.28, 0.28]) {
    const nB = 8;
    const c = iron();
    for (let i = 0; i < nB; i++) {
      const p0 = arc((i / nB) * Math.PI, st + 0.006);
      const p1 = arc(((i + 1) / nB) * Math.PI, st + 0.006);
      const dz = p1.z - p0.z;
      const dy = p1.y - p0.y;
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      lid.add('metal', box(0.07, 0.014, Math.hypot(dz, dy) + 0.01, bx, mid.y, mid.z, { color: c, rx: Math.atan2(-dy, dz) }));
    }
  }
  lid.add('metal', box(w + 0.015, 0.05, 0.014, 0, 0.028, d + st + 0.004, { color: iron() }));
  lid.add('metal', box(w + 0.015, 0.05, 0.014, 0, 0.028, -st - 0.004, { color: iron() }));
  for (const sx of [-1, 1]) {
    for (const zc of [0.06, d - 0.06]) lid.add('brass', box(0.012, 0.1, 0.11, sx * (w / 2 + 0.006), 0.05, zc, { color: brass() }));
  }
  const hasp = chamferBox(0.085, 0.17, 0.016, 0.01);
  lid.add('brass', xf(paint(hasp, brass()), 0, -0.04, d + st + 0.014));
  const loop = torus(0.022, 0.007, 4, 8);
  lid.add('metal', xf(paint(loop, iron()), 0, -0.11, d + st + 0.026));

  return {
    base: base.build(),
    lid: lid.build(),
    lidPivot: { y: hb, z: -d / 2 },
    size: { w, d: d + 2 * st, h: hb + lidH + st },
  };
}

/** Static decor chest (closed or open with the lid thrown back and coins spilling out). */
export function decorChest(open = false, seed = 1): PropDefinition {
  const cp = buildChestParts(seed);
  const rng = new Rng(seedOf(seed, 651));
  const ps = new PartSet();
  ps.addParts(cp.base);
  const ang = open ? -1.9 : 0;
  ps.addParts(cp.lid, new THREE.Matrix4().makeTranslation(0, cp.lidPivot.y, cp.lidPivot.z).multiply(new THREE.Matrix4().makeRotationX(ang)));
  if (open) {
    for (let i = 0; i < 10; i++) {
      const x = rng.range(-0.45, 0.45);
      const z = cp.size.d / 2 + rng.range(0.05, 0.45);
      ps.add('gold', coinGeo(rng, 0.044).applyMatrix4(M(x, 0.007, z, rng.range(0, TAU), rng.range(-0.2, 0.2), rng.range(-0.2, 0.2))));
    }
    const g = new THREE.CylinderGeometry(0.046, 0.046, 0.08, 7);
    ps.add('gold', xf(paint(g, tone(Palette.gold)), 0.42, 0.04, cp.size.d / 2 + 0.25));
  }
  const collider: LocalCollider = open
    ? { type: 'box', x: 0, z: -0.15, halfX: 0.56, halfZ: 0.52, yaw: 0, yMin: 0, yMax: 0.85 }
    : { type: 'box', x: 0, z: 0, halfX: 0.56, halfZ: 0.37, yaw: 0, yMin: 0, yMax: 0.82 };
  return { name: open ? 'decor-chest-open' : 'decor-chest', parts: ps.build(), colliders: [collider] };
}

// ---------------------------------------------------------------------------
// Camp: tent, campfire
// ---------------------------------------------------------------------------

/** Canvas A-frame tent (ridge along Z, open front facing +Z) with crossed poles, guy ropes and a pennant. */
export function tent(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 701));
  const ps = new PartSet();
  const Lz = 1.5;
  const B = 1.38;
  const Hr = 2.12;
  const nu = 10;
  const nv = 5;
  const zA = -Lz - 0.14;
  const zB = Lz + 0.14;
  const line = (side: number, v: number) => V3(side * (B + 0.1) * v, Hr + 0.07 - (Hr - 0.13) * v, 0);
  const inward = (side: number) => V3(-side * (Hr - 0.13), -(B + 0.1), 0).normalize();
  const canvasAt = (side: number, u: number, v: number) => {
    const z = zA + (zB - zA) * u;
    const p = line(side, v).setZ(z);
    const between = Math.sin(Math.PI * THREE.MathUtils.clamp((z + Lz) / (2 * Lz), 0, 1));
    return p.addScaledVector(inward(side), 0.1 * between * Math.sin(Math.PI * v) + 0.018 * kitNoise.noise(z * 2.7 + side * 5, v * 3.3));
  };
  for (const side of [-1, 1]) {
    const rows: THREE.Vector3[][] = [];
    for (let j = 0; j <= nv; j++) {
      const row: THREE.Vector3[] = [];
      for (let i = 0; i <= nu; i++) {
        const p = canvasAt(side, i / nu, j / nv);
        if (j === nv) p.add(V3(side * rng.range(-0.02, 0.05), rng.range(-0.06, 0.04), 0));
        row.push(p);
      }
      rows.push(row);
    }
    ps.add(
      'cloth',
      gridSurface(rows, {
        expect: V3(side, 1, 0),
        uv: (i, j) => [(j / nv) * 0.3, i / nu],
        color: (_i, j, p, out) => {
          const v = j / nv;
          const stain = 0.5 + 0.5 * kitNoise.noise(p.z * 1.7 + side * 3, p.y * 1.9);
          out.copy(tone(Palette.canvas, 1.02 - 0.24 * v * v - 0.12 * stain));
          if (j === nv) out.multiplyScalar(0.82);
        },
      }),
      ST,
    );
    // patches
    for (let k = 0; k < 2; k++) {
      const u0 = rng.range(0.2, 0.7);
      const v0 = rng.range(0.25, 0.6);
      const prow: THREE.Vector3[][] = [0, 1].map((jj) =>
        [0, 1].map((ii) => canvasAt(side, u0 + ii * 0.11, v0 + jj * 0.16).addScaledVector(inward(side), -0.012)),
      );
      ps.add('cloth', gridSurface(prow, { expect: V3(side, 1, 0), uv: () => [0, 0], color: (_i, _j, _p, out) => out.copy(tone(k ? 0xa8875a : 0x9a5b3c, 1)) }), ST);
    }
  }
  // back wall
  const backZ = -Lz + 0.03;
  const back = polyGeo(
    [V3(-B - 0.05, 0.2, backZ), V3(B + 0.05, 0.2, backZ), V3(0, Hr + 0.05, backZ), V3(0, 0.95, backZ - 0.07)],
    [0, 3, 1, 1, 3, 2, 2, 3, 0],
    tone(Palette.canvas, 0.8),
  );
  ps.add('cloth', back, ST);
  // poles: crossed A-frames under the canvas + ridge pole
  for (const zf of [-Lz, Lz]) {
    for (const side of [-1, 1]) {
      const a = line(side, 1.14).addScaledVector(inward(side), 0.06).setZ(zf);
      const b = line(side, -0.12).addScaledVector(inward(side), 0.06).setZ(zf);
      ps.add('wood', rodBetween(a, b, 0.045, 0.036, 6, { seed: rng.range(0, 99), u0: rng.next(), along: 1.6, across: 0.5 }));
    }
  }
  ps.add('wood', rodBetween(V3(0, Hr - 0.01, -Lz - 0.32), V3(0, Hr - 0.01, Lz + 0.4), 0.048, 0.044, 6, { caps: true, along: 1.6, across: 0.5 }));
  // rolled-back door flaps
  for (const side of [-1, 1]) {
    const a = line(side, 0.97).setZ(zB + 0.02).add(V3(0, 0.04, 0));
    const b = line(side, 0.12).setZ(zB + 0.02);
    const roll = rodBetween(a, b, 0.085, 0.06, 6, { caps: true });
    ps.add('cloth', paint(roll, tone(Palette.canvas, 0.78)));
    for (const t of [0.3, 0.7]) {
      const c = new THREE.Vector3().lerpVectors(a, b, t);
      const tie = torus(0.09, 0.016, 3, 8);
      ps.add('rope', alignY(xf(paint(tie, lin(0.9)), 0, 0, 0, Math.PI / 2, 0, 0), c, new THREE.Vector3().subVectors(b, a)));
    }
  }
  // guy ropes & stakes
  const stake = (p: THREE.Vector3) => {
    const dir = p.clone().setY(0).normalize();
    ps.add('wood', rodBetween(p.clone().add(V3(0, -0.12, 0)), p.clone().add(V3(dir.x * 0.07, 0.2, dir.z * 0.07)), 0.026, 0.02, 5, { caps: true }));
  };
  for (const [zEnd, zSt] of [
    [Lz + 0.38, Lz + 1.3],
    [-Lz - 0.3, -Lz - 1.25],
  ]) {
    const b = V3(0, 0.05, zSt);
    ps.add('rope', paint(rodBetween(V3(0, Hr - 0.01, zEnd), b, 0.012, 0.012, 3), lin(0.92)));
    stake(b);
  }
  for (const side of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const a = canvasAt(side, sz > 0 ? 0.86 : 0.14, 0.55);
      const b = V3(side * (B + 0.95), 0.05, sz * (Lz + 0.25));
      ps.add('rope', paint(rodBetween(a, b, 0.01, 0.01, 3), lin(0.92)));
      stake(b);
    }
  }
  // pennant on the front crossing
  const fz = Lz + 0.02;
  ps.add('wood', rodBetween(V3(0, Hr - 0.15, fz), V3(0, Hr + 0.78, fz), 0.022, 0.017, 5, { caps: true }));
  const pr: THREE.Vector3[][] = [[], []];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    pr[0].push(V3(0.02 + 0.52 * t, Hr + 0.5 + 0.1 * t, fz));
    pr[1].push(V3(0.02 + 0.52 * t, Hr + 0.75 - 0.15 * t, fz));
  }
  ps.add('cloth', gridSurface(pr, { expect: V3(0, 0, 1), uv: (i, j) => [i / 4, j], color: (_i, _j, _p, out) => out.copy(tone(Palette.pirateRed)) }));
  // bedroll inside
  const roll = rodBetween(V3(-0.2, 0.15, -0.75), V3(0.65, 0.15, -0.55), 0.15, 0.15, 8, { caps: true });
  ps.add('cloth', paint(roll, tone(0x8f3a2c)));
  for (const t of [0.25, 0.75]) {
    const c = new THREE.Vector3().lerpVectors(V3(-0.2, 0.15, -0.75), V3(0.65, 0.15, -0.55), t);
    const strap = torus(0.155, 0.014, 3, 10);
    ps.add('rope', alignY(xf(paint(strap, lin(0.8)), 0, 0, 0, Math.PI / 2, 0, 0), c, V3(0.85, 0, 0.2)));
  }
  return { name: 'tent', parts: ps.build(), colliders: [{ type: 'box', x: 0, z: 0, halfX: B, halfZ: Lz + 0.1, yaw: 0, yMin: 0, yMax: Hr }] };
}

/** Fire anchor for gameplay (flame base centre, top of the log stack, flame radius), prop-local. */
export const CAMPFIRE_FIRE = { x: 0, y: 0.1, z: 0, topY: 0.36, radius: 0.32 } as const;

/** Stone ring, ash bed, charred log teepee, a few glowing embers and a cooking spit. NO flame. */
export function campfireBase(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 801));
  const ps = new PartSet();
  const ringR = [0, 0.22, 0.42, 0.58];
  const ringY = [0.05, 0.04, 0.025, 0.004];
  const ringC = [0x1c1917, 0x2f2a26, 0x6e675e, 0x5a4a3a];
  const ash: THREE.Vector3[][] = ringR.map((r, k) => {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * TAU;
      const rr = r * (1 + (k > 0 ? 0.08 * kitNoise.noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + k) : 0));
      row.push(V3(Math.cos(a) * rr, ringY[k], -Math.sin(a) * rr));
    }
    return row;
  });
  ps.add('vertexColor', gridSurface(ash, { expect: V3(0, 1, 0), color: (_i, j, _p, out) => out.copy(tone(ringC[j])) }));
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.1, 0.1);
    const rr = 0.66 + rng.range(-0.03, 0.05);
    const g = rockGeometry(rng, rng.range(0.14, 0.19), 0, 0.8);
    paint(g, tone(Palette.rock, rng.range(0.85, 1.1)));
    xf(g, Math.cos(a) * rr, 0.06, Math.sin(a) * rr, rng.range(-0.3, 0.3), rng.range(0, TAU), rng.range(-0.3, 0.3));
    shade(g, (x, _y, z, out) => {
      out.setScalar(1 - smooth01((0.7 - Math.hypot(x, z)) / 0.18) * 0.6);
    });
    ps.add('rock', g);
  }
  const charred = (g: Geo) =>
    shade(g, (x, _y, z, out) => {
      const t = smooth01((0.36 - Math.hypot(x, z)) / 0.3);
      out.setRGB(1 - 0.86 * t, 1 - 0.88 * t, 1 - 0.89 * t);
    });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4 + rng.range(-0.15, 0.15);
    const foot = V3(Math.cos(a) * 0.44, 0.05, Math.sin(a) * 0.44);
    const tip = V3(Math.cos(a + 0.4) * 0.05, CAMPFIRE_FIRE.topY + rng.range(-0.03, 0.02), Math.sin(a + 0.4) * 0.05);
    const g = rodBetween(foot, tip, 0.06, 0.045, 7, { caps: true, seed: k * 7, jitter: 0.08, u0: rng.next() });
    paint(g, woodTint(rng, 0.75, 0.9));
    ps.add('wood', charred(g));
  }
  for (const [ax, az, bx, bz] of [
    [-0.42, -0.12, 0.4, 0.16],
    [-0.12, 0.42, 0.14, -0.4],
  ]) {
    const g = rodBetween(V3(ax, 0.07, az), V3(bx, 0.08, bz), 0.065, 0.06, 7, { caps: true, jitter: 0.08, u0: rng.next() });
    paint(g, woodTint(rng, 0.7, 0.85));
    ps.add('wood', charred(g));
  }
  for (let k = 0; k < 7; k++) {
    const g = new THREE.IcosahedronGeometry(rng.range(0.025, 0.045), 0);
    ps.add('emberGlow', xf(g, rng.range(-0.18, 0.18), 0.05, rng.range(-0.18, 0.18), rng.range(0, 3), rng.range(0, 3), 0), { castShadow: false });
  }
  // cooking spit
  const colliders: LocalCollider[] = [{ type: 'circle', x: 0, z: 0, radius: 0.6, yMin: 0, yMax: 0.6 }];
  for (const sx of [-1, 1]) {
    const x = sx * 0.86;
    ps.add('wood', paint(rodBetween(V3(x, -0.1, 0), V3(x + sx * 0.02, 0.66, 0), 0.03, 0.025, 5, { caps: true }), woodTint(rng, 0.8, 0.95)));
    ps.add('wood', paint(rodBetween(V3(x + sx * 0.02, 0.6, 0), V3(x + sx * 0.12, 0.8, 0.02), 0.02, 0.016, 5, { caps: true }), woodTint(rng, 0.8, 0.95)));
    ps.add('wood', paint(rodBetween(V3(x + sx * 0.02, 0.62, 0), V3(x - sx * 0.05, 0.79, -0.02), 0.02, 0.016, 5, { caps: true }), woodTint(rng, 0.8, 0.95)));
    colliders.push({ type: 'circle', x, z: 0, radius: 0.07, yMin: 0, yMax: 0.8 });
  }
  ps.add('wood', paint(rodBetween(V3(-1.0, 0.7, 0), V3(1.0, 0.71, 0), 0.02, 0.02, 5, { caps: true }), woodTint(rng, 0.6, 0.7)));
  return { name: 'campfire-base', parts: ps.build(), colliders };
}

// ---------------------------------------------------------------------------
// Lantern
// ---------------------------------------------------------------------------

/** Iron lantern with a glowing core, hanging point at its top (centre `at`). */
function lanternInto(ps: PartSet, at: THREE.Vector3, rng: Rng, s = 1): void {
  const iron = ironColor(rng, 0.2);
  ps.add('metal', box(0.21 * s, 0.03 * s, 0.21 * s, at.x, at.y - 0.15 * s, at.z, { color: iron }));
  ps.add('metal', box(0.17 * s, 0.02 * s, 0.17 * s, at.x, at.y + 0.12 * s, at.z, { color: iron }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) ps.add('metal', box(0.022 * s, 0.27 * s, 0.022 * s, at.x + sx * 0.088 * s, at.y - 0.01 * s, at.z + sz * 0.088 * s, { color: iron }));
  }
  const cap = new THREE.ConeGeometry(0.15 * s, 0.12 * s, 4, 1);
  ps.add('metal', xf(paint(cap, iron), at.x, at.y + 0.19 * s, at.z, 0, Math.PI / 4, 0));
  const ring = torus(0.035 * s, 0.009 * s, 4, 8);
  ps.add('metal', xf(paint(ring, iron), at.x, at.y + 0.28 * s, at.z));
  const candle = new THREE.CylinderGeometry(0.03 * s, 0.032 * s, 0.07 * s, 6);
  ps.add('vertexColor', xf(paint(candle, 0xefe2c0), at.x, at.y - 0.1 * s, at.z));
  const core = new THREE.OctahedronGeometry(0.062 * s, 0);
  ps.add('emberGlow', xf(core, at.x, at.y - 0.01 * s, at.z, 0, 0.4, 0, 1, 1.8, 1), { castShadow: false });
}

/** Light position of `lanternPost()` (prop-local) for gameplay point lights. */
export const LANTERN_POST_LIGHT = { x: 0, y: 1.9, z: 0.55 } as const;

/** Square timber post with a bracket arm (toward +Z) and a hanging lantern (emberGlow core). */
export function lanternPost(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1201));
  const ps = new PartSet();
  const postG = chamferBox(0.15, 2.5, 0.15, 0.025, { jitter: 0.01, rng, uv: grainUV('y', rng, 1.8, 0.6) });
  ps.add('wood', xf(paint(postG, woodTint(rng, 0.75, 0.9)), 0, 1.25 - 0.05, 0, 0, rng.range(-0.1, 0.1), 0));
  const arm = chamferBox(0.1, 0.11, 0.72, 0.02, { uv: grainUV('z', rng, 1.6, 0.6) });
  ps.add('wood', xf(paint(arm, woodTint(rng, 0.75, 0.9)), 0, 2.33, 0.3));
  ps.add('wood', beamBetween(V3(0, 1.92, 0.07), V3(0, 2.3, 0.45), 0.07, 0.08, { rng, color: woodTint(rng, 0.7, 0.85) }));
  for (const sx of [-1, 1]) {
    ps.add('wood', box(0.62, 0.1, 0.12, 0, 0.05, 0, { uv: grainUV('x', rng), jitter: 0.01, rng, color: woodTint(rng, 0.6, 0.75), ry: sx > 0 ? 0 : Math.PI / 2 }));
  }
  const iron = ironColor(rng, 0.2);
  const hook = torus(0.03, 0.008, 4, 8);
  ps.add('metal', xf(paint(hook, iron), 0, 2.24, 0.55, 0, Math.PI / 2, 0));
  const link = torus(0.026, 0.007, 4, 8);
  ps.add('metal', xf(paint(link, iron), 0, 2.19, 0.55));
  lanternInto(ps, V3(LANTERN_POST_LIGHT.x, LANTERN_POST_LIGHT.y, LANTERN_POST_LIGHT.z), rng, 1);
  const parts = ps.build();
  for (const p of parts) if (p.material === 'wood') bakeGroundAO(p.geometry, 0.5, 0.35, 0);
  return { name: 'lantern-post', parts, colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.14, yMin: 0, yMax: 2.4 }] };
}

// ---------------------------------------------------------------------------
// Shack
// ---------------------------------------------------------------------------

/**
 * Pirate hut (~5 x 4 m): board walls on a dark timber frame, shaggy thatch roof (ridge along Z,
 * gable + door facing +Z), shuttered windows, a covered porch with a hanging lantern, a barrel, a
 * crate and a small jolly roger on the ridge. Walls / roof are see-through. One solid collider for
 * the hut, a walkable porch platform (0.28 m) and colliders for the porch posts.
 */
export function shack(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 901));
  const ps = new PartSet();
  const colliders: LocalCollider[] = [];
  const hx = 2.5;
  const hz = 2.0;
  const wallTop = 2.55;
  const ridgeY = 4.25;
  const roofT = 0.24;
  const k = (ridgeY - (wallTop + 0.08 + roofT)) / hx;
  const roofTop = (x: number) => ridgeY - k * Math.abs(x);
  const roofUnder = (x: number) => roofTop(x) - roofT;
  const floorY = 0.28;
  const frameTint = () => woodTint(rng, 0.55, 0.7);

  // --- board walls ---
  type Hole = { a0: number; a1: number; y0: number; y1: number };
  const boards = (axis: 'x' | 'z', fixed: number, from: number, to: number, topAt: (c: number, hw: number) => number, holes: Hole[], out: number) => {
    let c = from;
    while (c < to - 0.03) {
      let bw = rng.range(0.22, 0.3);
      if (to - (c + bw) < 0.14) bw = to - c;
      const centre = c + bw / 2;
      c += bw + 0.012;
      const top = topAt(centre, bw / 2);
      const segs: Array<[number, number]> = [];
      const hole = holes.find((h) => centre > h.a0 && centre < h.a1);
      if (hole) {
        if (hole.y0 > 0.15) segs.push([0.03, hole.y0]);
        if (top - hole.y1 > 0.1) segs.push([hole.y1, top]);
      } else segs.push([0.03, top]);
      for (const [y0, y1] of segs) {
        const g = new THREE.BoxGeometry(axis === 'x' ? bw - 0.012 : 0.05, y1 - y0, axis === 'x' ? 0.05 : bw - 0.012);
        projectUV(g, grainUV('y', rng, 1.8, 0.6));
        jitterCorners(g, 0.008, rng);
        const pale = rng.chance(0.15);
        paint(g, pale ? woodTint(rng, 0.95, 1.05) : woodTint(rng, 0.72, 0.98));
        jitterColors(g, 0.12, 2, rng.range(0, 60));
        const off = out * rng.range(0, 0.014);
        if (axis === 'x') xf(g, centre, (y0 + y1) / 2, fixed + off, rng.range(-0.012, 0.012), 0, rng.range(-0.012, 0.012));
        else xf(g, fixed + off, (y0 + y1) / 2, centre, rng.range(-0.012, 0.012), 0, rng.range(-0.012, 0.012));
        bakeGroundAO(g, 0.7, 0.4, 0);
        ps.add(pale ? 'woodPale' : 'wood', g, ST);
      }
    }
  };
  const gableTop = (c: number, hw: number) => Math.min(roofUnder(c - hw), roofUnder(c + hw)) - 0.02;
  const flatTop = () => wallTop;
  boards('x', hz - 0.025, -hx + 0.08, hx - 0.08, gableTop, [
    { a0: -0.62, a1: 0.62, y0: 0, y1: 2.32 },
    { a0: 1.08, a1: 2.02, y0: 1.08, y1: 1.86 },
  ], 1);
  boards('x', -hz + 0.025, -hx + 0.08, hx - 0.08, gableTop, [], -1);
  boards('z', hx - 0.025, -hz + 0.08, hz - 0.08, flatTop, [{ a0: -0.48, a1: 0.48, y0: 1.1, y1: 1.82 }], 1);
  boards('z', -hx + 0.025, -hz + 0.08, hz - 0.08, flatTop, [], -1);

  // --- frame ---
  const beam = (w: number, h: number, d: number, x: number, y: number, z: number, grain: 'x' | 'y' | 'z') =>
    ps.add('wood', box(w, h, d, x, y, z, { uv: grainUV(grain, rng), jitter: 0.01, rng, color: frameTint() }), ST);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(0.2, wallTop + 0.1, 0.2, sx * (hx - 0.03), (wallTop + 0.1) / 2, sz * (hz - 0.03), 'y');
  for (const sx of [-1, 1]) beam(0.17, 0.16, 2 * hz + 0.3, sx * (hx - 0.02), wallTop + 0.02, 0, 'z');
  for (const sz of [-1, 1]) beam(2 * hx + 0.3, 0.16, 0.16, 0, wallTop + 0.02, sz * (hz - 0.02), 'x');
  for (const sz of [-1, 1]) beam(2 * hx + 0.12, 0.13, 0.16, 0, 0.065, sz * (hz - 0.02), 'x');
  for (const sx of [-1, 1]) beam(0.16, 0.13, 2 * hz, sx * (hx - 0.02), 0.065, 0, 'z');
  for (const sz of [-1, 1]) beam(0.14, ridgeY - roofT - wallTop - 0.05, 0.14, 0, (wallTop + ridgeY - roofT) / 2, sz * (hz + 0.01), 'y');
  // door frame + door swung inward
  for (const sx of [-1, 1]) beam(0.12, 2.36, 0.15, sx * 0.68, 1.18, hz + 0.01, 'y');
  beam(1.5, 0.14, 0.17, 0, 2.39, hz + 0.01, 'x');
  const dm = M(-0.6, 0, hz - 0.03, 1.25);
  for (let i = 0; i < 4; i++) {
    ps.add('wood', box(0.285, 2.2, 0.045, 0.15 + i * 0.29, 1.14, 0, { uv: grainUV('y', rng, 1.8, 0.6), jitter: 0.005, rng, color: woodTint(rng, 0.62, 0.8) }).applyMatrix4(dm), ST);
  }
  for (const y of [0.45, 1.85]) ps.add('wood', box(1.1, 0.1, 0.04, 0.58, y, -0.045, { uv: grainUV('x', rng), color: frameTint() }).applyMatrix4(dm), ST);
  ps.add('wood', beamBetween(V3(0.12, 0.5, -0.045), V3(1.05, 1.8, -0.045), 0.04, 0.1, { rng, color: frameTint() }).applyMatrix4(dm), ST);

  // windows with shutters (built on a wall in local XY facing +Z, then placed)
  const windowAt = (m: THREE.Matrix4, w: number, y0: number, y1: number, both: boolean) => {
    const add = (g: Geo, mat: 'wood' | 'woodPlanks' = 'wood') => ps.add(mat, g.applyMatrix4(m), ST);
    add(box(w + 0.18, 0.07, 0.17, 0, y0 - 0.035, 0.05, { uv: grainUV('x', rng), jitter: 0.006, rng, color: frameTint() }));
    add(box(w + 0.12, 0.08, 0.1, 0, y1 + 0.04, 0.03, { uv: grainUV('x', rng), jitter: 0.006, rng, color: frameTint() }));
    for (const s of [-1, 1]) add(box(0.07, y1 - y0, 0.1, s * (w / 2 + 0.035), (y0 + y1) / 2, 0.03, { uv: grainUV('y', rng), color: frameTint() }));
    const shutter = (hingeX: number, dirX: number, yaw: number, roll: number) => {
      const sw = w / 2;
      const hm = M(hingeX, (y0 + y1) / 2, 0.08, yaw, 0, roll);
      add(box(sw - 0.01, y1 - y0 - 0.04, 0.035, (dirX * sw) / 2, 0, 0, { uv: { grain: 'y', along: 2.4, across: 8 * 0.12, grainOnU: true, u0: rng.next(), v0: 0 }, jitter: 0.004, rng, color: woodTint(rng, 0.85, 1.0) }).applyMatrix4(hm), 'woodPlanks');
      for (const yy of [-0.24, 0.24]) add(box(sw - 0.05, 0.06, 0.02, (dirX * sw) / 2, yy, 0.026, { uv: grainUV('x', rng), color: frameTint() }).applyMatrix4(hm));
    };
    shutter(-w / 2, 1, -2.55, 0);
    if (both) shutter(w / 2, -1, 0.75, 0.1);
  };
  windowAt(M(1.55, 0, hz, 0), 0.94, 1.08, 1.86, true);
  windowAt(M(hx, 0, 0, Math.PI / 2), 0.96, 1.1, 1.82, false);
  // floor
  ps.add('woodPlanks', box(2 * hx - 0.1, 0.05, 2 * hz - 0.1, 0, floorY - 0.025, 0, { uv: { grain: 'x', along: 2.6, across: 8 * 0.26, grainOnU: true, u0: rng.next(), v0: 0 }, color: lin(0.7) }));

  // --- porch ---
  plankDeck(ps, rng, { x0: -hx + 0.05, x1: hx - 0.05, z0: hz + 0.02, z1: hz + 1.32, top: floorY, thickness: 0.07, plankWidth: 0.26, overhang: 0.05 });
  for (const jx of [-2.25, 0, 2.25]) ps.add('wood', box(0.12, floorY - 0.07, 1.3, jx, (floorY - 0.07) / 2, hz + 0.67, { uv: grainUV('z', rng), color: frameTint() }));
  ps.add('wood', box(1.4, 0.13, 0.36, 0, 0.065, hz + 1.52, { uv: grainUV('x', rng), jitter: 0.01, rng, color: woodTint(rng, 0.75, 0.9) }));
  const pz = hz + 1.17;
  const beamY = roofUnder(2.15) - 0.1;
  for (const sx of [-1, 1]) {
    const g = post({ radius: 0.1, radiusTop: 0.09, y0: floorY - 0.02, y1: beamY + 0.06, radial: 8, jitter: 0.08, seed: rng.range(0, 99), along: 1.8, across: 0.6, u0: rng.next(), cap: 'flat' });
    ps.add('wood', xf(g, sx * 2.15, 0, pz));
    colliders.push({ type: 'circle', x: sx * 2.15, z: pz, radius: 0.13, yMin: 0, yMax: beamY });
  }
  ps.add('wood', box(4.7, 0.16, 0.16, 0, beamY, pz, { uv: grainUV('x', rng), jitter: 0.012, rng, color: frameTint() }));

  // --- thatch roof ---
  const zR0 = -hz - 0.45;
  const zR1 = hz + 1.5;
  const xE = hx + 0.5;
  const nzR = 12;
  const nxR = 5;
  const slopeLen = xE * Math.hypot(1, k);
  for (const side of [-1, 1]) {
    const top: THREE.Vector3[][] = [];
    for (let j = 0; j <= nxR; j++) {
      const row: THREE.Vector3[] = [];
      for (let i = 0; i <= nzR; i++) {
        const z = zR0 + ((zR1 - zR0) * i) / nzR;
        const t = j / nxR;
        let x = side * xE * t;
        let y = roofTop(x) + 0.05 * kitNoise.noise(z * 1.6 + side * 7, t * 3.1) + 0.03 * kitNoise.noise(z * 4.1, t * 7 + side);
        if (j === nxR) {
          x += side * rng.range(-0.02, 0.07);
          y += rng.range(-0.06, 0.02);
        }
        if (j === 0) y = ridgeY + 0.01;
        row.push(V3(x, y, z));
      }
      top.push(row);
    }
    ps.add(
      'thatch',
      gridSurface(top, {
        expect: V3(side, 1, 0),
        uv: (i, j) => [((zR1 - zR0) * i) / nzR / 1.25, (slopeLen * j) / nxR / 1.25],
        color: (_i, j, p, out) => {
          const t = j / nxR;
          const nn = 0.5 + 0.5 * kitNoise.noise(p.z * 0.9 + side * 3, t * 2.3);
          out.setRGB(1.0 - 0.14 * nn, 0.95 - 0.14 * nn, 0.84 - 0.12 * nn).multiplyScalar(1 - 0.2 * t * t);
        },
      }),
      ST,
    );
    const under: THREE.Vector3[][] = [[], []];
    for (let i = 0; i <= nzR; i++) {
      const z = zR0 + ((zR1 - zR0) * i) / nzR;
      under[0].push(V3(0, ridgeY - roofT, z));
      under[1].push(V3(top[nxR][i].x, roofUnder(xE), z));
    }
    ps.add('thatch', gridSurface(under, { expect: V3(0, -1, 0), color: (_i, _j, _p, out) => out.setScalar(0.42) }), ST);
    ps.add('thatch', gridSurface([top[nxR], under[1]], { expect: V3(side, 0, 0), uv: (i, j) => [i * 0.4, j * 0.25], color: (_i, j, _p, out) => out.setScalar(j ? 0.5 : 0.72) }), ST);
    for (const [ii, sz] of [
      [0, -1],
      [nzR, 1],
    ] as const) {
      const edgeTop = top.map((row) => row[ii]);
      const edgeUnder = edgeTop.map((p) => V3(p.x, roofUnder(Math.min(Math.abs(p.x), xE)), p.z));
      ps.add('thatch', gridSurface([edgeTop, edgeUnder], { expect: V3(0, 0, sz), uv: (i, j) => [i * 0.3, j * 0.25], color: (_i, j, _p, out) => out.setScalar(j ? 0.5 : 0.75) }), ST);
    }
    // bargeboards under the gable edges
    for (const zb of [zR1 - 0.06, zR0 + 0.06]) {
      ps.add('wood', beamBetween(V3(0, ridgeY - roofT - 0.06, zb), V3(side * (xE - 0.12), roofUnder(xE - 0.12) - 0.06, zb), 0.06, 0.2, { rng, color: frameTint() }), ST);
    }
  }
  const ridge = rodBetween(V3(0, ridgeY + 0.02, zR0 - 0.1), V3(0, ridgeY + 0.02, zR1 + 0.1), 0.17, 0.17, 7, { caps: true, along: 1.25, across: 1.0 });
  ps.add('thatch', paint(ridge, lin(0.82, 0.76, 0.64)), ST);
  for (let i = 0; i < 5; i++) {
    const z = zR0 + 0.35 + ((zR1 - zR0 - 0.7) * i) / 4;
    const tie = torus(0.178, 0.026, 4, 10);
    ps.add('rope', xf(paint(tie, lin(0.75)), 0, ridgeY + 0.02, z), ST);
  }
  // jolly roger on the ridge
  const fzp = zR1 - 0.3;
  ps.add('wood', rodBetween(V3(0, ridgeY - 0.1, fzp), V3(0, ridgeY + 1.45, fzp), 0.035, 0.028, 6, { caps: true }));
  const flagRows: THREE.Vector3[][] = [];
  for (let j = 0; j <= 3; j++) {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) row.push(V3(0.035 + (0.8 * i) / 6, ridgeY + 0.85 + (0.53 * j) / 3, fzp + 0.02 * Math.sin(i * 1.3)));
    flagRows.push(row);
  }
  ps.add('flag', gridSurface(flagRows, { expect: V3(0, 0, 1), uv: (i, j) => [i / 6, j / 3] }));

  // --- porch dressing ---
  for (const y of [beamY - 0.12, beamY - 0.18]) {
    const link = torus(0.026, 0.007, 4, 8);
    ps.add('metal', xf(paint(link, ironColor(rng)), 0.95, y, pz, 0, y < beamY - 0.15 ? Math.PI / 2 : 0, 0));
  }
  lanternInto(ps, V3(0.95, beamY - 0.5, pz), rng, 0.85);
  ps.addParts(barrelParts(rng, { h: 0.82, rEnd: 0.27, rMid: 0.32 }), M(-1.75, floorY, hz + 0.62, 0.4));
  colliders.push({ type: 'circle', x: -1.75, z: hz + 0.62, radius: 0.32, yMin: floorY, yMax: floorY + 0.82 });
  ps.addParts(crateParts(0.55, 0.55, 0.55, 0, rng), M(-1.12, floorY, hz + 0.5, -0.3));
  colliders.push({ type: 'box', x: -1.12, z: hz + 0.5, halfX: 0.27, halfZ: 0.27, yaw: -0.3, yMin: floorY, yMax: floorY + 0.55 });

  colliders.push({ type: 'box', x: 0, z: 0, halfX: hx + 0.1, halfZ: hz + 0.1, yaw: 0, yMin: 0, yMax: ridgeY });
  const platforms: LocalPlatform[] = [{ x: 0, z: hz + 0.67, halfX: hx - 0.05, halfZ: 0.65, yaw: 0, height: floorY, thickness: floorY, surface: 'wood' }];
  return { name: 'shack', parts: ps.build(), colliders, platforms };
}

// ---------------------------------------------------------------------------
// Market stall
// ---------------------------------------------------------------------------

/** Fish built along +Y (head at y = 0, tail at y = 0.4 * len / 0.4), flattened sideways (sides face +-Z). */
function fishGeo(len: number, color: THREE.ColorRepresentation): Geo {
  const s = len / 0.4;
  const body = lathe(
    [
      [0, 0],
      [0.03, 0.03],
      [0.05, 0.1],
      [0.046, 0.2],
      [0.026, 0.29],
      [0.01, 0.33],
      [0, 0.335],
    ],
    6,
  );
  body.scale(s, s, s * 0.55);
  paint(body, color);
  shade(body, (x, _y, _z, out) => {
    out.setScalar(x > 0.01 * s ? 0.72 : 1.08);
  });
  const tail = polyGeo([V3(0, 0.32 * s, 0), V3(-0.07 * s, 0.42 * s, 0), V3(0.07 * s, 0.42 * s, 0)], [0, 1, 2, 0, 2, 1], color);
  const eyes = [-1, 1].map((sz) => xf(paint(new THREE.IcosahedronGeometry(0.009 * s, 0), 0x111111), 0.008 * s, 0.05 * s, sz * 0.021 * s));
  return mergeLocal([body, tail, ...eyes]);
}

/** Fish lying on its side on a surface at height y (axis along the yaw direction). */
function fishLying(len: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, yaw: number): Geo {
  const s = len / 0.4;
  return fishGeo(len, color).applyMatrix4(M(x, y + 0.028 * s, z, yaw).multiply(M(0, 0, -0.2 * s, 0, Math.PI / 2, 0)));
}

function mergeLocal(geos: Geo[]): Geo {
  const ps = new PartSet();
  ps.add('vertexColor', geos);
  return ps.build()[0].geometry;
}

/** Market stall with a striped cloth awning (red / cream, scalloped valance), counter and goods. Faces +Z. */
export function marketStall(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1001));
  const ps = new PartSet();
  const hx = 1.45;
  const zF = 0.85;
  const zB = -0.85;
  const hF = 2.2;
  const hB = 2.65;
  const tint = () => woodTint(rng, 0.75, 0.95);
  for (const sx of [-1, 1]) {
    ps.add('wood', box(0.12, hF, 0.12, sx * hx, hF / 2, zF, { uv: grainUV('y', rng), jitter: 0.01, rng, color: tint() }));
    ps.add('wood', box(0.12, hB, 0.12, sx * hx, hB / 2, zB, { uv: grainUV('y', rng), jitter: 0.01, rng, color: tint() }));
    ps.add('wood', beamBetween(V3(sx * hx, hF - 0.07, zF + 0.06), V3(sx * hx, hB - 0.07, zB - 0.06), 0.08, 0.1, { rng, jitter: 0.006, color: tint() }));
  }
  ps.add('wood', box(2 * hx + 0.22, 0.1, 0.1, 0, hF - 0.06, zF, { uv: grainUV('x', rng), jitter: 0.008, rng, color: tint() }));
  ps.add('wood', box(2 * hx + 0.22, 0.1, 0.1, 0, hB - 0.06, zB, { uv: grainUV('x', rng), jitter: 0.008, rng, color: tint() }));
  // counter
  const cTop = 0.95;
  let x = -hx + 0.07;
  while (x < hx - 0.08) {
    const bw = Math.min(rng.range(0.2, 0.27), hx - 0.07 - x);
    ps.add('wood', box(bw - 0.012, cTop - 0.1, 0.04, x + bw / 2, (cTop - 0.1) / 2 + 0.03, 0.8, { uv: grainUV('y', rng, 1.6, 0.6), jitter: 0.006, rng, color: woodTint(rng, 0.72, 1.0) }));
    x += bw;
  }
  for (const z of [0.37, 0.67]) ps.add('woodPlanks', box(2 * hx + 0.06, 0.06, 0.29, 0, cTop - 0.03, z, { uv: plankUV('x', 0.29, rng), jitter: 0.006, rng, color: woodTint(rng, 0.85, 1.02) }));
  for (const sx of [-1, 1]) ps.add('wood', box(0.04, cTop - 0.08, 0.62, sx * (hx - 0.05), (cTop - 0.08) / 2 + 0.02, 0.51, { uv: grainUV('y', rng), color: tint() }));
  ps.add('woodPlanks', box(2 * hx - 0.15, 0.04, 0.5, 0, 0.36, 0.5, { uv: plankUV('x', 0.25, rng), color: lin(0.7) }));

  // striped awning
  const nStr = 8;
  const ax0 = -hx - 0.14;
  const ax1 = hx + 0.14;
  const backY = hB + 0.03;
  const frontY = hF + 0.01;
  const zBack = zB - 0.14;
  const zFront = zF + 0.3;
  const nzs = 6;
  for (let s = 0; s < nStr; s++) {
    const x0 = ax0 + ((ax1 - ax0) * s) / nStr;
    const x1 = ax0 + ((ax1 - ax0) * (s + 1)) / nStr;
    const colr = s % 2 === 0 ? tone(Palette.pirateRed, rng.range(0.95, 1.08)) : tone(Palette.sail, rng.range(0.9, 0.98));
    const billow = rng.range(0.05, 0.09);
    const rows = [x0, x1].map((xx) => {
      const row: THREE.Vector3[] = [];
      for (let i = 0; i <= nzs; i++) {
        const t = i / nzs;
        row.push(V3(xx, backY + (frontY - backY) * t - billow * Math.sin(Math.PI * t), zBack + (zFront - zBack) * t));
      }
      return row;
    });
    ps.add('cloth', gridSurface(rows, { expect: V3(0, 1, 0.3), uv: (i) => [0.8 * (i / nzs), 0], color: (_i, _j, _p, out) => out.copy(colr) }), ST);
    const xm = (x0 + x1) / 2;
    const val = polyGeo(
      [V3(x0, frontY, zFront), V3(x1, frontY, zFront), V3(x1, frontY - 0.2, zFront + 0.01), V3(x0, frontY - 0.2, zFront + 0.01), V3(xm, frontY - 0.32, zFront + 0.015)],
      [0, 3, 1, 1, 3, 2, 3, 4, 2],
      colr,
    );
    ps.add('cloth', setUvX(val, (_x, y) => 0.8 + ((frontY - y) / 0.32) * 0.2), ST);
  }

  // goods: fruit basket, cloth bolts, bottles, fish
  const basket = lathe(
    [
      [0, 0],
      [0.16, 0],
      [0.24, 0.13],
      [0.22, 0.135],
      [0.145, 0.025],
      [0, 0.025],
    ],
    10,
    { along: 0.6, across: 0.6 },
  );
  ps.add('thatch', xf(paint(basket, lin(0.85, 0.78, 0.66)), -0.85, cTop, 0.5));
  const fruitCols = [Palette.flowerOrange, Palette.flowerOrange, 0x9fc93c, 0xd8321e, Palette.flowerYellow];
  for (let i = 0; i < 10; i++) {
    const a = (i / 7) * TAU;
    const top = i >= 7;
    const r = top ? 0.05 : 0.13;
    const g = new THREE.SphereGeometry(0.055, 7, 5);
    paint(g, rng.pick(fruitCols));
    ps.add('vertexColor', xf(g, -0.85 + Math.cos(a) * r, cTop + (top ? 0.15 : 0.08), 0.5 + Math.sin(a) * r));
  }
  for (const [bx, c] of [
    [-0.32, 0x7b3fa0],
    [-0.22, 0x2f8a8a],
  ] as const) {
    const g = rodBetween(V3(bx, cTop + 0.07, 0.25), V3(bx, cTop + 0.07, 0.75), 0.065, 0.065, 8, { caps: true });
    ps.add('cloth', paint(g, c));
  }
  for (let i = 0; i < 3; i++) {
    const g = lathe(
      [
        [0, 0],
        [0.045, 0],
        [0.045, 0.14],
        [0.02, 0.19],
        [0.015, 0.25],
        [0.018, 0.26],
        [0, 0.26],
      ],
      7,
    );
    paint(g, i === 1 ? 0x5a3a1a : 0x2f5a2a);
    ps.add('vertexColor', xf(g, 0.2 + i * 0.13, cTop, 0.62 - (i % 2) * 0.1));
    const cork = new THREE.CylinderGeometry(0.014, 0.014, 0.04, 5);
    ps.add('woodPale', xf(paint(cork, lin(0.95)), 0.2 + i * 0.13, cTop + 0.27, 0.62 - (i % 2) * 0.1));
  }
  for (let i = 0; i < 2; i++) ps.add('vertexColor', fishLying(0.42, i ? 0x8fa6b5 : 0x7d98a8, 0.92 + i * 0.16, cTop, 0.5 - i * 0.06, 1.3 + i * 0.35));
  // crate and sack beside the stall
  ps.addParts(crateParts(0.6, 0.55, 0.6, 0, rng), M(hx + 0.55, 0, 0.35, 0.3));
  const sack = new THREE.SphereGeometry(0.3, 9, 7);
  displace(sack, 0.04, 4, 3);
  sack.scale(1, 1.25, 0.9);
  paint(sack, tone(Palette.canvas, 0.85));
  bakeGroundAO(sack, 0.3, 0.4);
  ps.add('cloth', xf(sack, -hx - 0.45, 0.3, 0.4));
  return {
    name: 'market-stall',
    parts: ps.build(),
    colliders: [
      { type: 'box', x: 0, z: 0, halfX: hx + 0.12, halfZ: 0.95, yaw: 0, yMin: 0, yMax: hB },
      { type: 'box', x: hx + 0.55, z: 0.35, halfX: 0.3, halfZ: 0.3, yaw: 0.3, yMin: 0, yMax: 0.55 },
      { type: 'circle', x: -hx - 0.45, z: 0.4, radius: 0.3, yMin: 0, yMax: 0.6 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Fence, signpost
// ---------------------------------------------------------------------------

/** Rustic post-and-rail fence along local X, centred (from -length/2 to +length/2). */
export function fence(length = 4, seed = 1): PropDefinition {
  const L = Math.max(0.8, length);
  const rng = new Rng(seedOf(seed, 1101));
  const ps = new PartSet();
  const n = Math.max(1, Math.round(L / 1.8));
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) xs.push(-L / 2 + (L * i) / n + (i > 0 && i < n ? rng.range(-0.1, 0.1) : 0));
  for (const x of xs) {
    const g = post({
      radius: rng.range(0.06, 0.075),
      y0: -0.15,
      y1: rng.range(1.05, 1.25),
      radial: 6,
      jitter: 0.1,
      seed: rng.range(0, 99),
      lean: [rng.range(-0.03, 0.03), rng.range(-0.04, 0.04)],
      along: 1.4,
      across: 0.5,
      u0: rng.next(),
      cap: 'dome',
    });
    paint(g, woodTint(rng, 0.75, 0.95));
    ps.add('wood', bakeGroundAO(xf(g, x, 0, 0), 0.4, 0.35, 0));
  }
  for (let i = 0; i < n; i++) {
    for (const y of [0.42, 0.88]) {
      const a = V3(xs[i] - 0.08, y + rng.range(-0.04, 0.04), 0.07);
      const b = V3(xs[i + 1] + 0.08, y + rng.range(-0.04, 0.04), 0.07);
      if (rng.chance(0.12)) b.set(THREE.MathUtils.lerp(xs[i], xs[i + 1], 0.8), 0.05, 0.12);
      ps.add(rng.chance(0.3) ? 'woodPale' : 'wood', beamBetween(a, b, 0.05, 0.11, { rng, jitter: 0.015, color: woodTint(rng, 0.8, 1) }));
    }
    const knot = ropeWrap(xs[i + 1], 0.9, 0.0, 0.085, 0.018, rng);
    ps.add('rope', knot);
  }
  return { name: 'fence', parts: ps.build(), colliders: [{ type: 'box', x: 0, z: 0, halfX: L / 2, halfZ: 0.12, yaw: 0, yMin: 0, yMax: 1.1 }] };
}

/** Skull (bone white) built around the origin, facing +Z, cranium ~0.22 m wide. */
function skullInto(ps: PartSet, m: THREE.Matrix4): void {
  const bone = tone(0xe9dfc4);
  const dark = tone(0x1a1410);
  const cranium = new THREE.SphereGeometry(0.11, 10, 8);
  ps.add('vertexColor', xf(paint(cranium, bone), 0, 0.1, -0.01, 0, 0, 0, 1, 0.92, 1.1).applyMatrix4(m));
  const face = chamferBox(0.13, 0.08, 0.1, 0.02);
  ps.add('vertexColor', xf(paint(face, bone), 0, 0.035, 0.05).applyMatrix4(m));
  const jaw = chamferBox(0.1, 0.04, 0.08, 0.015);
  ps.add('vertexColor', xf(paint(jaw, tone(0xd8ccae)), 0, -0.012, 0.045).applyMatrix4(m));
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.03, 6, 4);
    ps.add('vertexColor', xf(paint(eye, dark), sx * 0.042, 0.075, 0.098, 0, 0, 0, 1, 1, 0.6).applyMatrix4(m));
  }
  const nose = new THREE.ConeGeometry(0.016, 0.03, 3);
  ps.add('vertexColor', xf(paint(nose, dark), 0, 0.035, 0.1, Math.PI, 0, 0).applyMatrix4(m));
  for (let i = -2; i <= 2; i++) ps.add('vertexColor', box(0.012, 0.012, 0.008, i * 0.016, 0.004, 0.091, { color: dark }).applyMatrix4(m));
}

/** Weathered signpost with three arrow boards and a skull impaled on top. */
export function signpost(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1151));
  const ps = new PartSet();
  const top = 2.35;
  const g = post({ radius: 0.075, radiusTop: 0.065, y0: -0.2, y1: top, radial: 7, jitter: 0.08, seed: rng.range(0, 99), along: 1.6, across: 0.5, u0: rng.next(), cap: 'flat' });
  ps.add('wood', bakeGroundAO(paint(g, woodTint(rng, 0.75, 0.9)), 0.4, 0.35, 0));
  const boards = [
    { y: 2.0, yaw: 0.5, len: 0.85 },
    { y: 1.72, yaw: -2.5, len: 0.75 },
    { y: 1.45, yaw: 1.95, len: 0.7 },
  ];
  for (const b of boards) {
    const shape: Array<[number, number]> = [
      [0.04, -0.085],
      [b.len - 0.14, -0.09],
      [b.len, 0],
      [b.len - 0.15, 0.085],
      [0.04, 0.09],
    ];
    const bg = extrudeShape(shape, 0.035);
    projectUV(bg, grainUV('x', rng, 1.2, 0.6));
    paint(bg, woodTint(rng, 0.85, 1.05));
    jitterColors(bg, 0.12, 3, rng.range(0, 30));
    ps.add('woodPale', xf(bg, 0, b.y, 0, rng.range(-0.04, 0.04), b.yaw, rng.range(-0.07, 0.07)));
    // painted stripe (tar) for readability
    const stripe = box(b.len * 0.5, 0.025, 0.004, b.len * 0.42, 0, 0.0195, { color: tone(0x2a1d14) });
    ps.add('vertexColor', stripe.applyMatrix4(M(0, b.y, 0, b.yaw, 0, 0)));
  }
  ps.add('rope', ropeWrap(0, 1.86, 0, 0.085, 0.02, rng));
  skullInto(ps, M(0, top - 0.04, 0, 0.35, -0.12, 0.05, 1.15));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + rng.range(-0.3, 0.3);
    const rk = rockGeometry(rng, rng.range(0.1, 0.15), 0, 0.7);
    paint(rk, tone(Palette.rock, rng.range(0.85, 1.1)));
    ps.add('rock', xf(rk, Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2, 0, rng.range(0, TAU), 0));
  }
  return { name: 'signpost', parts: ps.build(), colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.2, yMin: 0, yMax: top }] };
}

// ---------------------------------------------------------------------------
// Rope, net, flag, anchor
// ---------------------------------------------------------------------------

/** Coiled rope lying on the ground (two layers and a trailing end toward +X). No collider. */
export function ropeCoil(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1301));
  const rr = 0.034;
  const pts: THREE.Vector3[] = [];
  const turns1 = 3;
  const n1 = turns1 * 10;
  for (let i = 0; i <= n1; i++) {
    const t = i / n1;
    const a = t * turns1 * TAU;
    const r = 0.1 + 0.22 * t;
    pts.push(V3(Math.cos(a) * r, rr * 1.05, Math.sin(a) * r));
  }
  const turns2 = 2;
  const n2 = turns2 * 10;
  for (let i = 1; i <= n2; i++) {
    const t = i / n2;
    const a = turns1 * TAU + t * turns2 * TAU;
    const r = 0.29 - 0.12 * t;
    pts.push(V3(Math.cos(a) * r, rr * 2.85, Math.sin(a) * r));
  }
  const last = pts[pts.length - 1];
  pts.push(V3(last.x + 0.12, rr * 2.4, last.z + 0.05), V3(0.36, rr * 1.4, 0.12), V3(0.55, rr, 0.18 + rng.range(-0.05, 0.05)), V3(0.8, rr, 0.12));
  const g = ropeAlong(pts, rr, { segments: 64, radial: 4, twist: 0.07 });
  return { name: 'rope-coil', parts: [{ geometry: g, material: 'rope' }] };
}

/** Fishing net hanging between two poles (net in the XY plane, sways via the cloth shader). */
export function fishingNet(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1401));
  const ps = new PartSet();
  const hx = 1.35;
  const tops: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    const lean: [number, number] = [s * 0.035, rng.range(-0.02, 0.02)];
    const g = post({ radius: 0.07, radiusTop: 0.055, y0: -0.25, y1: 2.35, radial: 6, jitter: 0.08, seed: rng.range(0, 99), lean, along: 1.6, across: 0.5, u0: rng.next(), cap: 'dome' });
    ps.add('wood', bakeGroundAO(xf(paint(g, woodTint(rng, 0.75, 0.9)), s * hx, 0, 0), 0.4, 0.35, 0));
    tops.push(V3(s * hx + lean[0] * 2.4, 2.15, lean[1] * 2.4));
    ps.add('rope', ropeWrap(s * hx + lean[0] * 2.4, 2.15, lean[1] * 2.4, 0.075, 0.022, rng));
  }
  const [tl, tr] = tops;
  const P = (u: number, v: number) => {
    const top = new THREE.Vector3().lerpVectors(tl, tr, u);
    top.y -= 0.16 * Math.sin(Math.PI * u);
    const drop = (1.25 + 0.32 * Math.sin(Math.PI * u)) * v;
    return V3(top.x * (1 - 0.1 * v), top.y - drop, top.z + 0.1 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v * 0.9) + 0.03 * kitNoise.noise(u * 5, v * 4));
  };
  const nu = 12;
  const nv = 7;
  const seg = 10;
  const netCol = tone(0x4d4a34);
  const hw = 0.011;
  for (let kk = 0; kk <= nv; kk++) {
    const v = kk / nv;
    const pts = Array.from({ length: seg + 1 }, (_, i) => P(i / seg, v));
    const g = ribbon(pts, () => V3(0, hw, 0), V3(0, 0, 1));
    ps.add('cloth', setUvX(paint(g, netCol), () => v * 0.8));
  }
  for (let kk = 0; kk <= nu; kk++) {
    const u = kk / nu;
    const pts = Array.from({ length: seg + 1 }, (_, i) => P(u, i / seg));
    const g = ribbon(pts, () => V3(hw, 0, 0), V3(0, 0, 1));
    ps.add('cloth', setUvX(paint(g, netCol), (_x, _y, _z, uu) => uu * 0.8));
  }
  ps.add('rope', ropeAlong(Array.from({ length: 9 }, (_, i) => P(i / 8, 0).add(V3(0, 0.01, 0))), 0.02, { radial: 4, segments: 16 }));
  for (let i = 1; i < 7; i++) {
    const p = P(i / 7, 0);
    const fl = new THREE.CylinderGeometry(0.042, 0.042, 0.09, 6);
    ps.add('vertexColor', xf(paint(fl, i % 2 ? Palette.pirateRed : 0xc49a5c), p.x, p.y - 0.02, p.z, 0, 0, Math.PI / 2));
  }
  const pile = new THREE.SphereGeometry(0.42, 12, 5, 0, TAU, 0, Math.PI / 2);
  displace(pile, 0.07, 5, 7);
  pile.scale(1, 0.42, 0.85);
  paint(pile, tone(0x6b6648));
  jitterColors(pile, 0.35, 9, 3);
  ps.add('cloth', xf(pile, hx - 0.25, 0, 0.42));
  const fish = fishGeo(0.4, 0x8fa6b5);
  const fp = P(0.62, 0.6);
  ps.add('vertexColor', fish.applyMatrix4(M(fp.x, fp.y + 0.15, fp.z + 0.05, 0.3, 0, Math.PI + 0.3)));
  return {
    name: 'fishing-net',
    parts: ps.build(),
    colliders: [
      { type: 'circle', x: -hx, z: 0, radius: 0.1, yMin: 0, yMax: 2.35 },
      { type: 'circle', x: hx, z: 0, radius: 0.1, yMin: 0, yMax: 2.35 },
      { type: 'box', x: 0, z: 0, halfX: hx, halfZ: 0.15, yaw: 0, yMin: 0.3, yMax: 2.1 },
    ],
  };
}

/** Light-weight data for gameplay: the flag cloth area of `flagpole()` (prop-local, XY plane at z = 0). */
export const FLAGPOLE_FLAG = { x0: 0.07, x1: 1.72, y0: 5.0, y1: 6.1 } as const;

/** Tall wooden flagpole on a rock cairn with a jolly roger ('flag' material, uv.x = 0 at the pole). */
export function flagpole(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1501));
  const ps = new PartSet();
  const H = 6.25;
  const g = post({ radius: 0.09, radiusTop: 0.055, y0: -0.3, y1: H, rings: [1.2, 2.6, 4.2], radial: 8, jitter: 0.04, seed: rng.range(0, 99), along: 2.4, across: 0.6, u0: rng.next(), cap: 'flat' });
  ps.add('wood', paint(g, woodTint(rng, 0.8, 0.95)));
  const finial = new THREE.IcosahedronGeometry(0.075, 1);
  ps.add('brass', xf(paint(finial, tone(Palette.brass, 1.1)), 0, H + 0.06, 0));
  ps.add('rope', ropeAlong([V3(0.09, 0.95, 0.03), V3(0.075, 3.0, 0.05), V3(0.06, H - 0.05, 0.04)], 0.012, { radial: 3, segments: 8 }));
  ps.add('wood', box(0.05, 0.05, 0.22, 0.1, 0.95, 0, { uv: grainUV('z', rng), color: woodTint(rng, 0.6, 0.7) }));
  ps.add('rope', ropeWrap(0, 0.95, 0, 0.1, 0.018, rng));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng.range(-0.2, 0.2);
    const rk = rockGeometry(rng, rng.range(0.15, 0.24), 0, 0.75);
    paint(rk, tone(Palette.rock, rng.range(0.85, 1.12)));
    ps.add('rock', xf(rk, Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3, 0, rng.range(0, TAU), 0));
  }
  const nu = 14;
  const nv = 6;
  const { x0, x1, y0, y1 } = FLAGPOLE_FLAG;
  const rows: THREE.Vector3[][] = [];
  for (let j = 0; j <= nv; j++) {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      row.push(V3(x0 + (x1 - x0) * u, y0 + ((y1 - y0) * j) / nv - 0.05 * u * u, 0.06 * Math.sin(u * Math.PI * 1.5) * u));
    }
    rows.push(row);
  }
  ps.add('flag', gridSurface(rows, { expect: V3(0, 0, 1), uv: (i, j) => [i / nu, j / nv] }));
  for (const y of [y0 + 0.05, y1 - 0.05]) ps.add('rope', ropeWrap(0, y, 0, 0.068, 0.014, rng));
  return { name: 'flagpole', parts: ps.build(), colliders: [{ type: 'circle', x: 0, z: 0, radius: 0.32, yMin: 0, yMax: H }] };
}

/** Interlocked chain links (oval tori) along a smooth path. */
function chainInto(ps: PartSet, pts: THREE.Vector3[], rng: Rng, r = 0.075, tube = 0.019): void {
  const curve = new THREE.CatmullRomCurve3(pts);
  const pitch = 2 * (1.25 * r - tube);
  const n = Math.max(2, Math.round(curve.getLength() / pitch));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const g = torus(r, tube, 3, 8);
    g.scale(1.25, 0.8, 1);
    if (i % 2) g.rotateX(Math.PI / 2);
    paint(g, ironColor(rng, 0.5));
    const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), curve.getTangentAt(t));
    ps.add('metal', g.applyMatrix4(new THREE.Matrix4().compose(curve.getPointAt(t), q, V3(1, 1, 1))));
  }
}

/**
 * Large admiralty anchor stuck upright in the ground (decor): crown buried, arms + flukes just
 * above the ground in the XY plane (iconic silhouette faces +Z), iron stock along Z near the top,
 * leaning back slightly; a chain hangs from the ring and trails off toward +X.
 */
export function anchor(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1601));
  const iron = () => ironColor(rng, 0.45);
  const parts = new PartSet();
  // built upright: shank along +Y, arms in the XY plane, stock along Z
  parts.add('metal', paint(post({ radius: 0.075, radiusTop: 0.06, y0: 0.12, y1: 1.98, radial: 8, cap: 'flat' }), iron()));
  const ring = torus(0.17, 0.034, 6, 14);
  parts.add('metal', xf(paint(ring, iron()), 0, 2.13, 0));
  parts.add('metal', xf(paint(new THREE.SphereGeometry(0.075, 8, 6), iron()), 0, 1.98, 0, 0, 0, 0, 1, 0.8, 1));
  parts.add('metal', paint(rodBetween(V3(0, 1.78, -0.75), V3(0, 1.78, 0.75), 0.045, 0.045, 7), iron()));
  for (const sz of [-1, 1]) parts.add('metal', xf(paint(new THREE.IcosahedronGeometry(0.075, 1), iron()), 0, 1.78, sz * 0.78));
  parts.add('metal', xf(paint(new THREE.IcosahedronGeometry(0.11, 1), iron()), 0, 0.12, 0));
  const arms = torus(0.82, 0.068, 6, 14, TAU / 3);
  parts.add('metal', xf(paint(arms, iron()), 0, 0.94, 0, 0, 0, (7 * Math.PI) / 6));
  for (const side of [-1, 1]) {
    const a = side > 0 ? -Math.PI / 6 : (7 * Math.PI) / 6;
    const tip = V3(0.82 * Math.cos(a), 0.94 + 0.82 * Math.sin(a), 0);
    const fl = extrudeShape(
      [
        [-0.17, -0.1],
        [0.17, -0.1],
        [0.05, 0.18],
        [0, 0.26],
        [-0.05, 0.18],
      ],
      0.04,
    );
    paint(fl, iron());
    parts.add('metal', xf(fl, tip.x, tip.y, 0, 0, 0, -side * (Math.PI / 6)));
  }
  const plant = M(0, -0.2, 0, 0, -0.14, 0.05);
  const ps = new PartSet();
  ps.addParts(parts.build(), plant);
  // chain hanging from the ring, trailing on the ground
  const s0 = V3(0, 2.13 - 0.2, 0).applyMatrix4(plant);
  chainInto(
    ps,
    [s0, V3(s0.x + 0.04, 1.1, s0.z + 0.05), V3(s0.x + 0.1, 0.3, s0.z + 0.1), V3(s0.x + 0.35, 0.05, s0.z + 0.3), V3(s0.x + 0.8, 0.04, s0.z + 0.42), V3(s0.x + 1.15, 0.04, s0.z + 0.3)],
    rng,
  );
  return {
    name: 'anchor',
    parts: ps.build(),
    colliders: [
      { type: 'box', x: 0, z: 0, halfX: 0.85, halfZ: 0.16, yaw: 0, yMin: 0, yMax: 0.65 },
      { type: 'box', x: 0, z: -0.15, halfX: 0.13, halfZ: 0.82, yaw: 0, yMin: 0, yMax: 2.0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Weapon rack, hammock
// ---------------------------------------------------------------------------

/** Wooden rack holding four cutlasses point-down. Faces +Z. */
export function weaponRack(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1701));
  const ps = new PartSet();
  const wt = () => woodTint(rng, 0.7, 0.9);
  for (const sx of [-1, 1]) {
    ps.add('wood', xf(paint(chamferBox(0.1, 0.09, 0.62, 0.02, { uv: grainUV('z', rng) }), wt()), sx * 0.62, 0.045, 0));
    ps.add('wood', xf(paint(chamferBox(0.09, 1.3, 0.09, 0.015, { uv: grainUV('y', rng) }), wt()), sx * 0.62, 0.65, -0.03));
    ps.add('wood', beamBetween(V3(sx * 0.62, 0.09, 0.22), V3(sx * 0.62, 0.62, -0.02), 0.05, 0.06, { rng, color: wt() }));
  }
  ps.add('wood', xf(paint(chamferBox(1.42, 0.08, 0.09, 0.015, { uv: grainUV('x', rng) }), wt()), 0, 1.18, -0.03));
  ps.add('wood', xf(paint(chamferBox(1.34, 0.07, 0.17, 0.015, { uv: grainUV('x', rng) }), wt()), 0, 0.3, 0.06));
  for (let i = 0; i < 4; i++) {
    const x = -0.42 + i * 0.28 + rng.range(-0.02, 0.02);
    const m = new THREE.Matrix4().compose(V3(x, 1.02, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, rng.range(-0.25, 0.25) + (i % 2 ? Math.PI : 0), rng.range(-0.04, 0.04), 'YXZ')), V3(1, 1, 1));
    cutlassInto(ps, m, rng);
  }
  return { name: 'weapon-rack', parts: ps.build(), colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.7, halfZ: 0.3, yaw: 0, yMin: 0, yMax: 1.25 }] };
}

/** Striped canvas hammock slung between two posts along X. */
export function hammock(seed = 1): PropDefinition {
  const rng = new Rng(seedOf(seed, 1801));
  const ps = new PartSet();
  const px = 1.75;
  for (const s of [-1, 1]) {
    const g = post({ radius: 0.1, radiusTop: 0.085, y0: -0.2, y1: 1.85, radial: 7, jitter: 0.08, seed: rng.range(0, 99), lean: [s * 0.04, 0], along: 1.6, across: 0.6, u0: rng.next(), cap: 'dome' });
    ps.add('wood', bakeGroundAO(xf(paint(g, woodTint(rng, 0.75, 0.9)), s * px, 0, 0), 0.4, 0.35, 0));
    ps.add('rope', ropeWrap(s * (px + 0.06), 1.45, 0, 0.12, 0.026, rng));
  }
  const bx = 1.05;
  const bw = 0.45;
  const surf = (x: number, z: number) => V3(x, 0.62 + 0.43 * (x / bx) ** 2 + 0.1 * (z / bw) ** 2, z * (0.92 + 0.08 * (x / bx) ** 2));
  const stripes = 5;
  for (let s = 0; s < stripes; s++) {
    const z0 = -bw + (2 * bw * s) / stripes;
    const z1 = -bw + (2 * bw * (s + 1)) / stripes;
    const col = s % 2 === 0 ? tone(Palette.pirateRed, 0.95) : tone(Palette.sail, 0.95);
    const rows = [z0, z1].map((z) => Array.from({ length: 11 }, (_, i) => surf(-bx + (2 * bx * i) / 10, z)));
    ps.add('cloth', gridSurface(rows, { expect: V3(0, 1, 0), uv: () => [0.15, 0], color: (_i, _j, _p, out) => out.copy(col) }));
  }
  for (const s of [-1, 1]) {
    const e = surf(s * bx, 0);
    ps.add('wood', paint(rodBetween(V3(s * bx, e.y + 0.02, -bw - 0.06), V3(s * bx, e.y + 0.02, bw + 0.06), 0.025, 0.025, 6, { caps: true }), woodTint(rng, 0.7, 0.85)));
    const ringP = V3(s * 1.42, 1.32, 0);
    for (const z of [-bw, 0, bw]) ps.add('rope', paint(rodBetween(surf(s * bx, z).add(V3(0, 0.02, 0)), ringP, 0.009, 0.009, 3), lin(0.9)));
    const ring = torus(0.04, 0.01, 4, 8);
    ps.add('metal', xf(paint(ring, ironColor(rng)), ringP.x, ringP.y, 0, 0, Math.PI / 2, 0));
    ps.add('rope', paint(rodBetween(ringP, V3(s * (px - 0.02), 1.45, 0), 0.014, 0.014, 4), lin(0.9)));
  }
  const pillow = new THREE.SphereGeometry(0.17, 8, 5);
  pillow.scale(1, 0.45, 1.5);
  ps.add('cloth', xf(paint(pillow, tone(Palette.canvas, 0.95)), -0.72, surf(-0.72, 0).y + 0.08, 0));
  return {
    name: 'hammock',
    parts: ps.build(),
    colliders: [
      { type: 'circle', x: -px, z: 0, radius: 0.12, yMin: 0, yMax: 1.85 },
      { type: 'circle', x: px, z: 0, radius: 0.12, yMin: 0, yMax: 1.85 },
      { type: 'box', x: 0, z: 0, halfX: 1.15, halfZ: 0.48, yaw: 0, yMin: 0.45, yMax: 1.15 },
    ],
  };
}
