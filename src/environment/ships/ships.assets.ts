import type { AssetCatalog } from '../PropTypes';
import { buildGalleon, buildRowboat, buildShipwreck, buildSloop } from './Ships';

/**
 * Ships & boats for the dev viewer, e.g.
 * /viewer.html?asset=galleon&dist=55&yaw=0.8&pitch=0.38&ty=6&water=1&deep=1
 */
export const assets: AssetCatalog = {
  galleon: () => ({ kind: 'prop', def: buildGalleon() }),
  sloop: () => ({ kind: 'prop', def: buildSloop() }),
  'rowboat-0': () => ({ kind: 'prop', def: buildRowboat(0) }),
  'rowboat-1': () => ({ kind: 'prop', def: buildRowboat(1) }),
  'rowboat-2': () => ({ kind: 'prop', def: buildRowboat(2) }),
  shipwreck: () => ({ kind: 'prop', def: buildShipwreck() }),
  // TEMP debug (remove): galleon without sails/ropes for collider checks
  'galleon-debug': () => {
    const d = buildGalleon();
    d.parts = d.parts.filter((p) => !['sail', 'rope', 'flag', 'cloth'].includes(p.material));
    return { kind: 'prop', def: d };
  },
};
