import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyPress } from './shortcuts';

const press = (key: string, mods: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({ key, command: false, shift: false, alt: false, ...mods });

describe('shortcutFor', () => {
  it('maps the editing shortcuts held with ⌘/Ctrl', () => {
    expect(shortcutFor(press('z', { command: true }))).toBe('undo');
    expect(shortcutFor(press('Z', { command: true, shift: true }))).toBe('redo');
    expect(shortcutFor(press('y', { command: true }))).toBe('redo');
    expect(shortcutFor(press('c', { command: true }))).toBe('copySvg');
  });

  it('maps single keys, whatever their case', () => {
    expect(shortcutFor(press('N'))).toBe('toggleNodeEditor');
    expect(shortcutFor(press('e'))).toBe('toggleNodeEditor');
    expect(shortcutFor(press('w'))).toBe('toggleOutlines');
    expect(shortcutFor(press('s'))).toBe('toggleSplit');
    expect(shortcutFor(press('d'))).toBe('toggleSideBySide');
    expect(shortcutFor(press('?'))).toBe('toggleHelp');
    expect(shortcutFor(press('F1'))).toBe('toggleHelp');
    expect(shortcutFor(press('Escape'))).toBe('closeDialogs');
  });

  it('ignores everything else, and single keys held with Alt or ⌘/Ctrl', () => {
    expect(shortcutFor(press('x'))).toBeNull();
    expect(shortcutFor(press('n', { alt: true }))).toBeNull();
    expect(shortcutFor(press('n', { command: true }))).toBeNull();
    expect(shortcutFor(press('y', { command: true, shift: true }))).toBe('redo');
  });
});
