import type { ReleaseSource } from '../../application/ports';

const LATEST_RELEASE_API = 'https://api.github.com/repos/jgestal/Vectopix/releases/latest';

/**
 * Latest release from the GitHub API. Only the version number and page are
 * requested: no image or usage data is sent. Throws on network errors.
 */
export class GitHubReleaseSource implements ReleaseSource {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(fetchImpl: typeof fetch = (...args) => fetch(...args), endpoint = LATEST_RELEASE_API) {
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
  }

  async latest(): Promise<{ version: string; url: string } | null> {
    const res = await this.fetchImpl(this.endpoint, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const release = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') return null;
    return { version: release.tag_name.replace(/^v/, ''), url: release.html_url };
  }
}
