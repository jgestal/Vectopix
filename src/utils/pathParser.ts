export interface PathSegment {
  type: 'M' | 'L' | 'C' | 'Z';
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

export interface ParsedPath {
  id: string;
  originalD: string;
  attributes: Record<string, string>;
  segments: PathSegment[];
  /** False when the path data couldn't be parsed; such paths are never rewritten. */
  editable: boolean;
}

export interface ParsedSvgDoc {
  /** The SVG markup this document was parsed from. */
  source: string;
  svgAttributes: Record<string, string>;
  paths: ParsedPath[];
  width: number;
  height: number;
  viewBox: string;
}

export interface InteractiveNode {
  id: string;
  pathIndex: number;
  segmentIndex: number;
  nodeType: 'anchor' | 'cp1' | 'cp2';
  segmentType: PathSegment['type'];
  x: number;
  y: number;
  isCurve: boolean;
  connectedAnchor?: { x: number; y: number };
}

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

/**
 * Convert an SVG elliptical arc into cubic Béziers (≤ 90° each), following
 * the endpoint-to-center conversion of the SVG spec (appendix F.6.5)
 */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number
): PathSegment[] {
  if (x1 === x2 && y1 === y2) return [];
  if (rx === 0 || ry === 0) return [{ type: 'L', x: x2, y: y2 }];

  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  // Scale radii up when they are too small to reach the endpoint
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  const point = (t: number) => ({
    x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  });
  const tangent = (t: number) => ({
    x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  });

  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const segments: PathSegment[] = [];

  for (let i = 0; i < count; i++) {
    const t1 = theta1 + i * step;
    const t2 = t1 + step;
    const a = point(t1);
    const da = tangent(t1);
    const b = i === count - 1 ? { x: x2, y: y2 } : point(t2);
    const db = tangent(t2);
    segments.push({
      type: 'C',
      cp1x: a.x + k * da.x,
      cp1y: a.y + k * da.y,
      cp2x: b.x - k * db.x,
      cp2y: b.y - k * db.y,
      x: b.x,
      y: b.y,
    });
  }

  return segments;
}

/**
 * Parse an SVG path 'd' attribute into normalized absolute segments.
 * Every command is supported: H/V become lines; S, Q, T and arcs become cubics.
 */
export function parsePathSegments(d: string): PathSegment[] {
  return parsePathData(d).segments;
}

