import { HarborLayout } from './HarborLayout';
import type { Heightfield } from '../../terrain/Heightfield';
import type { PropPlacer } from '../../building/PropPlacer';
import type { KeepOutMap } from '../../building/Scatter';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import {
  anchor,
  barrel,
  barrelGroup,
  CAMPFIRE_FIRE,
  campfireBase,
  cannon,
  cannonballPile,
  crate,
  decorChest,
  fence,
  fishingNet,
  flagpole,
  hammock,
  lanternPost,
  marketStall,
  ropeCoil,
  shack,
  signpost,
  tent,
  treasureHeap,
  weaponRack,
} from '../../../environment/props/Props';

export interface DressingResult {
  /** Campfire flame positions (world). */
  fires: Array<{ x: number; y: number; z: number }>;
}

/**
 * Pirate occupation of the island: quay defences, cargo, camps, shacks and clutter. Placement is
 * hand-authored (level design), heights come from the terrain / dock deck.
 */
export function placeHarborDressing(placer: PropPlacer, hf: Heightfield, physics: PhysicsWorld, keep: KeepOutMap): DressingResult {
  const L = HarborLayout;
  const fires: DressingResult['fires'] = [];
  /** Ground height including platforms (docks, decks). */
  const gy = (x: number, z: number) => physics.groundAt(x, z, 50).height;
  const put = (def: ReturnType<typeof crate>, x: number, z: number, yaw = 0, scale = 1, keepR = 0) => {
    placer.place(def, x, gy(x, z), z, yaw, scale);
    if (keepR > 0) keep.circle(x, z, keepR);
  };
  void hf;

  // ---- quay: cannons facing the sea, cargo at the pier head ---------------------------------
  for (const [x, z] of [
    [-21, 17.9],
    [-13, 18.1],
    [10.2, 17.9],
  ]) {
    put(cannon(Math.round(x)), x, z, 0, 1, 2);
    put(cannonballPile(Math.round(z)), x + 1.4, z - 1.1, 0.5);
  }
  put(crate(2, 3), 0.2, 15.6, 0.15, 1, 1.8);
  put(crate(0, 4), -1.6, 16.8, 0.6, 1, 1);
  put(barrelGroup(5), 8.6, 14.6, 0.3, 1, 1.8);
  put(barrel('rum', 6), 7.3, 16.6, 0, 1, 0.8);
  put(barrel('lying', 7), -3.2, 14.4, 1.2, 1, 1);
  put(lanternPost(8), 1.55, 18.7, 0, 1, 0.6);
  put(lanternPost(9), 6.85, 18.7, 0, 1, 0.6);
  put(anchor(10), -7.2, 16.4, 0.8, 1, 1.4);
  put(fishingNet(11), -17.5, 13.6, 0.2, 1, 2.5);
  put(ropeCoil(12), -9.6, 17.6, 0, 1);
  put(ropeCoil(13), 11.8, 15.6, 1, 1);
  put(marketStall(14), -10.5, 9.6, 0.25, 1, 3);
  put(crate(1, 15), -13.4, 10.6, 0.4, 1, 1);
  put(barrel('upright', 16), -12.8, 8.2, 0, 1, 0.7);

  // ---- docks: clutter at the ends (never across the walkway) ---------------------------------
  const m = L.docks.main;
  put(crate(1, 20), m.x - 1.3, 64.2, 0.1, 1);
  put(barrelGroup(21), m.x + 1.2, 63.6, 1.1, 0.9);
  put(ropeCoil(22), m.x + 1.6, 36.5, 0);
  put(barrel('upright', 23), m.x - 1.7, 26.5, 0);
  const we = L.docks.westEnd;
  put(crate(0, 24), we.x, 53.2, 0.2, 0.9);
  put(barrel('lying', 25), we.x + 0.6, 37.1, 1.5, 0.9);

  // ---- hub: shacks and a signpost -----------------------------------------------------------
  put(shack(30), 14.5, -7.5, -Math.PI / 2 + 0.2, 1, 4.5);
  put(shack(31), -17.5, 7.5, Math.PI / 2 - 0.15, 1, 4.5);
  put(barrel('rum', 32), 12.2, -3.6, 0, 1, 0.7);
  put(crate(2, 33), -14.4, 4.4, 0.5, 1, 1.2);
  put(signpost(34), 5.2, 4.4, -0.6, 1, 0.6);
  put(hammock(35), 18.5, 9.5, 0.4, 1, 2.5);

  // ---- beach camp ------------------------------------------------------------------------------
  put(tent(40), 36.5, -0.8, -1.35, 1, 3.5);
  put(campfireBase(41), 33.4, 1.4, 0, 1, 1.4);
  fires.push({ x: 33.4 + CAMPFIRE_FIRE.x, y: gy(33.4, 1.4) + CAMPFIRE_FIRE.topY - 0.1, z: 1.4 + CAMPFIRE_FIRE.z });
  put(crate(0, 42), 38.8, 3.2, 0.3, 1, 1);
  put(barrelGroup(43), 33.6, -6.8, 0.8, 1, 1.6);
  put(weaponRack(44), 31.6, -2.6, 1.2, 1, 1);
  put(flagpole(45), 30.2, -5.2, 0.4, 1, 0.8);
  put(treasureHeap(46), 41.4, 11.6, 0.7, 1, 1.6);
  put(decorChest(true, 47), 37.6, 11.8, 2.6, 1, 1);
  put(ropeCoil(48), 39.6, 5.8, 0.4);

  // ---- jungle camp -------------------------------------------------------------------------------
  const jc = L.jungleCamp;
  put(tent(50), jc.x + 2.4, jc.z + 3.8, 2.7, 1, 3.5);
  put(campfireBase(51), jc.x - 0.5, jc.z - 1.6, 0, 1, 1.4);
  fires.push({ x: jc.x - 0.5, y: gy(jc.x - 0.5, jc.z - 1.6) + CAMPFIRE_FIRE.topY - 0.1, z: jc.z - 1.6 });
  put(crate(1, 52), jc.x + 5.2, jc.z - 0.4, 0.7, 1, 1.2);
  put(barrel('upright', 53), jc.x + 4.4, jc.z + 1.4, 0, 1, 0.7);
  put(barrel('lying', 54), jc.x - 3.6, jc.z + 2.6, 0.4, 1, 1);
  put(flagpole(55), jc.x - 4, jc.z + 3.2, 0.9, 1, 0.8);
  put(weaponRack(56), jc.x + 3.6, jc.z - 3.6, -0.4, 1, 1);
  put(signpost(57), 5.4, -59.4, 1.2, 1, 0.6);
  put(hammock(58), jc.x - 5.5, jc.z - 4.5, 1.1, 1, 2.5);

  // ---- barricade before the gate stairs ----------------------------------------------------------
  put(fence(4.2, 60), -4.6, -93.5, 0.15, 1, 2.2);
  put(fence(4.2, 61), 4.8, -93.8, -0.2, 1, 2.2);
  put(cannon(62), 6.4, -96.5, Math.PI + 0.3, 1, 1.8);
  put(crate(0, 63), -6.6, -95.4, 0.2, 1, 1);
  put(barrel('upright', 64), -7.6, -94.1, 0, 1, 0.6);

  return { fires };
}
