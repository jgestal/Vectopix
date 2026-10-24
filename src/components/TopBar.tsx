import React from 'react';
import { CircleHelp, Download, FolderOpen, Redo2, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { LanguageSelect } from './LanguageSelect';

interface TopBarProps {
  fileName: string;
  imageDimensions: { width: number; height: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onHome: () => void;
  onOpen: () => void;
  onExport: () => void;
  onHelp: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  fileName,
  imageDimensions,
  canUndo,
  canRedo,
  canExport,
  onUndo,
  onRedo,
  onHome,
  onOpen,
  onExport,
  onHelp,
}) => {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} title={t('topbar.home')}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={22} height={22} />
        <span>Vectopix</span>
      </button>

      <div className="topbar-file" title={fileName}>
        <span className="topbar-file-name">{fileName}</span>
        {imageDimensions && (
          <span className="topbar-file-dims">
            {imageDimensions.width} × {imageDimensions.height} px
          </span>
        )}
      </div>

      <div className="topbar-history">
        <button className="icon-btn" onClick={onUndo} disabled={!canUndo} title={t('header.undo')} aria-label={t('header.undo')}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" onClick={onRedo} disabled={!canRedo} title={t('header.redo')} aria-label={t('header.redo')}>
          <Redo2 size={18} />
        </button>
      </div>

      <div className="topbar-actions">
        <LanguageSelect />
        <button className="icon-btn" onClick={onHelp} title={t('header.shortcuts')} aria-label={t('header.shortcuts')}>
          <CircleHelp size={18} />
        </button>
        <button className="btn" onClick={onOpen}>
          <FolderOpen size={16} />
          {t('topbar.open')}
        </button>
        <button className="btn btn-primary" onClick={onExport} disabled={!canExport}>
          <Download size={16} />
          {t('topbar.export')}
        </button>
      </div>
    </header>
  );
};
