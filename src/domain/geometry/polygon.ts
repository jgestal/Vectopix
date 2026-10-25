import type { PathSegment } from './pathData';

/** Polygons for area and containment tests on traced outlines. */

export type Pt = { x: number; y: number };
export type Polygon = Pt[];
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** The point at `t` (0–1) on a cubic Bézier. */
export function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Points along a cubic from `cur` (excluding `cur`), 8 per segment: enough for coverage tests. */
function cubicPoints(cur: Pt, s: PathSegment): Pt[] {
  const c1 = { x: s.cp1x ?? cur.x, y: s.cp1y ?? cur.y };
  const c2 = { x: s.cp2x ?? s.x, y: s.cp2y ?? s.y };
  return Array.from({ length: 8 }, (_, i) => bezierAt(cur, c1, c2, s, (i + 1) / 8));
}

/** Each subpath as a polygon (subpaths of fewer than three points are dropped). */
export function flatten(segs: PathSegment[]): Polygon[] {
  const loops: Polygon[] = [];
  let loop: Polygon = [];
  let cur: Pt = { x: 0, y: 0 };
  for (const s of segs) {
    if (s.type === 'M') {
      if (loop.length > 2) loops.push(loop);
      loop = [{ x: s.x, y: s.y }];
    } else if (s.type === 'C') loop.push(...cubicPoints(cur, s));
    else if (s.type === 'L') loop.push({ x: s.x, y: s.y });
    cur = { x: s.x, y: s.y };
  }
  if (loop.length > 2) loops.push(loop);
  return loops;
}

export function inPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function boundsOf(loops: Polygon[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops)
    for (const p of loop) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  return { minX, minY, maxX, maxY };
}
