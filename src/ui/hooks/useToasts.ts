import { useCallback, useRef, useState } from 'react';
import type { ToastMessage } from '../types';
import { useI18n, type MessageKey } from '../../i18n';
import { errorMessage } from '../errors';

/** How long a notice stays up. */
const TOAST_MS = 2800;

export type ShowToast = (text: string, type?: ToastMessage['type']) => void;

/** Short notices, plus the app's single way of reporting an error to the user. */
export function useToasts() {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), []);

  const showToast: ShowToast = useCallback(
    (text, type = 'info') => {
      const id = `toast_${++counter.current}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => dismissToast(id), TOAST_MS);
    },
    [dismissToast]
  );

  /** Tell the user what went wrong (if it's worth telling). */
  const reportError = useCallback(
    (err: unknown, fallback?: MessageKey) => {
      const message = errorMessage(err, t, fallback);
      if (message) showToast(message, 'warning');
    },
    [showToast, t]
  );

  return { toasts, showToast, dismissToast, reportError };
}
