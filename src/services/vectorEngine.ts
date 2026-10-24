import {
  trace,
  traceGeometry,
  centerlineTrace,
  centerlinePolylines,
  toDxf,
  toEps,
  toPdf,
  countPathNodes,
  extractPalette,
  compareImages,
  TRACE_DEFAULTS,
} from 'vecline/core';
import ImageTracer from 'imagetracerjs';
import { preprocessRaster, type Raster } from '../utils/imageProcessing';
import { centerlineToDxf, centerlineToEps, centerlineToPdf } from '../utils/centerlineExport';
import type { ExportFormat, PaletteColor, VectorOptions, VectorResult } from '../types/vector';

/**
 * Pure vectorization engine. It has no knowledge of workers or the DOM, so it
 * runs the same inside the Web Worker and under Vitest.
 */

export type ProgressCallback = (stage: string, percent: number) => void;

/** The preprocessed raster and options of a trace, kept to build exports on demand. */
export interface TraceContext {
  raster: Raster;
  options: VectorOptions;
}

function countNodes(svg: string): number {
  try {
    return countPathNodes(svg);
  } catch {
    return (svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function veclineTraceOptions(options: VectorOptions) {
  return {
    ...TRACE_DEFAULTS,
    colors: options.colors,
    subpixel: options.subpixel,
    tolerance: options.tolerance,
    fitError: options.fitError,
    cornerAngle: options.cornerAngle,
    minArea: options.minArea,
    refineIterations: options.refineIterations,
    smooth: options.smooth ?? 1,
    background: options.background,
    primitives: options.primitives,
    gradients: options.gradients,
  };
}

function centerlineOptions(options: VectorOptions) {
  return {
    stroke: options.centerlineStrokeColor || '#000000',
    strokeWidth: options.centerlineStrokeWidth || 2,
    adaptive: options.centerlineAdaptive,
    blackOnWhite: options.centerlineBlackOnWhite,
  };
}

function extractPaletteColors(raster: Raster, colors: number): PaletteColor[] {
  const pixels = raster.width * raster.height;
  return (extractPalette(raster, Math.min(colors, 64)) || []).map((p) => ({
    hex: p.hex,
    r: p.rgb.r,
    g: p.rgb.g,
    b: p.rgb.b,
    a: p.rgb.a,
    count: Math.round(p.weight * pixels),
    percentage: Math.round(p.weight * 100),
  }));
}

/**
 * Trace a raster into SVG. Heavy exports (DXF/EPS/PDF) are not built here:
 * call {@link exportTrace} with the returned context when the user asks for one.
 */
export function vectorizeRaster(
  input: Raster,
  options: VectorOptions,
  onProgress: ProgressCallback = () => {}
): { result: VectorResult; context: TraceContext } {
  const startTime = performance.now();
  const raster = preprocessRaster(input, options.contrast || 0, options.denoise || 0);
  const context: TraceContext = { raster, options };

  const finish = (partial: Omit<VectorResult, 'originalSvg' | 'executionTimeMs' | 'fileSizeBytes' | 'nodesCount' | 'rasterSizeBytes'>) => ({
    result: {
      ...partial,
      originalSvg: partial.svg,
      nodesCount: countNodes(partial.svg),
      executionTimeMs: Math.round(performance.now() - startTime),
      fileSizeBytes: new Blob([partial.svg]).size,
      rasterSizeBytes: 0,
    },
    context,
  });

  if (options.traceMethod === 'centerline') {
    onProgress('Extrayendo esqueleto morfológico y líneas de centro...', 40);
    const cl = centerlineTrace(raster, centerlineOptions(options));
    const stroke = options.centerlineStrokeColor || '#000000';
    return finish({
      svg: cl.svg,
      shapes: cl.paths,
      colors: 1,
      regions: cl.paths,
      palette: [{ hex: stroke, ...hexToRgb(stroke), a: 255, count: cl.inkPixels, percentage: 100 }],
      isCenterline: true,
      centerlineLength: Math.round(cl.length),
    });
  }

  onProgress('Analizando imagen y cuantizando colores (espacio Oklab)...', 20);
  const palette = extractPaletteColors(raster, options.colors);

  if (options.engine === 'imagetracer') {
    onProgress('Trazando caminos con ImageTracerJS...', 55);
    const svg = ImageTracer.imagedataToSVG(raster as unknown as ImageData, {
      numberofcolors: options.colors,
      scale: 1,
      blurradius: options.blurRadius ?? 0,
      blurdelta: 20,
      pathomit: options.minArea,
      linefilter: true,
      corsenabled: false,
    });
    const shapes = (svg.match(/<path/g) || []).length;
    return finish({ svg, shapes, colors: options.colors, regions: shapes, palette, isCenterline: false });
  }

  onProgress('Extrayendo fronteras topológicas y curvas sub-pixel...', 50);
  const traced = trace(raster, veclineTraceOptions(options));
  onProgress('Ajustando splines de Bézier y calculando métricas...', 90);
  return finish({
    svg: traced.svg,
    shapes: traced.shapes,
    colors: traced.colors,
    regions: traced.regions,
    palette,
    isCenterline: false,
  });
}

/**
 * Build a CAD / print export from a previous trace
 */
export function exportTrace(context: TraceContext, format: ExportFormat): string | Uint8Array {
  const { raster, options } = context;

  if (options.traceMethod === 'centerline') {
    const polylines = centerlinePolylines(raster, centerlineOptions(options));
    const strokeWidth = options.centerlineStrokeWidth || 2;
    const stroke = options.centerlineStrokeColor || '#000000';
    if (format === 'dxf') return centerlineToDxf(polylines, raster.height);
    if (format === 'eps') return centerlineToEps(polylines, raster.width, raster.height, strokeWidth, stroke);
    return centerlineToPdf(polylines, raster.width, raster.height, strokeWidth, stroke);
  }

  if (options.engine === 'imagetracer') {
    throw new Error('DXF, EPS y PDF solo están disponibles con el motor Vecline');
  }

  const geometry = traceGeometry(raster, veclineTraceOptions(options));
  if (format === 'dxf') return toDxf(geometry);
  if (format === 'eps') return toEps(geometry);
  return toPdf(geometry);
}

/**
 * Structural similarity between the source raster and the rendered SVG (0–1)
 */
export function measureSsim(reference: Raster, candidate: Raster): number {
  return compareImages(reference, candidate, { skipDeltaE: true }).ssim;
}
