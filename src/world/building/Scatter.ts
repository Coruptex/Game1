import type { Rng } from '../../utils/random';

export interface KeepOut {
  x: number;
  z: number;
  r: number;
}

/**
 * Keep-out registry: places where scattered decoration must not appear (paths, docks, POIs,
 * buildings). Shared by every scatter pass of an area.
 */
export class KeepOutMap {
  private readonly circles: KeepOut[] = [];
  private readonly segments: Array<{ ax: number; az: number; bx: number; bz: number; r: number }> = [];

  circle(x: number, z: number, r: number): void {
    this.circles.push({ x, z, r });
  }

  segment(ax: number, az: number, bx: number, bz: number, r: number): void {
    this.segments.push({ ax, az, bx, bz, r });
  }

  rect(minX: number, minZ: number, maxX: number, maxZ: number): void {
    // approximate with a fat segment along the long axis
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w > d) this.segment(minX, (minZ + maxZ) / 2, maxX, (minZ + maxZ) / 2, d / 2);
    else this.segment((minX + maxX) / 2, minZ, (minX + maxX) / 2, maxZ, w / 2);
  }

  blocked(x: number, z: number, margin = 0): boolean {
    for (const c of this.circles) {
      const dx = x - c.x;
      const dz = z - c.z;
      const r = c.r + margin;
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (const s of this.segments) {
      const abx = s.bx - s.ax;
      const abz = s.bz - s.az;
      const len2 = abx * abx + abz * abz;
      let t = len2 > 0 ? ((x - s.ax) * abx + (z - s.az) * abz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = s.ax + abx * t - x;
      const pz = s.az + abz * t - z;
      const r = s.r + margin;
      if (px * px + pz * pz < r * r) return true;
    }
    return false;
  }
}

/**
 * Dart-throwing scatter with a minimum spacing (blue-noise-ish distribution, looks natural).
 * `accept` decides per candidate (terrain masks, slope, keep-outs) and may return a density 0..1.
 */
export function scatter(
  rng: Rng,
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number },
  target: number,
  minDist: number,
  accept: (x: number, z: number) => number | boolean,
  maxTries = target * 30,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  const cell = minDist / Math.SQRT2;
  const grid = new Map<number, Array<{ x: number; z: number }>>();
  const key = (ix: number, iz: number) => ((ix + 4096) << 13) | (iz + 4096);
  let tries = 0;
  while (out.length < target && tries < maxTries) {
    tries++;
    const x = rng.range(bounds.minX, bounds.maxX);
    const z = rng.range(bounds.minZ, bounds.maxZ);
    const a = accept(x, z);
    if (a === false || (typeof a === 'number' && rng.next() > a)) continue;
    const ix = Math.floor(x / cell);
    const iz = Math.floor(z / cell);
    let ok = true;
    for (let gx = ix - 2; gx <= ix + 2 && ok; gx++) {
      for (let gz = iz - 2; gz <= iz + 2 && ok; gz++) {
        const list = grid.get(key(gx, gz));
        if (!list) continue;
        for (const p of list) {
          const dx = p.x - x;
          const dz = p.z - z;
          if (dx * dx + dz * dz < minDist * minDist) {
            ok = false;
            break;
          }
        }
      }
    }
    if (!ok) continue;
    const p = { x, z };
    out.push(p);
    const k = key(ix, iz);
    let list = grid.get(k);
    if (!list) {
      list = [];
      grid.set(k, list);
    }
    list.push(p);
  }
  return out;
}
