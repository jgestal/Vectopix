import { OUTLINE_PRESETS, SHORTCUTS, sampleCommand, type AppCommand, type Shortcut } from './commands';
import { SAMPLE_IMAGES } from './samples';

/**
 * The desktop app's menu bar as data: what it contains, in which order, and
 * which items are enabled or checked for the current state. Platform
 * conventions decide the frame (macOS has an application menu; elsewhere
 * About and Quit live in Help and File). Labels are message keys, translated
 * by the interface; the native menu is built from this by the desktop shell.
 */

export type MenuPlatform = 'mac' | 'windows' | 'linux';

export interface MenuState {
  hasImage: boolean;
  /** A trace is on screen (something to save, export or edit). */
  hasResult: boolean;
  isProcessing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** The drawing differs from the trace (hand edits to restore). */
  hasEdits: boolean;
  isCenterline: boolean;
  viewMode: 'split' | 'side-by-side' | 'vector' | 'raster';
  renderMode: 'full' | 'wireframe' | 'nodes';
  preset: string;
  transparentBackground: boolean;
  autoColors: boolean;
  /** Development build: developer tools are offered. */
  isDevelopment: boolean;
}

/** Native items the system implements (clipboard, windows, app visibility…). */
export type SystemRole =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'services'
  | 'hide'
  | 'hideOthers'
  | 'unhide'
  | 'quit'
  | 'close'
  | 'minimize'
  | 'zoom'
  | 'front'
  | 'togglefullscreen'
  | 'toggleDevTools'
  | 'clearRecentDocuments';

export type MenuItem =
  | {
      kind: 'command';
      command: AppCommand;
      label: string;
      enabled: boolean;
      /** For checkbox and radio items. */
      checked?: boolean;
      type?: 'checkbox' | 'radio';
      shortcut?: Shortcut;
    }
  | { kind: 'role'; role: SystemRole; label: string }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: string; items: MenuItem[]; recentDocuments?: boolean };

export interface MenuSection {
  label: string;
  /** Sections the system knows (macOS adds its own items to Window and Help). */
  role?: 'appMenu' | 'windowMenu' | 'help';
  items: MenuItem[];
}

const SEPARATOR: MenuItem = { kind: 'separator' };

/**
 * The shortcut a menu shows. Single keys without ⌘/Ctrl are left off on
 * macOS, where a menu would take them even while typing in a text field.
 */
function menuShortcut(command: AppCommand, platform: MenuPlatform, from: AppCommand = command): Shortcut | undefined {
  const shortcut = SHORTCUTS[from]?.[0];
  if (!shortcut || (platform === 'mac' && !shortcut.command)) return undefined;
  return shortcut;
}

function itemsBuilder(platform: MenuPlatform) {
  const command = (id: AppCommand, label: string, enabled = true, extra: Partial<Extract<MenuItem, { kind: 'command' }>> = {}): MenuItem => ({
    kind: 'command',
    command: id,
    label,
    enabled,
    shortcut: menuShortcut(id, platform),
    ...extra,
  });
  const radio = (id: AppCommand, label: string, checked: boolean, enabled: boolean, shortcutFrom?: AppCommand) =>
    command(id, label, enabled, { type: 'radio', checked, shortcut: menuShortcut(id, platform, shortcutFrom ?? id) });
  const checkbox = (id: AppCommand, label: string, checked: boolean, enabled: boolean) => command(id, label, enabled, { type: 'checkbox', checked });
  const role = (r: SystemRole, label: string): MenuItem => ({ kind: 'role', role: r, label });
  return { command, radio, checkbox, role };
}

type Builders = ReturnType<typeof itemsBuilder>;

/** What the state allows, named once for every section. */
function abilities(state: MenuState) {
  return {
    image: state.hasImage,
    /** A finished trace to save, export or edit. */
    canEdit: state.hasResult && !state.isProcessing,
    outline: !state.isCenterline,
  };
}
type Abilities = ReturnType<typeof abilities>;

function appMenu({ command, role }: Builders): MenuSection {
  return {
    label: 'Vectopix',
    role: 'appMenu',
    items: [
      command('showAbout', 'menu.about'),
      command('checkUpdates', 'menu.checkUpdates'),
      SEPARATOR,
      command('showPreferences', 'menu.preferences'),
      SEPARATOR,
      role('services', 'menu.services'),
      SEPARATOR,
      role('hide', 'menu.hide'),
      role('hideOthers', 'menu.hideOthers'),
      role('unhide', 'menu.showAll'),
      SEPARATOR,
      role('quit', 'menu.quit'),
    ],
  };
}

function fileMenu({ command, role }: Builders, can: Abilities, mac: boolean): MenuSection {
  const recent: MenuItem[] = mac
    ? [{ kind: 'submenu', label: 'menu.openRecent', recentDocuments: true, items: [role('clearRecentDocuments', 'menu.clearRecent')] }]
    : [];
  return {
    label: 'menu.file',
    items: [
      command('newImage', 'menu.new', can.image),
      command('openImage', 'menu.open'),
      ...recent,
      { kind: 'submenu', label: 'menu.samples', items: SAMPLE_IMAGES.map((s) => command(sampleCommand(s.id), `sample.${s.id}.title`)) },
      SEPARATOR,
      command('saveSvg', 'menu.saveSvg', can.canEdit),
      command('export', 'menu.export', can.canEdit),
      command('copySvg', 'menu.copySvg', can.canEdit),
      SEPARATOR,
      role('close', 'menu.closeWindow'),
      ...(mac ? [] : [role('quit', 'menu.quit')]),
    ],
  };
}

