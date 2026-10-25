// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateNotice } from './UpdateNotice';
import { renderWithServices } from '../../test/renderWithServices';

const release = { version: '9.9.9', url: 'https://github.com/jgestal/Vectopix/releases/tag/v9.9.9' };

describe('UpdateNotice', () => {
  it('announces a newer release with a link to download it', async () => {
    renderWithServices(<UpdateNotice />, { updates: { find: vi.fn(async () => release), dismiss: vi.fn() } });
    expect(await screen.findByText('Vectopix 9.9.9 is available')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Download/ }).getAttribute('href')).toBe(release.url);
  });

  it('goes away when dismissed, remembering the version', async () => {
    const dismiss = vi.fn();
    renderWithServices(<UpdateNotice />, { updates: { find: vi.fn(async () => release), dismiss } });
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(dismiss).toHaveBeenCalledWith('9.9.9');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows nothing when up to date, or where there is no checker (the web)', async () => {
    const find = vi.fn(async () => null);
    renderWithServices(<UpdateNotice />, { updates: { find, dismiss: vi.fn() } });
    await waitFor(() => expect(find).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();

    renderWithServices(<UpdateNotice />, { updates: null });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
