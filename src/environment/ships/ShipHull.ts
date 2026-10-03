import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../../utils/math';
import { TILE, fromArrays } from './ShipKit';

/**
 * Lofted hull surfaces built from cross-sections.
 *
 * A hull is described by a few smooth functions of the station parameter w in [0, 1]
 * (0 = transom / stern, 1 = stem / bow). Each cross-section is a superellipse quarter from the
 * keel up to the maximum breadth (rounded bilge), followed by a tumblehome curve up to the sheer.
 * The stem and sternpost are raked: low points of the end stations are pulled inwards so the
 * waterline is shorter than the deck. Geometry is generated for the starboard side (+X) and
 * mirrored for port.
 */
export interface HullParams {
  zStern: number;
  zBow: number;
  halfBeam: number;
  keelY: number;
  maxBeamY: number;
  /** Tumblehome: relative narrowing per (2 m above the max breadth)^1.5. */
  tumble: number;
  /** Breadth fraction at the transom. */
  sternBeam: number;
  /** w where the full breadth is reached / where the bow taper starts. */
  fullFrom: number;
  fullTo: number;
  /** Bow taper exponent (smaller = bluffer, rounder bow). */
  bowBluff: number;
  keelRiseStern: number;
  keelRiseBow: number;
  /** Superellipse exponents (2 = ellipse, larger = fuller bilge). */
  nMid: number;
  nStern: number;
  nBow: number;
  /** How far aft the stem foot sits relative to the stem head (m). */
  bowRake: number;
  /** How far forward the sternpost foot sits (m). */
  sternRake: number;
  /** Transom top overhang aft of zStern (m). */
  sternOverhang: number;
  /** Top of the hull planking as a function of nominal z. */
  sheer: (zn: number) => number;
}

export interface Station {
  w: number;
  zn: number;
  B: number;
  D: number;
  Ym: number;
  S: number;
  n: number;
}

const HALF_PI = Math.PI / 2;

export class Hull {
  readonly len: number;
  private readonly bowD: number;
  private readonly bowS: number;
  private readonly sternD: number;
  private readonly sternS: number;

  constructor(readonly p: HullParams) {
    this.len = p.zBow - p.zStern;
    const b = this.station(1);
    const s = this.station(0);
    this.bowD = b.D;
    this.bowS = b.S;
    this.sternD = s.D;
    this.sternS = s.S;
  }

  zn(w: number): number {
    return this.p.zStern + this.len * w;
  }

  wOf(zn: number): number {
    return (zn - this.p.zStern) / this.len;
  }

  station(w: number): Station {
    const p = this.p;
    let f: number;
    if (w < p.fullFrom) f = lerp(p.sternBeam, 1, smoothstep(0, p.fullFrom, w));
    else if (w <= p.fullTo) f = 1;
    else {
      const t = (w - p.fullTo) / (1 - p.fullTo);
      f = Math.pow(Math.max(0, 1 - t * t), p.bowBluff);
    }
    const D = p.keelY + p.keelRiseStern * (1 - smoothstep(0, 0.25, w)) + p.keelRiseBow * smoothstep(0.7, 1, w);
    const n = p.nMid - (p.nMid - p.nStern) * (1 - smoothstep(0, 0.3, w)) - (p.nMid - p.nBow) * smoothstep(0.6, 1, w);
    const zn = this.zn(w);
    return { w, zn, B: p.halfBeam * f, D, Ym: p.maxBeamY, S: p.sheer(zn), n };
  }

  sigmaOf(st: Station, y: number): number {
    if (y <= st.Ym) {
      const r = clamp((st.Ym - y) / (st.Ym - st.D), 0, 1);
      return Math.acos(Math.pow(r, st.n / 2));
    }
    return HALF_PI + ((y - st.Ym) / (st.Ym - st.D)) * HALF_PI;
  }

  yOfSigma(st: Station, s: number): number {
    if (s <= HALF_PI) return st.Ym - (st.Ym - st.D) * Math.pow(Math.max(0, Math.cos(s)), 2 / st.n);
    return st.Ym + ((s - HALF_PI) / HALF_PI) * (st.Ym - st.D);
  }

  xOfSigma(st: Station, s: number): number {
    if (s <= HALF_PI) return st.B * Math.pow(Math.max(0, Math.sin(s)), 2 / st.n);
    return this.xOf(st, this.yOfSigma(st, s));
  }

  /** Half-breadth of a station at height y. */
  xOf(st: Station, y: number): number {
    if (y <= st.Ym) {
      const r = clamp((st.Ym - y) / (st.Ym - st.D), 0, 1);
      return st.B * Math.pow(Math.max(0, 1 - Math.pow(r, st.n)), 1 / st.n);
    }
    const t = (y - st.Ym) / 2;
    return st.B * Math.max(0.05, 1 - this.p.tumble * Math.pow(t, 1.5));
  }

