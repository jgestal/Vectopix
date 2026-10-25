import { trace, centerlineTrace, extractPalette, compareImages, detectBackgroundColor, TRACE_DEFAULTS } from 'vecline/core';
import ImageTracer from 'imagetracerjs';
import { preprocessRaster, type Raster } from '../utils/imageProcessing';
import { hasTransparentBorder } from '../utils/transparency';
import { refineSvg } from './svgRefine';
import { stackSvg } from './svgStack';
import { removeOuterBackground, snapToCanvasEdge } from './svgBackground';
import { tracePixelGrid } from './pixelTrace';
import { countAnchors, countShapes } from '../utils/pathParser';
import type { PaletteColor, ProgressStage, VectorOptions, VectorResult } from '../types/vector';

/**
 * Pure vectorization engine. It has no knowledge of workers or the DOM, so it
 * runs the same inside the Web Worker and under Vitest.
 *
 * Outline pipeline: detect the image's real colours → trace with vecline
 * (shared region boundaries, sub-pixel edges, true circles) → refit the
 * geometry so straight edges are straight and corners sharp (svgRefine).
 */

export type ProgressCallback = (stage: ProgressStage, percent: number) => void;

/**
 * A colour must cover at least this share of the image to count as one of its
 * real colours. Anti-aliasing blends between two colours stay far below it
 * (≤ 0.4 % on the samples) while the smallest real colour covers ≥ 1 %.
 */
const REAL_COLOUR_MIN_SHARE = 0.004;
const MAX_AUTO_COLOURS = 32;
/**
 * Colours closer than this in Oklab (about two just-noticeable differences)
 * are one colour. JPEG splits each flat colour into near-identical variants
 * (≤ 0.032 apart on the samples); distinct design colours sit ≥ 0.057 apart.
 */
const SAME_COLOUR_OKLAB = 0.04;
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

function toOklab({ r, g, b }: { r: number; g: number; b: number }): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
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

type VeclinePaletteEntry = ReturnType<typeof extractPalette>[number];

/**
 * The palette to trace with. Automatic mode keeps only the colours that cover
 * a real share of the image, so anti-aliasing fringe never takes a slot (and
 * two similar real colours are never merged to make room for it).
 */
function choosePalette(raster: Raster, options: VectorOptions): VeclinePaletteEntry[] {
  if (!options.autoColors) return (extractPalette(raster, Math.min(options.colors, 64)) || []).filter((p) => p.rgb.a >= 128);
  // Fully transparent pixels (a PNG's empty background) are not a colour to trace
  const all = (extractPalette(raster, MAX_AUTO_COLOURS) || []).filter((p) => p.rgb.a >= 128).sort((a, b) => b.weight - a.weight);
  // Fold indistinguishable variants into the dominant one first: their
  // shares add up, and a JPEG's flat colour counts as one again
  const merged: VeclinePaletteEntry[] = [];
  for (const candidate of all) {
    const lab = toOklab(candidate.rgb);
    const same = merged.find((m) => {
      const o = toOklab(m.rgb);
      return Math.hypot(o[0] - lab[0], o[1] - lab[1], o[2] - lab[2]) < SAME_COLOUR_OKLAB;
    });
    if (same) same.weight += candidate.weight;
    else merged.push({ ...candidate });
  }
  const real: VeclinePaletteEntry[] = [];
  for (const candidate of merged) {
    if (candidate.weight < REAL_COLOUR_MIN_SHARE) continue;
    if (!isBlendOf(candidate, real)) real.push(candidate);
  }
  return real.length >= 2 ? real : all.slice(0, 2);
}

/**
 * Anti-aliasing fringe: a colour lying between two larger colours (a mix of
 * them) that covers clearly less than either. On small images the fringe can
 * cover several percent, so its share alone does not give it away.
 */
function isBlendOf(c: VeclinePaletteEntry, larger: VeclinePaletteEntry[]): boolean {
  const v = (p: VeclinePaletteEntry) => [p.rgb.r, p.rgb.g, p.rgb.b];
  const [cr, cg, cb] = v(c);
  for (let i = 0; i < larger.length; i++) {
    for (let j = i + 1; j < larger.length; j++) {
      const a = larger[i];
      const b = larger[j];
      if (c.weight > 0.5 * Math.min(a.weight, b.weight)) continue;
      const [ar, ag, ab] = v(a);
      const [br, bg, bb] = v(b);
      const d = [br - ar, bg - ag, bb - ab];
      const span = Math.hypot(d[0], d[1], d[2]);
      if (span < 40) continue;
      const t = ((cr - ar) * d[0] + (cg - ag) * d[1] + (cb - ab) * d[2]) / (span * span);
      if (t <= 0.05 || t >= 0.95) continue;
      const off = Math.hypot(ar + d[0] * t - cr, ag + d[1] * t - cg, ab + d[2] * t - cb);
      if (off <= 0.08 * span) return true;
    }
  }
  return false;
}

