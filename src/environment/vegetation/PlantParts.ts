import * as THREE from 'three';
import type { Rng } from '../../utils/random';
import { GeoBuilder, UP, bentSpine, foldedStrip, leafStations, lin, mix, shade } from './VegUtils';

/**
 * Reusable plant parts shared by the standalone plants and the tree epiphytes.
 * All colours are linear; geometry is appended into the given builder.
 */

export interface RosetteWhorl {
  count: number;
  length: number;
  width: number;
  /** Start elevation (rad above horizontal). */
  elevation: number;
  /** Downward bend over the leaf length (rad). */
  bend: number;
  base: THREE.Color;
  mid: THREE.Color;
  tip: THREE.Color;
  /** Edge colour multiplier / tint target. */
  edge?: THREE.Color;
}

export interface RosetteOptions {
  center: THREE.Vector3;
  scale: number;
  whorls: RosetteWhorl[];
  /** Segments along each leaf. */
  segments: number;
  /** V channel depth (negative fold = edges rise). */
  channel?: number;
  rotation?: number;
}

/** Bromeliad-like rosette of stiff, channelled, pointed leaves. */
export function rosette(b: GeoBuilder, rng: Rng, o: RosetteOptions): void {
  const s = o.scale;
  let azOff = o.rotation ?? rng.range(0, Math.PI * 2);
  for (const w of o.whorls) {
    for (let i = 0; i < w.count; i++) {
      const az = azOff + (i / w.count) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      const origin = o.center.clone().addScaledVector(dir, 0.02 * s);
      const len = w.length * s * rng.range(0.88, 1.1);
      const spine = bentSpine(origin, az, w.elevation + rng.range(-0.1, 0.1), w.bend + rng.range(-0.1, 0.12), len, o.segments, 1.6);
      const width = w.width * s * rng.range(0.9, 1.1);
      const st = leafStations(spine, UP, (t) => {
        // strap leaf: widens quickly, stays broad, then a short pointed tip
        const hw = t < 0.1 ? width * (0.7 + 3 * t) : t < 0.7 ? width : width * Math.pow(Math.max(0, 1 - (t - 0.7) / 0.3), 0.7);
        const c = t < 0.5 ? mix(w.base, w.mid, t / 0.5) : mix(w.mid, w.tip, (t - 0.5) / 0.5);
        return {
          hw: Math.max(hw, 0.002),
          fold: o.channel ?? -0.45,
          uHalf: 0.5,
          v: t,
          cCenter: c,
          cEdge: w.edge ? mix(c, w.edge, 0.55) : shade(c, 0.85),
        };
      });
      foldedStrip(b, st, UP, 0.7);
    }
    azOff += Math.PI / Math.max(1, w.count);
  }
}

/** Standard bromeliad colour sets (reference: orange-red rosettes with green outer leaves). */
export function bromeliadWhorls(rng: Rng, kind: number): RosetteWhorl[] {
  const green = lin(0x3d7a2c);
  const deep = lin(0x2a5a26);
  const red = lin(0xd8321f);
  const orange = lin(0xf28a1e);
  const yellow = lin(0xf7c23e);
  const magenta = lin(0xc8306a);
  const accent = kind === 1 ? magenta : red;
  const warm = kind === 1 ? lin(0xf07aa8) : orange;
  return [
    { count: 8, length: 0.56, width: 0.085, elevation: 0.32, bend: 0.85, base: deep, mid: green, tip: shade(accent, 0.85), edge: shade(accent, 0.75) },
    { count: 7, length: 0.46, width: 0.08, elevation: 0.7, bend: 0.65, base: green, mid: mix(green, warm, 0.7), tip: accent, edge: accent },
    { count: 5, length: 0.34, width: 0.07, elevation: 1.0, bend: 0.5, base: mix(yellow, warm, 0.4 + rng.range(0, 0.2)), mid: warm, tip: accent, edge: shade(accent, 0.9) },
  ];
}

/** Small upright bract spike (bromeliad flower). */
export function bractSpike(b: GeoBuilder, rng: Rng, base: THREE.Vector3, height: number, colLow: THREE.Color, colTip: THREE.Color, bracts = 6): void {
  for (let i = 0; i < bracts; i++) {
    const az = (i / bracts) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const y = base.y + (i / bracts) * height * 0.45;
    const origin = new THREE.Vector3(base.x, y, base.z);
    const len = height * (0.75 - (i / bracts) * 0.3);
    const spine = bentSpine(origin, az, 1.25 - (i / bracts) * 0.25, 0.25, len, 2, 1.2);
    const st = leafStations(spine, UP, (t) => ({
      hw: 0.035 * height * 4 * (1 - t * 0.85),
      fold: -0.6,
      uHalf: 0.5,
      v: t,
      cCenter: mix(colLow, colTip, t),
      cEdge: shade(mix(colLow, colTip, t), 0.85),
    }));
    foldedStrip(b, st, UP, 0.5);
  }
}
