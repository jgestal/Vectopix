import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useI18n, type MessageKey } from '../i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const shortcuts: { key: string; desc: MessageKey }[] = [
    { key: t('shortcuts.keySpaceDrag'), desc: 'shortcuts.pan' },
    { key: t('shortcuts.keyWheel'), desc: 'shortcuts.zoom' },
    { key: 'S', desc: 'shortcuts.split' },
    { key: 'D', desc: 'shortcuts.sideBySide' },
    { key: 'W', desc: 'shortcuts.wireframe' },
    { key: 'E / N', desc: 'shortcuts.nodes' },
    { key: t('shortcuts.keyClickNode'), desc: 'shortcuts.selectNode' },
    { key: t('shortcuts.keyDelete'), desc: 'shortcuts.deleteNode' },
    { key: 'Cmd/Ctrl + Z', desc: 'shortcuts.undo' },
    { key: 'Cmd/Ctrl + Shift + Z', desc: 'shortcuts.redo' },
    { key: 'Cmd/Ctrl + C', desc: 'shortcuts.copy' },
    { key: 'Cmd/Ctrl + V', desc: 'shortcuts.paste' },
    { key: 'Esc', desc: 'shortcuts.escape' },
    { key: '?', desc: 'shortcuts.help' },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="title-with-icon">
              <Keyboard size={18} className="text-cyan" />
              <h2 className="modal-title">{t('shortcuts.title')}</h2>
            </div>
            <span className="modal-subtitle">
              {t('shortcuts.subtitle')}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {shortcuts.map((sc, i) => (
            <div key={i} className="shortcut-row">
              <span className="shortcut-desc">{t(sc.desc)}</span>
              <kbd className="shortcut-key">{sc.key}</kbd>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            {t('shortcuts.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};
