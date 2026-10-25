import type { DesktopShell, TranslatedMenu } from '../../application/ports';
import type { AppCommand, Shortcut } from '../../domain/commands';
import type { MenuItem, MenuPlatform } from '../../domain/menu';
import type { DesktopBridge, WireMenuItem, WireMenuSection } from './protocol';

/** Electron's names for keys that aren't a plain character. */
const ACCELERATOR_KEYS: Record<string, string> = { '+': 'Plus', escape: 'Escape', f1: 'F1' };

/** A shortcut in Electron's accelerator notation ("CmdOrCtrl+Shift+Z"). */
export function toAccelerator({ key, command, shift, alt }: Shortcut): string {
  const name = ACCELERATOR_KEYS[key] ?? key.toUpperCase();
  return [command && 'CmdOrCtrl', alt && 'Alt', shift && 'Shift', name].filter(Boolean).join('+');
}

function toWire(item: MenuItem): WireMenuItem {
  if (item.kind !== 'command') return item.kind === 'submenu' ? { ...item, items: item.items.map(toWire) } : item;
  const { shortcut, ...rest } = item;
  if (!shortcut) return rest;
  // A bare key is only shown: registered, it would be taken even while typing
  return { ...rest, accelerator: toAccelerator(shortcut), registerAccelerator: !!shortcut.command };
}

export const toWireMenu = (menu: TranslatedMenu): WireMenuSection[] => menu.map((s) => ({ ...s, items: s.items.map(toWire) }));

const PLATFORMS: Record<DesktopBridge['platform'], MenuPlatform> = { darwin: 'mac', win32: 'windows', linux: 'linux' };

/** The desktop shell, through the bridge electron/preload.cjs exposes. */
export function createElectronShell(bridge: DesktopBridge): DesktopShell {
  return {
    platform: PLATFORMS[bridge.platform] ?? 'linux',
    isDevelopment: !bridge.isPackaged,
    setMenu: (menu) => bridge.setMenu(toWireMenu(menu)),
    onCommand: (handler) => bridge.onCommand((command) => handler(command as AppCommand)),
    onOpenFile: (handler) => bridge.onOpenFile(({ name, type, data }) => handler(new File([data as BlobPart], name, { type }))),
    rememberFile: (file) => bridge.rememberFile(file),
    setCloseConfirmation: (confirm) => bridge.setCloseConfirmation(confirm),
    setProgress: (fraction) => bridge.setProgress(fraction),
    setTheme: (preference) => bridge.setTheme(preference),
  };
}

declare global {
  interface Window {
    /** Present only in the desktop app (electron/preload.cjs). */
    vectopixDesktop?: DesktopBridge;
  }
}
