import { useCallback, useEffect, useRef } from 'react';
import type { Raster } from '../../domain/raster/raster';
import type { VectorOptions } from '../../domain/types';

/** Delay before re-tracing after a setting changes, so sliders don't flood the engine. */
const RETRACE_DEBOUNCE_MS = 400;

type Traceable = { pixels: Raster; sizeBytes: number };

/**
 * Re-trace whenever the image or a setting changes: a new image at once,
 * setting changes debounced so dragging a slider traces only once. Settings
 * restored by undo/redo come with their result and are not traced again.
 */
export function useAutoRetrace<T extends Traceable>(image: T | null, options: VectorOptions, run: (pixels: Raster, sizeBytes: number, options: VectorOptions) => void) {
  const restoredOptions = useRef<VectorOptions | null>(null);
  const lastTracedImage = useRef<T | null>(null);

  useEffect(() => {
    if (!image) return;
    if (restoredOptions.current === options) {
      restoredOptions.current = null;
      return;
    }
    const isNewImage = lastTracedImage.current !== image;
    lastTracedImage.current = image;
    const timer = setTimeout(() => run(image.pixels, image.sizeBytes, options), isNewImage ? 0 : RETRACE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [image, options, run]);

  return {
    /** Trace now, with the current settings. */
    retrace: () => image && run(image.pixels, image.sizeBytes, options),
    /** These settings are being restored with their result: don't trace them. */
    skipTraceFor: useCallback((restored: VectorOptions) => {
      restoredOptions.current = restored;
    }, []),
  };
}
