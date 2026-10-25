import type { VectorOptions, VectorResult, WorkerProgress } from '../../domain/types';
import type { Raster } from '../../domain/raster/raster';
import type { VectorizationService } from '../../application/ports';
import { rasterizeForComparison } from '../browser/fidelity';
import type { WorkerMessage, WorkerResponse } from './protocol';
import { AppError, VectorizationCanceledError } from '../../application/errors';

interface PendingRequest {
  resolve: (response: WorkerResponse) => void;
  reject: (reason: Error) => void;
  onProgress?: (progress: WorkerProgress) => void;
}

let worker: Worker | null = null;
let requestCounter = 0;
let activeTraceId: string | null = null;
const pending = new Map<string, PendingRequest>();

function rejectAll(reason: Error) {
  for (const req of pending.values()) req.reject(reason);
  pending.clear();
  activeTraceId = null;
}

function resetWorker(reason: Error) {
  worker?.terminate();
  worker = null;
  rejectAll(reason);
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./vector.worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const response = e.data;
    const req = pending.get(response.id);
    if (!req) return;

    if (response.type === 'PROGRESS') {
      req.onProgress?.({ stage: response.stage, percent: response.percent });
      return;
    }

    pending.delete(response.id);
    if (response.id === activeTraceId) activeTraceId = null;
    if (response.type === 'ERROR') req.reject(new Error(response.error));
    else req.resolve(response);
  };

  // A crash (e.g. out of memory on a huge image) would otherwise leave every
  // caller waiting forever.
  worker.onerror = (e) => {
    e.preventDefault();
    resetWorker(new AppError('error.workerCrashed'));
  };

  return worker;
}

function send(
  message: WorkerMessage,
  transfer: Transferable[] = [],
  onProgress?: (progress: WorkerProgress) => void
): Promise<WorkerResponse> {
  const target = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(message.id, { resolve, reject, onProgress });
    target.postMessage(message, transfer);
  });
}

const nextId = (prefix: string) => `${prefix}_${++requestCounter}`;

async function vectorizeWithWorker(
  imageData: Raster,
  rasterSizeBytes: number,
  options: VectorOptions,
  onProgress?: (progress: WorkerProgress) => void
): Promise<VectorResult> {
  // The engine is synchronous inside the worker, so a running trace cannot be
  // interrupted cooperatively: terminating the worker is the only real cancel.
  if (activeTraceId) resetWorker(new VectorizationCanceledError());

  const id = nextId('trace');
  activeTraceId = id;
  const buffer = imageData.data.slice().buffer;

  const response = await send(
    { type: 'VECTORIZE', id, width: imageData.width, height: imageData.height, buffer, options },
    [buffer],
    onProgress
  );
  if (response.type !== 'SUCCESS') throw new Error('Unexpected engine response');
  return { ...response.result, rasterSizeBytes };
}

/** SSIM between two same-sized images, computed off the main thread. */
async function measureSsimWithWorker(reference: Raster, candidate: Raster): Promise<number> {
  const ref = reference.data.slice().buffer;
  const cand = candidate.data.slice().buffer;
  const response = await send(
    {
      type: 'MEASURE',
      id: nextId('measure'),
      width: reference.width,
      height: reference.height,
      reference: ref,
      candidate: cand,
    },
    [ref, cand]
  );
  if (response.type !== 'MEASURE_RESULT') throw new Error('Unexpected engine response');
  return response.ssim;
}

/** The engine in a Web Worker: the UI never freezes, and a superseded trace is really stopped. */
export const workerVectorization: VectorizationService = {
  vectorize: vectorizeWithWorker,
  async measureFidelity(source, svg) {
    const { reference, candidate } = await rasterizeForComparison(source, svg);
    return measureSsimWithWorker(reference, candidate);
  },
};
