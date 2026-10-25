import { mergeKnown, type AllowedValues } from '../domain/settings';
import { DEFAULT_OPTIONS } from '../domain/presets';
import { THEME_PREFERENCES, type ThemePreference } from '../domain/theme';
import type { VectorOptions } from '../domain/types';
import type { SettingsStore } from './ports';

const USER_OPTIONS_KEY = 'options';
const APP_PREFERENCES_KEY = 'preferences';

/** Preferences about the app itself (the engine settings are separate). */
export interface AppPreferences {
  /** Desktop app: look for a new version once a day. */
  checkForUpdates: boolean;
  theme: ThemePreference;
}
const APP_DEFAULTS: AppPreferences = { checkForUpdates: true, theme: 'system' };
const APP_VALUES: AllowedValues<AppPreferences> = { theme: THEME_PREFERENCES };

export const readAppPreferences = (store: SettingsStore): AppPreferences => mergeKnown(APP_DEFAULTS, store.read(APP_PREFERENCES_KEY), APP_VALUES);
/** Where app preferences are stored (index.html reads the theme from it before the app starts). */
export const APP_PREFERENCES_STORAGE_KEY = APP_PREFERENCES_KEY;

const OPTION_VALUES: AllowedValues<VectorOptions> = {
  engine: ['vecline', 'imagetracer'],
  traceMethod: ['outline', 'centerline'],
  preset: ['logo', 'flat-art', 'photo', 'sketch', 'pixel-art', 'centerline-sketch', 'custom'],
  smooth: [0, 1, 2],
};

export interface Preferences {
  /** A saved group of settings, validated against its defaults. */
  load<T extends object>(key: string, defaults: T, allowed?: AllowedValues<T>): T;
  save(key: string, value: object): void;
  /** The settings the user last chose (or the defaults): what a new image of theirs starts with. */
  loadUserOptions(): VectorOptions;
  saveUserOptions(options: VectorOptions): void;
  loadAppPreferences(): AppPreferences;
  saveAppPreferences(preferences: AppPreferences): void;
  /** Forget remembered settings and choices (the app preferences stay). */
  resetRemembered(keys: readonly string[]): void;
}

export function createPreferences(store: SettingsStore): Preferences {
  const load = <T extends object>(key: string, defaults: T, allowed?: AllowedValues<T>) => mergeKnown(defaults, store.read(key), allowed);
  const save = (key: string, value: object) => store.write(key, value);
  return {
    load,
    save,
    loadUserOptions: () => load(USER_OPTIONS_KEY, DEFAULT_OPTIONS, OPTION_VALUES),
    saveUserOptions: (options) => save(USER_OPTIONS_KEY, options),
    loadAppPreferences: () => readAppPreferences(store),
    saveAppPreferences: (preferences) => save(APP_PREFERENCES_KEY, preferences),
    resetRemembered: (keys) => [USER_OPTIONS_KEY, ...keys].forEach((key) => store.remove(key)),
  };
}
