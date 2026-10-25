import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { restoreBounds } = require('../../electron/windowState.cjs') as {
  restoreBounds: (saved: unknown, areas: { x: number; y: number; width: number; height: number }[], size: Record<string, number>) => Record<string, number>;
};

const SIZE = { width: 1440, height: 900, minWidth: 1024, minHeight: 680 };
const LAPTOP = { x: 0, y: 25, width: 1512, height: 920 };
const EXTERNAL = { x: 1512, y: 0, width: 2560, height: 1415 };

describe('restoreBounds', () => {
  it('opens where the window was last time', () => {
    const saved = { x: 1700, y: 100, width: 1600, height: 1000 };
    expect(restoreBounds(saved, [LAPTOP, EXTERNAL], SIZE)).toEqual(saved);
  });

  it('comes back to a screen when the monitor it was on is gone', () => {
    const onExternal = { x: 1700, y: 100, width: 1600, height: 1000 };
    const bounds = restoreBounds(onExternal, [LAPTOP], SIZE);
    expect(bounds.x).toBeGreaterThanOrEqual(LAPTOP.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(LAPTOP.x + LAPTOP.width);
  });

  it('centres the default size, within the screen, without a usable record', () => {
    for (const saved of [undefined, null, {}, { x: 'a' }, { x: 0, y: 0, width: 200, height: 100 }]) {
      expect(restoreBounds(saved, [LAPTOP], SIZE)).toEqual({ x: 36, y: 35, width: 1440, height: 900 });
    }
  });

  it('never opens larger than the screen', () => {
    const small = { x: 0, y: 0, width: 1280, height: 720 };
    expect(restoreBounds(undefined, [small], SIZE)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });
});
