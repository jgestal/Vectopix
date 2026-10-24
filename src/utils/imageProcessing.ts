import { selectiveBlur, optimizeSvg } from 'vecline/core';

export type Raster = { width: number; height: number; data: Uint8ClampedArray };

/**
 * High-performance contrast adjustment on RGBA Uint8ClampedArray
 * @param data Source RGBA buffer
 * @param contrastPercent Range [-50, 50]
 */
export function applyContrast(
  data: Uint8ClampedArray,
  contrastPercent: number
): Uint8ClampedArray {
  if (contrastPercent === 0) return data;
  const factor = (259 * (contrastPercent + 255)) / (255 * (259 - contrastPercent));
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
    out[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
    out[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    out[i + 3] = data[i + 3];
  }
  return out;
}

/**
 * Selective edge-preserving blur to eliminate JPEG noise while keeping crisp vector borders
 */
export function applyDenoise(
  raster: Raster,
  denoiseLevel: number
): Raster {
  if (denoiseLevel <= 0) return raster;
  const radius = Math.min(5, Math.max(1, Math.round(denoiseLevel / 2)));
  return selectiveBlur(raster, { radius, delta: 25 });
}

/**
 * Complete pre-processing pipeline for incoming raster frames
 */
export function preprocessRaster(
  raster: Raster,
  contrast: number,
  denoise: number
): Raster {
  let current = raster;
  if (contrast !== 0) {
    current = {
      ...current,
      data: applyContrast(current.data, contrast),
    };
  }
  if (denoise > 0) {
    current = applyDenoise(current, denoise);
  }
  return current;
}

/**
 * Minify & optimize SVG using Vecline's SVG optimizer
 */
export function minifySvg(svg: string, precision = 2): string {
  try {
    return optimizeSvg(svg, { precision, stripProlog: true });
  } catch {
    return svg;
  }
}
