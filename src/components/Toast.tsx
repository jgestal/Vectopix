import React from 'react';
import { CircleInfo, Check, WarningDiamond } from 'pixelarticons/react';
import type { ToastMessage } from '../types/vector';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/** Notifications as the yellow balloon tips of the Windows system tray. */
export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className={`toast-balloon toast-${toast.type || 'info'}`} onClick={() => onDismiss(toast.id)}>
          {toast.type === 'success' && <Check width={24} height={24} className="r-icon" />}
          {toast.type === 'warning' && <WarningDiamond width={24} height={24} className="r-icon" />}
          {(!toast.type || toast.type === 'info') && <CircleInfo width={24} height={24} className="r-icon" />}
          <span className="toast-text">{toast.text}</span>
        </button>
      ))}
    </div>
  );
};