/** Like {@link parsePathSegments}, also reporting whether all of `d` was valid. */
function parsePathData(d: string): { segments: PathSegment[]; complete: boolean } {
  let pos = 0;
  const skipSeparators = () => {
    while (pos < d.length && (d[pos] === ',' || d[pos] === ' ' || d[pos] === '\n' || d[pos] === '\t' || d[pos] === '\r')) pos++;
  };
  const readNumber = (): number | null => {
    skipSeparators();
    NUMBER.lastIndex = pos;
    const match = NUMBER.exec(d);
    if (!match) return null;
    pos = NUMBER.lastIndex;
    return parseFloat(match[0]);
  };
  // Arc flags are single digits and may be packed without separators ("011")
  const readFlag = (): boolean | null => {
    skipSeparators();
    const c = d[pos];
    if (c !== '0' && c !== '1') return null;
    pos++;
    return c === '1';
  };
  const readNumbers = (count: number): number[] | null => {
    const out: number[] = [];
    for (let k = 0; k < count; k++) {
      const n = readNumber();
      if (n === null) return null;
      out.push(n);
    }
    return out;
  };

  const segments: PathSegment[] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  // Control points of the previous cubic / quadratic, for S and T reflection
  let lastCubic: { x: number; y: number } | null = null;
  let lastQuad: { x: number; y: number } | null = null;

  while (true) {
    skipSeparators();
    if (pos >= d.length) break;
    if (/[a-zA-Z]/.test(d[pos])) {
      cmd = d[pos++];
    } else if (!cmd) {
      break;
    }

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    const ox = rel ? curX : 0;
    const oy = rel ? curY : 0;
    let nextCubic: { x: number; y: number } | null = null;
    let nextQuad: { x: number; y: number } | null = null;

    if (upper === 'Z') {
      segments.push({ type: 'Z', x: startX, y: startY });
      curX = startX;
      curY = startY;
      cmd = '';
    } else if (upper === 'M' || upper === 'L' || upper === 'T') {
      const n = readNumbers(2);
      if (!n) break;
      const x = ox + n[0];
      const y = oy + n[1];
      if (upper === 'M') {
        segments.push({ type: 'M', x, y });
        startX = x;
        startY = y;
        cmd = rel ? 'l' : 'L'; // Subsequent pairs are implicit lineTo
      } else if (upper === 'L') {
        segments.push({ type: 'L', x, y });
      } else {
        const q: { x: number; y: number } = lastQuad ? { x: 2 * curX - lastQuad.x, y: 2 * curY - lastQuad.y } : { x: curX, y: curY };
        segments.push(quadToCubic(curX, curY, q.x, q.y, x, y));
        nextQuad = q;
      }
      curX = x;
      curY = y;
    } else if (upper === 'H' || upper === 'V') {
      const n = readNumber();
      if (n === null) break;
      if (upper === 'H') curX = ox + n;
      else curY = oy + n;
      segments.push({ type: 'L', x: curX, y: curY });
    } else if (upper === 'C' || upper === 'S') {
      const n = readNumbers(upper === 'C' ? 6 : 4);
      if (!n) break;
      const [cp1x, cp1y] =
        upper === 'C'
          ? [ox + n[0], oy + n[1]]
          : lastCubic
            ? [2 * curX - lastCubic.x, 2 * curY - lastCubic.y]
            : [curX, curY];
      const rest = upper === 'C' ? n.slice(2) : n;
      const seg: PathSegment = {
        type: 'C',
        cp1x,
        cp1y,
        cp2x: ox + rest[0],
        cp2y: oy + rest[1],
        x: ox + rest[2],
        y: oy + rest[3],
      };
      segments.push(seg);
      nextCubic = { x: seg.cp2x!, y: seg.cp2y! };
      curX = seg.x;
      curY = seg.y;
    } else if (upper === 'Q') {
      const n = readNumbers(4);
      if (!n) break;
      const q = { x: ox + n[0], y: oy + n[1] };
      const x = ox + n[2];
      const y = oy + n[3];
      segments.push(quadToCubic(curX, curY, q.x, q.y, x, y));
      nextQuad = q;
      curX = x;
      curY = y;
    } else if (upper === 'A') {
      const radii = readNumbers(3);
      const largeArc = readFlag();
      const sweep = readFlag();
      const end = readNumbers(2);
      if (!radii || largeArc === null || sweep === null || !end) break;
      const x = ox + end[0];
      const y = oy + end[1];
      segments.push(...arcToCubics(curX, curY, radii[0], radii[1], radii[2], largeArc, sweep, x, y));
      curX = x;
      curY = y;
    } else {
      break; // Unknown command: stop rather than misread the rest
    }

    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }

  skipSeparators();
  return { segments, complete: pos >= d.length };
}

function quadToCubic(x0: number, y0: number, qx: number, qy: number, x: number, y: number): PathSegment {
  return {
    type: 'C',
    cp1x: x0 + (2 / 3) * (qx - x0),
    cp1y: y0 + (2 / 3) * (qy - y0),
    cp2x: x + (2 / 3) * (qx - x),
    cp2y: y + (2 / 3) * (qy - y),
    x,
    y,
  };
}

/** Shortest decimal form of a number: trailing zeros and leading 0 dropped. */
function formatNumber(val: number, precision: number): string {
  const s = Number(val.toFixed(precision)).toString();
  if (s === '-0') return '0';
  return s.replace(/^(-?)0\./, '$1.');
}

/** Join numbers with the fewest separators SVG allows. */
function joinNumbers(values: string[]): string {
  let out = '';
  for (const v of values) {
    const needsSpace = out !== '' && !v.startsWith('-') && !(v.startsWith('.') && /\.\d*$/.test(out));
    out += (needsSpace ? ' ' : '') + v;
  }
  return out;
}

/**
 * Serialize segments into a compact 'd' string: relative commands, h/v for
 * axis-aligned lines and minimal separators, so editing a path doesn't bloat
 * the file. Offsets are taken between rounded positions, so rounding errors
 * never accumulate along the path.
 */
