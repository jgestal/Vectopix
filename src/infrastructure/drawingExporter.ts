import { toComponent } from 'vecline/core';
import type { DrawingExporter } from '../application/ports';
import { AppError } from '../application/errors';
import { minifySvg } from './vecline/imageProcessing';

/** Renders an SVG to PNG on a canvas, at `scale` times its size, over `background`. */
function svgToPng(svg: string, size: { width: number; height: number }, scale: number, background: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.width * scale);
    canvas.height = Math.round(size.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new AppError('export.pngError'));
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError('export.pngError'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AppError('export.pngError'));
    };
    img.src = url;
  });
}

/** Minimal React component wrapping the SVG, if vecline can't build one. */
const fallbackComponent = (svg: string) =>
  `import type { SVGProps } from 'react';\n\nexport function VectorGraphic(props: SVGProps<SVGSVGElement>) {\n  return (\n    ${svg}\n  );\n}\n`;

export const drawingExporter: DrawingExporter = {
  // DXF / EPS / PDF writers load on first use: most people never open those tabs
  cad: async (svg, format, isCenterline) => (await import('./vecline/cadExport')).exportSvg(svg, format, isCenterline),
  png: svgToPng,
  component(svg, framework) {
    try {
      return toComponent(svg, { framework });
    } catch {
      return fallbackComponent(svg);
    }
  },
  minify: (svg) => minifySvg(svg),
};
