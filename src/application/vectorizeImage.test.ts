import { describe, expect, it, vi } from 'vitest';
import { createVectorizer, selectOutlineTracer, type OutlineTracerId, type VectorizerDeps } from './vectorizeImage';
import type { OutlineTracer } from './ports';
import type { PaletteCandidate } from '../domain/palette/colors';
import { DEFAULT_OPTIONS } from '../domain/presets';
import type { VectorOptions } from '../domain/types';

/**
 * The use case with every port faked: what it decides (palette, strategy,
 * clean-up steps, progress, figures), independent of vecline.
 */

const WHITE: PaletteCandidate = { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255, a: 255 }, weight: 0.7 };
const NAVY: PaletteCandidate = { hex: '#1e1b4b', rgb: { r: 30, g: 27, b: 75, a: 255 }, weight: 0.29 };
const FRINGE: PaletteCandidate = { hex: '#8e8da5', rgb: { r: 142, g: 141, b: 165, a: 255 }, weight: 0.01 };

/** A white frame with a navy square inside: a containing shape with a hole (stacking applies). */
const TRACED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">' +
  '<path fill-rule="evenodd" d="M0 0h10v10h-10zM3 3v4h4v-4z" fill="#ffffff"/>' +
  '<path d="M3 3h4v4h-4z" fill="#1e1b4b"/></svg>';

const raster = (width = 10, height = 10, alpha = 255) => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(alpha) });
const options = (overrides: Partial<VectorOptions> = {}): VectorOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

function fakeTracer(svg = TRACED_SVG): OutlineTracer & { calls: { palette: PaletteCandidate[]; options: VectorOptions }[] } {
  const calls: { palette: PaletteCandidate[]; options: VectorOptions }[] = [];
  return {
    stage: 'progress.boundaries',
    calls,
    trace(_raster, palette, opts) {
      calls.push({ palette, options: opts });
      return { svg, shapes: 2, regions: 2 };
    },
  };
}

function setup(found: PaletteCandidate[] = [WHITE, NAVY, FRINGE]) {
  const tracers = { vecline: fakeTracer(), imagetracer: fakeTracer(), pixelGrid: fakeTracer() } satisfies Record<OutlineTracerId, OutlineTracer>;
  let now = 1000;
  const deps: VectorizerDeps = {
    preprocessor: { apply: vi.fn((r) => r) },
    quantizer: { extract: vi.fn(() => found) },
    background: { detect: vi.fn(() => ({ r: 255, g: 255, b: 255 })) },
    tracers,
    centerline: { trace: vi.fn(() => ({ svg: '<svg><path d="M0 0L5 5"/></svg>', paths: 1, inkPixels: 40, length: 7.4 })) },
    clock: () => (now += 25),
  };
  return { deps, tracers, vectorizer: createVectorizer(deps) };
}

describe('selectOutlineTracer', () => {
  it('uses the exact pixel grid when asked, otherwise the chosen engine', () => {
    expect(selectOutlineTracer(options({ pixelGrid: true, engine: 'imagetracer' }))).toBe('pixelGrid');
    expect(selectOutlineTracer(options({ engine: 'imagetracer' }))).toBe('imagetracer');
    expect(selectOutlineTracer(options())).toBe('vecline');
  });
});

