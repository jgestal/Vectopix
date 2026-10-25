import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { AvailableUpdate } from '../../application/checkForUpdate';
import { useServices } from '../services/context';

/**
 * Says when a newer release is out and links to it (desktop app only:
 * elsewhere there is no checker). `announced` shows one found by a check
 * the person asked for.
 */
export const UpdateNotice: React.FC<{ announced?: AvailableUpdate | null }> = ({ announced = null }) => {
  const { t } = useI18n();
  const { updates } = useServices();
  const [found, setFound] = useState<AvailableUpdate | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const candidate = announced ?? found;
  const update = candidate && candidate.version !== dismissed ? candidate : null;

  useEffect(() => {
    if (!updates) return;
    let active = true;
    updates.find().then((result) => active && setFound(result));
    return () => {
      active = false;
    };
  }, [updates]);

  if (!update) return null;

  const dismiss = () => {
    updates?.dismiss(update.version);
    setDismissed(update.version);
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
