import type { PaletteColor, VectorResult } from './types';
import type { SvgDom } from './geometry/svgDom';
import { countAnchors, countShapes } from './geometry/svgStats';
import { parseSvgDocument, serializeParsedDoc } from './geometry/svgDocument';
import { simplifySvgPaths } from './geometry/simplify';
import { normalizeHex, removeColorFromSvg, replaceColorInSvg } from './palette/recolor';

/**
 * Edits to a traced drawing. Each returns a new result whose figures (nodes,
 * shapes, size) describe the edited SVG; the trace it came from is kept as
 * `originalSvg`.
 */

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

export function withSvg(result: VectorResult, svg: string, palette: PaletteColor[] = result.palette): VectorResult {
  return {
    ...result,
    svg,
    palette,
    fileSizeBytes: utf8Bytes(svg),
    nodesCount: countAnchors(svg),
    // A centerline's count is of strokes, which editing doesn't change
    shapes: result.isCenterline ? result.shapes : countShapes(svg),
  };
}

const sameColor = (a: string, b: string) => normalizeHex(a) === normalizeHex(b);

export function recolor(result: VectorResult, from: string, to: string, dom: SvgDom): VectorResult {
  const palette = result.palette.map((p) => (sameColor(p.hex, from) ? { ...p, hex: to } : p));
  return withSvg(result, replaceColorInSvg(result.svg, from, to, dom), palette);
}

export function removeColor(result: VectorResult, hex: string, dom: SvgDom): VectorResult {
  const palette = result.palette.filter((p) => !sameColor(p.hex, hex));
  return withSvg(result, removeColorFromSvg(result.svg, hex, dom), palette);
}

/** Tolerance (px) for dropping nodes whose removal changes the outline by less. */
export const SIMPLIFY_TOLERANCE = 1.2;

/** Fewer nodes for the same outlines; null if nothing could go. */
export function simplify(result: VectorResult, dom: SvgDom): { result: VectorResult; removed: number; percent: number } | null {
  const { newDoc, removedCount, originalNodes } = simplifySvgPaths(parseSvgDocument(result.svg, dom), SIMPLIFY_TOLERANCE);
  if (removedCount <= 0) return null;
  return {
    result: withSvg(result, serializeParsedDoc(newDoc, dom)),
    removed: removedCount,
    percent: Math.round((removedCount / originalNodes) * 100),
  };
}

/**
 * The drawing as traced, before any edit: the trace's own SVG with the
 * palette it had (found among the earlier versions of this result).
 */
export function restoreTrace(result: VectorResult, earlier: readonly VectorResult[]): VectorResult {
  const pristine = earlier.findLast((r) => r.originalSvg === result.originalSvg && r.svg === r.originalSvg);
  return withSvg(result, result.originalSvg, pristine?.palette ?? result.palette);
}
