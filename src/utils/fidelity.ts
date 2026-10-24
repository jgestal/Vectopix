/**
 * Render the source raster and the traced SVG at the same (reduced) size so
 * they can be compared pixel by pixel. SSIM is computed at most at
 * `maxSide` px on the long side: enough to judge fidelity, cheap on big images.
 *
 * Both are composited onto white, i.e. compared as they look on a page.
 * Otherwise a trace without background (centerline, or outline with the
 * background removed) counts every transparent pixel as wrong.
 */
export async function rasterizeForComparison(
  source: ImageData,
  svg: string,
  maxSide = 512
): Promise<{ reference: ImageData; candidate: ImageData }> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const full = document.createElement('canvas');
  full.width = source.width;
  full.height = source.height;
  full.getContext('2d')!.putImageData(source, 0, 0);

  const refCanvas = document.createElement('canvas');
  refCanvas.width = width;
  refCanvas.height = height;
  const refCtx = whiteCanvasContext(refCanvas);
  refCtx.drawImage(full, 0, 0, width, height);

  const svgImage = await loadSvgImage(svg);
  const candCanvas = document.createElement('canvas');
  candCanvas.width = width;
  candCanvas.height = height;
  const candCtx = whiteCanvasContext(candCanvas);
  candCtx.drawImage(svgImage, 0, 0, width, height);

  return {
    reference: refCtx.getImageData(0, 0, width, height),
    candidate: candCtx.getImageData(0, 0, width, height),
  };
}

function whiteCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the SVG'));
    };
    img.src = url;
  });
}
