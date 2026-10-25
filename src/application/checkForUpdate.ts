import { compareVersions } from '../domain/versions';
import { mergeKnown } from '../domain/settings';
import { readAppPreferences } from './preferences';
import type { Clock, ReleaseSource, SettingsStore } from './ports';

/**
 * New-version notice. The desktop apps are not signed, so they can't update
 * themselves; instead they ask for the latest release at most once a day and
 * point to its page. Checking is best-effort: failures are silent.
 */

export interface AvailableUpdate {
  version: string;
  url: string;
}

export type UpdateCheck = { status: 'available'; update: AvailableUpdate } | { status: 'upToDate'; version: string } | { status: 'failed' };

export interface UpdateChecker {
  /**
   * The release to tell the user about: newer than the running one and not
   * dismissed. Asks at most once a day, and never when switched off.
   */
  find(): Promise<AvailableUpdate | null>;
  /** Asked for by the person: ask now, and say what was found either way. */
  checkNow(): Promise<UpdateCheck>;
  /** Don't mention this version again (a newer one will be). */
  dismiss(version: string): void;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STATE_KEY = 'update';
const STATE_DEFAULTS = { checkedAt: 0, latest: '', url: '', dismissed: '' };
type UpdateState = typeof STATE_DEFAULTS;

/** Only release pages on GitHub are ever linked. */
const isReleasePage = (url: string) => /^https:\/\/github\.com\//.test(url);

export function createUpdateChecker(deps: {
  currentVersion: string;
  releases: ReleaseSource;
  store: SettingsStore;
  clock: Clock;
}): UpdateChecker {
  const { currentVersion, releases, store, clock } = deps;
  const readState = (): UpdateState => mergeKnown(STATE_DEFAULTS, store.read(STATE_KEY));

  async function refresh(state: UpdateState): Promise<UpdateState> {
    const now = clock();
    if (now - state.checkedAt < CHECK_INTERVAL_MS) return state;
    try {
      const release = await releases.latest();
      const next = { ...state, checkedAt: now, ...(release ? { latest: release.version, url: release.url } : {}) };
      store.write(STATE_KEY, next);
      return next;
    } catch {
      return state; // offline or blocked: try again next launch
    }
  }

  const isNewer = (version: string, url: string) => version !== '' && compareVersions(version, currentVersion) > 0 && isReleasePage(url);

  return {
    async find() {
      if (!readAppPreferences(store).checkForUpdates) return null;
      const { latest, url, dismissed } = await refresh(readState());
      return latest !== dismissed && isNewer(latest, url) ? { version: latest, url } : null;
    },
    async checkNow() {
      try {
        const release = await releases.latest();
        store.write(STATE_KEY, { ...readState(), checkedAt: clock(), ...(release ? { latest: release.version, url: release.url } : {}) });
        return release && isNewer(release.version, release.url) ? { status: 'available', update: release } : { status: 'upToDate', version: currentVersion };
      } catch {
        return { status: 'failed' };
      }
    },
    dismiss(version) {
      store.write(STATE_KEY, { ...readState(), dismissed: version });
    },
  };
}
