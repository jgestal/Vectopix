import { applyPreset } from './presets';
import type { VectorOptions, VectorPreset } from './types';

/** Larger images are downscaled before tracing to keep the engine responsive. */
export const MAX_TRACE_PIXELS = 4_000_000;
/** Below this longest side (px), thin features are a few pixels and trace poorly. */
export const SMALL_IMAGE_SIDE = 100;

/** The size to trace an image at: its own, or scaled down to at most MAX_TRACE_PIXELS. */
export function traceSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, Math.sqrt(MAX_TRACE_PIXELS / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const isSmallImage = (width: number, height: number) => Math.max(width, height) < SMALL_IMAGE_SIDE;

/**
 * The settings a newly loaded image starts with. A sample brings its own
 * preset (on top of the current settings); the user's images start with the
 * settings they last chose. A cut-out stays a cut-out: the setting shows
 * what the result will be.
 */
export function optionsForNewImage(input: {
  current: VectorOptions;
  userOptions: VectorOptions;
  samplePreset?: VectorPreset;
  isCutOut: boolean;
}): VectorOptions {
  const base = input.samplePreset ? applyPreset(input.samplePreset, input.current) : input.userOptions;
  return input.isCutOut ? { ...base, transparentBackground: true } : base;
}
