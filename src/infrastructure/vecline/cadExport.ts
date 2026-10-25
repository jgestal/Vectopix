import { toDxf, toEps, toPdf, parseCssColor, type TraceGeometry, type GeometryPath, type FittedPath } from 'vecline/core';
import { parsePathSegments, type PathSegment } from '../../domain/geometry/pathData';
import { centerlineToDxf, centerlineToEps, centerlineToPdf } from '../../domain/export/centerlineWriters';
import type { ExportFormat } from '../../domain/types';

/**
 * Build DXF / EPS / PDF from an SVG document, so exports reflect node and
 * colour edits (and work for any engine). It needs a DOM, so it runs on the
 * main thread. Transforms are not applied: traced SVGs don't use them.
 */

type Rgba = { r: number; g: number; b: number; a: number };
type Point = { x: number; y: number };

// Content inside these is never drawn directly
const NON_RENDERED = 'defs, clipPath, mask, pattern, symbol, marker';
const SHAPES = 'path, rect, circle, ellipse, polygon, polyline';
const KAPPA = 0.5522847498;

function paintOf(el: Element, prop: 'fill' | 'stroke' | 'stroke-width'): string | null {
  for (let node: Element | null = el; node && node.tagName !== 'svg'; node = node.parentElement) {
    const style = node.getAttribute('style');
    const fromStyle = style?.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1];
    const value = fromStyle ?? node.getAttribute(prop);
    if (value && value !== 'inherit') return value.trim();
  }
  return null;
}

/** Gradients are flattened to the average of their stops. */
function gradientColor(doc: Document, id: string): Rgba | null {
  let gradient = doc.getElementById(id);
  let stops = gradient ? Array.from(gradient.querySelectorAll('stop')) : [];
  // A gradient can borrow its stops from another one through href
  const href = gradient?.getAttribute('href') ?? gradient?.getAttribute('xlink:href');
  if (!stops.length && href?.startsWith('#')) {
    gradient = doc.getElementById(href.slice(1));
    stops = gradient ? Array.from(gradient.querySelectorAll('stop')) : [];
  }

  const colors = stops
    .map((stop) => parseCssColor(paintOfStop(stop)))
    .filter((c): c is Rgba => c !== null);
  if (!colors.length) return null;

  const avg = (key: keyof Rgba) => Math.round(colors.reduce((sum, c) => sum + c[key], 0) / colors.length);
  return { r: avg('r'), g: avg('g'), b: avg('b'), a: avg('a') };
}

function paintOfStop(stop: Element): string {
  const style = stop.getAttribute('style')?.match(/stop-color\s*:\s*([^;]+)/)?.[1];
  return (style ?? stop.getAttribute('stop-color') ?? '#000').trim();
}

/** Resolve a paint value to a colour; null means "not painted". */
function resolvePaint(doc: Document, value: string | null, fallback: Rgba | null): Rgba | null {
  if (value === null) return fallback;
  if (value === 'none' || value === 'transparent') return null;
  const url = value.match(/^url\(\s*['"]?#([^'")]+)['"]?\s*\)/);
  if (url) return gradientColor(doc, url[1]);
  return parseCssColor(value) ?? fallback;
}

const num = (el: Element, attr: string) => parseFloat(el.getAttribute(attr) || '0') || 0;

/** Any supported shape element as absolute path segments. */
function shapeSegments(el: Element): PathSegment[] {
  switch (el.tagName) {
    case 'path':
      return parsePathSegments(el.getAttribute('d') || '');
    case 'rect': {
      const [x, y, w, h] = [num(el, 'x'), num(el, 'y'), num(el, 'width'), num(el, 'height')];
      if (w <= 0 || h <= 0) return [];
      return [
        { type: 'M', x, y },
        { type: 'L', x: x + w, y },
        { type: 'L', x: x + w, y: y + h },
        { type: 'L', x, y: y + h },
        { type: 'Z', x, y },
      ];
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(el, 'cx');
      const cy = num(el, 'cy');
      const rx = el.tagName === 'circle' ? num(el, 'r') : num(el, 'rx');
      const ry = el.tagName === 'circle' ? num(el, 'r') : num(el, 'ry');
      if (rx <= 0 || ry <= 0) return [];
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;
      return [
        { type: 'M', x: cx + rx, y: cy },
        { type: 'C', cp1x: cx + rx, cp1y: cy + ky, cp2x: cx + kx, cp2y: cy + ry, x: cx, y: cy + ry },
        { type: 'C', cp1x: cx - kx, cp1y: cy + ry, cp2x: cx - rx, cp2y: cy + ky, x: cx - rx, y: cy },
        { type: 'C', cp1x: cx - rx, cp1y: cy - ky, cp2x: cx - kx, cp2y: cy - ry, x: cx, y: cy - ry },
        { type: 'C', cp1x: cx + kx, cp1y: cy - ry, cp2x: cx + rx, cp2y: cy - ky, x: cx + rx, y: cy },
        { type: 'Z', x: cx + rx, y: cy },
      ];
    }
    case 'polygon':
    case 'polyline': {
      const coords = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      const segs: PathSegment[] = [];
      for (let i = 0; i + 1 < coords.length; i += 2) {
        segs.push({ type: i === 0 ? 'M' : 'L', x: coords[i], y: coords[i + 1] });
      }
      if (el.tagName === 'polygon' && segs.length) segs.push({ type: 'Z', x: segs[0].x, y: segs[0].y });
      return segs;
    }
    default:
      return [];
  }
}

