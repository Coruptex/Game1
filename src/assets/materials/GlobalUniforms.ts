import * as THREE from 'three';

/**
 * Uniform objects shared by every patched material. Because three.js uniforms are passed by
 * reference, updating `.value` once per frame updates all materials at once.
 */
export const GlobalUniforms = {
  uTime: { value: 0 },
  /** World position the camera focuses on (player chest). Used by the see-through effect. */
  uFocusPos: { value: new THREE.Vector3() },
  uCamPos: { value: new THREE.Vector3(0, 20, 20) },
  /** Radius (m) of the dithered see-through cylinder between camera and player. */
  uSeeThroughRadius: { value: 2.8 },
  /** 0 disables the see-through effect globally (e.g. during cutscenes). */
  uSeeThroughStrength: { value: 1 },
  uWindStrength: { value: 1 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  uWaterLevel: { value: 0 },
  uCausticStrength: { value: 1 },
  uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
};

export type GlobalUniformName = keyof typeof GlobalUniforms;
