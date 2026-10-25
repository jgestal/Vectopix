// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportModal } from './ExportModal';
import { renderWithServices, tracedResult } from '../../test/renderWithServices';
import { AppError } from '../../application/errors';
import type { AppServices } from '../services/context';

function renderExport(overrides: Partial<AppServices> = {}) {
  const onShowToast = vi.fn();
  const view = renderWithServices(
    <ExportModal onClose={vi.fn()} result={tracedResult()} baseFileName="logo.final.png" imageDimensions={{ width: 120, height: 80 }} onShowToast={onShowToast} />,
    overrides
  );
  return { ...view, onShowToast };
}

const download = () => userEvent.click(screen.getByRole('button', { name: /^Download/ }));

describe('ExportModal', () => {
  it('downloads the SVG named after the image', async () => {
    const { services, onShowToast } = renderExport();
    await download();
    expect(services.files.save).toHaveBeenCalledWith(tracedResult().svg, 'logo.final.svg', 'image/svg+xml');
    expect(onShowToast).toHaveBeenCalledWith('logo.final.svg downloaded', 'success');
  });

  it('renders a PNG at the chosen scale and background', async () => {
    const { services } = renderExport();
    await userEvent.click(screen.getByRole('tab', { name: 'High-res PNG' }));
    await userEvent.click(screen.getByRole('button', { name: '4×' }));
    await userEvent.click(screen.getByRole('button', { name: 'White' }));
    await download();
    expect(services.exporter.png).toHaveBeenCalledWith(tracedResult().svg, { width: 120, height: 80 }, 4, '#ffffff');
    expect(services.files.save).toHaveBeenCalledWith(expect.any(Blob), 'logo.final_@4x.png', 'image/png');
  });

  it('reports a failed PNG with its message, and downloads nothing', async () => {
    const { services, onShowToast } = renderExport({
      exporter: { ...(await import('../../test/renderWithServices')).fakeServices().services.exporter, png: vi.fn(async () => Promise.reject(new AppError('export.pngError'))) },
    });
    await userEvent.click(screen.getByRole('tab', { name: 'High-res PNG' }));
    await download();
    expect(onShowToast).toHaveBeenCalledWith('Could not generate the PNG', 'warning');
    expect(services.files.save).not.toHaveBeenCalled();
  });

  it('builds a CAD format when its tab opens, then downloads it', async () => {
    const { services } = renderExport();
    await userEvent.click(screen.getByRole('tab', { name: 'DXF (laser / CNC)' }));
    await waitFor(() => expect(screen.getByText('DXF SECTION')).toBeTruthy());
    expect(services.exporter.cad).toHaveBeenCalledWith(tracedResult().svg, 'dxf', false);
    await download();
    expect(services.files.save).toHaveBeenCalledWith('DXF SECTION', 'logo.final.dxf', 'application/dxf');
  });

  it('copies what the tab shows', async () => {
    const { services } = renderExport();
    await userEvent.click(screen.getByRole('button', { name: /Copy code/ }));
    expect(services.files.copyText).toHaveBeenCalledWith(tracedResult().svg);
  });

  it('remembers the last tab and choices for next time', async () => {
    const { store, unmount } = renderExport();
    await userEvent.click(screen.getByRole('tab', { name: 'Components' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vue' }));
    unmount();
    expect(store.read('export')).toMatchObject({ tab: 'components', framework: 'vue' });
  });
});
