import type { MessageKey } from './locales/es';
import type { TranslateParams } from './core';

/** An error whose user-facing text is a translation key, resolved by the UI. */
export class LocalizedError extends Error {
  readonly key: MessageKey;
  readonly params?: TranslateParams;

  constructor(key: MessageKey, params?: TranslateParams) {
    super(key);
    this.name = 'LocalizedError';
    this.key = key;
    this.params = params;
  }
}
