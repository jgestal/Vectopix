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

/** An elliptical arc in centre form: what the cubic approximation is built from. */
interface CenterArc {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  cos: number;
  sin: number;
  /** Start angle and signed sweep (radians). */
  theta1: number;
  delta: number;
}

const vectorAngle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

/** Endpoint to centre parameterisation, as in the SVG spec (appendix F.6.5). */
function arcCenter(x1: number, y1: number, rx: number, ry: number, rotationDeg: number, largeArc: boolean, sweep: boolean, x2: number, y2: number): CenterArc {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotationDeg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [dx, dy] = [(x1 - x2) / 2, (y1 - y2) / 2];
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

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  const delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  // The sweep flag picks the direction; the large-arc flag already picked the centre
  const signed = !sweep && delta > 0 ? delta - 2 * Math.PI : sweep && delta < 0 ? delta + 2 * Math.PI : delta;
  return {
    cx: cos * cxp - sin * cyp + (x1 + x2) / 2,
    cy: sin * cxp + cos * cyp + (y1 + y2) / 2,
    rx,
    ry,
    cos,
    sin,
    theta1,
    delta: signed,
  };
}

/** Cubics of at most 90° each along a centre-form arc, ending exactly at `end`. */
function centerArcToCubics({ cx, cy, rx, ry, cos, sin, theta1, delta }: CenterArc, end: { x: number; y: number }): PathSegment[] {
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
  return Array.from({ length: count }, (_, i): PathSegment => {
    const t1 = theta1 + i * step;
    const t2 = t1 + step;
    const a = point(t1);
    const da = tangent(t1);
    const b = i === count - 1 ? end : point(t2);
    const db = tangent(t2);
    return { type: 'C', cp1x: a.x + k * da.x, cp1y: a.y + k * da.y, cp2x: b.x - k * db.x, cp2y: b.y - k * db.y, x: b.x, y: b.y };
  });
}

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
  return centerArcToCubics(arcCenter(x1, y1, rx, ry, rotationDeg, largeArc, sweep, x2, y2), { x: x2, y: y2 });
}

/**
 * Parse an SVG path 'd' attribute into normalized absolute segments.
 * Every command is supported: H/V become lines; S, Q, T and arcs become cubics.
 */
export function parsePathSegments(d: string): PathSegment[] {
  return parsePathData(d).segments;
}

type Pt = { x: number; y: number };

const SEPARATORS = new Set([',', ' ', '\n', '\t', '\r']);

/** Reads numbers, flags and command letters from path data, left to right. */
class PathReader {
  private pos = 0;
  private readonly d: string;

  constructor(d: string) {
    this.d = d;
  }

  skipSeparators(): void {
    while (this.pos < this.d.length && SEPARATORS.has(this.d[this.pos])) this.pos++;
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.pos >= this.d.length;
  }

  /** The command letter here, consumed; null if the next token is a number. */
  command(): string | null {
    this.skipSeparators();
    const c = this.d[this.pos];
    if (!c || !/[a-zA-Z]/.test(c)) return null;
    this.pos++;
    return c;
  }

  number(): number | null {
    this.skipSeparators();
    NUMBER.lastIndex = this.pos;
    const match = NUMBER.exec(this.d);
    if (!match) return null;
    this.pos = NUMBER.lastIndex;
    return parseFloat(match[0]);
  }

  /** Arc flags are single digits and may be packed without separators ("011"). */
  flag(): boolean | null {
    this.skipSeparators();
    const c = this.d[this.pos];
    if (c !== '0' && c !== '1') return null;
    this.pos++;
    return c === '1';
  }

  numbers(count: number): number[] | null {
    const out: number[] = [];
    for (let k = 0; k < count; k++) {
      const n = this.number();
      if (n === null) return null;
      out.push(n);
    }
    return out;
  }

  /** A point, relative to `origin` (0,0 for absolute commands). */
  point(origin: Pt): Pt | null {
    const n = this.numbers(2);
    return n && { x: origin.x + n[0], y: origin.y + n[1] };
  }
}

interface ParseState {
  segments: PathSegment[];
  cur: Pt;
  /** Start of the current subpath, where Z returns. */
  start: Pt;
  /** Control points of the previous cubic / quadratic, for S and T reflection. */
  lastCubic: Pt | null;
  lastQuad: Pt | null;
}

/** What a command leaves for the next one to reflect; null when its data was malformed. */
type CommandResult = { cubic?: Pt; quad?: Pt } | null;
type CommandHandler = (state: ParseState, reader: PathReader, origin: Pt) => CommandResult;

