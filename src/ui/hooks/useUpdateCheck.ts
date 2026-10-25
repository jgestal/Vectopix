import { useState } from 'react';
import type { AvailableUpdate } from '../../application/checkForUpdate';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import type { ShowToast } from './useToasts';

/** "Check for updates…": always answers, and announces a newer version it finds. */
export function useUpdateCheck(showToast: ShowToast) {
  const { t } = useI18n();
  const { updates } = useServices();
  const [announced, setAnnounced] = useState<AvailableUpdate | null>(null);

  const check = () => {
    if (!updates) return;
    showToast(t('update.checking'), 'info');
    updates.checkNow().then((result) => {
      if (result.status === 'available') setAnnounced(result.update);
      else if (result.status === 'upToDate') showToast(t('update.upToDate', { version: result.version }), 'success');
      else showToast(t('update.failed'), 'warning');
    });
  };

  return { announced, check };
}
