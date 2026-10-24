import { describe, expect, it } from 'vitest';
import { tracePixelGrid } from './pixelTrace';

const RED = { rgb: { r: 255, g: 0, b: 0 }, hex: '#f00' };
const BLACK = { rgb: { r: 0, g: 0, b: 0 }, hex: '#000' };

/** Raster from rows of characters: R red, K black, . transparent. */
function raster(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const px = ch === 'R' ? [255, 0, 0, 255] : ch === 'K' ? [0, 0, 0, 255] : [0, 0, 0, 0];
      data.set(px, (y * width + x) * 4);
    })
  );
  return { width, height, data };
}

const pathOf = (svg: string, hex: string) => svg.match(new RegExp(`d="([^"]*)" fill="${hex}"`))?.[1];

describe('tracePixelGrid', () => {
  it('outlines a block exactly on the pixel grid', () => {
    const { svg } = tracePixelGrid(raster(['....', '.RR.', '.RR.', '....']), [RED]);
    expect(pathOf(svg, '#f00')).toBe('M1 1H3V3H1Z');
  });

  it('keeps only straight runs and square corners', () => {
    const { svg } = tracePixelGrid(raster(['RRRR', 'RRRR', 'RR..', 'RR..']), [RED]);
    expect(pathOf(svg, '#f00')).toBe('M0 0H4V2H2V4H0Z');
  });

  it('keeps blocks that touch at a corner as separate loops', () => {
    const { svg, regions } = tracePixelGrid(raster(['R.', '.R']), [RED]);
    expect(regions).toBe(2);
    expect(pathOf(svg, '#f00')).toBe('M0 0H1V1H0ZM1 1H2V2H1Z');
  });

  it('extends the colour painted first half a pixel under its neighbours', () => {
    const { svg } = tracePixelGrid(raster(['RRRK', 'RRRK']), [RED, BLACK]);
    // Red is larger, so it is painted first and reaches under the black column
    expect(svg.indexOf('#f00')).toBeLessThan(svg.indexOf('#000'));
    expect(pathOf(svg, '#f00')).toBe('M0 0H3.5V2H0Z');
    expect(pathOf(svg, '#000')).toBe('M3 0H4V2H3Z');
  });

  it('leaves transparent pixels out', () => {
    const { svg, shapes } = tracePixelGrid(raster(['..', '..']), [RED]);
    expect(shapes).toBe(0);
    expect(svg).not.toContain('<path');
  });
});
