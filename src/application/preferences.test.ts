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

describe('app preferences', () => {
  it('checks for updates unless switched off', () => {
    const prefs = createPreferences(new MemoryStore());
    expect(prefs.loadAppPreferences()).toEqual({ checkForUpdates: true });
    prefs.saveAppPreferences({ checkForUpdates: false });
    expect(prefs.loadAppPreferences()).toEqual({ checkForUpdates: false });
  });

  it('forgets remembered settings and choices, keeping the app preferences', () => {
    const store = new MemoryStore();
    const prefs = createPreferences(store);
    prefs.saveUserOptions({ ...DEFAULT_OPTIONS, colors: 7 });
    prefs.save('export', { tab: 'dxf' });
    prefs.saveAppPreferences({ checkForUpdates: false });
    prefs.resetRemembered(['export']);
    expect(prefs.loadUserOptions()).toEqual(DEFAULT_OPTIONS);
    expect(store.read('export')).toBeUndefined();
    expect(prefs.loadAppPreferences()).toEqual({ checkForUpdates: false });
  });
});
