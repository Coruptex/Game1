import { HarborLayout } from './HarborLayout';
import type { Heightfield } from '../../terrain/Heightfield';
import type { PropPlacer } from '../../building/PropPlacer';
import type { KeepOutMap } from '../../building/Scatter';
import type { Rng } from '../../../utils/random';
import {
  altar,
  archway,
  buildAncientGate,
  buildCryptFacade,
  CRYPT_BRAZIERS,
  cobblestone,
  column,
  pavingSlab,
  pavingSlabs,
  rubblePile,
  ruinedWall,
  statue,
  stele,
  stoneStairs,
} from '../../../environment/architecture/Ancient';
import { buildFortress } from '../../../environment/architecture/Fortress';
import { rotate } from '../../building/PropPlacer';

export interface RuinsResult {
  /** World positions of brazier flames (crypt). */
  flames: Array<{ x: number; y: number; z: number }>;
}

/**
 * Places the ancient architecture of the hub: the monumental gate on its terrace, the crypt
 * facade in the west cliffs, ruins along the paths, plaza paving, cobbled paths and the distant
 * fortress. All coordinates come from HarborLayout.
 */
export function placeHarborRuins(placer: PropPlacer, hf: Heightfield, rng: Rng, keep: KeepOutMap): RuinsResult {
  const flames: RuinsResult['flames'] = [];
  const L = HarborLayout;
  const y = (x: number, z: number) => hf.heightAt(x, z);

  // --- Gate of the Sunken Kings -------------------------------------------------------
  const g = L.gate;
  placer.place(buildAncientGate({ portcullis: true }), g.x, L.gateTerrace.height, g.z, 0);
  keep.circle(g.x, g.z, 10);
  // stairs from the jungle path (h 7.0 at z=-97) up to the terrace (9.5 at z=-104.5)
  placer.place(stoneStairs({ width: 4.6, steps: 9, rise: 2.5, run: 7.4, seed: 3 }), 0, 7.0, -97.1, Math.PI);
  keep.segment(0, -96, 0, -105, 3.5);
  placer.place(ruinedWall({ length: 9, height: 2.4, seed: 11 }), -9.6, L.gateTerrace.height, -105.6, 0);
  placer.place(ruinedWall({ length: 8, height: 1.7, seed: 12 }), 9.9, L.gateTerrace.height, -105.6, 0);
  placer.place(statue(0), -4.2, L.gateTerrace.height, -107.2, 0.15);
  placer.place(statue(1), 4.2, L.gateTerrace.height, -107.2, -0.15);
  placer.place(rubblePile(5), -11, L.gateTerrace.height, -110, 0.4);
  placer.place(rubblePile(6), 12.5, L.gateTerrace.height, -112, -0.8);
  placer.place(column('broken', 31), -13, L.gateTerrace.height, -117, 0.3);
  placer.place(column('intact', 32), 13.2, L.gateTerrace.height, -118, 0);

  // --- Jungle ruins along the north path -------------------------------------------------
  const jungleRuins: Array<[ReturnType<typeof column> | null, number, number, number]> = [
    [column('broken', 1), -4.8, -47, 0.2],
    [column('intact', 2), 5.6, -50, 0],
    [column('fallen', 3), 8.2, -69, 1.1],
    [column('broken', 4), -6, -81, 2.3],
    [column('intact', 5), 4.5, -89, 0.4],
    [column('fallen', 6), -7.5, -93, -0.6],
  ];
  for (const [def, x, z, yaw] of jungleRuins) if (def) placer.place(def, x, y(x, z), z, yaw);
  placer.place(archway({ width: 4.6, height: 5.2, seed: 7 }), 3.4, y(3.4, -58.5), -58.5, 0.15);
  placer.place(ruinedWall({ length: 7, height: 2.0, seed: 21 }), -9, y(-9, -58), -58, 0.4);
  placer.place(ruinedWall({ length: 6, height: 1.4, seed: 22 }), 10.5, y(10.5, -80), -80, -0.5);
  placer.place(rubblePile(1), -7, y(-7, -61), -61, 0);
  placer.place(rubblePile(2), 9, y(9, -84), -84, 1.2);

  // monument clearing (stele + altar), like the carved monolith of the jungle reference
  const m = L.monument;
  placer.place(stele(4), m.x, y(m.x, m.z), m.z, Math.PI / 2 + 0.2);
  placer.place(altar(2), m.x - 2.2, y(m.x - 2.2, m.z - 2.4), m.z - 2.4, 0.3);
  keep.circle(m.x, m.z, 4);

  // --- West ruins and the crypt -------------------------------------------------------
  placer.place(archway({ width: 4.4, height: 5.0, seed: 9 }), -28, y(-28, -1.6), -1.6, Math.PI / 2 + 0.05);
  const westCols: Array<[number, number, 'intact' | 'broken' | 'fallen', number]> = [
    [-21, -6.2, 'broken', 0],
    [-24, 3.4, 'intact', 0],
    [-34, -7.6, 'intact', 0],
    [-36.5, 2.2, 'broken', 0],
    [-19, 4.6, 'fallen', 0.9],
  ];
  westCols.forEach(([x, z, k, yaw], i) => placer.place(column(k, 40 + i), x, y(x, z), z, yaw));
  const c = L.dungeonCourt;
  placer.place(ruinedWall({ length: 7, height: 2.2, seed: 31 }), -45, c.height, c.minZ + 0.6, 0);
  placer.place(ruinedWall({ length: 6, height: 1.8, seed: 32 }), -44, c.height, c.maxZ - 0.6, 0);
  placer.place(rubblePile(9), -40, c.height, -9.5, 0.7);
  // crypt facade sits against the cliff, facing east (+X)
  const d = L.dungeonDoor;
  placer.place(buildCryptFacade(), d.x - 0.3, c.height, d.z, d.yaw);
  keep.circle(d.x + 2, d.z, 7);
  for (const b of CRYPT_BRAZIERS) {
    const [ox, oz] = rotate(b.x, b.z, d.yaw);
    flames.push({ x: d.x - 0.3 + ox, y: c.height + b.y, z: d.z + oz });
  }

  // --- Plaza ------------------------------------------------------------------------------
  const p = L.plaza;
  placer.place(pavingSlabs({ radius: 11.5, seed: 5, coverage: 0.82 }), p.x, y(p.x, p.z) - 0.02, p.z, 0);
  keep.circle(p.x, p.z, 12.5);
  placer.place(column('broken', 51), 9.5, y(9.5, -8.5), -8.5, 0);
  placer.place(column('intact', 52), -11.5, y(-11.5, 6.5), 6.5, 0);
  placer.place(column('fallen', 53), 12.5, y(12.5, 7), 7, 2.2);
  placer.place(archway({ width: 4.6, height: 5.4, seed: 13 }), 0, y(0, -12.5), -12.5, 0);

  // --- Fortress on the mountain spur ---------------------------------------------------------
  const f = L.fortress;
  placer.place(buildFortress(), f.x, y(f.x, f.z), f.z, f.yaw);

  // --- Cobbled paths ------------------------------------------------------------------------------
  placeCobbles(placer, hf, rng);
  return { flames };
}

