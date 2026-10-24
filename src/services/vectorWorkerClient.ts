import type {
  VectorOptions,
  VectorResult,
  WorkerMessage,
  WorkerResponse,
  WorkerProgress,
} from '../types/vector';
import { vectorizeImage } from './vectorEngine';

let workerInstance: Worker | null = null;
let currentRequestId = 0;
let pendingReject: ((reason?: unknown) => void) | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/vector.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

export function vectorizeWithWorker(
  imageData: ImageData,
  rasterSizeBytes: number,
  options: VectorOptions,
  onProgress?: (progress: WorkerProgress) => void
): Promise<VectorResult> {
  // If workers are not supported (e.g. testing environments), fallback to direct engine
  if (typeof Worker === 'undefined') {
    return vectorizeImage(imageData, options);
  }

  // Cancel any previous pending request
  if (pendingReject) {
    pendingReject(new Error('Canceled by subsequent vectorization request'));
    pendingReject = null;
  }

  const id = `req_${++currentRequestId}`;
  const worker = getWorker();

  return new Promise<VectorResult>((resolve, reject) => {
    pendingReject = reject;

    const handleMessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;
      if (response.id !== id) return;

      if (response.type === 'PROGRESS') {
        onProgress?.({
          stage: response.stage,
          percent: response.percent,
        });
      } else if (response.type === 'SUCCESS') {
        worker.removeEventListener('message', handleMessage);
        pendingReject = null;
        resolve(response.result);
      } else if (response.type === 'ERROR') {
        worker.removeEventListener('message', handleMessage);
        pendingReject = null;
        reject(new Error(response.error));
      }
    };

    worker.addEventListener('message', handleMessage);

    // Clone the buffer to transfer to worker
    const buffer = imageData.data.buffer.slice(0);

    const message: WorkerMessage = {
      type: 'VECTORIZE',
      id,
      width: imageData.width,
      height: imageData.height,
      buffer,
      rasterSizeBytes,
      options,
    };

    worker.postMessage(message, [buffer]);
  });
}
