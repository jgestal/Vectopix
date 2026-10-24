import React from 'react';
import { Keyboard } from 'pixelarticons/react';
import { useI18n, type MessageKey } from '../i18n';
import { RetroDialog } from './retro/RetroWindow';

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
    { key: 'F1 / ?', desc: 'shortcuts.help' },
  ];

  return (
    <RetroDialog
      title={t('shortcuts.title')}
      icon={<Keyboard width={16} height={16} />}
      onClose={onClose}
      closeLabel={t('export.close')}
      className="shortcuts-window"
    >
      <p className="dialog-intro">{t('shortcuts.subtitle')}</p>
      <div className="r-field shortcuts-table">
        {shortcuts.map((sc) => (
          <div key={sc.desc} className="shortcut-row">
            <span className="shortcut-desc">{t(sc.desc)}</span>
            <kbd className="shortcut-key">{sc.key}</kbd>
          </div>
        ))}
      </div>
      <div className="r-dialog-footer">
        <button className="r-btn is-default" onClick={onClose} autoFocus>
          {t('shortcuts.gotIt')}
        </button>
      </div>
    </RetroDialog>
  );
};
