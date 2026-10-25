// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createSvgDom } from './svgDom';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="0 0 20 20"><g><path id="a" d="M0 0h5v5z" fill="red"/></g><circle r="2"/></svg>';

describe('createSvgDom (browser XML parser)', () => {
  const dom = createSvgDom();

  it('reads the root and its attributes in order', () => {
    const root = dom.parse(SVG).root()!;
    expect(root.getAttribute('width')).toBe('20');
    expect(root.attributes()).toEqual([
      ['xmlns', 'http://www.w3.org/2000/svg'],
      ['width', '20'],
      ['viewBox', '0 0 20 20'],
    ]);
  });

  it('selects nested elements and writes changes back', () => {
    const tree = dom.parse(SVG);
    const [path] = tree.select('path');
    path.setAttribute('fill', 'blue');
    tree.select('circle')[0].remove();
    const out = tree.serialize();
    expect(out).toContain('fill="blue"');
    expect(out).not.toContain('<circle');
    expect(out).toContain('<g>');
  });

  it('has no root for markup that is not an SVG', () => {
    expect(dom.parse('<html/>').root()).toBeNull();
  });
});
