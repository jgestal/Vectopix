import type {
  VectorOptions,
  VectorResult,
  WorkerMessage,
  WorkerResponse,
  WorkerProgress,
} from '../types/vector';
import { LocalizedError } from '../i18n/errors';

/** Rejection reason when a trace is superseded by a newer one. */
export class VectorizationCanceledError extends Error {
  constructor() {
    super('Vectorization superseded by a newer request');
    this.name = 'VectorizationCanceledError';
  }
}

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

  worker = new Worker(new URL('../workers/vector.worker.ts', import.meta.url), { type: 'module' });

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
    resetWorker(new LocalizedError('error.workerCrashed'));
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

export async function vectorizeWithWorker(
  imageData: ImageData,
  rasterSizeBytes: number,
  options: VectorOptions,
  onProgress?: (progress: WorkerProgress) => void
): Promise<VectorResult> {
  // The engine is synchronous inside the worker, so a running trace cannot be
  // interrupted cooperatively: terminating the worker is the only real cancel.
  if (activeTraceId) resetWorker(new VectorizationCanceledError());

  const id = nextId('trace');
  activeTraceId = id;
  const buffer = imageData.data.buffer.slice(0);

  const response = await send(
    { type: 'VECTORIZE', id, width: imageData.width, height: imageData.height, buffer, options },
    [buffer],
    onProgress
  );
  if (response.type !== 'SUCCESS') throw new Error('Unexpected engine response');
  return { ...response.result, rasterSizeBytes };
}

/** SSIM between two same-sized images, computed off the main thread. */
export async function measureSsimWithWorker(reference: ImageData, candidate: ImageData): Promise<number> {
  const ref = reference.data.buffer.slice(0);
  const cand = candidate.data.buffer.slice(0);
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
