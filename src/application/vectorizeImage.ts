import type { Raster } from '../domain/raster/raster';
import { hasTransparentBorder } from '../domain/raster/transparency';
import { hexToRgb, type PaletteCandidate } from '../domain/palette/colors';
import { isOpaque, selectRealColors, toPaletteColors } from '../domain/palette/selection';
import { refineSvg } from '../domain/vectorization/refine';
import { stackSvg } from '../domain/vectorization/stack';
import { removeOuterBackground } from '../domain/vectorization/background';
import { tracePixelGrid } from '../domain/vectorization/pixelGrid';
import { countAnchors, countShapes } from '../domain/geometry/svgStats';
import type { ProgressStage, TracingEngine, VectorOptions, VectorResult } from '../domain/types';
import type {
  BackgroundDetector,
  CenterlineTracer,
  Clock,
  ColorQuantizer,
  OutlineTracer,
  RasterPreprocessor,
} from './ports';

/**
 * Vectorize an image: preprocess → choose the palette → trace (one of several
 * strategies) → clean up the geometry. Every outside capability comes in
 * through a port, so this runs the same in the Web Worker (with vecline) and
 * in tests (with fakes).
 */

export type ProgressCallback = (stage: ProgressStage, percent: number) => void;

/** Outline tracing strategies; `pixelGrid` is chosen by the option of that name. */
export type OutlineTracerId = TracingEngine | 'pixelGrid';

export interface VectorizerDeps {
  preprocessor: RasterPreprocessor;
  quantizer: ColorQuantizer;
  background: BackgroundDetector;
  tracers: Record<OutlineTracerId, OutlineTracer>;
  centerline: CenterlineTracer;
  /** For the reported execution time (performance.now in the app). */
  clock: Clock;
}

export interface Vectorizer {
  vectorize(input: Raster, options: VectorOptions, onProgress?: ProgressCallback): VectorResult;
}

/** Colours asked of the quantizer in automatic mode, before the real ones are selected. */
const MAX_AUTO_COLOURS = 32;
const MAX_MANUAL_COLOURS = 64;

/** Exact pixel art keeps its own grid; everything else uses the chosen engine. */
export const selectOutlineTracer = (options: VectorOptions): OutlineTracerId => (options.pixelGrid ? 'pixelGrid' : options.engine);

/** Strategy: exact pixel-grid tracing (pure, see domain/vectorization/pixelGrid). */
export const pixelGridTracer: OutlineTracer = {
  stage: 'progress.boundaries',
  trace: (raster, palette) => tracePixelGrid(raster, palette.map((p) => ({ rgb: p.rgb, hex: p.hex }))),
};

interface CleanUpContext {
  raster: Raster;
  options: VectorOptions;
  background: BackgroundDetector;
}

interface CleanUpStep {
  /** Progress reported when the step runs, if any. */
  stage?: ProgressStage;
  applies(ctx: CleanUpContext): boolean;
  run(svg: string, ctx: CleanUpContext): string;
}

/** Gradients' stops are fitted to the shapes as traced; pixel-grid output is exact and overlaps by design. */
const keepsTracedGeometry = ({ options }: CleanUpContext) => options.gradients || options.pixelGrid;

/** Clean-up after tracing, in order. */
const CLEAN_UP_STEPS: CleanUpStep[] = [
  // Straight edges straight, corners sharp, arcs round
  {
    stage: 'progress.fitting',
    applies: (ctx) => ctx.options.refine && !keepsTracedGeometry(ctx),
    run: (svg) => refineSvg(svg),
  },
  // The background is removed on the vectors, so the subject's outline stays
  // fitted to the real anti-aliased edge. A cut-out has none to remove (its
  // empty pixels read as black, and would take a black subject with them).
  {
    applies: ({ options, raster }) => options.transparentBackground && !hasTransparentBorder(raster),
    run: (svg, { raster, background }) => removeOuterBackground(svg, background.detect(raster), raster.width, raster.height),
  },
  // Containing shapes painted whole, what they contain on top: no hairline cracks
  {
    applies: (ctx) => !keepsTracedGeometry(ctx),
    run: (svg) => stackSvg(svg),
  },
];

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

export function createVectorizer(deps: VectorizerDeps): Vectorizer {
  const { preprocessor, quantizer, background, tracers, centerline, clock } = deps;

  /** Automatic mode keeps the image's real colours; manual mode takes what was asked for. */
  function choosePalette(raster: Raster, options: VectorOptions): PaletteCandidate[] {
    if (!options.autoColors) return quantizer.extract(raster, Math.min(options.colors, MAX_MANUAL_COLOURS)).filter(isOpaque);
    return selectRealColors(quantizer.extract(raster, MAX_AUTO_COLOURS));
  }

  function traceCenterline(raster: Raster, options: VectorOptions, onProgress: ProgressCallback) {
    onProgress('progress.skeleton', 40);
    const traced = centerline.trace(raster, options);
    const stroke = options.centerlineStrokeColor || '#000000';
    return {
      svg: traced.svg,
      shapes: traced.paths,
      colors: 1,
      regions: traced.paths,
      palette: [{ hex: stroke, ...hexToRgb(stroke), a: 255, count: traced.inkPixels, percentage: 100 }],
      isCenterline: true,
      centerlineLength: Math.round(traced.length),
    };
  }

  function traceOutline(raster: Raster, options: VectorOptions, onProgress: ProgressCallback) {
    onProgress('progress.palette', 20);
    const palette = choosePalette(raster, options);

    const tracer = tracers[selectOutlineTracer(options)];
    onProgress(tracer.stage, 50);
    const traced = tracer.trace(raster, palette, options);

    const ctx: CleanUpContext = { raster, options, background };
    let svg = traced.svg;
    for (const step of CLEAN_UP_STEPS.filter((s) => s.applies(ctx))) {
      if (step.stage) onProgress(step.stage, 85);
      svg = step.run(svg, ctx);
    }

    return {
      svg,
      // What the final SVG draws: stacking and background removal change it
      shapes: countShapes(svg),
      colors: palette.length || options.colors,
      regions: traced.regions,
      palette: toPaletteColors(palette, raster.width * raster.height),
      isCenterline: false,
    };
  }

  return {
    vectorize(input, options, onProgress = () => {}) {
      const start = clock();
      const raster = preprocessor.apply(input, { contrast: options.contrast || 0, denoise: options.denoise || 0 });
      const traced = options.traceMethod === 'centerline' ? traceCenterline(raster, options, onProgress) : traceOutline(raster, options, onProgress);
      return {
        ...traced,
        originalSvg: traced.svg,
        nodesCount: countAnchors(traced.svg),
        executionTimeMs: Math.round(clock() - start),
        fileSizeBytes: utf8Bytes(traced.svg),
        rasterSizeBytes: 0,
      };
    },
  };
}
