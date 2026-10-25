// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { browserFileSaver } from './fileSaver';

function dragEvent() {
  const data = new Map<string, string>();
  const dataTransfer = { setData: (type: string, value: string) => data.set(type, value), effectAllowed: 'all' };
  return { event: { dataTransfer } as unknown as DragEvent, data, dataTransfer };
}

describe('browser file saver', () => {
  it('drags the SVG out as a file to drop and as markup', () => {
    const { event, data, dataTransfer } = dragEvent();
    browserFileSaver.dragOut(event, 'logo.svg', '<svg>é</svg>', 'image/svg+xml');
    const [mime, name, url] = data.get('DownloadURL')!.split(/:(?=[^:]*:data:)|:(?=data:)/);
    expect([mime, name]).toEqual(['image/svg+xml', 'logo.svg']);
    expect(decodeURIComponent(escape(atob(url.split(',')[1])))).toBe('<svg>é</svg>');
    expect(data.get('image/svg+xml')).toBe('<svg>é</svg>');
    expect(data.get('text/plain')).toBe('<svg>é</svg>');
    expect(dataTransfer.effectAllowed).toBe('copy');
  });

  it('reports a download', async () => {
    expect(await browserFileSaver.save('<svg/>', 'logo.svg', 'image/svg+xml')).toEqual({ status: 'downloaded', fileName: 'logo.svg' });
  });
});
