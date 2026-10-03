import * as THREE from 'three';
import { trs } from '../../assets/geometry/GeometryUtils';
import { MaterialLibrary } from '../../assets/materials/MaterialLibrary';
import type { AssetCatalog, PropDefinition, PropPart } from '../PropTypes';
import { buildDockSection, buildDockStairs, buildGangplank, buildQuayWall } from './Docks';
import { PartSet } from './PropKit';
import {
  anchor,
  barrel,
  barrelGroup,
  buildChestParts,
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
} from './Props';

/**
 * Viewer catalog for the pirate props & docks module.
 * e.g. /viewer.html?asset=dock-section&dist=18&yaw=0.8&pitch=0.45&ty=1.5&water=1
 */

function meshes(parts: PropPart[], lib: MaterialLibrary, parent: THREE.Object3D): void {
  for (const p of parts) parent.add(new THREE.Mesh(p.geometry, lib.get(p.material, { seeThrough: p.seeThrough })));
}

/** Interactable chest preview: base + lid group rotated open around its hinge (as gameplay would). */
function chestObject(openDeg: number): THREE.Object3D {
  const lib = new MaterialLibrary();
  const cp = buildChestParts();
  const root = new THREE.Group();
  meshes(cp.base, lib, root);
  const lid = new THREE.Group();
  lid.position.set(0, cp.lidPivot.y, cp.lidPivot.z);
  lid.rotation.x = -THREE.MathUtils.degToRad(openDeg);
  meshes(cp.lid, lib, lid);
  root.add(lid);
  return root;
}

/** Everything arranged on a short pier + beach strip (art review only, no colliders). */
function showcase(): PropDefinition {
  const ps = new PartSet();
  const put = (def: PropDefinition, x: number, y: number, z: number, yaw = 0) => ps.addParts(def.parts, trs(x, y, z, 0, yaw, 0));
  put(buildQuayWall({ length: 18, seed: 2 }), 0, 0, 0);
  put(buildDockSection({ length: 14, width: 4.8, railing: 'left', seed: 5 }), 3, 0, 0.05);
  put(buildDockStairs({ width: 1.6, rise: 1.75, run: 2.6 }), -4, 0, 2.7, Math.PI);
  put(crate(2), 2.4, 1.75, 4);
  put(barrelGroup(), 3.6, 1.75, 8.5, 0.4);
  put(cannon(), 3, 1.75, 12, 0.2);
  put(ropeCoil(), 4.3, 1.75, 2.2);
  put(cannonballPile(), 1.6, 1.75, 11.3);
  put(shack(), -5, 1.75, -6.5);
  put(marketStall(), 3.5, 1.75, -4.5, -0.3);
  put(treasureHeap(), -1, 1.75, -2.3);
  put(decorChest(true), 0.6, 1.75, -1.4, -0.4);
  put(lanternPost(), 1.6, 1.75, -0.9, Math.PI);
  put(flagpole(), -8, 1.75, -1.5);
  put(signpost(), 7.2, 1.75, -1.2);
  return { name: 'pirate-props-showcase', parts: ps.build() };
}

const prop = (def: PropDefinition) => ({ kind: 'prop' as const, def });

export const assets: AssetCatalog = {
  // docks
  'dock-section': () => prop(buildDockSection({ length: 12, width: 5, railing: 'both', seed: 3 })),
  'dock-section-plain': () => prop(buildDockSection({ length: 12, width: 3.2, railing: 'none', seed: 8 })),
  'dock-stairs': () => prop(buildDockStairs({ width: 1.8, rise: 1.75, run: 2.6 })),
  gangplank: () => prop(buildGangplank({ length: 6.5, rise: 1.8 })),
  'quay-wall': () => prop(buildQuayWall({ length: 16, height: 1.75, depth: 3 })),
  // props
  'crate-0': () => prop(crate(0)),
  'crate-1': () => prop(crate(1)),
  'crate-2': () => prop(crate(2)),
  barrel: () => prop(barrel('upright')),
  'barrel-lying': () => prop(barrel('lying')),
  'barrel-rum': () => prop(barrel('rum')),
  'barrel-group': () => prop(barrelGroup()),
  cannon: () => prop(cannon()),
  'cannonball-pile': () => prop(cannonballPile()),
  'treasure-heap': () => prop(treasureHeap()),
  'decor-chest': () => prop(decorChest(false)),
  'decor-chest-open': () => prop(decorChest(true)),
  'chest-parts': () => ({ kind: 'object', object: chestObject(100) }),
  tent: () => prop(tent()),
  'campfire-base': () => prop(campfireBase()),
  shack: () => prop(shack()),
  'market-stall': () => prop(marketStall()),
  fence: () => prop(fence(6)),
  signpost: () => prop(signpost()),
  'lantern-post': () => prop(lanternPost()),
  'rope-coil': () => prop(ropeCoil()),
  'fishing-net': () => prop(fishingNet()),
  flagpole: () => prop(flagpole()),
  anchor: () => prop(anchor()),
  'weapon-rack': () => prop(weaponRack()),
  hammock: () => prop(hammock()),
  'pirate-props-showcase': () => prop(showcase()),
};
