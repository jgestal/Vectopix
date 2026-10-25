import { describe, expect, it } from 'vitest';
import { createUpdateChecker } from './checkForUpdate';
import { FakeReleaseSource, MemoryStore, releasePage } from '../test/fakes';

const DAY = 24 * 60 * 60 * 1000;

function setup(release: ConstructorParameters<typeof FakeReleaseSource>[0], currentVersion = '1.4.0') {
  const releases = new FakeReleaseSource(release);
  const store = new MemoryStore();
  let now = 1_000_000_000_000;
  const checker = () => createUpdateChecker({ currentVersion, releases, store, clock: () => now });
  return { releases, store, checker, advance: (ms: number) => (now += ms) };
}

describe('update checker', () => {
  it('reports a newer release with its page', async () => {
    const { checker } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
    expect(await checker().find()).toEqual({ version: '1.5.0', url: releasePage('1.5.0') });
  });

  it('says nothing when up to date or ahead', async () => {
    expect(await setup({ version: '1.4.0', url: releasePage('1.4.0') }).checker().find()).toBeNull();
    expect(await setup({ version: '1.4.0', url: releasePage('1.4.0') }, '1.5.0').checker().find()).toBeNull();
  });

  it('asks for the latest release at most once a day, reusing the answer meanwhile', async () => {
    const { releases, checker, advance } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
    await checker().find();
    advance(DAY / 2);
    expect(await checker().find()).toMatchObject({ version: '1.5.0' });
    expect(releases.calls).toBe(1);
    advance(DAY / 2);
    await checker().find();
    expect(releases.calls).toBe(2);
  });

  it('is silent when the check fails, and tries again next time', async () => {
    const { releases, checker } = setup(new TypeError('Failed to fetch'));
    expect(await checker().find()).toBeNull();
    releases.release = { version: '1.5.0', url: releasePage('1.5.0') };
    expect(await checker().find()).toMatchObject({ version: '1.5.0' });
  });

  it('does not repeat a dismissed version, but tells about the next one', async () => {
    const { releases, checker, advance } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
    await checker().find();
    checker().dismiss('1.5.0');
    expect(await checker().find()).toBeNull();
    releases.release = { version: '1.6.0', url: releasePage('1.6.0') };
    advance(DAY);
    expect(await checker().find()).toMatchObject({ version: '1.6.0' });
  });

  it('only links to release pages on GitHub', async () => {
    expect(await setup({ version: '1.5.0', url: 'https://example.com/x' }).checker().find()).toBeNull();
  });

  describe('checkNow (Help → Check for updates)', () => {
    it('asks right away, even if it asked a moment ago, and reports a newer release', async () => {
      const { releases, checker } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
      await checker().find();
      expect(await checker().checkNow()).toEqual({ status: 'available', update: { version: '1.5.0', url: releasePage('1.5.0') } });
      expect(releases.calls).toBe(2);
    });

    it('reports a dismissed release too: the person asked', async () => {
      const { checker } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
      checker().dismiss('1.5.0');
      expect((await checker().checkNow()).status).toBe('available');
    });

    it('says when this is the latest version', async () => {
      expect(await setup({ version: '1.4.0', url: releasePage('1.4.0') }).checker().checkNow()).toEqual({ status: 'upToDate', version: '1.4.0' });
    });

    it('says when the check could not be made', async () => {
      expect(await setup(new TypeError('Failed to fetch')).checker().checkNow()).toEqual({ status: 'failed' });
    });
  });

  it('can be switched off: no automatic checks, while checkNow still works', async () => {
    const { releases, checker, store } = setup({ version: '1.5.0', url: releasePage('1.5.0') });
    store.write('preferences', { checkForUpdates: false });
    expect(await checker().find()).toBeNull();
    expect(releases.calls).toBe(0);
    expect((await checker().checkNow()).status).toBe('available');
  });
});

