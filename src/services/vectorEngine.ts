import {
  trace,
  traceGeometry,
  centerlineTrace,
  centerlinePolylines,
  toDxf,
  toEps,
  countPathNodes,
  extractPalette,
  TRACE_DEFAULTS,
} from 'vecline';
import ImageTracer from 'imagetracerjs';
import {
  preprocessRaster,
  generateCenterlinePdf,
  toPdf,
} from '../utils/imageProcessing';
import type { VectorOptions, VectorResult, PaletteColor } from '../types/vector';

function generateCenterlineDxf(
  polylines: { x: number; y: number }[][],
  height: number
): string {
  let dxf = '0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    dxf += '0\nPOLYLINE\n8\nCENTERLINE\n66\n1\n70\n0\n';
    for (const pt of poly) {
      dxf += `0\nVERTEX\n8\nCENTERLINE\n10\n${pt.x.toFixed(2)}\n20\n${(height - pt.y).toFixed(2)}\n30\n0.0\n`;
    }
    dxf += '0\nSEQEND\n';
  }
  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

export async function vectorizeImage(
  imageData: ImageData,
  options: VectorOptions,
  rasterSizeBytes = 0
): Promise<VectorResult> {
  const startTime = performance.now();
  const rawRaster = {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  };

  const raster = preprocessRaster(rawRaster, options.contrast || 0, options.denoise || 0);

  if (options.traceMethod === 'centerline') {
    const clResult = centerlineTrace(raster, {
      stroke: options.centerlineStrokeColor || '#000000',
      strokeWidth: options.centerlineStrokeWidth || 2,
      adaptive: options.centerlineAdaptive,
      blackOnWhite: options.centerlineBlackOnWhite,
    });

    const polylines = centerlinePolylines(raster, {
      adaptive: options.centerlineAdaptive,
      blackOnWhite: options.centerlineBlackOnWhite,
    });

    const dxf = generateCenterlineDxf(polylines, raster.height);
    const pdf = generateCenterlinePdf(
      polylines,
      raster.width,
      raster.height,
      options.centerlineStrokeWidth || 2,
      options.centerlineStrokeColor || '#000000'
    );

    const executionTimeMs = Math.round(performance.now() - startTime);
    const fileSizeBytes = new Blob([clResult.svg]).size;
    const nodesCount = (clResult.svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;

    return {
      svg: clResult.svg,
      originalSvg: clResult.svg,
      shapes: clResult.paths,
      colors: 1,
      regions: clResult.paths,
      nodesCount,
      executionTimeMs,
      fileSizeBytes,
      rasterSizeBytes,
      dxf,
      pdf,
      palette: [
        {
          hex: options.centerlineStrokeColor || '#000000',
          r: 0,
          g: 0,
          b: 0,
          a: 255,
          count: clResult.inkPixels,
          percentage: 100,
        },
      ],
      isCenterline: true,
      centerlineLength: Math.round(clResult.length),
      estimatedSsim: 0.95,
    };
  }

  if (options.engine === 'imagetracer') {
    return new Promise((resolve) => {
      const itOptions = {
        numberofcolors: options.colors,
        scale: 1,
        blurradius: options.blurRadius ?? 0,
        blurdelta: 20,
        pathomit: options.minArea,
        linefilter: true,
        corsenabled: false,
      };

      const svgString = ImageTracer.imagedataToSVG(
        { width: raster.width, height: raster.height, data: raster.data } as unknown as ImageData,
        itOptions
      );
      const executionTimeMs = Math.round(performance.now() - startTime);

      resolve({
        svg: svgString,
        originalSvg: svgString,
        shapes: (svgString.match(/<path/g) || []).length,
        colors: options.colors,
        regions: 0,
        nodesCount: (svgString.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length,
        executionTimeMs,
        fileSizeBytes: new Blob([svgString]).size,
        rasterSizeBytes,
        palette: [],
        estimatedSsim: 0.94,
        isCenterline: false,
      });
    });
  }

  // Vecline Engine (Sub-pixel, Bézier Curve Fitting, Vector Magic style)
  const rawPalette = extractPalette(raster, Math.min(options.colors, 64)) || [];
  const palette: PaletteColor[] = rawPalette.map((p) => ({
    hex: p.hex,
    r: p.rgb.r,
    g: p.rgb.g,
    b: p.rgb.b,
    a: p.rgb.a,
    count: Math.round(p.weight * raster.width * raster.height),
    percentage: Math.round(p.weight * 100),
  }));

  const traceOptions = {
    ...TRACE_DEFAULTS,
    colors: options.colors,
    subpixel: options.subpixel,
    tolerance: options.tolerance,
    fitError: options.fitError,
    cornerAngle: options.cornerAngle,
    minArea: options.minArea,
    refineIterations: options.refineIterations,
    smooth: options.smooth ?? 1,
    background: options.background,
    primitives: options.primitives,
    gradients: options.gradients,
  };

  const result = trace(raster, traceOptions);
  const executionTimeMs = Math.round(performance.now() - startTime);

  let nodesCount = 0;
  try {
    nodesCount = countPathNodes(result.svg);
  } catch {
    nodesCount = (result.svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
  }

  let dxf: string | undefined;
  let eps: string | undefined;
  let pdf: Uint8Array | undefined;

  try {
    const geometry = traceGeometry(raster, traceOptions);
    dxf = toDxf(geometry);
    eps = toEps(geometry);
    pdf = toPdf(geometry);
  } catch {
    // Exporters are optional fallbacks
  }

  return {
    svg: result.svg,
    originalSvg: result.svg,
    shapes: result.shapes,
    colors: result.colors,
    regions: result.regions,
    nodesCount,
    executionTimeMs,
    fileSizeBytes: new Blob([result.svg]).size,
    rasterSizeBytes,
    dxf,
    eps,
    pdf,
    palette,
    estimatedSsim: 0.98,
    isCenterline: false,
  };
}
