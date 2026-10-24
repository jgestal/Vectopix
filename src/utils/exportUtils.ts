import { toComponent } from 'vecline/core';

export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdf(
  pdfData: string | Uint8Array,
  fileName: string
) {
  const blob = new Blob([pdfData as BlobPart], { type: 'application/pdf' });
  downloadBlob(blob, fileName);
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Render SVG to High-Resolution PNG at scale (1x, 2x, 4x, 8x) with optional background color
 */
export async function exportSvgToPngBlob(
  svgString: string,
  width: number,
  height: number,
  scale = 2,
  bgColor = 'transparent'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into Image for PNG conversion'));
    };

    img.src = url;
  });
}

/**
 * Generate Framework Component Code using vecline's toComponent
 */
export function convertSvgToComponent(
  svgString: string,
  framework: 'react' | 'vue' | 'svelte'
): string {
  try {
    return toComponent(svgString, { framework });
  } catch {
    // Fallback React
    return `import type { SVGProps } from 'react';\n\nexport function VectorGraphic(props: SVGProps<SVGSVGElement>) {\n  return (\n    ${svgString}\n  );\n}\n`;
  }
}
