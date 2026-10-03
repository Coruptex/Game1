import * as THREE from 'three';

const MAX_SAMPLES = 28;

/**
 * Ribbon that follows the blade (base -> tip) while a swing is active and fades out quickly.
 * Sells the speed and arc of attacks — important for readability from the isometric camera.
 */
export class SwordTrail {
  readonly mesh: THREE.Mesh;
  private readonly base: THREE.Vector3[] = [];
  private readonly tip: THREE.Vector3[] = [];
  private readonly age: number[] = [];
  private readonly positions = new Float32Array(MAX_SAMPLES * 2 * 3);
  private readonly alphas = new Float32Array(MAX_SAMPLES * 2);
  private readonly geo = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;

  constructor(
    color: THREE.ColorRepresentation,
    private readonly lifetime = 0.16,
  ) {
    const idx: number[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        varying float vEdge;
        void main() {
          vAlpha = aAlpha;
          vEdge = mod(float(gl_VertexID), 2.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        varying float vEdge;
        void main() {
          float a = vAlpha * (0.25 + 0.75 * vEdge);
          gl_FragColor = vec4(uColor * a, a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  setColor(c: THREE.ColorRepresentation): void {
    (this.material.uniforms.uColor.value as THREE.Color).set(c);
  }

  /** Records a new blade sample (call every frame while the swing is active). */
  push(base: THREE.Vector3, tip: THREE.Vector3): void {
    if (this.base.length >= MAX_SAMPLES) {
      this.base.shift();
      this.tip.shift();
      this.age.shift();
    }
    this.base.push(base.clone());
    this.tip.push(tip.clone());
    this.age.push(0);
  }

  update(dt: number): void {
    for (let i = 0; i < this.age.length; i++) this.age[i] += dt;
    while (this.age.length > 0 && this.age[0] > this.lifetime) {
      this.age.shift();
      this.base.shift();
      this.tip.shift();
    }
    const n = this.age.length;
    for (let i = 0; i < n; i++) {
      const b = this.base[i];
      const t = this.tip[i];
      const k = i * 6;
      this.positions[k] = b.x;
      this.positions[k + 1] = b.y;
      this.positions[k + 2] = b.z;
      this.positions[k + 3] = t.x;
      this.positions[k + 4] = t.y;
      this.positions[k + 5] = t.z;
      const a = Math.max(0, 1 - this.age[i] / this.lifetime) * (i / Math.max(1, n - 1));
      this.alphas[i * 2] = a * 0.9;
      this.alphas[i * 2 + 1] = a * 0.9;
    }
    this.geo.setDrawRange(0, n >= 2 ? (n - 1) * 6 : 0);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.base.length = 0;
    this.tip.length = 0;
    this.age.length = 0;
    this.geo.setDrawRange(0, 0);
  }
}
