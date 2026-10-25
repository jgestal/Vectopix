import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const isMac = process.platform === 'darwin';

let profile: string;
let app: ElectronApplication;
let page: Page;

/** Launch on the given profile, so a second launch sees what the first remembered. */
async function launch() {
  app = await electron.launch({ args: [ROOT, `--user-data-dir=${profile}`, '--lang=en-US'] });
  page = await app.firstWindow();
  await page.waitForSelector('.sample');
}
async function quit() {
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBoxSync = () => 0;
  });
  await app.close();
}

test.beforeEach(async () => {
  profile = mkdtempSync(join(tmpdir(), 'vectopix-e2e-'));
  await launch();
});
test.afterEach(() => quit());

const clickMenu = (id: string) => app.evaluate(({ Menu }, itemId) => Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(), id);
const waitForTrace = () => expect(page.locator('.status-metrics')).toContainText('Fidelity', { timeout: 30_000 });
const windowTitle = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());

test('the window is named after the image', async () => {
  await expect.poll(windowTitle).toBe('Vectopix');
  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await expect.poll(windowTitle).toBe('badge-crest.png — Vectopix');
});

test('Save as uses the native dialog, and starts in the last folder next time', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'vectopix-save-'));
  await app.evaluate(({ dialog }, target) => {
    const g = globalThis as unknown as { asked: string[] };
    g.asked = [];
    dialog.showSaveDialog = (async (_win: unknown, options: { defaultPath: string }) => {
      g.asked.push(options.defaultPath);
      return { canceled: false, filePath: `${target}/logo.svg` };
    }) as unknown as typeof dialog.showSaveDialog;
  }, folder);
  await clickMenu('sample.badge-crest');
  await waitForTrace();

  await clickMenu('saveSvg');
  await expect(page.locator('.toast-success')).toContainText('saved');
  expect(readFileSync(join(folder, 'logo.svg'), 'utf8')).toContain('<svg');

  await clickMenu('saveSvg');
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { asked: string[] }).asked.length)).toBe(2);
  const asked = await app.evaluate(() => (globalThis as unknown as { asked: string[] }).asked);
  expect(asked[0]).toMatch(/badge-crest\.svg$/);
  expect(asked[1]).toBe(join(folder, 'badge-crest.svg'));
});

test('cancelling the save dialog writes nothing and says nothing', async () => {
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = (async () => ({ canceled: true, filePath: '' })) as unknown as typeof dialog.showSaveDialog;
  });
  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await clickMenu('saveSvg');
  await page.waitForTimeout(300);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('the theme applies to the page and the native parts, and is kept', async () => {
  await clickMenu('showPreferences');
  await page.getByRole('group', { name: 'Appearance' }).getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');

  await quit();
  await launch();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
});

test('the window reopens where it was left', async () => {
  const bounds = { x: 60, y: 80, width: 1100, height: 720 };
  await app.evaluate(({ BrowserWindow }, b) => BrowserWindow.getAllWindows()[0].setBounds(b), bounds);
  await quit();
  expect(existsSync(join(profile, 'desktop-state.json'))).toBe(true);

  await launch();
  const reopened = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  expect(reopened).toMatchObject({ width: bounds.width, height: bounds.height });
});

test('unsaved hand edits mark the window as edited (macOS)', async () => {
  test.skip(!isMac, 'The edited dot exists only on macOS');
  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await page.getByRole('button', { name: '#f59e0b' }).click();
  await page.getByRole('button', { name: /Make transparent/ }).click();
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isDocumentEdited())).toBe(true);
});
