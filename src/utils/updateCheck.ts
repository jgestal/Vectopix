import { loadSetting, saveSetting } from './storage';

/**
 * New-version notice for the desktop app. The apps are not signed, so they
 * can't update themselves; instead they ask GitHub, at most once a day, for
 * the latest release and point to its page. Only the version number is
 * requested: no image or usage data is sent. The web version is always the
 * latest, so it never checks.
 */

const LATEST_RELEASE_API = 'https://api.github.com/repos/jgestal/Vectopix/releases/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AvailableUpdate {
  version: string;
  url: string;
}

const STATE_DEFAULTS = { checkedAt: 0, latest: '', url: '', dismissed: '' };

/** The desktop app serves the interface from its private app:// origin. */
export function isDesktopApp(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'app:';
}

/** Compare dotted versions numerically (1.10.0 > 1.9.0); a leading "v" is ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * The release to tell the user about, if any: newer than `current` and not
 * dismissed. Network failures resolve to null; checking is best-effort.
 */
export async function findUpdate(current: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<AvailableUpdate | null> {
  const state = loadSetting('update', STATE_DEFAULTS);
  let { latest, url } = state;
  if (now - state.checkedAt >= CHECK_INTERVAL_MS) {
    try {
      const res = await fetchImpl(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) {
        const release = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
        if (typeof release.tag_name === 'string' && typeof release.html_url === 'string') {
          latest = release.tag_name.replace(/^v/, '');
          url = release.html_url;
        }
      }
      saveSetting('update', { ...state, checkedAt: now, latest, url });
    } catch {
      // Offline or blocked: try again next launch
    }
  }
  if (!latest || !/^https:\/\/github\.com\//.test(url)) return null;
  if (compareVersions(latest, current) <= 0 || latest === state.dismissed) return null;
  return { version: latest, url };
}

/** Don't mention this version again (a newer one will be). */
export function dismissUpdate(version: string): void {
  saveSetting('update', { ...loadSetting('update', STATE_DEFAULTS), dismissed: version });
}
