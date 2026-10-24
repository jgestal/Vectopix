import { describe, expect, it } from 'vitest';
import { exportTrace, measureSsim, vectorizeRaster } from './vectorEngine';
import { DEFAULT_OPTIONS } from '../config/presets';
import type { VectorOptions } from '../types/vector';

/** 64×64 white image with a red disc in the middle. */
function discRaster() {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inside = (x - 32) ** 2 + (y - 32) ** 2 < 400;
      data.set(inside ? [220, 30, 30, 255] : [255, 255, 255, 255], i);
    }
  }
  return { width, height, data };
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

const options = (overrides: Partial<VectorOptions> = {}): VectorOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe('vectorizeRaster', () => {
  it('traces with vecline and extracts the palette', () => {
    const stages: number[] = [];
    const { result } = vectorizeRaster(discRaster(), options(), (_, pct) => stages.push(pct));

    expect(result.svg).toMatch(/^<svg/);
    expect(result.shapes).toBeGreaterThan(0);
    expect(result.nodesCount).toBeGreaterThan(0);
    expect(result.palette.map((p) => p.hex)).toContain('#dc1e1e');
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
  });

  it('applies preprocessing before ImageTracer too', () => {
    const plain = vectorizeRaster(discRaster(), options({ engine: 'imagetracer' })).result.svg;
    const contrasted = vectorizeRaster(discRaster(), options({ engine: 'imagetracer', contrast: 50 })).result.svg;
    expect(contrasted).not.toBe(plain);
  });

  it('traces centerlines with the stroke colour in the palette', () => {
    const { result } = vectorizeRaster(
      strokeRaster(),
      options({ traceMethod: 'centerline', centerlineStrokeColor: '#ff8800' })
    );
    expect(result.isCenterline).toBe(true);
    expect(result.shapes).toBeGreaterThan(0);
    expect(result.palette[0]).toMatchObject({ hex: '#ff8800', r: 255, g: 136, b: 0 });
  });
});

describe('exportTrace', () => {
  it('builds DXF, EPS and PDF on demand from the trace context', () => {
    const { context } = vectorizeRaster(discRaster(), options());
    expect(exportTrace(context, 'dxf')).toContain('SECTION');
    expect(exportTrace(context, 'eps')).toMatch(/^%!PS-Adobe/);
    const pdf = exportTrace(context, 'pdf') as Uint8Array;
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('exports centerline traces in all three formats', () => {
    const { context } = vectorizeRaster(strokeRaster(), options({ traceMethod: 'centerline' }));
    expect(exportTrace(context, 'dxf')).toContain('POLYLINE');
    expect(exportTrace(context, 'eps')).toContain('%%BoundingBox: 0 0 64 64');
    const pdf = new TextDecoder().decode(exportTrace(context, 'pdf') as Uint8Array);
    expect(pdf).toMatch(/^%PDF-1\.4[\s\S]*%%EOF$/);
  });

  it('rejects CAD formats for the ImageTracer engine', () => {
    const { context } = vectorizeRaster(discRaster(), options({ engine: 'imagetracer' }));
    expect(() => exportTrace(context, 'dxf')).toThrow(/Vecline/);
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
