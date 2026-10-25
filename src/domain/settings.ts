/**
 * Saved settings are untrusted: they may come from another version or be
 * corrupt. Only fields the defaults know survive, with the same type and,
 * where listed, one of the allowed values; anything else keeps its default.
 */

export type AllowedValues<T> = { [K in keyof T]?: readonly T[K][] };

function isAcceptable<T>(value: unknown, fallback: T, allowed?: readonly T[]): value is T {
  if (value === undefined || typeof value !== typeof fallback) return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  return !allowed || allowed.includes(value as T);
}

/** `defaults` with every acceptable field of `saved`. */
export function mergeKnown<T extends object>(defaults: T, saved: unknown, allowed: AllowedValues<T> = {}): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (saved as Record<keyof T, unknown>)[key];
    if (isAcceptable(value, defaults[key], allowed[key])) out[key] = value;
  }
  return out;
}
