// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { exportSvg, svgToGeometry, svgToPolylines } from './svgExport';

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">${body}</svg>`;

describe('svgToGeometry', () => {
  it('turns filled shapes into coloured subpaths', () => {
    const geometry = svgToGeometry(
      svg('<rect x="1" y="2" width="10" height="5" fill="#f00"/><path d="M0 0h5v5z" fill="rgb(0, 128, 0)"/>')
    );
    expect(geometry).toMatchObject({ width: 100, height: 50 });
    expect(geometry.paths.map((p) => p.color)).toEqual([
      { r: 255, g: 0, b: 0, a: 255 },
      { r: 0, g: 128, b: 0, a: 255 },
    ]);
    expect(geometry.paths[0].subpaths[0]).toEqual({
      start: { x: 1, y: 2 },
      segments: [
        { kind: 'line', x: 11, y: 2 },
        { kind: 'line', x: 11, y: 7 },
        { kind: 'line', x: 1, y: 7 },
      ],
    });
  });

  it('defaults to black, inherits group fills and skips unpainted shapes', () => {
    const geometry = svgToGeometry(
      svg('<path d="M0 0h1v1z"/><g fill="#00f"><circle cx="5" cy="5" r="2"/></g><path d="M0 0h1v1z" fill="none"/>')
    );
    expect(geometry.paths.map((p) => p.color.b)).toEqual([0, 255]);
    expect(geometry.paths[1].subpaths[0].segments).toHaveLength(4);
  });

  it('flattens gradients to the average of their stops and ignores defs content', () => {
    const geometry = svgToGeometry(
      svg(`<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
           <path id="unused" d="M0 0h9v9z"/></defs>
           <rect width="10" height="10" fill="url(#g)"/>`)
    );
    expect(geometry.paths).toHaveLength(1);
    expect(geometry.paths[0].color).toMatchObject({ r: 128, g: 128, b: 128 });
  });
});

describe('svgToPolylines', () => {
  it('extracts stroked lines with their stroke style, flattening curves', () => {
    const result = svgToPolylines(
      svg('<path fill="none" stroke="#f80" stroke-width="3" d="M0 0L10 0C10 5 15 10 20 10"/>')
    );
    expect(result).toMatchObject({ stroke: '#ff8800', strokeWidth: 3 });
    expect(result.polylines).toHaveLength(1);
    expect(result.polylines[0][0]).toEqual({ x: 0, y: 0 });
    expect(result.polylines[0].at(-1)).toEqual({ x: 20, y: 10 });
  });
});

describe('exportSvg', () => {
  it('writes every format for filled and centerline drawings', () => {
    const filled = svg('<path d="M0 0h10v10H0z" fill="#123456"/>');
    expect(exportSvg(filled, 'dxf')).toContain('SECTION');
    expect(exportSvg(filled, 'eps')).toMatch(/^%!PS-Adobe/);
    expect(new TextDecoder().decode((exportSvg(filled, 'pdf') as Uint8Array).slice(0, 5))).toBe('%PDF-');

    const stroked = svg('<path fill="none" stroke="#000" d="M0 0L50 25"/>');
    expect(exportSvg(stroked, 'dxf', true)).toContain('POLYLINE');
  });
});
