// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { recolor, removeColor, restoreTrace, simplify, withSvg } from './drawing';
import { testSvgDom } from '../test/fakes';
import type { VectorResult } from './types';

const dom = testSvgDom();
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0h100v100h-100z" fill="#ffffff"/><path d="M10 10h40v40h-40z" fill="#FF0000"/><circle cx="70" cy="70" r="10" fill="#f00"/></svg>';

const traced = (svg = SVG): VectorResult => ({
  svg,
  originalSvg: svg,
  shapes: 3,
  colors: 2,
  regions: 3,
  nodesCount: 9,
  executionTimeMs: 1,
  fileSizeBytes: svg.length,
  rasterSizeBytes: 0,
  palette: [
    { hex: '#ffffff', r: 255, g: 255, b: 255, a: 255, count: 80, percentage: 80 },
    { hex: '#ff0000', r: 255, g: 0, b: 0, a: 255, count: 20, percentage: 20 },
  ],
});

describe('drawing edits', () => {
  it('recounts nodes, shapes and size for an edited SVG, keeping the trace', () => {
    const edited = withSvg(traced(), '<svg><path d="M0 0h10v10z"/></svg>');
    expect(edited).toMatchObject({ shapes: 1, nodesCount: 3, originalSvg: SVG });
    expect(edited.fileSizeBytes).toBe(edited.svg.length);
  });

  it('keeps the stroke count of a centerline when its SVG is edited', () => {
    expect(withSvg({ ...traced(), isCenterline: true, shapes: 4 }, '<svg><path d="M0 0L5 5"/></svg>').shapes).toBe(4);
  });

  it('recolours every shape of a colour, whatever its spelling, and the palette with it', () => {
    const edited = recolor(traced(), '#ff0000', '#00ff00', dom);
    expect(edited.svg).not.toMatch(/#ff0000|#f00"/i);
    expect(edited.svg.match(/#00ff00/g)).toHaveLength(2);
    expect(edited.palette.map((p) => p.hex)).toEqual(['#ffffff', '#00ff00']);
  });

  it('removes the shapes of a colour and the colour from the palette', () => {
    const edited = removeColor(traced(), '#f00', dom);
    expect(edited.shapes).toBe(1);
    expect(edited.palette.map((p) => p.hex)).toEqual(['#ffffff']);
  });

  it('simplifies an outline with redundant nodes, and says when there is nothing to do', () => {
    const wobbly = traced('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L0.5 0L1 0.5L40 0L40 40L0 40Z" fill="#000"/></svg>');
    const done = simplify(wobbly, dom)!;
    expect(done.removed).toBeGreaterThan(0);
    expect(done.result.nodesCount).toBeLessThan(wobbly.nodesCount);
    expect(simplify(traced('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L40 0L40 40Z" fill="#000"/></svg>'), dom)).toBeNull();
  });

  it('restores the trace and the palette it had before edits', () => {
    const original = traced();
    const edited = removeColor(recolor(original, '#ff0000', '#0000ff', dom), '#ffffff', dom);
    const restored = restoreTrace(edited, [original, edited]);
    expect(restored.svg).toBe(SVG);
    expect(restored.palette).toEqual(original.palette);
  });
});
