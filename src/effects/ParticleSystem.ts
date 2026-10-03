import * as THREE from 'three';
import { Rng } from '../utils/random';

export type ParticleKind = 'spark' | 'blood' | 'dust' | 'splash' | 'ember' | 'coin' | 'soul' | 'leaf' | 'mist' | 'glint';

interface Preset {
  additive: boolean;
  life: [number, number];
  size: [number, number];
  sizeEnd: number;
  speed: [number, number];
  gravity: number;
  drag: number;
  colors: number[];
  alpha: number;
  /** Upward bias added to the velocity. */
  up: number;
}

const PRESETS: Record<ParticleKind, Preset> = {
  spark: { additive: true, life: [0.18, 0.4], size: [0.09, 0.16], sizeEnd: 0.2, speed: [4, 9], gravity: -12, drag: 2.5, colors: [0xfff1c0, 0xffc760, 0xff9a40], alpha: 1, up: 1.5 },
  glint: { additive: true, life: [0.25, 0.32], size: [0.9, 1.1], sizeEnd: 0.1, speed: [0, 0], gravity: 0, drag: 0, colors: [0xffffff, 0xffe9b0], alpha: 1, up: 0 },
  blood: { additive: false, life: [0.3, 0.55], size: [0.07, 0.12], sizeEnd: 0.6, speed: [2, 5], gravity: -14, drag: 1.5, colors: [0x9c1f1a, 0x7a1612], alpha: 0.9, up: 1.2 },
  dust: { additive: false, life: [0.5, 0.9], size: [0.25, 0.45], sizeEnd: 2.2, speed: [0.4, 1.4], gravity: 0.3, drag: 3, colors: [0xd9c79c, 0xc9b58a], alpha: 0.45, up: 0.5 },
  splash: { additive: false, life: [0.35, 0.6], size: [0.1, 0.2], sizeEnd: 0.4, speed: [1.5, 3.6], gravity: -10, drag: 1, colors: [0xe8fbff, 0xbdeff5], alpha: 0.85, up: 2.6 },
  ember: { additive: true, life: [0.8, 1.6], size: [0.05, 0.11], sizeEnd: 0.1, speed: [0.3, 1.0], gravity: 1.6, drag: 0.8, colors: [0xffb347, 0xff7a1a, 0xffe08a], alpha: 1, up: 0.8 },
  coin: { additive: false, life: [0.8, 1.2], size: [0.1, 0.14], sizeEnd: 0.9, speed: [2, 4], gravity: -11, drag: 0.6, colors: [0xffd45a, 0xffe58a, 0xe8b830], alpha: 1, up: 4 },
  soul: { additive: true, life: [1.0, 1.8], size: [0.12, 0.22], sizeEnd: 0.2, speed: [0.2, 0.8], gravity: 2.2, drag: 0.5, colors: [0xffc070, 0xff8a3a, 0xfff0c0], alpha: 1, up: 1.2 },
  leaf: { additive: false, life: [2.5, 4.0], size: [0.12, 0.18], sizeEnd: 1, speed: [0.2, 0.6], gravity: -0.6, drag: 1.2, colors: [0x6f9a32, 0x8ab040, 0xa38a3a], alpha: 0.9, up: 0 },
  mist: { additive: false, life: [1.2, 2.0], size: [0.6, 1.0], sizeEnd: 2.5, speed: [0.2, 0.6], gravity: 0.2, drag: 1, colors: [0xffffff], alpha: 0.25, up: 0.3 },
};

const MAX = 900;

class ParticleBuffer {
  readonly points: THREE.Points;
  readonly pos = new Float32Array(MAX * 3);
  readonly vel = new Float32Array(MAX * 3);
  readonly col = new Float32Array(MAX * 4);
  readonly size = new Float32Array(MAX);
  readonly life = new Float32Array(MAX);
  readonly maxLife = new Float32Array(MAX);
  readonly size0 = new Float32Array(MAX);
  readonly sizeEnd = new Float32Array(MAX);
  readonly alpha0 = new Float32Array(MAX);
  readonly gravity = new Float32Array(MAX);
  readonly drag = new Float32Array(MAX);
  count = 0;
  private readonly geo: THREE.BufferGeometry;

