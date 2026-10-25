// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { renderWithServices } from '../test/renderWithServices';
import { FakeDesktopShell } from '../test/fakes';
import type { AppCommand } from '../domain/commands';

/** The interface as it runs in the desktop app: driven from the native menu bar. */

function renderDesktop() {
  const desktop = new FakeDesktopShell('mac');
  const view = renderWithServices(<App />, { desktop });
  const click = async (command: AppCommand) => {
    await act(async () => desktop.click(command));
  };
  return { ...view, desktop, click };
}

async function withSample(click: (c: AppCommand) => Promise<void>, services: ReturnType<typeof renderDesktop>['services']) {
  await click('sample.badge-crest');
  await waitFor(() => expect(services.vectorization.vectorize).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector('.status-metrics')?.textContent).toContain('Paths'));
}

describe('App in the desktop app', () => {
  it('sends a translated menu bar that follows the state', async () => {
    const { desktop, click, services } = renderDesktop();
    await waitFor(() => expect(desktop.menus.length).toBeGreaterThan(0));
    expect(desktop.lastMenu.map((s) => s.label)).toEqual(['Vectopix', 'File', 'Edit', 'View', 'Image', 'Window', 'Help']);
    expect(desktop.item('saveSvg')?.enabled).toBe(false);

    await withSample(click, services);
    await waitFor(() => expect(desktop.item('saveSvg')?.enabled).toBe(true));
    expect(desktop.item('preset.flat-art')?.checked).toBe(true);
    expect(desktop.item('view.split')?.checked).toBe(true);
  });

  it('re-sends the menu only when something changed', async () => {
    const { desktop } = renderDesktop();
    await waitFor(() => expect(desktop.menus.length).toBeGreaterThan(0));
    const sent = desktop.menus.length;
    await userEvent.hover(document.body);
    expect(desktop.menus.length).toBe(sent);
  });

  it('switches the view from the menu, and the menu checks it', async () => {
    const { desktop, click, services } = renderDesktop();
    await withSample(click, services);
    await click('view.sideBySide');
    expect(await screen.findByText(/Vector \(\d+ paths\)/)).toBeTruthy();
    await waitFor(() => expect(desktop.item('view.sideBySide')?.checked).toBe(true));
  });

  it('opens About and Settings from the menu', async () => {
    const { click } = renderDesktop();
    await click('showAbout');
    expect(await screen.findByText('Juan Gestal')).toBeTruthy();
    await click('showPreferences');
    expect(await screen.findByRole('checkbox', { name: /Check for updates/ })).toBeTruthy();
  });

  it('saves as SVG, named after the image', async () => {
    const { click, services } = renderDesktop();
    await withSample(click, services);
    await click('saveSvg');
    expect(services.files.save).toHaveBeenCalledWith(expect.stringContaining('<svg'), 'badge-crest.svg', 'image/svg+xml');
  });

  it('asks before closing with unsaved hand edits, and stops asking once saved', async () => {
    const { desktop, click, services } = renderDesktop();
    await withSample(click, services);
    expect(desktop.closeConfirmation).toBeNull();

    await userEvent.click(await screen.findByRole('button', { name: '#ff0000' }));
    await userEvent.click(screen.getByRole('button', { name: /Make transparent/ }));
    await waitFor(() => expect(desktop.closeConfirmation?.message).toContain('badge-crest.png'));
    expect(desktop.closeConfirmation?.discard).toBe('Close Without Saving');

    await click('saveSvg');
    await waitFor(() => expect(desktop.closeConfirmation).toBeNull());
  });

  it('opens files the system hands over, and remembers files it opened', async () => {
    const { desktop, services } = renderDesktop();
    await act(async () => desktop.open(new File(['x'], 'from-dock.png', { type: 'image/png' })));
    await waitFor(() => expect(services.vectorization.vectorize).toHaveBeenCalled());
    expect(screen.getByText('from-dock.png')).toBeTruthy();
    expect(desktop.remembered).toEqual(['from-dock.png']);
  });

  it('translates the menu when the language changes', async () => {
    const { desktop } = renderDesktop();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'es');
    await waitFor(() => expect(desktop.lastMenu.map((s) => s.label)).toContain('Archivo'));
    expect(desktop.item('openImage')?.label).toBe('Abrir imagen…');
  });

  it('checks for updates when asked, and says so when up to date', async () => {
    const updates = { find: async () => null, dismiss: () => {}, checkNow: async () => ({ status: 'upToDate', version: '9.0.0' }) as const };
    const desktop = new FakeDesktopShell('mac');
    renderWithServices(<App />, { desktop, updates });
    await act(() => desktop.click('checkUpdates'));
    expect(await screen.findByText('Vectopix 9.0.0 is the latest version')).toBeTruthy();
  });
});
