// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutDialog } from './AboutDialog';
import { renderWithServices } from '../../test/renderWithServices';

describe('AboutDialog', () => {
  it('credits the author with his website and email', () => {
    renderWithServices(<AboutDialog onClose={vi.fn()} />);
    expect(screen.getByText('Juan Gestal')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'gestal.es' }).getAttribute('href')).toBe('https://gestal.es');
    expect(screen.getByRole('link', { name: /juan@gestal\.es/ }).getAttribute('href')).toBe('mailto:juan@gestal.es');
  });

  it('shows the version, linking to its notes, the licence and what it is built with', () => {
    renderWithServices(<AboutDialog onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: `Version ${__APP_VERSION__}` }).getAttribute('href')).toContain(`/releases/tag/v${__APP_VERSION__}`);
    expect(screen.getByRole('link', { name: /MIT licence/ })).toBeTruthy();
    for (const lib of ['vecline', 'ImageTracerJS', 'React', 'Electron']) expect(screen.getByRole('link', { name: lib })).toBeTruthy();
  });

  it('closes', async () => {
    const onClose = vi.fn();
    renderWithServices(<AboutDialog onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
