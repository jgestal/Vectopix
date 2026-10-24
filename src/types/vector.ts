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
  centerlineLineCap: 'round' | 'square' | 'butt';
  centerlineLineJoin: 'round' | 'miter' | 'bevel';
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
  dxf?: string;
  eps?: string;
  pdf?: string | Uint8Array;
  palette: PaletteColor[];
  estimatedSsim?: number;
  isCenterline?: boolean;
  centerlineLength?: number;
}

export interface WorkerProgress {
  stage: string;
  percent: number;
}

export type WorkerMessage =
  | {
      type: 'VECTORIZE';
      id: string;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      rasterSizeBytes: number;
      options: VectorOptions;
    }
  | {
      type: 'CANCEL';
    };

export type WorkerResponse =
  | {
      type: 'PROGRESS';
      id: string;
      stage: string;
      percent: number;
    }
  | {
      type: 'SUCCESS';
      id: string;
      result: VectorResult;
    }
  | {
      type: 'ERROR';
      id: string;
      error: string;
    };

export interface SampleImageItem {
  id: string;
  title: string;
  category: string;
  description: string;
  url: string;
  preset: VectorPreset;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}
