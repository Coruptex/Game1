import * as THREE from 'three';
import { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import { GlobalUniforms } from '../assets/materials/GlobalUniforms';
import { RenderPipeline } from '../render/RenderPipeline';
import { Sky } from '../environment/sky/Sky';
import { ATMOSPHERES, LightingRig } from '../environment/sky/LightingRig';
import { StaticBatcher } from '../world/building/StaticBatcher';
import { InstancedScatter } from '../world/building/InstancedScatter';
import { PropPlacer } from '../world/building/PropPlacer';
import { PhysicsWorld } from '../world/physics/PhysicsWorld';
import type { AssetCatalog, ViewerAsset } from '../environment/PropTypes';
import { Water } from '../environment/water/Water';

/**
 * Dev-only asset viewer: /viewer.html?asset=<name>&dist=20&yaw=0.8&pitch=0.45&water=1&ground=sand&debug
 * Every `src/**\/*.assets.ts` module is discovered automatically. Shows colliders/platforms with
 * `&colliders=1`. Used to verify procedural assets in isolation (and by headless screenshots).
 */
const catalogs = import.meta.glob<{ assets: AssetCatalog }>('/src/**/*.assets.ts', { eager: true });
const all: AssetCatalog = {};
for (const mod of Object.values(catalogs)) Object.assign(all, mod.assets);

const params = new URLSearchParams(location.search);
const name = params.get('asset') ?? Object.keys(all)[0];
const dist = Number(params.get('dist') ?? 14);
const yaw = Number(params.get('yaw') ?? 0.7);
const pitch = Number(params.get('pitch') ?? 0.42);
const targetY = Number(params.get('ty') ?? 1);
const showWater = params.get('water') === '1';
const groundKind = params.get('ground') ?? 'grass';
const showColliders = params.get('colliders') === '1';
const rotate = params.get('spin') === '1';

const root = document.getElementById('viewer-root')!;
const info = document.getElementById('viewer-info')!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 3000);
const pipeline = new RenderPipeline(root, scene, camera, 'high');
const sky = new Sky();
scene.add(sky.mesh);
const lighting = new LightingRig(scene, sky);
lighting.configureShadows(2048, 3, Math.max(20, dist * 0.9));
lighting.snapToProfile(ATMOSPHERES[params.get('atmo') ?? 'harbor'] ?? ATMOSPHERES.harbor);

const materials = new MaterialLibrary();
const groundY = showWater ? -0.6 : 0;
const groundColor = groundKind === 'sand' ? 0xe6d29c : groundKind === 'stone' ? 0xa59c82 : groundKind === 'jungle' ? 0x456e2a : 0x6aa23e;
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: groundColor }),
);
ground.position.y = groundY;
ground.receiveShadow = true;
scene.add(ground);

if (showWater) {
  const size = 512;
  const data = new Uint16Array(size * size).fill(THREE.DataUtils.toHalfFloat(params.get('deep') === '1' ? -6 : -1.2));
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.HalfFloatType);
  tex.needsUpdate = true;
  const water = new Water({ level: 0, heightTexture: tex, heightBounds: new THREE.Vector4(-200, -200, 400, 400), size: 800 });
  scene.add(water.mesh);
}

const physics = new PhysicsWorld({
  heightAt: () => groundY,
  slopeAt: () => 0,
  surfaceAt: () => 'grass',
  waterLevelAt: () => 0,
});
const batcher = new StaticBatcher();
const scatter = new InstancedScatter();
const placer = new PropPlacer(materials, batcher, physics, scatter);

let assetUpdate: ((dt: number, time: number) => void) | null = null;

function show(asset: ViewerAsset): void {
  if (asset.kind === 'prop') {
    placer.place(asset.def, 0, groundY < 0 ? 0 : 0, 0, 0, 1);
    if (showColliders) drawDebug(asset);
  } else if (asset.kind === 'instanced') {
    const n = asset.count ?? 1;
    const sp = asset.spacing ?? 3;
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const ix = (i % side) - (side - 1) / 2;
      const iz = Math.floor(i / side) - (side - 1) / 2;
      placer.instance(asset.asset, ix * sp, 0, iz * sp, i * 1.7, 1);
    }
  } else {
    scene.add(asset.object);
    assetUpdate = asset.update ?? null;
    asset.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }
  batcher.build(scene, 'viewer');
  scatter.build(scene);
}

function drawDebug(asset: ViewerAsset): void {
  if (asset.kind !== 'prop') return;
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2050, wireframe: true });
  const pmat = new THREE.MeshBasicMaterial({ color: 0x20ff60, wireframe: true });
  for (const c of asset.def.colliders ?? []) {
    const h = c.yMax - c.yMin;
    const g = c.type === 'circle' ? new THREE.CylinderGeometry(c.radius, c.radius, h, 16) : new THREE.BoxGeometry(c.halfX * 2, h, c.halfZ * 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(c.x, c.yMin + h / 2, c.z);
    if (c.type === 'box') m.rotation.y = c.yaw;
    scene.add(m);
  }
  for (const p of asset.def.platforms ?? []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.halfX * 2, 0.05, p.halfZ * 2), pmat);
    m.position.set(p.x, p.height, p.z);
    m.rotation.y = p.yaw;
    if (p.slope) m.rotation.x = -Math.atan(p.slope);
    scene.add(m);
  }
}

const factory = all[name];
if (!factory) {
  info.textContent = `Unknown asset "${name}". Available: ${Object.keys(all).join(', ')}`;
} else {
  const t0 = performance.now();
  show(factory());
  const ms = performance.now() - t0;
  let tris = 0;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry.index) tris += (m.geometry.index.count / 3) * ((o as THREE.InstancedMesh).count ?? 1);
  });
  info.textContent = `${name} — built in ${ms.toFixed(1)} ms — ~${Math.round(tris)} tris — assets: ${Object.keys(all).length}`;
}

let t = 0;
let last = performance.now();
const target = new THREE.Vector3(0, targetY, 0);
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  const y = rotate ? yaw + t * 0.3 : yaw;
  camera.position.set(Math.sin(y) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + targetY, Math.cos(y) * Math.cos(pitch) * dist);
  camera.lookAt(target);
  assetUpdate?.(dt, t);
  GlobalUniforms.uTime.value = t;
  GlobalUniforms.uCamPos.value.copy(camera.position);
  GlobalUniforms.uFocusPos.value.set(0, -1000, 0);
  lighting.update(dt, target);
  sky.update(camera);
  pipeline.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { __viewerReady: boolean; __viewerAssets: string[] }).__viewerReady = true;
(window as unknown as { __viewerAssets: string[] }).__viewerAssets = Object.keys(all);
