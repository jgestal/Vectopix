/**
 * SVG path data (the `d` attribute): parsing into absolute segments and
 * compact serialization. Every command is supported; H/V become lines and
 * S, Q, T and arcs become cubics, so the rest of the app handles just M, L, C, Z.
 */

export interface PathSegment {
  type: 'M' | 'L' | 'C' | 'Z';
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
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
export function parsePathData(d: string): { segments: PathSegment[]; complete: boolean } {
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
