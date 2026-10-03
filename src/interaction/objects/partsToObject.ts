import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PropPart } from '../../environment/PropTypes';
import type { MaterialLibrary } from '../../assets/materials/MaterialLibrary';
import { ensureStandardAttributes } from '../../assets/geometry/GeometryUtils';

/** Builds a standalone (non-batched) object from prop parts, merging parts per material. */
export function partsToObject(parts: PropPart[], materials: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const byMat = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }>();
  for (const p of parts) {
    const mat = materials.get(p.material, { seeThrough: p.seeThrough });
    const key = `${mat.uuid}|${p.castShadow ?? true}`;
    let e = byMat.get(key);
    if (!e) {
      e = { mat, geos: [], cast: p.castShadow ?? true };
      byMat.set(key, e);
    }
    e.geos.push(ensureStandardAttributes(p.geometry.clone()));
  }
  for (const e of byMat.values()) {
    const g = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, e.mat);
    mesh.castShadow = e.cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
