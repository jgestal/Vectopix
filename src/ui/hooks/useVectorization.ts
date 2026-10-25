import { useCallback, useRef, useState } from 'react';
import type { Raster } from '../../domain/raster/raster';
import type { VectorOptions, VectorResult, WorkerProgress } from '../../domain/types';
import { useServices } from '../services/context';

interface Callbacks {
  /** A trace finished and is the newest (not superseded). */
  onTraced(result: VectorResult, options: VectorOptions): void;
  /** Its fidelity, measured afterwards in the background. */
  onFidelity(tracedSvg: string, ssim: number): void;
  onError(err: unknown): void;
}

/**
 * Runs traces in the engine. Only the newest trace counts: an older one still
 * running is cancelled by the engine, and one that finishes late is ignored.
 */
export function useVectorization({ onTraced, onFidelity, onError }: Callbacks) {
  const { vectorization } = useServices();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const latest = useRef(0);

  const run = useCallback(
    async (image: Raster, sizeBytes: number, options: VectorOptions) => {
      const id = ++latest.current;
      const isCurrent = () => id === latest.current;
      setIsProcessing(true);
      setProgress({ stage: 'progress.start', percent: 5 });
      try {
        const result = await vectorization.vectorize(image, sizeBytes, options, setProgress);
        if (!isCurrent()) return;
        onTraced(result, options);
        // Fidelity is informative only: a failed measurement just isn't shown
        vectorization
          .measureFidelity(image, result.svg)
          .then((ssim) => isCurrent() && onFidelity(result.svg, ssim))
          .catch(() => {});
      } catch (err) {
        onError(err);
      } finally {
        if (isCurrent()) {
          setIsProcessing(false);
          setProgress(null);
        }
      }
    },
    [vectorization, onTraced, onFidelity, onError]
  );

  /** Forget the trace in flight (e.g. an undo restored another result). */
  const cancel = useCallback(() => {
    latest.current++;
    setIsProcessing(false);
    setProgress(null);
  }, []);

  return { run, cancel, isProcessing, progress };
}
