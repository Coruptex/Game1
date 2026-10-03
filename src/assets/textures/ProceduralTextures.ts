import * as THREE from 'three';
import { Rng } from '../../utils/random';
import { PeriodicNoise } from '../../utils/noise';

/**
 * Runtime-painted textures. Everything is generated on canvases so the project has no
 * third-party art dependencies. Textures are cached by key and shared between materials.
 *
 * Painting style: layered semi-transparent brush strokes + value noise, which reads as
 * "illustrated" rather than photographic when combined with vertex colour variation.
 */

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, THREE.Texture>();

let maxAnisotropy = 4;
export function setTextureAnisotropy(value: number): void {
  maxAnisotropy = value;
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D canvas not supported');
  return { c, ctx };
}

interface TexOptions {
  repeat?: boolean;
  srgb?: boolean;
  mipmaps?: boolean;
}

function finish(c: HTMLCanvasElement, opts: TexOptions = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat !== false) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = maxAnisotropy;
  t.generateMipmaps = opts.mipmaps !== false;
  t.minFilter = opts.mipmaps === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    t.name = key;
    cache.set(key, t);
  }
  return t;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a.toFixed(3)})`;
}

/** Draws `fn` at (x, y) and at wrapped copies so strokes near the border tile seamlessly. */
function wrapped(w: number, h: number, x: number, y: number, margin: number, fn: (x: number, y: number) => void): void {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * w;
      const py = y + oy * h;
      if (px < -margin || px > w + margin || py < -margin || py > h + margin) continue;
      fn(px, py);
    }
  }
}

/** Multiplies the canvas by tileable value noise to add painterly unevenness. */
function noiseOverlay(ctx: Ctx, w: number, h: number, seed: number, strength: number, period = 8, octaves = 4): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = new PeriodicNoise(period, seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = n.fbm(x / w, y / h, octaves);
      const f = 1 + (v - 0.5) * 2 * strength;
      const i = (y * w + x) * 4;
      d[i] = Math.min(255, d[i] * f);
      d[i + 1] = Math.min(255, d[i + 1] * f);
      d[i + 2] = Math.min(255, d[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Wood
// ---------------------------------------------------------------------------

/** Weathered deck planks running along U. One texture tile = 8 planks. */
export function woodPlanksTexture(): THREE.Texture {
  return cached('woodPlanks', () => {
    const W = 512;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(11);
    const planks = 8;
    const ph = H / planks;
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      const hue = 28 + rng.range(-4, 5);
      const light = 0.36 + rng.range(-0.06, 0.07);
      const sat = 0.38 + rng.range(-0.08, 0.06);
      ctx.fillStyle = hsl(hue, sat, light);
      ctx.fillRect(0, y0, W, ph);
      // grain streaks
      for (let g = 0; g < 46; g++) {
        const gy = y0 + rng.range(2, ph - 2);
        const amp = rng.range(0.5, 2.5);
        const freq = rng.range(0.005, 0.02);
        const phase = rng.range(0, 6.28);
        ctx.strokeStyle = rng.chance(0.5)
          ? hsl(hue - 4, sat + 0.05, light - rng.range(0.06, 0.13), rng.range(0.25, 0.6))
          : hsl(hue + 4, sat - 0.05, light + rng.range(0.04, 0.1), rng.range(0.15, 0.4));
        ctx.lineWidth = rng.range(0.6, 2.2);
        ctx.beginPath();
        for (let x = -4; x <= W + 4; x += 8) {
          const yy = gy + Math.sin(x * freq + phase) * amp;
          if (x === -4) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // knots
      const knots = rng.int(0, 2);
      for (let k = 0; k < knots; k++) {
        const kx = rng.range(20, W - 20);
        const ky = y0 + rng.range(ph * 0.3, ph * 0.7);
        for (let r = 3; r > 0; r--) {
          ctx.strokeStyle = hsl(hue - 6, sat + 0.1, light - 0.12 - r * 0.03, 0.6);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(kx, ky, r * 4.5, r * 2.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = hsl(hue - 8, sat, light - 0.2, 0.9);
        ctx.beginPath();
        ctx.ellipse(kx, ky, 3.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // plank gap shadow + bevel highlight
      ctx.fillStyle = 'rgba(28, 16, 8, 0.85)';
      ctx.fillRect(0, y0, W, 2.5);
      ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
      ctx.fillRect(0, y0 + 2.5, W, 2);
      ctx.fillStyle = 'rgba(20, 10, 5, 0.25)';
      ctx.fillRect(0, y0 + ph - 4, W, 4);
      // end seams with nails
      const seamCount = rng.int(1, 2);
      for (let s = 0; s < seamCount; s++) {
        const sx = rng.range(30, W - 30);
        ctx.fillStyle = 'rgba(25, 14, 6, 0.85)';
        ctx.fillRect(sx, y0, 2.5, ph);
        ctx.fillStyle = 'rgba(40, 32, 28, 0.9)';
        for (const nx of [sx - 7, sx + 9]) {
          ctx.beginPath();
          ctx.arc(nx, y0 + ph * 0.3, 2.2, 0, Math.PI * 2);
          ctx.arc(nx, y0 + ph * 0.7, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // salt-bleached weathering
    for (let i = 0; i < 260; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      ctx.fillStyle = hsl(35, 0.15, rng.range(0.55, 0.75), rng.range(0.03, 0.08));
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(10, 40), rng.range(2, 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    noiseOverlay(ctx, W, H, 5, 0.18, 6);
    return finish(c);
  });
}

/** Generic vertical wood grain (posts, crates, barrels, hull). */
export function woodGrainTexture(): THREE.Texture {
  return cached('woodGrain', () => {
    const W = 256;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(23);
    ctx.fillStyle = hsl(27, 0.4, 0.36);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) {
      const x0 = rng.range(0, W);
      const amp = rng.range(1, 4);
      const freq = rng.range(0.01, 0.03);
      const ph = rng.range(0, 6.28);
      ctx.strokeStyle = rng.chance(0.55)
        ? hsl(24, 0.45, rng.range(0.2, 0.3), rng.range(0.25, 0.55))
        : hsl(32, 0.35, rng.range(0.42, 0.52), rng.range(0.15, 0.35));
      ctx.lineWidth = rng.range(0.6, 2.5);
      const draw = (ox: number) => {
        ctx.beginPath();
        for (let y = -4; y <= H + 4; y += 8) {
          const xx = x0 + ox + Math.sin(y * freq + ph) * amp;
          if (y === -4) ctx.moveTo(xx, y);
          else ctx.lineTo(xx, y);
        }
        ctx.stroke();
      };
      draw(0);
      if (x0 < 8) draw(W);
      if (x0 > W - 8) draw(-W);
    }
    noiseOverlay(ctx, W, H, 9, 0.2, 4);
    return finish(c);
  });
}

/** Thatch / palm-leaf roofing. */
export function thatchTexture(): THREE.Texture {
  return cached('thatch', () => {
    const W = 256;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(31);
    ctx.fillStyle = hsl(40, 0.45, 0.4);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      const len = rng.range(14, 40);
      const col = hsl(rng.range(34, 52), rng.range(0.35, 0.6), rng.range(0.28, 0.62), rng.range(0.5, 0.9));
      wrapped(W, H, x, y, 45, (px, py) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = rng.range(0.8, 2);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + rng.range(-3, 3), py + len);
        ctx.stroke();
      });
    }
    // horizontal binding rows
    for (let r = 0; r < 4; r++) {
      const y = r * (H / 4) + 6;
      ctx.fillStyle = 'rgba(40, 25, 10, 0.35)';
      ctx.fillRect(0, y, W, 5);
    }
    return finish(c);
  });
}

// ---------------------------------------------------------------------------
// Stone
// ---------------------------------------------------------------------------

/** Ancient cut stone blocks with mortar, chips and moss along top edges. */
export function stoneBlocksTexture(): THREE.Texture {
  return cached('stoneBlocks', () => {
    const W = 512;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(41);
    ctx.fillStyle = hsl(60, 0.08, 0.32);
    ctx.fillRect(0, 0, W, H);
    const rows = 6;
    const rh = H / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * rng.range(30, 70) - 80;
      while (x < W) {
        const bw = rng.range(70, 140);
        const hue = rng.range(40, 75);
        const light = rng.range(0.5, 0.64);
        const sat = rng.range(0.06, 0.16);
        const x0 = x + 3;
        const y0 = r * rh + 3;
        const w = bw - 6;
        const h = rh - 6;
        const drawBlock = (ox: number) => {
          const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
          g.addColorStop(0, hsl(hue, sat, light + 0.06));
          g.addColorStop(1, hsl(hue, sat, light - 0.08));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(x0 + ox, y0, w, h, 6);
          ctx.fill();
          // chips / cracks
          for (let k = 0; k < 4; k++) {
            ctx.strokeStyle = hsl(hue, sat, light - 0.25, 0.45);
            ctx.lineWidth = 1;
            ctx.beginPath();
            let cx = x0 + ox + rng.range(5, w - 5);
            let cy = y0 + rng.range(5, h - 5);
            ctx.moveTo(cx, cy);
            for (let s = 0; s < 3; s++) {
              cx += rng.range(-12, 12);
              cy += rng.range(-8, 8);
              ctx.lineTo(cx, cy);
            }
            ctx.stroke();
          }
          // moss on top edge
          for (let m = 0; m < 14; m++) {
            ctx.fillStyle = hsl(rng.range(75, 100), rng.range(0.35, 0.55), rng.range(0.25, 0.38), rng.range(0.35, 0.7));
            ctx.beginPath();
            ctx.ellipse(x0 + ox + rng.range(0, w), y0 + rng.range(0, 8), rng.range(4, 12), rng.range(2, 6), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        };
        drawBlock(0);
        if (x0 + w > W) drawBlock(-W);
        if (x0 < 0) drawBlock(W);
        x += bw;
      }
    }
    noiseOverlay(ctx, W, H, 13, 0.25, 8);
    return finish(c);
  });
}

/** Grayscale painterly noise used as a detail multiplier on rocks / terrain (around 0.75..1.0). */
export function rockDetailTexture(): THREE.Texture {
  return cached('rockDetail', () => {
    const W = 256;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(51);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      const l = rng.range(0.6, 1.0);
      const col = `rgba(${Math.round(l * 255)}, ${Math.round(l * 255)}, ${Math.round(l * 255)}, ${rng.range(0.15, 0.4).toFixed(2)})`;
      const rx = rng.range(4, 16);
      const ry = rng.range(2, 8);
      const rot = rng.range(0, Math.PI);
      wrapped(W, H, x, y, 20, (px, py) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    noiseOverlay(ctx, W, H, 17, 0.25, 8);
    return finish(c, { srgb: false });
  });
}

/** Painterly terrain detail (grayscale, ~0.8..1.05) applied in world-space UVs. */
export function groundDetailTexture(): THREE.Texture {
  return cached('groundDetail', () => {
    const W = 512;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(61);
    ctx.fillStyle = 'rgb(222,222,222)';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3400; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      const l = rng.chance(0.5) ? rng.range(0.52, 0.8) : rng.range(0.92, 1.0);
      const v = Math.round(l * 255);
      const col = `rgba(${v}, ${v}, ${v}, ${rng.range(0.2, 0.5).toFixed(2)})`;
      const rx = rng.range(3, 12);
      const ry = rng.range(1.5, 4);
      const rot = rng.range(-0.5, 0.5) + (rng.chance(0.5) ? 0 : Math.PI / 2);
      wrapped(W, H, x, y, 14, (px, py) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    noiseOverlay(ctx, W, H, 19, 0.22, 6);
    return finish(c, { srgb: false });
  });
}

// ---------------------------------------------------------------------------
// Foliage (alpha-tested cards)
// ---------------------------------------------------------------------------

/**
 * Palm frond: rachis along the texture's V axis (bottom = base), leaflets angled outward.
 * The mesh maps u in [0,1] across the frond width and v along its length.
 */
export function palmFrondTexture(): THREE.Texture {
  return cached('palmFrond', () => {
    const W = 256;
    const H = 1024;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(71);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const count = 46;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const y = H - 40 - t * (H - 80);
      const len = (W * 0.48) * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI * 0.92) * rng.range(0.85, 1.05);
      for (const side of [-1, 1]) {
        const ang = (0.55 + t * 0.35) * side;
        const ex = cx + Math.sin(ang) * len;
        const ey = y - Math.cos(ang) * len * 0.55 - len * 0.25;
        const light = 0.3 + t * 0.12 + rng.range(-0.05, 0.05);
        const grad = ctx.createLinearGradient(cx, y, ex, ey);
        grad.addColorStop(0, hsl(105, 0.55, light - 0.08));
        grad.addColorStop(0.6, hsl(95, 0.6, light + 0.04));
        grad.addColorStop(1, hsl(78, 0.65, light + 0.14));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, y + 6);
        const mx = (cx + ex) / 2;
        const my = (y + ey) / 2;
        ctx.quadraticCurveTo(mx + side * 4, my + 10, ex, ey);
        ctx.quadraticCurveTo(mx - side * 2, my - 6, cx, y - 6);
        ctx.closePath();
        ctx.fill();
        // midrib highlight
        ctx.strokeStyle = hsl(80, 0.5, light + 0.18, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(mx + side * 2, my + 2, ex, ey);
        ctx.stroke();
      }
    }
    // rachis
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, hsl(60, 0.4, 0.35));
    g.addColorStop(1, hsl(80, 0.5, 0.45));
    ctx.strokeStyle = g;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, H);
    ctx.lineTo(cx, 30);
    ctx.stroke();
    return finish(c, { repeat: false });
  });
}

/** Fern frond (finer pinnae, darker greens). */
export function fernFrondTexture(): THREE.Texture {
  return cached('fernFrond', () => {
    const W = 256;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(81);
    const cx = W / 2;
    const count = 30;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const y = H - 20 - t * (H - 40);
      const len = W * 0.46 * Math.sin((1 - t) * Math.PI * 0.55 + 0.15) * rng.range(0.9, 1.05);
      for (const side of [-1, 1]) {
        const ex = cx + side * len;
        const ey = y - len * 0.35;
        const light = 0.26 + t * 0.14 + rng.range(-0.04, 0.04);
        ctx.fillStyle = hsl(112 - t * 15, 0.55, light);
        ctx.beginPath();
        ctx.moveTo(cx, y + 3);
        // lobed pinna
        const lobes = 5;
        for (let l = 0; l <= lobes; l++) {
          const lt = l / lobes;
          const px = cx + (ex - cx) * lt;
          const py = y + (ey - y) * lt + 5 * (1 - lt);
          ctx.lineTo(px, py + 4 * Math.sin(lt * Math.PI));
        }
        for (let l = lobes; l >= 0; l--) {
          const lt = l / lobes;
          const px = cx + (ex - cx) * lt;
          const py = y + (ey - y) * lt - 6 * (1 - lt);
          ctx.lineTo(px, py - 3 * Math.sin(lt * Math.PI));
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.strokeStyle = hsl(90, 0.45, 0.32);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, H);
    ctx.lineTo(cx, 12);
    ctx.stroke();
    return finish(c, { repeat: false });
  });
}

/** Broad tropical leaf (banana / heliconia style) with veins and a couple of splits. */
export function broadLeafTexture(): THREE.Texture {
  return cached('broadLeaf', () => {
    const W = 256;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(91);
    const cx = W / 2;
    ctx.beginPath();
    ctx.moveTo(cx, H - 4);
    ctx.bezierCurveTo(W * 0.02, H * 0.75, W * 0.0, H * 0.25, cx, 6);
    ctx.bezierCurveTo(W * 1.0, H * 0.25, W * 0.98, H * 0.75, cx, H - 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, hsl(118, 0.55, 0.22));
    g.addColorStop(0.5, hsl(108, 0.6, 0.32));
    g.addColorStop(1, hsl(92, 0.62, 0.42));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // veins
    for (let i = 0; i < 22; i++) {
      const y = H - 30 - i * ((H - 60) / 22);
      for (const side of [-1, 1]) {
        ctx.strokeStyle = hsl(95, 0.45, 0.42, 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + side * W * 0.25, y - 30, cx + side * W * 0.55, y - 70);
        ctx.stroke();
      }
    }
    // splits (transparent tears)
    ctx.globalCompositeOperation = 'destination-out';
    for (let s = 0; s < 4; s++) {
      const side = rng.sign();
      const y = rng.range(H * 0.2, H * 0.8);
      ctx.lineWidth = rng.range(2, 4);
      ctx.beginPath();
      ctx.moveTo(cx + side * W * 0.6, y - 80);
      ctx.quadraticCurveTo(cx + side * W * 0.25, y - 30, cx + side * rng.range(12, 40), y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hsl(80, 0.45, 0.5);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, H);
    ctx.lineTo(cx, 12);
    ctx.stroke();
    return finish(c, { repeat: false });
  });
}

/**
 * Leaf cluster card used to build fluffy canopy volumes (many cards around a sphere).
 * `variant` shifts the palette (0 = jungle green, 1 = sunlit lime, 2 = dark understory).
 */
export function leafClusterTexture(variant = 0): THREE.Texture {
  return cached(`leafCluster${variant}`, () => {
    const W = 256;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(101 + variant * 7);
    const baseHue = [108, 95, 125][variant] ?? 108;
    const baseLight = [0.3, 0.4, 0.22][variant] ?? 0.3;
    const count = 44;
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * W * 0.36;
      const x = W / 2 + Math.cos(a) * r;
      const y = H / 2 + Math.sin(a) * r;
      const len = rng.range(26, 44);
      const wid = len * rng.range(0.32, 0.45);
      const rot = a + rng.range(-0.6, 0.6);
      const light = baseLight + rng.range(-0.07, 0.12) + (1 - r / (W * 0.36)) * -0.05;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      g.addColorStop(0, hsl(baseHue + 6, 0.55, light - 0.06));
      g.addColorStop(1, hsl(baseHue - 12, 0.62, light + 0.1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.quadraticCurveTo(0, -wid, len / 2, 0);
      ctx.quadraticCurveTo(0, wid, -len / 2, 0);
      ctx.fill();
      ctx.strokeStyle = hsl(baseHue - 15, 0.4, light + 0.12, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
    return finish(c, { repeat: false });
  });
}

/** Grass / small plant blades card. */
export function grassCardTexture(): THREE.Texture {
  return cached('grassCard', () => {
    const W = 128;
    const H = 128;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(111);
    for (let i = 0; i < 26; i++) {
      const x = rng.range(10, W - 10);
      const h = rng.range(H * 0.45, H * 0.95);
      const bend = rng.range(-18, 18);
      const g = ctx.createLinearGradient(0, H, 0, H - h);
      g.addColorStop(0, hsl(100, 0.5, 0.2));
      g.addColorStop(1, hsl(rng.range(70, 95), 0.6, rng.range(0.42, 0.55)));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 3, H);
      ctx.quadraticCurveTo(x + bend * 0.4, H - h * 0.6, x + bend, H - h);
      ctx.quadraticCurveTo(x + bend * 0.4 + 2, H - h * 0.55, x + 3, H);
      ctx.closePath();
      ctx.fill();
    }
    return finish(c, { repeat: false });
  });
}

// ---------------------------------------------------------------------------
// Bark
// ---------------------------------------------------------------------------

/** Palm trunk: stacked ring scars with a diamond/scale pattern. U wraps around, V up the trunk. */
export function palmBarkTexture(): THREE.Texture {
  return cached('palmBark', () => {
    const W = 256;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(121);
    ctx.fillStyle = hsl(32, 0.25, 0.42);
    ctx.fillRect(0, 0, W, H);
    const rings = 8;
    const rh = H / rings;
    for (let r = 0; r < rings; r++) {
      const y = r * rh;
      const g = ctx.createLinearGradient(0, y, 0, y + rh);
      g.addColorStop(0, hsl(30, 0.25, 0.3));
      g.addColorStop(0.25, hsl(34, 0.28, 0.5));
      g.addColorStop(1, hsl(30, 0.25, 0.4));
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, rh);
      // scale notches
      for (let k = 0; k < 10; k++) {
        const x = (k + (r % 2) * 0.5) * (W / 10);
        ctx.fillStyle = hsl(28, 0.3, 0.26, 0.5);
        wrapped(W, H, x, y, 20, (px, py) => {
          ctx.beginPath();
          ctx.moveTo(px - 10, py + 2);
          ctx.lineTo(px, py + rh * 0.55);
          ctx.lineTo(px + 10, py + 2);
          ctx.closePath();
          ctx.fill();
        });
      }
      ctx.fillStyle = 'rgba(20, 12, 6, 0.55)';
      ctx.fillRect(0, y, W, 2);
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = hsl(30, 0.2, rng.range(0.3, 0.6), 0.15);
      ctx.fillRect(rng.range(0, W), rng.range(0, H), rng.range(1, 3), rng.range(4, 12));
    }
    noiseOverlay(ctx, W, H, 21, 0.2, 4);
    return finish(c);
  });
}

/** Rough jungle bark with vertical fibres and moss. */
export function jungleBarkTexture(): THREE.Texture {
  return cached('jungleBark', () => {
    const W = 256;
    const H = 512;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(131);
    ctx.fillStyle = hsl(30, 0.2, 0.3);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const x = rng.range(0, W);
      const col = rng.chance(0.5) ? hsl(28, 0.22, rng.range(0.16, 0.26), 0.6) : hsl(35, 0.18, rng.range(0.38, 0.5), 0.45);
      const wdt = rng.range(1.5, 5);
      const amp = rng.range(2, 6);
      const ph = rng.range(0, 6);
      const offsets = x < 10 ? [0, W] : x > W - 10 ? [0, -W] : [0];
      for (const ox of offsets) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        for (let y = -6; y <= H + 6; y += 12) {
          const xx = x + ox + Math.sin(y * 0.02 + ph) * amp;
          if (y === -6) ctx.moveTo(xx, y);
          else ctx.lineTo(xx, y);
        }
        ctx.stroke();
      }
    }
    // moss patches
    for (let i = 0; i < 90; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      const col = hsl(rng.range(80, 105), 0.45, rng.range(0.26, 0.38), rng.range(0.4, 0.75));
      const rx = rng.range(6, 22);
      const ry = rng.range(4, 14);
      wrapped(W, H, x, y, 25, (px, py) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    noiseOverlay(ctx, W, H, 23, 0.22, 4);
    return finish(c);
  });
}

// ---------------------------------------------------------------------------
// Cloth
// ---------------------------------------------------------------------------

/** Weathered sail canvas with vertical seams, patches and a darker hem. */
export function sailClothTexture(): THREE.Texture {
  return cached('sailCloth', () => {
    const W = 256;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const rng = new Rng(141);
    ctx.fillStyle = hsl(40, 0.35, 0.86);
    ctx.fillRect(0, 0, W, H);
    const strips = 6;
    for (let s = 0; s < strips; s++) {
      const x = (s * W) / strips;
      ctx.fillStyle = hsl(40, 0.3 + rng.range(-0.05, 0.05), 0.8 + rng.range(-0.04, 0.04), 0.6);
      ctx.fillRect(x, 0, W / strips, H);
      ctx.fillStyle = 'rgba(120, 100, 70, 0.35)';
      ctx.fillRect(x, 0, 1.5, H);
    }
    for (let p = 0; p < 3; p++) {
      const px = rng.range(20, W - 60);
      const py = rng.range(20, H - 60);
      ctx.fillStyle = hsl(35, 0.3, 0.72, 0.85);
      ctx.fillRect(px, py, rng.range(20, 40), rng.range(18, 34));
      ctx.strokeStyle = 'rgba(90, 70, 50, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(px, py, 30, 26);
      ctx.setLineDash([]);
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(90, 70, 40, 0.0)');
    g.addColorStop(0.75, 'rgba(90, 70, 40, 0.08)');
    g.addColorStop(1, 'rgba(70, 50, 30, 0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    noiseOverlay(ctx, W, H, 27, 0.12, 6);
    return finish(c);
  });
}

/** Black pirate flag with skull and crossed bones. */
export function jollyRogerTexture(): THREE.Texture {
  return cached('jollyRoger', () => {
    const W = 256;
    const H = 170;
    const { c, ctx } = canvas(W, H);
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, W, H);
    // frayed edge
    ctx.globalCompositeOperation = 'destination-out';
    const rng = new Rng(151);
    for (let y = 0; y < H; y += 6) {
      ctx.beginPath();
      ctx.moveTo(W, y);
      ctx.lineTo(W - rng.range(4, 16), y + 3);
      ctx.lineTo(W, y + 6);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const cx = W * 0.47;
    const cy = H * 0.44;
    ctx.fillStyle = '#ece6d6';
    ctx.strokeStyle = '#ece6d6';
    // crossbones
    ctx.lineCap = 'round';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy + 52);
    ctx.lineTo(cx + 52, cy - 20);
    ctx.moveTo(cx + 52, cy + 52);
    ctx.lineTo(cx - 52, cy - 20);
    ctx.stroke();
    for (const [bx, by] of [
      [cx - 52, cy + 52],
      [cx + 52, cy - 20],
      [cx + 52, cy + 52],
      [cx - 52, cy - 20],
    ]) {
      ctx.beginPath();
      ctx.arc(bx - 4, by, 8, 0, Math.PI * 2);
      ctx.arc(bx + 4, by + 3, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // skull
    ctx.beginPath();
    ctx.ellipse(cx, cy, 30, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx - 17, cy + 14, 34, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#141418';
    ctx.beginPath();
    ctx.ellipse(cx - 11, cy + 2, 8, 9, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 11, cy + 2, 8, 9, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 11);
    ctx.lineTo(cx - 4, cy + 19);
    ctx.lineTo(cx + 4, cy + 19);
    ctx.fill();
    ctx.fillRect(cx - 9, cy + 26, 3, 9);
    ctx.fillRect(cx - 1.5, cy + 26, 3, 9);
    ctx.fillRect(cx + 6, cy + 26, 3, 9);
    return finish(c, { repeat: false });
  });
}

/** Two-colour horizontal stripes for sailor shirts. */
export function stripesTexture(a: string, b: string): THREE.Texture {
  return cached(`stripes:${a}:${b}`, () => {
    const W = 64;
    const H = 64;
    const { c, ctx } = canvas(W, H);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = b;
    for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 8);
    return finish(c);
  });
}

/** Subtle woven fabric noise for clothing (multiplied with the material colour). */
export function fabricTexture(): THREE.Texture {
  return cached('fabric', () => {
    const W = 128;
    const H = 128;
    const { c, ctx } = canvas(W, H);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = `rgba(0,0,0,${(0.04 + (y % 4 === 0 ? 0.04 : 0)).toFixed(2)})`;
      ctx.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 0, 1, H);
    }
    noiseOverlay(ctx, W, H, 33, 0.15, 4);
    return finish(c, { srgb: false });
  });
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/** Tileable normal map built from layered periodic noise. */
export function waterNormalTexture(): THREE.Texture {
  return cached('waterNormal', () => {
    const S = 256;
    const { c, ctx } = canvas(S, S);
    const n1 = new PeriodicNoise(8, 201);
    const n2 = new PeriodicNoise(16, 202);
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S;
        const v = y / S;
        hgt[y * S + x] = n1.fbm(u, v, 3) * 0.7 + n2.fbm(u, v, 2) * 0.3;
      }
    }
    const img = ctx.createImageData(S, S);
    const strength = 5.5;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const l = hgt[y * S + ((x - 1 + S) % S)];
        const r = hgt[y * S + ((x + 1) % S)];
        const d = hgt[((y - 1 + S) % S) * S + x];
        const u = hgt[((y + 1) % S) * S + x];
        let nx = (l - r) * strength;
        let ny = (d - u) * strength;
        let nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;
        const i = (y * S + x) * 4;
        img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, { srgb: false });
  });
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Tiny equirectangular "tropical sky" for metal reflections (gold, brass, iron, blades): blue
 * zenith, bright hazy horizon, turquoise sea / warm sand below and a sun spot. Three converts it
 * to a PMREM on first use. Only metallic materials use it, so the rest of the look is unchanged.
 */
export function skyEnvironmentTexture(): THREE.Texture {
  return cached('skyEnvironment', () => {
    const W = 256;
    const H = 128;
    const { c, ctx } = canvas(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4f9bd0');
    g.addColorStop(0.36, '#9fd2ec');
    g.addColorStop(0.49, '#f4f1e2');
    g.addColorStop(0.52, '#6fc6c0');
    g.addColorStop(0.7, '#3f8f86');
    g.addColorStop(1, '#5b5238');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a few soft clouds along the horizon band
    for (let i = 0; i < 14; i++) {
      const x = (i * 97.3) % W;
      const y = H * (0.3 + ((i * 37) % 13) / 80);
      const r = 8 + ((i * 53) % 11);
      const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
      cg.addColorStop(0, 'rgba(255,255,255,0.55)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
    // the sun: warm hot spot high in the sky
    const sx = W * 0.62;
    const sy = H * 0.2;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    sg.addColorStop(0, 'rgba(255,252,236,1)');
    sg.addColorStop(0.25, 'rgba(255,236,190,0.9)');
    sg.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 24, sy - 24, 48, 48);
    const t = finish(c, { repeat: false, mipmaps: false });
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

export function softParticleTexture(): THREE.Texture {
  return cached('softParticle', () => {
    const S = 64;
    const { c, ctx } = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return finish(c, { repeat: false });
  });
}

/** Vertical gradient for light shafts (bright top fading downward and toward the sides). */
export function lightShaftTexture(): THREE.Texture {
  return cached('lightShaft', () => {
    const W = 64;
    const H = 256;
    const { c, ctx } = canvas(W, H);
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const v = y / (H - 1);
        const side = Math.pow(Math.sin(u * Math.PI), 1.6);
        const vert = Math.pow(1 - v, 0.8) * Math.min(1, v * 8 + 0.2);
        const a = side * vert;
        const i = (y * W + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, { repeat: false });
  });
}

/** Radial ring used for shockwaves / interaction highlights. */
export function ringTexture(): THREE.Texture {
  return cached('ring', () => {
    const S = 128;
    const { c, ctx } = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return finish(c, { repeat: false });
  });
}

/** Foam noise (tileable, grayscale in alpha-friendly RGB) for shorelines and wakes. */
export function foamTexture(): THREE.Texture {
  return cached('foam', () => {
    const S = 256;
    const { c, ctx } = canvas(S, S);
    const n = new PeriodicNoise(16, 301);
    const n2 = new PeriodicNoise(32, 302);
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = n.fbm(x / S, y / S, 3) * 0.6 + n2.fbm(x / S, y / S, 2) * 0.4;
        const f = Math.max(0, Math.min(1, (v - 0.42) * 4));
        const i = (y * S + x) * 4;
        const g = Math.round(f * 255);
        img.data[i] = g;
        img.data[i + 1] = g;
        img.data[i + 2] = g;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, { srgb: false });
  });
}

export function disposeProceduralTextures(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
