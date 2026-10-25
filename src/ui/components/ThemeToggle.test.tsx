// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { renderWithServices } from '../../test/renderWithServices';
import { FakeDesktopShell } from '../../test/fakes';

describe('ThemeToggle', () => {
  it('steps System → Light → Dark → System, applying and remembering each', async () => {
    const desktop = new FakeDesktopShell();
    const { services } = renderWithServices(<ThemeToggle />, { desktop });
    await userEvent.click(screen.getByRole('button', { name: 'Appearance: System' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(services.preferences.loadAppPreferences().theme).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'Appearance: Light' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(desktop.theme).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Appearance: Dark' }));
    expect(services.preferences.loadAppPreferences().theme).toBe('system');
    expect(screen.getByRole('button', { name: 'Appearance: System' })).toBeTruthy();
  });
});
