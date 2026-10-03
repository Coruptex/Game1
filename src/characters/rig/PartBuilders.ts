import * as THREE from 'three';
import type { Appearance } from './Appearance';
import type { JointName, Proportions } from './Joints';

/** A rigid body part authored in its joint's local space (bind pose). */
export interface RigPart {
  joint: JointName;
  geometry: THREE.BufferGeometry;
}

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

/** Fills vertex colours with a soft vertical gradient (painterly shading baked into the part). */
function colorize(geo: THREE.BufferGeometry, color: number, gradient = 0.14, stripes?: { color: number; period: number }): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const h = Math.max(1e-4, bb.max.y - bb.min.y);
  const arr = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const alt = stripes ? new THREE.Color(stripes.color) : null;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - bb.min.y) / h;
    tmp.copy(base);
    if (alt && stripes) {
      const band = Math.floor((y + 10) / stripes.period) % 2 === 0;
      if (band) tmp.copy(alt);
    }
    const f = 1 - gradient + gradient * 1.4 * t;
    tmp2.copy(tmp).multiplyScalar(f);
    arr[i * 3] = tmp2.r;
    arr[i * 3 + 1] = tmp2.g;
    arr[i * 3 + 2] = tmp2.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function xf(geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

function capsule(r: number, len: number, color: number, radial = 10, gradient = 0.14): THREE.BufferGeometry {
  return colorize(new THREE.CapsuleGeometry(r, len, 4, radial), color, gradient);
}

function cyl(rTop: number, rBot: number, h: number, color: number, radial = 12, open = false, thetaStart = 0, thetaLen = Math.PI * 2): THREE.BufferGeometry {
  return colorize(new THREE.CylinderGeometry(rTop, rBot, h, radial, 3, open, thetaStart, thetaLen), color);
}

function sphere(r: number, color: number, w = 12, hgt = 8, gradient = 0.14): THREE.BufferGeometry {
  return colorize(new THREE.SphereGeometry(r, w, hgt), color, gradient);
}

function box(w: number, h: number, d: number, color: number): THREE.BufferGeometry {
  return colorize(new THREE.BoxGeometry(w, h, d), color, 0.1);
}

/** Tricorn hat brim: three-lobed ring whose sides turn up, corners pointing out (one forward). */
function tricornBrim(radius: number, color: number, trim: number): THREE.BufferGeometry {
  const seg = 54;
  const rings = [0.11, 0.55, 0.85, 1.0];
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const cBrim = new THREE.Color(color);
  const cTrim = new THREE.Color(trim);
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2;
    const lobe = Math.cos(3 * th);
    const outer = radius * (0.84 + 0.16 * lobe);
    const up = 0.13 * (1 - lobe) * 0.5 + 0.015;
    for (let k = 0; k < rings.length; k++) {
      const rr = lerpN(radius * 0.44, outer, (rings[k] - rings[0]) / (1 - rings[0]));
      const t = k / (rings.length - 1);
      const y = up * t * t * 1.15;
      positions.push(Math.sin(th) * rr, y, Math.cos(th) * rr);
      const c = k === rings.length - 1 ? cTrim : cBrim;
      colors.push(c.r, c.g, c.b);
    }
  }
  const per = rings.length;
  for (let i = 0; i < seg; i++) {
    for (let k = 0; k < per - 1; k++) {
      const a = i * per + k;
      const b = (i + 1) * per + k;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Feather: curved tapered blade shape. */
function feather(color: number): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const n = 10;
  const c = new THREE.Color(color);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI) * 0.045 + 0.004;
    const x = -t * 0.34;
    const y = Math.sin(t * 1.6) * 0.12;
    const z = -t * t * 0.08;
    pts.push(x, y + w, z, x, y - w * 0.6, z);
    const f = 0.8 + t * 0.35;
    cols.push(c.r * f, c.g * f, c.b * f, c.r * f * 0.8, c.g * f * 0.8, c.b * f * 0.8);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Builds every body part for an appearance (no weapon). */
export function buildBodyParts(a: Appearance, p: Proportions): RigPart[] {
  const parts: RigPart[] = [];
  const add = (joint: JointName, geometry: THREE.BufferGeometry) => parts.push({ joint, geometry });
  const g = p.girth;
  const coat = a.coat;
  const torsoColor = coat ? coat.color : a.vest ?? a.shirt;
  const stripes = a.shirtStripes !== undefined ? { color: a.shirtStripes, period: 0.055 } : undefined;

  // ---- hips: trousers seat, belt, sash, buckle ---------------------------------
  add('hips', xf(cyl(0.165 * g, 0.175 * g, 0.2, a.trousers, 14), 0, -0.02, 0, 0, 0, 0, 1, 1, 0.82));
  add('hips', xf(cyl(0.178 * g, 0.18 * g, 0.075, a.belt, 16), 0, 0.075, 0, 0, 0, 0, 1, 1, 0.84));
  add('hips', xf(cyl(0.186 * g, 0.19 * g, 0.06, a.sash, 16), 0, 0.02, 0, 0.12, 0, 0.05, 1, 1, 0.86));
  add('hips', xf(box(0.08, 0.065, 0.03, a.buckle), 0, 0.075, 0.155 * g));
  // sash tails hanging on the left hip
  add('hips', xf(box(0.06, 0.24, 0.02, a.sash), 0.15 * g, -0.08, 0.06, 0.1, 0, 0.18));
  add('hips', xf(box(0.05, 0.2, 0.02, a.sash), 0.17 * g, -0.06, 0.02, -0.05, 0, 0.32));

  // ---- coat skirt (long coat silhouette) -----------------------------------------
  if (coat) {
    const len = coat.length;
    const skirt = new THREE.CylinderGeometry(0.2 * g, 0.31 * g, len, 18, 4, true, 0.62, Math.PI * 2 - 1.24);
    colorize(skirt, coat.color, 0.25);
    add('hips', xf(skirt, 0, 0.08 - len / 2, -0.01, 0, 0, 0, 1, 1, 0.8));
    // trim at hem
    const hem = new THREE.CylinderGeometry(0.312 * g, 0.315 * g, 0.035, 18, 1, true, 0.62, Math.PI * 2 - 1.24);
    colorize(hem, coat.trim, 0.05);
    add('hips', xf(hem, 0, 0.08 - len + 0.016, -0.01, 0, 0, 0, 1, 1, 0.8));
  }

  // ---- spine (waist / lower torso) -------------------------------------------------
  {
    const waist = new THREE.CylinderGeometry(0.175 * g, 0.165 * g, 0.26, 16, 4);
    colorize(waist, coat || a.vest ? torsoColor : a.shirt, 0.12, coat || a.vest ? undefined : stripes);
    add('spine', xf(waist, 0, 0.11, 0, 0, 0, 0, 1, 1, 0.82));
    if (coat || a.vest) {
      // shirt visible through the open front
      add('spine', xf(box(0.11, 0.26, 0.03, a.shirt), 0, 0.12, 0.128 * g));
    }
  }

  // ---- chest (upper torso, shoulders) -------------------------------------------------
  {
    const chestGeo = new THREE.SphereGeometry(0.2, 16, 12);
    colorize(chestGeo, coat || a.vest ? torsoColor : a.shirt, 0.18, coat || a.vest ? undefined : stripes);
    add('chest', xf(chestGeo, 0, 0.07, 0, 0, 0, 0, 1.18 * g, 1.0, 0.76 * g));
    if (coat || a.vest) {
      // open shirt front (V) and lapels
      add('chest', xf(box(0.12, 0.22, 0.03, a.shirt), 0, 0.06, 0.142 * g, -0.12, 0, 0));
      const lapelColor = coat ? coat.trim : a.vest!;
      add('chest', xf(box(0.035, 0.26, 0.02, lapelColor), 0.075, 0.05, 0.145 * g, -0.12, 0.25, 0.08));
      add('chest', xf(box(0.035, 0.26, 0.02, lapelColor), -0.075, 0.05, 0.145 * g, -0.12, -0.25, -0.08));
      if (coat) {
        for (const y of [0.0, 0.07, 0.14]) {
          add('chest', xf(sphere(0.012, coat.trim, 6, 4), 0.1, y, 0.148 * g));
          add('chest', xf(sphere(0.012, coat.trim, 6, 4), -0.1, y, 0.148 * g));
        }
      }
    }
    // shoulder caps
    const capColor = coat ? coat.color : a.vest ?? a.shirt;
    add('chest', xf(sphere(0.085, capColor, 10, 8), p.shoulderWidth - 0.02, p.shoulderHeight - 0.02, 0, 0, 0, 0, 1.1, 0.8, 1));
    add('chest', xf(sphere(0.085, capColor, 10, 8), -p.shoulderWidth + 0.02, p.shoulderHeight - 0.02, 0, 0, 0, 0, 1.1, 0.8, 1));
    if (coat) {
      add('chest', xf(cyl(0.06, 0.09, 0.03, coat.trim, 10), p.shoulderWidth - 0.01, p.shoulderHeight + 0.045, 0, 0, 0, 0.2));
      add('chest', xf(cyl(0.06, 0.09, 0.03, coat.trim, 10), -p.shoulderWidth + 0.01, p.shoulderHeight + 0.045, 0, 0, 0, -0.2));
    }
    if (a.neckerchief) add('chest', xf(cyl(0.075, 0.1, 0.07, a.neckerchief, 12), 0, 0.215, 0.01));
  }

  // ---- neck & head ---------------------------------------------------------------------
  add('neck', xf(cyl(0.055, 0.065, 0.12, a.skin, 10), 0, 0.03, 0));
  const hs = p.headSize;
  add('head', xf(sphere(hs * 0.6, a.skin, 16, 12, 0.1), 0, 0.12, 0, 0, 0, 0, 0.95, 1.08, 1.0));
  // nose, ears, eyes, brows
  add('head', xf(sphere(hs * 0.12, darken(a.skin, 0.92), 8, 6), 0, 0.115, hs * 0.6));
  add('head', xf(sphere(hs * 0.1, a.skin, 8, 6), hs * 0.57, 0.12, 0, 0, 0, 0, 0.5, 1, 0.8));
  add('head', xf(sphere(hs * 0.1, a.skin, 8, 6), -hs * 0.57, 0.12, 0, 0, 0, 0, 0.5, 1, 0.8));
  add('head', xf(sphere(hs * 0.075, 0x1a1210, 8, 6), hs * 0.22, 0.142, hs * 0.5));
  add('head', xf(sphere(hs * 0.075, 0x1a1210, 8, 6), -hs * 0.22, 0.142, hs * 0.5));
  add('head', xf(box(hs * 0.3, hs * 0.07, hs * 0.08, a.hair), hs * 0.22, 0.178, hs * 0.5, 0, 0, -0.12));
  add('head', xf(box(hs * 0.3, hs * 0.07, hs * 0.08, a.hair), -hs * 0.22, 0.178, hs * 0.5, 0, 0, 0.12));
  if (a.eyepatch) {
    add('head', xf(cyl(hs * 0.14, hs * 0.14, 0.02, 0x111111, 10), -hs * 0.22, 0.142, hs * 0.54, Math.PI / 2, 0, 0));
    add('head', xf(cyl(hs * 0.62, hs * 0.62, 0.018, 0x111111, 18, true), 0, 0.16, 0, 0.35, 0, -0.25));
  }
  // beard
  if (a.beard === 'full') {
    add('head', xf(sphere(hs * 0.5, a.hair, 12, 8), 0, 0.045, hs * 0.22, 0.25, 0, 0, 1.0, 0.85, 0.85));
    add('head', xf(box(hs * 0.5, hs * 0.08, hs * 0.08, a.hair), 0, 0.085, hs * 0.58));
  } else if (a.beard === 'goatee') {
    add('head', xf(sphere(hs * 0.2, a.hair, 8, 6), 0, 0.03, hs * 0.5, 0, 0, 0, 1, 1.4, 0.8));
    add('head', xf(box(hs * 0.42, hs * 0.07, hs * 0.07, a.hair), 0, 0.085, hs * 0.58));
  } else if (a.beard === 'stubble') {
    add('head', xf(sphere(hs * 0.52, darken(a.skin, 0.75), 12, 8), 0, 0.075, hs * 0.12, 0.3, 0, 0, 0.98, 0.7, 0.95));
  }
  // hair
  if (a.hairStyle !== 'bald') {
    add('head', xf(sphere(hs * 0.63, a.hair, 14, 10), 0, 0.14, -hs * 0.08, 0, 0, 0, 0.98, 1.0, 0.98));
    if (a.hairStyle === 'ponytail') {
      add('head', xf(capsule(0.035, 0.2, a.hair, 8), 0, 0.02, -hs * 0.62, 0.35, 0, 0));
      add('head', xf(cyl(0.04, 0.04, 0.03, a.sash, 8), 0, 0.11, -hs * 0.6, 0.35, 0, 0));
    } else if (a.hairStyle === 'long') {
      add('head', xf(box(hs * 1.0, hs * 1.0, hs * 0.3, a.hair), 0, 0.03, -hs * 0.48, 0.1, 0, 0));
    }
  }
  if (a.earring) add('head', xf(colorize(new THREE.TorusGeometry(0.018, 0.005, 6, 12), 0xe8c050, 0), hs * 0.6, 0.08, 0, 0, Math.PI / 2, 0));

  // headwear
  if (a.headwear === 'tricorn') {
    const hat = a.hat ?? 0x1a1a1a;
    add('head', xf(tricornBrim(0.29, hat, a.hatTrim ?? hat), 0, 0.2, 0.0));
    add('head', xf(cyl(0.118, 0.135, 0.15, hat, 16), 0, 0.27, -0.005, 0, 0, 0, 1.05, 1, 1.0));
    add('head', xf(sphere(0.124, hat, 14, 6), 0, 0.33, -0.005, 0, 0, 0, 1.03, 0.45, 1.0));
    if (a.feather) add('head', xf(feather(a.feather), 0.1, 0.3, -0.07, 0, -0.4, 0.15));
  } else if (a.headwear === 'bandana') {
    const bc = a.bandana ?? 0xaa2222;
    add('head', xf(sphere(hs * 0.66, bc, 14, 8), 0, 0.165, -hs * 0.02, 0, 0, 0, 1.0, 0.82, 1.02));
    add('head', xf(box(0.06, 0.16, 0.025, bc), 0.03, 0.06, -hs * 0.68, 0.3, 0, 0.25));
    add('head', xf(box(0.05, 0.14, 0.025, bc), -0.03, 0.07, -hs * 0.68, 0.25, 0, -0.3));
  }

  // ---- arms --------------------------------------------------------------------------------
  for (const side of ['L', 'R'] as const) {
    const sleeve = coat ? coat.color : a.shirt;
    const sleeveStripes = !coat && stripes ? stripes : undefined;
    const ua = new THREE.CapsuleGeometry(0.068 * g, p.upperArm - 0.06, 4, 10);
    colorize(ua, sleeve, 0.12, sleeveStripes);
    add(`upperArm${side}`, xf(ua, 0, -p.upperArm / 2, 0));
    const fa = new THREE.CapsuleGeometry(0.058 * g, p.forearm - 0.07, 4, 10);
    colorize(fa, coat ? coat.color : a.vest === undefined ? a.shirt : a.skin, 0.12);
    add(`forearm${side}`, xf(fa, 0, -p.forearm / 2 + 0.01, 0));
    if (coat) {
      add(`forearm${side}`, xf(cyl(0.085, 0.09, 0.07, coat.trim, 12), 0, -p.forearm + 0.075, 0));
      add(`forearm${side}`, xf(cyl(0.07, 0.085, 0.04, a.shirt, 10), 0, -p.forearm + 0.02, 0));
    } else {
      // rolled sleeve cuff at the elbow
      add(`forearm${side}`, xf(cyl(0.075, 0.075, 0.06, a.shirt, 10), 0, -0.03, 0));
    }
    const handColor = a.gloves ?? a.skin;
    add(`hand${side}`, xf(sphere(0.06, handColor, 10, 8), 0, -0.055, 0.005, 0, 0, 0, 0.85, 1.05, 1.0));
    add(`hand${side}`, xf(sphere(0.026, handColor, 8, 6), side === 'L' ? -0.035 : 0.035, -0.04, 0.035));
  }

  // ---- legs ----------------------------------------------------------------------------------
  for (const side of ['L', 'R'] as const) {
    const th = new THREE.CapsuleGeometry(0.088 * g, p.thigh - 0.08, 4, 10);
    colorize(th, a.trousers, 0.14);
    add(`thigh${side}`, xf(th, 0, -p.thigh / 2, 0));
    if (a.boots !== null) {
      // tall cuffed boot
      add(`shin${side}`, xf(cyl(0.083, 0.07, p.shin - 0.04, a.boots, 12), 0, -p.shin / 2 - 0.01, 0));
      add(`shin${side}`, xf(cyl(0.11, 0.095, 0.11, a.bootCuff ?? a.boots, 12, true), 0, 0.0, 0.005, 0.12, 0, 0));
      add(`foot${side}`, xf(box(0.12, 0.09, 0.27, a.boots), 0, -0.02, 0.055));
      add(`foot${side}`, xf(box(0.13, 0.025, 0.29, 0x1a120c), 0, -0.065, 0.055));
    } else {
      // rolled trousers + bare shins/feet
      add(`shin${side}`, xf(cyl(0.08, 0.075, 0.16, a.trousers, 12), 0, -0.07, 0));
      add(`shin${side}`, xf(cyl(0.085, 0.085, 0.05, darken(a.trousers, 1.15), 12), 0, -0.16, 0));
      add(`shin${side}`, xf(cyl(0.05, 0.045, p.shin - 0.16, a.skin, 10), 0, -0.16 - (p.shin - 0.16) / 2, 0));
      add(`foot${side}`, xf(box(0.09, 0.06, 0.22, a.skin), 0, -0.035, 0.05));
    }
  }
  return parts;
}

function darken(hex: number, f: number): number {
  const c = new THREE.Color(hex).multiplyScalar(f);
  return c.getHex();
}

/** Cutlass / sabre: grip at the origin, blade along +Z. */
export function buildWeapon(kind: Appearance['weapon']): { geometry: THREE.BufferGeometry; bladeLength: number } | null {
  if (kind === 'none') return null;
  const rusty = kind === 'rustyCutlass';
  const parts: THREE.BufferGeometry[] = [];
  const bladeLength = rusty ? 0.74 : 0.82;
  // blade: curved tapered extrusion (shape in XY, then rotated so length runs along +Z)
  const s = new THREE.Shape();
  const w0 = rusty ? 0.05 : 0.046;
  s.moveTo(-w0 / 2, 0);
  s.lineTo(w0 / 2, 0);
  s.quadraticCurveTo(w0 * 0.9, bladeLength * 0.6, w0 * 0.4 + 0.035, bladeLength * 0.97);
  s.lineTo(w0 * 0.1 + 0.03, bladeLength);
  s.quadraticCurveTo(-w0 * 0.2, bladeLength * 0.6, -w0 / 2, 0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1, curveSegments: 8 });
  blade.translate(0, 0, -0.004);
  colorize(blade, rusty ? 0xa89a8a : 0xdfe6ec, 0.25);
  blade.rotateX(Math.PI / 2); // +Y -> +Z
  blade.rotateZ(Math.PI / 2); // flat of the blade faces sideways
  blade.translate(0, 0, 0.075);
  parts.push(blade);
  // guard: knuckle bow + quillon
  const bow = new THREE.TorusGeometry(0.055, 0.009, 6, 14, Math.PI);
  colorize(bow, rusty ? 0x6a5a40 : 0xd4a43a, 0.1);
  bow.rotateY(Math.PI / 2);
  bow.translate(0, -0.02, 0.0);
  parts.push(bow);
  const quillon = new THREE.BoxGeometry(0.03, 0.1, 0.022);
  colorize(quillon, rusty ? 0x6a5a40 : 0xd4a43a, 0.1);
  quillon.translate(0, 0.0, 0.07);
  parts.push(quillon);
  const grip = new THREE.CylinderGeometry(0.019, 0.019, 0.13, 8);
  colorize(grip, 0x3a2416, 0.1);
  grip.rotateX(Math.PI / 2);
  parts.push(grip);
  const pommel = new THREE.SphereGeometry(0.026, 8, 6);
  colorize(pommel, rusty ? 0x6a5a40 : 0xd4a43a, 0.1);
  pommel.translate(0, 0, -0.075);
  parts.push(pommel);
  for (const pgeo of parts) {
    if (pgeo.index === null) {
      const idx: number[] = [];
      for (let i = 0; i < pgeo.attributes.position.count; i++) idx.push(i);
      pgeo.setIndex(idx);
    }
    pgeo.deleteAttribute('uv');
  }
  const merged = mergeSimple(parts);
  return { geometry: merged, bladeLength: bladeLength + 0.075 };
}

/** Merge geometries that only have position/normal/color. */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vCount = 0;
  let iCount = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    nrm.set(g.attributes.normal.array as Float32Array, vo * 3);
    if (g.attributes.color) col.set(g.attributes.color.array as Float32Array, vo * 3);
    else col.fill(1, vo * 3, (vo + n) * 3);
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + vo;
      io += src.length;
    } else {
      for (let i = 0; i < n; i++) idx[io + i] = vo + i;
      io += n;
    }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
