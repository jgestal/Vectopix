import type { Raster } from './raster';

/**
 * Pixel art: an image whose pixels are the drawing, laid out on a grid of
 * square cells (often scaled up, each cell a block of pixels). Its faithful
 * vectorization is that grid, square corners and all; a tracer made for
 * anti-aliased edges reads each step as a curve and wobbles.
 *
 * It is recognised by what anti-aliased art never has: every pixel exactly
 * one of a few colours (or fully transparent), with colour changes falling
 * on a regular grid.
 */

/** More distinct colours than this is not pixel art (photos, gradients, anti-aliasing). */
const MAX_COLOURS = 64;
/** Share of pixels that may be partly transparent (alpha anti-aliasing) and still pass. */
const MAX_SOFT_ALPHA = 0.001;
/** Up to this size (longest side), an image drawn one pixel per cell counts as pixel art. */
const NATIVE_SPRITE_MAX_SIDE = 128;
/** Share of colour changes made through a blended pixel above which the edges are anti-aliased. */
const MAX_BLENDED_EDGES = 0.1;

const EMPTY = -1;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Each pixel's colour as one number (EMPTY for transparent), or null if the
 * image has soft alpha or too many colours to be pixel art.
 */
function pixelColours({ width, height, data }: Raster): Int32Array | null {
  const colours = new Int32Array(width * height);
  const distinct = new Set<number>();
  let soft = 0;
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3];
    if (a !== 0 && a !== 255) soft++;
    colours[i] = a < 128 ? EMPTY : (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    distinct.add(colours[i]);
    if (distinct.size > MAX_COLOURS + 1) return null;
  }
  if (soft > MAX_SOFT_ALPHA * width * height || distinct.size < 2) return null;
  return colours;
}

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Whether `p` is a mix of `a` and `b`: on the segment between them, clearly apart from both. */
function isBlend(p: number, a: number, b: number): boolean {
  if (p === EMPTY || a === EMPTY || b === EMPTY) return false;
  const [pc, ac, bc] = [channels(p), channels(a), channels(b)];
  const d = [bc[0] - ac[0], bc[1] - ac[1], bc[2] - ac[2]];
  const span2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const rel = [pc[0] - ac[0], pc[1] - ac[1], pc[2] - ac[2]];
  const t = (rel[0] * d[0] + rel[1] * d[1] + rel[2] * d[2]) / span2;
  const off = Math.hypot(rel[0] - d[0] * t, rel[1] - d[1] * t, rel[2] - d[2] * t);
  return t > 0.05 && t < 0.95 && off < 12;
}

/** Anti-aliased: many of the colour changes along rows pass through a blended pixel. */
function isAntiAliased(colours: Int32Array, W: number, H: number): boolean {
  let changes = 0;
  let blended = 0;
  for (let y = 0; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const [a, p, b] = [colours[y * W + x - 1], colours[y * W + x], colours[y * W + x + 1]];
      if (a === b || p === a || p === b) continue;
      changes++;
      if (isBlend(p, a, b)) blended++;
    }
  return changes > 0 && blended / changes > MAX_BLENDED_EDGES;
}

/**
 * Greatest common divisor of the lengths of the runs of one colour along a
 * line, leaving out the runs that touch either end (the grid may start
 * anywhere). 0 if there are none.
 */
function interiorRunGcd(length: number, colourAt: (i: number) => number): number {
  let result = 0;
  let runStart = 0;
  for (let i = 1; i <= length; i++) {
    if (i < length && colourAt(i) === colourAt(i - 1)) continue;
    if (runStart > 0 && i < length) result = gcd(result, i - runStart);
    runStart = i;
  }
  return result;
}

/** The side of the image's cells in px, or null if it is not drawn on a grid of flat colours. */
export function pixelArtCellSize(raster: Raster): number | null {
  const colours = pixelColours(raster);
  if (!colours) return null;
  const { width: W, height: H } = raster;
  if (isAntiAliased(colours, W, H)) return null;
  let cell = 0;
  for (let y = 0; y < H; y++) cell = gcd(cell, interiorRunGcd(W, (x) => colours[y * W + x]));
  for (let x = 0; x < W; x++) cell = gcd(cell, interiorRunGcd(H, (y) => colours[y * W + x]));
  return cell || null;
}

export function isPixelArt(raster: Raster): boolean {
  const cell = pixelArtCellSize(raster);
  if (cell === null) return false;
  return cell >= 2 || Math.max(raster.width, raster.height) <= NATIVE_SPRITE_MAX_SIDE;
}
