import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HumanoidRig } from '../src/characters/rig/HumanoidRig';
import { PLAYER_APPEARANCE } from '../src/characters/rig/Appearance';
import { Animator } from '../src/characters/animation/Animator';
import { ALL_CLIPS } from '../src/characters/animation/Clips';

/**
 * Every IK key of every clip must be reachable with the clip's own torso pose, and the weapon
 * must point where the key says. Guards against authoring sword arcs the arm cannot follow.
 */
describe('animation clips', () => {
  for (const [name, clip] of Object.entries(ALL_CLIPS)) {
    if (!clip.ikR || name === 'hit') continue; // 'hit' blends IK at 70% by design
    it(`${name}: IK keys reachable and blade aligned`, () => {
      for (let k = 0; k < clip.ikR!.times.length; k++) {
        const t = clip.ikR!.times[k];
        const rig = new HumanoidRig(PLAYER_APPEARANCE);
        const anim = new Animator(rig);
        anim.play(clip, { startTime: t, speed: 0, hold: true });
        for (let i = 0; i < 20; i++) anim.update(0.05);
        const w = clip.ikRWeight ? clip.ikRWeight.find(([kt]) => Math.abs(kt - t) < 1e-6)?.[1] ?? 1 : 1;
        if (w < 0.99) continue;
        rig.mesh.updateWorldMatrix(true, true);
        const inv = rig.mesh.matrixWorld.clone().invert();
        const wrist = new THREE.Vector3().setFromMatrixPosition(rig.bones.handR.matrixWorld).applyMatrix4(inv);
        const base = new THREE.Vector3();
        const tip = new THREE.Vector3();
        rig.getBladeWorld(base, tip);
        const dir = tip.sub(base).normalize().transformDirection(inv);
        expect(wrist.distanceTo(clip.ikR!.pos[k]), `${name} t=${t} position`).toBeLessThan(0.08);
        expect(dir.dot(clip.ikR!.dir[k]), `${name} t=${t} blade`).toBeGreaterThan(0.95);
      }
    });
  }
});
