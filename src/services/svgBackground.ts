import { parsePathSegments, serializePathSegments, type PathSegment } from '../utils/pathParser';
import { boundsOf, flatten, inPolygon } from './svgStack';

/**
 * Transparent background, decided on the traced vectors.
 *
 * The image is traced with its background as one more colour region, exactly
 * like an opaque trace, so the subject's outline is fitted against the real
 * anti-aliased edge (sub-pixel accurate, no fringe). Then the region of the
 * background colour that touches the image border is removed, together with
 * the holes the subject sits in. Islands of the same colour inside the subject
 * (the white ring of a logo, a white star on a badge) are kept.
 */

type Rgb = { r: number; g: number; b: number };

/** Two colours closer than this (RGB distance) are the same palette entry. */
const SAME_COLOUR = 24;
/** A region within this many px of the image edge touches the border. */
const BORDER_REACH = 1;

function parseColour(value: string): Rgb | null {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return rgb ? { r: +rgb[1], g: +rgb[2], b: +rgb[3] } : null;
}

function numberAttr(el: string, attr: string): number {
  return parseFloat(el.match(new RegExp(`\\s${attr}="([^"]*)"`))?.[1] ?? '0') || 0;
}

export function removeOuterBackground(svg: string, background: Rgb, width: number, height: number): string {
  const touchesBorder = (b: ReturnType<typeof boundsOf>) =>
    b.minX <= BORDER_REACH || b.minY <= BORDER_REACH || b.maxX >= width - BORDER_REACH || b.maxY >= height - BORDER_REACH;

  return svg.replace(/<(path|circle|ellipse|rect)\b[^>]*\/>/g, (element, tag: string) => {
    const fill = parseColour(element.match(/\sfill="([^"]*)"/)?.[1] ?? '');
    if (!fill || Math.hypot(fill.r - background.r, fill.g - background.g, fill.b - background.b) > SAME_COLOUR) return element;

    if (tag !== 'path') {
      // A primitive in the background colour: the backing shape if it reaches the border
      const [x, y] = tag === 'rect' ? [numberAttr(element, 'x'), numberAttr(element, 'y')] : [numberAttr(element, 'cx'), numberAttr(element, 'cy')];
      const [w, h] =
        tag === 'rect'
          ? [numberAttr(element, 'width'), numberAttr(element, 'height')]
          : tag === 'circle'
            ? [numberAttr(element, 'r'), numberAttr(element, 'r')]
            : [numberAttr(element, 'rx'), numberAttr(element, 'ry')];
      const b = tag === 'rect' ? { minX: x, minY: y, maxX: x + w, maxY: y + h } : { minX: x - w, minY: y - h, maxX: x + w, maxY: y + h };
      return touchesBorder(b) ? '' : element;
    }

    const subpaths: PathSegment[][] = [];
    for (const seg of parsePathSegments(element.match(/\sd="([^"]*)"/)?.[1] ?? '')) {
      if (seg.type === 'M') subpaths.push([seg]);
      else subpaths[subpaths.length - 1]?.push(seg);
    }
    const loops = subpaths.map((sp) => flatten(sp)[0] ?? []);
    // Which loops contain each loop (even-odd nesting within this path)
    const parents = loops.map((loop, i) =>
      loop.length ? loops.map((_, j) => j).filter((j) => j !== i && loops[j].length > 2 && inPolygon(loop[0], loops[j])) : []
    );
    // The outer region: top-level loops reaching the border, plus the holes
    // directly inside them (where the subject is drawn)
    const outer = new Set(loops.map((_, i) => i).filter((i) => parents[i].length === 0 && loops[i].length && touchesBorder(boundsOf([loops[i]]))));
    if (!outer.size) return element;
    const removed = new Set(outer);
    parents.forEach((p, i) => {
      if (p.length === 1 && outer.has(p[0])) removed.add(i);
    });

    const kept = subpaths.filter((_, i) => !removed.has(i));
    if (!kept.length) return '';
    return element.replace(/\sd="[^"]*"/, ` d="${kept.map((sp) => serializePathSegments(sp, 2)).join('')}"`);
  });
}

/**
 * Move path points lying within half a pixel of the canvas edge onto it. The
 * tracer follows region boundaries through pixel centres, so a region that
 * reaches the image border stops 0.5 px short of it, and whatever is painted
 * below (vecline's backing rectangle, in the image's most common colour)
 * shows as a thin frame around the picture.
 */
export function snapToCanvasEdge(svg: string, width: number, height: number): string {
  const snap = (v: number, max: number) => (v <= 0.5 ? 0 : v >= max - 0.5 ? max : v);
  return svg.replace(/(<path\b[^>]*\sd=")([^"]*)"/g, (whole, head: string, d: string) => {
    let changed = false;
    const segs = parsePathSegments(d).map((s): PathSegment => {
      const next = {
        ...s,
        x: snap(s.x, width),
        y: snap(s.y, height),
        ...(s.cp1x !== undefined ? { cp1x: snap(s.cp1x, width), cp1y: snap(s.cp1y ?? 0, height) } : {}),
        ...(s.cp2x !== undefined ? { cp2x: snap(s.cp2x, width), cp2y: snap(s.cp2y ?? 0, height) } : {}),
      };
      if (next.x !== s.x || next.y !== s.y || next.cp1x !== s.cp1x || next.cp1y !== s.cp1y || next.cp2x !== s.cp2x || next.cp2y !== s.cp2y) changed = true;
      return next;
    });
    return changed ? `${head}${serializePathSegments(segs, 2)}"` : whole;
  });
}
