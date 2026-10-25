import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createDesktopState } = require('../../electron/desktopState.cjs') as {
  createDesktopState: (dir: string) => { get(key: string): unknown; set(key: string, value: unknown): void };
};

describe('desktop state', () => {
  it('remembers values across launches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vectopix-state-'));
    createDesktopState(dir).set('lastDir', '/Users/me/Pictures');
    expect(createDesktopState(dir).get('lastDir')).toBe('/Users/me/Pictures');
  });

  it('starts afresh from a damaged file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vectopix-state-'));
    writeFileSync(join(dir, 'desktop-state.json'), '{not json');
    const state = createDesktopState(dir);
    expect(state.get('theme')).toBeUndefined();
    state.set('theme', 'dark');
    expect(createDesktopState(dir).get('theme')).toBe('dark');
  });
});
