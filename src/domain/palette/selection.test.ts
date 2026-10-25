import { describe, expect, it } from 'vitest';
import { isBlendOf, mergeIndistinguishable, selectRealColors, toPaletteColors } from './selection';
import type { PaletteCandidate } from './colors';

const c = (hex: string, weight: number, a = 255): PaletteCandidate => {
  const n = parseInt(hex.slice(1), 16);
  return { hex, weight, rgb: { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a } };
};
const hexes = (list: PaletteCandidate[]) => list.map((p) => p.hex);

describe('mergeIndistinguishable', () => {
  it('folds JPEG variants of a colour into the larger one, adding their shares', () => {
    const merged = mergeIndistinguishable([c('#f7fbfe', 0.711), c('#fbfcfd', 0.022), c('#f39f0d', 0.156), c('#f89b12', 0.013)]);
    expect(hexes(merged)).toEqual(['#f7fbfe', '#f39f0d']);
    expect(merged[0].weight).toBeCloseTo(0.733);
    expect(merged[1].weight).toBeCloseTo(0.169);
  });

  it('keeps distinct design colours apart (the closest pair in the tech logo)', () => {
    expect(hexes(mergeIndistinguishable([c('#06b6d4', 0.1), c('#38bdf8', 0.1)]))).toHaveLength(2);
  });

  it('does not modify its input', () => {
    const input = [c('#f7fbfe', 0.7), c('#fbfcfd', 0.02)];
    mergeIndistinguishable(input);
    expect(input[0].weight).toBe(0.7);
  });
});

describe('isBlendOf', () => {
  const white = c('#ffffff', 0.7);
  const navy = c('#1e1b4b', 0.25);

  it('recognises an anti-aliasing blend between two larger colours', () => {
    expect(isBlendOf(c('#8e8da5', 0.01), [white, navy])).toBe(true);
  });

  it('keeps a colour that is off the line between them', () => {
    expect(isBlendOf(c('#e11d48', 0.01), [white, navy])).toBe(false);
  });

  it('keeps a colour too large to be fringe', () => {
    expect(isBlendOf(c('#8e8da5', 0.2), [white, navy])).toBe(false);
  });
});

describe('selectRealColors', () => {
  it('drops tiny shares, blends and transparent pixels', () => {
    const found = [c('#ffffff', 0.7), c('#1e1b4b', 0.25), c('#8e8da5', 0.01), c('#123456', 0.001), c('#000000', 0.3, 0)];
    expect(hexes(selectRealColors(found))).toEqual(['#ffffff', '#1e1b4b']);
  });

  it('keeps two colours for a nearly flat image', () => {
    expect(hexes(selectRealColors([c('#ffffff', 0.999), c('#fefefe', 0.001)]))).toEqual(['#ffffff', '#fefefe']);
  });
});

describe('toPaletteColors', () => {
  it('reports pixel counts and whole percentages', () => {
    expect(toPaletteColors([c('#ff0000', 0.256)], 1000)).toEqual([{ hex: '#ff0000', r: 255, g: 0, b: 0, a: 255, count: 256, percentage: 26 }]);
  });
});
