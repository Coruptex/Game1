import * as THREE from 'three';
import { ensureStandardAttributes } from '../../assets/geometry/GeometryUtils';
import { ensureWindHeight } from '../../assets/materials/ShaderPatches';

export interface InstancePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface InstanceVariant {
  parts: InstancePart[];
}

interface CellBatch {
  matrices: THREE.Matrix4[];
  colors: (THREE.Color | null)[];
}

/**
 * Instanced placement of repeated assets (palms, ferns, flowers, coral, path stones...).
 * Instances are bucketed by spatial cell so each InstancedMesh gets a tight bounding sphere
 * and off-screen cells are culled.
 */
export class InstancedScatter {
  private readonly variants = new Map<string, InstanceVariant>();
  private readonly cells = new Map<string, Map<string, CellBatch>>();
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly cellSize = 40) {}

  register(key: string, variant: InstanceVariant): void {
    for (const p of variant.parts) {
      ensureStandardAttributes(p.geometry);
      if (p.material.userData.windSway) ensureWindHeight(p.geometry);
      p.geometry.computeBoundingSphere();
    }
    this.variants.set(key, variant);
  }

  has(key: string): boolean {
    return this.variants.has(key);
  }

  add(key: string, matrix: THREE.Matrix4, color?: THREE.ColorRepresentation): void {
    if (!this.variants.has(key)) throw new Error(`InstancedScatter: unknown variant ${key}`);
    this.tmp.setFromMatrixPosition(matrix);
    const cell = `${Math.floor(this.tmp.x / this.cellSize)},${Math.floor(this.tmp.z / this.cellSize)}`;
    let byVariant = this.cells.get(cell);
    if (!byVariant) {
      byVariant = new Map();
      this.cells.set(cell, byVariant);
    }
    let batch = byVariant.get(key);
    if (!batch) {
      batch = { matrices: [], colors: [] };
      byVariant.set(key, batch);
    }
    batch.matrices.push(matrix.clone());
    batch.colors.push(color !== undefined ? new THREE.Color(color) : null);
  }

  build(parent: THREE.Object3D): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    for (const [cell, byVariant] of this.cells) {
      for (const [key, batch] of byVariant) {
        const variant = this.variants.get(key)!;
        const hasColor = batch.colors.some((c) => c !== null);
        for (const part of variant.parts) {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, batch.matrices.length);
          mesh.name = `inst:${key}:${cell}`;
          for (let i = 0; i < batch.matrices.length; i++) {
            mesh.setMatrixAt(i, batch.matrices[i]);
            if (hasColor) mesh.setColorAt(i, batch.colors[i] ?? new THREE.Color(1, 1, 1));
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.castShadow = part.castShadow ?? false;
          mesh.receiveShadow = part.receiveShadow ?? true;
          mesh.computeBoundingSphere();
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
          parent.add(mesh);
          out.push(mesh);
        }
      }
    }
    this.cells.clear();
    return out;
  }
}
