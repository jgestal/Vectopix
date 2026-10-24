import { parsePathSegments, serializePathSegments, type PathSegment } from '../utils/pathParser';

/**
 * Geometric clean-up of traced SVG paths, potrace-style.
 *
 * A tracer that follows anti-aliased pixel boundaries describes a straight
 * edge as a chain of slightly wobbling curves and rounds every corner it is
 * not sure about. This pass re-derives the structure of each outline: it
 * resamples the boundary, finds the real corners (sharp turns over a short
 * distance, which a circle never has), and refits every stretch between two
 * corners as a single straight line when it is one, or as as few Bézier
 * curves as the tolerance allows when it is not. Where two lines meet, the
 * corner is moved to their exact intersection. Slivers of anti-aliasing
 * fringe that became their own thin regions are dropped.
 *
 * Pure string-in, string-out: no DOM, so it runs inside the Web Worker.
 */

export interface RefineOptions {
  /** Max distance (px) of the boundary from a chord for it to become one straight line. */
  lineTolerance?: number;
  /** Max fitting error (px) for curved stretches. */
  curveTolerance?: number;
  /** Direction change (degrees) over `cornerSpan` px that marks a corner. */
  cornerAngle?: number;
  /** Arc length (px) on each side used to measure the direction change. */
  cornerSpan?: number;
  /** Subpaths thinner than this (2·area / perimeter, px) are fringe and dropped. */
  minThickness?: number;
}

const DEFAULTS: Required<RefineOptions> = {
  lineTolerance: 1.25,
  curveTolerance: 0.8,
  cornerAngle: 40,
  cornerSpan: 3,
  minThickness: 1.25,
};

type Pt = { x: number; y: number };

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

function distToChord(p: Pt, a: Pt, b: Pt): number {
  const d = sub(b, a);
  const l = len(d);
  if (l < 1e-9) return len(sub(p, a));
  return Math.abs((p.x - a.x) * d.y - (p.y - a.y) * d.x) / l;
}

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Split absolute segments into closed subpaths (each starting with M). */
function splitSubpaths(segments: PathSegment[]): PathSegment[][] {
  const out: PathSegment[][] = [];
  for (const s of segments) {
    if (s.type === 'M') out.push([s]);
    else if (out.length) out[out.length - 1].push(s);
  }
  return out;
}

/** Minimum tangent turn (°) at one of the tracer's own vertices for it to count as a corner. */
const TRACER_CORNER_TURN = 45;

/**
 * The outline as a closed polyline, roughly one point per pixel of arc length,
 * plus the tracer's own vertices where the tangent jumps. The tracer splits
 * outlines where regions meet, so those are the exact, shared corner positions.
 */
