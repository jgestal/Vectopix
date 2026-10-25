import { describe, expect, it } from 'vitest';
import { createPreferences } from './preferences';
import { DEFAULT_OPTIONS } from '../domain/presets';
import { MemoryStore } from '../test/fakes';

describe('preferences', () => {
  it('starts from the defaults when nothing was saved', () => {
    expect(createPreferences(new MemoryStore()).loadUserOptions()).toEqual(DEFAULT_OPTIONS);
  });

  it('remembers the user options', () => {
    const store = new MemoryStore();
    const prefs = createPreferences(store);
    prefs.saveUserOptions({ ...DEFAULT_OPTIONS, transparentBackground: true, colors: 7 });
    expect(createPreferences(store).loadUserOptions()).toMatchObject({ transparentBackground: true, colors: 7 });
  });

  it('rejects saved option values the engine does not know', () => {
    const store = new MemoryStore();
    store.write('options', { ...DEFAULT_OPTIONS, engine: 'potrace', traceMethod: 'sideways', smooth: 7 });
    const options = createPreferences(store).loadUserOptions();
    expect(options).toMatchObject({ engine: DEFAULT_OPTIONS.engine, traceMethod: DEFAULT_OPTIONS.traceMethod, smooth: DEFAULT_OPTIONS.smooth });
  });

  it('loads any group of settings against its own defaults', () => {
    const store = new MemoryStore();
    const prefs = createPreferences(store);
    prefs.save('view', { viewMode: 'raster' });
    expect(prefs.load('view', { viewMode: 'split' }, { viewMode: ['split', 'raster'] })).toEqual({ viewMode: 'raster' });
    store.write('view', { viewMode: 'gone' });
    expect(prefs.load('view', { viewMode: 'split' }, { viewMode: ['split', 'raster'] })).toEqual({ viewMode: 'split' });
  });
});
