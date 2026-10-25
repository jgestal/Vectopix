import type { Raster } from './raster';

/** Share of border pixels that must be transparent for the image to have a transparent background. */
const TRANSPARENT_BORDER_SHARE = 0.5;

/**
 * Whether the image already has a transparent background (a PNG cut-out):
 * most of its border is transparent. Such an image needs no background removed.
 */
export function hasTransparentBorder(raster: Raster): boolean {
  const { width: W, height: H, data } = raster;
  let border = 0;
  let clear = 0;
  const visit = (x: number, y: number) => {
    border++;
    if (data[(y * W + x) * 4 + 3] < 128) clear++;
  };
  for (let x = 0; x < W; x++) {
    visit(x, 0);
    if (H > 1) visit(x, H - 1);
  }
  for (let y = 1; y < H - 1; y++) {
    visit(0, y);
    if (W > 1) visit(W - 1, y);
  }
  return border > 0 && clear / border > TRANSPARENT_BORDER_SHARE;
}
