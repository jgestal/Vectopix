// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropZone } from './DropZone';
import { renderWithServices } from '../../test/renderWithServices';
import { SAMPLE_DRAG_TYPE } from '../../domain/samples';

function renderDropZone() {
  const props = { onSampleSelected: vi.fn(), onFileSelected: vi.fn(), onDrop: vi.fn() };
  return { ...renderWithServices(<DropZone {...props} />), props };
}

describe('DropZone', () => {
  it('shows every sample, drawn by the sample renderer', () => {
    const { services } = renderDropZone();
    expect(services.samples.render).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', { name: /Heraldic crest/ }).querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,sample-badge-crest'
    );
  });

  it('opens a sample when clicked, and marks it as a sample when dragged', async () => {
    const { props } = renderDropZone();
    const sample = screen.getByRole('button', { name: /8-bit pixel art heart/ });
    await userEvent.click(sample);
    expect(props.onSampleSelected).toHaveBeenCalledWith('pixel-heart');

    const setData = vi.fn();
    fireEvent.dragStart(sample, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith(SAMPLE_DRAG_TYPE, 'pixel-heart');
  });

  it('hands a picked file and anything dropped to the app', async () => {
    const { props, container } = renderDropZone();
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    expect(props.onFileSelected).toHaveBeenCalledWith(file);

    const dataTransfer = { files: [file], getData: () => '' };
    fireEvent.drop(container.querySelector('.dropzone')!, { dataTransfer });
    expect(props.onDrop).toHaveBeenCalledTimes(1);
  });

  it('accepts the extra formats the image source decodes', () => {
    const { container } = renderDropZone();
    expect(container.querySelector('input[type="file"]')?.getAttribute('accept')).toBe('image/*,.tga');
  });

  it('shows the running version, linking to its release notes', () => {
    renderDropZone();
    const link = screen.getByRole('link', { name: `Version ${__APP_VERSION__}` });
    expect(link.getAttribute('href')).toBe(`https://github.com/jgestal/Vectopix/releases/tag/v${__APP_VERSION__}`);
  });
});
