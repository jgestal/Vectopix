import { SAMPLE_IMAGES } from './samples';

/**
 * Everything a person can ask the app to do from the keyboard or a menu.
 * Each command has one handler in the UI, whatever triggered it.
 */

export type OutlinePresetId = 'logo' | 'flat-art' | 'photo' | 'sketch' | 'pixel-art';
export const OUTLINE_PRESETS: readonly OutlinePresetId[] = ['logo', 'flat-art', 'photo', 'sketch', 'pixel-art'];

export type AppCommand =
  // File
  | 'newImage'
  | 'openImage'
  | `sample.${string}`
  | 'saveSvg'
  | 'export'
  | 'copySvg'
  // Edit
  | 'undo'
  | 'redo'
  | 'simplifyNodes'
  | 'restoreTrace'
  // View
  | 'view.split'
  | 'view.sideBySide'
  | 'view.vector'
  | 'view.raster'
  | 'render.full'
  | 'render.wireframe'
  | 'render.nodes'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomActual'
  | 'zoomFit'
  // Image
  | `preset.${OutlinePresetId}`
  | 'method.outline'
  | 'method.centerline'
  | 'toggleTransparent'
  | 'toggleAutoColors'
  | 'retrace'
  // Help and app
  | 'showShortcuts'
  | 'showAbout'
  | 'showPreferences'
  | 'checkUpdates'
  | 'openReleaseNotes'
  | 'openWebsite'
  | 'openSource'
  | 'reportIssue'
  // Keyboard only
  | 'closeDialogs'
  | 'toggleOutlines'
  | 'toggleNodeEditor'
  | 'toggleSplit'
  | 'toggleSideBySide';

export const sampleCommand = (id: string): AppCommand => `sample.${id}`;
export const SAMPLE_COMMANDS = SAMPLE_IMAGES.map((s) => sampleCommand(s.id));

export interface Shortcut {
  /** The key as the browser reports it (letters lower case). */
  key: string;
  /** ⌘ on macOS, Ctrl elsewhere. */
  command?: boolean;
  shift?: boolean;
  /**
   * Only through the desktop app's menus: the browser keeps it for itself
   * (new window, reload, switching tabs…).
   */
  desktopOnly?: boolean;
}

/** The keys of each command; the first is the one menus show. */
export const SHORTCUTS: Partial<Record<AppCommand, readonly Shortcut[]>> = {
  newImage: [{ key: 'n', command: true, desktopOnly: true }],
  openImage: [{ key: 'o', command: true }],
  saveSvg: [{ key: 's', command: true }],
  export: [{ key: 'e', command: true }],
  copySvg: [{ key: 'c', command: true, shift: true }, { key: 'c', command: true }],
  undo: [{ key: 'z', command: true }],
  redo: [{ key: 'z', command: true, shift: true }, { key: 'y', command: true }],
  'view.split': [{ key: '1', command: true, desktopOnly: true }],
  'view.sideBySide': [{ key: '2', command: true, desktopOnly: true }],
  'view.vector': [{ key: '3', command: true, desktopOnly: true }],
  'view.raster': [{ key: '4', command: true, desktopOnly: true }],
  zoomIn: [{ key: '+', command: true, desktopOnly: true }, { key: '=', command: true, desktopOnly: true }],
  zoomOut: [{ key: '-', command: true, desktopOnly: true }],
  zoomActual: [{ key: '0', command: true, desktopOnly: true }],
  zoomFit: [{ key: '9', command: true, desktopOnly: true }],
  retrace: [{ key: 'r', command: true, desktopOnly: true }],
  showPreferences: [{ key: ',', command: true, desktopOnly: true }],
  showShortcuts: [{ key: '/', command: true }, { key: '?' }, { key: 'f1' }],
  closeDialogs: [{ key: 'escape' }],
  toggleOutlines: [{ key: 'w' }],
  toggleNodeEditor: [{ key: 'n' }, { key: 'e' }],
  toggleSplit: [{ key: 's' }],
  toggleSideBySide: [{ key: 'd' }],
};

export interface KeyPress {
  key: string;
  /** Ctrl, or ⌘ on macOS. */
  command: boolean;
  shift: boolean;
  alt: boolean;
}

/** Shift only matters with ⌘/Ctrl: a plain key like "?" is typed with Shift on many layouts. */
const matches = (s: Shortcut, press: KeyPress) =>
  s.key === press.key.toLowerCase() && !!s.command === press.command && (!s.command || !!s.shift === press.shift);

/**
 * The command a key press asks for. Outside the desktop app, keys the
 * browser keeps for itself are left alone. Alt combinations are never ours.
 */
export function commandForKey(press: KeyPress, inDesktopApp: boolean): AppCommand | null {
  if (press.alt) return null;
  for (const [command, shortcuts] of Object.entries(SHORTCUTS) as [AppCommand, readonly Shortcut[]][]) {
    if (shortcuts.some((s) => matches(s, press) && (inDesktopApp || !s.desktopOnly))) return command;
  }
  // ⌘⇧ with a key that only has a plain ⌘ binding (⌘⇧Y): same command
  return press.command && press.shift ? commandForKey({ ...press, shift: false }, inDesktopApp) : null;
}