describe('vectorize', () => {
  it('preprocesses with the contrast and noise settings', () => {
    const { deps, vectorizer } = setup();
    vectorizer.vectorize(raster(), options({ contrast: 20, denoise: 3 }));
    expect(deps.preprocessor.apply).toHaveBeenCalledWith(expect.anything(), { contrast: 20, denoise: 3 });
  });

  it('traces the real colours only, in automatic mode', () => {
    const { tracers, vectorizer } = setup();
    const result = vectorizer.vectorize(raster(), options());
    expect(tracers.vecline.calls[0].palette.map((p) => p.hex)).toEqual(['#ffffff', '#1e1b4b']);
    expect(result.palette.map((p) => p.hex)).toEqual(['#ffffff', '#1e1b4b']);
    expect(result.colors).toBe(2);
  });

  it('asks for the requested number of colours in manual mode, without empty pixels', () => {
    const transparent: PaletteCandidate = { ...WHITE, rgb: { ...WHITE.rgb, a: 0 } };
    const { deps, tracers, vectorizer } = setup([transparent, NAVY, FRINGE]);
    vectorizer.vectorize(raster(), options({ autoColors: false, colors: 6 }));
    expect(deps.quantizer.extract).toHaveBeenCalledWith(expect.anything(), 6);
    expect(tracers.vecline.calls[0].palette.map((p) => p.hex)).toEqual(['#1e1b4b', '#8e8da5']);
  });

  it('runs the strategy the options select', () => {
    const { tracers, vectorizer } = setup();
    vectorizer.vectorize(raster(), options({ engine: 'imagetracer' }));
    vectorizer.vectorize(raster(), options({ pixelGrid: true }));
    expect(tracers.imagetracer.calls).toHaveLength(1);
    expect(tracers.pixelGrid.calls).toHaveLength(1);
    expect(tracers.vecline.calls).toHaveLength(0);
  });

  it('stacks shapes: the containing shape loses the hole its content fills', () => {
    const { vectorizer } = setup();
    const { svg } = vectorizer.vectorize(raster(), options({ refine: false }));
    expect(svg).toContain('d="M0 0h10v10h-10z" fill="#ffffff"');
  });

  it('keeps the traced geometry for gradients and exact pixel art', () => {
    const { vectorizer } = setup();
    for (const keep of [{ gradients: true }, { pixelGrid: true }]) {
      expect(vectorizer.vectorize(raster(), options({ refine: true, ...keep })).svg).toBe(TRACED_SVG);
    }
  });

  it('removes the background for a transparent result, but not from a cut-out', () => {
    const { deps, vectorizer } = setup();
    const removed = vectorizer.vectorize(raster(), options({ transparentBackground: true, refine: false }));
    expect(removed.svg).not.toContain('#ffffff');
    expect(deps.background.detect).toHaveBeenCalledTimes(1);

    const cutOut = vectorizer.vectorize(raster(10, 10, 0), options({ transparentBackground: true, refine: false }));
    expect(cutOut.svg).toContain('#ffffff');
    expect(deps.background.detect).toHaveBeenCalledTimes(1);
  });

  it('reports progress in order, the refit stage only when refitting', () => {
    const { vectorizer } = setup();
    const stages = (opts: Partial<VectorOptions>) => {
      const seen: string[] = [];
      vectorizer.vectorize(raster(), options(opts), (stage) => seen.push(stage));
      return seen;
    };
    expect(stages({ refine: true })).toEqual(['progress.palette', 'progress.boundaries', 'progress.fitting']);
    expect(stages({ refine: false })).toEqual(['progress.palette', 'progress.boundaries']);
  });

  it('describes the final SVG: shapes, nodes, size and time', () => {
    const { vectorizer } = setup();
    const result = vectorizer.vectorize(raster(), options({ refine: false }));
    expect(result).toMatchObject({ shapes: 2, nodesCount: 8, originalSvg: result.svg, isCenterline: false, executionTimeMs: 25 });
    expect(result.fileSizeBytes).toBe(result.svg.length);
    expect(result.regions).toBe(2);
  });

  it('traces centerlines with the stroke colour as the palette', () => {
    const { deps, tracers, vectorizer } = setup();
    const result = vectorizer.vectorize(raster(), options({ traceMethod: 'centerline', centerlineStrokeColor: '#ff8800' }));
    expect(deps.centerline.trace).toHaveBeenCalled();
    expect(tracers.vecline.calls).toHaveLength(0);
    expect(result).toMatchObject({ isCenterline: true, shapes: 1, colors: 1, centerlineLength: 7 });
    expect(result.palette).toEqual([{ hex: '#ff8800', r: 255, g: 136, b: 0, a: 255, count: 40, percentage: 100 }]);
  });
});
