import * as THREE from 'three';
import type { AreaBuildContext, AreaDefinition, BuiltArea, EnemySpawn, InteractableSpawn, Region } from '../AreaTypes';
import { HarborLayout } from './HarborLayout';
import { HarborTerrainShape } from './HarborTerrain';
import { Heightfield } from '../../terrain/Heightfield';
import { bakeHeightTexture, buildTerrainMeshes } from '../../terrain/TerrainMesh';
import { Water } from '../../../environment/water/Water';
import type { GroundSampler } from '../../physics/PhysicsTypes';
import type { AmbientEmitter } from '../AreaTypes';
import { buildRiverRibbon, Waterfall } from '../../../environment/water/River';
import { buildDistantIslands } from '../../../environment/sky/DistantIslands';
import { Seagulls } from '../../../environment/life/Seagulls';
import { LightShafts } from '../../../environment/life/LightShafts';
import { GlobalUniforms } from '../../../assets/materials/GlobalUniforms';
import { PropPlacer } from '../../building/PropPlacer';
import { KeepOutMap } from '../../building/Scatter';
import { placeHarborRuins } from './HarborRuins';
import { placeHarborVegetation } from './HarborVegetation';
import { buildEmberShrineBase } from '../../../environment/architecture/Ancient';
import { EmberFlame } from '../../../effects/EmberFlame';
import { addDockPlatforms, placeDockVisuals } from './HarborDocks';
import { placeHarborDressing } from './HarborDressing';
import { buildChestParts } from '../../../environment/props/Props';

/**
 * The first hub: a tropical pirate harbour on the ruins of an ancient island civilisation.
 * Building is split into themed modules (terrain, docks, ship, vegetation, ruins...) that all
 * read their coordinates from HarborLayout.
 */
