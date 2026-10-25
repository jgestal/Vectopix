import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { VectorOptions } from '../../domain/types';
import { useServices } from '../services/context';

/**
 * The engine settings. Those the user changes are remembered for their next
 * image; settings applied by a sample's preset or restored by undo are not.
 */
export function useVectorOptions() {
  const { preferences } = useServices();
  const [options, setOptions] = useState<VectorOptions>(() => preferences.loadUserOptions());
  const changedByUser = useRef(false);

  const setUserOptions = useCallback((update: SetStateAction<VectorOptions>) => {
    changedByUser.current = true;
    setOptions(update);
  }, []);

  useEffect(() => {
    if (!changedByUser.current) return;
    changedByUser.current = false;
    preferences.saveUserOptions(options);
  }, [options, preferences]);

  return { options, setOptions, setUserOptions, loadUserOptions: preferences.loadUserOptions };
}