  constructor(material: THREE.ShaderMaterial) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  spawn(): number {
    if (this.count >= MAX) return -1;
    return this.count++;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.swapRemove(i);
        continue;
      }
      const k = 1 - this.life[i] / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      const i3 = i * 3;
      this.vel[i3] *= d;
      this.vel[i3 + 2] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.gravity[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = this.size0[i] * (1 + (this.sizeEnd[i] - 1) * k);
      this.col[i * 4 + 3] = this.alpha0[i] * (1 - k * k);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  private swapRemove(i: number): void {
    const last = this.count - 1;
    if (i !== last) {
      this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
      this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
      this.col.copyWithin(i * 4, last * 4, last * 4 + 4);
      this.size[i] = this.size[last];
      this.life[i] = this.life[last];
      this.maxLife[i] = this.maxLife[last];
      this.size0[i] = this.size0[last];
      this.sizeEnd[i] = this.sizeEnd[last];
      this.alpha0[i] = this.alpha0[last];
      this.gravity[i] = this.gravity[last];
      this.drag[i] = this.drag[last];
    }
    this.count--;
  }

  clear(): void {
    this.count = 0;
  }
}

function makeMaterial(additive: boolean, scale: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: scale },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec4 aColor;
      uniform float uScale;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 256.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float a = 1.0 - smoothstep(0.35, 1.0, d);
        if (a <= 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        #include <colorspace_fragment>
      }`,
  });
}

/** Pooled CPU-simulated particles drawn as two point clouds (additive + alpha blended). */
export class ParticleSystem {
  readonly object = new THREE.Group();
  private readonly additive: ParticleBuffer;
  private readonly alpha: ParticleBuffer;
  private readonly rng = new Rng(77);
  private readonly scale = { value: 600 };
  private readonly color = new THREE.Color();

  constructor() {
    this.additive = new ParticleBuffer(makeMaterial(true, this.scale));
    this.alpha = new ParticleBuffer(makeMaterial(false, this.scale));
    this.object.add(this.alpha.points, this.additive.points);
    this.object.name = 'Particles';
  }

  /** Must be called on resize: converts world sizes to pixels. */
  setViewport(heightPx: number, fovDeg: number): void {
    this.scale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  burst(
    kind: ParticleKind,
    pos: THREE.Vector3,
    count: number,
    opts: { dir?: THREE.Vector3; spread?: number; speedScale?: number; sizeScale?: number; color?: number } = {},
  ): void {
    const p = PRESETS[kind];
    const buf = p.additive ? this.additive : this.alpha;
    const r = this.rng;
    const spread = opts.spread ?? 1;
    for (let n = 0; n < count; n++) {
      const i = buf.spawn();
      if (i < 0) return;
      const i3 = i * 3;
      buf.pos[i3] = pos.x + r.gauss() * 0.05;
      buf.pos[i3 + 1] = pos.y + r.gauss() * 0.05;
      buf.pos[i3 + 2] = pos.z + r.gauss() * 0.05;
      let vx = r.gauss();
      let vy = r.gauss() * 0.6 + 0.3;
      let vz = r.gauss();
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l;
      vy /= l;
      vz /= l;
      if (opts.dir) {
        vx = opts.dir.x + vx * spread;
        vy = opts.dir.y + vy * spread;
        vz = opts.dir.z + vz * spread;
        const l2 = Math.hypot(vx, vy, vz) || 1;
        vx /= l2;
        vy /= l2;
        vz /= l2;
      }
      const sp = r.range(p.speed[0], p.speed[1]) * (opts.speedScale ?? 1);
      buf.vel[i3] = vx * sp;
      buf.vel[i3 + 1] = vy * sp + p.up;
      buf.vel[i3 + 2] = vz * sp;
      const life = r.range(p.life[0], p.life[1]);
      buf.life[i] = life;
      buf.maxLife[i] = life;
      const s = r.range(p.size[0], p.size[1]) * (opts.sizeScale ?? 1);
      buf.size0[i] = s;
      buf.size[i] = s;
      buf.sizeEnd[i] = p.sizeEnd;
      buf.gravity[i] = p.gravity;
      buf.drag[i] = p.drag;
      buf.alpha0[i] = p.alpha;
      this.color.set(opts.color ?? r.pick(p.colors));
      buf.col[i * 4] = this.color.r;
      buf.col[i * 4 + 1] = this.color.g;
      buf.col[i * 4 + 2] = this.color.b;
      buf.col[i * 4 + 3] = p.alpha;
    }
  }

  update(dt: number): void {
    this.additive.update(dt);
    this.alpha.update(dt);
  }

  clear(): void {
    this.additive.clear();
    this.alpha.clear();
  }

  get activeCount(): number {
    return this.additive.count + this.alpha.count;
  }
}