export function serializePathSegments(segments: PathSegment[], precision = 2): string {
  const round = (v: number) => Number(v.toFixed(precision));
  const fmt = (v: number) => formatNumber(v, precision);
  const parts: string[] = [];
  let curX = 0;
  let curY = 0;
  let first = true;

  for (const s of segments) {
    if (s.type === 'Z') {
      parts.push('z');
      curX = round(s.x);
      curY = round(s.y);
      continue;
    }

    const x = round(s.x);
    const y = round(s.y);
    const dx = round(x - curX);
    const dy = round(y - curY);

    if (s.type === 'M') {
      parts.push(first ? `M${joinNumbers([fmt(x), fmt(y)])}` : `m${joinNumbers([fmt(dx), fmt(dy)])}`);
    } else if (s.type === 'L') {
      if (dy === 0) parts.push(`h${fmt(dx)}`);
      else if (dx === 0) parts.push(`v${fmt(dy)}`);
      else parts.push(`l${joinNumbers([fmt(dx), fmt(dy)])}`);
    } else {
      const rel = (v: number | undefined, fallback: number, origin: number) => fmt(round(round(v ?? fallback) - origin));
      parts.push(
        'c' +
          joinNumbers([
            rel(s.cp1x, s.x, curX),
            rel(s.cp1y, s.y, curY),
            rel(s.cp2x, s.x, curX),
            rel(s.cp2y, s.y, curY),
            fmt(dx),
            fmt(dy),
          ])
      );
    }

    first = false;
    curX = x;
    curY = y;
  }

  return parts.join('');
}

// Segment arrays exactly as parsed. Every edit creates a new array, so a path
// whose segments are still in here is untouched and keeps its original `d`.
const pristineSegments = new WeakMap<PathSegment[], true>();

/**
 * Parse entire SVG document into editable structures
 */
export function parseSvgDocument(svgString: string): ParsedSvgDoc {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  const svgAttributes: Record<string, string> = {};
  let width = 400;
  let height = 400;
  let viewBox = '0 0 400 400';

  if (svgEl) {
    for (let i = 0; i < svgEl.attributes.length; i++) {
      const attr = svgEl.attributes[i];
      svgAttributes[attr.name] = attr.value;
    }
    width = parseFloat(svgEl.getAttribute('width') || '400');
    height = parseFloat(svgEl.getAttribute('height') || '400');
    viewBox = svgEl.getAttribute('viewBox') || `0 0 ${width} ${height}`;
  }

  const paths: ParsedPath[] = [];
  const pathElements = doc.querySelectorAll('path');

  pathElements.forEach((pathEl, idx) => {
    const rawD = pathEl.getAttribute('d') || '';
    const attributes: Record<string, string> = {};

    for (let i = 0; i < pathEl.attributes.length; i++) {
      const attr = pathEl.attributes[i];
      if (attr.name !== 'd') {
        attributes[attr.name] = attr.value;
      }
    }

    const { segments, complete } = parsePathData(rawD);
    // A path the parser could only partly read is left as is rather than mangled
    const editable = complete && segments.length > 0;
    pristineSegments.set(segments, true);
    paths.push({
      id: pathEl.getAttribute('id') || `path_${idx}`,
      originalD: rawD,
      attributes,
      segments,
      editable,
    });
  });

  return {
    source: svgString,
    svgAttributes,
    paths,
    width,
    height,
    viewBox,
  };
}

/**
 * Serialize an edited document back to SVG. Only the `d` of edited paths is
 * rewritten: everything else (defs, gradients, groups, primitives, attributes)
 * is preserved exactly as in the source.
 */
export function serializeParsedDoc(doc: ParsedSvgDoc): string {
  const dom = new DOMParser().parseFromString(doc.source, 'image/svg+xml');
  const pathElements = dom.querySelectorAll('path');

  doc.paths.forEach((p, i) => {
    const el = pathElements[i];
    if (!el || !p.editable || pristineSegments.has(p.segments)) return;
    el.setAttribute('d', serializePathSegments(p.segments));
  });

  return new XMLSerializer().serializeToString(dom.documentElement);
}

function updateSegments(
  doc: ParsedSvgDoc,
  pathIndex: number,
  update: (segments: PathSegment[]) => PathSegment[]
): ParsedSvgDoc {
  const paths = [...doc.paths];
  const target = paths[pathIndex];
  paths[pathIndex] = { ...target, segments: update([...target.segments]) };
  return { ...doc, paths };
}

