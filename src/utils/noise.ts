import { Rng } from './random';

/**
 * Seeded 2D simplex noise + helpers (fbm, ridged, periodic value noise for tileable textures).
 */
export class Noise2D {
  private readonly perm = new Uint8Array(512);
  private readonly grad = new Float32Array(512 * 2);

  constructor(seed = 1337) {
    const rng = new Rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      const a = (this.perm[i] / 256) * Math.PI * 2;
      this.grad[i * 2] = Math.cos(a);
      this.grad[i * 2 + 1] = Math.sin(a);
    }
  }

  /** Simplex noise in roughly [-1, 1]. */
  noise(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = this.perm[ii + this.perm[jj]] * 2;
      t0 *= t0;
      n0 = t0 * t0 * (this.grad[g] * x0 + this.grad[g + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = this.perm[ii + i1 + this.perm[jj + j1]] * 2;
      t1 *= t1;
      n1 = t1 * t1 * (this.grad[g] * x1 + this.grad[g + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = this.perm[ii + 1 + this.perm[jj + 1]] * 2;
      t2 *= t2;
      n2 = t2 * t2 * (this.grad[g] * x2 + this.grad[g + 1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  /** Fractal Brownian motion, result roughly in [-1, 1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal in [0, 1] (good for rocky ridges). */
  ridged(x: number, y: number, octaves = 4): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.noise(x * freq, y * freq));
      sum += n * n * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }
}

/**
 * Tileable value noise for procedural textures. `period` is the lattice size in cells,
 * so sampling over [0, period) wraps seamlessly.
 */
export class PeriodicNoise {
  private readonly values: Float32Array;

  constructor(
    private readonly period: number,
    seed = 7,
  ) {
    const rng = new Rng(seed);
    this.values = new Float32Array(period * period);
    for (let i = 0; i < this.values.length; i++) this.values[i] = rng.next();
  }

  private v(ix: number, iy: number): number {
    const p = this.period;
    const x = ((ix % p) + p) % p;
    const y = ((iy % p) + p) % p;
    return this.values[y * p + x];
  }

  /** Smooth value noise in [0, 1], coordinates in lattice units. */
  sample(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.v(ix, iy);
    const b = this.v(ix + 1, iy);
    const c = this.v(ix, iy + 1);
    const d = this.v(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  /** Tileable fbm in [0, 1]; u, v in [0, 1). */
  fbm(u: number, v: number, octaves = 4): number {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let scale = 1;
    for (let o = 0; o < octaves; o++) {
      sum += this.sample(u * this.period * scale, v * this.period * scale) * amp;
      norm += amp;
      amp *= 0.5;
      scale *= 2;
    }
    return sum / norm;
  }
}
