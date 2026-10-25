/**
 * Errors the app reports to people. Each has a code (the UI's translation
 * key for it) and the values its message needs. Adapters throw these; the UI
 * turns any error into a message in one place (ui/errors.ts).
 */
export type AppErrorCode =
  | 'error.fileRead'
  | 'error.fileTooLarge'
  | 'error.imageDecode'
  | 'error.unsupportedFormat'
  | 'error.remoteImage'
  | 'error.workerCrashed'
  | 'export.pngError';

export type AppErrorParams = Record<string, string | number>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly params?: AppErrorParams;

  constructor(code: AppErrorCode, params?: AppErrorParams, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'AppError';
    this.code = code;
    this.params = params;
  }
}

/** A trace superseded by a newer one: expected, never reported. */
export class VectorizationCanceledError extends Error {
  constructor() {
    super('Vectorization superseded by a newer request');
    this.name = 'VectorizationCanceledError';
  }
}