/**
 * Move an anchor or Bézier handle to (x, y). Moving an anchor carries both of
 * its handles along: the incoming one (cp2 of its own segment) and the
 * outgoing one (cp1 of the next segment).
 */
export function moveNode(
  doc: ParsedSvgDoc,
  node: Pick<InteractiveNode, 'pathIndex' | 'segmentIndex' | 'nodeType'>,
  x: number,
  y: number
): ParsedSvgDoc {
  return updateSegments(doc, node.pathIndex, (segments) => {
    const seg = { ...segments[node.segmentIndex] };

    if (node.nodeType === 'cp1') {
      seg.cp1x = x;
      seg.cp1y = y;
    } else if (node.nodeType === 'cp2') {
      seg.cp2x = x;
      seg.cp2y = y;
    } else {
      const dx = x - seg.x;
      const dy = y - seg.y;
      seg.x = x;
      seg.y = y;
      if (seg.cp2x !== undefined && seg.cp2y !== undefined) {
        seg.cp2x += dx;
        seg.cp2y += dy;
      }
      const next = segments[node.segmentIndex + 1];
      if (next?.type === 'C' && next.cp1x !== undefined && next.cp1y !== undefined) {
        segments[node.segmentIndex + 1] = { ...next, cp1x: next.cp1x + dx, cp1y: next.cp1y + dy };
      }
    }

    segments[node.segmentIndex] = seg;
    return segments;
  });
}

/**
 * Delete an anchor. Deleting the start of a subpath promotes the next anchor
 * to be the new start. Returns null when the path would be left with fewer
 * than two anchors.
 */
export function deleteNode(doc: ParsedSvgDoc, pathIndex: number, segmentIndex: number): ParsedSvgDoc | null {
  const segments = doc.paths[pathIndex].segments;
  const seg = segments[segmentIndex];
  if (!seg || seg.type === 'Z') return null;

  const anchors = segments.filter((s) => s.type !== 'Z').length;
  if (anchors <= 2) return null;

  if (seg.type === 'M') {
    const next = segments[segmentIndex + 1];
    if (!next || (next.type !== 'L' && next.type !== 'C')) return null;
    return updateSegments(doc, pathIndex, (segs) => {
      segs.splice(segmentIndex, 2, { type: 'M', x: next.x, y: next.y });
      return segs;
    });
  }

  return updateSegments(doc, pathIndex, (segs) => {
    segs.splice(segmentIndex, 1);
    return segs;
  });
}

/**
 * Extract all interactive nodes (anchors + Bézier handles)
 */