function toPaletteColors(palette: VeclinePaletteEntry[], pixels: number): PaletteColor[] {
  return palette.map((p) => ({
    hex: p.hex,
    r: p.rgb.r,
    g: p.rgb.g,
    b: p.rgb.b,
    a: p.rgb.a,
    count: Math.round(p.weight * pixels),
    percentage: Math.round(p.weight * 100),
  }));
}

function veclineTraceOptions(options: VectorOptions, palette: VeclinePaletteEntry[]) {
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

function centerlineOptions(options: VectorOptions) {
  return {
    stroke: options.centerlineStrokeColor || '#000000',
    strokeWidth: options.centerlineStrokeWidth || 2,
    adaptive: options.centerlineAdaptive,
    blackOnWhite: options.centerlineBlackOnWhite,
  };
}

/** Trace a raster into SVG. CAD/print exports are built from this SVG later. */
export function vectorizeRaster(
  input: Raster,
  options: VectorOptions,
  onProgress: ProgressCallback = () => {}
): VectorResult {
  const startTime = performance.now();
  const raster = preprocessRaster(input, options.contrast || 0, options.denoise || 0);

  const finish = (
    partial: Omit<VectorResult, 'originalSvg' | 'executionTimeMs' | 'fileSizeBytes' | 'nodesCount' | 'rasterSizeBytes'>
  ): VectorResult => ({
    ...partial,
    // Count what the final SVG draws: stacking and background removal change it
    shapes: partial.isCenterline ? partial.shapes : countShapes(partial.svg),
    originalSvg: partial.svg,
    nodesCount: countAnchors(partial.svg),
    executionTimeMs: Math.round(performance.now() - startTime),
    fileSizeBytes: new Blob([partial.svg]).size,
    rasterSizeBytes: 0,
  });

  if (options.traceMethod === 'centerline') {
    onProgress('progress.skeleton', 40);
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

  onProgress('progress.palette', 20);
  const palette = choosePalette(raster, options);
  const paletteColors = toPaletteColors(palette, raster.width * raster.height);
  const colorCount = palette.length || options.colors;

  let svg: string;
  let shapes: number;
  let regions: number;
  if (options.pixelGrid) {
    onProgress('progress.boundaries', 50);
    ({ svg, shapes, regions } = tracePixelGrid(raster, palette.map((p) => ({ rgb: p.rgb, hex: p.hex }))));
  } else if (options.engine === 'imagetracer') {
    onProgress('progress.imagetracer', 55);
    svg = ImageTracer.imagedataToSVG(raster as unknown as ImageData, {
      numberofcolors: colorCount,
      scale: 1,
      blurradius: options.blurRadius ?? 0,
      blurdelta: 20,
      pathomit: options.minArea,
      linefilter: true,
      corsenabled: false,
    });
    shapes = regions = (svg.match(/<path/g) || []).length;
  } else {
    onProgress('progress.boundaries', 50);
    const traced = trace(raster, veclineTraceOptions(options, palette));
    svg = snapToCanvasEdge(traced.svg, raster.width, raster.height);
    shapes = traced.shapes;
    regions = traced.regions;
  }

  // Straight edges straight, corners sharp, arcs round. Gradients are left
  // alone: their stops are fitted to the traced shapes as they are.
  if (options.refine && !options.gradients && !options.pixelGrid) {
    onProgress('progress.fitting', 85);
    svg = refineSvg(svg);
  }

  // The background is removed on the vectors, not the pixels: the subject's
  // outline stays fitted to the real anti-aliased edge. An image that is
  // already a cut-out has none to remove (its empty pixels read as black,
  // which would otherwise take a dark subject touching the border with them).
  if (options.transparentBackground && !hasTransparentBorder(raster)) {
    svg = removeOuterBackground(svg, detectBackgroundColor(raster), raster.width, raster.height);
  }

  // Paint containing shapes whole, with what they contain on top: no hole
  // left for the background to show through as a hairline crack
  // (pixel-grid output already overlaps its neighbours and must keep its order)
  if (!options.gradients && !options.pixelGrid) svg = stackSvg(svg);

  return finish({ svg, shapes, colors: colorCount, regions, palette: paletteColors, isCenterline: false });
}

/**
 * Structural similarity between the source raster and the rendered SVG (0–1)
 */
export function measureSsim(reference: Raster, candidate: Raster): number {
  return compareImages(reference, candidate, { skipDeltaE: true }).ssim;
}
