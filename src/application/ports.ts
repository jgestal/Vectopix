import type { Raster } from '../domain/raster/raster';
import type { PaletteCandidate, Rgb } from '../domain/palette/colors';
import type { ComponentFramework } from '../domain/export/exportFiles';
import type { ExportFormat, ProgressStage, VectorOptions, VectorResult, WorkerProgress } from '../domain/types';

/**
 * Ports: what the use cases need from the outside world, stated in their own
 * terms. Infrastructure implements them; tests implement them with fakes.
 */

/** Key-value persistence for small settings. Never throws: an unreadable value reads as undefined. */
export interface SettingsStore {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

/** The latest published release, or null if there is none. May throw on network errors. */
export interface ReleaseSource {
  latest(): Promise<{ version: string; url: string } | null>;
}

/** Milliseconds since the epoch. */
export type Clock = () => number;

// ── Vectorization ────────────────────────────────────────────────────────────


/** Finds the colours of an image: at most `maxColors` clusters with their shares. */
export interface ColorQuantizer {
  extract(raster: Raster, maxColors: number): PaletteCandidate[];
}

/** The colour of an image's background (the one touching its border most). */
export interface BackgroundDetector {
  detect(raster: Raster): Rgb;
}

/** Contrast and noise reduction applied before tracing. */
export interface RasterPreprocessor {
  apply(raster: Raster, settings: { contrast: number; denoise: number }): Raster;
}

export interface TracedOutline {
  svg: string;
  shapes: number;
  regions: number;
}

/**
 * Strategy: one way of tracing filled colour regions. `palette` is the
 * selected palette (empty when the tracer should choose `options.colors` itself).
 */
export interface OutlineTracer {
  /** Progress reported while it runs. */
  readonly stage: ProgressStage;
  trace(raster: Raster, palette: PaletteCandidate[], options: VectorOptions): TracedOutline;
}

export interface TracedCenterline {
  svg: string;
  paths: number;
  inkPixels: number;
  length: number;
}

/** Single-stroke tracing along the middle of dark lines. */
export interface CenterlineTracer {
  trace(raster: Raster, options: VectorOptions): TracedCenterline;
}

/** Structural similarity of two same-sized images, 0–1. */
export interface SimilarityMetric {
  ssim(reference: Raster, candidate: Raster): number;
}

// ── Interface services (implemented in the browser) ─────────────────────────

/** Vectorization off the main thread. Rejects with VectorizationCanceledError when superseded. */
export interface VectorizationService {
  vectorize(image: Raster, sizeBytes: number, options: VectorOptions, onProgress?: (progress: WorkerProgress) => void): Promise<VectorResult>;
  /** How closely the SVG, rendered, matches the image (SSIM, 0–1). */
  measureFidelity(source: Raster, svg: string): Promise<number>;
}

export type DroppedImage = { kind: 'sample'; id: string } | { kind: 'file'; file: File } | { kind: 'url'; url: string };

/** Where images come from: files, drops, web pages. Errors are AppErrors. */
export interface ImageSource {
  /** File extensions accepted besides image/*. */
  readonly extraExtensions: readonly string[];
  /** Any image file as a data URL the app can display and trace. */
  readFile(file: Blob & { name?: string }): Promise<string>;
  /** What was dropped: a file, a sample from the gallery or an image from a web page. */
  readDrop(dataTransfer: DataTransfer): DroppedImage | null;
  /** An image dragged from a web page. */
  fetchImage(url: string): Promise<File>;
}

/** Decodes a displayable image to pixels at the size `fit` chooses from its natural size. */
export interface ImageDecoder {
  decode(dataUrl: string, fit: (width: number, height: number) => { width: number; height: number }): Promise<{
    pixels: Raster;
    naturalWidth: number;
    naturalHeight: number;
  }>;
}

/** Draws a built-in sample as a data URL. */
export interface SampleRenderer {
  render(id: string): string;
}

/** Turns the drawing into other formats. */
export interface DrawingExporter {
  /** DXF and EPS as text, PDF as bytes; edits included. */
  cad(svg: string, format: ExportFormat, isCenterline: boolean): Promise<string | Uint8Array>;
  png(svg: string, size: { width: number; height: number }, scale: number, background: string): Promise<Blob>;
  component(svg: string, framework: ComponentFramework): string;
  minify(svg: string): string;
}

/** Hands files and text to the person: downloads, clipboard. */
export interface FileSaver {
  save(content: string | Uint8Array | Blob, fileName: string, mimeType: string): void;
  copyText(text: string): Promise<void>;
}
