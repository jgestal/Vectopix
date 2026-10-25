import { describe, expect, it } from 'vitest';
import { LocalSettingsStore } from './localSettings';
import { memoryStorage } from '../../test/fakes';

describe('LocalSettingsStore', () => {
  it('round-trips values as JSON under its own prefix', () => {
    const storage = memoryStorage();
    const store = new LocalSettingsStore(() => storage);
    store.write('export', { tab: 'dxf', scale: 4 });
    expect(storage.getItem('vectopix.export')).toBe('{"tab":"dxf","scale":4}');
    expect(store.read('export')).toEqual({ tab: 'dxf', scale: 4 });
  });

  it('reads missing or corrupt values as undefined', () => {
    const storage = memoryStorage();
    const store = new LocalSettingsStore(() => storage);
    expect(store.read('missing')).toBeUndefined();
    storage.setItem('vectopix.broken', '{not json');
    expect(store.read('broken')).toBeUndefined();
  });

  it('never throws when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const store = new LocalSettingsStore(blocked);
    expect(store.read('x')).toBeUndefined();
    expect(() => store.write('x', 1)).not.toThrow();
  });
});

describe('LocalSettingsStore.remove', () => {
  it('forgets a value, and never throws', () => {
    const storage = memoryStorage();
    const store = new LocalSettingsStore(() => storage);
    store.write('x', 1);
    store.remove('x');
    expect(store.read('x')).toBeUndefined();
    expect(() => new LocalSettingsStore(() => { throw new Error('blocked'); }).remove('x')).not.toThrow();
  });
});
