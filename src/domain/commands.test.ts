import { describe, expect, it } from 'vitest';
import { commandForKey, SHORTCUTS, type KeyPress } from './commands';

const press = (key: string, mods: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({ key, command: false, shift: false, alt: false, ...mods });
const web = (p: KeyPress) => commandForKey(p, false);
const desktop = (p: KeyPress) => commandForKey(p, true);

describe('commandForKey', () => {
  it('maps the editing shortcuts held with ⌘/Ctrl', () => {
    expect(web(press('z', { command: true }))).toBe('undo');
    expect(web(press('Z', { command: true, shift: true }))).toBe('redo');
    expect(web(press('y', { command: true }))).toBe('redo');
    expect(web(press('y', { command: true, shift: true }))).toBe('redo');
    expect(web(press('c', { command: true }))).toBe('copySvg');
    expect(web(press('C', { command: true, shift: true }))).toBe('copySvg');
  });

  it('maps file shortcuts', () => {
    expect(web(press('o', { command: true }))).toBe('openImage');
    expect(web(press('s', { command: true }))).toBe('saveSvg');
    expect(web(press('e', { command: true }))).toBe('export');
  });

  it('maps single keys, whatever their case or Shift', () => {
    expect(web(press('N'))).toBe('toggleNodeEditor');
    expect(web(press('e'))).toBe('toggleNodeEditor');
    expect(web(press('w'))).toBe('toggleOutlines');
    expect(web(press('s'))).toBe('toggleSplit');
    expect(web(press('d'))).toBe('toggleSideBySide');
    expect(web(press('?', { shift: true }))).toBe('showShortcuts');
    expect(web(press('F1'))).toBe('showShortcuts');
    expect(web(press('Escape'))).toBe('closeDialogs');
  });

  it('leaves the browser its own keys, which only the desktop menus take', () => {
    for (const key of ['n', '1', 'r', ',', '0']) {
      expect(web(press(key, { command: true }))).toBeNull();
      expect(desktop(press(key, { command: true }))).not.toBeNull();
    }
    expect(desktop(press('+', { command: true, shift: true }))).toBe('zoomIn');
  });

  it('ignores everything else, and anything held with Alt', () => {
    expect(web(press('x'))).toBeNull();
    expect(web(press('n', { alt: true }))).toBeNull();
    expect(web(press('z', { command: true, alt: true }))).toBeNull();
  });

  it('never gives one key press to two commands', () => {
    const seen = new Map<string, string>();
    for (const [command, list] of Object.entries(SHORTCUTS)) {
      for (const s of list ?? []) {
        const id = `${s.command ? 'cmd+' : ''}${s.shift ? 'shift+' : ''}${s.key}`;
        expect(seen.get(id), `${id} is bound twice`).toBeUndefined();
        seen.set(id, command);
      }
    }
  });
});
