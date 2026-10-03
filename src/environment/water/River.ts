import * as THREE from 'three';
import { foamTexture } from '../../assets/textures/ProceduralTextures';
import { GlobalUniforms } from '../../assets/materials/GlobalUniforms';

/**
 * Ribbon surface following a polyline (rivers, streams). uv: u = metres across, v = metres along
 * the flow, so the water shader can scroll normals / foam downstream.
 */
export function buildRiverRibbon(points: [number, number][], halfWidth: number, trimEnd = 0, samplesPerMetre = 0.8): THREE.BufferGeometry {
  // resample the polyline with Catmull-Rom for smooth bends
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const length = curve.getLength() - trimEnd;
  const n = Math.max(4, Math.ceil(length * samplesPerMetre));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const total = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (length / total);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const w = halfWidth * (1 + 0.15 * Math.sin(i * 0.7));
    pos.push(p.x - nx * w, 0, p.z - nz * w, p.x + nx * w, 0, p.z + nz * w);
    const v = t * total;
    uv.push(-w, v, w, v);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Curved falling water sheet with scrolling streaks + a foam ring where it hits the sea. */
export class Waterfall {
  readonly object = new THREE.Group();

  constructor(top: THREE.Vector3, bottom: THREE.Vector3, width: number) {
    const tex = foamTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: GlobalUniforms.uTime, uFoam: { value: tex } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uFoam;
        varying vec2 vUv;
        void main() {
          float streak = texture2D(uFoam, vec2(vUv.x * 1.6, vUv.y * 0.9 + uTime * 1.4)).r;
          float streak2 = texture2D(uFoam, vec2(vUv.x * 3.1 + 0.3, vUv.y * 1.7 + uTime * 2.2)).r;
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          vec3 deep = vec3(0.18, 0.62, 0.7);
          vec3 c = mix(deep, vec3(0.95, 1.0, 1.0), clamp(streak * 0.7 + streak2 * 0.5, 0.0, 1.0));
          float a = edge * (0.55 + 0.4 * streak2) * smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
    });
    // sheet: parametric fall curve from the lip (top) to the splash point
    const segs = 18;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const dir = new THREE.Vector3(bottom.x - top.x, 0, bottom.z - top.z);
    const run = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      // projectile-like arc: leaves the lip horizontally then drops
      const horiz = run * (0.25 * t + 0.75 * Math.sqrt(t));
      const y = top.y + (bottom.y - top.y) * t * t * (1.2 - 0.2 * t);
      const c = new THREE.Vector3(top.x, y, top.z).addScaledVector(dir, horiz);
      const w = width * (0.5 + 0.12 * t);
      pos.push(c.x - side.x * w, c.y, c.z - side.z * w, c.x + side.x * w, c.y, c.z + side.z * w);
      uv.push(0, t, 1, t);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const sheet = new THREE.Mesh(g, mat);
    sheet.renderOrder = 3;
    this.object.add(sheet);
    this.object.name = 'Waterfall';
  }
}
