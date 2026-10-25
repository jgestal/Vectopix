import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { toMenuTemplate } = require('../../electron/menu.cjs') as { toMenuTemplate: (sections: unknown[], send: (c: string) => void) => Record<string, unknown>[] };

const SECTIONS = [
  { label: 'Vectopix', role: 'appMenu', items: [{ kind: 'command', command: 'showAbout', label: 'About Vectopix', enabled: true }, { kind: 'role', role: 'quit', label: 'Quit' }] },
  {
    label: 'File',
    items: [
      { kind: 'command', command: 'saveSvg', label: 'Save', enabled: false, accelerator: 'CmdOrCtrl+S', registerAccelerator: true },
      { kind: 'submenu', label: 'Open Recent', recentDocuments: true, items: [{ kind: 'role', role: 'clearRecentDocuments', label: 'Clear' }] },
      { kind: 'separator' },
      { kind: 'role', role: 'shell.openExternal', label: 'Sneaky' },
    ],
  },
  { label: 'View', items: [{ kind: 'command', command: 'render.wireframe', label: 'Outlines', enabled: true, type: 'radio', checked: true, accelerator: 'W', registerAccelerator: false }] },
  { label: 'Window', role: 'windowMenu', items: [] },
  { label: 'Help', role: 'help', items: [] },
];

describe('electron menu template', () => {
  const send = vi.fn();
  const [app, file, view, windowMenu, help] = toMenuTemplate(SECTIONS, send);
  const items = (section: Record<string, unknown>) => section.submenu as Record<string, unknown>[];

  it('builds commands that send their id when clicked', () => {
    const about = items(app)[0];
    expect(about).toMatchObject({ id: 'showAbout', label: 'About Vectopix', enabled: true });
    (about.click as () => void)();
    expect(send).toHaveBeenCalledWith('showAbout');
  });

  it('keeps accelerators, and only registers those the page asked for', () => {
    expect(items(file)[0]).toMatchObject({ accelerator: 'CmdOrCtrl+S', registerAccelerator: true, enabled: false });
    expect(items(view)[0]).toMatchObject({ type: 'radio', checked: true, accelerator: 'W', registerAccelerator: false });
  });

  it('uses the system’s recent documents and window/help sections', () => {
    expect(items(file)[1]).toMatchObject({ role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] });
    expect(windowMenu.role).toBe('window');
    expect(help.role).toBe('help');
    expect(app.role).toBeUndefined();
  });

  it('accepts only known system roles from the page', () => {
    expect(items(file)[3]).toEqual({ type: 'separator' });
  });
});
