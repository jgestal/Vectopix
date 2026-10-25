/** The app's look: following the system, or fixed light or dark. */
export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export type Theme = 'light' | 'dark';

export const resolveTheme = (preference: ThemePreference, systemIsDark: boolean): Theme =>
  preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;
