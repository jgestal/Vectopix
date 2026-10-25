import type { ReleaseSource, SettingsStore } from '../application/ports';

/** SettingsStore in memory; `values` can be inspected or pre-filled. */
export class MemoryStore implements SettingsStore {
  readonly values = new Map<string, unknown>();
  read(key: string): unknown {
    return this.values.get(key);
  }
  write(key: string, value: unknown): void {
    this.values.set(key, structuredClone(value));
  }
}

/** Storage (the DOM interface) in memory. */
export function memoryStorage(): Storage {
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

/** A ReleaseSource answering with a fixed release (or failing), counting calls. */
export class FakeReleaseSource implements ReleaseSource {
  calls = 0;
  release: { version: string; url: string } | null | Error;
  constructor(release: { version: string; url: string } | null | Error) {
    this.release = release;
  }
  async latest() {
    this.calls++;
    if (this.release instanceof Error) throw this.release;
    return this.release;
  }
}

export const releasePage = (version: string) => `https://github.com/jgestal/Vectopix/releases/tag/v${version}`;

/** The SvgDom the app uses, on the test environment's DOMParser (happy-dom). */
export { createSvgDom as testSvgDom } from '../infrastructure/browser/svgDom';
