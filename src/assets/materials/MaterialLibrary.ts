import * as THREE from 'three';
import { applyStylePatches, type PatchOptions } from './ShaderPatches';
import {
  broadLeafTexture,
  fernFrondTexture,
  grassCardTexture,
  jollyRogerTexture,
  jungleBarkTexture,
  leafClusterTexture,
  palmBarkTexture,
  palmFrondTexture,
  rockDetailTexture,
  sailClothTexture,
  stoneBlocksTexture,
  thatchTexture,
  woodGrainTexture,
  woodPlanksTexture,
} from '../textures/ProceduralTextures';

/**
 * Art-direction palette derived from the reference images. Keep colours here so the whole
 * game stays coherent; props should pick from this list (with small per-instance variation).
 */
export const Palette = {
  // ground
  sand: 0xead9a8,
  sandWarm: 0xe2c68e,
  sandWet: 0xbfa77a,
  grass: 0x5f9c38,
  grassLight: 0x93c552,
  grassDry: 0xa7a85a,
  jungleFloor: 0x3d6526,
  moss: 0x5d7f2c,
  dirt: 0x8b6b45,
  pathStone: 0xb9ab8c,
  // rock & stone
  rock: 0x8f8a7c,
  rockDark: 0x5e5a50,
  rockWarm: 0xa08e74,
  stone: 0xbab196,
  stoneDark: 0x857e68,
  // wood
  wood: 0x8c6a44,
  woodDark: 0x5c4029,
  woodPale: 0xb3956b,
  woodRed: 0x7a3b26,
  rope: 0xc6a874,
  // cloth & accents
  sail: 0xf1e6cc,
  canvas: 0xd9c9a0,
  pirateRed: 0xa32a22,
  pirateNavy: 0x22304a,
  gold: 0xf2c14e,
  brass: 0xc9973a,
  iron: 0x3b3d40,
  // flora accents
  flowerRed: 0xe0362b,
  flowerOrange: 0xf28a1e,
  flowerPurple: 0xb35ad6,
  flowerPink: 0xf07aa8,
  flowerYellow: 0xf7d23e,
  // water
  waterShallow: 0x34d8c8,
  waterMid: 0x12a9c2,
  waterDeep: 0x0b4f86,
  // magic
  ember: 0xff8a2a,
  emberCore: 0xffe2a0,
} as const;

export type MaterialName =
  | 'wood'
  | 'woodPlanks'
  | 'woodDark'
  | 'woodPale'
  | 'stone'
  | 'stoneBlocks'
  | 'rock'
  | 'vertexColor'
  | 'metal'
  | 'gold'
  | 'brass'
  | 'sail'
  | 'flag'
  | 'rope'
  | 'thatch'
  | 'cloth'
  | 'palmBark'
  | 'palmLeaf'
  | 'jungleBark'
  | 'canopy'
  | 'canopyLight'
  | 'canopyDark'
  | 'fern'
  | 'broadLeaf'
  | 'grass'
  | 'flower'
  | 'coral'
  | 'emberGlow'
  | 'glass';

export interface MaterialVariant {
  /** Apply the dithered see-through effect (tall props that can hide the player). */
  seeThrough?: boolean;
}

/** Creates and caches every shared environment material. */
export class MaterialLibrary {
  private readonly cache = new Map<string, THREE.Material>();

