import * as THREE from 'three';
import { GlobalUniforms } from '../../assets/materials/GlobalUniforms';
import { foamTexture, waterNormalTexture } from '../../assets/textures/ProceduralTextures';
import { Palette } from '../../assets/materials/MaterialLibrary';

export interface WaterOptions {
  level: number;
  /** Custom surface geometry (e.g. a river ribbon with uv in metres: u across, v along the flow). */
  geometry?: THREE.BufferGeometry;
  /** Flow speed (m/s) along the geometry's v axis (rivers). */
  flow?: number;
  /** Discard the surface where the water would be deeper than this (clips rivers at cliffs). */
  maxDepth?: number;
  heightTexture: THREE.Texture;
  /** (minX, minZ, sizeX, sizeZ) of the height texture in world space. */
  heightBounds: THREE.Vector4;
  size?: number;
  center?: THREE.Vector2;
}

/**
 * Stylised tropical water: colour from water depth (sampled from the baked terrain height
 * texture), transparency in the shallows so the seabed, coral and caustics show through,
 * scrolling normal maps for sparkle, fresnel sky tint and animated shoreline foam.
 */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(opts: WaterOptions) {
    const size = opts.size ?? 3200;
    let geo: THREE.BufferGeometry;
    if (opts.geometry) {
      geo = opts.geometry;
    } else {
      geo = new THREE.PlaneGeometry(size, size, 1, 1);
      geo.rotateX(-Math.PI / 2);
      if (opts.center) geo.translate(opts.center.x, 0, opts.center.y);
    }

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHeightTex: { value: null },
        uHeightBounds: { value: new THREE.Vector4() },
        uLevel: { value: 0 },
        uNormalTex: { value: null },
        uFoamTex: { value: null },
        uShallow: { value: new THREE.Color(Palette.waterShallow) },
        uMid: { value: new THREE.Color(Palette.waterMid) },
        uDeep: { value: new THREE.Color(Palette.waterDeep) },
        uSkyTint: { value: new THREE.Color(0xbfe6f5) },
        uFlow: { value: opts.flow ?? 0 },
        uMaxDepth: { value: opts.maxDepth ?? 1e6 },
      },
    ]);
    uniforms.uHeightTex.value = opts.heightTexture;
    uniforms.uHeightBounds.value = opts.heightBounds;
    uniforms.uLevel.value = opts.level;
    uniforms.uNormalTex.value = waterNormalTexture();
    uniforms.uFoamTex.value = foamTexture();
    uniforms.uTime = GlobalUniforms.uTime;
    uniforms.uSunDir = GlobalUniforms.uSunDir;
    uniforms.uSunColor = GlobalUniforms.uSunColor;

    this.material = new THREE.ShaderMaterial({
      name: 'Water',
      uniforms,
      transparent: true,
      depthWrite: true,
      fog: true,
      defines: opts.flow ? { FLOW: '' } : {},
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform float uLevel;
        varying vec3 vWorld;
        varying vec2 vFlowUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y = uLevel;
          vWorld = wp.xyz;
          vFlowUv = uv;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uHeightTex;
        uniform vec4 uHeightBounds;
        uniform float uLevel;
        uniform sampler2D uNormalTex;
        uniform sampler2D uFoamTex;
        uniform vec3 uShallow;
        uniform vec3 uMid;
        uniform vec3 uDeep;
        uniform vec3 uSkyTint;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uFlow;
        uniform float uMaxDepth;
        varying vec3 vWorld;
        varying vec2 vFlowUv;

        float groundHeight(vec2 xz) {
          vec2 uv = (xz - uHeightBounds.xy) / uHeightBounds.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -30.0;
          return texture2D(uHeightTex, uv).r;
        }

        void main() {
          vec2 xz = vWorld.xz;
          float depth = uLevel - groundHeight(xz);
          if (depth > uMaxDepth) discard;

          // Two scrolling normal layers + a fine sparkle layer.
          #ifdef FLOW
            vec2 fuv = vec2(vFlowUv.x, vFlowUv.y - uTime * uFlow);
            vec3 n1 = texture2D(uNormalTex, fuv * vec2(0.09, 0.05)).xyz * 2.0 - 1.0;
            vec3 n2 = texture2D(uNormalTex, fuv * vec2(0.21, 0.13) + 0.37).xyz * 2.0 - 1.0;
            vec3 n3 = texture2D(uNormalTex, vec2(vFlowUv.x, vFlowUv.y - uTime * uFlow * 1.6) * 0.45).xyz * 2.0 - 1.0;
          #else
            vec3 n1 = texture2D(uNormalTex, xz * 0.035 + vec2(uTime * 0.010, uTime * 0.006)).xyz * 2.0 - 1.0;
            vec3 n2 = texture2D(uNormalTex, xz * 0.085 + vec2(-uTime * 0.017, uTime * 0.012)).xyz * 2.0 - 1.0;
            vec3 n3 = texture2D(uNormalTex, xz * 0.31 + vec2(uTime * 0.03, -uTime * 0.025)).xyz * 2.0 - 1.0;
          #endif
          vec2 nxy = n1.xy * 0.55 + n2.xy * 0.35 + n3.xy * 0.18;
          float calm = mix(0.55, 1.0, smoothstep(0.0, 3.0, depth));
          vec3 N = normalize(vec3(nxy.x * 0.42 * calm, 1.0, nxy.y * 0.42 * calm));
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 L = normalize(uSunDir);

          // Depth colouring (bright turquoise shallows -> cyan -> deep blue).
          vec3 col = mix(uShallow, uMid, smoothstep(0.2, 2.4, depth));
          col = mix(col, uDeep, smoothstep(2.4, 9.0, depth));
          // Light dappling in the shallows.
          float dapple = texture2D(uNormalTex, xz * 0.05 - vec2(uTime * 0.004)).b;
          col *= 0.94 + dapple * 0.1;

          // Fresnel: tint towards the sky at grazing angles.
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
          col = mix(col, uSkyTint, fres * 0.55);

          // Sun glints: fine sparkles from the small-scale normals (large-scale normals would clump
          // highlights into cloud-like blobs) + a faint broad sheen, weighted by fresnel so looking
          // down into the shallows keeps the turquoise readable.
          vec3 H = normalize(L + V);
          float nh = max(dot(N, H), 0.0);
          vec3 Ns = normalize(vec3(n3.x * 0.55 + n2.x * 0.2, 1.0, n3.y * 0.55 + n2.y * 0.2));
          float nhs = max(dot(Ns, H), 0.0);
          float fresSpec = 0.15 + 0.85 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
          float spec = pow(nhs, 900.0) * 1.3 + pow(nh, 90.0) * 0.045;
          col += uSunColor * spec * fresSpec;

          // Shoreline foam with soft travelling bands.
          #ifdef FLOW
            float foamTex = texture2D(uFoamTex, vec2(vFlowUv.x * 0.14, (vFlowUv.y - uTime * uFlow) * 0.09)).r;
          #else
            float foamTex = texture2D(uFoamTex, xz * 0.09 + vec2(uTime * 0.02, -uTime * 0.013)).r;
          #endif
          float shore = 1.0 - smoothstep(0.0, 0.55, depth);
          float bands = smoothstep(0.55, 1.0, sin(depth * 9.0 - uTime * 1.6) * 0.5 + 0.5) * (1.0 - smoothstep(0.1, 0.9, depth));
          float foam = clamp(smoothstep(0.35, 0.8, shore * (0.55 + foamTex * 0.9)) + bands * foamTex * 0.75, 0.0, 1.0);
          col = mix(col, vec3(0.97, 1.0, 1.0), foam * 0.85);

          // thin in the shallows so reef colours read (the seabed shader already tints by depth)
          float alpha = mix(0.16, 0.94, smoothstep(0.4, 7.5, depth));
          alpha = max(alpha, foam * 0.9);
          alpha *= smoothstep(-0.02, 0.06, depth);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'Water';
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
  }
}
