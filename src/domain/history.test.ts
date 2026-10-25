import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, currentStep, emptyHistory, goTo, mapSteps, pushStep, redo, undo } from './history';

const LIMIT = 50;
const build = (...steps: string[]) => steps.reduce((h, s) => pushStep(h, s, LIMIT), emptyHistory<string>());

describe('history', () => {
  it('starts empty, with nothing to undo or redo', () => {
    const h = emptyHistory<string>();
    expect(currentStep(h)).toBeNull();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('shows the newest step, and undo/redo move between steps', () => {
    const h = build('trace', 'edit');
    expect(currentStep(h)).toBe('edit');
    expect(currentStep(undo(h))).toBe('trace');
    expect(currentStep(redo(undo(h)))).toBe('edit');
  });

  it('stays put past either end', () => {
    const h = build('only');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(goTo(h, 7)).toBe(h);
  });

  it('drops the redo steps when a step is added after undoing', () => {
    const h = pushStep(undo(build('trace', 'edit A')), 'edit B', LIMIT);
    expect(h.entries).toEqual(['trace', 'edit B']);
    expect(canRedo(h)).toBe(false);
  });

  it('keeps at most the limit, dropping the oldest', () => {
    const h = ['a', 'b', 'c', 'd'].reduce((acc, s) => pushStep(acc, s, 3), emptyHistory<string>());
    expect(h.entries).toEqual(['b', 'c', 'd']);
    expect(currentStep(h)).toBe('d');
  });

  it('updates every step without moving', () => {
    const h = mapSteps(undo(build('a', 'b')), (s) => s.toUpperCase());
    expect(h.entries).toEqual(['A', 'B']);
    expect(currentStep(h)).toBe('A');
  });

  it('never changes the history it was given', () => {
    const h = build('a');
    pushStep(h, 'b', LIMIT);
    expect(h.entries).toEqual(['a']);
  });
});
