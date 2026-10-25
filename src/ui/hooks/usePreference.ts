import { useEffect, useState } from 'react';
import type { AllowedValues } from '../../domain/settings';
import { useServices } from '../services/context';

/**
 * State remembered between sessions (validated against its defaults when
 * read back). For a group of related values, use one object.
 */
export function usePreference<T extends object>(key: string, defaults: T, allowed?: AllowedValues<T>) {
  const { preferences } = useServices();
  const [value, setValue] = useState<T>(() => preferences.load(key, defaults, allowed));
  useEffect(() => preferences.save(key, value), [preferences, key, value]);
  return [value, setValue] as const;
}
