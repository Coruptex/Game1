import * as THREE from 'three';
import type { AssetCatalog, InstancedAsset } from '../PropTypes';
import { MaterialLibrary } from '../../assets/materials/MaterialLibrary';
import { trs } from '../../assets/geometry/GeometryUtils';
import { Rng } from '../../utils/random';
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
  jungleTreeProp,
  jungleTreeSmall,
  orchidCluster,
  palmTree,
  pebbleCluster,
  rock,
  seaweed,
} from './Vegetation';

/**
 * Viewer catalog for the vegetation / coral / rock module. Instanced entries show 4–9 copies
 * (yawed by the viewer) so variation is visible; samplers and line-ups are `object` entries built
 * from InstancedMeshes with a local MaterialLibrary.
 *   /viewer.html?asset=jungle-sampler&dist=30&yaw=0.7&pitch=0.4&ty=6&ground=jungle&atmo=jungle
 *   /viewer.html?asset=reef-sampler&dist=10&pitch=0.7&ty=0&water=1
 */

let lib: MaterialLibrary | null = null;
function materials(): MaterialLibrary {
  if (!lib) lib = new MaterialLibrary();
  return lib;
}

interface Placement {
  asset: InstancedAsset;
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  scale?: number;
  tilt?: number;
}

/** Builds InstancedMeshes (one per asset part) for a list of placements. */
function instancedGroup(placements: Placement[], name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const byAsset = new Map<string, { asset: InstancedAsset; mats: THREE.Matrix4[] }>();
  for (const pl of placements) {
    let e = byAsset.get(pl.asset.name);
    if (!e) {
      e = { asset: pl.asset, mats: [] };
      byAsset.set(pl.asset.name, e);
    }
    const s = pl.scale ?? 1;
    const tilt = pl.tilt ?? 0;
    e.mats.push(trs(pl.x, pl.y ?? 0, pl.z, tilt, pl.yaw ?? 0, tilt * 0.6, s, s, s, new THREE.Matrix4()));
  }
  for (const { asset, mats } of byAsset.values()) {
    for (const part of asset.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, materials().get(part.material), mats.length);
      mesh.name = `${asset.name}:${part.material}`;
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return group;
}

/** Shows a hanging-vine asset under a simple beam (vines hang below their origin). */
function vineFrame(asset: InstancedAsset): THREE.Group {
  const g = instancedGroup(
    [
      { asset, x: -1.6, y: 6, z: 0 },
      { asset, x: 1.8, y: 6, z: 0.3, yaw: 2.2 },
    ],
    'vine-frame',
  );
  const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 0.5), materials().get('woodDark'));
  beam.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(beam.geometry.attributes.position.count * 3).fill(1), 3));
  beam.position.y = 6.2;
  g.add(beam);
  for (const x of [-3.8, 3.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.4, 0.45), materials().get('woodDark'));
    post.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(post.geometry.attributes.position.count * 3).fill(1), 3));
    post.position.set(x, 3.2, 0);
    g.add(post);
  }
  return g;
}

/** Every understory plant variant in a row (quick visual QA). */
function plantLineup(): THREE.Group {
  const row1: InstancedAsset[] = [fern(0), fern(1), fern(2), bush(0), bush(1), bush(2), broadLeafPlant(0), broadLeafPlant(1)];
  const row2: InstancedAsset[] = [bromeliad(0), bromeliad(1), orchidCluster(0), orchidCluster(1), anthurium(0), anthurium(1), heliconia(0), heliconia(1)];
  const row3: InstancedAsset[] = [flowerPatch(0), flowerPatch(1), flowerPatch(2), grassClump(0), grassClump(1), groundCover(0), groundCover(1)];
  const pl: Placement[] = [];
  row1.forEach((a, i) => pl.push({ asset: a, x: (i - 3.5) * 2.6, z: -3, yaw: 0.4 }));
  row2.forEach((a, i) => pl.push({ asset: a, x: (i - 3.5) * 2.6, z: 0, yaw: 0.4 }));
  row3.forEach((a, i) => pl.push({ asset: a, x: (i - 3) * 2.6, z: 2.6, yaw: 0.4 }));
  return instancedGroup(pl, 'plant-lineup');
}

