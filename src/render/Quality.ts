export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  maxPixelRatio: number;
  shadowMapSize: number;
  shadowRadius: number;
  /** Half-size of the shadow camera frustum around the player (m). */
  shadowExtent: number;
  postProcessing: boolean;
  bloom: boolean;
  msaaSamples: number;
  caustics: boolean;
  /** Multiplier for scatter density of small vegetation. */
  vegetationDensity: number;
  terrainCellSize: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    level: 'low',
    maxPixelRatio: 1,
    shadowMapSize: 1024,
    shadowRadius: 2,
    shadowExtent: 26,
    postProcessing: false,
    bloom: false,
    msaaSamples: 0,
    caustics: false,
    vegetationDensity: 0.5,
    terrainCellSize: 2,
  },
  medium: {
    level: 'medium',
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    shadowRadius: 3,
    shadowExtent: 30,
    postProcessing: true,
    bloom: true,
    msaaSamples: 4,
    caustics: true,
    vegetationDensity: 0.8,
    terrainCellSize: 1.5,
  },
  high: {
    level: 'high',
    maxPixelRatio: 2,
    shadowMapSize: 4096,
    shadowRadius: 3,
    shadowExtent: 36,
    postProcessing: true,
    bloom: true,
    msaaSamples: 4,
    caustics: true,
    vegetationDensity: 1,
    terrainCellSize: 1.25,
  },
};

/** Heuristic default: phones/tablets get "low"/"medium", desktops "high". */
export function detectDefaultQuality(): QualityLevel {
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;
  try {
    const saved = localStorage.getItem('ember.quality');
    if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    /* storage unavailable */
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse && small) return 'low';
  if (coarse || cores <= 4) return 'medium';
  return 'high';
}