export const HarborHubArea: AreaDefinition = {
  id: 'harbor',
  name: "Corsair's Rest",

  async build(ctx: AreaBuildContext): Promise<BuiltArea> {
    const L = HarborLayout;
    const root = new THREE.Group();
    root.name = 'Area:harbor';
    ctx.scene.add(root);

    await ctx.progress(0.05, 'Raising the island');
    const shape = new HarborTerrainShape();
    const b = L.bounds;
    const hf = new Heightfield(b.minX, b.minZ, b.maxX, b.maxZ, ctx.quality.terrainCellSize, -14);
    hf.fill((x, z) => shape.height(x, z));

    const ground: GroundSampler = {
      heightAt: (x, z) => hf.heightAt(x, z),
      slopeAt: (x, z) => hf.slopeAt(x, z),
      surfaceAt: (x, z) => shape.surfaceAt(x, z, hf.heightAt(x, z), hf.slopeAt(x, z)),
      waterLevelAt: (x, z) => shape.waterLevelAt(x, z),
    };
    const physics = ctx.createPhysics(ground);
    addDockPlatforms(physics);

    await ctx.progress(0.2, 'Painting the land');
    const terrain = buildTerrainMeshes(hf, (x, z, h, s, out) => shape.color(x, z, h, s, out), {
      caustics: ctx.quality.caustics,
    });
    root.add(terrain.group);

    await ctx.progress(0.3, 'Filling the sea');
    const baked = bakeHeightTexture(hf, 512);
    const water = new Water({ level: L.seaLevel, heightTexture: baked.texture, heightBounds: baked.bounds });
    root.add(water.mesh);

    // Jungle river + waterfall over the east cliff.
    const R = L.river;
    const river = new Water({
      level: R.level,
      heightTexture: baked.texture,
      heightBounds: baked.bounds,
      geometry: buildRiverRibbon(R.points, R.halfWidth + 1.6, 2.2),
      flow: 1.3,
      maxDepth: 1.6,
    });
    river.mesh.name = 'River';
    river.mesh.renderOrder = 2;
    root.add(river.mesh);
    const fall = new Waterfall(
      new THREE.Vector3(R.fall.x, R.level - 0.05, R.fall.z),
      new THREE.Vector3(R.fall.toX, 0.05, R.fall.toZ),
      R.halfWidth * 1.1,
    );
    root.add(fall.object);
    const emitters: AmbientEmitter[] = [
      { kind: 'mist', x: R.fall.toX, y: 0.4, z: R.fall.toZ, rate: 6, spread: 1.6, range: 60 },
      { kind: 'splash', x: R.fall.toX, y: 0.1, z: R.fall.toZ, rate: 10, spread: 1.2, range: 45 },
    ];

    const animated: Array<(dt: number, t: number) => void> = [];

    // Horizon, sky life and jungle light.
    root.add(buildDistantIslands());
    const gulls = new Seagulls([
      { x: 10, z: 50, count: 7, height: 26 },
      { x: 45, z: 5, count: 5, height: 22 },
      { x: -30, z: 30, count: 4, height: 30 },
    ]);
    root.add(gulls.object);
    animated.push((dt, t) => gulls.update(dt, t));
    const shaftPoints = [
      [-4, -46],
      [8, -58],
      [-12, -64],
      [2, -80],
      [16, -86],
      [-8, -92],
      [24, -74],
      [-18, -52],
    ].map(([x, z]) => ({ x, y: hf.heightAt(x, z) - 0.5, z }));
    root.add(new LightShafts(shaftPoints, GlobalUniforms.uSunDir.value).object);

    // --- content modules --------------------------------------------------------------
    const placer = new PropPlacer(ctx.materials, ctx.batcher, physics, ctx.scatter);
    const keep = new KeepOutMap();
    for (const path of L.paths) {
      for (let i = 0; i < path.points.length - 1; i++) {
        const a = path.points[i];
        const b = path.points[i + 1];
        keep.segment(a.x, a.z, b.x, b.z, path.width / 2 + 0.6);
      }
    }
    keep.circle(L.shrine.x, L.shrine.z, 3.5);
    for (const c of L.chests) keep.circle(c.x, c.z, 2.5);

    await ctx.progress(0.35, 'Building the docks');
    placeDockVisuals(placer);
    keep.rect(L.quay.minX, L.quay.minZ, L.quay.maxX, L.quay.maxZ + 1);

    await ctx.progress(0.4, 'Raising the old stones');
    const ruins = placeHarborRuins(placer, hf, ctx.rng.fork(1), keep);
    for (const f of ruins.flames) {
      const flame = new EmberFlame(0.55, null);
      flame.object.position.set(f.x, f.y, f.z);
      root.add(flame.object);
      animated.push((dt) => flame.update(dt));
      emitters.push({ kind: 'ember', x: f.x, y: f.y + 0.4, z: f.z, rate: 3, spread: 0.2, range: 40 });
    }

    await ctx.progress(0.48, 'Making camp');
    const dressing = placeHarborDressing(placer, hf, physics, keep);
    for (const f of dressing.fires) {
      const flame = new EmberFlame(0.75, null);
      flame.object.position.set(f.x, f.y, f.z);
      root.add(flame.object);
      animated.push((dt) => flame.update(dt));
      emitters.push({ kind: 'ember', x: f.x, y: f.y + 0.5, z: f.z, rate: 5, spread: 0.25, range: 40 });
    }

    await ctx.progress(0.55, 'Growing the jungle');
    const veg = placeHarborVegetation({ placer, hf, shape, keep, rng: ctx.rng.fork(2), density: ctx.quality.vegetationDensity });
    console.info(`[harbor] vegetation: ${veg.trees} trees, ${veg.plants} plants, ${veg.coral} coral`);

    await ctx.progress(0.9, 'Merging geometry');
    ctx.batcher.build(root, 'harbor');
    ctx.scatter.build(root);

    const regions = createRegions(shape);
    const enemySpawns: EnemySpawn[] = L.enemies.map((e) => ({ ...e, leash: 30 }));
    const interactables: InteractableSpawn[] = [
      { kind: 'shrine', id: 'shrine_harbor', x: L.shrine.x, z: L.shrine.z, yaw: 0, name: 'Ember Shrine' },
      ...L.chests.map((c) => ({ kind: 'chest' as const, id: c.id, x: c.x, z: c.z, yaw: c.yaw, gold: c.gold })),
      {
        kind: 'sealedDoor',
        id: 'crypt_door',
        x: L.dungeonDoor.x + 1.6,
        z: L.dungeonDoor.z,
        yaw: L.dungeonDoor.yaw,
        targetArea: 'crypt',
        message: 'An ancient ember seal bars the Crypt of the Ember Kings. The flame within is cold… for now.',
      },
    ];

    await ctx.progress(1, 'Ready');
    return {
      id: 'harbor',
      root,
      physics,
      ground,
      spawn: { x: L.playerStart.x, z: L.playerStart.z, yaw: L.playerStart.yaw, cameraYaw: L.startCameraYaw },
      regions,
      enemySpawns,
      interactables,
      emitters,
      shrineModel: () => buildEmberShrineBase(),
      chestParts: (seed) => buildChestParts(seed),
      update(dt, t) {
        for (const a of animated) a(dt, t);
      },
      dispose() {
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.geometry.dispose();
        });
        baked.texture.dispose();
      },
    };
  },
};

function createRegions(shape: HarborTerrainShape): Region[] {
  const L = HarborLayout;
  return [
    {
      id: 'harbor',
      name: "Corsair's Rest",
      subtitle: 'Harbour of the Exiled Fleet',
      atmosphere: 'harbor',
      ambience: 'harbor',
      priority: 0,
      contains: () => true,
    },
    {
      id: 'beach',
      name: 'Saltbleached Strand',
      atmosphere: 'harbor',
      ambience: 'beach',
      priority: 1,
      contains: (x, z) => x > 19 && z > -32 && z < 40,
    },
    {
      id: 'jungle',
      name: 'Verdant Hollow',
      subtitle: 'Where the old roads drown in green',
      atmosphere: 'jungle',
      ambience: 'jungle',
      priority: 2,
      contains: (x, z) => shape.jungleZone(x, z) > 0.5 && z > -103,
    },
    {
      id: 'crypt-approach',
      name: 'Crypt of the Ember Kings',
      subtitle: 'Sealed',
      atmosphere: 'ruins',
      ambience: 'ruins',
      priority: 2,
      contains: (x, z) => x < -30 && z > -20 && z < 14,
    },
    {
      id: 'gate',
      name: 'Gate of the Sunken Kings',
      atmosphere: 'ruins',
      ambience: 'ruins',
      priority: 3,
      contains: (x, z) => z < -101 && Math.abs(x - L.gate.x) < 30,
    },
  ];
}
