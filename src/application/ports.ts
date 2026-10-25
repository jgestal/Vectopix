import type { Raster } from '../domain/raster/raster';
import type { MenuPlatform, MenuSection } from '../domain/menu';
import type { AppCommand } from '../domain/commands';
import type { ThemePreference } from '../domain/theme';
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
  remove(key: string): void;
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

/**
 * How a save ended: a download (the browser puts it in Downloads), a file
 * written where the person chose (desktop app), or cancelled in the dialog.
 * `fileName` is the name the file got, which the person may have changed.
 */
export type SaveOutcome = { status: 'downloaded' | 'saved'; fileName: string } | { status: 'cancelled' };

/** Hands files, text and images to the person: saving, the clipboard, dragging out. */
export interface FileSaver {
  save(content: string | Uint8Array | Blob, fileName: string, mimeType: string): Promise<SaveOutcome>;
  copyText(text: string): Promise<void>;
  /** An image (PNG) to the clipboard, to paste into documents and chats. */
  copyImage(png: Blob): Promise<void>;
  /** Make a drag that started on the page carry a file out of the app. */
  dragOut(event: DragEvent, fileName: string, content: string, mimeType: string): void;
}

// ── Desktop app ─────────────────────────────────────────────────────────────

/** A menu ready to show: labels translated, everything else as the domain built it. */
export type TranslatedMenu = MenuSection[];

/** What to ask before closing a window with work that would be lost. */
export interface CloseConfirmation {
  title: string;
  message: string;
  discard: string;
  cancel: string;
}

/**
 * The desktop app's shell (Electron): the native menu bar, files the system
 * hands over (recent files, the Dock) and closing with unsaved work.
 * Absent on the web.
 */
export interface DesktopShell {
  readonly platform: MenuPlatform;
  readonly isDevelopment: boolean;
  setMenu(menu: TranslatedMenu): void;
  /** Menu clicks; returns the unsubscribe function. */
  onCommand(handler: (command: AppCommand) => void): () => void;
  /** Files opened through the system (Open Recent, the Dock, the file manager). */
  onOpenFile(handler: (file: File) => void): () => void;
  /** Add a file the user opened to the system's recent files. */
  rememberFile(file: File): void;
  /**
   * Ask before closing while `confirm` is set; never ask when null. Set also
   * marks the window as having unsaved changes (the dot in macOS's close button).
   */
  setCloseConfirmation(confirm: CloseConfirmation | null): void;
  /** Progress of the work in hand on the Dock / taskbar icon (0–1); null hides it. */
  setProgress(fraction: number | null): void;
  /** Native menus and dialogs in the app's theme. */
  setTheme(preference: ThemePreference): void;
}
