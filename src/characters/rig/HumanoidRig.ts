import * as THREE from 'three';
import { DEFAULT_PROPORTIONS, JOINT_INDEX, JOINT_PARENT, JOINTS, jointOffsets, type JointName, type Proportions } from './Joints';
import type { Appearance } from './Appearance';
import { buildBodyParts, buildWeapon, mergeSimple } from './PartBuilders';
import type { Pose } from '../animation/Pose';
import { applyStylePatches } from '../../assets/materials/ShaderPatches';
import { skyEnvironmentTexture } from '../../assets/textures/ProceduralTextures';

/**
 * Procedural humanoid: all rigid body parts are merged into ONE skinned mesh (each vertex bound
 * to a single bone), plus an inverted-hull ink outline sharing the skeleton. Two draw calls per
 * character, any number of parts.
 */
export class HumanoidRig {
  readonly object = new THREE.Group();
  readonly bones = {} as Record<JointName, THREE.Bone>;
  readonly mesh: THREE.SkinnedMesh;
  readonly outline: THREE.SkinnedMesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly outlineMaterial: THREE.MeshBasicMaterial;
  readonly weapon: THREE.Mesh | null = null;
  readonly weaponMaterial: THREE.MeshStandardMaterial | null = null;
  /** Points on the blade (in weapon space) used for trails and hit sparks. */
  readonly bladeBase = new THREE.Vector3(0, 0, 0.12);
  readonly bladeTip = new THREE.Vector3(0, 0, 0.85);
  readonly proportions: Proportions;
  private readonly bindOffsets: Record<JointName, [number, number, number]>;
  private flashTimer = 0;
  private flashDuration = 0.12;
  private readonly flashColor = new THREE.Color();

  constructor(readonly appearance: Appearance) {
    this.proportions = { ...DEFAULT_PROPORTIONS, ...appearance.proportions };
    this.bindOffsets = jointOffsets(this.proportions);

    // --- skeleton ---------------------------------------------------------
    const boneList: THREE.Bone[] = [];
    for (const j of JOINTS) {
      const b = new THREE.Bone();
      b.name = j;
      const o = this.bindOffsets[j];
      b.position.set(o[0], o[1], o[2]);
      this.bones[j] = b;
      boneList.push(b);
    }
    for (const j of JOINTS) {
      const parent = JOINT_PARENT[j];
      if (parent) this.bones[parent].add(this.bones[j]);
    }
    const rootBone = this.bones.body;
    rootBone.updateMatrixWorld(true);

    // --- geometry: transform each part into model space + skin attributes ----
    const parts = buildBodyParts(appearance, this.proportions);
    const geos: THREE.BufferGeometry[] = [];
    for (const part of parts) {
      const g = part.geometry;
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(this.bones[part.joint].matrixWorld);
      geos.push(g);
    }
    const merged = mergeSimple(geos);
    const count = merged.attributes.position.count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    let v = 0;
    for (let p = 0; p < parts.length; p++) {
      const n = geos[p].attributes.position.count;
      const bi = JOINT_INDEX[parts[p].joint];
      for (let i = 0; i < n; i++, v++) {
        skinIndex[v * 4] = bi;
        skinWeight[v * 4] = 1;
      }
    }
    merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    merged.computeBoundingSphere();

    // --- materials -----------------------------------------------------------
    this.material = applyStylePatches(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide }),
      { rim: { color: 0xfff1d8, strength: 0.32, power: 2.6 } },
    );
    this.outlineMaterial = new THREE.MeshBasicMaterial({ color: appearance.outline ?? 0x140e0b, side: THREE.BackSide });
    this.outlineMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * 0.017;',
      );
    };
    this.outlineMaterial.customProgramCacheKey = () => 'charOutline';

    const skeleton = new THREE.Skeleton(boneList);
    this.mesh = new THREE.SkinnedMesh(merged, this.material);
    this.mesh.name = 'humanoid';
    this.mesh.add(rootBone);
    this.mesh.bind(skeleton);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this.outline = new THREE.SkinnedMesh(merged, this.outlineMaterial);
    this.outline.name = 'humanoid-outline';
    this.outline.bind(skeleton, this.mesh.bindMatrix);
    this.outline.castShadow = false;
    this.outline.receiveShadow = false;
    this.outline.frustumCulled = false;

    this.object.add(this.mesh, this.outline);

    // --- weapon ----------------------------------------------------------------
    const w = buildWeapon(appearance.weapon);
    if (w) {
      this.weaponMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.65,
        roughness: 0.35,
        // (no canvas in headless unit tests)
        envMap: typeof document === 'undefined' ? null : skyEnvironmentTexture(),
        envMapIntensity: 0.7,
      });
      this.weapon = new THREE.Mesh(w.geometry, this.weaponMaterial);
      this.weapon.name = 'weapon';
      this.weapon.castShadow = true;
      this.weapon.position.set(0, -0.06, 0.015);
      this.bones.handR.add(this.weapon);
      this.bladeTip.set(0, 0, w.bladeLength);
    }

    const scale = appearance.scale ?? 1;
    this.object.scale.setScalar(scale);
  }

  /** Writes a pose into the bones. */
  applyPose(pose: Pose): void {
    const r = pose.rot;
    for (let i = 0; i < JOINTS.length; i++) {
      const b = this.bones[JOINTS[i]];
      b.rotation.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]);
    }
    const o = this.bindOffsets.body;
    this.bones.body.position.set(o[0] + pose.bodyX, o[1] + pose.bodyY, o[2] + pose.bodyZ);
  }

  /** World-space blade points (for sword trails / sparks). */
  getBladeWorld(base: THREE.Vector3, tip: THREE.Vector3): boolean {
    if (!this.weapon) return false;
    this.weapon.updateWorldMatrix(true, false);
    base.copy(this.bladeBase).applyMatrix4(this.weapon.matrixWorld);
    tip.copy(this.bladeTip).applyMatrix4(this.weapon.matrixWorld);
    return true;
  }

  /** Brief emissive flash (damage feedback). */
  flash(color: THREE.ColorRepresentation, duration = 0.12): void {
    this.flashColor.set(color);
    this.flashTimer = duration;
    this.flashDuration = duration;
  }

  setOpacity(alpha: number): void {
    const transparent = alpha < 0.999;
    for (const m of [this.material, this.outlineMaterial, this.weaponMaterial]) {
      if (!m) continue;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = alpha;
      m.depthWrite = !transparent;
    }
    this.mesh.castShadow = alpha > 0.5;
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(0, this.flashTimer / this.flashDuration);
      this.material.emissive.copy(this.flashColor).multiplyScalar(k * k * 0.45);
    } else if (this.material.emissive.r !== 0 || this.material.emissive.g !== 0) {
      this.material.emissive.setRGB(0, 0, 0);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.outlineMaterial.dispose();
    this.weapon?.geometry.dispose();
    this.weaponMaterial?.dispose();
    this.mesh.skeleton.dispose();
  }
}
