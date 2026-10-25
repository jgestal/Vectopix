/**
 * What the interface and the desktop shell's main process exchange through
 * the preload bridge (electron/preload.cjs). Plain, serialisable data only.
 */

/** A native menu item, as electron/menu.cjs turns it into Electron's template. */
export type WireMenuItem =
  | {
      kind: 'command';
      command: string;
      label: string;
      enabled: boolean;
      checked?: boolean;
      type?: 'checkbox' | 'radio';
      /** Electron accelerator ("CmdOrCtrl+Shift+Z"), if any. */
      accelerator?: string;
      /** False: shown, but the key is left to the page (bare keys while typing). */
      registerAccelerator?: boolean;
    }
  | { kind: 'role'; role: string; label: string }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: string; items: WireMenuItem[]; recentDocuments?: boolean };

export interface WireMenuSection {
  label: string;
  role?: 'appMenu' | 'windowMenu' | 'help';
  items: WireMenuItem[];
}

/** The bridge the preload script exposes as window.vectopixDesktop. */
export interface DesktopBridge {
  platform: 'darwin' | 'win32' | 'linux';
  isPackaged: boolean;
  setMenu(sections: WireMenuSection[]): void;
  onCommand(handler: (command: string) => void): () => void;
  onOpenFile(handler: (file: { name: string; type: string; data: Uint8Array }) => void): () => void;
  rememberFile(file: File): void;
  setCloseConfirmation(confirm: { title: string; message: string; discard: string; cancel: string } | null): void;
}
