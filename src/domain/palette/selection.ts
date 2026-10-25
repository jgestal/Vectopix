import { oklabDistance, type PaletteCandidate } from './colors';
import type { PaletteColor } from '../types';

/**
 * Which of the colours found in an image are its real colours.
 *
 * A quantizer reports every cluster it finds, including the blended pixels of
 * anti-aliased edges and, in a JPEG, a cloud of near-identical shades around
 * each flat colour. Traced as colours of their own, these become ghost
 * outlines and specks; and they take palette slots that real colours need.
 */

/**
 * A colour must cover at least this share of the image to count as one of its
 * real colours. Anti-aliasing blends between two colours stay far below it
 * (≤ 0.4 % on the samples) while the smallest real colour covers ≥ 1 %.
 */
export const REAL_COLOUR_MIN_SHARE = 0.004;
/**
 * Colours closer than this in Oklab (about two just-noticeable differences)
 * are one colour. JPEG splits each flat colour into near-identical variants
 * (≤ 0.032 apart on the samples); distinct design colours sit ≥ 0.057 apart.
 */
export const SAME_COLOUR_OKLAB = 0.04;
/** Pixels below this alpha are empty (a PNG's transparent background), not a colour. */
const OPAQUE_ALPHA = 128;

export const isOpaque = (c: PaletteCandidate) => c.rgb.a >= OPAQUE_ALPHA;

/** Fold indistinguishable variants into the larger one: their shares add up. */
export function mergeIndistinguishable(candidates: PaletteCandidate[]): PaletteCandidate[] {
  const merged: PaletteCandidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.weight - a.weight)) {
    const same = merged.find((m) => oklabDistance(m.rgb, candidate.rgb) < SAME_COLOUR_OKLAB);
    if (same) same.weight += candidate.weight;
    else merged.push({ ...candidate });
  }
  return merged;
}

/** Where `c` sits on the segment between `a` and `b` (0–1), and how far off it (in RGB units). */
function projectOnSegment(c: PaletteCandidate, a: PaletteCandidate, b: PaletteCandidate) {
  const d = [b.rgb.r - a.rgb.r, b.rgb.g - a.rgb.g, b.rgb.b - a.rgb.b];
  const span = Math.hypot(d[0], d[1], d[2]);
  const rel = [c.rgb.r - a.rgb.r, c.rgb.g - a.rgb.g, c.rgb.b - a.rgb.b];
  const t = span ? (rel[0] * d[0] + rel[1] * d[1] + rel[2] * d[2]) / (span * span) : 0;
  const off = Math.hypot(rel[0] - d[0] * t, rel[1] - d[1] * t, rel[2] - d[2] * t);
  return { span, t, off };
}

/**
 * Anti-aliasing fringe: a colour lying between two larger, clearly different
 * colours (a mix of them) that covers clearly less than either. On small
 * images the fringe can cover several percent, so its share alone does not
 * give it away.
 */
function isBlendOfPair(c: PaletteCandidate, a: PaletteCandidate, b: PaletteCandidate): boolean {
  if (c.weight > 0.5 * Math.min(a.weight, b.weight)) return false;
  const { span, t, off } = projectOnSegment(c, a, b);
  return span >= 40 && t > 0.05 && t < 0.95 && off <= 0.08 * span;
}

export function isBlendOf(c: PaletteCandidate, larger: PaletteCandidate[]): boolean {
  return larger.some((a, i) => larger.slice(i + 1).some((b) => isBlendOfPair(c, a, b)));
}

/**
 * The image's real colours, largest first. If fewer than two survive (a
 * nearly flat image), the two largest opaque colours are used: a trace needs
 * a figure and a ground.
 */
export function selectRealColors(found: PaletteCandidate[]): PaletteCandidate[] {
  const opaque = found.filter(isOpaque).sort((a, b) => b.weight - a.weight);
  const real: PaletteCandidate[] = [];
  for (const candidate of mergeIndistinguishable(opaque)) {
    if (candidate.weight >= REAL_COLOUR_MIN_SHARE && !isBlendOf(candidate, real)) real.push(candidate);
  }
  return real.length >= 2 ? real : opaque.slice(0, 2);
}

/** The palette as the UI shows it: pixel counts and whole percentages. */
export function toPaletteColors(palette: PaletteCandidate[], pixels: number): PaletteColor[] {
  return palette.map((p) => ({
    hex: p.hex,
    ...p.rgb,
    count: Math.round(p.weight * pixels),
    percentage: Math.round(p.weight * 100),
  }));
}
