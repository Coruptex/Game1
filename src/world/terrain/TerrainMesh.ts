import * as THREE from 'three';
import type { Heightfield } from './Heightfield';
import { applyStylePatches } from '../../assets/materials/ShaderPatches';
import { groundDetailTexture } from '../../assets/textures/ProceduralTextures';

export type TerrainColorFn = (x: number, z: number, h: number, slope: number, out: THREE.Color) => void;

/**
 * Builds the terrain as a set of chunk meshes (for frustum culling) sharing one material.
 * Vertex colours come from the area's colour function; a painterly detail texture is applied in
 * world space and underwater areas get animated caustics through the shared shader patches.
 */
export function buildTerrainMeshes(
  hf: Heightfield,
  colorFn: TerrainColorFn,
  options: { chunkCells?: number; caustics?: boolean; detailScale?: number } = {},
): { group: THREE.Group; material: THREE.Material } {
  const chunkCells = options.chunkCells ?? 48;
  const detailScale = options.detailScale ?? 0.11;
  const material = applyStylePatches(
    new THREE.MeshLambertMaterial({ vertexColors: true, map: groundDetailTexture() }),
    { caustics: options.caustics ?? true },
  );
  material.name = 'terrain';
  const group = new THREE.Group();
  group.name = 'Terrain';

  // Pre-compute colours per grid vertex (shared between chunks so borders match).
  const colors = new Float32Array(hf.cols * hf.rows * 3);
  const c = new THREE.Color();
  for (let j = 0; j < hf.rows; j++) {
    for (let i = 0; i < hf.cols; i++) {
      const x = hf.xAt(i);
      const z = hf.zAt(j);
      const h = hf.get(i, j);
      const dx = (hf.get(i + 1, j) - hf.get(i - 1, j)) / (2 * hf.cell);
      const dz = (hf.get(i, j + 1) - hf.get(i, j - 1)) / (2 * hf.cell);
      colorFn(x, z, h, Math.sqrt(dx * dx + dz * dz), c);
      const k = (j * hf.cols + i) * 3;
      colors[k] = c.r;
      colors[k + 1] = c.g;
      colors[k + 2] = c.b;
    }
  }

  for (let cj = 0; cj < hf.rows - 1; cj += chunkCells) {
    for (let ci = 0; ci < hf.cols - 1; ci += chunkCells) {
      const i1 = Math.min(ci + chunkCells, hf.cols - 1);
      const j1 = Math.min(cj + chunkCells, hf.rows - 1);
      const w = i1 - ci + 1;
      const d = j1 - cj + 1;
      const pos = new Float32Array(w * d * 3);
      const col = new Float32Array(w * d * 3);
      const uv = new Float32Array(w * d * 2);
      let minH = Infinity;
      let maxH = -Infinity;
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < w; i++) {
          const gi = ci + i;
          const gj = cj + j;
          const x = hf.xAt(gi);
          const z = hf.zAt(gj);
          const h = hf.get(gi, gj);
          minH = Math.min(minH, h);
          maxH = Math.max(maxH, h);
          const k = j * w + i;
          pos[k * 3] = x;
          pos[k * 3 + 1] = h;
          pos[k * 3 + 2] = z;
          const ck = (gj * hf.cols + gi) * 3;
          col[k * 3] = colors[ck];
          col[k * 3 + 1] = colors[ck + 1];
          col[k * 3 + 2] = colors[ck + 2];
          uv[k * 2] = x * detailScale;
          uv[k * 2 + 1] = z * detailScale;
        }
      }
      // Skip chunks that are entirely deep underwater: the water is opaque there.
      if (maxH < -9) continue;
      const idx: number[] = [];
      for (let j = 0; j < d - 1; j++) {
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i; // (i, j)
          const b = j * w + i + 1; // (i+1, j)
          const e = (j + 1) * w + i; // (i, j+1)
          const f = (j + 1) * w + i + 1; // (i+1, j+1)
          // Must match Heightfield.heightAt triangle split: (00, 01, 11) and (00, 11, 10)
          idx.push(a, e, f, a, f, b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      fixChunkBorderNormals(geo, hf, ci, cj, w, d);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `terrain:${ci},${cj}`;
      mesh.receiveShadow = true;
      mesh.castShadow = maxH > 3;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
  return { group, material };
}

/** Recomputes normals from the full heightfield so lighting is continuous across chunk seams. */
function fixChunkBorderNormals(geo: THREE.BufferGeometry, hf: Heightfield, ci: number, cj: number, w: number, d: number): void {
  const n = geo.attributes.normal as THREE.BufferAttribute;
  const e = hf.cell;
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      const gi = ci + i;
      const gj = cj + j;
      const dx = (hf.get(gi + 1, gj) - hf.get(gi - 1, gj)) / (2 * e);
      const dz = (hf.get(gi, gj + 1) - hf.get(gi, gj - 1)) / (2 * e);
      const len = Math.sqrt(dx * dx + 1 + dz * dz);
      n.setXYZ(j * w + i, -dx / len, 1 / len, -dz / len);
    }
  }
  n.needsUpdate = true;
}

/**
 * Bakes the heightfield into a float texture (R = height) used by the water shader to compute
 * depth (shallow turquoise vs deep blue, shoreline foam).
 */
export function bakeHeightTexture(hf: Heightfield, resolution = 512): { texture: THREE.DataTexture; bounds: THREE.Vector4 } {
  // Half floats are linearly filterable on every WebGL2 device (full floats are not on many mobiles).
  const data = new Uint16Array(resolution * resolution);
  for (let j = 0; j < resolution; j++) {
    const z = hf.minZ + (j / (resolution - 1)) * (hf.maxZ - hf.minZ);
    for (let i = 0; i < resolution; i++) {
      const x = hf.minX + (i / (resolution - 1)) * (hf.maxX - hf.minX);
      data[j * resolution + i] = THREE.DataUtils.toHalfFloat(hf.heightAt(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, resolution, resolution, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { texture: tex, bounds: new THREE.Vector4(hf.minX, hf.minZ, hf.maxX - hf.minX, hf.maxZ - hf.minZ) };
}
