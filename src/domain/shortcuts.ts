/**
 * Keyboard shortcuts as data: which key does what. The UI turns key events
 * into a KeyPress and runs the action this table names.
 */

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copySvg'
  | 'toggleHelp'
  | 'closeDialogs'
  | 'toggleOutlines'
  | 'toggleNodeEditor'
  | 'toggleSplit'
  | 'toggleSideBySide';

export interface KeyPress {
  key: string;
  /** Ctrl, or ⌘ on macOS. */
  command: boolean;
  shift: boolean;
  alt: boolean;
}

/** With ⌘/Ctrl held. */
const COMMAND_KEYS: Record<string, ShortcutAction> = { z: 'undo', y: 'redo', c: 'copySvg' };
/** ⌘/Ctrl + Shift. */
const COMMAND_SHIFT_KEYS: Record<string, ShortcutAction> = { z: 'redo' };
/** On their own (case-insensitive letters; named keys as the browser reports them). */
const PLAIN_KEYS: Record<string, ShortcutAction> = {
  '?': 'toggleHelp',
  f1: 'toggleHelp',
  escape: 'closeDialogs',
  w: 'toggleOutlines',
  e: 'toggleNodeEditor',
  n: 'toggleNodeEditor',
  s: 'toggleSplit',
  d: 'toggleSideBySide',
};

export function shortcutFor({ key, command, shift, alt }: KeyPress): ShortcutAction | null {
  const k = key.toLowerCase();
  if (command) return (shift ? COMMAND_SHIFT_KEYS[k] : undefined) ?? COMMAND_KEYS[k] ?? null;
  if (alt) return null;
  return PLAIN_KEYS[k] ?? null;
}
