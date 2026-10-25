// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { renderWithServices, tracedResult } from '../test/renderWithServices';
import { AppError, VectorizationCanceledError } from '../application/errors';
import type { VectorOptions } from '../domain/types';
import type { AppServices } from './services/context';

/**
 * The whole interface on fake services: the flows a person goes through,
 * without a browser engine, worker or file system.
 */

const lastOptions = (services: AppServices) => (services.vectorization.vectorize as ReturnType<typeof vi.fn>).mock.lastCall?.[2] as VectorOptions;
const metrics = () => within(document.querySelector('.status-metrics') as HTMLElement);

async function openSample(name: RegExp, overrides: Partial<AppServices> = {}) {
  const view = renderWithServices(<App />, overrides);
  await userEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(view.services.vectorization.vectorize).toHaveBeenCalled());
  return view;
}

describe('App', () => {
  it('traces a sample with its own preset and shows the result and its fidelity', async () => {
    const { services } = await openSample(/8-bit pixel art heart/);
    expect(lastOptions(services)).toMatchObject({ preset: 'pixel-art', pixelGrid: true });
    await waitFor(() => expect(metrics().getByText('97.0%')).toBeTruthy());
    expect(metrics().getByText('Paths').nextSibling?.textContent).toBe('2');
    expect(services.vectorization.measureFidelity).toHaveBeenCalledWith(expect.anything(), tracedResult().svg);
  });

  it('re-traces when a setting changes, and undo brings back the earlier result with its settings', async () => {
    const { services } = await openSample(/Heraldic crest/);
    const vectorize = services.vectorization.vectorize as ReturnType<typeof vi.fn>;
    vectorize.mockResolvedValueOnce(tracedResult({ shapes: 5 }));

    await userEvent.click(screen.getByText('Advanced settings'));
    await userEvent.click(screen.getByRole('checkbox', { name: /Transparent background/ }));
    await waitFor(() => expect(vectorize).toHaveBeenCalledTimes(2));
    expect(lastOptions(services).transparentBackground).toBe(true);
    await waitFor(() => expect(metrics().getByText('Paths').nextSibling?.textContent).toBe('5'));

    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(metrics().getByText('Paths').nextSibling?.textContent).toBe('2');
    expect((screen.getByRole('checkbox', { name: /Transparent background/ }) as HTMLInputElement).checked).toBe(false);
    // The restored settings came with their result: no new trace
    await new Promise((r) => setTimeout(r, 500));
    expect(vectorize).toHaveBeenCalledTimes(2);
  });

  it('remembers settings the user chose, for their next image', async () => {
    const { store } = await openSample(/Heraldic crest/);
    await userEvent.click(screen.getByText('Advanced settings'));
    await userEvent.click(screen.getByRole('checkbox', { name: /Transparent background/ }));
    expect(store.read('options')).toMatchObject({ transparentBackground: true });
  });

  it('switches transparency on for an image that is already a cut-out', async () => {
    const view = renderWithServices(<App />);
    vi.mocked(view.services.decoder.decode).mockImplementationOnce(async (_url, fit) => {
      const size = fit(120, 80);
      return { pixels: { ...size, data: new Uint8ClampedArray(size.width * size.height * 4) }, naturalWidth: 120, naturalHeight: 80 };
    });
    await userEvent.upload(document.querySelector('.dropzone input[type="file"]') as HTMLInputElement, new File(['x'], 'cut.png', { type: 'image/png' }));
    await waitFor(() => expect(view.services.vectorization.vectorize).toHaveBeenCalled());
    expect(lastOptions(view.services).transparentBackground).toBe(true);
  });

  it('reports an engine failure', async () => {
    const failing = vi.fn(async () => Promise.reject(new Error('out of memory')));
    await openSample(/Heraldic crest/, { vectorization: { vectorize: failing, measureFidelity: vi.fn() } });
    expect(await screen.findByText('Vectorization failed: out of memory')).toBeTruthy();
  });

  it('says nothing about a trace superseded by a newer one', async () => {
    const canceled = vi.fn(async () => Promise.reject(new VectorizationCanceledError()));
    await openSample(/Geometric tech logo/, { vectorization: { vectorize: canceled, measureFidelity: vi.fn() } });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Vectorization failed/)).toBeNull();
  });

  it('explains why a file could not be opened', async () => {
    const view = renderWithServices(<App />);
    vi.mocked(view.services.images.readFile).mockRejectedValueOnce(new AppError('error.unsupportedFormat', { format: 'HEIC' }));
    await userEvent.upload(document.querySelector('.dropzone input[type="file"]') as HTMLInputElement, new File(['x'], 'photo.heic', { type: 'image/heic' }));
    expect(await screen.findByText(/Unsupported format: HEIC/)).toBeTruthy();
    expect(view.services.vectorization.vectorize).not.toHaveBeenCalled();
  });

  it('recolours a palette colour, as an undoable step', async () => {
    await openSample(/Heraldic crest/);
    await waitFor(() => expect(screen.getByRole('button', { name: '#ff0000' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '#ff0000' }));
    await userEvent.click(screen.getByRole('button', { name: /Make transparent/ }));
    await waitFor(() => expect(metrics().getByText('Paths').nextSibling?.textContent).toBe('1'));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(metrics().getByText('Paths').nextSibling?.textContent).toBe('2');
  });

  it('copies the SVG with ⌘/Ctrl+C', async () => {
    const { services } = await openSample(/Heraldic crest/);
    await waitFor(() => expect(metrics().getByText('Paths')).toBeTruthy());
    await userEvent.keyboard('{Control>}c{/Control}');
    expect(services.files.copyText).toHaveBeenCalledWith(tracedResult().svg);
  });
});