/** `p` mirrored through the current point (S and T reuse the previous control point this way). */
const reflect = (p: Pt | null, cur: Pt): Pt => (p ? { x: 2 * cur.x - p.x, y: 2 * cur.y - p.y } : cur);

function lineTo(state: ParseState, to: Pt): CommandResult {
  state.segments.push({ type: 'L', ...to });
  state.cur = to;
  return {};
}

function quadTo(state: ParseState, control: Pt, to: Pt): CommandResult {
  state.segments.push(quadToCubic(state.cur.x, state.cur.y, control.x, control.y, to.x, to.y));
  state.cur = to;
  return { quad: control };
}

function cubicTo(state: ParseState, cp1: Pt, cp2: Pt, to: Pt): CommandResult {
  state.segments.push({ type: 'C', cp1x: cp1.x, cp1y: cp1.y, cp2x: cp2.x, cp2y: cp2.y, ...to });
  state.cur = to;
  return { cubic: cp2 };
}

/** One handler per command letter (upper case; relative commands pass their origin). */
const COMMANDS: Record<string, CommandHandler> = {
  Z(state) {
    state.segments.push({ type: 'Z', ...state.start });
    state.cur = state.start;
    return {};
  },
  M(state, reader, origin) {
    const to = reader.point(origin);
    if (!to) return null;
    state.segments.push({ type: 'M', ...to });
    state.cur = state.start = to;
    return {};
  },
  L: (state, reader, origin) => {
    const to = reader.point(origin);
    return to && lineTo(state, to);
  },
  H: (state, reader, origin) => {
    const x = reader.number();
    return x === null ? null : lineTo(state, { x: origin.x + x, y: state.cur.y });
  },
  V: (state, reader, origin) => {
    const y = reader.number();
    return y === null ? null : lineTo(state, { x: state.cur.x, y: origin.y + y });
  },
  C: (state, reader, origin) => {
    const [cp1, cp2, to] = [reader.point(origin), reader.point(origin), reader.point(origin)];
    return cp1 && cp2 && to && cubicTo(state, cp1, cp2, to);
  },
  S: (state, reader, origin) => {
    const [cp2, to] = [reader.point(origin), reader.point(origin)];
    return cp2 && to && cubicTo(state, reflect(state.lastCubic, state.cur), cp2, to);
  },
  Q: (state, reader, origin) => {
    const [control, to] = [reader.point(origin), reader.point(origin)];
    return control && to && quadTo(state, control, to);
  },
  T: (state, reader, origin) => {
    const to = reader.point(origin);
    return to && quadTo(state, reflect(state.lastQuad, state.cur), to);
  },
  A: (state, reader, origin) => {
    const radii = reader.numbers(3);
    const largeArc = reader.flag();
    const sweep = reader.flag();
    const to = reader.point(origin);
    if (!radii || largeArc === null || sweep === null || !to) return null;
    state.segments.push(...arcToCubics(state.cur.x, state.cur.y, radii[0], radii[1], radii[2], largeArc, sweep, to.x, to.y));
    state.cur = to;
    return {};
  },
};

/** After M, further coordinate pairs are implicit lineTo; after Z a new command must follow. */
const IMPLICIT_NEXT: Record<string, string> = { M: 'L', m: 'l', Z: '', z: '' };
const commandForNextNumbers = (cmd: string) => IMPLICIT_NEXT[cmd] ?? cmd;

/** Like {@link parsePathSegments}, also reporting whether all of `d` was valid. */
export function parsePathData(d: string): { segments: PathSegment[]; complete: boolean } {
  const reader = new PathReader(d);
  const state: ParseState = { segments: [], cur: { x: 0, y: 0 }, start: { x: 0, y: 0 }, lastCubic: null, lastQuad: null };
  // A command letter applies to the coordinates after it until the next letter
  let cmd = '';

  while (!reader.atEnd()) {
    cmd = reader.command() ?? cmd;
    const handler = COMMANDS[cmd.toUpperCase()];
    // Unknown command, or numbers with no command: stop rather than misread the rest
    if (!handler) break;
    const isRelative = cmd !== cmd.toUpperCase();
    const result = handler(state, reader, isRelative ? state.cur : { x: 0, y: 0 });
    if (!result) break;
    state.lastCubic = result.cubic ?? null;
    state.lastQuad = result.quad ?? null;
    cmd = commandForNextNumbers(cmd);
  }

  return { segments: state.segments, complete: reader.atEnd() };
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