/** Every coral variant in a row (shown without water so shapes / colours can be judged). */
function coralLineup(): THREE.Group {
  const list: InstancedAsset[] = [
    coralBranching(0),
    coralBranching(1),
    coralBranching(2),
    coralStaghorn(0),
    coralStaghorn(1),
    coralBrain(0),
    coralBrain(1),
    coralFan(0),
    coralFan(1),
    coralTube(0),
    coralTube(1),
    seaweed(0),
    seaweed(1),
  ];
  return instancedGroup(
    list.map((asset, i) => ({ asset, x: ((i % 7) - 3) * 1.6, z: Math.floor(i / 7) * 1.8 - 0.9, yaw: 0.3 })),
    'coral-lineup',
  );
}

/** Boulders, pebbles and cliff rocks side by side. */
function rockLineup(): THREE.Group {
  return instancedGroup(
    [
      { asset: rock(0), x: -6, z: 4 },
      { asset: rock(1), x: -4, z: 4 },
      { asset: rock(2), x: -1, z: 4 },
      { asset: rock(3), x: 3, z: 4 },
      { asset: pebbleCluster(0), x: 7, z: 4 },
      { asset: pebbleCluster(1), x: 8.5, z: 5.5 },
      { asset: cliffRock(0), x: -5, z: -5 },
      { asset: cliffRock(1), x: 6, z: -5, yaw: 0.6 },
    ],
    'rock-lineup',
  );
}

interface Blocker {
  x: number;
  z: number;
  r: number;
}

/** Scatters `count` picks from `list` in an annulus, avoiding blockers; returns placements. */
function scatter(
  rng: Rng,
  list: InstancedAsset[],
  count: number,
  cx: number,
  cz: number,
  rMin: number,
  rMax: number,
  scale: [number, number],
  blockers: Blocker[] = [],
  spacing = 0,
  out: Placement[] = [],
): Placement[] {
  let guard = 0;
  let placed = 0;
  while (placed < count && guard++ < count * 40) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.range((rMin * rMin) / (rMax * rMax), 1)) * rMax;
    const x = cx + Math.sin(a) * d;
    const z = cz + Math.cos(a) * d;
    if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r)) continue;
    if (spacing > 0 && out.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
    out.push({ asset: list[rng.int(0, list.length - 1)], x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(scale[0], scale[1]) });
    placed++;
  }
  return out;
}

