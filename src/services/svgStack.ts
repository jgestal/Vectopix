import { parsePathSegments, serializePathSegments, type PathSegment } from '../utils/pathParser';

/**
 * Seam-free stacking of traced shapes.
 *
 * A trace is a mosaic: every region has a hole where its neighbours sit. Even
 * when the shared edges match exactly, the renderer anti-aliases each shape on
 * its own, so along every join the background shows through a little (a
 * hairline crack, worst at 1×). Only overlap removes it.
 *
 * This pass removes the holes that other shapes fill completely and paints the
 * containing shape first: the hexagon is drawn whole, its facets on top. No
 * join is left where the background could show, and no geometry is added.
 * A hole that is not fully covered (a real opening) is always kept.
 *
 * Pure string-in, string-out: no DOM, so it runs inside the Web Worker.
 */

export type Pt = { x: number; y: number };
export type Polygon = Pt[];

interface Shape {
  /** Original markup, re-emitted with holes removed. */
  element: string;
  kind: 'path' | 'primitive';
  /** Closed outlines (paths) or a polygon approximating the primitive. */
  loops: Polygon[];
  /** Absolute segments per subpath (paths only), to re-serialise without holes. */
  subpaths: PathSegment[][];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Above this many shapes (photos) the pass is skipped: O(n²) and no benefit. */
const MAX_SHAPES = 400;
/** Coverage samples per hole along its longer side. */
const COVERAGE_SAMPLES = 24;
/** Width (px) of the join band along a hole's outline, ignored by coverage tests. */
const JOIN_BAND = 1.5;

export function flatten(segs: PathSegment[]): Polygon[] {
  const loops: Polygon[] = [];
  let loop: Polygon = [];
  let cur: Pt = { x: 0, y: 0 };
  for (const s of segs) {
    if (s.type === 'M') {
      if (loop.length > 2) loops.push(loop);
      loop = [{ x: s.x, y: s.y }];
    } else if (s.type === 'C') {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        loop.push({
          x: u * u * u * cur.x + 3 * u * u * t * (s.cp1x ?? cur.x) + 3 * u * t * t * (s.cp2x ?? s.x) + t * t * t * s.x,
          y: u * u * u * cur.y + 3 * u * u * t * (s.cp1y ?? cur.y) + 3 * u * t * t * (s.cp2y ?? s.y) + t * t * t * s.y,
        });
      }
    } else if (s.type === 'L') {
      loop.push({ x: s.x, y: s.y });
    }
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

/** Even-odd fill: inside an odd number of the shape's loops (minus dropped holes). */
function inShape(p: Pt, shape: Shape, dropped?: Set<number>): boolean {
  const { bbox } = shape;
  if (p.x < bbox.minX || p.x > bbox.maxX || p.y < bbox.minY || p.y > bbox.maxY) return false;
  let count = 0;
  shape.loops.forEach((loop, i) => {
    if (!dropped?.has(i) && inPolygon(p, loop)) count++;
  });
  return count % 2 === 1;
}

export function boundsOf(loops: Polygon[]) {
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

const num = (el: string, attr: string) => parseFloat(el.match(new RegExp(`\\s${attr}="([^"]*)"`))?.[1] ?? '0') || 0;

function primitiveLoop(el: string): Polygon | null {
  const tag = el.match(/^<(\w+)/)?.[1];
  if (tag === 'rect') {
    const [x, y, w, h] = [num(el, 'x'), num(el, 'y'), num(el, 'width'), num(el, 'height')];
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const [cx, cy] = [num(el, 'cx'), num(el, 'cy')];
    const rx = tag === 'circle' ? num(el, 'r') : num(el, 'rx');
    const ry = tag === 'circle' ? num(el, 'r') : num(el, 'ry');
    return Array.from({ length: 48 }, (_, i) => ({
      x: cx + rx * Math.cos((Math.PI * 2 * i) / 48),
      y: cy + ry * Math.sin((Math.PI * 2 * i) / 48),
    }));
  }
  return null;
}

function parseShapes(svg: string): { shapes: Shape[]; spans: [number, number][] } {
  const shapes: Shape[] = [];
  const spans: [number, number][] = [];
  for (const m of svg.matchAll(/<(path|circle|ellipse|rect)\b[^>]*\/>/g)) {
    const element = m[0];
    // Only opaque, flat fills take part; anything else keeps its place untouched
    const fill = element.match(/\sfill="([^"]*)"/)?.[1];
    if (!fill || fill === 'none' || fill.startsWith('url(') || /\s(fill-)?opacity="/.test(element)) continue;
    if (m[1] === 'path') {
      const d = element.match(/\sd="([^"]*)"/)?.[1] ?? '';
      const subpaths: PathSegment[][] = [];
      for (const seg of parsePathSegments(d)) {
        if (seg.type === 'M') subpaths.push([seg]);
        else subpaths[subpaths.length - 1]?.push(seg);
      }
      const loops = subpaths.map((sp) => flatten(sp)[0]);
      // Keep subpaths and loops index-aligned; give up on degenerate data
      if (!subpaths.length || loops.some((l) => !l)) continue;
      shapes.push({ element, kind: 'path', loops, subpaths, bbox: boundsOf(loops) });
    } else {
      const loop = primitiveLoop(element);
      if (!loop) continue;
      shapes.push({ element, kind: 'primitive', loops: [loop], subpaths: [], bbox: boundsOf([loop]) });
    }
    spans.push([m.index ?? 0, (m.index ?? 0) + element.length]);
  }
  return { shapes, spans };
}

function distanceToOutline(p: Pt, poly: Polygon): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

/**
 * Points spread over the inside of a polygon, for coverage tests. The band
 * along its outline is left out: that is the join between the hole and what
 * fills it, where two independently fitted edges may sit a pixel apart, and
 * exactly what stacking is about to cover.
 */
function interiorSamples(poly: Polygon): Pt[] {
  const b = boundsOf([poly]);
  const step = Math.max(0.5, Math.max(b.maxX - b.minX, b.maxY - b.minY) / COVERAGE_SAMPLES);
  const pts: Pt[] = [];
  for (let y = b.minY + step / 2; y < b.maxY; y += step)
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      const p = { x, y };
      if (inPolygon(p, poly) && distanceToOutline(p, poly) >= JOIN_BAND) pts.push(p);
    }
  return pts;
}

/** Re-order the shapes and drop the holes that other shapes fill. */
export function stackSvg(svg: string): string {
  const { shapes, spans } = parseShapes(svg);
  if (shapes.length < 2 || shapes.length > MAX_SHAPES) return svg;

  // Constraints "a before b", and the hole subpaths each shape can drop
  const before = shapes.map(() => new Set<number>());
  const dropHoles = shapes.map(() => new Set<number>());

  // Holes of each shape (loops nested inside an odd number of its other loops)
  const holes = shapes.map((shape) =>
    shape.kind !== 'path' || shape.subpaths.length < 2
      ? []
      : shape.loops
          .map((loop, li) => ({ loop, li }))
          .filter(({ loop, li }) => shape.loops.filter((o, oi) => oi !== li && inPolygon(loop[0], o)).length % 2 === 1)
  );

  // Iterate until stable: dropping an inner hole (the star's, in its shield)
  // can complete the coverage of an outer one (the shield's, in its border)
  for (let changed = true, pass = 0; changed && pass < 8; pass++) {
    changed = false;
    shapes.forEach((_, a) => {
      for (const { loop, li } of holes[a]) {
        if (dropHoles[a].has(li)) continue;
        const samples = interiorSamples(loop);
        if (!samples.length) continue;
        // In a mosaic only what lies inside the hole can fill it. A shape
        // enclosing this one (the backing rectangle) also covers the hole,
        // but must stay below it.
        const hb = boundsOf([loop]);
        const inside = (s: Shape) =>
          s.bbox.minX >= hb.minX - JOIN_BAND && s.bbox.maxX <= hb.maxX + JOIN_BAND &&
          s.bbox.minY >= hb.minY - JOIN_BAND && s.bbox.maxY <= hb.maxY + JOIN_BAND;
        const coverers = new Set<number>();
        let covered = true;
        for (const p of samples) {
          const covering = shapes.findIndex((s, si) => si !== a && inside(s) && inShape(p, s, dropHoles[si]));
          if (covering < 0) {
            covered = false; // part of the hole is a real opening
            break;
          }
          coverers.add(covering);
        }
        if (!covered) continue;
        // Everything drawn inside the hole must come after the shape: what
        // covers it, and any smaller shape lying wholly within it
        shapes.forEach((s, si) => {
          if (si === a) return;
          const c = { x: (s.bbox.minX + s.bbox.maxX) / 2, y: (s.bbox.minY + s.bbox.maxY) / 2 };
          if (coverers.has(si) || (inside(s) && inPolygon(c, loop))) before[a].add(si);
        });
        dropHoles[a].add(li);
        changed = true;
      }
    });
  }

  // Stable topological order honouring the constraints; on a cycle, give up
  // the holes of the shapes involved rather than risk painting over a shape
  const order: number[] = [];
  const placed = new Set<number>();
  const mustPrecede = (i: number) => shapes.map((_, j) => j).filter((j) => before[j].has(i) && !placed.has(j));
  while (order.length < shapes.length) {
    const next = shapes.findIndex((_, i) => !placed.has(i) && mustPrecede(i).length === 0);
    if (next < 0) {
      const stuck = shapes.findIndex((_, i) => !placed.has(i));
      for (const j of mustPrecede(stuck)) {
        before[j].delete(stuck);
        dropHoles[j].clear();
      }
      continue;
    }
    order.push(next);
    placed.add(next);
  }

  const emit = (i: number) => {
    const shape = shapes[i];
    if (!dropHoles[i].size) return shape.element;
    const d = shape.subpaths
      .filter((_, li) => !dropHoles[i].has(li))
      .map((sp) => serializePathSegments(sp, 2))
      .join('');
    return shape.element.replace(/\sd="[^"]*"/, ` d="${d}"`);
  };

  // Splice the re-ordered shapes back into the slots the originals occupied
  let out = '';
  let cursor = 0;
  spans.forEach(([start, end], slot) => {
    out += svg.slice(cursor, start) + emit(order[slot]);
    cursor = end;
  });
  return out + svg.slice(cursor);
}