  /** Actual z of a hull point on station w at height y (stem / stern rake applied). */
  zOf(w: number, y: number): number {
    const p = this.p;
    const qb = clamp((y - this.bowD) / (this.bowS - this.bowD), 0, 1);
    const qs = clamp((y - this.sternD) / (this.sternS - this.sternD), 0, 1);
    const bow = -p.bowRake * (1 - qb) * (1 - qb) * smoothstep(0.5, 1, w);
    const stern = (p.sternRake * (1 - qs) * (1 - qs) - p.sternOverhang * qs) * (1 - smoothstep(0, 0.12, w));
    return this.zn(w) + bow + stern;
  }

  /** Starboard hull point on station w at height y. */
  point(w: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    const st = this.station(w);
    const yy = Math.max(y, st.D);
    return out.set(this.xOf(st, yy), yy, this.zOf(w, yy));
  }

  /** Station parameter whose surface passes through the actual z at height y. */
  wAt(z: number, y: number): number {
    let w = clamp(this.wOf(z), 0, 1);
    for (let i = 0; i < 10; i++) {
      const off = this.zOf(w, y) - this.zn(w);
      w = clamp(this.wOf(z - off), 0, 1);
    }
    return w;
  }

  /** Outer half-breadth at actual (z, y). */
  halfWidth(z: number, y: number): number {
    const w = this.wAt(z, y);
    return this.xOf(this.station(w), y);
  }

  pointAt(z: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.point(this.wAt(z, y), y, out);
  }

  /** Outward surface normal (starboard) at actual (z, y). */
  normalAt(z: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    const w = this.wAt(z, y);
    const dw = 0.004;
    const a = this.point(Math.min(1, w + dw), y);
    const b = this.point(Math.max(0, w - dw), y);
    const c = this.point(w, y + 0.05);
    const d = this.point(w, y - 0.05);
    a.sub(b);
    c.sub(d);
    return out.crossVectors(c, a).normalize();
  }

  /** Outward plan-view (XZ) normal on the starboard side at station w, height y. */
  planNormal(w: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    const dw = 0.003;
    const a = this.point(Math.min(1, w + dw), y);
    const b = this.point(Math.max(0, w - dw), y);
    return out.set(a.z - b.z, 0, -(a.x - b.x)).normalize();
  }

  /** Inner bulwark point (starboard): outer point moved inwards by t along the plan normal. */
  innerPoint(w: number, y: number, t: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.point(w, y, out);
    const n = this.planNormal(w, y);
    out.x = Math.max(0, out.x - n.x * t);
    out.z -= n.z * t;
    return out;
  }

