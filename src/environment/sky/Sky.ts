import * as THREE from 'three';
import { GlobalUniforms } from '../../assets/materials/GlobalUniforms';

/**
 * Painterly gradient sky with a soft sun, drifting procedural clouds and a hazy horizon that
 * matches the scene fog colour.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    uZenith: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uGround: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uTime: { value: number };
    uCloudCover: { value: number };
  };

  constructor() {
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x2f8fd8) },
      uHorizon: { value: new THREE.Color(0xc9ecf2) },
      uGround: { value: new THREE.Color(0x7fc6d6) },
      uSunDir: GlobalUniforms.uSunDir,
      uSunColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
      uTime: GlobalUniforms.uTime,
      uCloudCover: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      name: 'Sky',
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uTime;
        uniform float uCloudCover;
        varying vec3 vDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; }
          return s;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.55, h), 0.65));
          col = mix(col, uGround, smoothstep(0.0, -0.08, h));
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sd, 1200.0) * 8.0 + pow(sd, 60.0) * 0.35 + pow(sd, 6.0) * 0.12);

          if (h > -0.02) {
            vec2 uv = d.xz / (max(h, 0.0) + 0.16);
            uv = uv * 0.55 + vec2(uTime * 0.006, uTime * 0.002);
            float n = fbm(uv);
            float cover = mix(0.62, 0.45, uCloudCover);
            float c = smoothstep(cover, cover + 0.22, n) * smoothstep(-0.02, 0.18, h);
            float shade = smoothstep(cover, cover + 0.35, fbm(uv + vec2(0.07, 0.05)));
            vec3 cloudLit = vec3(1.0, 0.98, 0.95) + uSunColor * pow(sd, 4.0) * 0.35;
            vec3 cloudShade = mix(uHorizon, vec3(0.78, 0.84, 0.92), 0.6);
            vec3 cloudCol = mix(cloudShade, cloudLit, 1.0 - shade * 0.6);
            col = mix(col, cloudCol, c * 0.9);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    this.mesh.name = 'Sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}
