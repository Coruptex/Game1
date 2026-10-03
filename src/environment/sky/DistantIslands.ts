import * as THREE from 'three';
import { Rng } from '../../utils/random';
import { Noise2D } from '../../utils/noise';

/**
 * Hazy island silhouettes on the horizon (fog does the atmospheric perspective). Gives the open
 * sea depth and hints at future islands to explore.
 */
export function buildDistantIslands(seed = 21): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DistantIslands';
  const rng = new Rng(seed);
  const noise = new Noise2D(seed);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const defs = [
    { angle: 0.35, dist: 420, r: 70, h: 55 },
    { angle: 0.75, dist: 520, r: 110, h: 95 },
    { angle: -0.5, dist: 470, r: 60, h: 38 },
    { angle: 1.35, dist: 380, r: 45, h: 30 },
    { angle: -1.2, dist: 560, r: 120, h: 70 },
    { angle: 2.1, dist: 500, r: 80, h: 48 },
    { angle: -2.3, dist: 430, r: 55, h: 42 },
  ];
  const green = new THREE.Color(0x4f7f45);
  const rock = new THREE.Color(0x8a8a7a);
  const sand = new THREE.Color(0xe0d0a0);
  for (const d of defs) {
    // a noisy cone becomes a hazy tropical island mound
    const g2 = new THREE.ConeGeometry(d.r, d.h, 40, 8, false);
    const pos = g2.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i) + d.h / 2;
      const z = pos.getZ(i);
      const n = noise.fbm(x * 0.03 + d.angle * 10, z * 0.03, 3);
      const k = y / d.h;
      const ny = Math.max(0, y * (0.75 + n * 0.35) + Math.pow(1 - k, 3) * -4);
      const spread = 1 + n * 0.25;
      pos.setXYZ(i, x * spread, ny, z * spread);
      c.copy(sand).lerp(green, Math.min(1, k * 6)).lerp(rock, Math.max(0, k - 0.65) * 1.5);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g2.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g2.computeVertexNormals();
    const mesh = new THREE.Mesh(g2, mat);
    // angle measured around the island centre; place towards the south/east/west horizons
    const a = d.angle + Math.PI;
    mesh.position.set(Math.sin(a) * d.dist + 20, -2, -Math.cos(a) * d.dist + 60);
    mesh.rotation.y = rng.range(0, Math.PI * 2);
    mesh.scale.set(1, 1, rng.range(0.6, 1.0));
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
  return group;
}
