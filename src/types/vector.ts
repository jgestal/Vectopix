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

export type ViewMode = 'split' | 'vector' | 'raster' | 'side-by-side';

export type RenderMode = 'full' | 'wireframe' | 'nodes';

export interface VectorOptions {
  engine: TracingEngine;
  traceMethod: TraceMethod;
  preset: VectorPreset;
  colors: number;
  subpixel: boolean;
  tolerance: number;
  fitError: number;
  cornerAngle: number;
  minArea: number;
  refineIterations: number;
  smooth: number;
  background: boolean;
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

export type WorkerMessage =
  | {
      type: 'VECTORIZE';
      id: string;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      options: VectorOptions;
    }
  | {
      type: 'EXPORT';
      id: string;
      format: ExportFormat;
    }
  | {
      type: 'MEASURE';
      id: string;
      width: number;
      height: number;
      reference: ArrayBuffer;
      candidate: ArrayBuffer;
    };

export type WorkerResponse =
  | {
      type: 'PROGRESS';
      id: string;
      stage: ProgressStage;
      percent: number;
    }
  | {
      type: 'SUCCESS';
      id: string;
      result: VectorResult;
    }
  | {
      type: 'EXPORT_RESULT';
      id: string;
      data: string | Uint8Array;
    }
  | {
      type: 'MEASURE_RESULT';
      id: string;
      ssim: number;
    }
  | {
      type: 'ERROR';
      id: string;
      error: string;
    };

/** Built-in sample; its title and texts live in the i18n catalogue (sample.{id}.*). */
export interface SampleImageItem {
  id: string;
  preset: VectorPreset;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}
