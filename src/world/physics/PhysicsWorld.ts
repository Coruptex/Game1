import { clamp } from '../../utils/math';
import {
  createGroundInfo,
  type BodyState,
  type BoxCollider,
  type CircleCollider,
  type Collider,
  type GroundInfo,
  type GroundSampler,
  type Platform,
} from './PhysicsTypes';

/** Tunables for character/world collision. */
export const PhysicsConfig = {
  /** Max height a character can step up in one move (onto docks, stairs). */
  stepUp: 0.55,
  /** Max drop before a ledge blocks movement (characters never fall off docks or cliffs). */
  stepDown: 0.95,
  /** Terrain steeper than this (rise/run) is not walkable. */
  maxSlope: 0.95,
  /** Water deeper than this blocks movement. */
  maxWadeDepth: 0.85,
  /** Obstacles lower than this above the feet are stepped over. */
  stepOverHeight: 0.3,
  /** Max sub-step length for movement resolution. */
  subStep: 0.2,
};

class SpatialHash<T> {
  private readonly cells = new Map<number, T[]>();

  constructor(private readonly cellSize: number) {}

  private key(ix: number, iz: number): number {
    return ((ix + 2048) << 12) | (iz + 2048);
  }

  insert(item: T, minX: number, minZ: number, maxX: number, maxZ: number): void {
    const s = this.cellSize;
    for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
      for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) {
          list = [];
          this.cells.set(k, list);
        }
        list.push(item);
      }
    }
  }

  remove(item: T, minX: number, minZ: number, maxX: number, maxZ: number): void {
    const s = this.cellSize;
    for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
      for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (!list) continue;
        const i = list.indexOf(item);
        if (i >= 0) list.splice(i, 1);
      }
    }
  }

  query(minX: number, minZ: number, maxX: number, maxZ: number, out: Set<T>): Set<T> {
    out.clear();
    const s = this.cellSize;
    for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
      for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (list) for (const it of list) out.add(it);
      }
    }
    return out;
  }
}

function colliderBounds(c: Collider): [number, number, number, number] {
  if (c.type === 'circle') return [c.x - c.radius, c.z - c.radius, c.x + c.radius, c.z + c.radius];
  const ex = Math.abs(c.halfX * Math.cos(c.yaw)) + Math.abs(c.halfZ * Math.sin(c.yaw));
  const ez = Math.abs(c.halfX * Math.sin(c.yaw)) + Math.abs(c.halfZ * Math.cos(c.yaw));
  return [c.x - ex, c.z - ez, c.x + ex, c.z + ez];
}

function platformBounds(p: Platform): [number, number, number, number] {
  const ex = Math.abs(p.halfX * Math.cos(p.yaw)) + Math.abs(p.halfZ * Math.sin(p.yaw));
  const ez = Math.abs(p.halfX * Math.sin(p.yaw)) + Math.abs(p.halfZ * Math.cos(p.yaw));
  return [p.x - ex, p.z - ez, p.x + ex, p.z + ez];
}

export interface MoveResult {
  /** Fraction of the requested horizontal displacement that was applied (0..1). */
  moved: number;
  blocked: boolean;
  ground: GroundInfo;
}

/**
 * Static world collision: terrain heightfield + platforms + obstacles.
 * Characters are kinematic and always snapped to the ground (no falling / jumping yet).
 */
export class PhysicsWorld {
  private readonly colliders = new SpatialHash<Collider>(8);
  private readonly platforms = new SpatialHash<Platform>(8);
  private readonly allColliders = new Set<Collider>();
  private readonly allPlatforms: Platform[] = [];
  private readonly qColliders = new Set<Collider>();
  private readonly qPlatforms = new Set<Platform>();
  private readonly gTmp = createGroundInfo();
  private readonly gTmp2 = createGroundInfo();

  constructor(public ground: GroundSampler) {}

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  addCollider<T extends Collider>(c: T): T {
    if (c.type === 'box') {
      c.cos = Math.cos(c.yaw);
      c.sin = Math.sin(c.yaw);
    }
    const [a, b, cc, d] = colliderBounds(c);
    this.colliders.insert(c, a, b, cc, d);
    this.allColliders.add(c);
    return c;
  }

  removeCollider(c: Collider): void {
    if (!this.allColliders.has(c)) return;
    const [a, b, cc, d] = colliderBounds(c);
    this.colliders.remove(c, a, b, cc, d);
    this.allColliders.delete(c);
  }

  addCircle(x: number, z: number, radius: number, yMin: number, yMax: number, tag?: string): CircleCollider {
    return this.addCollider({ type: 'circle', x, z, radius, yMin, yMax, tag });
  }

  addBox(x: number, z: number, halfX: number, halfZ: number, yaw: number, yMin: number, yMax: number, tag?: string): BoxCollider {
    return this.addCollider({ type: 'box', x, z, halfX, halfZ, yaw, yMin, yMax, tag });
  }

