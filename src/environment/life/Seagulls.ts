import * as THREE from 'three';
import { Rng } from '../../utils/random';

interface Gull {
  cx: number;
  cz: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  flap: number;
}

/**
 * Seagulls circling over the harbour: one instanced mesh, wings flap via per-instance matrices
 * (two wing instances per bird). Cheap ambient life that sells the coastal setting.
 */
export class Seagulls {
  readonly object: THREE.InstancedMesh;
  private readonly gulls: Gull[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(centers: Array<{ x: number; z: number; count: number; height: number }>, seed = 5) {
    const rng = new Rng(seed);
    for (const c of centers) {
      for (let i = 0; i < c.count; i++) {
        this.gulls.push({
          cx: c.x + rng.range(-12, 12),
          cz: c.z + rng.range(-12, 12),
          y: c.height + rng.range(-3, 5),
          radius: rng.range(8, 22),
          speed: rng.range(0.25, 0.45) * rng.sign(),
          phase: rng.range(0, Math.PI * 2),
          flap: rng.range(0, 10),
        });
      }
    }
    // wing: thin tapered quad, pivot at the body (x = 0), extends along +X
    const wing = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, 0.12, 0, 0, -0.18, 0.55, 0.02, -0.05, 0.95, -0.04, -0.2, 0.55, 0.02, -0.05, 0, 0, -0.18]);
    wing.setAttribute('position', new THREE.BufferAttribute(v, 3));
    wing.setIndex([0, 1, 2, 2, 1, 3]);
    wing.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: 0xf4f2ec, side: THREE.DoubleSide });
    // Two instances per gull: right wing, and the mirrored (scale.x = -1) left wing.
    this.object = new THREE.InstancedMesh(wing, mat, this.gulls.length * 2);
    this.object.name = 'Seagulls';
    this.object.frustumCulled = false;
    this.object.castShadow = false;
  }

  update(dt: number, time: number): void {
    let i = 0;
    for (const g of this.gulls) {
      g.flap += dt * (4.5 + Math.sin(time * 0.3 + g.phase) * 1.5);
      const a = time * g.speed + g.phase;
      const x = g.cx + Math.cos(a) * g.radius;
      const z = g.cz + Math.sin(a) * g.radius;
      const y = g.y + Math.sin(time * 0.5 + g.phase) * 1.2;
      const heading = Math.atan2(-Math.sin(a) * Math.sign(g.speed), Math.cos(a) * Math.sign(g.speed));
      const glide = Math.sin(g.flap * 0.35) > 0.2 ? 0.15 : 1;
      const flapA = Math.sin(g.flap) * 0.6 * glide + 0.1;
      this.p.set(x, y, z);
      for (const side of [1, -1]) {
        this.e.set(0, heading, side * flapA, 'YXZ');
        this.q.setFromEuler(this.e);
        this.s.set(side, 1, 1);
        this.m.compose(this.p, this.q, this.s);
        this.object.setMatrixAt(i++, this.m);
      }
    }
    this.object.instanceMatrix.needsUpdate = true;
  }
}
