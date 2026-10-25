import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { Dialog } from './ui/Dialog';
import { LanguageSelect } from './LanguageSelect';

/** Remembered groups the reset forgets (the engine settings are always included). */
const REMEMBERED_GROUPS = ['export', 'view'] as const;

/**
 * The app's own settings: language, update checks, and forgetting what was
 * remembered. (The tracing settings belong to the image, in its panel.)
 */
export function PreferencesDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { t } = useI18n();
  const { preferences, desktop } = useServices();
  const [app, setApp] = useState(preferences.loadAppPreferences);

  const setCheckForUpdates = (checkForUpdates: boolean) => {
    const next = { ...app, checkForUpdates };
    setApp(next);
    preferences.saveAppPreferences(next);
  };

  return (
    <Dialog
      title={t('prefs.title')}
      onClose={onClose}
      className="preferences-dialog"
      footer={
        <button className="btn btn-primary" onClick={onClose} autoFocus>
          {t('prefs.done')}
        </button>
      }
    >
      <div className="option-row">
        <span className="option-label">{t('prefs.language')}</span>
        <LanguageSelect />
      </div>

      {/* Only the desktop app updates; the web version is always the latest */}
      {desktop && (
        <label className="check-row">
          <input type="checkbox" checked={app.checkForUpdates} onChange={(e) => setCheckForUpdates(e.target.checked)} />
          <span>
            <span className="check-title">{t('prefs.updates')}</span>
            <span className="check-desc">{t('prefs.updatesDesc')}</span>
          </span>
        </label>
      )}

      <div className="preferences-reset">
        <p className="check-desc">{t('prefs.resetDesc')}</p>
        <button
          className="btn"
          onClick={() => {
            preferences.resetRemembered(REMEMBERED_GROUPS);
            onReset();
          }}
        >
          <RotateCcw size={15} />
          {t('prefs.reset')}
        </button>
      </div>
    </Dialog>
  );
}