  addPlatform(p: Platform): Platform {
    p.cos = Math.cos(p.yaw);
    p.sin = Math.sin(p.yaw);
    const [a, b, c, d] = platformBounds(p);
    this.platforms.insert(p, a, b, c, d);
    this.allPlatforms.push(p);
    return p;
  }

  get colliderCount(): number {
    return this.allColliders.size;
  }

  get platformCount(): number {
    return this.allPlatforms.length;
  }

  // -------------------------------------------------------------------------
  // Ground queries
  // -------------------------------------------------------------------------

  /** Height of a platform top at (x,z), or NaN if (x,z) is outside its footprint. */
  platformHeightAt(p: Platform, x: number, z: number): number {
    const dx = x - p.x;
    const dz = z - p.z;
    // world -> local (inverse yaw rotation)
    const lx = dx * p.cos! - dz * p.sin!;
    const lz = dx * p.sin! + dz * p.cos!;
    if (Math.abs(lx) > p.halfX || Math.abs(lz) > p.halfZ) return NaN;
    return p.height + (p.slope ?? 0) * lz;
  }

  /**
   * Ground under (x, z) for a body whose feet are at `refY`. Platforms whose top is within
   * step-up range win over the terrain; platforms far above are reported via `ceilingBlocked`.
   */
  groundAt(x: number, z: number, refY: number, out: GroundInfo = createGroundInfo(), bodyHeight = 1.8): GroundInfo & { ceilingBlocked?: boolean } {
    const g = this.ground;
    const terrainH = g.heightAt(x, z);
    let best = terrainH;
    let onPlatform = false;
    let surface = g.surfaceAt(x, z);
    let ceilingBlocked = false;

    this.platforms.query(x, z, x, z, this.qPlatforms);
    for (const p of this.qPlatforms) {
      const h = this.platformHeightAt(p, x, z);
      if (Number.isNaN(h)) continue;
      if (h <= refY + PhysicsConfig.stepUp + 0.001) {
        if (h > best) {
          best = h;
          onPlatform = true;
          surface = p.surface;
        }
      } else if (h - p.thickness < refY + bodyHeight) {
        ceilingBlocked = true;
      }
    }

    const water = g.waterLevelAt(x, z);
    const waterDepth = onPlatform ? 0 : Math.max(0, water - best);
    const slope = onPlatform ? 0 : g.slopeAt(x, z);
    out.height = best;
    out.onPlatform = onPlatform;
    out.surface = waterDepth > 0.12 ? 'water' : surface;
    out.slope = slope;
    out.waterDepth = waterDepth;
    out.walkable = !ceilingBlocked && slope <= PhysicsConfig.maxSlope && waterDepth <= PhysicsConfig.maxWadeDepth;
    (out as GroundInfo & { ceilingBlocked?: boolean }).ceilingBlocked = ceilingBlocked;
    return out;
  }

  /** Whether a body standing at height `fromY` can stand at (x, z). */
  canStand(x: number, z: number, fromY: number, bodyHeight: number, out = this.gTmp2): boolean {
    const gi = this.groundAt(x, z, fromY, out, bodyHeight);
    if (!gi.walkable) return false;
    if (gi.height - fromY > PhysicsConfig.stepUp) return false;
    if (fromY - gi.height > PhysicsConfig.stepDown) return false;
    return true;
  }

  // -------------------------------------------------------------------------
  // Movement
  // -------------------------------------------------------------------------

