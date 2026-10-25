// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { drawingExporter } from './drawingExporter';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path d="M0.000 0.000L10.000 0.000L10.000 10.000Z" fill="#ff0000"/></svg>';

describe('drawingExporter (vecline)', () => {
  it('minifies without changing what is drawn', () => {
    const min = drawingExporter.minify(SVG);
    expect(min.length).toBeLessThan(SVG.length);
    expect(min).toMatch(/<path[^>]*fill="(#f00|#ff0000|red)"/);
  });

  it('wraps the drawing in a component for each framework', () => {
    expect(drawingExporter.component(SVG, 'react')).toMatch(/export (default )?function|=>/);
    expect(drawingExporter.component(SVG, 'vue')).toContain('<template>');
    expect(drawingExporter.component(SVG, 'svelte')).toContain('<svg');
  });

  it('builds CAD files from the drawing', async () => {
    expect(await drawingExporter.cad(SVG, 'dxf', false)).toContain('SECTION');
    expect(await drawingExporter.cad(SVG, 'eps', false)).toContain('%!PS-Adobe');
    const pdf = await drawingExporter.cad(SVG, 'pdf', false);
    expect(new TextDecoder().decode((pdf as Uint8Array).slice(0, 5))).toBe('%PDF-');
  });
});
