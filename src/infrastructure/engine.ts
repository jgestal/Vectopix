import { createVectorizer, pixelGridTracer, type Vectorizer } from '../application/vectorizeImage';
import type { SimilarityMetric } from '../application/ports';
import {
  veclineBackground,
  veclineCenterlineTracer,
  veclineOutlineTracer,
  veclinePreprocessor,
  veclineQuantizer,
  veclineSimilarity,
} from './vecline/adapters';
import { imageTracerOutlineTracer } from './imagetracer/outlineTracer';

/** The engine as it runs in the app: the vectorization use case wired to vecline and ImageTracerJS. */
export function createEngine(): { vectorizer: Vectorizer; similarity: SimilarityMetric } {
  return {
    vectorizer: createVectorizer({
      preprocessor: veclinePreprocessor,
      quantizer: veclineQuantizer,
      background: veclineBackground,
      tracers: { vecline: veclineOutlineTracer, imagetracer: imageTracerOutlineTracer, pixelGrid: pixelGridTracer },
      centerline: veclineCenterlineTracer,
      clock: () => performance.now(),
    }),
    similarity: veclineSimilarity,
  };
}
