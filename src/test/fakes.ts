import type { CloseConfirmation, DesktopShell, ReleaseSource, SettingsStore, TranslatedMenu } from '../application/ports';
import type { AppCommand } from '../domain/commands';
import type { MenuItem, MenuPlatform } from '../domain/menu';

/** SettingsStore in memory; `values` can be inspected or pre-filled. */
export class MemoryStore implements SettingsStore {
  readonly values = new Map<string, unknown>();
  read(key: string): unknown {
    return this.values.get(key);
  }
  write(key: string, value: unknown): void {
    this.values.set(key, structuredClone(value));
  }
  remove(key: string): void {
    this.values.delete(key);
  }
}

/** Storage (the DOM interface) in memory. */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

/** A ReleaseSource answering with a fixed release (or failing), counting calls. */
export class FakeReleaseSource implements ReleaseSource {
  calls = 0;
  release: { version: string; url: string } | null | Error;
  constructor(release: { version: string; url: string } | null | Error) {
    this.release = release;
  }
  async latest() {
    this.calls++;
    if (this.release instanceof Error) throw this.release;
    return this.release;
  }
}

export const releasePage = (version: string) => `https://github.com/jgestal/Vectopix/releases/tag/v${version}`;

/** The SvgDom the app uses, on the test environment's DOMParser (happy-dom). */
export { createSvgDom as testSvgDom } from '../infrastructure/browser/svgDom';

/** A desktop shell that records the menu it gets and lets a test click it or hand over files. */
export class FakeDesktopShell implements DesktopShell {
  readonly platform: MenuPlatform;
  readonly isDevelopment = false;
  menus: TranslatedMenu[] = [];
  remembered: string[] = [];
  closeConfirmation: CloseConfirmation | null = null;
  private commandHandlers = new Set<(command: AppCommand) => void>();
  private fileHandlers = new Set<(file: File) => void>();

  constructor(platform: MenuPlatform = 'mac') {
    this.platform = platform;
  }
  setMenu(menu: TranslatedMenu) {
    this.menus.push(menu);
  }
  onCommand(handler: (command: AppCommand) => void) {
    this.commandHandlers.add(handler);
    return () => this.commandHandlers.delete(handler);
  }
  onOpenFile(handler: (file: File) => void) {
    this.fileHandlers.add(handler);
    return () => this.fileHandlers.delete(handler);
  }
  rememberFile(file: File) {
    this.remembered.push(file.name);
  }
  setCloseConfirmation(confirm: CloseConfirmation | null) {
    this.closeConfirmation = confirm;
  }
  /** A click on a menu item. */
  click(command: AppCommand) {
    this.commandHandlers.forEach((h) => h(command));
  }
  /** A file from the system (Open Recent, the Dock). */
  open(file: File) {
    this.fileHandlers.forEach((h) => h(file));
  }
  get lastMenu() {
    return this.menus[this.menus.length - 1];
  }
  /** A command item of the last menu sent, by command. */
  item(command: AppCommand) {
    const walk = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => (i.kind === 'submenu' ? walk(i.items) : [i]));
    return this.lastMenu
      .flatMap((s) => walk(s.items))
      .find((i): i is Extract<MenuItem, { kind: 'command' }> => i.kind === 'command' && i.command === command);
  }
}
