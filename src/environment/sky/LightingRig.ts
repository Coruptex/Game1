import * as THREE from 'three';
import { GlobalUniforms } from '../../assets/materials/GlobalUniforms';
import { damp } from '../../utils/math';
import type { Sky } from './Sky';

/**
 * Lighting & atmosphere settings that regions can blend between
 * (the jungle is darker, greener and foggier than the open harbour).
 */
export interface AtmosphereProfile {
  sunColor: THREE.ColorRepresentation;
  sunIntensity: number;
  skyLight: THREE.ColorRepresentation;
  groundLight: THREE.ColorRepresentation;
  hemiIntensity: number;
  fogColor: THREE.ColorRepresentation;
  fogDensity: number;
  exposure: number;
  saturation: number;
}

export const ATMOSPHERES: Record<string, AtmosphereProfile> = {
  harbor: {
    sunColor: 0xfff0d2,
    sunIntensity: 3.1,
    skyLight: 0xbfe6ff,
    groundLight: 0x8f9a5c,
    hemiIntensity: 1.25,
    fogColor: 0xbfe3ec,
    fogDensity: 0.0042,
    exposure: 1.0,
    saturation: 1.12,
  },
  jungle: {
    sunColor: 0xffe3a6,
    sunIntensity: 2.4,
    skyLight: 0xa6e0c0,
    groundLight: 0x4d6a2c,
    hemiIntensity: 1.0,
    fogColor: 0x9cc4a0,
    fogDensity: 0.0125,
    exposure: 1.02,
    saturation: 1.16,
  },
  ruins: {
    sunColor: 0xffe8c0,
    sunIntensity: 2.8,
    skyLight: 0xc2dcf0,
    groundLight: 0x7c7a5a,
    hemiIntensity: 1.1,
    fogColor: 0xb5d2d8,
    fogDensity: 0.0065,
    exposure: 1.0,
    saturation: 1.08,
  },
};

const tmpA = new THREE.Color();

/** Sun (with a shadow frustum that follows the player), sky/ground hemisphere light and fog. */
export class LightingRig {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fill: THREE.DirectionalLight;
  readonly fog: THREE.FogExp2;
  /** Direction from the scene towards the sun. */
  readonly sunDirection = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();

  private target: AtmosphereProfile = ATMOSPHERES.harbor;
  private current = {
    sunColor: new THREE.Color(),
    sunIntensity: 0,
    skyLight: new THREE.Color(),
    groundLight: new THREE.Color(),
    hemiIntensity: 0,
    fogColor: new THREE.Color(),
    fogDensity: 0,
    exposure: 1,
    saturation: 1,
  };
  private shadowExtent = 34;

  constructor(
    scene: THREE.Scene,
    private readonly sky: Sky,
  ) {
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.name = 'Sun';
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.intensity = 0.82;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfe6ff, 0x8f9a5c, 1.2);
    scene.add(this.hemi);

    // Cool, shadowless rim/fill from the opposite side keeps shadowed shapes readable.
    this.fill = new THREE.DirectionalLight(0x9cc8ff, 0.35);
    this.fill.position.set(0.5, 0.4, -0.6).multiplyScalar(50);
    scene.add(this.fill);

    this.fog = new THREE.FogExp2(0xbfe3ec, 0.004);
    scene.fog = this.fog;

    GlobalUniforms.uSunDir.value.copy(this.sunDirection);
    this.snapToProfile(ATMOSPHERES.harbor);
  }

  configureShadows(mapSize: number, radius: number, extent: number): void {
    const s = this.sun.shadow;
    if (s.mapSize.x !== mapSize) {
      s.mapSize.set(mapSize, mapSize);
      s.map?.dispose();
      s.map = null;
    }
    s.radius = radius;
    this.shadowExtent = extent;
    const cam = s.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 260;
    cam.updateProjectionMatrix();
  }

  setProfile(profile: AtmosphereProfile): void {
    this.target = profile;
  }

  snapToProfile(profile: AtmosphereProfile): void {
    this.target = profile;
    const c = this.current;
    c.sunColor.set(profile.sunColor);
    c.sunIntensity = profile.sunIntensity;
    c.skyLight.set(profile.skyLight);
    c.groundLight.set(profile.groundLight);
    c.hemiIntensity = profile.hemiIntensity;
    c.fogColor.set(profile.fogColor);
    c.fogDensity = profile.fogDensity;
    c.exposure = profile.exposure;
    c.saturation = profile.saturation;
    this.apply();
  }

  get exposure(): number {
    return this.current.exposure;
  }

  get saturation(): number {
    return this.current.saturation;
  }

  /** Blends towards the target profile and keeps the shadow frustum centred on `focus`. */
  update(dt: number, focus: THREE.Vector3): void {
    const c = this.current;
    const t = this.target;
    const k = 1.4;
    c.sunColor.lerp(tmpA.set(t.sunColor), 1 - Math.exp(-k * dt));
    c.skyLight.lerp(tmpA.set(t.skyLight), 1 - Math.exp(-k * dt));
    c.groundLight.lerp(tmpA.set(t.groundLight), 1 - Math.exp(-k * dt));
    c.fogColor.lerp(tmpA.set(t.fogColor), 1 - Math.exp(-k * dt));
    c.sunIntensity = damp(c.sunIntensity, t.sunIntensity, k, dt);
    c.hemiIntensity = damp(c.hemiIntensity, t.hemiIntensity, k, dt);
    c.fogDensity = damp(c.fogDensity, t.fogDensity, k, dt);
    c.exposure = damp(c.exposure, t.exposure, k, dt);
    c.saturation = damp(c.saturation, t.saturation, k, dt);
    this.apply();

    // Shadow frustum follows the focus, snapped to shadow texels to avoid shimmering.
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDirection, 120);
    this.sun.target.updateMatrixWorld();
  }

  private apply(): void {
    const c = this.current;
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    this.hemi.color.copy(c.skyLight);
    this.hemi.groundColor.copy(c.groundLight);
    this.hemi.intensity = c.hemiIntensity;
    this.fog.color.copy(c.fogColor);
    this.fog.density = c.fogDensity;
    this.sky.uniforms.uHorizon.value.copy(c.fogColor).lerp(tmpA.set(0xffffff), 0.12);
    this.sky.uniforms.uGround.value.copy(c.fogColor);
    this.sky.uniforms.uSunColor.value.copy(c.sunColor);
    GlobalUniforms.uSunColor.value.copy(c.sunColor).multiplyScalar(c.sunIntensity / 3);
  }
}