/** Split absolute segments into vecline subpaths (implicitly closed by the writers). */
function toSubpaths(segments: PathSegment[]): FittedPath[] {
  const subpaths: FittedPath[] = [];
  let current: FittedPath | null = null;

  for (const seg of segments) {
    if (seg.type === 'M') {
      current = { start: { x: seg.x, y: seg.y }, segments: [] };
      subpaths.push(current);
    } else if (seg.type === 'Z' || !current) {
      continue;
    } else if (seg.type === 'L') {
      current.segments.push({ kind: 'line', x: seg.x, y: seg.y });
    } else {
      current.segments.push({
        kind: 'curve',
        x1: seg.cp1x ?? seg.x,
        y1: seg.cp1y ?? seg.y,
        x2: seg.cp2x ?? seg.x,
        y2: seg.cp2y ?? seg.y,
        x: seg.x,
        y: seg.y,
      });
    }
  }

  return subpaths.filter((s) => s.segments.length > 0);
}

/** Open polylines for stroked (centerline) drawings, flattening curves. */
function toPolylines(segments: PathSegment[], curveSteps = 8): Point[][] {
  const polylines: Point[][] = [];
  let current: Point[] = [];
  let pos: Point = { x: 0, y: 0 };

  const flush = () => {
    if (current.length > 1) polylines.push(current);
    current = [];
  };

  for (const seg of segments) {
    if (seg.type === 'M') {
      flush();
      current = [{ x: seg.x, y: seg.y }];
    } else if (seg.type === 'L' || seg.type === 'Z') {
      current.push({ x: seg.x, y: seg.y });
    } else {
      const [x1, y1, x2, y2] = [seg.cp1x ?? pos.x, seg.cp1y ?? pos.y, seg.cp2x ?? seg.x, seg.cp2y ?? seg.y];
      for (let i = 1; i <= curveSteps; i++) {
        const t = i / curveSteps;
        const u = 1 - t;
        current.push({
          x: u * u * u * pos.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * seg.x,
          y: u * u * u * pos.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * seg.y,
        });
      }
    }
    pos = { x: seg.x, y: seg.y };
  }
  flush();
  return polylines;
}

function parseSvg(svg: string): { doc: Document; root: Element; width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const viewBox = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const width = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : num(root, 'width');
  const height = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : num(root, 'height');
  return { doc, root, width, height };
}

const drawnShapes = (root: Element) =>
  Array.from(root.querySelectorAll(SHAPES)).filter((el) => !el.closest(NON_RENDERED));

/** Filled shapes of an SVG as vecline trace geometry. */
export function svgToGeometry(svg: string): TraceGeometry {
  const { doc, root, width, height } = parseSvg(svg);
  const black: Rgba = { r: 0, g: 0, b: 0, a: 255 };
  const paths: GeometryPath[] = [];

  for (const el of drawnShapes(root)) {
    // SVG's default fill is black; polylines are open outlines, not fills
    const color = resolvePaint(doc, paintOf(el, 'fill'), el.tagName === 'polyline' ? null : black);
    if (!color || color.a === 0) continue;
    const subpaths = toSubpaths(shapeSegments(el));
    if (subpaths.length) paths.push({ color, subpaths });
  }

  return { width, height, paths };
}

/** Stroked shapes of an SVG as polylines, plus the stroke style of the first one. */
export function svgToPolylines(svg: string): {
  width: number;
  height: number;
  polylines: Point[][];
  stroke: string;
  strokeWidth: number;
} {
  const { doc, root, width, height } = parseSvg(svg);
  const polylines: Point[][] = [];
  let stroke: Rgba | null = null;
  let strokeWidth = 2;

  for (const el of drawnShapes(root)) {
    const color = resolvePaint(doc, paintOf(el, 'stroke'), null);
    if (!color) continue;
    if (!stroke) {
      stroke = color;
      strokeWidth = parseFloat(paintOf(el, 'stroke-width') || '') || strokeWidth;
    }
    polylines.push(...toPolylines(shapeSegments(el)));
  }

  const hex = (v: number) => v.toString(16).padStart(2, '0');
  const s = stroke ?? { r: 0, g: 0, b: 0, a: 255 };
  return { width, height, polylines, stroke: `#${hex(s.r)}${hex(s.g)}${hex(s.b)}`, strokeWidth };
}

/**
 * Export the current SVG to a CAD / print format. Centerline drawings are
 * exported as stroked polylines; everything else as filled regions.
 */
export function exportSvg(svg: string, format: ExportFormat, isCenterline = false): string | Uint8Array {
  if (isCenterline) {
    const { width, height, polylines, stroke, strokeWidth } = svgToPolylines(svg);
    if (format === 'dxf') return centerlineToDxf(polylines, height);
    if (format === 'eps') return centerlineToEps(polylines, width, height, strokeWidth, stroke);
    return centerlineToPdf(polylines, width, height, strokeWidth, stroke);
  }

  const geometry = svgToGeometry(svg);
  if (format === 'dxf') return toDxf(geometry);
  if (format === 'eps') return toEps(geometry);
  return toPdf(geometry);
}
