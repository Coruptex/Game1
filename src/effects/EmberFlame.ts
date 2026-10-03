import * as THREE from 'three';
import { GlobalUniforms } from '../assets/materials/GlobalUniforms';

let flameMaterial: THREE.ShaderMaterial | null = null;

/**
 * Camera-facing flame layers with a procedural teardrop shape that licks upwards. Reads as fire
 * from the elevated isometric camera (3D cones read as glowing discs from above).
 */
function getFlameMaterial(): THREE.ShaderMaterial {
  if (flameMaterial) return flameMaterial;
  flameMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: GlobalUniforms.uTime },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aLayer; // x: width scale, y: height scale, z: phase
      varying vec2 vUv;
      varying vec3 vLayer;
      void main() {
        vUv = uv;
        vLayer = aLayer;
        // spherical billboard around the flame base, growing upwards in screen space
        vec4 base = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
        base.xy += vec2((uv.x - 0.5) * aLayer.x * scale.x, uv.y * aLayer.y * scale.y);
        gl_Position = projectionMatrix * base;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vLayer;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float t = uTime * 1.0 + vLayer.z;
        float h = vUv.y;
        float sway = sin(h * 5.0 - t * 6.5) * 0.06 * h + sin(t * 3.1) * 0.03 * h;
        float x = vUv.x - 0.5 + sway;
        float n = vnoise(vec2(x * 4.0, h * 3.5 - t * 3.2)) * 0.6 + vnoise(vec2(x * 9.0, h * 7.0 - t * 5.0)) * 0.4;
        float width = 0.42 * pow(1.0 - h, 0.9) * (0.75 + 0.5 * smoothstep(0.0, 0.25, h));
        float body = 1.0 - smoothstep(width * 0.35, width, abs(x));
        float tip = 1.0 - smoothstep(0.35, 1.0, h + (n - 0.5) * 0.55);
        float a = body * tip * smoothstep(0.0, 0.06, h);
        vec3 hot = vec3(1.0, 0.93, 0.62);
        vec3 mid = vec3(1.0, 0.55, 0.16);
        vec3 cool = vec3(0.85, 0.22, 0.05);
        vec3 c = mix(hot, mid, smoothstep(0.05, 0.45, h + abs(x) * 1.2));
        c = mix(c, cool, smoothstep(0.45, 0.95, h));
        gl_FragColor = vec4(c * a * 0.85, a);
        #include <colorspace_fragment>
      }`,
  });
  return flameMaterial;
}

/**
 * Stylised fire (shrine ember, braziers, campfires) plus an optional point light whose intensity
 * flickers with the flame.
 */
export class EmberFlame {
  readonly object = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private intensity = 1;
  private target = 1;
  private t = Math.random() * 10;

  constructor(
    private readonly baseScale = 1,
    readonly light: THREE.PointLight | null = null,
    private readonly lightIntensity = 14,
  ) {
    // three overlapping layers: wide outer, medium, small hot core
    const layers: Array<[number, number, number]> = [
      [0.95, 1.45, 0.0],
      [0.7, 1.15, 1.7],
      [0.42, 0.75, 3.1],
    ];
    const pos: number[] = [];
    const uv: number[] = [];
    const layer: number[] = [];
    const idx: number[] = [];
    layers.forEach(([w, h, ph], i) => {
      const base = i * 4;
      for (const [u, v] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]) {
        pos.push(0, 0, 0);
        uv.push(u, v);
        layer.push(w, h, ph);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 3));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.6);
    this.mesh = new THREE.Mesh(geo, getFlameMaterial());
    this.mesh.renderOrder = 8;
    this.object.add(this.mesh);
    if (light) {
      light.position.set(0, 1.3, 0.25);
      this.object.add(light);
    }
    this.object.scale.setScalar(baseScale);
  }

  /** 0 = dormant ember, 1 = full flame. */
  setIntensity(v: number, instant = false): void {
    this.target = v;
    if (instant) this.intensity = v;
  }

  update(dt: number): void {
    this.t += dt;
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 2.5);
    const s = Math.max(0.15, this.intensity);
    const flick = 1 + Math.sin(this.t * 17) * 0.04 + Math.sin(this.t * 7.3) * 0.05;
    this.object.scale.set(this.baseScale * s, this.baseScale * s * flick, this.baseScale * s);
    if (this.light) {
      this.light.intensity = this.lightIntensity * (0.25 + 0.75 * this.intensity) * (0.85 + 0.15 * Math.sin(this.t * 11) * Math.sin(this.t * 4.7));
    }
  }
}
