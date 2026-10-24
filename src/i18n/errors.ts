import type { MessageKey } from './locales/es';

/** An error whose user-facing text is a translation key, resolved by the UI. */
export class LocalizedError extends Error {
  readonly key: MessageKey;

  constructor(key: MessageKey) {
    super(key);
    this.name = 'LocalizedError';
    this.key = key;
  }
}