  /** "Height-like girth" V coordinate: y above the max breadth, girth below it. */
  girthV(st: Station, s: number): number {
    if (s >= HALF_PI) return this.yOfSigma(st, s);
    const steps = 12;
    let arc = 0;
    let px = this.xOfSigma(st, s);
    let py = this.yOfSigma(st, s);
    for (let k = 1; k <= steps; k++) {
      const ss = s + ((HALF_PI - s) * k) / steps;
      const x = this.xOfSigma(st, ss);
      const y = this.yOfSigma(st, ss);
      arc += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    return st.Ym - arc;
  }
}

// ---------------------------------------------------------------------------
// Surface builders
// ---------------------------------------------------------------------------

export interface BandSpec {
  /** Top height of the band at a station (the first band starts at the keel). */
  top: (st: Station) => number;
  segs: number;
}

export interface ShellGap {
  side: 1 | -1;
  z0: number;
  z1: number;
  fromBand: number;
}

export interface ShellSpec {
  zs: number[];
  bands: BandSpec[];
  gaps?: ShellGap[];
  /** Station range to emit (default all) — used for broken hulls. */
  keep?: (i: number, r: number, side: 1 | -1) => boolean;
  tu?: number;
  tv?: number;
}

export interface ShellResult {
  bands: THREE.BufferGeometry[];
  /** Starboard grid [station][row]. */
  grid: THREE.Vector3[][];
  bandRows: number[];
  stations: Station[];
}

/** Outer planking from the keel to the sheer, split into material bands, both sides. */
export function buildShell(h: Hull, spec: ShellSpec): ShellResult {
  const tu = spec.tu ?? TILE.plankU;
  const tv = spec.tv ?? TILE.plankV;
  const N = spec.zs.length;
  const stations = spec.zs.map((z) => h.station(h.wOf(z)));
  const bandRows = [0];
  for (const b of spec.bands) bandRows.push(bandRows[bandRows.length - 1] + b.segs);
  const R = bandRows[bandRows.length - 1] + 1;
  const grid: THREE.Vector3[][] = [];
  const vco: number[][] = [];
  for (let i = 0; i < N; i++) {
    const st = stations[i];
    const yb: number[] = [st.D];
    for (const b of spec.bands) yb.push(Math.max(yb[yb.length - 1] + 1e-4, Math.min(b.top(st), st.S + 3)));
    const sb = yb.map((y, k) => (k === 0 ? 0 : h.sigmaOf(st, y)));
    const sig: number[] = [];
    for (let k = 0; k < spec.bands.length; k++) {
      const segs = spec.bands[k].segs;
      for (let s = 0; s < segs; s++) sig.push(lerp(sb[k], sb[k + 1], s / segs));
    }
    sig.push(sb[sb.length - 1]);
    const col: THREE.Vector3[] = [];
    const vc: number[] = [];
    for (const s of sig) {
      const y = h.yOfSigma(st, s);
      col.push(new THREE.Vector3(h.xOfSigma(st, s), y, h.zOf(st.w, y)));
      vc.push(h.girthV(st, s));
    }
    grid.push(col);
    vco.push(vc);
  }
  const uco: number[][] = grid.map(() => new Array<number>(R).fill(0));
  for (let r = 0; r < R; r++) {
    for (let i = 1; i < N; i++) uco[i][r] = uco[i - 1][r] + grid[i][r].distanceTo(grid[i - 1][r]);
  }
  // starboard normals over the full grid (consistent shading across band seams)
  const fpos: number[] = [];
  for (let i = 0; i < N; i++) for (let r = 0; r < R; r++) fpos.push(grid[i][r].x, grid[i][r].y, grid[i][r].z);
  const fidx: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    for (let r = 0; r < R - 1; r++) {
      const a = i * R + r;
      const b = a + 1;
      const c = (i + 1) * R + r + 1;
      const d = (i + 1) * R + r;
      fidx.push(a, b, c, a, c, d);
    }
  }
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  full.setIndex(fidx);
  full.computeVertexNormals();
  const nrm = full.attributes.normal.array as Float32Array;

  const bands: THREE.BufferGeometry[] = [];
  for (let k = 0; k < spec.bands.length; k++) {
    const r0 = bandRows[k];
    const r1 = bandRows[k + 1];
    const rr = r1 - r0 + 1;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (const side of [1, -1] as const) {
      const base = pos.length / 3;
      for (let i = 0; i < N; i++) {
        for (let r = r0; r <= r1; r++) {
          const p = grid[i][r];
          const vi = (i * R + r) * 3;
          pos.push(p.x * side, p.y, p.z);
          nor.push(nrm[vi] * side, nrm[vi + 1], nrm[vi + 2]);
          uv.push(uco[i][r] / tu, vco[i][r] / tv);
        }
      }
      for (let i = 0; i < N - 1; i++) {
        const z0 = spec.zs[i];
        const z1 = spec.zs[i + 1];
        const gap = spec.gaps?.some((g) => g.side === side && k >= g.fromBand && z0 >= g.z0 - 1e-6 && z1 <= g.z1 + 1e-6);
        if (gap) continue;
        for (let r = 0; r < rr - 1; r++) {
          if (spec.keep && !spec.keep(i, r0 + r, side)) continue;
          const a = base + i * rr + r;
          const b = a + 1;
          const c = base + (i + 1) * rr + r + 1;
          const d = base + (i + 1) * rr + r;
          if (side === 1) idx.push(a, b, c, a, c, d);
          else idx.push(a, c, b, a, d, c);
        }
      }
    }
    bands.push(fromArrays(pos, uv, idx, nor));
  }
  return { bands, grid, bandRows, stations };
}

/**
 * Inner face of the bulwarks (both sides) from `deckY` up to the sheer, offset inwards by t.
 * Returns the geometry plus the inner outline at deck level and at the sheer (starboard).
 */
