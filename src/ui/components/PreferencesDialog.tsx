import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { Dialog } from './ui/Dialog';
import { LanguageSelect } from './LanguageSelect';
import { Segmented } from './ui/Segmented';
import { chooseTheme, THEME_LABELS } from '../theme';
import { THEME_PREFERENCES, type ThemePreference } from '../../domain/theme';
import type { AppPreferences } from '../../application/preferences';

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

  const update = (change: Partial<AppPreferences>) => {
    const next = { ...app, ...change };
    setApp(next);
    preferences.saveAppPreferences(next);
  };
  const setTheme = (theme: ThemePreference) => {
    setApp({ ...app, theme });
    chooseTheme(theme, preferences, desktop);
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

      <div className="option-row">
        <span className="option-label">{t('prefs.theme')}</span>
        <Segmented
          label={t('prefs.theme')}
          options={THEME_PREFERENCES.map((value) => ({ value, text: t(THEME_LABELS[value]) }))}
          value={app.theme}
          onChange={setTheme}
        />
      </div>

      {/* Only the desktop app updates; the web version is always the latest */}
      {desktop && (
        <label className="check-row">
          <input type="checkbox" checked={app.checkForUpdates} onChange={(e) => update({ checkForUpdates: e.target.checked })} />
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
