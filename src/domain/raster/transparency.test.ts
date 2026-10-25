import { describe, expect, it } from 'vitest';
import { hasTransparentBorder } from './transparency';

function image(size: number, pixel: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set(pixel(x, y), (y * size + x) * 4);
  return { width: size, height: size, data };
}

describe('hasTransparentBorder', () => {
  it('is true for a cut-out: a subject on empty pixels', () => {
    expect(hasTransparentBorder(image(20, (x, y) => (x > 5 && x < 15 && y > 5 && y < 15 ? [200, 0, 0, 255] : [0, 0, 0, 0])))).toBe(true);
  });

  it('is false for an opaque image, even with a white background', () => {
    expect(hasTransparentBorder(image(20, () => [255, 255, 255, 255]))).toBe(false);
  });

  it('is false when only a little of the border is transparent', () => {
    expect(hasTransparentBorder(image(20, (x) => (x === 0 ? [0, 0, 0, 0] : [255, 255, 255, 255])))).toBe(false);
  });
});
