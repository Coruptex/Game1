import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureStandardAttributes } from '../../assets/geometry/GeometryUtils';
import { WIND_HEIGHT_ATTRIBUTE } from '../../assets/materials/ShaderPatches';

export interface BatchOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

interface Bucket {
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  cell: string;
  geometries: THREE.BufferGeometry[];
}

/**
 * Collects static geometry while an area is being built and merges it into a small number of
 * meshes, grouped by material, shadow flags and spatial cell (so frustum culling still works).
 * This keeps draw calls low even though the hub is assembled from thousands of pieces.
 */
export class StaticBatcher {
  private readonly buckets = new Map<string, Bucket>();
  private readonly center = new THREE.Vector3();

  constructor(private readonly cellSize = 48) {}

  /**
   * Adds a geometry. If `matrix` is given the geometry is cloned and transformed; otherwise the
   * geometry is consumed as-is (callers must not reuse it).
   */
  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4, opts: BatchOptions = {}): void {
    const g = matrix ? geometry.clone().applyMatrix4(matrix) : geometry;
    ensureStandardAttributes(g);
    if (material.userData.windSway) {
      // wind sway grows with height above the prop's base, which merging into world space loses
      const pos = g.getAttribute('position');
      const baseY = matrix ? matrix.elements[13] : 0;
      const h = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) h[i] = pos.getY(i) - baseY;
      g.setAttribute(WIND_HEIGHT_ATTRIBUTE, new THREE.BufferAttribute(h, 1));
    }
    g.computeBoundingBox();
    g.boundingBox!.getCenter(this.center);
    const cx = Math.floor(this.center.x / this.cellSize);
    const cz = Math.floor(this.center.z / this.cellSize);
    const castShadow = opts.castShadow ?? true;
    const receiveShadow = opts.receiveShadow ?? true;
    const cell = `${cx},${cz}`;
    const key = `${material.uuid}|${castShadow ? 1 : 0}${receiveShadow ? 1 : 0}|${cell}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { material, castShadow, receiveShadow, cell, geometries: [] };
      this.buckets.set(key, b);
    }
    b.geometries.push(g);
  }

  /** Merges every bucket into meshes parented to `parent`. The batcher is emptied afterwards. */
  build(parent: THREE.Object3D, name = 'static'): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const b of this.buckets.values()) {
      if (b.geometries.length === 0) continue;
      const merged = b.geometries.length === 1 ? b.geometries[0] : mergeGeometries(b.geometries, false);
      if (!merged) {
        console.warn('[StaticBatcher] merge failed for', b.material.name);
        continue;
      }
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.name = `${name}:${b.material.name}:${b.cell}`;
      mesh.castShadow = b.castShadow;
      mesh.receiveShadow = b.receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
      if (b.geometries.length > 1) for (const g of b.geometries) g.dispose();
    }
    this.buckets.clear();
    return meshes;
  }

  get bucketCount(): number {
    return this.buckets.size;
  }
}
