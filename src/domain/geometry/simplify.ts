import type { PathSegment } from './pathData';
import type { ParsedSvgDoc } from './svgDocument';

/**
 * Simplify SVG paths by merging micro-segments and removing collinear/redundant nodes.
 * Inspired by Adobe Illustrator's "Path > Simplify" and Ramer-Douglas-Peucker algorithm.
 */

/** Path starts, closes and the last node before a close or the end are always kept. */
const isStructural = (curr: PathSegment, next: PathSegment | undefined) =>
  curr.type === 'M' || curr.type === 'Z' || !next || next.type === 'Z';

/**
 * A corner between two lines that adds nothing: a micro stair-step (closer
 * than `tolerance` to the previous node) or nearly collinear (small
 * prev–curr–next triangle).
 */
function isRedundantLine(prev: PathSegment, curr: PathSegment, next: PathSegment, tolerance: number): boolean {
  if (curr.type !== 'L' || next.type !== 'L') return false;
  if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < tolerance) return true;
  const area = Math.abs((curr.x - prev.x) * (next.y - prev.y) - (next.x - prev.x) * (curr.y - prev.y));
  return area < tolerance * 0.75;
}

/** A curve so short (chord and both handles under `tolerance`) that it draws nothing. */
function isMicroCurve(prev: PathSegment, curr: PathSegment, tolerance: number): boolean {
  if (curr.type !== 'C' || curr.cp1x === undefined || curr.cp2x === undefined) return false;
  const chord = Math.hypot(curr.x - prev.x, curr.y - prev.y);
  const d1 = Math.hypot(curr.cp1x - prev.x, (curr.cp1y ?? 0) - prev.y);
  const d2 = Math.hypot(curr.cp2x - curr.x, (curr.cp2y ?? 0) - curr.y);
  return chord < tolerance && d1 < tolerance && d2 < tolerance;
}

function simplifySegments(segments: PathSegment[], tolerance: number): PathSegment[] {
  const out: PathSegment[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const [prev, curr, next] = [out[out.length - 1], segments[i], segments[i + 1]];
    const drop = !isStructural(curr, next) && (isRedundantLine(prev, curr, next, tolerance) || isMicroCurve(prev, curr, tolerance));
    if (!drop) out.push(curr);
  }
  return out;
}

export function simplifySvgPaths(
  doc: ParsedSvgDoc,
  tolerance = 1.0
): { newDoc: ParsedSvgDoc; originalNodes: number; simplifiedNodes: number; removedCount: number } {
  const paths = doc.paths.map((p) => (!p.editable || p.segments.length <= 3 ? p : { ...p, segments: simplifySegments(p.segments, tolerance) }));
  const count = (list: typeof doc.paths) => list.reduce((n, p) => n + p.segments.length, 0);
  const originalNodes = count(doc.paths);
  const simplifiedNodes = count(paths);
  return { newDoc: { ...doc, paths }, originalNodes, simplifiedNodes, removedCount: originalNodes - simplifiedNodes };
}
