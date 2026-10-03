import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../src/world/physics/PhysicsWorld';
import type { BodyState, GroundSampler } from '../src/world/physics/PhysicsTypes';

/** Flat land at y=1 for x < 10, sea (y = -3) beyond; a 45° hill for x in [-20, -10]. */
const ground: GroundSampler = {
  heightAt: (x) => (x < -10 ? Math.min(11, 1 + (-10 - x) * 1.5) : x < 10 ? 1 : -3),
  slopeAt: (x) => (x < -10 && x > -16.6 ? 1.5 : 0),
  surfaceAt: () => 'grass',
  waterLevelAt: () => 0,
};

function body(x: number, z: number, y = 1): BodyState {
  return { x, y, z, radius: 0.4, height: 1.8 };
}

describe('PhysicsWorld', () => {
  it('walks on flat ground and snaps to height', () => {
    const w = new PhysicsWorld(ground);
    const b = body(0, 0);
    const r = w.moveBody(b, 2, 0);
    expect(b.x).toBeCloseTo(2, 3);
    expect(b.y).toBeCloseTo(1, 3);
    expect(r.blocked).toBe(false);
  });

  it('refuses to walk into deep water', () => {
    const w = new PhysicsWorld(ground);
    const b = body(9, 0);
    w.moveBody(b, 3, 0);
    expect(b.x).toBeLessThan(10.05);
  });

  it('refuses to climb slopes steeper than the limit', () => {
    const w = new PhysicsWorld(ground);
    const b = body(-9.5, 0);
    w.moveBody(b, -3, 0);
    expect(b.x).toBeGreaterThan(-10.3);
  });

  it('pushes out of circle and box colliders and slides along walls', () => {
    const w = new PhysicsWorld(ground);
    w.addCircle(2, 0, 0.5, 0, 3);
    const b = body(0, 0);
    w.moveBody(b, 2, 0);
    expect(Math.hypot(b.x - 2, b.z)).toBeGreaterThanOrEqual(0.89);
    w.addBox(0, 5, 3, 0.5, 0, 0, 3);
    const c = body(0, 3.5);
    w.moveBody(c, 0.5, 2);
    expect(c.z).toBeLessThanOrEqual(4.11);
    expect(c.x).toBeGreaterThan(0.3); // slid sideways
  });

  it('steps onto platforms (docks) and walks off only where the drop is small', () => {
    const w = new PhysicsWorld(ground);
    // dock over the sea at deck height 1.3 starting on land
    w.addPlatform({ x: 15, z: 0, halfX: 6, halfZ: 1.5, yaw: 0, height: 1.3, thickness: 3, surface: 'wood' });
    const b = body(7, 0);
    w.moveBody(b, 6, 0);
    expect(b.x).toBeCloseTo(13, 1);
    expect(b.y).toBeCloseTo(1.3, 2);
    // walking off the side of the dock into the sea is blocked (drop > step down and deep water)
    w.moveBody(b, 0, 4);
    expect(b.z).toBeLessThanOrEqual(1.55);
  });

  it('climbs ramps (gangplank) with slope along local +Z rotated by yaw', () => {
    const w = new PhysicsWorld(ground);
    // ramp along +X from x=0 (h=1) to x=6 (h=3)
    w.addPlatform({ x: 3, z: 0, halfX: 0.8, halfZ: 3, yaw: Math.PI / 2, height: 2, slope: 2 / 6, thickness: 2, surface: 'wood' });
    const b = body(-0.5, 0);
    for (let i = 0; i < 40; i++) w.moveBody(b, 0.2, 0);
    expect(b.y).toBeGreaterThan(2.5);
  });

  it('line of sight is blocked by tall colliders', () => {
    const w = new PhysicsWorld(ground);
    w.addBox(5, 0, 0.5, 2, 0, 0, 4);
    expect(w.lineOfSight(0, 2, 0, 9, 2, 0)).toBe(false);
    expect(w.lineOfSight(0, 2, 5, 9, 2, 5)).toBe(true);
  });
});
