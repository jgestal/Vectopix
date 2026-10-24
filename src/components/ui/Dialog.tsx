import React, { useId } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';

interface DialogProps {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Modal dialog: title, close button, scrollable body, optional footer. */
export const Dialog: React.FC<DialogProps> = ({ title, onClose, footer, className = '', children }) => {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('export.close')} title={t('export.close')}>
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
};
