import { decodeFallback, decodeTgaFallback } from 'vecline/core';
import { LocalizedError } from '../i18n/errors';

/** Hard limit on the file itself; huge images are also downscaled after decoding. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Formats the file picker offers besides image/*, decoded by vecline when the browser can't. */
export const EXTRA_IMAGE_EXTENSIONS = ['.tga', '.ppm', '.pgm', '.pbm', '.pnm', '.ico', '.bmp'];

/** Drag type that carries a built-in sample id between the gallery and the drop zone. */
export const SAMPLE_DRAG_TYPE = 'application/x-vectopix-sample';

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new LocalizedError('error.fileRead'));
    reader.readAsDataURL(blob);
  });
}

function browserCanDecode(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

function rasterToDataUrl(raster: { width: number; height: number; data: Uint8ClampedArray }): string {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  return canvas.toDataURL('image/png');
}

function formatLabel(name: string, type: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return (ext || type.replace(/^image\//, '') || '?').toUpperCase();
}

/**
 * Read any image file as a data URL the app can display and trace. The
 * browser's own decoders come first; formats it lacks (TGA, PNM…) go through
 * vecline. The MIME type is not trusted either way: some systems leave it
 * empty, so every file is simply tried.
 */
export async function readImageFile(file: Blob & { name?: string }): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new LocalizedError('error.fileTooLarge');

  const dataUrl = await readAsDataUrl(file);
  if (await browserCanDecode(dataUrl)) return dataUrl;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = decodeFallback(bytes) ?? decodeTgaFallback(bytes);
  if (decoded?.image) return rasterToDataUrl(decoded.image);

  throw new LocalizedError('error.unsupportedFormat', { format: formatLabel(file.name ?? '', file.type) });
}

export type DroppedImage =
  | { kind: 'sample'; id: string }
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

/**
 * What the user dropped: a file from the system, a built-in sample dragged
 * from the gallery, or an image dragged from a web page (as its URL).
 */
export function readDrop(dataTransfer: DataTransfer): DroppedImage | null {
  const sample = dataTransfer.getData(SAMPLE_DRAG_TYPE);
  if (sample) return { kind: 'sample', id: sample };

  const file = dataTransfer.files?.[0];
  if (file) return { kind: 'file', file };

  const url = dataTransfer
    .getData('text/uri-list')
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith('#'));
  if (url && /^(data:image\/|https?:)/i.test(url)) return { kind: 'url', url };

  return null;
}

/** Fetch an image dragged from a web page. Many sites forbid this (CORS). */
export async function fetchImage(url: string): Promise<File> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const name = url.startsWith('data:') ? 'image.png' : decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image');
    return new File([blob], name, { type: blob.type });
  } catch {
    throw new LocalizedError('error.remoteImage');
  }
}
