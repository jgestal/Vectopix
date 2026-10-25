import { mergeKnown, type AllowedValues } from '../domain/settings';
import { DEFAULT_OPTIONS } from '../domain/presets';
import type { VectorOptions } from '../domain/types';
import type { SettingsStore } from './ports';

const USER_OPTIONS_KEY = 'options';

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
}

export function createPreferences(store: SettingsStore): Preferences {
  const load = <T extends object>(key: string, defaults: T, allowed?: AllowedValues<T>) => mergeKnown(defaults, store.read(key), allowed);
  const save = (key: string, value: object) => store.write(key, value);
  return {
    load,
    save,
    loadUserOptions: () => load(USER_OPTIONS_KEY, DEFAULT_OPTIONS, OPTION_VALUES),
    saveUserOptions: (options) => save(USER_OPTIONS_KEY, options),
  };
}
