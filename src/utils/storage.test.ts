import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSetting, mergeKnown, saveSetting } from './storage';

const DEFAULTS = { mode: 'a' as 'a' | 'b', scale: 2, on: true };

describe('mergeKnown', () => {
  it('takes saved fields of the right type and allowed value', () => {
    expect(mergeKnown(DEFAULTS, { mode: 'b', scale: 4, on: false }, { mode: ['a', 'b'] })).toEqual({ mode: 'b', scale: 4, on: false });
  });

  it('keeps the default for wrong types, unknown values and non-finite numbers', () => {
    expect(mergeKnown(DEFAULTS, { mode: 'z', scale: '4', on: 1 }, { mode: ['a', 'b'] })).toEqual(DEFAULTS);
    expect(mergeKnown(DEFAULTS, { scale: null })).toEqual(DEFAULTS);
    expect(mergeKnown(DEFAULTS, JSON.parse('{"scale": 1e999}'))).toEqual(DEFAULTS);
  });

  it('drops fields it does not know (saved by another version)', () => {
    expect(mergeKnown(DEFAULTS, { removedLongAgo: 1 })).toEqual(DEFAULTS);
  });

  it('ignores anything that is not an object', () => {
    for (const saved of [null, 3, 'x', [1, 2]]) expect(mergeKnown(DEFAULTS, saved)).toEqual(DEFAULTS);
  });
});

/** In-memory Storage: the test must not depend on which localStorage the runtime provides. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

describe('loadSetting / saveSetting', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('round-trips a setting', () => {
    saveSetting('test', { mode: 'b', scale: 8, on: false });
    expect(loadSetting('test', DEFAULTS)).toEqual({ mode: 'b', scale: 8, on: false });
  });

  it('falls back to the defaults on missing or corrupt data', () => {
    expect(loadSetting('missing', DEFAULTS)).toEqual(DEFAULTS);
    localStorage.setItem('vectopix.test', '{not json');
    expect(loadSetting('test', DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe('without storage', () => {
  it('reads defaults and ignores writes when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadSetting('test', DEFAULTS)).toEqual(DEFAULTS);
    expect(() => saveSetting('test', DEFAULTS)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
