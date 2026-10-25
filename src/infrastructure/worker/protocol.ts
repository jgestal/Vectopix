import type { ProgressStage, VectorOptions, VectorResult } from '../../domain/types';

/** Messages between the UI thread and the engine worker. */

export type WorkerMessage =
  | {
      type: 'VECTORIZE';
      id: string;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      options: VectorOptions;
    }
  | {
      type: 'MEASURE';
      id: string;
      width: number;
      height: number;
      reference: ArrayBuffer;
      candidate: ArrayBuffer;
    };

export type WorkerResponse =
  | {
      type: 'PROGRESS';
      id: string;
      stage: ProgressStage;
      percent: number;
    }
  | {
      type: 'SUCCESS';
      id: string;
      result: VectorResult;
    }
  | {
      type: 'MEASURE_RESULT';
      id: string;
      ssim: number;
    }
  | {
      type: 'ERROR';
      id: string;
      error: string;
    };
