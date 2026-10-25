import { describe, expect, it } from 'vitest';
import { exportFileName, stripExtension } from './exportFiles';

const choices = { pngScale: 4, framework: 'react' as const };

describe('export files', () => {
  it('names files after the source image', () => {
    expect(exportFileName('svg', 'logo.final.png', choices)).toBe('logo.final.svg');
    expect(exportFileName('dxf', 'logo.png', choices)).toBe('logo.dxf');
    expect(exportFileName('pdf', 'logo', choices)).toBe('logo.pdf');
  });

  it('puts the scale in a PNG name', () => {
    expect(exportFileName('png', 'logo.png', choices)).toBe('logo_@4x.png');
  });

  it('names components by framework', () => {
    expect(exportFileName('components', 'logo.png', choices)).toBe('VectorGraphic.tsx');
    expect(exportFileName('components', 'logo.png', { ...choices, framework: 'svelte' })).toBe('VectorGraphic.svelte');
  });

  it('only strips the last extension', () => {
    expect(stripExtension('a.b.c')).toBe('a.b');
    expect(stripExtension('noext')).toBe('noext');
  });
});
