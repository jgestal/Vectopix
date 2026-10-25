import type { SvgDom } from '../geometry/svgDom';

/**
 * Normalize hex color to 6-digit lowercase (e.g. #fff -> #ffffff)
 */
export function normalizeHex(hex: string): string {
  let clean = hex.trim().toLowerCase();
  if (!clean.startsWith('#')) clean = `#${clean}`;
  if (clean.length === 4) {
    clean = `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

const PAINT_ATTRIBUTES = ['fill', 'stroke', 'stop-color'];
const PAINT_IN_STYLE = /(fill|stroke|stop-color)\s*:\s*(#[0-9a-f]{3,6})\b/gi;

/** Replace a colour throughout an SVG: paint attributes, gradient stops and inline styles. */
export function replaceColorInSvg(svg: string, oldHex: string, newHex: string, dom: SvgDom): string {
  const target = normalizeHex(oldHex);
  const replacement = normalizeHex(newHex);
  const tree = dom.parse(svg);
  for (const el of tree.select('*')) {
    for (const attr of PAINT_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value && normalizeHex(value) === target) el.setAttribute(attr, replacement);
    }
    const style = el.getAttribute('style');
    if (style) {
      el.setAttribute(
        'style',
        style.replace(PAINT_IN_STYLE, (match, prop: string, value: string) => (normalizeHex(value) === target ? `${prop}: ${replacement}` : match))
      );
    }
  }
  return tree.serialize();
}

/** Remove every shape filled with a colour. */
export function removeColorFromSvg(svg: string, targetHex: string, dom: SvgDom): string {
  const target = normalizeHex(targetHex);
  const tree = dom.parse(svg);
  for (const el of tree.select('path, rect, circle, ellipse, polygon')) {
    const fill = el.getAttribute('fill');
    if (fill && normalizeHex(fill) === target) el.remove();
  }
  return tree.serialize();
}
