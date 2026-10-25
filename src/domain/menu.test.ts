import { describe, expect, it } from 'vitest';
import { buildMenu, menuLabels, type MenuItem, type MenuSection, type MenuState } from './menu';
import { SHORTCUTS } from './commands';

const IDLE: MenuState = {
  hasImage: false,
  hasResult: false,
  isProcessing: false,
  canUndo: false,
  canRedo: false,
  hasEdits: false,
  isCenterline: false,
  viewMode: 'split',
  renderMode: 'full',
  preset: 'logo',
  transparentBackground: false,
  autoColors: true,
  isDevelopment: false,
};
const EDITING: MenuState = { ...IDLE, hasImage: true, hasResult: true, canUndo: true, hasEdits: true };

const all = (sections: MenuSection[]): MenuItem[] => {
  const walk = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => (i.kind === 'submenu' ? [i, ...walk(i.items)] : [i]));
  return sections.flatMap((s) => walk(s.items));
};
const find = (sections: MenuSection[], command: string) =>
  all(sections).find((i): i is Extract<MenuItem, { kind: 'command' }> => i.kind === 'command' && i.command === command)!;
const roles = (sections: MenuSection[]) => all(sections).flatMap((i) => (i.kind === 'role' ? [i.role] : []));

describe('menu bar', () => {
  it('follows each platform: an application menu on macOS, About and Quit elsewhere', () => {
    expect(buildMenu(IDLE, 'mac').map((s) => s.label)).toEqual(['Vectopix', 'menu.file', 'menu.edit', 'menu.view', 'menu.image', 'menu.window', 'menu.help']);
    const windows = buildMenu(IDLE, 'windows');
    expect(windows.map((s) => s.label)).toEqual(['menu.file', 'menu.edit', 'menu.view', 'menu.image', 'menu.window', 'menu.help']);
    expect(windows.find((s) => s.label === 'menu.help')!.items.some((i) => i.kind === 'command' && i.command === 'showAbout')).toBe(true);
    expect(roles(windows.filter((s) => s.label === 'menu.file'))).toContain('quit');
  });

  it('offers recent files on macOS, where the system keeps the list', () => {
    expect(all(buildMenu(IDLE, 'mac')).some((i) => i.kind === 'submenu' && i.recentDocuments)).toBe(true);
    expect(all(buildMenu(IDLE, 'linux')).some((i) => i.kind === 'submenu' && i.recentDocuments)).toBe(false);
  });

  it('enables only what applies: nothing to save, edit or view without a trace', () => {
    const idle = buildMenu(IDLE, 'mac');
    for (const c of ['saveSvg', 'export', 'copySvg', 'copyPng', 'undo', 'simplifyNodes', 'restoreTrace', 'newImage', 'view.split', 'zoomIn', 'retrace']) {
      expect(find(idle, c).enabled, c).toBe(false);
    }
    for (const c of ['openImage', 'showAbout', 'showPreferences', 'showShortcuts']) expect(find(idle, c).enabled, c).toBe(true);

    const editing = buildMenu(EDITING, 'mac');
    for (const c of ['saveSvg', 'export', 'undo', 'restoreTrace', 'render.nodes']) expect(find(editing, c).enabled, c).toBe(true);
    expect(find(editing, 'redo').enabled).toBe(false);
  });

  it('holds back saving and editing while a trace runs', () => {
    const busy = buildMenu({ ...EDITING, isProcessing: true }, 'mac');
    expect(find(busy, 'saveSvg').enabled).toBe(false);
    expect(find(busy, 'retrace').enabled).toBe(false);
  });

  it('checks the current view, drawing mode, preset and options', () => {
    const menu = buildMenu({ ...EDITING, viewMode: 'raster', renderMode: 'nodes', preset: 'pixel-art', transparentBackground: true }, 'mac');
    expect(find(menu, 'view.raster').checked).toBe(true);
    expect(find(menu, 'view.split').checked).toBe(false);
    expect(find(menu, 'render.nodes').checked).toBe(true);
    expect(find(menu, 'preset.pixel-art').checked).toBe(true);
    expect(find(menu, 'toggleTransparent').checked).toBe(true);
  });

  it('disables outline options for a centerline trace', () => {
    const menu = buildMenu({ ...EDITING, isCenterline: true }, 'mac');
    expect(find(menu, 'method.centerline').checked).toBe(true);
    expect(find(menu, 'preset.logo').enabled).toBe(false);
    expect(find(menu, 'toggleTransparent').enabled).toBe(false);
  });

  it('shows the keyboard shortcuts, but no bare-key ones on macOS', () => {
    const mac = buildMenu(EDITING, 'mac');
    expect(find(mac, 'undo').shortcut).toEqual(SHORTCUTS.undo![0]);
    expect(find(mac, 'render.wireframe').shortcut).toBeUndefined();
    expect(find(buildMenu(EDITING, 'windows'), 'render.wireframe').shortcut).toEqual({ key: 'w' });
  });

  it('offers developer tools only in development builds', () => {
    expect(roles(buildMenu(IDLE, 'mac'))).not.toContain('toggleDevTools');
    expect(roles(buildMenu({ ...IDLE, isDevelopment: true }, 'mac'))).toContain('toggleDevTools');
  });

  it('lists every label it uses', () => {
    const labels = menuLabels(buildMenu(IDLE, 'mac'));
    expect(labels).toContain('menu.file');
    expect(labels).toContain('sample.pixel-heart.title');
    expect(labels).not.toContain(undefined);
  });
});
