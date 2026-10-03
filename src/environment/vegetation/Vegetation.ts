/**
 * Procedural vegetation, coral and rock assets (public entry point).
 *
 * Every builder returns an `InstancedAsset` (geometry in local space, base at y = 0, +Y up) that is
 * memoised per variant: call the builder freely, the geometry is only generated once.
 * See the individual modules for details on sizes and conventions.
 */
export { palmTree, jungleTree, jungleTreeProp, jungleTreeSmall, jungleTreeAnchors } from './Trees';
export {
  fern,
  bush,
  broadLeafPlant,
  bromeliad,
  orchidCluster,
  anthurium,
  heliconia,
  flowerPatch,
  grassClump,
  groundCover,
  hangingVines,
} from './Plants';
export { coralBranching, coralStaghorn, coralBrain, coralFan, coralTube, seaweed } from './Coral';
export { rock, cliffRock, pebbleCluster } from './Rocks';
