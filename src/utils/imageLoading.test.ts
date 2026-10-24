import { describe, expect, it } from 'vitest';
import { SAMPLE_DRAG_TYPE, readDrop } from './imageLoading';

/** Minimal stand-in for the parts of DataTransfer that readDrop uses. */
function transfer(data: Record<string, string>, files: File[] = []): DataTransfer {
  return { getData: (type: string) => data[type] ?? '', files } as unknown as DataTransfer;
}

describe('readDrop', () => {
  it('recognises a sample dragged from the gallery before anything else', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(readDrop(transfer({ [SAMPLE_DRAG_TYPE]: 'pixel-heart' }, [file]))).toEqual({ kind: 'sample', id: 'pixel-heart' });
  });

  it('returns system files', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(readDrop(transfer({}, [file]))).toEqual({ kind: 'file', file });
  });

  it('accepts image URLs dragged from a page and skips uri-list comments', () => {
    expect(readDrop(transfer({ 'text/uri-list': '# comment\nhttps://example.com/logo.png' }))).toEqual({
      kind: 'url',
      url: 'https://example.com/logo.png',
    });
  });

  it('ignores drops with nothing usable', () => {
    expect(readDrop(transfer({ 'text/uri-list': 'javascript:alert(1)' }))).toBeNull();
    expect(readDrop(transfer({}))).toBeNull();
  });
});
