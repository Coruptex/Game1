import { HarborLayout } from './HarborLayout';
import type { PropPlacer } from '../../building/PropPlacer';
import type { KeepOutMap } from '../../building/Scatter';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import { buildGalleon, buildRowboat, buildShipwreck, buildSloop } from '../../../environment/ships/Ships';

/**
 * The exiled fleet: the galleon moored at the main pier (boardable via the gangplank), a sloop
 * riding at anchor further out, rowboats at the piers and on the beach, and an old wreck on the
 * strand. Floating hulls sit on the sea level (y = 0); beached ones on the sand.
 */
export function placeHarborShips(placer: PropPlacer, physics: PhysicsWorld, keep: KeepOutMap): void {
  const L = HarborLayout;
  const sandY = (x: number, z: number) => physics.groundAt(x, z, 50).height;

  // Galleon: port side to the pier, boarding gap at the gangplank's top end.
  const s = L.ship;
  placer.place(buildGalleon(), s.x, L.seaLevel, s.z, s.yaw);

  // Sloop at anchor beyond the harbour mouth (frames the view from the docks).
  placer.place(buildSloop(), -10, L.seaLevel, 76, 0.55);

  // Rowboats: one tied off the west pier, one at the east stub, one dragged up the beach.
  const we = L.docks.westEnd;
  placer.place(buildRowboat(0), we.x - we.halfWidth - 1.3, L.seaLevel, 46.5, 0.12);
  const ea = L.docks.east;
  placer.place(buildRowboat(1), ea.x1 - 1.2, L.seaLevel, ea.z + ea.halfWidth + 1.25, Math.PI / 2 + 0.08);
  placer.place(buildRowboat(2), 30.6, sandY(30.6, 10.2), 10.2, 0.5);
  keep.circle(30.6, 10.2, 3);

  // Wreck half-buried on the south-east strand.
  placer.place(buildShipwreck(), 45, sandY(45, -15), -15, 2.3);
  keep.circle(45, -15, 7);
}
