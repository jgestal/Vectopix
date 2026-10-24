import type { VectorOptions, VectorPreset } from '../types/vector';

export const DEFAULT_OPTIONS: VectorOptions = {
  engine: 'vecline',
  traceMethod: 'outline',
  preset: 'logo',
  colors: 12,
  subpixel: true,
  tolerance: 0.75,
  fitError: 0.75,
  cornerAngle: 75,
  minArea: 8,
  refineIterations: 6,
  smooth: 1,
  background: true,
  primitives: false,
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
    colors: 8,
    subpixel: true,
    tolerance: 0.75,
    fitError: 0.75,
    cornerAngle: 75,
    minArea: 8,
    smooth: 1,
    refineIterations: 6,
    background: true,
    primitives: false,
    gradients: false,
  },
  'flat-art': {
    colors: 16,
    subpixel: true,
    tolerance: 0.85,
    fitError: 0.85,
    cornerAngle: 80,
    minArea: 6,
    smooth: 1,
    refineIterations: 6,
    background: true,
    primitives: false,
    gradients: false,
  },
  photo: {
    colors: 32,
    subpixel: true,
    tolerance: 0.6,
    fitError: 0.5,
    cornerAngle: 90,
    minArea: 2,
    background: true,
    primitives: false,
    gradients: true,
  },
  sketch: {
    colors: 2,
    subpixel: true,
    tolerance: 0.3,
    fitError: 0.3,
    cornerAngle: 70,
    minArea: 6,
    background: false,
    primitives: false,
    gradients: false,
  },
  'pixel-art': {
    colors: 16,
    subpixel: false,
    tolerance: 0.05,
    fitError: 0.05,
    cornerAngle: 90,
    minArea: 0,
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
