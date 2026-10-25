import { useEffect, useRef } from 'react';
import { commandForKey, type AppCommand } from '../../domain/commands';
import { useServices } from '../services/context';

/** Input types that don't take typing: shortcuts keep working while they have focus. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file']);

/** Whether keys typed now are text for the focused field (so not shortcuts). */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return ['TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

/**
 * A handler returns false when the command doesn't apply right now (⌘C with
 * text selected copies the text): the key then does what it normally does.
 */
export type CommandHandlers = Partial<Record<AppCommand, () => boolean | void>>;

/**
 * Run each command's handler, whether it came from the keyboard or from the
 * desktop app's menu bar. `handlers` builds them when a command arrives (not
 * while rendering), from the latest state.
 */
export function useCommands(handlers: () => CommandHandlers) {
  const { desktop } = useServices();
  // The latest factory, without re-subscribing on every render
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextEntry(e.target)) return;
      const command = commandForKey({ key: e.key, command: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey }, !!desktop);
      const handler = command && latest.current()[command];
      if (handler && handler() !== false) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    const stopMenu = desktop?.onCommand((command) => latest.current()[command]?.());
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      stopMenu?.();
    };
  }, [desktop]);
}
