/**
 * Undo history: a list of steps and the one on screen. Immutable: every
 * operation returns a new history. Adding a step after undoing drops the
 * steps that could have been redone, as in any editor.
 */
export interface History<T> {
  readonly entries: readonly T[];
  /** The step on screen; -1 when empty. */
  readonly index: number;
}

export const emptyHistory = <T>(): History<T> => ({ entries: [], index: -1 });

export const currentStep = <T>(h: History<T>): T | null => h.entries[h.index] ?? null;
export const canUndo = <T>(h: History<T>): boolean => h.index > 0;
export const canRedo = <T>(h: History<T>): boolean => h.index < h.entries.length - 1;

/** Add a step after the current one, keeping at most `limit` steps (the oldest go). */
export function pushStep<T>(h: History<T>, step: T, limit: number): History<T> {
  const entries = [...h.entries.slice(0, h.index + 1), step].slice(-limit);
  return { entries, index: entries.length - 1 };
}

/** Make `index` the current step; the same history if it doesn't exist. */
export function goTo<T>(h: History<T>, index: number): History<T> {
  return index >= 0 && index < h.entries.length ? { ...h, index } : h;
}

export const undo = <T>(h: History<T>): History<T> => goTo(h, h.index - 1);
export const redo = <T>(h: History<T>): History<T> => goTo(h, h.index + 1);

/** Update every step (e.g. to attach a measurement that arrived later). */
export function mapSteps<T>(h: History<T>, fn: (step: T) => T): History<T> {
  return { ...h, entries: h.entries.map(fn) };
}