function editMenu({ command, role }: Builders, state: MenuState, can: Abilities, mac: boolean): MenuSection {
  return {
    label: 'menu.edit',
    items: [
      command('undo', 'menu.undo', state.canUndo),
      command('redo', 'menu.redo', state.canRedo),
      SEPARATOR,
      role('cut', 'menu.cut'),
      role('copy', 'menu.copy'),
      role('paste', 'menu.paste'),
      role('selectAll', 'menu.selectAll'),
      SEPARATOR,
      command('simplifyNodes', 'menu.simplify', can.canEdit),
      command('restoreTrace', 'menu.restoreTrace', can.canEdit && state.hasEdits),
      // Preferences live in the application menu on macOS, under Edit elsewhere
      ...(mac ? [] : [SEPARATOR, command('showPreferences', 'menu.preferences')]),
    ],
  };
}

function viewMenu({ command, radio, role }: Builders, state: MenuState, can: Abilities): MenuSection {
  const view = (id: AppCommand, label: string, mode: MenuState['viewMode']) => radio(id, label, state.viewMode === mode, can.image);
  return {
    label: 'menu.view',
    items: [
      view('view.split', 'menu.viewSplit', 'split'),
      view('view.sideBySide', 'menu.viewSideBySide', 'side-by-side'),
      view('view.vector', 'menu.viewVector', 'vector'),
      view('view.raster', 'menu.viewRaster', 'raster'),
      SEPARATOR,
      radio('render.full', 'menu.renderFill', state.renderMode === 'full', can.image),
      radio('render.wireframe', 'menu.renderOutlines', state.renderMode === 'wireframe', can.image, 'toggleOutlines'),
      radio('render.nodes', 'menu.renderNodes', state.renderMode === 'nodes', can.canEdit, 'toggleNodeEditor'),
      SEPARATOR,
      command('zoomIn', 'menu.zoomIn', can.image),
      command('zoomOut', 'menu.zoomOut', can.image),
      command('zoomActual', 'menu.zoomActual', can.image),
      command('zoomFit', 'menu.zoomFit', can.image),
      SEPARATOR,
      role('togglefullscreen', 'menu.fullScreen'),
      ...(state.isDevelopment ? [role('toggleDevTools', 'menu.devTools')] : []),
    ],
  };
}

function imageMenu({ command, radio, checkbox }: Builders, state: MenuState, can: Abilities): MenuSection {
  const outlineOption = can.image && can.outline;
  return {
    label: 'menu.image',
    items: [
      {
        kind: 'submenu',
        label: 'menu.presets',
        items: OUTLINE_PRESETS.map((p) => radio(`preset.${p}`, `preset.${p}.name`, can.outline && state.preset === p, outlineOption)),
      },
      {
        kind: 'submenu',
        label: 'menu.method',
        items: [radio('method.outline', 'sidebar.outline', can.outline, can.image), radio('method.centerline', 'sidebar.centerline', !can.outline, can.image)],
      },
      SEPARATOR,
      checkbox('toggleAutoColors', 'sidebar.autoColors', state.autoColors, outlineOption),
      checkbox('toggleTransparent', 'sidebar.transparent', state.transparentBackground, outlineOption),
      SEPARATOR,
      command('retrace', 'menu.retrace', can.image && !state.isProcessing),
    ],
  };
}

function windowMenu({ role }: Builders, mac: boolean): MenuSection {
  return {
    label: 'menu.window',
    role: 'windowMenu',
    items: [role('minimize', 'menu.minimize'), role('zoom', 'menu.zoomWindow'), ...(mac ? [SEPARATOR, role('front', 'menu.bringAllToFront')] : [])],
  };
}

function helpMenu({ command }: Builders, mac: boolean): MenuSection {
  return {
    label: 'menu.help',
    role: 'help',
    items: [
      command('showShortcuts', 'menu.shortcuts'),
      command('openReleaseNotes', 'menu.releaseNotes'),
      SEPARATOR,
      command('openWebsite', 'menu.website'),
      command('openSource', 'menu.source'),
      command('reportIssue', 'menu.reportIssue'),
      // About and updates live in the application menu on macOS
      ...(mac ? [] : [SEPARATOR, command('checkUpdates', 'menu.checkUpdates'), command('showAbout', 'menu.about')]),
    ],
  };
}

export function buildMenu(state: MenuState, platform: MenuPlatform): MenuSection[] {
  const b = itemsBuilder(platform);
  const can = abilities(state);
  const mac = platform === 'mac';
  return [
    ...(mac ? [appMenu(b)] : []),
    fileMenu(b, can, mac),
    editMenu(b, state, can, mac),
    viewMenu(b, state, can),
    imageMenu(b, state, can),
    windowMenu(b, mac),
    helpMenu(b, mac),
  ];
}

/** Every label key the menus can show (for translation checks). */
export function menuLabels(sections: MenuSection[]): string[] {
  const walk = (items: MenuItem[]): string[] =>
    items.flatMap((i) => (i.kind === 'separator' ? [] : i.kind === 'submenu' ? [i.label, ...walk(i.items)] : [i.label]));
  return [...new Set(sections.flatMap((s) => [s.label, ...walk(s.items)]))];
}
