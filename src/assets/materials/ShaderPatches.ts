import * as THREE from 'three';
import { GlobalUniforms } from './GlobalUniforms';

/**
 * Composable shader patches applied to built-in three.js materials via onBeforeCompile.
 *
 * - wind:       world-space sway for vegetation (height based) + leaf flutter
 * - cloth:      local ripple for flags and sails (uv.x based)
 * - seeThrough: dithered cut-out of geometry between the camera and the player
 * - caustics:   animated light caustics + absorption tint for surfaces below the water line
 * - rim:        fresnel rim light (characters / important props for readability)
 *
 * All patches share GlobalUniforms so a single per-frame update drives every material.
 */
export interface WindPatch {
  /** Sway amplitude (m) per (local height)^2. */
  sway: number;
  /** Local height below which nothing moves. */
  base?: number;
  /** Scale applied to local height before squaring (normalise tall meshes). */
  heightScale?: number;
  /** High-frequency leaf flutter amplitude (m). */
  flutter?: number;
}

export interface ClothPatch {
  /** Ripple amplitude (local units) at uv.x = 1. */
  amplitude: number;
  /** Ripple spatial frequency. */
  frequency?: number;
  /** Ripple speed. */
  speed?: number;
  /** 0: ripple along local Z (flags), 1: billow along local Z using uv.y too (sails) */
  billow?: number;
}

export interface RimPatch {
  color: THREE.ColorRepresentation;
  strength: number;
  power?: number;
}

export interface PatchOptions {
  /** Keep un-flipped normals on back faces (fluffy foliage) and add sun translucency. */
  foliage?: boolean;
  wind?: WindPatch;
  cloth?: ClothPatch;
  seeThrough?: boolean;
  caustics?: boolean;
  rim?: RimPatch;
}

const COMMON_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
varying vec3 vStyWorldPos;
`;

const COMMON_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uFocusPos;
uniform vec3 uCamPos;
uniform float uSeeThroughRadius;
uniform float uSeeThroughStrength;
uniform float uWaterLevel;
uniform float uCausticStrength;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vStyWorldPos;

float styBayer4(vec2 p) {
  ivec2 ip = ivec2(mod(p, 4.0));
  int idx = ip.x + ip.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}

vec2 styHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distance between the two nearest animated voronoi features: 0 on cell borders.
float styVoronoiEdge(vec2 x, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = styHash2(n + g);
      o = 0.5 + 0.45 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

float styCaustics(vec2 p, float t) {
  float a = styVoronoiEdge(p * 0.62, t * 0.9);
  float b = styVoronoiEdge(p * 0.95 + vec2(7.3, 2.1), -t * 0.75 + 1.3);
  float ca = 1.0 - smoothstep(0.02, 0.2, a);
  float cb = 1.0 - smoothstep(0.02, 0.24, b);
  return ca * 0.65 + cb * 0.45 + ca * cb * 0.6;
}
`;

/** Per-vertex prop-local height for wind sway on batched (world-space) geometry. */
export const WIND_HEIGHT_ATTRIBUTE = 'styWindH';

function windVertex(w: WindPatch): string {
  const base = (w.base ?? 0).toFixed(4);
  const hs = (w.heightScale ?? 1).toFixed(4);
  const sway = w.sway.toFixed(5);
  const flutter = (w.flutter ?? 0).toFixed(5);
  return /* glsl */ `
  {
    vec3 styOrigin = (modelMatrix * styInst * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #ifdef USE_INSTANCING
      float styLocalY = position.y;
    #else
      // batched static geometry lives in world space: the batcher bakes the prop-local height
      float styLocalY = styWindH;
    #endif
    float styH = max(styLocalY - ${base}, 0.0) * ${hs};
    float styPhase = uTime * 1.25 + styOrigin.x * 0.23 + styOrigin.z * 0.19;
    float styGust = 0.75 + 0.25 * sin(uTime * 0.35 + styOrigin.x * 0.02);
    float stySway = (sin(styPhase) * 0.65 + sin(styPhase * 2.27 + 1.7) * 0.35) * ${sway} * uWindStrength * styGust * styH * styH;
    float styFl = sin(uTime * 5.3 + styWorld.x * 1.9 + styWorld.z * 1.4 + styLocalY * 2.7) * ${flutter} * uWindStrength * min(styH, 2.0);
    styWorld.x += stySway * uWindDir.x + styFl * 0.6;
    styWorld.z += stySway * uWindDir.y + styFl * 0.4;
    styWorld.y += styFl * 0.5 - abs(stySway) * 0.08;
  }`;
}

