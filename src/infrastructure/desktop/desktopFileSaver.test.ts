import { describe, expect, it, vi } from 'vitest';
import { createDesktopFileSaver } from './desktopFileSaver';
import type { DesktopBridge } from './protocol';

function bridge(written: boolean) {
  return { saveFile: vi.fn(async () => written), startDrag: vi.fn() } as unknown as DesktopBridge & {
    saveFile: ReturnType<typeof vi.fn>;
    startDrag: ReturnType<typeof vi.fn>;
  };
}

describe('desktop file saver', () => {
  it('saves through the native dialog, filtered by the file type', async () => {
    const shell = bridge(true);
    expect(await createDesktopFileSaver(shell).save('<svg/>', 'logo.SVG', 'image/svg+xml')).toBe('saved');
    expect(shell.saveFile).toHaveBeenCalledWith({ fileName: 'logo.SVG', data: new TextEncoder().encode('<svg/>'), filterName: 'SVG', extensions: ['svg'] });
  });

  it('sends binary content as bytes', async () => {
    const shell = bridge(true);
    await createDesktopFileSaver(shell).save(new Blob([new Uint8Array([1, 2, 3])]), 'logo@2x.png', 'image/png');
    expect(shell.saveFile.mock.calls[0][0].data).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('reports a cancelled dialog', async () => {
    expect(await createDesktopFileSaver(bridge(false)).save('x', 'notes', 'text/plain')).toBe('cancelled');
  });

  it('drags out a real file instead of the page’s drag', () => {
    const shell = bridge(true);
    const event = { preventDefault: vi.fn() } as unknown as DragEvent;
    createDesktopFileSaver(shell).dragOut(event, 'logo.svg', '<svg/>', 'image/svg+xml');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(shell.startDrag).toHaveBeenCalledWith({ fileName: 'logo.svg', data: new TextEncoder().encode('<svg/>') });
  });
});
