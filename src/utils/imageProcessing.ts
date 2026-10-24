import { selectiveBlur, toPdf, optimizeSvg } from 'vecline';

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
  raster: { width: number; height: number; data: Uint8ClampedArray },
  denoiseLevel: number
): { width: number; height: number; data: Uint8ClampedArray } {
  if (denoiseLevel <= 0) return raster;
  const radius = Math.min(5, Math.max(1, Math.round(denoiseLevel / 2)));
  return selectiveBlur(raster, { radius, delta: 25 });
}

/**
 * Complete pre-processing pipeline for incoming raster frames
 */
export function preprocessRaster(
  raster: { width: number; height: number; data: Uint8ClampedArray },
  contrast: number,
  denoise: number
): { width: number; height: number; data: Uint8ClampedArray } {
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
 * Generate compliant vector PDF for centerline polylines
 */
export function generateCenterlinePdf(
  polylines: { x: number; y: number }[][],
  width: number,
  height: number,
  strokeWidth = 2,
  strokeColor = '#000000'
): Uint8Array {
  const r = (parseInt(strokeColor.slice(1, 3), 16) || 0) / 255;
  const g = (parseInt(strokeColor.slice(3, 5), 16) || 0) / 255;
  const b = (parseInt(strokeColor.slice(5, 7), 16) || 0) / 255;

  let stream = `${strokeWidth} w\n1 J\n1 j\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;

  for (const poly of polylines) {
    if (poly.length < 2) continue;
    stream += `${poly[0].x.toFixed(2)} ${(height - poly[0].y).toFixed(2)} m\n`;
    for (let i = 1; i < poly.length; i++) {
      stream += `${poly[i].x.toFixed(2)} ${(height - poly[i].y).toFixed(2)} l\n`;
    }
    stream += 'S\n';
  }

  const streamBytes = new TextEncoder().encode(stream);
  const streamLength = streamBytes.length;

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R >>`;
  objects[4] = `<< /Length ${streamLength} >>\nstream\n${stream}endstream`;

  let header = '%PDF-1.4\n';
  const offsets: number[] = [0];
  let curOffset = new TextEncoder().encode(header).length;

  let body = '';
  for (let i = 1; i <= 4; i++) {
    const objStr = `${i} 0 obj\n${objects[i]}\nendobj\n`;
    offsets[i] = curOffset;
    body += objStr;
    curOffset += new TextEncoder().encode(objStr).length;
  }

  const xrefOffset = curOffset;
  let xref = 'xref\n0 5\n0000000000 65535 f \n';
  for (let i = 1; i <= 4; i++) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const fullPdfStr = header + body + xref;
  return new TextEncoder().encode(fullPdfStr);
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

export { toPdf, optimizeSvg };