/** Dense jungle vignette: giant tree, understory, flowers, vines, rocks (judge the overall look). */
function jungleSampler(): THREE.Group {
  const rng = new Rng(2024);
  const pl: Placement[] = [];
  const G = { x: -4, z: -5 };
  // canopy layer
  pl.push({ asset: jungleTree(0), x: G.x, z: G.z, yaw: 0 });
  pl.push({ asset: jungleTree(1), x: -21, z: 9, yaw: 2.1 });
  pl.push({ asset: jungleTreeSmall(0), x: 9, z: -13, yaw: 0.5 });
  pl.push({ asset: jungleTreeSmall(0), x: -15, z: -12, yaw: 2.5, scale: 0.9 });
  pl.push({ asset: jungleTreeSmall(1), x: 12.5, z: 0.5, yaw: 1.3 });
  pl.push({ asset: jungleTreeSmall(1), x: -11, z: 5, yaw: 4.0, scale: 1.1 });
  pl.push({ asset: palmTree(1), x: 15, z: 10, yaw: 2.6 });
  pl.push({ asset: palmTree(3), x: 4, z: 15, yaw: 1.0 });
  pl.push({ asset: palmTree(0), x: 17, z: -6, yaw: 4.2, scale: 0.95 });
  // vine curtains from the big limbs
  const anchors = jungleTreeAnchors(0);
  for (const [i, a] of anchors.entries()) {
    if (i % 3 !== 0) continue;
    pl.push({ asset: hangingVines(i % 2), x: G.x + a.x, y: a.y, z: G.z + a.z, yaw: rng.range(0, Math.PI * 2) });
  }
  const trunks: Blocker[] = [
    { x: G.x, z: G.z, r: 2.2 },
    { x: -21, z: 9, r: 2.0 },
    { x: 9, z: -13, r: 0.8 },
    { x: -15, z: -12, r: 0.8 },
    { x: 12.5, z: 0.5, r: 0.8 },
    { x: -11, z: 5, r: 0.8 },
    { x: 15, z: 10, r: 0.8 },
    { x: 4, z: 15, r: 0.8 },
    { x: 17, z: -6, r: 0.8 },
  ];
  // rocks
  pl.push({ asset: rock(3), x: -9.5, z: -1, yaw: 0.7 });
  pl.push({ asset: rock(2), x: 4.5, z: -3.5, yaw: 2.0 });
  pl.push({ asset: rock(2), x: -2, z: 8.5, yaw: 4.1, scale: 0.8 });
  trunks.push({ x: -9.5, z: -1, r: 1.8 }, { x: 4.5, z: -3.5, r: 1.1 }, { x: -2, z: 8.5, r: 0.9 });
  scatter(rng, [rock(0), rock(1), pebbleCluster(1)], 9, 0, 0, 3, 17, [0.8, 1.2], trunks, 1.5, pl);
  // understory around the giant tree (between the buttresses) and along the edges
  const ferns = [fern(0), fern(1), fern(2)];
  const covers = [groundCover(0), groundCover(1), groundCover(0)];
  scatter(rng, covers, 70, 0, 0, 0, 21, [0.9, 1.4], trunks.map((t) => ({ ...t, r: t.r * 0.6 })), 1.6, pl);
  scatter(rng, ferns, 26, G.x, G.z, 2.3, 10, [0.95, 1.4], trunks, 1.2, pl);
  scatter(rng, ferns, 34, 0, 0, 6, 21, [0.9, 1.35], trunks, 1.3, pl);
  scatter(rng, [bush(0), bush(2), bush(1), bush(2)], 26, 0, 0, 6, 21, [1.0, 1.5], trunks, 1.9, pl);
  scatter(rng, [broadLeafPlant(0), broadLeafPlant(1), broadLeafPlant(1)], 16, 0, 0, 4, 19, [0.9, 1.25], trunks, 2.4, pl);
  scatter(rng, [heliconia(0), heliconia(1)], 7, 0, 0, 4, 16, [0.95, 1.2], trunks, 2.2, pl);
  scatter(rng, [bromeliad(0), bromeliad(1), bromeliad(0)], 20, 0, 0, 2, 17, [0.9, 1.25], trunks, 1.2, pl);
  scatter(rng, [anthurium(0), anthurium(1)], 9, G.x, G.z, 3, 12, [1.0, 1.25], trunks, 1.1, pl);
  scatter(rng, [orchidCluster(0), orchidCluster(1)], 7, G.x, G.z, 2.4, 7, [1.0, 1.25], trunks, 1.0, pl);
  // sunny clearing towards the camera
  scatter(rng, [grassClump(0), grassClump(1), grassClump(0)], 60, 6, 6, 0, 9, [0.85, 1.35], trunks, 0.5, pl);
  scatter(rng, [flowerPatch(0), flowerPatch(1), flowerPatch(2)], 16, 6, 6, 0, 8, [1.0, 1.4], trunks, 0.9, pl);
  scatter(rng, [grassClump(0), fern(2), grassClump(1)], 30, 0, 0, 9, 21, [0.8, 1.2], trunks, 0.9, pl);
  return instancedGroup(pl, 'jungle-sampler');
}

/** Shallow reef patch on the viewer's seabed (water=1 puts the ground at -0.6 m). */
function reefSampler(): THREE.Group {
  const rng = new Rng(77);
  const pl: Placement[] = [];
  const floor = -0.6;
  const maxTop = 0.52;
  const add = (asset: InstancedAsset, x: number, z: number, scale = 1, sink = 0.03): void => {
    asset.parts[0].geometry.computeBoundingBox();
    let top = 0;
    for (const part of asset.parts) {
      part.geometry.computeBoundingBox();
      top = Math.max(top, part.geometry.boundingBox!.max.y);
    }
    const s = Math.min(scale, maxTop / Math.max(0.05, top));
    pl.push({ asset, x, y: floor - sink, z, yaw: rng.range(0, Math.PI * 2), scale: s * rng.range(0.9, 1) });
  };
  const clusters = [
    { x: -2.2, z: -0.8, list: [coralBrain(0), coralBranching(0), coralBranching(0), coralFan(0), coralTube(0), seaweed(0), seaweed(0)] },
    { x: 2.4, z: 1.2, list: [coralStaghorn(1), coralStaghorn(1), coralBrain(1), coralFan(1), coralBranching(1), coralTube(1)] },
    { x: -0.2, z: 3.4, list: [coralBranching(2), coralStaghorn(0), seaweed(1), seaweed(1), coralBrain(0), coralTube(0)] },
    { x: 1.0, z: -3.2, list: [coralFan(0), coralFan(1), coralBranching(2), coralBrain(1), seaweed(0), coralTube(1)] },
    { x: -3.6, z: 2.6, list: [coralTube(1), coralBranching(1), coralStaghorn(0), seaweed(1)] },
  ];
  for (const c of clusters) {
    c.list.forEach((asset, i) => {
      const a = (i / c.list.length) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const d = i === 0 ? 0 : rng.range(0.5, 1.2);
      add(asset, c.x + Math.sin(a) * d, c.z + Math.cos(a) * d, rng.range(0.85, 1.15), asset.name.includes('Brain') ? 0.08 : 0.03);
    });
  }
  // rocks and rubble between the coral heads
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(1.5, 5.5);
    pl.push({ asset: i % 3 === 0 ? rock(1) : pebbleCluster(i % 2), x: Math.sin(a) * d, y: floor - 0.1, z: Math.cos(a) * d, yaw: rng.range(0, 6.28), scale: rng.range(0.6, 0.9) });
  }
  return instancedGroup(pl, 'reef-sampler');
}

