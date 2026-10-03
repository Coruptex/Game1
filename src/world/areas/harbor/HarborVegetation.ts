import * as THREE from 'three';
import { HarborLayout } from './HarborLayout';
import type { HarborTerrainShape } from './HarborTerrain';
import type { Heightfield } from '../../terrain/Heightfield';
import type { PropPlacer } from '../../building/PropPlacer';
import { scatter, type KeepOutMap } from '../../building/Scatter';
import type { Rng } from '../../../utils/random';
import type { InstancedAsset } from '../../../environment/PropTypes';
import {
  anthurium,
  broadLeafPlant,
  bromeliad,
  bush,
  cliffRock,
  coralBrain,
  coralBranching,
  coralFan,
  coralStaghorn,
  coralTube,
  fern,
  flowerPatch,
  grassClump,
  groundCover,
  hangingVines,
  heliconia,
  jungleTree,
  jungleTreeAnchors,
  jungleTreeSmall,
  orchidCluster,
  palmTree,
  pebbleCluster,
  rock,
  seaweed,
} from '../../../environment/vegetation/Vegetation';

interface Ctx {
  placer: PropPlacer;
  hf: Heightfield;
  shape: HarborTerrainShape;
  keep: KeepOutMap;
  rng: Rng;
  density: number;
}

const B = { minX: -75, minZ: -122, maxX: 75, maxZ: 95 };

/** Picks one of several asset variants (cached so each variant is built once). */
function variants(make: (v: number) => InstancedAsset, n: number): InstancedAsset[] {
  return Array.from({ length: n }, (_, i) => make(i));
}

/**
 * Lush, layered vegetation for the hub: palms along the beach and harbour, a dense rainforest on
 * the plateau (giant buttress trees, understory, ferns, flowers, vines), meadows around the
 * plaza, coral gardens in the shallows and rocks along the cliffs.
 */
