import * as THREE from 'three';
import type { HumanoidRig } from '../rig/HumanoidRig';

/** IK goal for one hand, expressed in the rig mesh space (character space, unscaled). */
export interface HandGoal {
  /** Wrist/grip target position. */
  pos: THREE.Vector3;
  /** Desired blade direction (hand +Z). */
  dir: THREE.Vector3;
  /** 0 = keep FK pose, 1 = fully IK. */
  weight: number;
}

export function createHandGoal(): HandGoal {
  return { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), weight: 0 };
}

const _meshInv = new THREE.Matrix4();
const _chestM = new THREE.Matrix4();
const _chestInv = new THREE.Matrix4();
const _chestRot = new THREE.Matrix3();
const _T = new THREE.Vector3();
const _D = new THREE.Vector3();
const _S = new THREE.Vector3();
const _dirT = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _E = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _X = new THREE.Vector3();
const _Y = new THREE.Vector3();
const _Z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _qU = new THREE.Quaternion();
const _qF = new THREE.Quaternion();
const _qH = new THREE.Quaternion();
const _qUF = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _Df = new THREE.Vector3();
const _Tc = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const POLE_R = new THREE.Vector3(-0.55, -0.9, -0.6).normalize();
const POLE_L = new THREE.Vector3(0.55, -0.9, -0.6).normalize();

function basisQuat(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

/**
 * Analytic two-bone IK for an arm (upper arm + forearm) plus hand orientation so the held
 * weapon points along `goal.dir`. Must be called after the torso bones have been posed.
 */
export function solveArm(rig: HumanoidRig, side: 'L' | 'R', goal: HandGoal): void {
  if (goal.weight <= 0.001) return;
  const upper = rig.bones[side === 'R' ? 'upperArmR' : 'upperArmL'];
  const fore = rig.bones[side === 'R' ? 'forearmR' : 'forearmL'];
  const hand = rig.bones[side === 'R' ? 'handR' : 'handL'];
  const chest = rig.bones.chest;

  // Chest frame expressed in mesh space.
  rig.mesh.updateWorldMatrix(true, false);
  chest.updateWorldMatrix(true, false);
  _meshInv.copy(rig.mesh.matrixWorld).invert();
  _chestM.multiplyMatrices(_meshInv, chest.matrixWorld);
  _chestInv.copy(_chestM).invert();
  _chestRot.setFromMatrix4(_chestInv);

  _T.copy(goal.pos).applyMatrix4(_chestInv);
  _D.copy(goal.dir).applyMatrix3(_chestRot).normalize();
  _S.copy(upper.position);

  const a = fore.position.length();
  const b = hand.position.length() + 0.05;
  _dirT.subVectors(_T, _S);
  let L = _dirT.length();
  if (L < 1e-5) return;
  _dirT.divideScalar(L);
  L = THREE.MathUtils.clamp(L, Math.abs(a - b) + 0.02, a + b - 0.002);
  _Tc.copy(_S).addScaledVector(_dirT, L);

  const cosA = THREE.MathUtils.clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _pole.copy(side === 'R' ? POLE_R : POLE_L);
  _pole.addScaledVector(_dirT, -_pole.dot(_dirT));
  if (_pole.lengthSq() < 1e-6) _pole.set(0, -1, 0).addScaledVector(_dirT, -_dirT.y);
  _pole.normalize();
  _E.copy(_S).addScaledVector(_dirT, a * cosA).addScaledVector(_pole, a * sinA);

  // Upper arm orientation: -Y along the upper arm, Z towards the forearm bend direction.
  _d1.subVectors(_E, _S).normalize();
  _d2.subVectors(_Tc, _E).normalize();
  _Y.copy(_d1).negate();
  _Z.copy(_d2).addScaledVector(_d1, -_d2.dot(_d1));
  if (_Z.lengthSq() < 1e-6) {
    _Z.copy(_pole).negate();
  }
  _Z.normalize();
  _X.crossVectors(_Y, _Z).normalize();
  _Z.crossVectors(_X, _Y).normalize();
  basisQuat(_X, _Y, _Z, _qU);

  // Forearm: pure X rotation in the upper arm frame.
  _Df.copy(_d2).applyQuaternion(_qTmp.copy(_qU).invert());
  const beta = Math.atan2(_Df.z, -_Df.y);
  _qF.setFromAxisAngle(_X.set(1, 0, 0), -beta);

  // Hand: +Z along the blade, +Y back up the forearm as much as possible.
  _qUF.multiplyQuaternions(_qU, _qF);
  _Z.copy(_D).applyQuaternion(_qTmp.copy(_qUF).invert()).normalize();
  _Y.copy(UP).addScaledVector(_Z, -_Z.dot(UP));
  if (_Y.lengthSq() < 1e-5) _Y.copy(FWD).addScaledVector(_Z, -_Z.z);
  _Y.normalize();
  _X.crossVectors(_Y, _Z).normalize();
  basisQuat(_X, _Y, _Z, _qH);

  const w = goal.weight;
  if (w >= 0.999) {
    upper.quaternion.copy(_qU);
    fore.quaternion.copy(_qF);
    hand.quaternion.copy(_qH);
  } else {
    upper.quaternion.slerp(_qU, w);
    fore.quaternion.slerp(_qF, w);
    hand.quaternion.slerp(_qH, w);
  }
}
