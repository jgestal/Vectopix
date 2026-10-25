import { describe, expect, it, vi } from 'vitest';
import { appCommandHandlers, type AppActions } from './appCommands';
import { ISSUES_URL, RELEASE_NOTES_URL, REPOSITORY_URL, WEB_APP_URL } from './appInfo';

function actions(overrides: Partial<AppActions> = {}): AppActions {
  const fn = () => vi.fn();
  return {
    hasImage: true,
    hasResult: true,
    viewMode: 'split',
    newImage: fn(), openImage: fn(), openSample: fn(), saveSvg: fn(), openExport: fn(), copySvg: fn(), copyPng: fn(),
    undo: fn(), redo: fn(), simplifyNodes: fn(), restoreTrace: fn(),
    setViewMode: fn(), setRenderMode: fn(), toggleRenderMode: fn(), zoomBy: fn(), zoomTo: fn(), fit: fn(),
    applyPreset: fn(), setTraceMethod: fn(), toggleOption: fn(), retrace: fn(),
    toggleShortcuts: fn(), showAbout: fn(), showPreferences: fn(), closeDialogs: fn(), checkUpdates: fn(), openUrl: fn(),
    editText: vi.fn(() => false),
    ...overrides,
  };
}

describe('appCommandHandlers', () => {
  it('runs each command’s action', () => {
    const app = actions();
    const h = appCommandHandlers(app);
    h['sample.pixel-heart']!();
    h['preset.photo']!();
    h['view.sideBySide']!();
    h.zoomActual!();
    h['method.centerline']!();
    h.toggleTransparent!();
    expect(app.openSample).toHaveBeenCalledWith('pixel-heart');
    expect(app.applyPreset).toHaveBeenCalledWith('photo');
    expect(app.setViewMode).toHaveBeenCalledWith('side-by-side');
    expect(app.zoomTo).toHaveBeenCalledWith(1);
    expect(app.setTraceMethod).toHaveBeenCalledWith('centerline');
    expect(app.toggleOption).toHaveBeenCalledWith('transparentBackground');
  });

  it('declines commands that need an image or a trace when there is none', () => {
    const app = actions({ hasImage: false, hasResult: false });
    const h = appCommandHandlers(app);
    for (const c of ['saveSvg', 'export', 'view.split', 'zoomIn', 'retrace', 'newImage', 'simplifyNodes'] as const) expect(h[c]!(), c).toBe(false);
    expect(app.saveSvg).not.toHaveBeenCalled();
    // Opening an image always works
    h.openImage!();
    expect(app.openImage).toHaveBeenCalled();
  });

  it('switches single keys between a view and its alternative', () => {
    const app = actions({ viewMode: 'side-by-side' });
    appCommandHandlers(app).toggleSideBySide!();
    expect(app.setViewMode).toHaveBeenCalledWith('split');
    appCommandHandlers(app).toggleNodeEditor!();
    expect(app.toggleRenderMode).toHaveBeenCalledWith('nodes');
  });

  it('leaves ⌘C to the text when some is selected', () => {
    const app = actions();
    vi.stubGlobal('window', { getSelection: () => ({ toString: () => 'some text' }) });
    expect(appCommandHandlers(app).copySvg!()).toBe(false);
    vi.stubGlobal('window', { getSelection: () => ({ toString: () => '' }) });
    appCommandHandlers(app).copySvg!();
    expect(app.copySvg).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('opens the project pages, and a problem report pre-filled with the version', () => {
    const app = actions();
    const h = appCommandHandlers(app);
    h.openReleaseNotes!();
    h.openWebsite!();
    h.openSource!();
    h.reportIssue!();
    const urls = vi.mocked(app.openUrl).mock.calls.map(([u]) => u);
    expect(urls.slice(0, 3)).toEqual([RELEASE_NOTES_URL, WEB_APP_URL, REPOSITORY_URL]);
    expect(urls[3].startsWith(`${ISSUES_URL}?body=`)).toBe(true);
    expect(decodeURIComponent(urls[3])).toContain(`Vectopix ${__APP_VERSION__}`);
  });

  it('undoes typing, not the drawing, while a text field has the focus', () => {
    const typing = actions({ editText: vi.fn(() => true) });
    appCommandHandlers(typing).undo!();
    appCommandHandlers(typing).redo!();
    expect(typing.editText).toHaveBeenCalledWith('undo');
    expect(typing.editText).toHaveBeenCalledWith('redo');
    expect(typing.undo).not.toHaveBeenCalled();

    const drawing = actions();
    appCommandHandlers(drawing).undo!();
    expect(drawing.undo).toHaveBeenCalled();
  });
});
