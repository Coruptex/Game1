import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HumanoidRig } from '../src/characters/rig/HumanoidRig';
import { PLAYER_APPEARANCE } from '../src/characters/rig/Appearance';
import { Animator } from '../src/characters/animation/Animator';
import { ALL_CLIPS } from '../src/characters/animation/Clips';
import { solveArm, createHandGoal } from '../src/characters/animation/ArmIK';
import { Pose } from '../src/characters/animation/Pose';

function bladeDirMeshSpace(rig: HumanoidRig): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  rig.mesh.updateWorldMatrix(true, true);
  const inv = rig.mesh.matrixWorld.clone().invert();
  const base = new THREE.Vector3();
  const tip = new THREE.Vector3();
  rig.getBladeWorld(base, tip);
  base.applyMatrix4(inv);
  tip.applyMatrix4(inv);
  const wrist = new THREE.Vector3().setFromMatrixPosition(rig.bones.handR.matrixWorld).applyMatrix4(inv);
  return { pos: wrist, dir: tip.sub(base).normalize() };
}

describe('Arm IK', () => {
  const cases: Array<{ pos: [number, number, number]; dir: [number, number, number] }> = [
    { pos: [-0.3, 1.02, 0.32], dir: [0.12, 0.62, 0.78] },
    { pos: [-0.62, 1.34, -0.1], dir: [-0.55, 0.25, -0.8] },
    { pos: [-0.12, 2.0, -0.15], dir: [0, 0.6, -0.8] },
    { pos: [-0.22, 1.1, 0.35], dir: [0, -0.72, 0.69] },
  ];
  for (const c of cases) {
    it(`reaches ${c.pos.join(',')} with blade ${c.dir.join(',')}`, () => {
      const rig = new HumanoidRig(PLAYER_APPEARANCE);
      rig.applyPose(new Pose());
      const goal = createHandGoal();
      goal.pos.set(...c.pos);
      goal.dir.set(...c.dir).normalize();
      goal.weight = 1;
      solveArm(rig, 'R', goal);
      const r = bladeDirMeshSpace(rig);
      expect(r.pos.distanceTo(goal.pos)).toBeLessThan(0.08);
      expect(r.dir.dot(goal.dir)).toBeGreaterThan(0.95);
    });
  }

  it('produces correct blade direction with a twisted torso (combo pose)', () => {
    const rig = new HumanoidRig(PLAYER_APPEARANCE);
    const anim = new Animator(rig);
    anim.play(ALL_CLIPS.light1, { startTime: 0.32, speed: 0, hold: true });
    for (let i = 0; i < 20; i++) anim.update(0.05);
    const r = bladeDirMeshSpace(rig);
    const want = new THREE.Vector3(0.96, -0.08, -0.05).normalize();
    expect(r.dir.dot(want)).toBeGreaterThan(0.9);
  });
});
