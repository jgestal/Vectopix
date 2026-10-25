import { describe, expect, it } from 'vitest';
import { buildMenu, menuLabels, type MenuState } from '../domain/menu';
import { LANGUAGES, loadMessages } from './core';

const STATE: MenuState = {
  hasImage: true,
  hasResult: true,
  isProcessing: false,
  canUndo: true,
  canRedo: true,
  hasEdits: true,
  isCenterline: false,
  viewMode: 'split',
  renderMode: 'full',
  preset: 'logo',
  transparentBackground: false,
  autoColors: true,
  isDevelopment: true,
};

/** Labels that are names, not words: shown as they are in every language. */
const UNTRANSLATED = new Set(['Vectopix']);

describe('menu labels', () => {
  const labels = new Set((['mac', 'windows', 'linux'] as const).flatMap((p) => menuLabels(buildMenu(STATE, p))));

  it.each(LANGUAGES.map((l) => l.code))('are all translated in %s', async (lang) => {
    const messages = (await loadMessages(lang)) as Record<string, string>;
    const missing = [...labels].filter((label) => !UNTRANSLATED.has(label) && !messages[label]);
    expect(missing).toEqual([]);
  });
});
