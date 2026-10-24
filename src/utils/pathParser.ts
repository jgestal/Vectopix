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
  /** False when the path uses commands the editor can't round-trip (arcs, T). */
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

/**
 * Tokenize SVG path string handling compressed numbers (e.g. .7.1, 10-20)
 */
function tokenizePath(d: string): (string | number)[] {
  const re = /([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  const tokens: (string | number)[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) {
      tokens.push(m[1]);
    } else if (m[2] !== undefined) {
      tokens.push(parseFloat(m[2]));
    }
  }
  return tokens;
}

/**
 * Parse an SVG path 'd' attribute into normalized absolute segments
 */
export function parsePathSegments(d: string): PathSegment[] {
  const tokens = tokenizePath(d);
  let i = 0;
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  const segments: PathSegment[] = [];

  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') {
      cmd = tokens[i++] as string;
    }
    const isRel = cmd === cmd.toLowerCase() && cmd !== 'z';
    const upper = cmd.toUpperCase();

    if (upper === 'M') {
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      curX = x;
      curY = y;
      startX = x;
      startY = y;
      segments.push({ type: 'M', x, y });
      cmd = isRel ? 'l' : 'L'; // Subsequent pairs are implicit lineTo
    } else if (upper === 'L') {
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      curX = x;
      curY = y;
      segments.push({ type: 'L', x, y });
    } else if (upper === 'H') {
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      curX = x;
      segments.push({ type: 'L', x, y: curY });
    } else if (upper === 'V') {
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      curY = y;
      segments.push({ type: 'L', x: curX, y });
    } else if (upper === 'C') {
      const cp1x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const cp1y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      const cp2x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const cp2y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      curX = x;
      curY = y;
      segments.push({ type: 'C', cp1x, cp1y, cp2x, cp2y, x, y });
    } else if (upper === 'S') {
      let prevCp2X = curX;
      let prevCp2Y = curY;
      const prevSeg = segments[segments.length - 1];
      if (prevSeg && prevSeg.type === 'C' && prevSeg.cp2x !== undefined && prevSeg.cp2y !== undefined) {
        prevCp2X = 2 * curX - prevSeg.cp2x;
        prevCp2Y = 2 * curY - prevSeg.cp2y;
      }
      const cp2x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const cp2y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      curX = x;
      curY = y;
      segments.push({ type: 'C', cp1x: prevCp2X, cp1y: prevCp2Y, cp2x, cp2y, x, y });
    } else if (upper === 'Q') {
      const qx = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const qy = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      const x = isRel ? curX + (tokens[i++] as number) : (tokens[i++] as number);
      const y = isRel ? curY + (tokens[i++] as number) : (tokens[i++] as number);
      const cp1x = curX + (2 / 3) * (qx - curX);
      const cp1y = curY + (2 / 3) * (qy - curY);
      const cp2x = x + (2 / 3) * (qx - x);
      const cp2y = y + (2 / 3) * (qy - y);
      curX = x;
      curY = y;
      segments.push({ type: 'C', cp1x, cp1y, cp2x, cp2y, x, y });
    } else if (upper === 'Z') {
      curX = startX;
      curY = startY;
      segments.push({ type: 'Z', x: startX, y: startY });
      if (typeof tokens[i] === 'string' && (tokens[i] as string).toUpperCase() === 'Z') {
        i++;
      }
    } else {
      i++;
    }
  }

  return segments;
}

function roundCoord(val: number, precision = 2): string {
  return Number(val.toFixed(precision)).toString();
}

/**
 * Serialize path segments back into valid SVG 'd' string
 */
export function serializePathSegments(segments: PathSegment[], precision = 2): string {
  const parts: string[] = [];

  for (const s of segments) {
    if (s.type === 'M') {
      parts.push(`M${roundCoord(s.x, precision)} ${roundCoord(s.y, precision)}`);
    } else if (s.type === 'L') {
      parts.push(`L${roundCoord(s.x, precision)} ${roundCoord(s.y, precision)}`);
    } else if (s.type === 'C') {
      parts.push(
        `C${roundCoord(s.cp1x ?? s.x, precision)} ${roundCoord(s.cp1y ?? s.y, precision)} ` +
        `${roundCoord(s.cp2x ?? s.x, precision)} ${roundCoord(s.cp2y ?? s.y, precision)} ` +
        `${roundCoord(s.x, precision)} ${roundCoord(s.y, precision)}`
      );
    } else if (s.type === 'Z') {
      parts.push('Z');
    }
  }

  return parts.join(' ');
}

const UNSUPPORTED_COMMANDS = /[AaTt]/;

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

    const editable = !UNSUPPORTED_COMMANDS.test(rawD);
    const segments = editable ? parsePathSegments(rawD) : [];
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
