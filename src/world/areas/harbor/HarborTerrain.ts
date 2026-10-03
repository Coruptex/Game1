import * as THREE from 'three';
import { Noise2D } from '../../../utils/noise';
import { clamp, lerp, smoothstep } from '../../../utils/math';
import { HarborLayout, type PathDef } from './HarborLayout';
import type { SurfaceType } from '../../physics/PhysicsTypes';

const noise = new Noise2D(777);

/** Signed distance to a closed polygon on XZ (positive inside). */
export function sdPolygon(px: number, pz: number, pts: readonly [number, number][]): number {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const zi = pts[i][1];
    const xj = pts[j][0];
    const zj = pts[j][1];
    const ex = xi - xj;
    const ez = zi - zj;
    const wx = px - xj;
    const wz = pz - zj;
    const t = clamp((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1);
    const dx = wx - ex * t;
    const dz = wz - ez * t;
    d = Math.min(d, dx * dx + dz * dz);
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside ? Math.sqrt(d) : -Math.sqrt(d);
}

export interface PathHit {
  dist: number;
  h: number;
  path: PathDef | null;
  /** Distance along the whole path (m), useful for laying stones / stairs. */
  along: number;
}

/** Closest point on any path. */
export function nearestPath(x: number, z: number, paths: readonly PathDef[], out: PathHit): PathHit {
  out.dist = Infinity;
  out.h = 0;
  out.path = null;
  out.along = 0;
  for (const p of paths) {
    let acc = 0;
    for (let i = 0; i < p.points.length - 1; i++) {
      const a = p.points[i];
      const b = p.points[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const len = Math.sqrt(len2);
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / len2, 0, 1);
      const cx = a.x + abx * t;
      const cz = a.z + abz * t;
      const d = Math.hypot(x - cx, z - cz);
      if (d < out.dist) {
        out.dist = d;
        // smooth the height profile at segment joints (smoothstep inside each segment)
        out.h = lerp(a.h, b.h, t * t * (3 - 2 * t) * 0.5 + t * 0.5);
        out.path = p;
        out.along = acc + t * len;
      }
      acc += len;
    }
  }
  return out;
}

function rectMask(x: number, z: number, r: { minX: number; maxX: number; minZ: number; maxZ: number }, soft: number): number {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  const d = Math.hypot(dx, dz);
  return 1 - smoothstep(0, soft, d);
}

/** Terrain shape, surfaces and colours for the harbour hub. */
export class HarborTerrainShape {
  private readonly hit: PathHit = { dist: 0, h: 0, path: null, along: 0 };
  private readonly L = HarborLayout;

  /** 0..1 weight of the east beach zone. */
  beachZone(x: number, z: number): number {
    return smoothstep(8, 22, x) * smoothstep(-36, -26, z);
  }

  jungleEdge(x: number): number {
    return this.L.jungleEdgeZ + noise.noise(x * 0.045, 3.1) * 3.2;
  }

  /** 0..1 jungle plateau weight. */
  jungleZone(x: number, z: number): number {
    const zEdge = this.jungleEdge(x);
    return smoothstep(zEdge + 1.2, zEdge - 2.4, z);
  }

  /** Distance to the river centre line and the parameter along it. */
  riverInfo(x: number, z: number): { dist: number; t: number } {
    const pts = this.L.river.points;
    let best = Infinity;
    let bestT = 0;
    let total = 0;
    const lens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      lens.push(l);
      total += l;
    }
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const abx = bx - ax;
      const abz = bz - az;
      const t = clamp(((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz), 0, 1);
      const d = Math.hypot(x - (ax + abx * t), z - (az + abz * t));
      if (d < best) {
        best = d;
        bestT = (acc + t * lens[i]) / total;
      }
      acc += lens[i];
    }
    return { dist: best, t: bestT };
  }

  /** Water surface height at (x, z): the river inside its channel, the sea elsewhere. */
  waterLevelAt(x: number, z: number): number {
    const R = this.L.river;
    if (z < -42 && x > 20) {
      const r = this.riverInfo(x, z);
      if (r.dist < R.halfWidth + 1.4) return R.level;
    }
    return this.L.seaLevel;
  }

  private carveRiver(x: number, z: number, h: number): number {
    const R = this.L.river;
    if (x < 18 || z > -36 || z < -122) return h;
    const r = this.riverInfo(x, z);
    const half = R.halfWidth;
    const bankTop = Math.max(h, R.level + 0.5);
    if (r.dist > half + 4) return h;
    // gently widen near the source
    if (r.dist <= half) return lerp(R.bed, R.level - 0.22, smoothstep(0, half, r.dist) ** 1.5);
    if (r.dist <= half + 1.3) return lerp(R.level - 0.22, bankTop, smoothstep(half, half + 1.3, r.dist));
    return lerp(bankTop, h, smoothstep(half + 1.3, half + 4, r.dist));
  }

  coastDistance(x: number, z: number): number {
    return sdPolygon(x, z, this.L.coast) + noise.fbm(x * 0.05, z * 0.05, 2) * 2.2;
  }

  private landLevel(x: number, z: number): number {
    const L = this.L;
    let h = 2.3 + noise.fbm(x * 0.03, z * 0.03, 3) * 0.35;

    // East beach lowers gently towards the sea.
    const beach = this.beachZone(x, z);
    h = lerp(h, 1.2 + noise.noise(x * 0.06, z * 0.06) * 0.12, beach * smoothstep(12, 34, x));

    // Central plaza.
    const dp = Math.hypot(x - L.plaza.x, z - L.plaza.z);
    h = lerp(h, L.plaza.height, 1 - smoothstep(L.plaza.radius - 4, L.plaza.radius + 7, dp));

    // Jungle plateau with an irregular cliff edge.
    const jw = this.jungleZone(x, z);
    if (jw > 0) {
      const jh = L.jungleHeight + noise.fbm(x * 0.035, z * 0.035, 3) * 1.1;
      h = lerp(h, jh, jw);
    }

    // West cliffs (dungeon side).
    const xc = L.westCliffX + noise.noise(z * 0.05, 9.7) * 2.5;
    const ww = smoothstep(xc + 1.2, xc - 2.2, x);
    if (ww > 0) {
      const wh = 12.5 + noise.fbm(x * 0.05, z * 0.05, 3) * 2.5;
      h = Math.max(h, lerp(h, wh, ww));
    }

    // Dungeon courtyard carved into the cliffs.
    const cm = rectMask(x, z, L.dungeonCourt, 1.4);
    if (cm > 0) h = lerp(h, L.dungeonCourt.height, cm);

    // Mountain to the north (backdrop, unwalkable).
    const mz = -118 + noise.noise(x * 0.03, 5.5) * 4;
    if (z < mz + 6) {
      let m = 9.5 + Math.max(0, mz - z) * 0.85 + noise.ridged(x * 0.02, z * 0.02, 4) * 12 * smoothstep(mz, mz - 30, z);
      const pk = L.mountainPeak;
      const dpk = Math.hypot(x - pk.x, z - pk.z);
      const cone = pk.height * Math.pow(Math.max(0, 1 - dpk / 150), 1.5) + noise.ridged(x * 0.035, z * 0.035, 3) * 9;
      m = Math.max(m, cone);
      const f = L.fortress;
      const fc = Math.cos(-f.yaw);
      const fs = Math.sin(-f.yaw);
      const fx = (x - f.x) * fc + (z - f.z) * fs;
      const fz = -(x - f.x) * fs + (z - f.z) * fc;
      const fe = Math.hypot(fx / f.plateau.halfX, fz / f.plateau.halfZ);
      m = lerp(m, f.height, 1 - smoothstep(1, 1.3, fe));
      const blend = smoothstep(mz + 6, mz - 1, z);
      h = Math.max(h, lerp(h, m, blend));
    }

    // Gate terrace (after the mountain so it stays flat).
    const tm = rectMask(x, z, L.gateTerrace, 1.3);
    if (tm > 0) h = lerp(h, L.gateTerrace.height, tm);

    return h;
  }

  private seabed(x: number, z: number, dOut: number): number {
    const beach = this.beachZone(x, z);
    const k = lerp(0.12, 0.045, beach);
    let s = 0.0 - 0.35 * smoothstep(0, 3, dOut) - dOut * k;
    s -= Math.max(0, dOut - lerp(16, 40, beach)) * 0.2;
    s += noise.fbm(x * 0.09, z * 0.09, 3) * 0.3;
    // Ship basin & channel to the open sea.
    const sh = this.L.ship;
    const ex = (x - sh.x) / 10;
    const ez = (z - sh.z) / 24;
    const basin = 1 - smoothstep(0.6, 1.25, Math.sqrt(ex * ex + ez * ez));
    s = Math.min(s, lerp(s, -6.5, basin));
    return Math.max(s, -14);
  }

  /** Final terrain height. */
  height(x: number, z: number): number {
    const L = this.L;
    const d = this.coastDistance(x, z);
    let h: number;
    if (d >= 0) {
      const beach = this.beachZone(x, z);
      const shoreWidth = lerp(3.2, 16, beach);
      const land = this.carveRiver(x, z, this.landLevel(x, z));
      h = lerp(0.0, land, smoothstep(0, shoreWidth, d));
    } else {
      h = this.seabed(x, z, -d);
    }

    // Stone quay (harbour wall) - sharp seaward edge, soft landward blend.
    const q = L.quay;
    if (x > q.minX - 6 && x < q.maxX + 6 && z > q.minZ - 7 && z <= q.maxZ + 0.01) {
      const wx = smoothstep(q.minX - 4, q.minX, x) * (1 - smoothstep(q.maxX, q.maxX + 4, x));
      const wz = smoothstep(q.minZ - 6, q.minZ, z);
      h = lerp(h, q.height, wx * wz);
    }

    // Paths flatten the terrain towards their own height profile.
    nearestPath(x, z, L.paths, this.hit);
    if (this.hit.path) {
      const half = this.hit.path.width / 2;
      const w = 1 - smoothstep(half, half + 2.6, this.hit.dist);
      if (w > 0) h = lerp(h, this.hit.h, w);
    }
    return h;
  }

  /** Path influence (1 on the paved part) and the path itself. */
  pathInfo(x: number, z: number): PathHit {
    return nearestPath(x, z, this.L.paths, this.hit);
  }

  surfaceAt(x: number, z: number, h: number, slope: number): SurfaceType {
    const p = this.pathInfo(x, z);
    if (p.path && p.dist < p.path.width / 2) return p.path.paved ? 'stone' : 'dirt';
    const L = this.L;
    if (Math.hypot(x - L.plaza.x, z - L.plaza.z) < L.plaza.radius - 3) return 'stone';
    if (x > L.quay.minX && x < L.quay.maxX && z > L.quay.minZ + 2 && z < L.quay.maxZ) return 'stone';
    if (slope > 0.85) return 'rock';
    if (h < 1.05 || (this.beachZone(x, z) > 0.6 && h < 2.0)) return 'sand';
    if (this.jungleZone(x, z) > 0.5) return 'jungle';
    return 'grass';
  }

  /** Painterly vertex colour for the terrain. */
  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    const n = noise.fbm(x * 0.07, z * 0.07, 3);
    const n2 = noise.noise(x * 0.31, z * 0.31);
    const L = this.L;

    // --- base: sand -------------------------------------------------------
    const sand = tmp1.setHex(0xead6a2).lerp(tmp2.setHex(0xe0c48a), n * 0.5 + 0.5);
    // wet band at the waterline
    const wet = 1 - smoothstep(0.05, 0.45, Math.abs(h - 0.12));
    sand.lerp(tmp2.setHex(0xbfa274), wet * 0.65);
    if (h < 0) {
      // underwater: slightly cooler, with darker patches (seagrass / rocks)
      sand.lerp(tmp2.setHex(0xc9c296), 0.4);
      const grassPatch = smoothstep(0.25, 0.6, noise.fbm(x * 0.05 + 40, z * 0.05, 3));
      sand.lerp(tmp2.setHex(0x6f8a52), grassPatch * smoothstep(-0.6, -2.5, h) * 0.55);
    }
    out.copy(sand);

    // --- grass ------------------------------------------------------------
    const beach = this.beachZone(x, z);
    const grassStart = lerp(0.9, 1.75, beach) + n2 * 0.15;
    const gW = smoothstep(grassStart, grassStart + 0.45, h);
    if (gW > 0) {
      const grass = tmp3.setHex(0x5a9634).lerp(tmp2.setHex(0x95c650), smoothstep(-0.3, 0.6, n));
      grass.lerp(tmp2.setHex(0xb5b062), (1 - smoothstep(0, 0.6, h - grassStart)) * 0.6);
      out.lerp(grass, gW);
    }

    // --- jungle floor ------------------------------------------------------
    const jw = this.jungleZone(x, z);
    if (jw > 0) {
      const jungle = tmp3.setHex(0x3f6a25).lerp(tmp2.setHex(0x587f2c), smoothstep(-0.4, 0.5, n));
      jungle.lerp(tmp2.setHex(0x6b5b35), smoothstep(0.35, 0.8, noise.fbm(x * 0.11 + 7, z * 0.11, 2)) * 0.55);
      out.lerp(jungle, jw);
    }

    // --- plaza / quay packed earth & stone ----------------------------------
    const dp = Math.hypot(x - L.plaza.x, z - L.plaza.z);
    const plazaW = 1 - smoothstep(L.plaza.radius - 5, L.plaza.radius + 1, dp);
    if (plazaW > 0) out.lerp(tmp3.setHex(0x9b8c68).lerp(tmp2.setHex(0x857a5c), n * 0.5 + 0.5), plazaW * 0.85);
    const q = L.quay;
    if (x > q.minX && x < q.maxX && z > q.minZ && z < q.maxZ + 0.6) {
      out.lerp(tmp3.setHex(0xa59c82), 0.85);
    }

    // --- paths ---------------------------------------------------------------
    const p = this.pathInfo(x, z);
    if (p.path) {
      const half = p.path.width / 2;
      const pw = 1 - smoothstep(half - 0.2, half + 1.4, p.dist);
      if (pw > 0) {
        const col = p.path.paved ? tmp3.setHex(0x8f7f62) : tmp3.setHex(0x8a6a44);
        out.lerp(col, pw * 0.9);
      }
    }

    // --- river bed: pebbly, darker -----------------------------------------------
    if (x > 18 && z < -36) {
      const r = this.riverInfo(x, z);
      const rw = 1 - smoothstep(L.river.halfWidth - 0.5, L.river.halfWidth + 1.2, r.dist);
      if (rw > 0 && h < L.river.level + 0.3) {
        out.lerp(tmp3.setHex(0x8c8a6e).lerp(tmp2.setHex(0x6d6b56), smoothstep(-0.4, 0.5, n2)), rw * 0.85);
      }
    }

    // --- rock on steep slopes --------------------------------------------------
    const rw = smoothstep(0.65, 1.05, slope);
    if (rw > 0) {
      const rock = tmp3.setHex(0x8e887a).lerp(tmp2.setHex(0x6a665b), smoothstep(-0.5, 0.6, n2));
      if (jw > 0.3 || h > 8) rock.lerp(tmp2.setHex(0x5f7a3a), 0.25 * (1 - smoothstep(1.0, 1.6, slope)));
      out.lerp(rock, rw);
    }

    // --- mountain heights: drier, lighter green/grey -----------------------------
    if (h > 12) {
      const mw = smoothstep(12, 30, h);
      out.lerp(tmp3.setHex(0x6f8f4a).lerp(tmp2.setHex(0x8e8c80), smoothstep(40, 80, h)), mw * (1 - rw * 0.5));
    }

    // subtle large-scale value variation
    out.multiplyScalar(0.94 + n * 0.08);
  }
}

const tmp1 = new THREE.Color();
const tmp2 = new THREE.Color();
const tmp3 = new THREE.Color();
