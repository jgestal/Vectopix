import { AppError, VectorizationCanceledError, type AppErrorCode } from '../application/errors';
import type { MessageKey, Translate } from '../i18n';

// Every error code must be a message in the catalogue: checked by the compiler
const _codesAreMessages: MessageKey = '' as AppErrorCode;
void _codesAreMessages;

/**
 * The one place errors become words. Null means "say nothing" (a superseded
 * trace is expected, not a failure). Unknown errors get `fallback`.
 */
export function errorMessage(err: unknown, t: Translate, fallback: MessageKey = 'toast.unknownError'): string | null {
  if (err instanceof VectorizationCanceledError) return null;
  if (err instanceof AppError) return t(err.code, err.params);
  return t(fallback);
}

/**
 * The error itself as a phrase, for messages that wrap it ("Vectorization
 * failed: …"). Null for a superseded trace.
 */
export function errorDetail(err: unknown, t: Translate): string | null {
  if (err instanceof VectorizationCanceledError) return null;
  if (err instanceof AppError) return t(err.code, err.params);
  return err instanceof Error && err.message ? err.message : t('toast.unknownError');
}