function sampleSubpath(segs: PathSegment[]): { pts: Pt[]; tracerCorners: Pt[] } {
  const pts: Pt[] = [];
  let cur: Pt = { x: segs[0].x, y: segs[0].y };
  pts.push(cur);
  // Direction leaving / arriving at each segment end, to measure tangent jumps
  const tangents: { start: Pt; end: Pt; at: Pt }[] = [];
  for (const s of segs.slice(1)) {
    const end = { x: s.x, y: s.y };
    if (s.type !== 'Z' && len(sub(end, cur)) > 1e-9) {
      const c1 = s.type === 'C' ? { x: s.cp1x ?? cur.x, y: s.cp1y ?? cur.y } : end;
      const c2 = s.type === 'C' ? { x: s.cp2x ?? end.x, y: s.cp2y ?? end.y } : cur;
      const startDir = norm(sub(len(sub(c1, cur)) > 1e-9 ? c1 : end, cur));
      const endDir = norm(sub(end, len(sub(end, c2)) > 1e-9 ? c2 : cur));
      tangents.push({ start: startDir, end: endDir, at: end });
    }
    if (s.type === 'C') {
      const c1 = { x: s.cp1x ?? cur.x, y: s.cp1y ?? cur.y };
      const c2 = { x: s.cp2x ?? end.x, y: s.cp2y ?? end.y };
      const approx = len(sub(c1, cur)) + len(sub(c2, c1)) + len(sub(end, c2));
      const n = Math.max(2, Math.ceil(approx));
      for (let i = 1; i <= n; i++) pts.push(bezier(cur, c1, c2, end, i / n));
    } else {
      const n = Math.max(1, Math.ceil(len(sub(end, cur))));
      for (let i = 1; i <= n; i++) pts.push(add(cur, mul(sub(end, cur), i / n)));
    }
    cur = end;
  }
  // Closed: drop the repeated start point
  if (pts.length > 1 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts.pop();

  const tracerCorners: Pt[] = [];
  for (let i = 0; i < tangents.length; i++) {
    const next = tangents[(i + 1) % tangents.length];
    const turn = (Math.acos(Math.max(-1, Math.min(1, dot(tangents[i].end, next.start)))) * 180) / Math.PI;
    if (turn >= TRACER_CORNER_TURN) tracerCorners.push(tangents[i].at);
  }
  return { pts, tracerCorners };
}

/** Resample a closed polyline at uniform arc-length spacing. */
function resampleClosed(pts: Pt[], spacing = 1): Pt[] {
  const n = pts.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += len(sub(pts[(i + 1) % n], pts[i]));
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out: Pt[] = [];
  let seg = 0;
  let segStart = 0;
  let segLen = len(sub(pts[1 % n], pts[0]));
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (segStart + segLen < target && seg < n - 1) {
      segStart += segLen;
      seg++;
      segLen = len(sub(pts[(seg + 1) % n], pts[seg]));
    }
    const t = segLen < 1e-12 ? 0 : (target - segStart) / segLen;
    out.push(add(pts[seg], mul(sub(pts[(seg + 1) % n], pts[seg]), Math.min(1, Math.max(0, t)))));
  }
  return out;
}

function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Non-maximum suppression: keep each candidate only if no stronger one lies within ±radius. */
function localMaxima(scores: number[], radius: number): number[] {
  const n = scores.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (scores[i] <= 0) continue;
    let isMax = true;
    for (let k = -radius; k <= radius && isMax; k++) {
      if (k === 0) continue;
      const j = (((i + k) % n) + n) % n;
      if (scores[j] > scores[i] || (scores[j] === scores[i] && j < i)) isMax = false;
    }
    if (isMax) out.push(i);
  }
  return out;
}

/**
 * Corners of a closed, uniformly sampled outline, from two detectors:
 *  - sharp turns: the direction changes by more than `minAngleDeg` over ±span px;
 *  - line meetings: the outline is straight on both sides (skipping a few px
 *    next to the point, where tracers round corners off) and the two lines meet
 *    at an angle. A circle is never straight on both sides, so it never fires.
 */
function findCorners(pts: Pt[], span: number, minAngleDeg: number): number[] {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  const angleBetween = (a: Pt, b: Pt) => (Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180) / Math.PI;

  const sharp = pts.map((_, i) => {
    const a = angleBetween(sub(at(i), at(i - span)), sub(at(i + span), at(i)));
    return a >= minAngleDeg ? a : 0;
  });

  const GAP = 4;
  const WINDOW = 12;
  const STRAIGHT = 0.25;
  const MIN_LINE_ANGLE = 20;
  const lineMeet = pts.map((_, i) => {
    if (n < 2 * (GAP + WINDOW) + 4) return 0;
    const before: Pt[] = [];
    const after: Pt[] = [];
    for (let k = GAP; k < GAP + WINDOW; k++) {
      before.push(at(i - k));
      after.push(at(i + k));
    }
    const lb = fitLine(before);
    const la = fitLine(after);
    const residual = (pts2: Pt[], l: { p: Pt; d: Pt }) => Math.max(...pts2.map((p) => distToChord(p, l.p, add(l.p, l.d))));
    if (residual(before, lb) > STRAIGHT || residual(after, la) > STRAIGHT) return 0;
    // Orient each fitted line along the direction of travel before comparing
    const db = dot(lb.d, sub(before[0], before[before.length - 1])) < 0 ? mul(lb.d, -1) : lb.d;
    const da = dot(la.d, sub(after[after.length - 1], after[0])) < 0 ? mul(la.d, -1) : la.d;
    const a = angleBetween(db, da);
    return a >= MIN_LINE_ANGLE ? a : 0;
  });

  const found = new Set([...localMaxima(sharp, span), ...localMaxima(lineMeet, GAP + 2)]);
  // Two detectors can fire a few px apart on the same corner: keep the first
  const sorted = [...found].sort((a, b) => a - b);
  return sorted.filter((c, i) => i === 0 || c - sorted[i - 1] > GAP);
}

