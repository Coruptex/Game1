/**
 * Regular-grid heightfield. `heightAt` interpolates on the exact same triangles the terrain mesh
 * renders (diagonal from (i,j) to (i+1,j+1)), so characters stand precisely on the visible ground.
 */
export class Heightfield {
  readonly cols: number;
  readonly rows: number;
  readonly heights: Float32Array;

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly maxX: number,
    readonly maxZ: number,
    readonly cell: number,
    /** Height returned outside the grid. */
    readonly outsideHeight = -12,
  ) {
    this.cols = Math.round((maxX - minX) / cell) + 1;
    this.rows = Math.round((maxZ - minZ) / cell) + 1;
    this.heights = new Float32Array(this.cols * this.rows);
  }

  fill(fn: (x: number, z: number) => number): void {
    for (let j = 0; j < this.rows; j++) {
      const z = this.minZ + j * this.cell;
      for (let i = 0; i < this.cols; i++) {
        this.heights[j * this.cols + i] = fn(this.minX + i * this.cell, z);
      }
    }
  }

  get(i: number, j: number): number {
    i = i < 0 ? 0 : i >= this.cols ? this.cols - 1 : i;
    j = j < 0 ? 0 : j >= this.rows ? this.rows - 1 : j;
    return this.heights[j * this.cols + i];
  }

  xAt(i: number): number {
    return this.minX + i * this.cell;
  }

  zAt(j: number): number {
    return this.minZ + j * this.cell;
  }

  contains(x: number, z: number): boolean {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }

  heightAt(x: number, z: number): number {
    if (!this.contains(x, z)) return this.outsideHeight;
    const gx = (x - this.minX) / this.cell;
    const gz = (z - this.minZ) / this.cell;
    let i = Math.floor(gx);
    let j = Math.floor(gz);
    if (i >= this.cols - 1) i = this.cols - 2;
    if (j >= this.rows - 1) j = this.rows - 2;
    const fx = gx - i;
    const fz = gz - j;
    const c = this.cols;
    const h00 = this.heights[j * c + i];
    const h10 = this.heights[j * c + i + 1];
    const h01 = this.heights[(j + 1) * c + i];
    const h11 = this.heights[(j + 1) * c + i + 1];
    if (fz > fx) return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
    return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  }

  /** Gradient magnitude (rise/run) using central differences over one cell. */
  slopeAt(x: number, z: number): number {
    const e = this.cell;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Unit normal at (x, z). */
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const e = this.cell;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const len = Math.sqrt(dx * dx + 1 + dz * dz);
    out.x = -dx / len;
    out.y = 1 / len;
    out.z = -dz / len;
    return out;
  }
}
