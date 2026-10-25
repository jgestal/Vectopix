import { trace, centerlineTrace, extractPalette, compareImages, detectBackgroundColor, TRACE_DEFAULTS } from 'vecline/core';
import type {
  BackgroundDetector,
  CenterlineTracer,
  ColorQuantizer,
  OutlineTracer,
  RasterPreprocessor,
  SimilarityMetric,
} from '../../application/ports';
import type { PaletteCandidate } from '../../domain/palette/colors';
import type { VectorOptions } from '../../domain/types';
import { snapToCanvasEdge } from '../../domain/vectorization/background';
import { preprocessRaster } from './imageProcessing';

/** The vecline library behind the vectorization ports. */

export const veclineQuantizer: ColorQuantizer = {
  extract: (raster, maxColors) => extractPalette(raster, maxColors) || [],
};

export const veclineBackground: BackgroundDetector = {
  detect: (raster) => detectBackgroundColor(raster),
};

export const veclinePreprocessor: RasterPreprocessor = {
  apply: (raster, { contrast, denoise }) => preprocessRaster(raster, contrast, denoise),
};

export const veclineSimilarity: SimilarityMetric = {
  ssim: (reference, candidate) => compareImages(reference, candidate, { skipDeltaE: true }).ssim,
};

/**
 * vecline settings per smoothing level (off / standard / maximum). `smooth`
 * diffuses interiors in proportion to the image's own measured noise (in
 * [0, 1], so it cannot go further than standard); maximum also merges
 * regions closer than `segment` in Oklab before quantising: fewer, calmer
 * regions on photos (Owl: 22.6k → 18.2k nodes).
 */
const SMOOTHING = [
  { smooth: 0, segment: 0 },
  { smooth: 1, segment: 0 },
  { smooth: 1, segment: 0.06 },
];

export function veclineTraceOptions(options: VectorOptions, palette: PaletteCandidate[]) {
  return {
    ...TRACE_DEFAULTS,
    colors: palette.length || options.colors,
    // In automatic mode the detected colours are imposed as-is
    ...(options.autoColors && palette.length ? { fixedPalette: palette.map((p) => p.rgb) } : {}),
    subpixel: options.subpixel,
    tolerance: options.tolerance,
    fitError: options.fitError,
    cornerAngle: options.cornerAngle,
    minArea: options.minArea,
    refineIterations: options.refineIterations,
    ...SMOOTHING[options.smooth ?? 0],
    // vecline's `background` paints the dominant colour as one backing
    // rectangle. For a transparent result the background is traced as a
    // region like any other, to be removed afterwards.
    background: !options.transparentBackground,
    primitives: options.primitives,
    gradients: options.gradients,
    // Fit every boundary between two regions once, for both: neighbouring
    // shapes then share their edge exactly instead of tearing apart
    mosaic: true,
    // Merge neighbouring curves that one curve can describe
    optimizeError: 1.5,
  };
}

/** Strategy: vecline's sub-pixel mosaic tracer. */
export const veclineOutlineTracer: OutlineTracer = {
  stage: 'progress.boundaries',
  trace(raster, palette, options) {
    const traced = trace(raster, veclineTraceOptions(options, palette));
    // vecline stops regions half a pixel short of the canvas edge
    return { svg: snapToCanvasEdge(traced.svg, raster.width, raster.height), shapes: traced.shapes, regions: traced.regions };
  },
};

export const veclineCenterlineTracer: CenterlineTracer = {
  trace: (raster, options) =>
    centerlineTrace(raster, {
      stroke: options.centerlineStrokeColor || '#000000',
      strokeWidth: options.centerlineStrokeWidth || 2,
      adaptive: options.centerlineAdaptive,
      blackOnWhite: options.centerlineBlackOnWhite,
    }),
};
