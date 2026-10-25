/**
 * Settings remembered between sessions, in this browser (or this desktop
 * app) only. Storage can be unavailable (private mode, blocked site data) or
 * hold values from another version, so reads never trust what they find:
 * unknown fields are dropped, and a field of the wrong type or outside its
 * allowed values keeps its default.
 */

const PREFIX = 'vectopix.';

export type AllowedValues<T> = { [K in keyof T]?: readonly T[K][] };

/**
 * `defaults` with every field `saved` has, of the same type and (when listed
 * in `allowed`) one of the allowed values.
 */
export function mergeKnown<T extends object>(defaults: T, saved: unknown, allowed: AllowedValues<T> = {}): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (saved as Record<keyof T, unknown>)[key];
    if (value === undefined || typeof value !== typeof defaults[key]) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const options = allowed[key];
    if (options && !options.includes(value as T[keyof T])) continue;
    out[key] = value as T[keyof T];
  }
  return out;
}

export function loadSetting<T extends object>(key: string, defaults: T, allowed?: AllowedValues<T>): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? defaults : mergeKnown(defaults, JSON.parse(raw), allowed);
  } catch {
    return defaults;
  }
}

export function saveSetting(key: string, value: object): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not remembered this time; nothing else depends on it
  }
}
