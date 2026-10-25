// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme } from './theme';
import { FakeDesktopShell } from '../test/fakes';

function systemIsDark(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    change(next: boolean) {
      query.matches = next;
      listeners.forEach((l) => l());
    },
    listeners,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('applyTheme', () => {
  it('sets the chosen theme on the page and the desktop app', () => {
    systemIsDark(false);
    const desktop = new FakeDesktopShell();
    applyTheme('dark', desktop);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(desktop.theme).toBe('dark');
  });

  it('follows the system while set to System, and stops once a theme is chosen', () => {
    const system = systemIsDark(false);
    applyTheme('system', null);
    expect(document.documentElement.dataset.theme).toBe('light');
    system.change(true);
    expect(document.documentElement.dataset.theme).toBe('dark');

    applyTheme('light', null);
    expect(system.listeners.size).toBe(0);
    system.change(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
