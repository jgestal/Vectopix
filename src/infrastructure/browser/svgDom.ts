import type { SvgDom, SvgElement } from '../../domain/geometry/svgDom';

const wrap = (el: Element): SvgElement => ({
  getAttribute: (name) => el.getAttribute(name),
  setAttribute: (name, value) => el.setAttribute(name, value),
  attributes: () => Array.from(el.attributes, (a) => [a.name, a.value] as [string, string]),
  remove: () => el.remove(),
});

/**
 * SvgDom on the platform's XML parser. The constructors are injectable so the
 * same adapter runs on happy-dom in tests.
 */
export function createSvgDom(Parser: typeof DOMParser = DOMParser, Serializer: typeof XMLSerializer = XMLSerializer): SvgDom {
  return {
    parse(svg) {
      const doc = new Parser().parseFromString(svg, 'image/svg+xml');
      return {
        root: () => {
          const svgEl = doc.querySelector('svg');
          return svgEl ? wrap(svgEl) : null;
        },
        select: (selector) => Array.from(doc.querySelectorAll(selector), wrap),
        serialize: () => new Serializer().serializeToString(doc.documentElement),
      };
    },
  };
}
