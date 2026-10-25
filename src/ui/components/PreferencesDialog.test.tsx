// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesDialog } from './PreferencesDialog';
import { renderWithServices } from '../../test/renderWithServices';
import { FakeDesktopShell } from '../../test/fakes';
import { DEFAULT_OPTIONS } from '../../domain/presets';

describe('PreferencesDialog', () => {
  it('offers the language, and update checks only in the desktop app', () => {
    renderWithServices(<PreferencesDialog onClose={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Check for updates/ })).toBeNull();
  });

  it('remembers switching update checks off', async () => {
    const { services } = renderWithServices(<PreferencesDialog onClose={vi.fn()} onReset={vi.fn()} />, { desktop: new FakeDesktopShell() });
    const box = screen.getByRole('checkbox', { name: /Check for updates/ }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    await userEvent.click(box);
    expect(services.preferences.loadAppPreferences()).toMatchObject({ checkForUpdates: false });
  });

  it('switches the theme at once, and remembers it', async () => {
    const desktop = new FakeDesktopShell();
    const { services } = renderWithServices(<PreferencesDialog onClose={vi.fn()} onReset={vi.fn()} />, { desktop });
    const appearance = screen.getByRole('group', { name: 'Appearance' });
    expect(within(appearance).getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(within(appearance).getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(desktop.theme).toBe('dark');
    expect(services.preferences.loadAppPreferences()).toMatchObject({ theme: 'dark' });
  });

  it('forgets remembered settings when asked', async () => {
    const onReset = vi.fn();
    const { services } = renderWithServices(<PreferencesDialog onClose={vi.fn()} onReset={onReset} />);
    services.preferences.saveUserOptions({ ...DEFAULT_OPTIONS, colors: 5 });
    await userEvent.click(screen.getByRole('button', { name: /Restore Default Settings/ }));
    expect(services.preferences.loadUserOptions()).toEqual(DEFAULT_OPTIONS);
    expect(onReset).toHaveBeenCalled();
  });
});
