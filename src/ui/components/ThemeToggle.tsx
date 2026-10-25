import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { THEME_PREFERENCES, type ThemePreference } from '../../domain/theme';
import { chooseTheme, THEME_LABELS } from '../theme';

const ICONS = { system: Monitor, light: Sun, dark: Moon } satisfies Record<ThemePreference, unknown>;

/** Next to the language: one click steps System → Light → Dark (also in Settings). */
export function ThemeToggle() {
  const { t } = useI18n();
  const { preferences, desktop } = useServices();
  const [theme, setTheme] = useState(() => preferences.loadAppPreferences().theme);
  const Icon = ICONS[theme];
  const label = `${t('prefs.theme')}: ${t(THEME_LABELS[theme])}`;

  const next = () => {
    const following = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(theme) + 1) % THEME_PREFERENCES.length];
    setTheme(following);
    chooseTheme(following, preferences, desktop);
  };

  return (
    <button className="icon-btn theme-toggle" onClick={next} title={label} aria-label={label}>
      <Icon size={18} />
    </button>
  );
}
