import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { QUALITY_PRESETS, type QualityLevel, type QualitySettings } from './Quality';
import { setTextureAnisotropy } from '../assets/textures/ProceduralTextures';

/**
 * Final colour grading in display space: saturation/contrast, warm highlights, teal shadows and a
 * soft vignette. This is where most of the "illustrated" colour signature comes from.
 */
const GradingShader = {
  name: 'GradingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.06 },
    uShadowTint: { value: new THREE.Color(0.86, 0.97, 1.06) },
    uHighlightTint: { value: new THREE.Color(1.05, 1.0, 0.92) },
    uVignette: { value: 0.32 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
    uDesaturate: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uVignette;
    uniform float uFade;
    uniform vec3 uFadeColor;
    uniform float uDesaturate;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation * (1.0 - uDesaturate));
      c = (c - 0.5) * uContrast + 0.5;
      vec3 tint = mix(uShadowTint, uHighlightTint, smoothstep(0.15, 0.85, l));
      c *= tint;
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette * 2.2;
      c *= clamp(vig, 0.0, 1.0);
      c = mix(c, uFadeColor, uFade);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/**
 * Owns the WebGL renderer and the post-processing chain. Quality can be switched at runtime.
 */
export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly grading: ShaderPass;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private renderPass: RenderPass | null = null;
  private outputPass: OutputPass | null = null;
  quality: QualitySettings;
  private width = 1;
  private height = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    level: QualityLevel,
  ) {
    this.quality = QUALITY_PRESETS[level];
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.quality.postProcessing,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x9fd4e8, 1);
    r.domElement.id = 'game-canvas';
    // accumulate stats over all passes of a frame (reset manually in render())
    r.info.autoReset = false;
    container.appendChild(r.domElement);
    setTextureAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.grading = new ShaderPass(GradingShader);
    this.applyQuality(this.quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get gradingUniforms(): (typeof GradingShader)['uniforms'] {
    return this.grading.uniforms as unknown as (typeof GradingShader)['uniforms'];
  }

  setQuality(level: QualityLevel): void {
    this.quality = QUALITY_PRESETS[level];
    this.applyQuality(this.quality);
    this.resize();
    try {
      localStorage.setItem('ember.quality', level);
    } catch {
      /* ignore */
    }
  }

  private applyQuality(q: QualitySettings): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (q.postProcessing) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
        type: THREE.HalfFloatType,
        samples: q.msaaSamples,
      });
      const composer = new EffectComposer(this.renderer, target);
      this.renderPass = new RenderPass(this.scene, this.camera);
      composer.addPass(this.renderPass);
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.5, 0.94);
        composer.addPass(this.bloom);
      }
      this.outputPass = new OutputPass();
      composer.addPass(this.outputPass);
      composer.addPass(this.grading);
      this.composer = composer;
    }
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  render(): void {
    this.renderer.info.reset();
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Compiles all materials up-front to avoid hitches the first time things appear on screen. */
  precompile(): void {
    this.renderer.compile(this.scene, this.camera);
  }
}
