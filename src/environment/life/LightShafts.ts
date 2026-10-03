import * as THREE from 'three';
import { lightShaftTexture } from '../../assets/textures/ProceduralTextures';
import { GlobalUniforms } from '../../assets/materials/GlobalUniforms';
import { Rng } from '../../utils/random';

/**
 * Fake volumetric god rays: additive crossed quads aligned to the sun direction, gently breathing.
 * Placed in the jungle where the canopy opens — gives the mysterious, sun-dappled look of the
 * jungle reference.
 */
export class LightShafts {
  readonly object = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;

  constructor(points: Array<{ x: number; y: number; z: number }>, sunDir: THREE.Vector3, seed = 9) {
    const rng = new Rng(seed);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: lightShaftTexture() },
        uTime: GlobalUniforms.uTime,
        uColor: { value: new THREE.Color(1.0, 0.92, 0.7) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          float a = texture2D(uMap, vUv).a;
          float breathe = 0.55 + 0.45 * sin(uTime * 0.45 + vSeed * 6.28);
          float streaks = 0.75 + 0.25 * sin(vUv.x * 18.0 + vSeed * 9.0 + uTime * 0.2);
          float alpha = a * breathe * streaks * 0.16;
          gl_FragColor = vec4(uColor * alpha, alpha);
          #include <colorspace_fragment>
        }`,
    });
    const up = new THREE.Vector3(0, 1, 0);
    const dir = sunDir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    for (const p of points) {
      const h = rng.range(14, 22);
      const w = rng.range(2.5, 5);
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, h / 2, 0);
      const seeds = new Float32Array(geo.attributes.position.count).fill(rng.next());
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(geo, this.material);
        m.position.set(p.x, p.y, p.z);
        m.quaternion.copy(q);
        m.rotateY(k * Math.PI * 0.5 + rng.range(0, 1));
        m.renderOrder = 9;
        this.object.add(m);
      }
    }
    this.object.name = 'LightShafts';
  }
}