export const assets: AssetCatalog = {
  'jungle-sampler': () => ({ kind: 'object', object: jungleSampler() }),
  'reef-sampler': () => ({ kind: 'object', object: reefSampler() }),
  'veg-plant-lineup': () => ({ kind: 'object', object: plantLineup() }),
  'palm-0': () => ({ kind: 'instanced', asset: palmTree(0), count: 4, spacing: 9 }),
  'palm-1': () => ({ kind: 'instanced', asset: palmTree(1), count: 4, spacing: 9 }),
  'palm-2': () => ({ kind: 'instanced', asset: palmTree(2), count: 4, spacing: 9 }),
  'palm-3': () => ({ kind: 'instanced', asset: palmTree(3), count: 4, spacing: 9 }),
  'palm-single': () => ({ kind: 'object', object: instancedGroup([{ asset: palmTree(0), x: 0, z: 0 }], 'palm-single') }),
  'jungle-tree-0': () => ({ kind: 'instanced', asset: jungleTree(0), count: 4, spacing: 20 }),
  'jungle-tree-1': () => ({ kind: 'instanced', asset: jungleTree(1), count: 4, spacing: 20 }),
  'jungle-tree-2': () => ({ kind: 'instanced', asset: jungleTree(2), count: 4, spacing: 20 }),
  'jungle-tree-prop-0': () => ({ kind: 'prop', def: jungleTreeProp(0) }),
  'jungle-tree-small-0': () => ({ kind: 'instanced', asset: jungleTreeSmall(0), count: 4, spacing: 8 }),
  'jungle-tree-small-1': () => ({ kind: 'instanced', asset: jungleTreeSmall(1), count: 4, spacing: 8 }),
  'fern-0': () => ({ kind: 'instanced', asset: fern(0), count: 9, spacing: 2 }),
  'fern-1': () => ({ kind: 'instanced', asset: fern(1), count: 9, spacing: 2.4 }),
  'fern-2': () => ({ kind: 'instanced', asset: fern(2), count: 9, spacing: 1.8 }),
  'bush-0': () => ({ kind: 'instanced', asset: bush(0), count: 9, spacing: 2.2 }),
  'bush-1': () => ({ kind: 'instanced', asset: bush(1), count: 9, spacing: 1.8 }),
  'bush-2': () => ({ kind: 'instanced', asset: bush(2), count: 9, spacing: 2.8 }),
  'broadleaf-0': () => ({ kind: 'instanced', asset: broadLeafPlant(0), count: 4, spacing: 3.5 }),
  'broadleaf-1': () => ({ kind: 'instanced', asset: broadLeafPlant(1), count: 4, spacing: 3 }),
  'bromeliad-0': () => ({ kind: 'instanced', asset: bromeliad(0), count: 9, spacing: 1.3 }),
  'bromeliad-1': () => ({ kind: 'instanced', asset: bromeliad(1), count: 9, spacing: 1.3 }),
  'orchid-0': () => ({ kind: 'instanced', asset: orchidCluster(0), count: 9, spacing: 1.1 }),
  'orchid-1': () => ({ kind: 'instanced', asset: orchidCluster(1), count: 9, spacing: 1.1 }),
  'anthurium-0': () => ({ kind: 'instanced', asset: anthurium(0), count: 9, spacing: 1.1 }),
  'anthurium-1': () => ({ kind: 'instanced', asset: anthurium(1), count: 9, spacing: 1.1 }),
  'heliconia-0': () => ({ kind: 'instanced', asset: heliconia(0), count: 4, spacing: 2.6 }),
  'heliconia-1': () => ({ kind: 'instanced', asset: heliconia(1), count: 4, spacing: 2.6 }),
  'flowers-0': () => ({ kind: 'instanced', asset: flowerPatch(0), count: 9, spacing: 1 }),
  'flowers-1': () => ({ kind: 'instanced', asset: flowerPatch(1), count: 9, spacing: 1 }),
  'flowers-2': () => ({ kind: 'instanced', asset: flowerPatch(2), count: 9, spacing: 1 }),
  'grass-0': () => ({ kind: 'instanced', asset: grassClump(0), count: 9, spacing: 0.8 }),
  'grass-1': () => ({ kind: 'instanced', asset: grassClump(1), count: 9, spacing: 1 }),
  'ground-cover-0': () => ({ kind: 'instanced', asset: groundCover(0), count: 9, spacing: 2.2 }),
  'ground-cover-1': () => ({ kind: 'instanced', asset: groundCover(1), count: 9, spacing: 2.2 }),
  'vines-0': () => ({ kind: 'object', object: vineFrame(hangingVines(0)) }),
  'vines-1': () => ({ kind: 'object', object: vineFrame(hangingVines(1)) }),
  'coral-branching-0': () => ({ kind: 'instanced', asset: coralBranching(0), count: 4, spacing: 1.4 }),
  'coral-branching-1': () => ({ kind: 'instanced', asset: coralBranching(1), count: 4, spacing: 1.4 }),
  'coral-branching-2': () => ({ kind: 'instanced', asset: coralBranching(2), count: 4, spacing: 1.4 }),
  'coral-staghorn-0': () => ({ kind: 'instanced', asset: coralStaghorn(0), count: 4, spacing: 1.6 }),
  'coral-staghorn-1': () => ({ kind: 'instanced', asset: coralStaghorn(1), count: 4, spacing: 1.6 }),
  'coral-brain-0': () => ({ kind: 'instanced', asset: coralBrain(0), count: 4, spacing: 1.3 }),
  'coral-brain-1': () => ({ kind: 'instanced', asset: coralBrain(1), count: 4, spacing: 1.3 }),
  'coral-fan-0': () => ({ kind: 'instanced', asset: coralFan(0), count: 4, spacing: 1.5 }),
  'coral-fan-1': () => ({ kind: 'instanced', asset: coralFan(1), count: 4, spacing: 1.5 }),
  'coral-tube-0': () => ({ kind: 'instanced', asset: coralTube(0), count: 4, spacing: 1.2 }),
  'coral-tube-1': () => ({ kind: 'instanced', asset: coralTube(1), count: 4, spacing: 1.2 }),
  'seaweed-0': () => ({ kind: 'instanced', asset: seaweed(0), count: 4, spacing: 1.2 }),
  'seaweed-1': () => ({ kind: 'instanced', asset: seaweed(1), count: 4, spacing: 1.2 }),
  'boulder-0': () => ({ kind: 'instanced', asset: rock(0), count: 9, spacing: 1.4 }),
  'boulder-1': () => ({ kind: 'instanced', asset: rock(1), count: 9, spacing: 2.2 }),
  'boulder-2': () => ({ kind: 'instanced', asset: rock(2), count: 4, spacing: 3.4 }),
  'boulder-3': () => ({ kind: 'instanced', asset: rock(3), count: 4, spacing: 5 }),
  'cliff-rock-0': () => ({ kind: 'instanced', asset: cliffRock(0), count: 4, spacing: 12 }),
  'cliff-rock-1': () => ({ kind: 'instanced', asset: cliffRock(1), count: 4, spacing: 14 }),
  'pebbles-0': () => ({ kind: 'instanced', asset: pebbleCluster(0), count: 4, spacing: 1.4 }),
  'pebbles-1': () => ({ kind: 'instanced', asset: pebbleCluster(1), count: 4, spacing: 1.4 }),
  'veg-coral-lineup': () => ({ kind: 'object', object: coralLineup() }),
  'veg-rock-lineup': () => ({ kind: 'object', object: rockLineup() }),
};