/** Total-least-squares line through points: a point on it and its direction. */
function fitLine(pts: Pt[]): { p: Pt; d: Pt } {
  const c = mul(
    pts.reduce((s, p) => add(s, p), { x: 0, y: 0 }),
    1 / pts.length
  );
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const q = sub(p, c);
    sxx += q.x * q.x;
    sxy += q.x * q.y;
    syy += q.y * q.y;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: c, d: { x: Math.cos(angle), y: Math.sin(angle) } };
}

function intersect(l1: { p: Pt; d: Pt }, l2: { p: Pt; d: Pt }): Pt | null {
  const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
  return add(l1.p, mul(l1.d, t));
}

/* ------------------------------------------------------------------------
   Circular arcs: a curved stretch that is really part of a circle is drawn
   from the fitted circle, so neighbouring stretches of one ring line up.
   --------------------------------------------------------------------- */

/** Algebraic (Kåsa) circle fit; null when the points are degenerate. */
function fitCircle(pts: Pt[]): { c: Pt; r: number; residual: number } | null {
  const m = mul(
    pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0 }),
    1 / pts.length
  );
  let suu = 0;
  let suv = 0;
  let svv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const p of pts) {
    const u = p.x - m.x;
    const v = p.y - m.y;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const bu = 0.5 * (suuu + suvv);
  const bv = 0.5 * (svvv + svuu);
  const uc = (bu * svv - bv * suv) / det;
  const vc = (suu * bv - suv * bu) / det;
  const c = { x: uc + m.x, y: vc + m.y };
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / pts.length);
  const residual = Math.max(...pts.map((p) => Math.abs(len(sub(p, c)) - r)));
  return { c, r, residual };
}

/** Cubic pieces (≤ 90° each) of the arc from a to b around a circle, passing near `via`. */
function arcCubics(c: Pt, r: number, a: Pt, b: Pt, via: Pt): Cubic[] {
  const angle = (p: Pt) => Math.atan2(p.y - c.y, p.x - c.x);
  const TAU = Math.PI * 2;
  const wrap = (x: number) => ((x % TAU) + TAU) % TAU;
  const a0 = angle(a);
  const ccw = wrap(angle(b) - a0);
  // Sweep the way that passes through the middle of the traced stretch
  const sweep = wrap(angle(via) - a0) < ccw ? ccw : ccw - TAU;
  const count = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const onCircle = (t: number): Pt => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
  const tangent = (t: number): Pt => ({ x: -r * Math.sin(t), y: r * Math.cos(t) });
  const out: Cubic[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = a0 + i * step;
    const t1 = t0 + step;
    const p0 = i === 0 ? a : onCircle(t0);
    const p3 = i === count - 1 ? b : onCircle(t1);
    out.push([p0, add(onCircle(t0), mul(tangent(t0), k)), sub(onCircle(t1), mul(tangent(t1), k)), p3]);
  }
  return out;
}

