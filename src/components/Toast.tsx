import React from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import type { ToastMessage } from '../types/vector';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-pill toast-${toast.type || 'info'}`}>
          {toast.type === 'success' && <CheckCircle2 size={15} className="text-emerald" />}
          {toast.type === 'warning' && <AlertTriangle size={15} className="text-amber" />}
          {(!toast.type || toast.type === 'info') && <Info size={15} className="text-cyan" />}
          <span className="toast-text">{toast.text}</span>
        </div>
      ))}
    </div>
  );
};
