import type { FileSaver } from '../../application/ports';

/** Downloads through a temporary link; text to the system clipboard. */
export const browserFileSaver: FileSaver = {
  save(content, fileName, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  copyText: (text) => navigator.clipboard.writeText(text),
};
