import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { AvailableUpdate } from '../../application/checkForUpdate';
import { useServices } from '../services/context';

/** Says when a newer release is out and links to it (desktop app only: elsewhere there is no checker). */
export const UpdateNotice: React.FC = () => {
  const { t } = useI18n();
  const { updates } = useServices();
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (!updates) return;
    let active = true;
    updates.find().then((found) => active && setUpdate(found));
    return () => {
      active = false;
    };
  }, [updates]);

  if (!update) return null;

  const dismiss = () => {
    updates?.dismiss(update.version);
    setUpdate(null);
  };

  return (
    <div className="update-notice" role="status">
      <span>{t('update.available', { version: update.version })}</span>
      <a className="btn btn-small btn-primary" href={update.url} target="_blank" rel="noopener noreferrer">
        <Download size={14} />
        {t('update.download')}
      </a>
      <button className="icon-btn" onClick={dismiss} title={t('update.dismiss')} aria-label={t('update.dismiss')}>
        <X size={16} />
      </button>
    </div>
  );
};
