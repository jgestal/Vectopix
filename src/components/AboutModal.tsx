import React from 'react';
import { useI18n } from '../i18n';
import { AppIcon, RetroDialog } from './retro/RetroWindow';
import { REPOSITORY_URL } from './StudioMenuBar';

export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useI18n();

  return (
    <RetroDialog title={t('menu.about')} onClose={onClose} closeLabel={t('export.close')} className="about-window">
      <div className="about-body">
        <AppIcon size={64} />
        <div className="about-text">
          <h2 className="about-name">Vectopix</h2>
          <p>{t('about.version', { version: __APP_VERSION__ })}</p>
          <p>{t('landing.description')}</p>
          <div className="r-separator" />
          <p>{t('about.license')}</p>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="r-link">
            {REPOSITORY_URL.replace('https://', '')}
          </a>
        </div>
      </div>
      <div className="r-dialog-footer">
        <button className="r-btn is-default" onClick={onClose} autoFocus>
          {t('about.ok')}
        </button>
      </div>
    </RetroDialog>
  );
};
