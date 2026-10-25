import { describe, expect, it } from 'vitest';
import { isPixelArt, pixelArtCellSize } from './pixelArt';
import type { Raster } from './raster';

type Rgba = [number, number, number, number];
const WHITE: Rgba = [255, 255, 255, 255];
const RED: Rgba = [239, 68, 68, 255];
const BLACK: Rgba = [28, 25, 23, 255];
const EMPTY: Rgba = [0, 0, 0, 0];

function raster(width: number, height: number, pixel: (x: number, y: number) => Rgba): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}

/** A sprite drawn on a grid of `cell`-px blocks, placed at an offset that is not a multiple of the cell. */
const SPRITE = ['..KK..KK..', '.KRRKKRRK.', 'KRRRRRRRRK', '.KRRRRRRK.', '..KRRRRK..', '...KRRK...', '....KK....'];
function sprite(cell: number, background: Rgba = WHITE, offset = 3): Raster {
  const size = SPRITE[0].length * cell + 2 * offset;
  return raster(size, size, (x, y) => {
    const ch = SPRITE[Math.floor((y - offset) / cell)]?.[Math.floor((x - offset) / cell)];
    return ch === 'K' ? BLACK : ch === 'R' ? RED : background;
  });
}

/** A disc with hard edges (no anti-aliasing): flat colours, but no grid. */
const hardDisc = (size: number) => raster(size, size, (x, y) => (Math.hypot(x - size / 2, y - size / 2) < size / 3 ? RED : WHITE));

/** The same disc anti-aliased: blended edge pixels in many shades. */
const smoothDisc = (size: number) =>
  raster(size, size, (x, y) => {
    const cover = Math.max(0, Math.min(1, size / 3 - Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) + 0.5));
    const mix = (a: number, b: number) => Math.round(a * cover + b * (1 - cover));
    return [mix(RED[0], 255), mix(RED[1], 255), mix(RED[2], 255), 255];
  });

describe('pixel art detection', () => {
  it('recognises upscaled pixel art and its cell size, wherever the grid starts', () => {
    expect(pixelArtCellSize(sprite(10))).toBe(10);
    expect(isPixelArt(sprite(10))).toBe(true);
    expect(isPixelArt(sprite(4, WHITE, 0))).toBe(true);
  });

  it('recognises a small sprite drawn one pixel per cell', () => {
    expect(isPixelArt(sprite(1))).toBe(true);
  });

  it('recognises pixel art on a transparent background', () => {
    expect(isPixelArt(sprite(8, EMPTY))).toBe(true);
  });

  it('rejects anti-aliased artwork', () => {
    expect(isPixelArt(smoothDisc(64))).toBe(false);
    expect(isPixelArt(smoothDisc(400))).toBe(false);
  });

  it('rejects large hard-edged shapes with no grid (a circle should stay a circle)', () => {
    expect(isPixelArt(hardDisc(400))).toBe(false);
  });

  it('rejects images with too many colours, like photos', () => {
    expect(isPixelArt(raster(64, 64, (x, y) => [x * 4, y * 4, (x + y) * 2, 255]))).toBe(false);
  });

  it('rejects a plain image with nothing on it', () => {
    expect(isPixelArt(raster(32, 32, () => WHITE))).toBe(false);
  });
});
