import React from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className={`toast toast-${toast.type || 'info'}`} onClick={() => onDismiss(toast.id)}>
          {toast.type === 'success' && <CircleCheck size={16} />}
          {toast.type === 'warning' && <TriangleAlert size={16} />}
          {(!toast.type || toast.type === 'info') && <Info size={16} />}
          <span>{toast.text}</span>
        </button>
      ))}
    </div>
  );
};
