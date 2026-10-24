import { vectorizeRaster, exportTrace, measureSsim, type TraceContext } from '../services/vectorEngine';
import type { WorkerMessage, WorkerResponse } from '../types/vector';

// Context of the latest finished trace, so exports are built on demand
// instead of tracing the image a second time for every result.
let lastTrace: TraceContext | null = null;

const post = (response: WorkerResponse, transfer: Transferable[] = []) =>
  self.postMessage(response, { transfer });

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'VECTORIZE': {
        const raster = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.buffer) };
        const { result, context } = vectorizeRaster(raster, msg.options, (stage, percent) =>
          post({ type: 'PROGRESS', id: msg.id, stage, percent })
        );
        lastTrace = context;
        post({ type: 'SUCCESS', id: msg.id, result });
        break;
      }

      case 'EXPORT': {
        if (!lastTrace) throw new Error('No trace available to export');
        const data = exportTrace(lastTrace, msg.format);
        post(
          { type: 'EXPORT_RESULT', id: msg.id, data },
          typeof data === 'string' ? [] : [data.buffer as ArrayBuffer]
        );
        break;
      }

      case 'MEASURE': {
        const { width, height } = msg;
        const ssim = measureSsim(
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
