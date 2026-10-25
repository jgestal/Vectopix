import { isSmallImage, traceSize } from '../domain/images';
import { hasTransparentBorder } from '../domain/raster/transparency';
import type { Raster } from '../domain/raster/raster';
import type { ImageDecoder } from './ports';

/** Something worth telling the user about an image they loaded (UI translation key + values). */
export type ImageNotice =
  | { code: 'toast.imageDownscaled'; params: { from: string; to: string } }
  | { code: 'toast.smallImage'; params: { size: string } };

export interface PreparedImage {
  pixels: Raster;
  width: number;
  height: number;
  /** Already transparent around the subject (a PNG cut-out). */
  isCutOut: boolean;
  notices: ImageNotice[];
}

const dims = (w: number, h: number) => `${w}×${h}`;

/** Decode a loaded image at the size it will be traced at, and note what the user should know. */
export async function prepareImage(dataUrl: string, decoder: ImageDecoder): Promise<PreparedImage> {
  const { pixels, naturalWidth, naturalHeight } = await decoder.decode(dataUrl, traceSize);
  const { width, height } = pixels;
  const notices: ImageNotice[] = [];
  if (width !== naturalWidth || height !== naturalHeight) {
    notices.push({ code: 'toast.imageDownscaled', params: { from: dims(naturalWidth, naturalHeight), to: dims(width, height) } });
  }
  if (isSmallImage(width, height)) notices.push({ code: 'toast.smallImage', params: { size: dims(width, height) } });
  return { pixels, width, height, isCutOut: hasTransparentBorder(pixels), notices };
}
