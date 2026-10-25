import { describe, expect, it } from 'vitest';
import { metricsFor } from './metrics';
import { tracedResult } from '../test/renderWithServices';

const values = (m: ReturnType<typeof metricsFor>) => Object.fromEntries(m.map((x) => [x.label, x.value]));

describe('metricsFor', () => {
  it('reports shapes, nodes, time, size with savings, and fidelity once measured', () => {
    const m = values(metricsFor(tracedResult({ shapes: 1234, fileSizeBytes: 250, rasterSizeBytes: 1000, ssim: 0.9876 }), 'en'));
    expect(m).toEqual({
      'metrics.paths': '1,234',
      'metrics.nodes': '8',
      'metrics.time': '12 ms',
      'metrics.size': '250 B (−75%)',
      'metrics.fidelity': '98.8%',
    });
  });

  it('leaves out fidelity before it is measured, and savings when there are none', () => {
    const m = values(metricsFor(tracedResult({ fileSizeBytes: 2000, rasterSizeBytes: 1000 }), 'en'));
    expect(m['metrics.fidelity']).toBeUndefined();
    expect(m['metrics.size']).toBe('2 KB');
  });

  it('reports strokes and their length for a centerline trace, in the reader’s number format', () => {
    const m = values(metricsFor(tracedResult({ isCenterline: true, shapes: 3, centerlineLength: 12345 }), 'es'));
    expect(m['metrics.centerlines']).toBe('3');
    expect(m['metrics.length']).toBe('12.345 px');
    expect(m['metrics.paths']).toBeUndefined();
  });
});
