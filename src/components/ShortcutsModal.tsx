import React from 'react';
import { useI18n, type MessageKey } from '../i18n';
import { Dialog } from './ui/Dialog';

export const REPOSITORY_URL = 'https://github.com/jgestal/Vectopix';
/** What changed in the running version. */
export const RELEASE_NOTES_URL = `${REPOSITORY_URL}/releases/tag/v${__APP_VERSION__}`;

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Help: every keyboard shortcut, plus the version and where the code lives. */
export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const shortcuts: { key: string; desc: MessageKey }[] = [
    { key: t('shortcuts.keySpaceDrag'), desc: 'shortcuts.pan' },
    { key: t('shortcuts.keyWheel'), desc: 'shortcuts.zoom' },
    { key: 'S', desc: 'shortcuts.split' },
    { key: 'D', desc: 'shortcuts.sideBySide' },
    { key: 'W', desc: 'shortcuts.wireframe' },
    { key: 'N', desc: 'shortcuts.nodes' },
    { key: t('shortcuts.keyClickNode'), desc: 'shortcuts.selectNode' },
    { key: t('shortcuts.keyDelete'), desc: 'shortcuts.deleteNode' },
    { key: '⌘/Ctrl Z', desc: 'shortcuts.undo' },
    { key: '⌘/Ctrl ⇧ Z', desc: 'shortcuts.redo' },
    { key: '⌘/Ctrl C', desc: 'shortcuts.copy' },
    { key: '⌘/Ctrl V', desc: 'shortcuts.paste' },
    { key: 'Esc', desc: 'shortcuts.escape' },
    { key: '?', desc: 'shortcuts.help' },
  ];

  return (
    <Dialog
      title={t('shortcuts.title')}
      onClose={onClose}
      className="shortcuts-dialog"
      footer={
        <>
          <span className="dialog-footnote">
            <a href={RELEASE_NOTES_URL} target="_blank" rel="noopener noreferrer">
              {t('about.version', { version: __APP_VERSION__ })}
            </a>
            {' — '}
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              {t('menu.sourceCode')}
            </a>
          </span>
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            {t('shortcuts.gotIt')}
          </button>
        </>
      }
    >
      <table className="shortcuts-table">
        <tbody>
          {shortcuts.map((sc) => (
            <tr key={sc.desc}>
              <td>{t(sc.desc)}</td>
              <td>
                <kbd>{sc.key}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
};
