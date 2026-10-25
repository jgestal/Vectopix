export type TracingEngine = 'vecline' | 'imagetracer';

export type TraceMethod = 'outline' | 'centerline';

export type VectorPreset =
  | 'logo'
  | 'flat-art'
  | 'photo'
  | 'sketch'
  | 'pixel-art'
  | 'centerline-sketch'
  | 'custom';

export interface VectorOptions {
  engine: TracingEngine;
  traceMethod: TraceMethod;
  preset: VectorPreset;
  colors: number;
  /** Detect the image's real colours instead of using `colors`. */
  autoColors: boolean;
  /** Refit the traced paths: straight edges, sharp corners, round arcs. */
  refine: boolean;
  subpixel: boolean;
  /** Trace along the pixel grid exactly (pixel art): square corners, no curves. */
  pixelGrid: boolean;
  tolerance: number;
  fitError: number;
  cornerAngle: number;
  minArea: number;
  refineIterations: number;
  smooth: number;
  /** Remove the background (flood-filled from the edges) so the result is transparent. */
  transparentBackground: boolean;
  primitives: boolean;
  gradients: boolean;
  blurRadius?: number;
  // Pre-processing
  contrast: number; // -50 to 50
  denoise: number;  // 0 to 10
  // Centerline specific options
  centerlineStrokeWidth: number;
  centerlineStrokeColor: string;
  centerlineAdaptive: boolean;
  centerlineBlackOnWhite: boolean;
}

export interface PaletteColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
  count: number;
  percentage: number;
}

export interface VectorResult {
  svg: string;
  originalSvg: string;
  shapes: number;
  colors: number;
  regions: number;
  nodesCount: number;
  executionTimeMs: number;
  fileSizeBytes: number;
  rasterSizeBytes: number;
  palette: PaletteColor[];
  /** SSIM measured by rendering the SVG and comparing it with the source raster (0–1). */
  ssim?: number;
  isCenterline?: boolean;
  centerlineLength?: number;
}

/** Translation keys of the stages the engine reports. */
export type ProgressStage =
  | 'progress.start'
  | 'progress.skeleton'
  | 'progress.palette'
  | 'progress.imagetracer'
  | 'progress.boundaries'
  | 'progress.fitting';

export interface WorkerProgress {
  stage: ProgressStage;
  percent: number;
}

export type ExportFormat = 'dxf' | 'eps' | 'pdf';
