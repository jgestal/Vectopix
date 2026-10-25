import type { FileSaver } from '../../application/ports';

/** Text as a data URL, for drags (a blob: URL may be gone by the time the drop lands). */
const dataUrl = (content: string, mimeType: string) => `data:${mimeType};base64,${btoa(unescape(encodeURIComponent(content)))}`;

/** Downloads through a temporary link; the system clipboard; drags as downloads. */
export const browserFileSaver: FileSaver = {
  async save(content, fileName, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { status: 'downloaded', fileName };
  },
  copyText: (text) => navigator.clipboard.writeText(text),
  copyImage: (png) => navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]),
  dragOut(event, fileName, content, mimeType) {
    if (!event.dataTransfer) return;
    // Chromium turns a DownloadURL drag into a file where it is dropped (desktop, folders)
    event.dataTransfer.setData('DownloadURL', `${mimeType}:${fileName}:${dataUrl(content, mimeType)}`);
    // Apps that take markup (code editors, some design tools) get the SVG itself
    event.dataTransfer.setData(mimeType, content);
    event.dataTransfer.setData('text/plain', content);
    event.dataTransfer.effectAllowed = 'copy';
  },
};
