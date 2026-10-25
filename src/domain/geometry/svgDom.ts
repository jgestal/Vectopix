/**
 * The few XML operations the SVG document model needs. The domain states
 * them; the browser's DOMParser implements them (infrastructure/browser/svgDom),
 * and tests use the same adapter on happy-dom.
 */
export interface SvgElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  /** All attributes, in document order. */
  attributes(): [name: string, value: string][];
  remove(): void;
}

export interface SvgTree {
  /** The <svg> root, if the markup has one. */
  root(): SvgElement | null;
  /** Elements matching a CSS selector, in document order. */
  select(selector: string): SvgElement[];
  serialize(): string;
}

export interface SvgDom {
  parse(svg: string): SvgTree;
}
