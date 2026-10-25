import { describe, expect, it, vi } from 'vitest';
import { createElectronShell, toAccelerator, toWireMenu } from './electronShell';
import type { DesktopBridge } from './protocol';
import { buildMenu } from '../../domain/menu';

const STATE = {
  hasImage: true, hasResult: true, isProcessing: false, canUndo: true, canRedo: false, hasEdits: false, isCenterline: false,
  viewMode: 'split' as const, renderMode: 'full' as const, preset: 'logo', transparentBackground: false, autoColors: true, isDevelopment: false,
};

function fakeBridge(platform: DesktopBridge['platform'] = 'darwin') {
  const listeners: Record<string, (payload: never) => void> = {};
  const bridge: DesktopBridge = {
    platform,
    isPackaged: true,
    setMenu: vi.fn(),
    onCommand: vi.fn((h) => ((listeners.command = h as never), () => {})),
    onOpenFile: vi.fn((h) => ((listeners.file = h as never), () => {})),
    rememberFile: vi.fn(),
    setCloseConfirmation: vi.fn(),
  };
  return { bridge, emit: (name: string, payload: unknown) => listeners[name](payload as never) };
}

describe('toAccelerator', () => {
  it('writes shortcuts in Electron’s notation', () => {
    expect(toAccelerator({ key: 'z', command: true, shift: true })).toBe('CmdOrCtrl+Shift+Z');
    expect(toAccelerator({ key: '+', command: true })).toBe('CmdOrCtrl+Plus');
    expect(toAccelerator({ key: ',', command: true })).toBe('CmdOrCtrl+,');
    expect(toAccelerator({ key: 'w' })).toBe('W');
  });
});

describe('toWireMenu', () => {
  it('shows bare-key shortcuts without taking the key from text fields', () => {
    const items = toWireMenu(buildMenu(STATE, 'windows')).flatMap((s) => s.items);
    const outlines = items.find((i) => i.kind === 'command' && i.command === 'render.wireframe');
    const undo = items.find((i) => i.kind === 'command' && i.command === 'undo');
    expect(outlines).toMatchObject({ accelerator: 'W', registerAccelerator: false });
    expect(undo).toMatchObject({ accelerator: 'CmdOrCtrl+Z', registerAccelerator: true });
  });
});

describe('createElectronShell', () => {
  it('names the platform as the menus expect', () => {
    expect(createElectronShell(fakeBridge('darwin').bridge).platform).toBe('mac');
    expect(createElectronShell(fakeBridge('win32').bridge).platform).toBe('windows');
    expect(createElectronShell(fakeBridge('linux').bridge).platform).toBe('linux');
  });

  it('turns files the system hands over into Files', () => {
    const { bridge, emit } = fakeBridge();
    const opened = vi.fn();
    createElectronShell(bridge).onOpenFile(opened);
    emit('file', { name: 'logo.png', type: 'image/png', data: new Uint8Array([1, 2, 3]) });
    const file: File = opened.mock.calls[0][0];
    expect(file.name).toBe('logo.png');
    expect(file.size).toBe(3);
  });

  it('sends the menu in wire form and relays clicks', () => {
    const { bridge, emit } = fakeBridge();
    const shell = createElectronShell(bridge);
    shell.setMenu(buildMenu(STATE, 'mac'));
    expect(vi.mocked(bridge.setMenu).mock.calls[0][0][0].label).toBe('Vectopix');
    const clicked = vi.fn();
    shell.onCommand(clicked);
    emit('command', 'zoomFit');
    expect(clicked).toHaveBeenCalledWith('zoomFit');
  });
});