/* ------------------------------------------------------------------------
   Cubic Bézier fitting (Schneider, "An Algorithm for Automatically Fitting
   Digitized Curves", Graphics Gems 1990)
   --------------------------------------------------------------------- */

type Cubic = [Pt, Pt, Pt, Pt];

function chordParams(pts: Pt[]): number[] {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}

function generateBezier(pts: Pt[], u: number[], t1: Pt, t2: Pt): Cubic {
  const first = pts[0];
  const last = pts[pts.length - 1];
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i];
    const b1 = 3 * t * (1 - t) * (1 - t);
    const b2 = 3 * t * t * (1 - t);
    const a1 = mul(t1, b1);
    const a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const b0 = (1 - t) ** 3;
    const b3 = t ** 3;
    const tmp = sub(pts[i], add(mul(first, b0 + b1), mul(last, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const segLen = len(sub(last, first));
  let alpha1 = Math.abs(det) > 1e-12 ? (x0 * c11 - x1 * c01) / det : 0;
  let alpha2 = Math.abs(det) > 1e-12 ? (c00 * x1 - c01 * x0) / det : 0;
  // Fall back to the classic heuristic when the solution is degenerate
  if (alpha1 < 1e-6 * segLen || alpha2 < 1e-6 * segLen) {
    alpha1 = alpha2 = segLen / 3;
  }
  return [first, add(first, mul(t1, alpha1)), add(last, mul(t2, alpha2)), last];
}

function maxError(pts: Pt[], u: number[], c: Cubic): { error: number; index: number } {
  let error = 0;
  let index = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len(sub(bezier(c[0], c[1], c[2], c[3], u[i]), pts[i]));
    if (d > error) {
      error = d;
      index = i;
    }
  }
  return { error, index };
}

function reparameterize(pts: Pt[], u: number[], c: Cubic): number[] {
  return u.map((t, i) => {
    // One Newton-Raphson step on |B(t) - p|²
    const p = pts[i];
    const b = bezier(c[0], c[1], c[2], c[3], t);
    const d1 = add(
      add(mul(sub(c[1], c[0]), 3 * (1 - t) ** 2), mul(sub(c[2], c[1]), 6 * (1 - t) * t)),
      mul(sub(c[3], c[2]), 3 * t * t)
    );
    const d2 = add(mul(add(sub(c[2], mul(c[1], 2)), c[0]), 6 * (1 - t)), mul(add(sub(c[3], mul(c[2], 2)), c[1]), 6 * t));
    const diff = sub(b, p);
    const num = dot(diff, d1);
    const den = dot(d1, d1) + dot(diff, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.min(1, Math.max(0, t - num / den));
  });
}

function fitCubics(pts: Pt[], t1: Pt, t2: Pt, tolerance: number, depth = 0): Cubic[] {
  if (pts.length === 2) {
    const d = len(sub(pts[1], pts[0])) / 3;
    return [[pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]]];
  }
  let u = chordParams(pts);
  let c = generateBezier(pts, u, t1, t2);
  let { error, index } = maxError(pts, u, c);
  if (error <= tolerance) return [c];
  if (error <= tolerance * 4) {
    for (let i = 0; i < 4; i++) {
      u = reparameterize(pts, u, c);
      c = generateBezier(pts, u, t1, t2);
      ({ error, index } = maxError(pts, u, c));
      if (error <= tolerance) return [c];
    }
  }
  if (depth > 12 || pts.length < 4) return [c];
  index = Math.max(1, Math.min(pts.length - 2, index));
  const center = norm(sub(pts[index - 1], pts[index + 1]));
  return [
    ...fitCubics(pts.slice(0, index + 1), t1, center, tolerance, depth + 1),
    ...fitCubics(pts.slice(index), mul(center, -1), t2, tolerance, depth + 1),
  ];
}

/** Unit tangent at one end of a stretch, averaged over a few points. */
function endTangent(pts: Pt[], atStart: boolean): Pt {
  const k = Math.min(3, pts.length - 1);
  return atStart ? norm(sub(pts[k], pts[0])) : norm(sub(pts[pts.length - 1 - k], pts[pts.length - 1]));
}

type Piece = { kind: 'line'; pts: Pt[] } | { kind: 'curve'; pts: Pt[] };

/** Turns gentler than ARC_TURN_MAX (°) are corners only between straight edges of at least ARC_CHORD_MAX px. */
const ARC_CHORD_MAX = 30;
const ARC_TURN_MAX = 35;

/** Samples (≈ px) used to measure a stretch's direction next to a corner. */
const TANGENT_REACH = 5;

/** Samples (≈ px) at each end of a stretch ignored by the straightness test. */
const END_SKIP = 4;

/** Corner candidates closer than this (samples ≈ px) are the same corner. */
const CORNER_MERGE = 6;

/** Refit one closed outline. Returns null when it is fringe that should vanish. */
/**
 * Largest distance from the traced outline to its refit, as a share of the
 * outline's size (bounding-box diagonal) and within fixed bounds in px. Beyond
 * it the refit lost a feature (common on small images, where a tooth or a
 * notch is only a few px and reads as noise to the corner and line
 * detectors). On a large shape the trace itself bows up to ~2 px along long
 * straight edges (1.75 on the crest's top edge), which the refit is right to
 * straighten; on a 40 px icon the same 2 px is a feature.
 */
const DEVIATION_SHARE = 0.02;
const MIN_DEVIATION = 1.5;
const MAX_DEVIATION = 2.5;
/** …and from the refit to the traced outline: looser, as a corner snapped
 * sharp reaches past the tracer's rounded one. */
const MAX_OVERSHOOT = 3;

function distToPolygon(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const ab = sub(poly[i], a);
    const l2 = dot(ab, ab);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
    best = Math.min(best, len(sub(p, add(a, mul(ab, t)))));
  }
  return best;
}

