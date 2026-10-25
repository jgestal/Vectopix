import { parsePathSegments, type PathSegment } from './pathData';
import type { Polygon } from './polygon';

/** Reading the elements of a traced SVG (as the tracers write them: one self-closing tag each). */

/** Every filled shape element: paths and the primitives the tracers emit. */
export const SHAPE_ELEMENT = /<(path|circle|ellipse|rect)\b[^>]*\/>/g;

export function attr(el: string, name: string): string | undefined {
  return el.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

/** A numeric attribute; missing or malformed reads as 0. */
export function numberAttr(el: string, name: string): number {
  return parseFloat(attr(el, name) ?? '0') || 0;
}

/** Path segments split at each moveto: one array per subpath. */
export function splitSubpaths(segments: PathSegment[]): PathSegment[][] {
  const out: PathSegment[][] = [];
  for (const s of segments) {
    if (s.type === 'M') out.push([s]);
    else if (out.length) out[out.length - 1].push(s);
  }
  return out;
}

/** The subpaths of a path element's `d`. */
export const pathSubpaths = (el: string): PathSegment[][] => splitSubpaths(parsePathSegments(attr(el, 'd') ?? ''));

/** The outline of a circle, ellipse or rect element as a polygon (circles as 48 points). */
export function primitiveLoop(el: string): Polygon | null {
  const tag = el.match(/^<(\w+)/)?.[1];
  if (tag === 'rect') {
    const [x, y, w, h] = [numberAttr(el, 'x'), numberAttr(el, 'y'), numberAttr(el, 'width'), numberAttr(el, 'height')];
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const [cx, cy] = [numberAttr(el, 'cx'), numberAttr(el, 'cy')];
    const rx = tag === 'circle' ? numberAttr(el, 'r') : numberAttr(el, 'rx');
    const ry = tag === 'circle' ? numberAttr(el, 'r') : numberAttr(el, 'ry');
    return Array.from({ length: 48 }, (_, i) => ({
      x: cx + rx * Math.cos((Math.PI * 2 * i) / 48),
      y: cy + ry * Math.sin((Math.PI * 2 * i) / 48),
    }));
  }
  return null;
}
