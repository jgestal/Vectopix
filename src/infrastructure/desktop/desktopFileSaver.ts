import type { FileSaver } from '../../application/ports';
import { browserFileSaver } from '../browser/fileSaver';
import type { DesktopBridge } from './protocol';

const bytes = async (content: string | Uint8Array | Blob): Promise<Uint8Array> => {
  if (content instanceof Uint8Array) return content;
  if (content instanceof Blob) return new Uint8Array(await content.arrayBuffer());
  return new TextEncoder().encode(content);
};

/** The extension of a file name, for the save dialog's file type filter. */
const extensionOf = (fileName: string) => fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? '';

/**
 * Saving as a desktop app does: the native "Save as" dialog, starting in the
 * last folder used, and dragging out real files. The clipboard is the
 * browser's, which works the same here.
 */
export function createDesktopFileSaver(bridge: DesktopBridge): FileSaver {
  return {
    async save(content, fileName) {
      const ext = extensionOf(fileName);
      const saved = await bridge.saveFile({ fileName, data: await bytes(content), filterName: ext.toUpperCase(), extensions: ext ? [ext] : [] });
      return saved ? { status: 'saved', fileName: saved } : { status: 'cancelled' };
    },
    copyText: browserFileSaver.copyText,
    copyImage: browserFileSaver.copyImage,
    dragOut(event, fileName, content) {
      // The system drag replaces the page's: it carries a real file
      event.preventDefault();
      bridge.startDrag({ fileName, data: new TextEncoder().encode(content) });
    },
  };
}
