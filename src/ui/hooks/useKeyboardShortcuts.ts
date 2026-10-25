import { useEffect, useRef } from 'react';
import { shortcutFor, type ShortcutAction } from '../../domain/shortcuts';

/** Input types that don't take typing: shortcuts keep working while they have focus. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file']);

/** Whether keys typed now are text for the focused field (so not shortcuts). */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return ['TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

/**
 * Run the handler of each shortcut (see domain/shortcuts). A handler returns
 * false to let the key through (e.g. ⌘C with text selected copies the text).
 */
export function useKeyboardShortcuts(handlers: Partial<Record<ShortcutAction, () => boolean | void>>) {
  // The latest handlers, without re-subscribing on every render
  const current = useRef(handlers);
  useEffect(() => {
    current.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextEntry(e.target)) return;
      const action = shortcutFor({ key: e.key, command: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
      const handler = action && current.current[action];
      if (handler && handler() !== false) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
