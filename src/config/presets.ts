import type { VectorOptions, VectorPreset } from '../types/vector';

export const DEFAULT_OPTIONS: VectorOptions = {
  engine: 'vecline',
  traceMethod: 'outline',
  preset: 'logo',
  colors: 12,
  autoColors: true,
  refine: true,
  subpixel: true,
  tolerance: 0.75,
  fitError: 0.75,
  cornerAngle: 45,
  minArea: 8,
  refineIterations: 6,
  smooth: 0,
  background: true,
  primitives: true,
  gradients: false,
  contrast: 0,
  denoise: 0,
  centerlineStrokeWidth: 2,
  centerlineStrokeColor: '#000000',
  centerlineAdaptive: false,
  centerlineBlackOnWhite: true,
};

const OUTLINE_PRESETS: Partial<Record<VectorPreset, Partial<VectorOptions>>> = {
  logo: {
    autoColors: true,
    refine: true,
    subpixel: true,
    tolerance: 0.75,
    fitError: 0.75,
    cornerAngle: 45,
    minArea: 8,
    smooth: 0,
    refineIterations: 6,
    background: true,
    primitives: true,
    gradients: false,
  },
  'flat-art': {
    autoColors: true,
    refine: true,
    subpixel: true,
    tolerance: 0.85,
    fitError: 0.85,
    cornerAngle: 45,
    minArea: 6,
    smooth: 0,
    refineIterations: 6,
    background: true,
    primitives: true,
    gradients: false,
  },
  photo: {
    autoColors: false,
    refine: false,
    colors: 32,
    subpixel: true,
    tolerance: 0.6,
    fitError: 0.5,
    cornerAngle: 90,
    minArea: 2,
    smooth: 1,
    background: true,
    primitives: false,
    gradients: true,
  },
  sketch: {
    autoColors: true,
    refine: true,
    subpixel: true,
    tolerance: 0.75,
    fitError: 0.75,
    cornerAngle: 45,
    minArea: 6,
    smooth: 0,
    background: false,
    primitives: false,
    gradients: false,
  },
  'pixel-art': {
    autoColors: true,
    refine: false,
    subpixel: false,
    tolerance: 0.05,
    fitError: 0.05,
    cornerAngle: 90,
    minArea: 0,
    smooth: 0,
    background: true,
    primitives: false,
    gradients: false,
  },
};

/**
 * Options a preset applies on top of the current ones. `sketch` keeps the
 * current trace method, so it works for both outline and centerline.
 */
export function getPresetOptions(preset: VectorPreset, current: VectorOptions): Partial<VectorOptions> {
  if (preset === 'centerline-sketch') {
    return {
      traceMethod: 'centerline',
      centerlineStrokeWidth: 2,
      centerlineStrokeColor: '#000000',
      centerlineAdaptive: true,
      centerlineBlackOnWhite: true,
    };
  }

  if (preset === 'sketch' && current.traceMethod === 'centerline') {
    return {
      traceMethod: 'centerline',
      centerlineStrokeWidth: 1.5,
      centerlineStrokeColor: '#000000',
      centerlineAdaptive: false,
      centerlineBlackOnWhite: true,
    };
  }

  const outline = OUTLINE_PRESETS[preset];
  return outline ? { traceMethod: 'outline', ...outline } : {};
}

export function applyPreset(preset: VectorPreset, current: VectorOptions): VectorOptions {
  return { ...current, ...getPresetOptions(preset, current), preset };
}
