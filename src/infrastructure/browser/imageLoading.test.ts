// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchImage, readDrop, readImageFile } from './imageLoading';
import { AppError } from '../../application/errors';
import { SAMPLE_DRAG_TYPE } from '../../domain/samples';

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

/** An <img> that decodes (or fails to), as a real browser would for the given data. */
function stubImage(decodes: boolean) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = decodes ? 10 : 0;
    naturalHeight = decodes ? 10 : 0;
    set src(_url: string) {
      queueMicrotask(() => (decodes ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

const codeOf = (promise: Promise<unknown>) => promise.then(() => 'resolved', (err: unknown) => (err instanceof AppError ? err.code : String(err)));

describe('readImageFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads an image the browser can decode as a data URL', async () => {
    stubImage(true);
    expect(await readImageFile(new File(['png'], 'logo.png', { type: 'image/png' }))).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects a file over the size limit without reading it', async () => {
    const huge = { size: 51 * 1024 * 1024, name: 'huge.png', type: 'image/png' } as File;
    expect(await codeOf(readImageFile(huge))).toBe('error.fileTooLarge');
  });

  it('names the format it could not decode by any means', async () => {
    stubImage(false);
    const err = await readImageFile(new File(['not an image'], 'photo.heic', { type: 'image/heic' })).catch((e: AppError) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).params).toEqual({ format: 'HEIC' });
  });
});

describe('fetchImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches an image dragged from a page, named after its URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['x'], { type: 'image/png' }))));
    const file = await fetchImage('https://example.com/img/my%20logo.png?v=2');
    expect(file.name).toBe('my logo.png');
    expect(file.type).toBe('image/png');
  });

  it('turns any failure into one explanation (most sites forbid it)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    expect(await codeOf(fetchImage('https://example.com/a.png'))).toBe('error.remoteImage');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('CORS'))));
    expect(await codeOf(fetchImage('https://example.com/a.png'))).toBe('error.remoteImage');
  });
});
