import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { DEFAULT_OPTIONS } from '../domain/presets';

import type { VectorOptions } from '../domain/types';
import { parsePathSegments } from '../domain/geometry/pathData';

// The vectorization use case wired to the real vecline / ImageTracerJS adapters
const engine = createEngine();
const vectorizeRaster = engine.vectorizer.vectorize.bind(engine.vectorizer);
const measureSsim = engine.similarity.ssim.bind(engine.similarity);

/** 64×64 white image with a red disc in the middle. */
function discRaster() {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = (x - 32) ** 2 + (y - 32) ** 2 < 400;
      data.set(inside ? [220, 30, 30, 255] : [255, 255, 255, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/**
 * 120×120 white image with a navy square whose edges sit between pixels, so
 * the border is a ring of anti-aliased blends: the tracer's classic trap.
 */
function antialiasedSquare() {
  const size = 120;
  const data = new Uint8ClampedArray(size * size * 4);
  const lo = 20.5;
  const hi = 99.5;
  const coverage = (p: number) => Math.max(0, Math.min(1, Math.min(p + 1, hi) - Math.max(p, lo)));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = coverage(x) * coverage(y);
      const mix = (fg: number) => Math.round(fg * c + 255 * (1 - c));
      data.set([mix(30), mix(27), mix(75), 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/** 160×160 white image with an anti-aliased triangle: diagonal edges, like a logo facet. */
function antialiasedTriangle() {
  const size = 160;
  const data = new Uint8ClampedArray(size * size * 4);
  const [a, b, c] = [
    [80, 15],
    [145, 140],
    [15, 140],
  ];
  const side = (p: number[], q: number[], x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const inside = (x: number, y: number) => side(a, b, x, y) >= 0 && side(b, c, x, y) >= 0 && side(c, a, x, y) >= 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 4×4 supersampling gives each edge pixel its true coverage
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++;
      const cov = hits / 16;
      const mix = (fg: number) => Math.round(fg * cov + 255 * (1 - cov));
      data.set([mix(79), mix(70), mix(229), 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/** 64×64 white image with a 4px black diagonal stroke, the typical centerline input. */
function strokeRaster() {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(x - y) <= 2 && x > 8 && x < 56) data.set([0, 0, 0, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/**
 * 120×120 white image with an anti-aliased navy ring, white inside: the
 * white centre is part of the subject, the white around it is background.
 */
function antialiasedRing() {
  const size = 120;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const r = Math.hypot(x + (sx + 0.5) / 4 - 60, y + (sy + 0.5) / 4 - 60);
          if (r >= 25 && r <= 45) hits++;
        }
      const cov = hits / 16;
      const mix = (fg: number) => Math.round(fg * cov + 255 * (1 - cov));
      data.set([mix(30), mix(27), mix(75), 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/** Bounds of a path element's end points (absolute coordinates). */
function pathBounds(element: string) {
  const segs = parsePathSegments(element.match(/\sd="([^"]*)"/)?.[1] ?? '');
  const xs = segs.map((s) => s.x);
  const ys = segs.map((s) => s.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const options = (overrides: Partial<VectorOptions> = {}): VectorOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe('vectorizeRaster', () => {
  it('traces with vecline and reports progress in order', () => {
    const stages: number[] = [];
    const result = vectorizeRaster(discRaster(), options(), (_, pct) => stages.push(pct));

    expect(result.svg).toMatch(/^<svg/);
    expect(result.shapes).toBeGreaterThan(0);
    expect(result.nodesCount).toBeGreaterThan(0);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
  });

  it('detects the real colours and ignores anti-aliasing blends', () => {
    const result = vectorizeRaster(antialiasedSquare(), options());
    expect(result.colors).toBe(2);
    expect(result.palette.map((p) => p.hex).sort()).toEqual(['#1e1b4b', '#fff']);
  });

  it('counts a colour split by compression noise as one colour', () => {
    // JPEG-like noise: each flat colour becomes a cloud of near-identical variants
    const noisy = antialiasedSquare();
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    for (let i = 0; i < noisy.data.length; i += 4) for (let c = 0; c < 3; c++) noisy.data[i + c] += Math.round(rand() * 5);
    const result = vectorizeRaster(noisy, options());
    expect(result.colors).toBe(2);
  });

  it('draws a square with anti-aliased edges as an exact square', () => {
    const result = vectorizeRaster(antialiasedSquare(), options());
    const square = result.svg.match(/<(rect|path)\b[^>]*fill="#1e1b4b"[^>]*>/)?.[0] ?? '';
    if (square.startsWith('<path')) {
      const d = square.match(/\sd="([^"]*)"/)?.[1] ?? '';
      expect(d).not.toMatch(/[cCqQsS]/);
      expect((d.match(/[lLhHvV]/g) || []).length).toBeLessThanOrEqual(4);
    } else {
      expect(square).toMatch(/^<rect/);
    }
  });

  it('draws a triangle with anti-aliased diagonal edges as three straight lines', () => {
    const triangle = (refine: boolean) =>
      vectorizeRaster(antialiasedTriangle(), options({ refine })).svg.match(/<path\b[^>]*fill="#4f46e5"[^>]*>/)?.[0] ?? '';
    const clean = triangle(true).match(/\sd="([^"]*)"/)?.[1] ?? '';
    expect(clean).not.toMatch(/[cCqQsS]/);
    expect((clean.match(/[lLhHvV]/g) || []).length).toBe(2); // the third side is drawn by z
    // Without clean-up the raw trace is left as the tracer produced it
    expect(triangle(false)).not.toBe(triangle(true));
  });

  it('removes the background around the subject and keeps the same colour inside it', () => {
    const opaque = vectorizeRaster(antialiasedRing(), options());
    const result = vectorizeRaster(antialiasedRing(), options({ transparentBackground: true }));
    const shapes = result.svg.match(/<(path|circle|ellipse|rect)\b[^>]*\/>/g) || [];
    // Nothing reaches the image border any more…
    for (const shape of shapes) {
      expect(shape).not.toMatch(/^<rect/);
      const circle = shape.match(/cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
      const b = circle
        ? { minX: +circle[1] - +circle[3], minY: +circle[2] - +circle[3], maxX: +circle[1] + +circle[3], maxY: +circle[2] + +circle[3] }
        : pathBounds(shape);
      expect(Math.min(b.minX, b.minY)).toBeGreaterThan(5);
      expect(Math.max(b.maxX, b.maxY)).toBeLessThan(115);
    }
    expect(result.svg).not.toContain('h120v120');
    // …the white centre is still drawn (on top of the ring, which no longer
    // needs its hole), and the ring keeps the opaque trace's outer outline
    expect(result.svg).toMatch(/fill="#fff"/);
    const outline = (svg: string) => svg.match(/d="(M[^Mmz]*z)[^"]*" fill="#1e1b4b"/)?.[1];
    expect(outline(result.svg)).toBeDefined();
    expect(outline(result.svg)).toBe(outline(opaque.svg));
    expect(result.svg.indexOf('#1e1b4b')).toBeLessThan(result.svg.indexOf('#fff'));
  });

  it('keeps a cut-out as it is when asked for a transparent background', () => {
    // A transparent PNG whose black subject touches the border: its empty
    // pixels read as black, so a background search would take the subject
    const size = 80;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (x < 30 && y > 20 && y < 60) data.set([5, 5, 8, 255], (y * size + x) * 4);
    const result = vectorizeRaster({ width: size, height: size, data }, options({ transparentBackground: true }));
    expect(result.svg).toMatch(/fill="#050508"/);
  });

  it('traces pixel art exactly on the pixel grid', () => {
    const size = 8;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    // A 4×4 red block made of 1px "pixels", with one pixel missing in a corner
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) if (!(x === 5 && y === 5)) data.set([220, 30, 30, 255], (y * size + x) * 4);
    const result = vectorizeRaster({ width: size, height: size, data }, options({ pixelGrid: true, transparentBackground: true, minArea: 0 }));
    const red = result.svg.match(/d="([^"]*)" fill="#dc1e1e"/)?.[1];
    expect(red).toBe('M2 2H6V5H5V6H2Z');
    expect(result.svg).not.toMatch(/fill="#fff"/);
  });

  it('makes the smoothing setting change the trace', () => {
    const noisy = antialiasedRing();
    let seed = 3;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    for (let i = 0; i < noisy.data.length; i += 4) for (let c = 0; c < 3; c++) noisy.data[i + c] += Math.round(rand() * 20);
    const off = vectorizeRaster(noisy, options({ autoColors: false, colors: 8, smooth: 0 }));
    const max = vectorizeRaster(noisy, options({ autoColors: false, colors: 8, smooth: 2 }));
    expect(max.svg).not.toBe(off.svg);
  });

  it('uses the requested number of colours when automatic detection is off', () => {
    const result = vectorizeRaster(discRaster(), options({ autoColors: false, colors: 6 }));
    expect(result.palette.length).toBeLessThanOrEqual(6);
  });

  it('applies preprocessing before ImageTracer too', () => {
    const plain = vectorizeRaster(discRaster(), options({ engine: 'imagetracer' })).svg;
    const contrasted = vectorizeRaster(discRaster(), options({ engine: 'imagetracer', contrast: 50 })).svg;
    expect(contrasted).not.toBe(plain);
  });

  it('traces centerlines with the stroke colour in the palette', () => {
    const result = vectorizeRaster(strokeRaster(), options({ traceMethod: 'centerline', centerlineStrokeColor: '#ff8800' }));
    expect(result.isCenterline).toBe(true);
    expect(result.shapes).toBeGreaterThan(0);
    expect(result.palette[0]).toMatchObject({ hex: '#ff8800', r: 255, g: 136, b: 0 });
  });
});

describe('measureSsim', () => {
  it('is 1 for identical images and lower for different ones', () => {
    const a = discRaster();
    expect(measureSsim(a, discRaster())).toBeCloseTo(1, 5);
    const blank = { ...a, data: new Uint8ClampedArray(a.data.length).fill(255) };
    expect(measureSsim(a, blank)).toBeLessThan(0.95);
  });
});
