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
import type {
  WorkerMessage,
  WorkerResponse,
  VectorResult,
  PaletteColor,
} from '../types/vector';

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

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type !== 'VECTORIZE') return;

  const { id, width, height, buffer, rasterSizeBytes, options } = msg;
  const startTime = performance.now();

  try {
    const data = new Uint8ClampedArray(buffer);
    const rawRaster = { width, height, data };

    // Apply pre-processing (contrast & bilateral denoise)
    const raster = preprocessRaster(rawRaster, options.contrast || 0, options.denoise || 0);

    // =========================================================================
    // CASE A: Centerline Tracing (Single-stroke Skeletonization)
    // =========================================================================
    if (options.traceMethod === 'centerline') {
      self.postMessage({
        type: 'PROGRESS',
        id,
        stage: 'Extrayendo esqueleto morfológico y líneas de centro...',
        percent: 30,
      } as WorkerResponse);

      const clResult = centerlineTrace(raster, {
        stroke: options.centerlineStrokeColor || '#000000',
        strokeWidth: options.centerlineStrokeWidth || 2,
        adaptive: options.centerlineAdaptive,
        blackOnWhite: options.centerlineBlackOnWhite,
      });

      self.postMessage({
        type: 'PROGRESS',
        id,
        stage: 'Optimizando polilíneas de centro para corte y trazado...',
        percent: 70,
      } as WorkerResponse);

      const polylines = centerlinePolylines(raster, {
        adaptive: options.centerlineAdaptive,
        blackOnWhite: options.centerlineBlackOnWhite,
      });

      const dxf = generateCenterlineDxf(polylines, height);
      const pdf = generateCenterlinePdf(
        polylines,
        width,
        height,
        options.centerlineStrokeWidth || 2,
        options.centerlineStrokeColor || '#000000'
      );
      const executionTimeMs = Math.round(performance.now() - startTime);
      const fileSizeBytes = new Blob([clResult.svg]).size;
      const nodesCount = (clResult.svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;

      const palette: PaletteColor[] = [
        {
          hex: options.centerlineStrokeColor || '#000000',
          r: 0,
          g: 0,
          b: 0,
          a: 255,
          count: clResult.inkPixels,
          percentage: 100,
        },
      ];

      const result: VectorResult = {
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
        palette,
        isCenterline: true,
        centerlineLength: Math.round(clResult.length),
        estimatedSsim: 0.95,
      };

      self.postMessage({
        type: 'SUCCESS',
        id,
        result,
      } as WorkerResponse);
      return;
    }

    // =========================================================================
    // CASE B: Standard Outline Tracing (Vecline / ImageTracerJS)
    // =========================================================================
    self.postMessage({
      type: 'PROGRESS',
      id,
      stage: 'Analizando imagen y cuantizando colores (espacio Oklab)...',
      percent: 20,
    } as WorkerResponse);

    // Extract palette using Vecline's perceptual clustering
    const rawPalette = extractPalette(raster, Math.min(options.colors, 64)) || [];
    const palette: PaletteColor[] = rawPalette.map((p) => ({
      hex: p.hex,
      r: p.rgb.r,
      g: p.rgb.g,
      b: p.rgb.b,
      a: p.rgb.a,
      count: Math.round(p.weight * width * height),
      percentage: Math.round(p.weight * 100),
    }));

    let svg = '';
    let shapes = 0;
    let colors = options.colors;
    let regions = 0;
    let nodesCount = 0;
    let dxf: string | undefined;
    let eps: string | undefined;
    let pdf: Uint8Array | undefined;

    if (options.engine === 'imagetracer') {
      self.postMessage({
        type: 'PROGRESS',
        id,
        stage: 'Trazando caminos con ImageTracerJS...',
        percent: 60,
      } as WorkerResponse);

      const itOptions = {
        numberofcolors: options.colors,
        scale: 1,
        blurradius: options.blurRadius ?? 0,
        blurdelta: 20,
        pathomit: options.minArea,
        linefilter: true,
        corsenabled: false,
      };

      svg = ImageTracer.imagedataToSVG(
        { width, height, data } as unknown as ImageData,
        itOptions
      );
      shapes = (svg.match(/<path/g) || []).length;
      nodesCount = (svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
    } else {
      // Vecline Engine with sub-pixel curve fitting (Vector Magic standard)
      self.postMessage({
        type: 'PROGRESS',
        id,
        stage: 'Extrayendo fronteras topológicas y curvas sub-pixel...',
        percent: 50,
      } as WorkerResponse);

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

      const traceRes = trace(raster, traceOptions);
      svg = traceRes.svg;
      shapes = traceRes.shapes;
      colors = traceRes.colors;
      regions = traceRes.regions;

      self.postMessage({
        type: 'PROGRESS',
        id,
        stage: 'Ajustando splines de Bézier y calculando métricas...',
        percent: 80,
      } as WorkerResponse);

      try {
        nodesCount = countPathNodes(svg);
      } catch {
        nodesCount = (svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
      }

      // Generate DXF, EPS, and Vector PDF
      try {
        const geometry = traceGeometry(raster, traceOptions);
        dxf = toDxf(geometry);
        eps = toEps(geometry);
        pdf = toPdf(geometry);
      } catch {
        // Optional export formats
      }
    }

    self.postMessage({
      type: 'PROGRESS',
      id,
      stage: 'Finalizando optimización SVG...',
      percent: 95,
    } as WorkerResponse);

    const executionTimeMs = Math.round(performance.now() - startTime);
    const fileSizeBytes = new Blob([svg]).size;

    const estimatedSsim = Math.min(
      0.9999,
      0.92 + (options.subpixel ? 0.04 : 0) + (options.colors >= 16 ? 0.03 : 0.01)
    );

    const vectorResult: VectorResult = {
      svg,
      originalSvg: svg,
      shapes,
      colors,
      regions,
      nodesCount,
      executionTimeMs,
      fileSizeBytes,
      rasterSizeBytes,
      dxf,
      eps,
      pdf,
      palette,
      estimatedSsim,
      isCenterline: false,
    };

    self.postMessage({
      type: 'SUCCESS',
      id,
      result: vectorResult,
    } as WorkerResponse);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'ERROR',
      id,
      error: errorMsg,
    } as WorkerResponse);
  }
};
