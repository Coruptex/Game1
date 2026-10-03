import { HarborLayout } from './HarborLayout';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { PropPlacer } from '../../building/PropPlacer';
import { buildDockSection, buildGangplank, buildQuayWall } from '../../../environment/props/Docks';
import type { DockRailing } from '../../../environment/props/Docks';

/**
 * Walkable surfaces of the harbour: piers, gangplank and the galleon's decks. Visual geometry
 * comes from the dock / ship builders; this module guarantees the collision layout matches the
 * layout data even if visuals change.
 */
export function addDockPlatforms(physics: PhysicsWorld): void {
  const d = HarborLayout.docks;
  const h = d.height;
  const add = (x: number, z: number, halfX: number, halfZ: number, yaw = 0, height = h, slope = 0) =>
    physics.addPlatform({ x, z, halfX, halfZ, yaw, height, slope, thickness: 3, surface: 'wood' });

  add(d.main.x, (d.main.z0 + d.main.z1) / 2, d.main.halfWidth, (d.main.z1 - d.main.z0) / 2);
  add((d.west.x0 + d.west.x1) / 2, d.west.z, Math.abs(d.west.x0 - d.west.x1) / 2, d.west.halfWidth);
  add(d.westEnd.x, (d.westEnd.z0 + d.westEnd.z1) / 2, d.westEnd.halfWidth, (d.westEnd.z1 - d.westEnd.z0) / 2);
  add((d.east.x0 + d.east.x1) / 2, d.east.z, (d.east.x1 - d.east.x0) / 2, d.east.halfWidth);

  // Gangplank: ramp along +X (local +Z rotated by yaw = PI/2) from the pier up to the deck.
  const g = HarborLayout.gangplank;
  const ship = HarborLayout.ship;
  const len = g.x1 - g.x0;
  const rise = ship.deckHeight - h;
  add((g.x0 + g.x1) / 2, g.z, g.halfWidth, len / 2, Math.PI / 2, h + rise / 2, rise / len);
}


/** Places the visual piers, gangplank and harbour wall (walkable surfaces are added above). */
export function placeDockVisuals(placer: PropPlacer): void {
  const d = HarborLayout.docks;
  const h = d.height;
  const pier = (x: number, z: number, yaw: number, length: number, width: number, railing: DockRailing, seed: number) =>
    placer.place(buildDockSection({ length, width, deckHeight: h, seabedDepth: 3.2, railing, seed }), x, 0, z, yaw);

  // Main pier in segments so railings leave openings at the junctions (east stub, west pier,
  // gangplank to the galleon).
  const m = d.main;
  const w = m.halfWidth * 2;
  pier(m.x, m.z0, 0, 28.6 - m.z0, w, 'both', 1);
  pier(m.x, 28.6, 0, 2.8, w, 'none', 2);
  pier(m.x, 31.4, 0, 11.0, w, 'right', 3);
  pier(m.x, 42.4, 0, 5.8, w, 'none', 4);
  pier(m.x, 48.2, 0, m.z1 - 48.2, w, 'both', 5);

  // West pier and its T-end where rowboats moor.
  const wp = d.west;
  pier(wp.x0, wp.z, -Math.PI / 2, Math.abs(wp.x1 - wp.x0) - d.westEnd.halfWidth, wp.halfWidth * 2, 'none', 6);
  const we = d.westEnd;
  pier(we.x, we.z0, 0, we.z1 - we.z0, we.halfWidth * 2, 'none', 7);

  // Short east stub.
  const e = d.east;
  pier(e.x0, e.z, Math.PI / 2, e.x1 - e.x0, e.halfWidth * 2, 'none', 8);

  // Gangplank up to the galleon's port-side boarding gap.
  const g = HarborLayout.gangplank;
  placer.place(buildGangplank({ length: g.x1 - g.x0, rise: HarborLayout.ship.deckHeight - h, width: g.halfWidth * 2, seed: 9 }), g.x0, h, g.z, Math.PI / 2);

  // Stone harbour wall along the quay.
  const q = HarborLayout.quay;
  placer.place(buildQuayWall({ length: q.maxX - q.minX, height: q.height, depth: 3.4, seed: 10 }), (q.minX + q.maxX) / 2, 0, q.maxZ, 0);
}
