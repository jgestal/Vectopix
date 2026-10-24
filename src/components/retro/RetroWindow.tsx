import React from 'react';
import { Close } from 'pixelarticons/react';

interface RetroWindowProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  onHelp?: () => void;
  helpLabel?: string;
  /** Extra content on the right of the title bar, before the buttons. */
  titleExtra?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** A Windows 98 style window: navy title bar, bevelled grey frame. */
export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  icon,
  onClose,
  closeLabel,
  onHelp,
  helpLabel,
  titleExtra,
  className = '',
  bodyClassName = '',
  children,
}) => (
  <section className={`r-window ${className}`} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
    <header className="r-titlebar">
      {icon && <span className="r-titlebar-icon">{icon}</span>}
      <span className="r-titlebar-text">{title}</span>
      {titleExtra}
      {(onHelp || onClose) && (
        <div className="r-titlebar-buttons">
          {onHelp && (
            <button className="r-titlebar-btn" onClick={onHelp} title={helpLabel} aria-label={helpLabel}>
              ?
            </button>
          )}
          {onClose && (
            <button className="r-titlebar-btn" onClick={onClose} title={closeLabel} aria-label={closeLabel}>
              <Close width={12} height={12} />
            </button>
          )}
        </div>
      )}
    </header>
    <div className={`r-window-body ${bodyClassName}`}>{children}</div>
  </section>
);

/** A RetroWindow centred over a dimmed backdrop; clicking outside closes it. */
export const RetroDialog: React.FC<RetroWindowProps & { onClose: () => void }> = (props) => (
  <div className="r-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
    <RetroWindow {...props} />
  </div>
);

/** The app icon; 16 px by default, the title bar size. */
export const AppIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <img
    src={`${import.meta.env.BASE_URL}favicon.svg`}
    alt=""
    width={size}
    height={size}
    style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
  />
);
