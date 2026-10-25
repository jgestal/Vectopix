import { OUTLINE_PRESETS, SAMPLE_COMMANDS, type AppCommand } from '../domain/commands';
import type { VectorPreset } from '../domain/types';
import type { RenderMode, ViewMode } from './types';
import type { CommandHandlers } from './hooks/useCommands';
import { ISSUES_URL, RELEASE_NOTES_URL, REPOSITORY_URL, WEB_APP_URL } from './appInfo';

/** Zoom steps of the zoom in / out commands. */
const ZOOM_STEP = 1.25;

/** What the app can do, as the command handlers need it. */
export interface AppActions {
  hasImage: boolean;
  hasResult: boolean;
  viewMode: ViewMode;
  // File
  newImage(): void;
  openImage(): void;
  openSample(id: string): void;
  saveSvg(): void;
  openExport(): void;
  copySvg(): void;
  // Edit
  undo(): void;
  redo(): void;
  simplifyNodes(): void;
  restoreTrace(): void;
  // View
  setViewMode(mode: ViewMode): void;
  setRenderMode(mode: RenderMode): void;
  /** Switch a drawing mode on or off from the keyboard (with a short notice). */
  toggleRenderMode(mode: RenderMode): void;
  zoomBy(factor: number): void;
  zoomTo(zoom: number): void;
  fit(): void;
  // Image
  applyPreset(preset: VectorPreset): void;
  setTraceMethod(method: 'outline' | 'centerline'): void;
  toggleOption(option: 'transparentBackground' | 'autoColors'): void;
  retrace(): void;
  // Dialogs and help
  toggleShortcuts(): void;
  showAbout(): void;
  showPreferences(): void;
  closeDialogs(): void;
  checkUpdates(): void;
  openUrl(url: string): void;
  /** Undo or redo typing in the focused text field; false if none has the focus. */
  editText(command: 'undo' | 'redo'): boolean;
}

/** A report pre-filled with the version and system, so it can be reproduced. */
const issueUrl = () =>
  `${ISSUES_URL}?body=${encodeURIComponent(`\n\n---\nVectopix ${__APP_VERSION__}\n${typeof navigator === 'undefined' ? '' : navigator.userAgent}`)}`;

/**
 * Each command's handler. A handler returns false when the command doesn't
 * apply now (no image yet, text selected for ⌘C): the key keeps its usual
 * meaning, and a stray menu click does nothing.
 */
export function appCommandHandlers(app: AppActions): CommandHandlers {
  const withImage = (run: () => void) => () => (app.hasImage ? run() : false);
  const withResult = (run: () => void) => () => (app.hasResult ? run() : false);
  const toggle = (mode: RenderMode) => withImage(() => app.toggleRenderMode(mode));

  const samples = Object.fromEntries(SAMPLE_COMMANDS.map((c) => [c, () => app.openSample(c.slice('sample.'.length))]));
  const presets = Object.fromEntries(OUTLINE_PRESETS.map((p) => [`preset.${p}`, withImage(() => app.applyPreset(p))]));

  return {
    ...samples,
    ...presets,
    newImage: withImage(app.newImage),
    openImage: () => app.openImage(),
    saveSvg: withResult(app.saveSvg),
    export: withResult(app.openExport),
    // With text selected, ⌘C copies the text
    copySvg: () => (app.hasResult && !window.getSelection()?.toString() ? app.copySvg() : false),
    // From the menu while typing, Undo is about the text, as in any app
    undo: () => app.editText('undo') || app.undo(),
    redo: () => app.editText('redo') || app.redo(),
    simplifyNodes: withResult(app.simplifyNodes),
    restoreTrace: withResult(app.restoreTrace),
    'view.split': withImage(() => app.setViewMode('split')),
    'view.sideBySide': withImage(() => app.setViewMode('side-by-side')),
    'view.vector': withImage(() => app.setViewMode('vector')),
    'view.raster': withImage(() => app.setViewMode('raster')),
    'render.full': withImage(() => app.setRenderMode('full')),
    'render.wireframe': withImage(() => app.setRenderMode('wireframe')),
    'render.nodes': withResult(() => app.setRenderMode('nodes')),
    toggleOutlines: toggle('wireframe'),
    toggleNodeEditor: toggle('nodes'),
    toggleSplit: withImage(() => app.setViewMode(app.viewMode === 'split' ? 'vector' : 'split')),
    toggleSideBySide: withImage(() => app.setViewMode(app.viewMode === 'side-by-side' ? 'split' : 'side-by-side')),
    zoomIn: withImage(() => app.zoomBy(ZOOM_STEP)),
    zoomOut: withImage(() => app.zoomBy(1 / ZOOM_STEP)),
    zoomActual: withImage(() => app.zoomTo(1)),
    zoomFit: withImage(app.fit),
    'method.outline': withImage(() => app.setTraceMethod('outline')),
    'method.centerline': withImage(() => app.setTraceMethod('centerline')),
    toggleTransparent: withImage(() => app.toggleOption('transparentBackground')),
    toggleAutoColors: withImage(() => app.toggleOption('autoColors')),
    retrace: withImage(app.retrace),
    showShortcuts: () => app.toggleShortcuts(),
    showAbout: () => app.showAbout(),
    showPreferences: () => app.showPreferences(),
    closeDialogs: () => app.closeDialogs(),
    checkUpdates: () => app.checkUpdates(),
    openReleaseNotes: () => app.openUrl(RELEASE_NOTES_URL),
    openWebsite: () => app.openUrl(WEB_APP_URL),
    openSource: () => app.openUrl(REPOSITORY_URL),
    reportIssue: () => app.openUrl(issueUrl()),
  } satisfies Partial<Record<AppCommand | string, () => boolean | void>>;
}
