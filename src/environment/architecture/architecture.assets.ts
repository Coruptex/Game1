import type { AssetCatalog } from '../PropTypes';
import {
  altar,
  archway,
  buildAncientGate,
  buildCryptFacade,
  buildEmberShrineBase,
  cobblestone,
  column,
  pavingSlab,
  pavingSlabs,
  ruinedWall,
  rubblePile,
  statue,
  stele,
  stoneStairs,
} from './Ancient';
import { buildFortress } from './Fortress';

/**
 * Viewer catalog for the ancient architecture module.
 * e.g. /viewer.html?asset=ancient-gate&dist=32&yaw=0.5&pitch=0.3&ty=5
 */
export const assets: AssetCatalog = {
  'ancient-gate': () => ({ kind: 'prop', def: buildAncientGate() }),
  'ruined-wall': () => ({ kind: 'prop', def: ruinedWall({ length: 8, height: 3.2, seed: 1 }) }),
  'ruined-wall-low': () => ({ kind: 'prop', def: ruinedWall({ length: 5, height: 1.4, seed: 4 }) }),
  'column-intact': () => ({ kind: 'prop', def: column('intact', 1) }),
  'column-broken': () => ({ kind: 'prop', def: column('broken', 2) }),
  'column-fallen': () => ({ kind: 'prop', def: column('fallen', 3) }),
  archway: () => ({ kind: 'prop', def: archway({ width: 3.2, height: 4.6 }) }),
  'stone-stairs': () => ({ kind: 'prop', def: stoneStairs({ width: 4, steps: 8, rise: 2.5, run: 7.5 }) }),
  paving: () => ({ kind: 'prop', def: pavingSlabs({ radius: 6, seed: 1, coverage: 0.85 }) }),
  'statue-0': () => ({ kind: 'prop', def: statue(0) }),
  'statue-1': () => ({ kind: 'prop', def: statue(1) }),
  stele: () => ({ kind: 'prop', def: stele() }),
  altar: () => ({ kind: 'prop', def: altar() }),
  rubble: () => ({ kind: 'prop', def: rubblePile(1) }),
  'crypt-facade': () => ({ kind: 'prop', def: buildCryptFacade() }),
  'ember-shrine': () => ({ kind: 'prop', def: buildEmberShrineBase().def }),
  cobblestones: () => ({ kind: 'instanced', asset: cobblestone(0), count: 25, spacing: 0.6 }),
  'cobblestones-1': () => ({ kind: 'instanced', asset: cobblestone(1), count: 25, spacing: 0.6 }),
  'cobblestones-2': () => ({ kind: 'instanced', asset: cobblestone(2), count: 25, spacing: 0.6 }),
  'cobblestones-3': () => ({ kind: 'instanced', asset: cobblestone(3), count: 25, spacing: 0.6 }),
  'paving-slab': () => ({ kind: 'instanced', asset: pavingSlab(0), count: 9, spacing: 1.15 }),
  'paving-slab-1': () => ({ kind: 'instanced', asset: pavingSlab(1), count: 9, spacing: 1.2 }),
  fortress: () => ({ kind: 'prop', def: buildFortress() }),
};
