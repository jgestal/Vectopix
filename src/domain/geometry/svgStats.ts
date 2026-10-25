import { parsePathSegments } from './pathData';

/**
 * Anchor points of an SVG: the nodes a person would edit. Every path segment
 * end counts once (control points do not); a circle, ellipse or rect counts
 * as one shape-defined node.
 */
export function countAnchors(svg: string): number {
  let count = 0;
  for (const match of svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)) {
    count += parsePathSegments(match[1]).filter((s) => s.type !== 'Z').length;
  }
  count += (svg.match(/<(circle|ellipse|rect)\b/g) || []).length;
  return count;
}

/** Shapes the SVG draws (paths and primitives): what "N shapes" refers to everywhere in the UI. */
export function countShapes(svg: string): number {
  const shapes = svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b[^>]*>/g) || [];
  return shapes.filter((el) => !/^<path\b/.test(el) || /\sd="[^"]*[0-9]/.test(el)).length;
}
