import { describe, expect, it } from 'vitest';
import { es } from './locales/es';
import { LANGUAGES, format, loadMessages } from '.';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('locales', () => {
  it.each(LANGUAGES.map((l) => l.code))('%s has every key with the same placeholders as es', async (code) => {
    const messages = await loadMessages(code);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(es).sort());
    for (const [key, text] of Object.entries(es)) {
      expect(placeholders(messages[key as keyof typeof es]), `${code}: ${key}`).toEqual(placeholders(text));
      expect(messages[key as keyof typeof es].trim(), `${code}: ${key}`).not.toBe('');
    }
  });
});

describe('format', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(format('{count} nodes (−{pct}%) {missing}', { count: 3, pct: 12 })).toBe('3 nodes (−12%) {missing}');
  });
});
