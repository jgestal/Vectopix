import { describe, expect, it, vi } from 'vitest';
import { GitHubReleaseSource } from './releaseSource';

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('GitHubReleaseSource', () => {
  it('reads the version (without the v) and page of the latest release', async () => {
    const fetchImpl = respond(200, { tag_name: 'v1.5.0', html_url: 'https://github.com/jgestal/Vectopix/releases/tag/v1.5.0', body: '…' });
    expect(await new GitHubReleaseSource(fetchImpl).latest()).toEqual({
      version: '1.5.0',
      url: 'https://github.com/jgestal/Vectopix/releases/tag/v1.5.0',
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/jgestal/Vectopix/releases/latest', expect.anything());
  });

  it('answers null when there is no release or the answer is malformed', async () => {
    expect(await new GitHubReleaseSource(respond(404, { message: 'Not Found' })).latest()).toBeNull();
    expect(await new GitHubReleaseSource(respond(200, { tag_name: 5 })).latest()).toBeNull();
  });

  it('lets network errors through, for the caller to decide', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(new GitHubReleaseSource(offline).latest()).rejects.toThrow('Failed to fetch');
  });
});
