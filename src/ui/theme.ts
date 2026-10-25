import type { DesktopShell } from '../application/ports';
import type { Preferences } from '../application/preferences';
import { resolveTheme, type ThemePreference } from '../domain/theme';
import type { MessageKey } from '../i18n';

export const THEME_LABELS: Record<ThemePreference, MessageKey> = { system: 'prefs.themeSystem', light: 'prefs.themeLight', dark: 'prefs.themeDark' };

/**
 * Apply the theme: the page's `data-theme` (index.css), kept in step with
 * the system while following it, and the desktop app's native menus and
 * dialogs. index.html sets the first value before anything is painted.
 */
let stopFollowing: (() => void) | null = null;

export function applyTheme(preference: ThemePreference, desktop: DesktopShell | null): void {
  stopFollowing?.();
  stopFollowing = null;
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  const update = () => {
    document.documentElement.dataset.theme = resolveTheme(preference, !!query?.matches);
  };
  update();
  if (preference === 'system' && query) {
    query.addEventListener('change', update);
    stopFollowing = () => query.removeEventListener('change', update);
  }
  desktop?.setTheme(preference);
}

/** Choose a theme: applied at once and remembered. */
export function chooseTheme(theme: ThemePreference, preferences: Preferences, desktop: DesktopShell | null): void {
  preferences.saveAppPreferences({ ...preferences.loadAppPreferences(), theme });
  applyTheme(theme, desktop);
}
