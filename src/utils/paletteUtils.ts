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

/**
 * Replace a color throughout an SVG string
 */
export function replaceColorInSvg(svg: string, oldHex: string, newHex: string): string {
  const normOld = normalizeHex(oldHex);
  const normNew = normalizeHex(newHex);

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  const elements = doc.querySelectorAll('*');
  elements.forEach((el) => {
    // Check fill
    const fill = el.getAttribute('fill');
    if (fill && normalizeHex(fill) === normOld) {
      el.setAttribute('fill', normNew);
    }

    // Check stroke
    const stroke = el.getAttribute('stroke');
    if (stroke && normalizeHex(stroke) === normOld) {
      el.setAttribute('stroke', normNew);
    }

    // Check inline style
    const style = el.getAttribute('style');
    if (style) {
      const updatedStyle = style
        .replace(new RegExp(`fill:\\s*${oldHex}`, 'gi'), `fill: ${normNew}`)
        .replace(new RegExp(`stroke:\\s*${oldHex}`, 'gi'), `stroke: ${normNew}`);
      el.setAttribute('style', updatedStyle);
    }
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}

/**
 * Remove or make transparent all paths of a given color
 */
export function removeColorFromSvg(svg: string, targetHex: string): string {
  const normTarget = normalizeHex(targetHex);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  const elements = doc.querySelectorAll('path, rect, circle, polygon');
  elements.forEach((el) => {
    const fill = el.getAttribute('fill');
    if (fill && normalizeHex(fill) === normTarget) {
      el.remove();
    }
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}
