import { createEngine } from '../engine';
import type { WorkerMessage, WorkerResponse } from './protocol';

const post = (response: WorkerResponse) => self.postMessage(response);
const engine = createEngine();

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'VECTORIZE': {
        const raster = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.buffer) };
        const result = engine.vectorizer.vectorize(raster, msg.options, (stage, percent) =>
          post({ type: 'PROGRESS', id: msg.id, stage, percent })
        );
        post({ type: 'SUCCESS', id: msg.id, result });
        break;
      }

      case 'MEASURE': {
        const { width, height } = msg;
        const ssim = engine.similarity.ssim(
          { width, height, data: new Uint8ClampedArray(msg.reference) },
          { width, height, data: new Uint8ClampedArray(msg.candidate) }
        );
        post({ type: 'MEASURE_RESULT', id: msg.id, ssim });
        break;
      }
    }
  } catch (err: unknown) {
    post({ type: 'ERROR', id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
};
