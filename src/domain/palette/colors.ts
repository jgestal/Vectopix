export type Rgb = { r: number; g: number; b: number };
export type Rgba = Rgb & { a: number };

/** A colour found in an image and the share of its pixels (0–1) it covers. */
export interface PaletteCandidate {
  rgb: Rgba;
  hex: string;
  weight: number;
}

/** sRGB (0–255) to Oklab: perceptual distances are Euclidean distances here. */
export function toOklab({ r, g, b }: Rgb): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabDistance(a: Rgb, b: Rgb): number {
  const [x, y] = [toOklab(a), toOklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** #rgb or #rrggbb to channels; malformed digits read as 0. */
export function hexToRgb(hex: string): Rgb {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}