export function buildInnerBulwark(
  h: Hull,
  zs: number[],
  deckY: number,
  t: number,
  segs = 2,
  gaps: Array<{ side: 1 | -1; z0: number; z1: number }> = [],
  topOffset = 0,
): { geo: THREE.BufferGeometry; deck: THREE.Vector3[]; top: THREE.Vector3[] } {
  const N = zs.length;
  const R = segs + 1;
  const pts: THREE.Vector3[][] = [];
  for (const z of zs) {
    const w = h.wOf(z);
    const st = h.station(w);
    const col: THREE.Vector3[] = [];
    for (let r = 0; r < R; r++) {
      const y = lerp(deckY, st.S + topOffset, r / segs);
      col.push(h.innerPoint(w, y, t));
    }
    pts.push(col);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1] as const) {
    const base = pos.length / 3;
    let u = 0;
    for (let i = 0; i < N; i++) {
      if (i > 0) u += pts[i][0].distanceTo(pts[i - 1][0]);
      for (let r = 0; r < R; r++) {
        const p = pts[i][r];
        pos.push(p.x * side, p.y, p.z);
        uv.push(u / TILE.plankU, p.y / TILE.plankV);
      }
    }
    for (let i = 0; i < N - 1; i++) {
      if (gaps.some((g) => g.side === side && zs[i] >= g.z0 - 1e-6 && zs[i + 1] <= g.z1 + 1e-6)) continue;
      for (let r = 0; r < R - 1; r++) {
        const a = base + i * R + r;
        const b = a + 1;
        const c = base + (i + 1) * R + r + 1;
        const d = base + (i + 1) * R + r;
        if (side === 1) idx.push(a, c, b, a, d, c);
        else idx.push(a, b, c, a, c, d);
      }
    }
  }
  return {
    geo: fromArrays(pos, uv, idx),
    deck: pts.map((c) => c[0].clone()),
    top: pts.map((c) => c[R - 1].clone()),
  };
}

/**
 * Flat deck at height y between the inner outlines (starboard outline mirrored). Columns sit at
 * the given insets from the bulwarks (plus the centre line); `shades` darkens each inset column
 * (baked contact occlusion along the bulwarks).
 */
export function buildDeck(outline: THREE.Vector3[], y: number, insets: number[] = [0, 0.6], shades: number[] = [0.66, 0.94]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const N = outline.length;
  const xs: Array<(half: number) => number> = [];
  const ks: number[] = [];
  for (let k = 0; k < insets.length; k++) {
    const ins = insets[k];
    xs.push((h) => -Math.max(0, h - ins));
    ks.push(shades[k] ?? 1);
  }
  xs.push(() => 0);
  ks.push(1);
  for (let k = insets.length - 1; k >= 0; k--) {
    const ins = insets[k];
    xs.push((h) => Math.max(0, h - ins));
    ks.push(shades[k] ?? 1);
  }
  const cols = xs.length;
  for (let i = 0; i < N; i++) {
    const p = outline[i];
    for (let c = 0; c < cols; c++) {
      const x = xs[c](p.x);
      pos.push(x, y, p.z);
      uv.push(p.z / TILE.plankU, x / TILE.plankV);
      col.push(ks[c], ks[c], ks[c]);
    }
  }
  for (let i = 0; i < N - 1; i++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = i * cols + c;
      const b = a + 1;
      const cc = (i + 1) * cols + c + 1;
      const d = (i + 1) * cols + c;
      idx.push(a, cc, b, a, d, cc);
    }
  }
  const normals: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) normals.push(0, 1, 0);
  const g = fromArrays(pos, uv, idx, normals);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Transom: closes the stern station between port and starboard, split by shell bands. */
export function buildTransom(shell: ShellResult): THREE.BufferGeometry[] {
  const col = shell.grid[0];
  const out: THREE.BufferGeometry[] = [];
  for (let k = 0; k < shell.bandRows.length - 1; k++) {
    const r0 = shell.bandRows[k];
    const r1 = shell.bandRows[k + 1];
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let r = r0; r <= r1; r++) {
      const p = col[r];
      pos.push(-p.x, p.y, p.z, p.x, p.y, p.z);
      uv.push(-p.x / TILE.plankU, p.y / TILE.plankV, p.x / TILE.plankU, p.y / TILE.plankV);
    }
    for (let r = 0; r < r1 - r0; r++) {
      const L0 = r * 2;
      const R0 = L0 + 1;
      const L1 = L0 + 2;
      const R1 = L0 + 3;
      idx.push(L0, L1, R1, L0, R1, R0);
    }
    out.push(fromArrays(pos, uv, idx));
  }
  return out;
}

/** Sorted unique station list: regular spacing plus required stations. */
export function stationList(z0: number, z1: number, segments: Array<[number, number]>, extra: number[] = []): number[] {
  const regular: number[] = [];
  let z = z0;
  while (z < z1 - 1e-6) {
    regular.push(Math.round(z * 1000) / 1000);
    const seg = segments.find(([until]) => z < until - 1e-6) ?? segments[segments.length - 1];
    z += seg[1];
  }
  const req = [z0, z1, ...extra.filter((e) => e > z0 && e < z1)];
  // regular stations too close to a required one are dropped
  const kept = regular.filter((v) => !req.some((r) => r !== v && Math.abs(r - v) < 0.12));
  return Array.from(new Set([...kept, ...req])).sort((a, b) => a - b);
}
