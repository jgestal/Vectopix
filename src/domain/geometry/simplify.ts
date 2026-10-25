import type { PathSegment } from './pathData';
import type { ParsedSvgDoc } from './svgDocument';

/**
 * Simplify SVG paths by merging micro-segments and removing collinear/redundant nodes.
 * Inspired by Adobe Illustrator's "Path > Simplify" and Ramer-Douglas-Peucker algorithm.
 */
export function simplifySvgPaths(
  doc: ParsedSvgDoc,
  tolerance = 1.0
): { newDoc: ParsedSvgDoc; originalNodes: number; simplifiedNodes: number; removedCount: number } {
  let originalNodes = 0;
  let simplifiedNodes = 0;

  const updatedPaths = doc.paths.map((p) => {
    originalNodes += p.segments.length;
    if (!p.editable || p.segments.length <= 3) {
      simplifiedNodes += p.segments.length;
      return p;
    }

    const segments = p.segments;
    const out: PathSegment[] = [segments[0]];

    for (let i = 1; i < segments.length; i++) {
      const prev = out[out.length - 1];
      const curr = segments[i];
      const next = segments[i + 1];

      // Always keep path starts, closes, or end nodes
      if (curr.type === 'M' || curr.type === 'Z' || !next || next.type === 'Z') {
        out.push(curr);
        continue;
      }

      // 1. Line-to-line simplification (RDP / collinearity)
      if (curr.type === 'L' && next.type === 'L') {
        const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        // Eliminate micro stair-step pixels
        if (dist < tolerance) {
          continue;
        }

        // Collinear test: perpendicular area of triangle (prev, curr, next)
        const area = Math.abs(
          (curr.x - prev.x) * (next.y - prev.y) - (next.x - prev.x) * (curr.y - prev.y)
        );
        if (area < tolerance * 0.75) {
          continue;
        }
      }

      // 2. Micro Bézier simplification: if curve is nearly zero-length
      if (curr.type === 'C' && curr.cp1x !== undefined && curr.cp2x !== undefined) {
        const chord = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const d1 = Math.hypot(curr.cp1x - prev.x, (curr.cp1y ?? 0) - prev.y);
        const d2 = Math.hypot(curr.cp2x - curr.x, (curr.cp2y ?? 0) - curr.y);
        if (chord < tolerance && d1 < tolerance && d2 < tolerance) {
          continue;
        }
      }

      out.push(curr);
    }

    simplifiedNodes += out.length;
    return {
      ...p,
      segments: out,
    };
  });

  return {
    newDoc: { ...doc, paths: updatedPaths },
    originalNodes,
    simplifiedNodes,
    removedCount: originalNodes - simplifiedNodes,
  };
}

