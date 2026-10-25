import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compareVersions, dismissUpdate, findUpdate } from './updateCheck';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

const release = (tag: string, url = `https://github.com/jgestal/Vectopix/releases/tag/${tag}`) =>
  vi.fn(async () => new Response(JSON.stringify({ tag_name: tag, html_url: url }), { status: 200 })) as unknown as typeof fetch;
const DAY = 24 * 60 * 60 * 1000;

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('v1.4.0', '1.4.0')).toBe(0);
    expect(compareVersions('1.4', '1.4.1')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });
});

describe('findUpdate', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('reports a newer release with its page', async () => {
    expect(await findUpdate('1.4.0', release('v1.5.0'))).toEqual({
      version: '1.5.0',
      url: 'https://github.com/jgestal/Vectopix/releases/tag/v1.5.0',
    });
  });

  it('says nothing when up to date', async () => {
    expect(await findUpdate('1.4.0', release('v1.4.0'))).toBeNull();
    expect(await findUpdate('1.5.0', release('v1.4.0'), Date.now() + 2 * DAY)).toBeNull();
  });

  it('asks GitHub at most once a day, reusing the last answer meanwhile', async () => {
    const fetchImpl = release('v1.5.0');
    const now = 1_000_000_000_000;
    await findUpdate('1.4.0', fetchImpl, now);
    expect(await findUpdate('1.4.0', fetchImpl, now + DAY / 2)).toMatchObject({ version: '1.5.0' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await findUpdate('1.4.0', fetchImpl, now + DAY);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('is silent when offline', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await findUpdate('1.4.0', offline)).toBeNull();
  });

  it('does not repeat a dismissed version, but tells about the next one', async () => {
    const now = 1_000_000_000_000;
    await findUpdate('1.4.0', release('v1.5.0'), now);
    dismissUpdate('1.5.0');
    expect(await findUpdate('1.4.0', release('v1.5.0'), now + 1)).toBeNull();
    expect(await findUpdate('1.4.0', release('v1.6.0'), now + DAY)).toMatchObject({ version: '1.6.0' });
  });

  it('only links to GitHub', async () => {
    expect(await findUpdate('1.4.0', release('v1.5.0', 'https://example.com/x'))).toBeNull();
  });
});
