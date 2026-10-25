import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../e2e/fixtures/badge.png', import.meta.url));
const isMac = process.platform === 'darwin';

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  // A fresh profile each time: no remembered language, settings or recent files
  const profile = mkdtempSync(join(tmpdir(), 'vectopix-e2e-'));
  app = await electron.launch({ args: [ROOT, `--user-data-dir=${profile}`, '--lang=en-US'] });
  page = await app.firstWindow();
  await page.waitForSelector('.sample');
});
test.afterEach(async () => {
  // Never block on the unsaved-edits question while tearing down
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBoxSync = () => 0;
  });
  await app.close();
});

/** The native menu bar's top-level labels. */
const menuBar = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items.map((i) => i.label));
const menuItem = (id: string) =>
  app.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()!.getMenuItemById(itemId);
    return item && { label: item.label, enabled: item.enabled, checked: item.checked, accelerator: item.accelerator };
  }, id);
const clickMenu = (id: string) => app.evaluate(({ Menu }, itemId) => Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(), id);
const waitForTrace = () => expect(page.locator('.status-metrics')).toContainText('Fidelity', { timeout: 30_000 });

test('the menu bar follows the platform and the app’s state', async () => {
  await expect.poll(menuBar).toEqual([...(isMac ? ['Vectopix'] : []), 'File', 'Edit', 'View', 'Image', 'Window', 'Help']);
  expect(await menuItem('saveSvg')).toMatchObject({ enabled: false, accelerator: 'CmdOrCtrl+S' });
  expect(await menuItem('openImage')).toMatchObject({ label: 'Open Image…', enabled: true });

  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await expect.poll(async () => (await menuItem('saveSvg'))?.enabled).toBe(true);
  expect(await menuItem('preset.flat-art')).toMatchObject({ checked: true });
});

test('views and drawing modes from the menu', async () => {
  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await clickMenu('view.sideBySide');
  await expect(page.getByText(/Vector \(\d+ paths\)/)).toBeVisible();
  await expect.poll(async () => (await menuItem('view.sideBySide'))?.checked).toBe(true);
  await clickMenu('zoomActual');
  await expect(page.locator('.zoom-value')).toHaveText('100%');
});

test('About credits the author; Settings opens', async () => {
  await clickMenu('showAbout');
  await expect(page.getByText('Juan Gestal')).toBeVisible();
  await expect(page.getByRole('link', { name: 'juan@gestal.es' })).toHaveAttribute('href', 'mailto:juan@gestal.es');
  await page.getByRole('button', { name: 'Done' }).click();
  await clickMenu('showPreferences');
  await expect(page.getByRole('checkbox', { name: /Check for updates/ })).toBeVisible();
});

test('the menu bar speaks the interface’s language', async () => {
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect.poll(menuBar).toContain('Archivo');
  expect((await menuItem('openImage'))?.label).toBe('Abrir imagen…');
});

test('a file the system hands over opens (Open Recent, the Dock)', async () => {
  await app.evaluate(({ app: electronApp }, path) => electronApp.emit('open-file', { preventDefault() {} }, path), FIXTURE);
  await waitForTrace();
  await expect(page.locator('.topbar-file-name')).toHaveText('badge.png');
});

test('closing with unsaved hand edits asks first', async () => {
  await clickMenu('sample.badge-crest');
  await waitForTrace();
  await page.getByRole('button', { name: '#f59e0b' }).click();
  await page.getByRole('button', { name: /Make transparent/ }).click();
  await expect(page.locator('.status-metrics')).toContainText('Paths');

  // "Cancel": the window stays, and the question named the file
  await app.evaluate(({ dialog }) => {
    const g = globalThis as unknown as { asked?: string };
    dialog.showMessageBoxSync = ((_win: unknown, options: { message: string }) => {
      g.asked = options.message;
      return 1;
    }) as typeof dialog.showMessageBoxSync;
  });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  expect(await app.evaluate(() => (globalThis as unknown as { asked?: string }).asked)).toContain('badge-crest.png');
});