  /**
   * Moves a body horizontally by (dx, dz) with sub-stepping, wall sliding and obstacle push-out,
   * then snaps it to the ground. Mutates `body`.
   */
  moveBody(body: BodyState, dx: number, dz: number, out?: MoveResult): MoveResult {
    const res = out ?? { moved: 0, blocked: false, ground: createGroundInfo() };
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / PhysicsConfig.subStep));
    const sx = dx / steps;
    const sz = dz / steps;
    let movedDist = 0;
    let blocked = false;
    const stepLen = dist / steps;

    for (let i = 0; i < steps; i++) {
      const ox = body.x;
      const oz = body.z;
      if (this.canStand(ox + sx, oz + sz, body.y, body.height)) {
        body.x = ox + sx;
        body.z = oz + sz;
      } else if (Math.abs(sx) > 1e-6 && this.canStand(ox + sx, oz, body.y, body.height)) {
        body.x = ox + sx;
        blocked = true;
      } else if (Math.abs(sz) > 1e-6 && this.canStand(ox, oz + sz, body.y, body.height)) {
        body.z = oz + sz;
        blocked = true;
      } else {
        blocked = true;
        continue;
      }

      this.resolveObstacles(body);
      // Reject pushes that shove the body somewhere it cannot stand.
      if (!this.canStand(body.x, body.z, body.y, body.height)) {
        body.x = ox;
        body.z = oz;
        blocked = true;
        continue;
      }
      const gi = this.groundAt(body.x, body.z, body.y, this.gTmp, body.height);
      body.y = gi.height;
      movedDist += Math.hypot(body.x - ox, body.z - oz);
    }

    this.groundAt(body.x, body.z, body.y, res.ground, body.height);
    // Settle onto the ground (handles the start position and tiny numeric drift).
    if (Math.abs(res.ground.height - body.y) < PhysicsConfig.stepDown + PhysicsConfig.stepUp) body.y = res.ground.height;
    res.moved = dist > 0 ? clamp(movedDist / (stepLen * steps), 0, 1) : 0;
    res.blocked = blocked;
    return res;
  }

  /** Pushes a body out of overlapping obstacles (2 relaxation passes). */
  resolveObstacles(body: BodyState): void {
    const r = body.radius;
    const feet = body.y + PhysicsConfig.stepOverHeight;
    const head = body.y + body.height;
    for (let pass = 0; pass < 2; pass++) {
      this.colliders.query(body.x - r, body.z - r, body.x + r, body.z + r, this.qColliders);
      for (const c of this.qColliders) {
        if (c.yMax <= feet || c.yMin >= head) continue;
        if (c.type === 'circle') {
          const dx = body.x - c.x;
          const dz = body.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = r + c.radius;
          if (d < min) {
            if (d < 1e-5) {
              body.x += min;
            } else {
              const push = (min - d) / d;
              body.x += dx * push;
              body.z += dz * push;
            }
          }
        } else {
          this.pushOutOfBox(body, c, r);
        }
      }
    }
  }

  private pushOutOfBox(body: BodyState, c: BoxCollider, r: number): void {
    const cos = c.cos!;
    const sin = c.sin!;
    const dx = body.x - c.x;
    const dz = body.z - c.z;
    // world -> local
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const qx = clamp(lx, -c.halfX, c.halfX);
    const qz = clamp(lz, -c.halfZ, c.halfZ);
    let ox = lx - qx;
    let oz = lz - qz;
    const d = Math.hypot(ox, oz);
    let nlx: number;
    let nlz: number;
    if (d > 1e-6) {
      if (d >= r) return;
      const push = r - d;
      ox /= d;
      oz /= d;
      nlx = lx + ox * push;
      nlz = lz + oz * push;
    } else {
      // centre inside the box: push out along the axis of least penetration
      const px = c.halfX - Math.abs(lx);
      const pz = c.halfZ - Math.abs(lz);
      if (px < pz) {
        nlx = Math.sign(lx || 1) * (c.halfX + r);
        nlz = lz;
      } else {
        nlx = lx;
        nlz = Math.sign(lz || 1) * (c.halfZ + r);
      }
    }
    // local -> world
    body.x = c.x + nlx * cos + nlz * sin;
    body.z = c.z - nlx * sin + nlz * cos;
  }

  // -------------------------------------------------------------------------
  // Sight / overlap queries
  // -------------------------------------------------------------------------

  /** True if nothing tall blocks the segment between two points (used by AI and lock-on). */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const minX = Math.min(ax, bx);
    const minZ = Math.min(az, bz);
    const maxX = Math.max(ax, bx);
    const maxZ = Math.max(az, bz);
    this.colliders.query(minX, minZ, maxX, maxZ, this.qColliders);
    const sightY = Math.min(ay, by) + 0.4;
    for (const c of this.qColliders) {
      if (c.blocksSight === false) continue;
      if (c.yMax < sightY || c.yMin > Math.max(ay, by)) continue;
      if (c.type === 'circle') {
        if (segmentCircle(ax, az, bx, bz, c.x, c.z, c.radius * 0.9)) return false;
      } else if (segmentBox(ax, az, bx, bz, c)) {
        return false;
      }
    }
    // terrain occlusion
    const len = Math.hypot(bx - ax, bz - az);
    const samples = Math.ceil(len / 2);
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = ay + (by - ay) * t;
      if (this.ground.heightAt(x, z) > y + 0.2) return false;
    }
    return true;
  }

  /** Colliders overlapping a circle (for gameplay queries). */
  queryColliders(x: number, z: number, radius: number): Collider[] {
    this.colliders.query(x - radius, z - radius, x + radius, z + radius, this.qColliders);
    return Array.from(this.qColliders);
  }
}

function segmentCircle(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, r: number): boolean {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((cx - ax) * abx + (cz - az) * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = ax + abx * t - cx;
  const pz = az + abz * t - cz;
  return px * px + pz * pz < r * r;
}

function segmentBox(ax: number, az: number, bx: number, bz: number, c: BoxCollider): boolean {
  const cos = c.cos!;
  const sin = c.sin!;
  const toLocal = (x: number, z: number): [number, number] => {
    const dx = x - c.x;
    const dz = z - c.z;
    return [dx * cos - dz * sin, dx * sin + dz * cos];
  };
  const [x0, z0] = toLocal(ax, az);
  const [x1, z1] = toLocal(bx, bz);
  // Liang-Barsky clip against the local AABB
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const p = [-dx, dx, -dz, dz];
  const q = [x0 + c.halfX, c.halfX - x0, z0 + c.halfZ, c.halfZ - z0];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}
