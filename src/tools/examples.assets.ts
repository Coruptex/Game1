import * as THREE from 'three';
import type { AssetCatalog, PropDefinition } from '../environment/PropTypes';
import { bakeGroundAO, jitterColors, paint } from '../assets/geometry/GeometryUtils';

/**
 * Reference example for asset authors: a wooden crate with a box collider.
 * View it with /viewer.html?asset=example-crate&dist=6&colliders=1
 */
export function exampleCrate(): PropDefinition {
  const body = new THREE.BoxGeometry(1, 1, 1);
  body.translate(0, 0.5, 0);
  // Textured material: keep vertex colours near white so the wood texture shows its own colour.
  paint(body, 0xfff2e0);
  jitterColors(body, 0.12);
  bakeGroundAO(body, 0.6, 0.35);
  const bands: THREE.BufferGeometry[] = [];
  for (const y of [0.12, 0.88]) {
    const b = new THREE.BoxGeometry(1.04, 0.1, 1.04);
    b.translate(0, y, 0);
    paint(b, 0xffffff);
    bands.push(b);
  }
  return {
    name: 'example-crate',
    parts: [
      { geometry: body, material: 'wood' },
      ...bands.map((geometry) => ({ geometry, material: 'woodDark' as const })),
    ],
    colliders: [{ type: 'box', x: 0, z: 0, halfX: 0.5, halfZ: 0.5, yaw: 0, yMin: 0, yMax: 1 }],
  };
}

export const assets: AssetCatalog = {
  'example-crate': () => ({ kind: 'prop', def: exampleCrate() }),
};