export function placeHarborVegetation(c: Ctx): { trees: number; plants: number; coral: number } {
  const { placer, hf, shape, keep, rng } = c;
  const L = HarborLayout;
  const h = (x: number, z: number) => hf.heightAt(x, z);
  const slope = (x: number, z: number) => hf.slopeAt(x, z);
  const inRiver = (x: number, z: number, margin: number) => x > 18 && z < -36 && shape.riverInfo(x, z).dist < L.river.halfWidth + margin;
  let trees = 0;
  let plants = 0;
  let coral = 0;

  // ---- palms ----------------------------------------------------------------------------
  const palms = variants(palmTree, 4);
  const palmSpots = scatter(rng, B, 70, 4.6, (x, z) => {
    const y = h(x, z);
    if (y < 0.35 || y > 4.2 || slope(x, z) > 0.55) return false;
    if (keep.blocked(x, z, 1.2)) return false;
    const beach = shape.beachZone(x, z);
    const jungle = shape.jungleZone(x, z);
    if (jungle > 0.7) return 0.15;
    if (beach > 0.3) return 0.95;
    // around the hub and harbour edges, but not in the plaza
    const dp = Math.hypot(x - L.plaza.x, z - L.plaza.z);
    if (dp < L.plaza.radius + 2) return false;
    return 0.45;
  });
  for (const p of palmSpots) {
    const tilt = rng.range(-0.06, 0.06);
    placer.instance(rng.pick(palms), p.x, h(p.x, p.z) - 0.1, p.z, rng.range(0, Math.PI * 2), rng.range(0.85, 1.15), undefined, tilt);
    keep.circle(p.x, p.z, 1.0);
    trees++;
  }

  // ---- jungle canopy -----------------------------------------------------------------------
  const giants = variants(jungleTree, 3);
  const vines = variants(hangingVines, 2);
  const giantSpots = scatter(rng, { minX: -60, minZ: -104, maxX: 48, maxZ: -38 }, 34, 11.5, (x, z) => {
    if (shape.jungleZone(x, z) < 0.85) return false;
    if (keep.blocked(x, z, 4.5) || inRiver(x, z, 5)) return false;
    if (slope(x, z) > 0.6) return false;
    return true;
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  for (const p of giantSpots) {
    const variant = rng.int(0, 2);
    const yaw = rng.range(0, Math.PI * 2);
    const s = rng.range(0.85, 1.15);
    const y0 = h(p.x, p.z) - 0.25;
    placer.instance(giants[variant], p.x, y0, p.z, yaw, s);
    keep.circle(p.x, p.z, 2.6);
    trees++;
    // vines hanging from the limbs
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    sc.setScalar(s);
    m.compose(new THREE.Vector3(p.x, y0, p.z), q, sc);
    for (const a of jungleTreeAnchors(variant)) {
      if (rng.next() < 0.35) continue;
      v.copy(a).applyMatrix4(m);
      placer.instance(rng.pick(vines), v.x, v.y - 0.2, v.z, rng.range(0, Math.PI * 2), rng.range(0.7, 1.1));
    }
  }

  const smallTrees = variants(jungleTreeSmall, 2);
  const smallSpots = scatter(rng, { minX: -62, minZ: -106, maxX: 50, maxZ: -24 }, 70, 6.5, (x, z) => {
    const j = shape.jungleZone(x, z);
    if (j < 0.4 || keep.blocked(x, z, 2.2) || inRiver(x, z, 3)) return false;
    if (slope(x, z) > 0.75) return false;
    return 0.8;
  });
  for (const p of smallSpots) {
    placer.instance(rng.pick(smallTrees), p.x, h(p.x, p.z) - 0.15, p.z, rng.range(0, Math.PI * 2), rng.range(0.8, 1.2));
    keep.circle(p.x, p.z, 1.4);
    trees++;
  }

  // ---- understory: ferns, broad leaves, bushes, flowers ----------------------------------------------
  const d = c.density;
  const ferns = variants(fern, 3);
  const bushes = variants(bush, 3);
  const broads = variants(broadLeafPlant, 2);
  const flowersJungle = [bromeliad(0), orchidCluster(0), anthurium(0), heliconia(0), bromeliad(1), anthurium(1)];
  const meadow = [flowerPatch(0), flowerPatch(1), flowerPatch(2)];
  const grasses = [grassClump(0), grassClump(1), groundCover(0), groundCover(1)];

  const understory = (count: number, minDist: number, assets: InstancedAsset[], scale: [number, number], accept: (x: number, z: number) => number | boolean, bounds = B) => {
    const spots = scatter(rng, bounds, Math.round(count * d), minDist, accept);
    for (const p of spots) {
      placer.instance(rng.pick(assets), p.x, h(p.x, p.z) - 0.04, p.z, rng.range(0, Math.PI * 2), rng.range(scale[0], scale[1]));
      plants++;
    }
    return spots;
  };

  const jungleFloor = (pathMargin: number) => (x: number, z: number) => {
    if (shape.jungleZone(x, z) < 0.55) return false;
    if (keep.blocked(x, z, pathMargin) || inRiver(x, z, 0.8)) return false;
    return slope(x, z) < 0.9;
  };
  const jungleBounds = { minX: -64, minZ: -106, maxX: 50, maxZ: -30 };
  understory(620, 1.5, ferns, [0.75, 1.35], jungleFloor(0.4), jungleBounds);
  understory(170, 2.6, broads, [0.8, 1.3], jungleFloor(0.8), jungleBounds);
  understory(170, 2.2, bushes, [0.8, 1.4], jungleFloor(0.6), jungleBounds);
  understory(260, 1.6, flowersJungle, [0.8, 1.3], jungleFloor(0.3), jungleBounds);
  understory(360, 1.3, grasses, [0.8, 1.3], jungleFloor(0.2), jungleBounds);
  // river banks: ferns and flowers right at the water's edge
  understory(120, 1.4, [...ferns, ...flowersJungle], [0.7, 1.2], (x, z) => {
    if (!(x > 18 && z < -36)) return false;
    const r = shape.riverInfo(x, z).dist;
    return r > L.river.halfWidth + 0.6 && r < L.river.halfWidth + 4 && !keep.blocked(x, z, 0.2);
  }, { minX: 20, minZ: -112, maxX: 50, maxZ: -40 });

  // hub meadows, beach dunes and harbour edges
  const grassland = (x: number, z: number) => {
    const y = h(x, z);
    if (y < 0.9 || shape.jungleZone(x, z) > 0.5 || slope(x, z) > 0.8) return false;
    if (keep.blocked(x, z, 0.3)) return false;
    return shape.beachZone(x, z) > 0.6 ? 0.25 : 1;
  };
  understory(520, 1.2, grasses, [0.8, 1.4], grassland);
  understory(200, 1.8, meadow, [0.8, 1.2], grassland);
  understory(130, 2.6, bushes, [0.7, 1.2], grassland);
  understory(70, 2.4, ferns, [0.7, 1.1], grassland);
  understory(50, 2.8, [bromeliad(0), heliconia(0)], [0.8, 1.2], grassland);

  // ---- rocks -----------------------------------------------------------------------------------------
  const rocks = variants(rock, 4);
  const cliffs = variants(cliffRock, 2);
  const cliffSpots = scatter(rng, { minX: -80, minZ: -125, maxX: 70, maxZ: 40 }, 90, 6.5, (x, z) => {
    const s = slope(x, z);
    const y = h(x, z);
    if (s < 0.95 || y < -1.5 || keep.blocked(x, z, 1.5)) return false;
    return 0.9;
  });
  for (const p of cliffSpots) {
    placer.instance(rng.pick(cliffs), p.x, h(p.x, p.z) - 1.2, p.z, rng.range(0, Math.PI * 2), rng.range(0.55, 1.1));
    trees++;
  }
  understory(170, 3, rocks, [0.6, 1.3], (x, z) => {
    const y = h(x, z);
    if (y < -0.8 || keep.blocked(x, z, 0.8)) return false;
    return shape.beachZone(x, z) > 0.4 ? 0.6 : 0.35;
  });
  understory(140, 2.2, [pebbleCluster(0), pebbleCluster(1)], [0.8, 1.3], (x, z) => {
    const y = h(x, z);
    if (keep.blocked(x, z, 0.3)) return false;
    if (inRiver(x, z, 0.5)) return 1;
    return y > -0.3 && y < 1.2 ? 0.7 : 0.05;
  });

  // ---- coral gardens -----------------------------------------------------------------------------------
  const corals = [coralBranching(0), coralStaghorn(0), coralBrain(0), coralFan(0), coralTube(0), coralBranching(1), coralBrain(1), coralFan(1)];
  const weeds = [seaweed(0), seaweed(1)];
  const shallow = (min: number, max: number) => (x: number, z: number) => {
    const y = h(x, z);
    if (y > max || y < min) return false;
    const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) + Math.sin((x + z) * 0.07);
    return n > -0.2 ? 1 : 0.15; // clustered reefs
  };
  const reefBounds = { minX: -45, minZ: 15, maxX: 90, maxZ: 95 };
  for (const p of scatter(rng, reefBounds, Math.round(340 * Math.max(0.6, d)), 1.15, shallow(-3.2, -0.55))) {
    placer.instance(rng.pick(corals), p.x, h(p.x, p.z) - 0.05, p.z, rng.range(0, Math.PI * 2), rng.range(0.7, 1.5));
    coral++;
  }
  for (const p of scatter(rng, { minX: 40, minZ: -40, maxX: 95, maxZ: 40 }, Math.round(220 * Math.max(0.6, d)), 1.2, shallow(-2.8, -0.5))) {
    placer.instance(rng.pick(corals), p.x, h(p.x, p.z) - 0.05, p.z, rng.range(0, Math.PI * 2), rng.range(0.7, 1.4));
    coral++;
  }
  for (const p of scatter(rng, reefBounds, Math.round(160 * d), 1.4, shallow(-3.8, -0.9))) {
    placer.instance(rng.pick(weeds), p.x, h(p.x, p.z) - 0.05, p.z, rng.range(0, Math.PI * 2), rng.range(0.8, 1.4));
    coral++;
  }

  // ---- sea stack with palms --------------------------------------------------------------------------
  const ss = L.seaStack;
  placer.instance(cliffs[0], ss.x, -3, ss.z, 0.4, 2.6);
  placer.instance(cliffs[1], ss.x + 4, -2.5, ss.z + 3, 1.7, 1.6);
  placer.instance(palms[1], ss.x - 0.5, 15.5, ss.z, 0.3, 0.95, undefined, 0.08);
  placer.instance(palms[3], ss.x + 1.5, 15.2, ss.z - 1.2, 2.1, 0.8, undefined, -0.1);
  return { trees, plants, coral };
}