function clothVertex(c: ClothPatch): string {
  const amp = c.amplitude.toFixed(4);
  const freq = (c.frequency ?? 7).toFixed(3);
  const speed = (c.speed ?? 6).toFixed(3);
  const billow = (c.billow ?? 0).toFixed(3);
  return /* glsl */ `
  {
    #ifdef USE_UV
      vec2 styUv = uv;
    #else
      vec2 styUv = vec2(0.5);
    #endif
    float styW = sin(styUv.x * ${freq} - uTime * ${speed} + position.y * 0.6) * 0.6
               + sin(styUv.x * ${freq} * 1.9 - uTime * ${speed} * 1.4) * 0.4;
    float styB = sin(styUv.y * 3.14159) * sin(styUv.x * 3.14159) * ${billow};
    transformed.z += (styW * styUv.x + styB * (0.8 + 0.2 * sin(uTime * 1.3))) * ${amp} * uWindStrength;
  }`;
}

function buildCacheKey(opts: PatchOptions): string {
  return 'sty' + JSON.stringify(opts);
}

/**
 * Applies the requested patches to a built-in material (Lambert / Standard / Phong / Basic).
 * Safe to call once per material; calling again replaces the previous patch.
 */
export function applyStylePatches<T extends THREE.Material>(material: T, opts: PatchOptions): T {
  const rimColor = opts.rim ? new THREE.Color(opts.rim.color) : null;

  material.onBeforeCompile = (shader) => {
    const u = shader.uniforms;
    u.uTime = GlobalUniforms.uTime;
    u.uWindStrength = GlobalUniforms.uWindStrength;
    u.uWindDir = GlobalUniforms.uWindDir;
    u.uFocusPos = GlobalUniforms.uFocusPos;
    u.uCamPos = GlobalUniforms.uCamPos;
    u.uSeeThroughRadius = GlobalUniforms.uSeeThroughRadius;
    u.uSeeThroughStrength = GlobalUniforms.uSeeThroughStrength;
    u.uWaterLevel = GlobalUniforms.uWaterLevel;
    u.uCausticStrength = GlobalUniforms.uCausticStrength;
    u.uSunColor = GlobalUniforms.uSunColor;
    u.uSunDir = GlobalUniforms.uSunDir;
    if (rimColor) u.uRimColor = { value: rimColor };

    // ---------------- vertex ----------------
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_VERTEX}${opts.wind ? `\nattribute float ${WIND_HEIGHT_ATTRIBUTE};` : ''}`);
    if (opts.cloth) {
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${clothVertex(opts.cloth)}`);
    }
    vs = vs.replace(
      '#include <project_vertex>',
      /* glsl */ `
      #ifdef USE_INSTANCING
        mat4 styInst = instanceMatrix;
      #else
        mat4 styInst = mat4(1.0);
      #endif
      vec4 styWorld = modelMatrix * styInst * vec4(transformed, 1.0);
      ${opts.wind ? windVertex(opts.wind) : ''}
      vStyWorldPos = styWorld.xyz;
      vec4 mvPosition = viewMatrix * styWorld;
      gl_Position = projectionMatrix * mvPosition;
      `,
    );
    shader.vertexShader = vs;

    // ---------------- fragment ----------------
    let fs = shader.fragmentShader;
    const fragDefines: string[] = [];
    if (opts.seeThrough) fragDefines.push('#define STY_SEETHROUGH');
    if (opts.caustics) fragDefines.push('#define STY_CAUSTICS');
    if (opts.rim) {
      fragDefines.push('#define STY_RIM');
      fragDefines.push(`#define STY_RIM_STRENGTH ${opts.rim.strength.toFixed(4)}`);
      fragDefines.push(`#define STY_RIM_POWER ${(opts.rim.power ?? 2.5).toFixed(4)}`);
    }
    fs = fs.replace(
      '#include <common>',
      `${fragDefines.join('\n')}\n#include <common>\n${COMMON_FRAGMENT}\n${opts.rim ? 'uniform vec3 uRimColor;' : ''}`,
    );

    if (opts.seeThrough) {
      fs = fs.replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
        {
          vec3 styToFocus = uFocusPos - uCamPos;
          float styFocusDist = length(styToFocus);
          vec3 styDir = styToFocus / max(styFocusDist, 0.001);
          vec3 styToFrag = vStyWorldPos - uCamPos;
          float styAlong = dot(styToFrag, styDir);
          float styFade = 0.0;
          if (styAlong < styFocusDist - 0.9 && styAlong > 0.0) {
            // cylinder between the camera and the player: thin it out, keep a hint of silhouette
            float styPerp = length(styToFrag - styDir * styAlong);
            float styR = uSeeThroughRadius;
            styFade = (1.0 - smoothstep(styR * 0.45, styR, styPerp)) * 0.88;
          }
          // anything right in front of the lens is only a blurry wall: fade it out completely
          styFade = max(styFade, 1.0 - smoothstep(3.0, 7.5, length(styToFrag)));
          if (styFade * uSeeThroughStrength > styBayer4(gl_FragCoord.xy)) discard;
        }`,
      );
    }

    if (opts.foliage) {
      // Undo three's back-face normal flip so leaf cards keep their (spherical) normals.
      fs = fs.replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        #if defined( DOUBLE_SIDED ) && !defined( FLAT_SHADED )
          normal *= faceDirection;
        #endif`,
      );
    }

    // Lighting post-modifications happen right before the final output assembly.
    const outgoingMods: string[] = [];
    if (opts.foliage) {
      outgoingMods.push(/* glsl */ `
        {
          vec3 styView = normalize(vStyWorldPos - uCamPos);
          float styTl = pow(max(dot(styView, uSunDir), 0.0), 3.0);
          outgoingLight += diffuseColor.rgb * uSunColor * styTl * 0.45;
        }`);
    }
    if (opts.rim) {
      outgoingMods.push(/* glsl */ `
        {
          vec3 styV = normalize(vViewPosition);
          float styRim = pow(1.0 - clamp(dot(normal, styV), 0.0, 1.0), STY_RIM_POWER);
          outgoingLight += uRimColor * styRim * STY_RIM_STRENGTH;
        }`);
    }
    if (opts.caustics) {
      outgoingMods.push(/* glsl */ `
        {
          float styDepth = uWaterLevel - vStyWorldPos.y;
          if (styDepth > 0.0) {
            float styD01 = 1.0 - exp(-styDepth * 0.3);
            vec3 styAbsorb = mix(vec3(0.9, 1.0, 0.98), vec3(0.16, 0.55, 0.66), styD01);
            outgoingLight *= styAbsorb;
            float styC = styCaustics(vStyWorldPos.xz, uTime * 1.1);
            float styAtten = exp(-styDepth * 0.35) * smoothstep(0.0, 0.3, styDepth);
            outgoingLight += uSunColor * vec3(0.55, 0.95, 0.9) * styC * styAtten * uCausticStrength * 0.28;
          }
        }`);
    }
    if (outgoingMods.length > 0) {
      fs = fs.replace('#include <opaque_fragment>', `${outgoingMods.join('\n')}\n#include <opaque_fragment>`);
    }
    shader.fragmentShader = fs;
  };

  // lets the static batcher know it must bake prop-local heights for the wind sway
  material.userData.windSway = !!opts.wind;
  const key = buildCacheKey(opts);
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}