  get(name: MaterialName, variant: MaterialVariant = {}): THREE.Material {
    const key = `${name}|${variant.seeThrough ? 'st' : ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = this.create(name, variant);
      m.name = key;
      this.cache.set(key, m);
    }
    return m;
  }

  /** All materials created so far (used for pre-compilation and quality switches). */
  all(): THREE.Material[] {
    return Array.from(this.cache.values());
  }

  private create(name: MaterialName, variant: MaterialVariant): THREE.Material {
    const st = !!variant.seeThrough;
    const lambert = (params: THREE.MeshLambertMaterialParameters, patch: PatchOptions = {}) =>
      applyStylePatches(new THREE.MeshLambertMaterial({ vertexColors: true, ...params }), { seeThrough: st, ...patch });
    const standard = (params: THREE.MeshStandardMaterialParameters, patch: PatchOptions = {}) =>
      applyStylePatches(new THREE.MeshStandardMaterial({ vertexColors: true, ...params }), { seeThrough: st, ...patch });

    switch (name) {
      case 'wood':
        return lambert({ map: woodGrainTexture() }, { caustics: true });
      case 'woodPlanks':
        return lambert({ map: woodPlanksTexture() }, { caustics: true });
      case 'woodDark':
        return lambert({ map: woodGrainTexture(), color: 0x8a7a6a }, { caustics: true });
      case 'woodPale':
        return lambert({ map: woodGrainTexture(), color: 0xe8dccb }, { caustics: true });
      case 'stone':
        return lambert({ map: rockDetailTexture() }, { caustics: true });
      case 'stoneBlocks':
        return lambert({ map: stoneBlocksTexture() }, { caustics: true });
      case 'rock':
        return lambert({ map: rockDetailTexture() }, { caustics: true });
      case 'vertexColor':
        return lambert({}, { caustics: true });
      case 'metal':
        return standard({ color: 0xffffff, metalness: 0.75, roughness: 0.42 });
      case 'gold':
        return standard({ color: 0xffffff, metalness: 0.95, roughness: 0.28, emissive: 0x3a2400, emissiveIntensity: 0.6 });
      case 'brass':
        return standard({ color: 0xffffff, metalness: 0.85, roughness: 0.38 });
      case 'sail':
        return lambert(
          { map: sailClothTexture(), side: THREE.DoubleSide },
          { cloth: { amplitude: 0.35, frequency: 3, speed: 1.6, billow: 0.6 } },
        );
      case 'flag':
        return lambert(
          { map: jollyRogerTexture(), side: THREE.DoubleSide, vertexColors: false },
          { cloth: { amplitude: 0.22, frequency: 9, speed: 7 } },
        );
      case 'rope':
        return lambert({ color: Palette.rope });
      case 'thatch':
        return lambert({ map: thatchTexture() });
      case 'cloth':
        return lambert({ side: THREE.DoubleSide }, { cloth: { amplitude: 0.05, frequency: 5, speed: 2.5 } });
      case 'palmBark':
        return lambert({ map: palmBarkTexture() }, { wind: { sway: 0.4, heightScale: 0.1, flutter: 0 } });
      case 'palmLeaf':
        return lambert(
          { map: palmFrondTexture(), alphaTest: 0.45, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.4, heightScale: 0.1, flutter: 0.06 } },
        );
      case 'jungleBark':
        return lambert({ map: jungleBarkTexture() });
      case 'canopy':
        return lambert(
          { map: leafClusterTexture(0), alphaTest: 0.5, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.05, heightScale: 0.12, flutter: 0.05 } },
        );
      case 'canopyLight':
        return lambert(
          { map: leafClusterTexture(1), alphaTest: 0.5, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.06, heightScale: 0.15, flutter: 0.06 } },
        );
      case 'canopyDark':
        return lambert(
          { map: leafClusterTexture(2), alphaTest: 0.5, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.06, heightScale: 0.3, flutter: 0.04 } },
        );
      case 'fern':
        return lambert(
          { map: fernFrondTexture(), alphaTest: 0.45, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.12, heightScale: 1, flutter: 0.03 } },
        );
      case 'broadLeaf':
        return lambert(
          { map: broadLeafTexture(), alphaTest: 0.45, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.1, heightScale: 0.7, flutter: 0.03 } },
        );
      case 'grass':
        return lambert(
          { map: grassCardTexture(), alphaTest: 0.4, side: THREE.DoubleSide },
          { foliage: true, wind: { sway: 0.25, heightScale: 1.2, flutter: 0.02 } },
        );
      case 'flower':
        return lambert({ side: THREE.DoubleSide }, { foliage: true, wind: { sway: 0.15, heightScale: 1, flutter: 0.02 } });
      case 'coral':
        return lambert({}, { caustics: true });
      case 'emberGlow':
        return new THREE.MeshBasicMaterial({ color: Palette.ember, toneMapped: false });
      case 'glass':
        return standard({ color: 0xbfe8ff, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.6, vertexColors: false });
    }
  }
}
