import { describe, expect, it } from 'vitest';
import { mergeKnown } from './settings';

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
    for (const saved of [null, undefined, 3, 'x', [1, 2]]) expect(mergeKnown(DEFAULTS, saved)).toEqual(DEFAULTS);
  });
});