/** Scatters instanced cobblestones along the paved paths (with gaps, like worn old roads). */
function placeCobbles(placer: PropPlacer, hf: Heightfield, rng: Rng): void {
  const stones = [cobblestone(0), cobblestone(1), cobblestone(2), cobblestone(3)];
  const slabs = [pavingSlab(0), pavingSlab(1)];
  for (const path of HarborLayout.paths) {
    if (!path.paved) continue;
    const pts = path.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      // stairs to the gate terrace are built separately
      if (path.id === 'north' && a.z <= -96.9) continue;
      const half = path.width / 2;
      const stepAlong = 0.42;
      const stepAcross = 0.42;
      for (let s = 0; s < len; s += stepAlong) {
        for (let w = -half + 0.2; w <= half - 0.2; w += stepAcross) {
          if (rng.next() < 0.13) continue; // worn gaps
          const edge = Math.abs(w) / half;
          if (edge > 0.75 && rng.next() < 0.45) continue;
          const jx = rng.range(-0.08, 0.08);
          const jz = rng.range(-0.08, 0.08);
          const x = a.x + dx * s - dz * w + jx;
          const z = a.z + dz * s + dx * w + jz;
          const h = hf.heightAt(x, z);
          if (h < 0.3) continue;
          const big = rng.next() < 0.06;
          const asset = big ? rng.pick(slabs) : rng.pick(stones);
          placer.instance(asset, x, h - 0.03, z, rng.range(0, Math.PI * 2), big ? rng.range(0.45, 0.6) : rng.range(0.85, 1.15));
        }
      }
    }
  }
}