export function extractInteractiveNodes(
  paths: ParsedPath[],
  selectedPathIndex: number | null
): InteractiveNode[] {
  const nodes: InteractiveNode[] = [];

  paths.forEach((path, pathIdx) => {
    if (!path.editable) return;
    const isSelected = selectedPathIndex === null || selectedPathIndex === pathIdx;
    let prevAnchor = { x: 0, y: 0 };

    path.segments.forEach((seg, segIdx) => {
      if (seg.type === 'M' || seg.type === 'L') {
        nodes.push({
          id: `p${pathIdx}_s${segIdx}_anchor`,
          pathIndex: pathIdx,
          segmentIndex: segIdx,
          nodeType: 'anchor',
          segmentType: seg.type,
          x: seg.x,
          y: seg.y,
          isCurve: false,
        });
        prevAnchor = { x: seg.x, y: seg.y };
      } else if (seg.type === 'C') {
        // Control point 1
        if (isSelected && seg.cp1x !== undefined && seg.cp1y !== undefined) {
          nodes.push({
            id: `p${pathIdx}_s${segIdx}_cp1`,
            pathIndex: pathIdx,
            segmentIndex: segIdx,
            nodeType: 'cp1',
            segmentType: 'C',
            x: seg.cp1x,
            y: seg.cp1y,
            isCurve: true,
            connectedAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }

        // Control point 2
        if (isSelected && seg.cp2x !== undefined && seg.cp2y !== undefined) {
          nodes.push({
            id: `p${pathIdx}_s${segIdx}_cp2`,
            pathIndex: pathIdx,
            segmentIndex: segIdx,
            nodeType: 'cp2',
            segmentType: 'C',
            x: seg.cp2x,
            y: seg.cp2y,
            isCurve: true,
            connectedAnchor: { x: seg.x, y: seg.y },
          });
        }

        // Anchor
        nodes.push({
          id: `p${pathIdx}_s${segIdx}_anchor`,
          pathIndex: pathIdx,
          segmentIndex: segIdx,
          nodeType: 'anchor',
          segmentType: 'C',
          x: seg.x,
          y: seg.y,
          isCurve: true,
        });

        prevAnchor = { x: seg.x, y: seg.y };
      }
    });
  });

  return nodes;
}

/**
 * Toggle node type between Smooth Bézier curve (C) and Sharp corner line (L)
 */
export function toggleNodeType(
  doc: ParsedSvgDoc,
  pathIndex: number,
  segmentIndex: number
): ParsedSvgDoc {
  const updatedPaths = [...doc.paths];
  const targetPath = { ...updatedPaths[pathIndex] };
  const segments = [...targetPath.segments];
  const seg = { ...segments[segmentIndex] };
  const prevSeg = segments[segmentIndex - 1] || { x: 0, y: 0 };

  if (seg.type === 'L') {
    // Convert to Cubic Bézier curve with gentle third-point handles
    const dx = seg.x - prevSeg.x;
    const dy = seg.y - prevSeg.y;
    seg.type = 'C';
    seg.cp1x = prevSeg.x + dx * 0.33;
    seg.cp1y = prevSeg.y + dy * 0.33;
    seg.cp2x = prevSeg.x + dx * 0.66;
    seg.cp2y = prevSeg.y + dy * 0.66;
  } else if (seg.type === 'C') {
    // Convert to Sharp linear corner
    seg.type = 'L';
    delete seg.cp1x;
    delete seg.cp1y;
    delete seg.cp2x;
    delete seg.cp2y;
  }

  segments[segmentIndex] = seg;
  targetPath.segments = segments;
  updatedPaths[pathIndex] = targetPath;

  return {
    ...doc,
    paths: updatedPaths,
  };
}

/**
 * Split a segment at midpoint using De Casteljau's algorithm for cubic curves or linear midpoint
 */
export function splitSegmentAtMidpoint(
  doc: ParsedSvgDoc,
  pathIndex: number,
  segmentIndex: number
): { newDoc: ParsedSvgDoc; newNodeIndex: number } {
  const updatedPaths = [...doc.paths];
  const targetPath = { ...updatedPaths[pathIndex] };
  const segments = [...targetPath.segments];
  const seg = { ...segments[segmentIndex] };
  const prevSeg = segments[segmentIndex - 1] || { x: 0, y: 0 };

  if (seg.type === 'C') {
    // De Casteljau subdivision at t = 0.5
    const p0 = { x: prevSeg.x, y: prevSeg.y };
    const p1 = { x: seg.cp1x ?? prevSeg.x, y: seg.cp1y ?? prevSeg.y };
    const p2 = { x: seg.cp2x ?? seg.x, y: seg.cp2y ?? seg.y };
    const p3 = { x: seg.x, y: seg.y };

    const q0 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const q1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const q2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };

    const r0 = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
    const r1 = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };

    const mid = { x: (r0.x + r1.x) / 2, y: (r0.y + r1.y) / 2 };

    // First half (inserted before seg)
    const firstHalf: PathSegment = {
      type: 'C',
      cp1x: q0.x,
      cp1y: q0.y,
      cp2x: r0.x,
      cp2y: r0.y,
      x: mid.x,
      y: mid.y,
    };

    // Second half (modifies original seg)
    seg.cp1x = r1.x;
    seg.cp1y = r1.y;
    seg.cp2x = q2.x;
    seg.cp2y = q2.y;

    segments[segmentIndex] = seg;
    segments.splice(segmentIndex, 0, firstHalf);
  } else {
    // Linear subdivision
    const midX = (prevSeg.x + seg.x) / 2;
    const midY = (prevSeg.y + seg.y) / 2;
    const midSeg: PathSegment = {
      type: 'L',
      x: midX,
      y: midY,
    };
    segments.splice(segmentIndex, 0, midSeg);
  }

  targetPath.segments = segments;
  updatedPaths[pathIndex] = targetPath;

  return {
    newDoc: { ...doc, paths: updatedPaths },
    newNodeIndex: segmentIndex,
  };
}

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