function strays(from: Pt[], to: Pt[], limit: number): boolean {
  // Every other sample is plenty at 1 px spacing
  for (let i = 0; i < from.length; i += 2) if (distToPolygon(from[i], to) > limit) return true;
  return false;
}

/**
 * Refit one closed subpath; null if it is anti-aliasing fringe. A refit that
 * strays from the traced outline is rejected and the subpath kept as traced:
 * the clean-up may simplify, never change what is drawn.
 */
function refineSubpath(segs: PathSegment[], o: Required<RefineOptions>): PathSegment[] | null {
  const fitted = fitSubpath(segs, o);
  if (!fitted) return fitted;
  const traced = sampleSubpath(segs).pts;
  const refit = sampleSubpath(fitted).pts;
  const xs = traced.map((p) => p.x);
  const ys = traced.map((p) => p.y);
  const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const limit = Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, DEVIATION_SHARE * size));
  if (strays(traced, refit, limit) || strays(refit, traced, MAX_OVERSHOOT)) return segs;
  return fitted;
}

function fitSubpath(segs: PathSegment[], o: Required<RefineOptions>): PathSegment[] | null {
  const { pts: raw, tracerCorners } = sampleSubpath(segs);
  if (raw.length < 3) return null;
  const pts = resampleClosed(raw);
  const n = pts.length;

  let perimeter = 0;
  for (let i = 0; i < n; i++) perimeter += len(sub(pts[(i + 1) % n], pts[i]));
  if ((2 * polygonArea(pts)) / Math.max(perimeter, 1e-9) < o.minThickness) return null;

  const buildPieces = (cuts: number[]): Piece[] =>
    cuts.map((start, i) => {
      const end = cuts[(i + 1) % cuts.length];
      const stretch: Pt[] = [];
      for (let k = start; ; k = (k + 1) % n) {
        stretch.push(pts[k]);
        if (k === end && stretch.length > 1) break;
        if (stretch.length > n + 1) break;
      }
      // Straight if every point lies close to the best-fit line (not the chord:
      // the tracer may have rounded the ends, which drags the chord off the
      // edge). The few px at each end are skipped for the same reason; the
      // corner itself is placed afterwards at the intersection of the lines.
      const trim = stretch.length > 4 * END_SKIP ? END_SKIP : 1;
      const inner = stretch.length > 4 ? stretch.slice(trim, -trim) : stretch;
      const line = fitLine(inner);
      const straight = inner.every((p) => distToChord(p, line.p, add(line.p, line.d)) <= o.lineTolerance);
      return { kind: straight ? 'line' : 'curve', pts: stretch };
    });

  // Corners: the tracer's own sharp vertices (snapped onto the exact vertex),
  // plus what the geometric detectors find. Candidates a few px apart are one
  // corner; the tracer's is preferred because neighbouring regions share it.
  const nearestIndex = (p: Pt) => {
    let best = 0;
    for (let i = 1; i < n; i++) if (len(sub(pts[i], p)) < len(sub(pts[best], p))) best = i;
    return best;
  };
  const fromTracer = new Map<number, Pt>();
  for (const c of tracerCorners) {
    const i = nearestIndex(c);
    fromTracer.set(i, c);
    pts[i] = c;
  }
  const candidates = [...new Set([...fromTracer.keys(), ...findCorners(pts, o.cornerSpan, o.cornerAngle)])].sort((a, b) => a - b);
  let corners: number[] = [];
  for (const c of candidates) {
    const last = corners[corners.length - 1];
    const wrapsToFirst = corners.length > 0 && n - c + corners[0] <= CORNER_MERGE;
    if (last !== undefined && c - last <= CORNER_MERGE) {
      if (fromTracer.has(c) && !fromTracer.has(last)) corners[corners.length - 1] = c;
    } else if (wrapsToFirst) {
      if (fromTracer.has(c) && !fromTracer.has(corners[0])) corners[0] = c;
    } else {
      corners.push(c);
    }
  }
  corners.sort((a, b) => a - b);

  // A tracer often draws a small arc as a few short chords or kinked curves,
  // and a curve easing into a straight run can trip the corner detectors.
  // A gentle turn is only a real corner between two long straight edges (the
  // shallow peak of a shield); anywhere else the corner is dropped and the
  // stretch refitted as one smooth curve. Sharp turns always stay corners.
  if (corners.length > 2) {
    const pieces = buildPieces(corners);
    const chord = (pc: Piece) => len(sub(pc.pts[pc.pts.length - 1], pc.pts[0]));
    const reach = (pc: Piece) => Math.min(TANGENT_REACH, pc.pts.length - 1);
    const keep = corners.filter((_, i) => {
      const before = pieces[(i - 1 + pieces.length) % pieces.length];
      const after = pieces[i];
      const tb = norm(sub(before.pts[before.pts.length - 1], before.pts[before.pts.length - 1 - reach(before)]));
      const ta = norm(sub(after.pts[reach(after)], after.pts[0]));
      const turn = (Math.acos(Math.max(-1, Math.min(1, dot(tb, ta)))) * 180) / Math.PI;
      if (turn >= ARC_TURN_MAX) return true;
      return before.kind === 'line' && after.kind === 'line' && chord(before) >= ARC_CHORD_MAX && chord(after) >= ARC_CHORD_MAX;
    });
    if (keep.length !== corners.length) corners = keep;
  }

  // A loop without corners (a circle, a blob) is split in two smooth halves
  const cuts = corners.length ? corners : [0, Math.floor(n / 2)];
  const smoothJoins = corners.length === 0;
  const pieces = buildPieces(cuts);

  // Snap line-line corners to the exact intersection of the two fitted lines
  const cornerPts = cuts.map((c) => pts[c]);
  if (!smoothJoins) {
    const lines = pieces.map((p) => {
      if (p.kind !== 'line' || p.pts.length < 4) return null;
      const trim = p.pts.length > 4 * END_SKIP ? END_SKIP : 1;
      return fitLine(p.pts.slice(trim, -trim));
    });
    for (let i = 0; i < cuts.length; i++) {
      const before = lines[(i - 1 + cuts.length) % cuts.length];
      const after = lines[i];
      if (!before || !after) continue;
      const x = intersect(before, after);
      if (x && len(sub(x, cornerPts[i])) <= o.cornerSpan) cornerPts[i] = x;
    }
  }

  const out: PathSegment[] = [{ type: 'M', ...cornerPts[0] }];
  pieces.forEach((piece, i) => {
    const a = cornerPts[i];
    const b = cornerPts[(i + 1) % cuts.length];
    if (piece.kind === 'line') {
      // The closing line is drawn by Z itself
      if (i < pieces.length - 1) out.push({ type: 'L', ...b });
      return;
    }
    const stretch = [a, ...piece.pts.slice(1, -1), b];

    // Part of a circle? Draw it from the circle itself
    const circle = stretch.length >= 8 ? fitCircle(stretch) : null;
    // The traced data itself wobbles by about a pixel, so a larger circle may
    // stray a little further from it (4 % of the radius, at most 1.5 px)
    const circleTolerance = circle ? Math.max(o.curveTolerance, Math.min(1.5, 0.04 * circle.r)) : 0;
    if (circle && circle.residual <= circleTolerance && circle.r < 1e4) {
      for (const c of arcCubics(circle.c, circle.r, a, b, stretch[Math.floor(stretch.length / 2)])) {
        out.push({ type: 'C', cp1x: c[1].x, cp1y: c[1].y, cp2x: c[2].x, cp2y: c[2].y, x: c[3].x, y: c[3].y });
      }
      return;
    }

    // Smooth loops share one tangent across each join, so the seam doesn't kink
    const t1 = smoothJoins ? norm(sub(stretch[1], pieces[(i - 1 + pieces.length) % pieces.length].pts.at(-2)!)) : endTangent(stretch, true);
    const t2 = smoothJoins
      ? mul(norm(sub(pieces[(i + 1) % pieces.length].pts[1], stretch[stretch.length - 2])), -1)
      : endTangent(stretch, false);
    for (const c of fitCubics(stretch, t1, t2, o.curveTolerance)) {
      out.push({ type: 'C', cp1x: c[1].x, cp1y: c[1].y, cp2x: c[2].x, cp2y: c[2].y, x: c[3].x, y: c[3].y });
    }
  });
  out.push({ type: 'Z', ...cornerPts[0] });
  return out;
}

/** Refit one path's `d`. Returns null if every subpath was fringe. */
export function refinePathData(d: string, options: RefineOptions = {}): string | null {
  const o = { ...DEFAULTS, ...options };
  const subpaths = splitSubpaths(parsePathSegments(d))
    .map((s) => refineSubpath(s, o))
    .filter((s): s is PathSegment[] => s !== null);
  return subpaths.length ? serializePathSegments(subpaths.flat(), 2) : null;
}

/**
 * Refit every `<path>` of a traced SVG. Paths that turn out to be pure
 * anti-aliasing fringe are removed; every other element is left untouched.
 */
export function refineSvg(svg: string, options: RefineOptions = {}): string {
  return svg.replace(/<path\b[^>]*\/>/g, (element) => {
    const match = element.match(/\sd="([^"]*)"/);
    if (!match) return element;
    // The full-canvas background rectangle needs no refitting
    if (/^M0 0h\d+(\.\d+)?v\d+(\.\d+)?H0z$/.test(match[1])) return element;
    const refined = refinePathData(match[1], options);
    return refined === null ? '' : element.replace(match[0], ` d="${refined}"`);
  });
}
