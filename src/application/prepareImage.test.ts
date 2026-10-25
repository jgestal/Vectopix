import { describe, expect, it } from 'vitest';
import { prepareImage } from './prepareImage';
import type { ImageDecoder } from './ports';
import { MAX_TRACE_PIXELS } from '../domain/images';

/** Decodes to an image of the size the use case asks for, from a fixed natural size. */
function decoderFor(naturalWidth: number, naturalHeight: number, alpha = 255): ImageDecoder & { asked?: { width: number; height: number } } {
  const decoder: ImageDecoder & { asked?: { width: number; height: number } } = {
    async decode(_url, fit) {
      const size = fit(naturalWidth, naturalHeight);
      decoder.asked = size;
      return { pixels: { ...size, data: new Uint8ClampedArray(size.width * size.height * 4).fill(alpha) }, naturalWidth, naturalHeight };
    },
  };
  return decoder;
}

describe('prepareImage', () => {
  it('keeps an ordinary image at its own size, with nothing to report', async () => {
    const prepared = await prepareImage('data:', decoderFor(400, 300));
    expect(prepared).toMatchObject({ width: 400, height: 300, isCutOut: false, notices: [] });
  });

  it('downscales a huge image to the trace limit and says so', async () => {
    const decoder = decoderFor(4000, 3000);
    const prepared = await prepareImage('data:', decoder);
    expect(prepared.width * prepared.height).toBeLessThanOrEqual(MAX_TRACE_PIXELS * 1.001);
    expect(prepared.width / prepared.height).toBeCloseTo(4 / 3, 2);
    expect(prepared.notices).toEqual([{ code: 'toast.imageDownscaled', params: { from: '4000×3000', to: `${prepared.width}×${prepared.height}` } }]);
  });

  it('warns about a very small image', async () => {
    const prepared = await prepareImage('data:', decoderFor(64, 64));
    expect(prepared.notices).toEqual([{ code: 'toast.smallImage', params: { size: '64×64' } }]);
  });

  it('recognises a cut-out (a transparent border)', async () => {
    expect((await prepareImage('data:', decoderFor(200, 200, 0))).isCutOut).toBe(true);
  });

  it('lets decoding errors through to the caller', async () => {
    const failing: ImageDecoder = { decode: async () => Promise.reject(new Error('boom')) };
    await expect(prepareImage('data:', failing)).rejects.toThrow('boom');
  });
});
