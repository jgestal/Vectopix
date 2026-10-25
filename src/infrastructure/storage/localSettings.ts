import type { SettingsStore } from '../../application/ports';

/**
 * Settings in localStorage, in this browser (or this desktop app) only.
 * Storage can be unavailable (private mode, blocked site data) or hold
 * anything: reads and writes never throw, and what is read is validated by
 * the caller.
 */
export class LocalSettingsStore implements SettingsStore {
  private readonly storage: () => Storage;
  private readonly prefix: string;

  constructor(storage: () => Storage = () => localStorage, prefix = 'vectopix.') {
    this.storage = storage;
    this.prefix = prefix;
  }

  read(key: string): unknown {
    try {
      const raw = this.storage().getItem(this.prefix + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  write(key: string, value: unknown): void {
    try {
      this.storage().setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Not remembered this time; nothing else depends on it
    }
  }
}
