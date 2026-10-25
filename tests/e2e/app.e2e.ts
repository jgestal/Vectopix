import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = new URL('./fixtures/badge.png', import.meta.url);
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const vectorSvg = (page: Page) => page.locator('.vector-layer .svg-render-container svg').first();
const undoKey = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';

/** Wait until a trace has finished and its fidelity has been measured. */
async function waitForTrace(page: Page) {
  await expect(vectorSvg(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.status-message')).not.toHaveClass(/is-busy/, { timeout: 30_000 });
  await expect(page.locator('.status-metrics')).toContainText('Fidelity', { timeout: 30_000 });
}

/** Wait for the vector to change from `before` (a re-trace or an edit landing). */
async function waitForNewSvg(page: Page, before: string) {
  await expect.poll(async () => vectorSvg(page).evaluate((el) => el.outerHTML), { timeout: 30_000 }).not.toBe(before);
  await waitForTrace(page);
}

/** Alpha (0–255) of the rendered vector at fractional positions of its canvas. */
async function renderedAlpha(page: Page, points: [number, number][]) {
  return vectorSvg(page).evaluate(async (svg, pts) => {
    const w = Number(svg.getAttribute('width'));
    const h = Number(svg.getAttribute('height'));
    const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return pts.map(([fx, fy]) => ctx.getImageData(Math.floor(fx * (w - 1)), Math.floor(fy * (h - 1)), 1, 1).data[3]);
  }, points);
}

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
});
test.afterEach(() => {
  expect(errors, 'no errors in the page').toEqual([]);
});

test.describe('loading images', () => {
  test('a sample traces when clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Heraldic crest/ }).click();
    await waitForTrace(page);
    await expect(page.locator('.status-metrics')).toContainText('Nodes');
  });

  test('a sample traces when dragged onto the drop zone', async ({ page }) => {
    await page.getByRole('button', { name: /Geometric tech logo/ }).dragTo(page.locator('.dropzone'));
    await waitForTrace(page);
  });

  test('a file traces when picked', async ({ page }) => {
    await page.locator('.dropzone input[type="file"]').setInputFiles(FIXTURE.pathname);
    await waitForTrace(page);
    await expect(page.locator('.topbar-file-name')).toHaveText('badge.png');
  });

  test('a file traces when dropped anywhere on the window', async ({ page }) => {
    const bytes = [...readFileSync(FIXTURE)];
    const dataTransfer = await page.evaluateHandle((data) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], 'dropped.png', { type: 'image/png' }));
      return dt;
    }, bytes);
    await page.locator('.dropzone').dispatchEvent('dragover', { dataTransfer });
    await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer });
    await waitForTrace(page);
    await expect(page.locator('.topbar-file-name')).toHaveText('dropped.png');
  });

  test('pixel art comes out as exact squares whatever the preset', async ({ page }) => {
    await page.getByRole('button', { name: /8-bit pixel art heart/ }).click();
    await waitForTrace(page);
    const exact = await vectorSvg(page).evaluate((el) => el.outerHTML);
    await page.getByRole('radio', { name: /Logo \/ icon/ }).click();
    // The re-trace (after the settings debounce) gives the same exact grid
    await page.waitForTimeout(600);
    await waitForTrace(page);
    expect(await vectorSvg(page).evaluate((el) => el.outerHTML)).toBe(exact);
    await expect(page.locator('.status-metrics')).toContainText('100.0%');
    // Only straight horizontal and vertical edges: no curves
    const d = await vectorSvg(page).evaluate((el) => [...el.querySelectorAll('path')].map((p) => p.getAttribute('d')).join(''));
    expect(d).not.toMatch(/[cCsSqQaA]/);
  });

  test('a small image traces with a warning that a larger one would be better', async ({ page }) => {
    await page.locator('.dropzone input[type="file"]').setInputFiles(fixture('small.png'));
    await expect(page.getByText(/Small image \(64×64 px\)/)).toBeVisible();
    await waitForTrace(page);
  });

  test('a transparent PNG comes out transparent, with the setting on', async ({ page }) => {
    await page.locator('.dropzone input[type="file"]').setInputFiles(fixture('cutout.png'));
    await waitForTrace(page);
    await page.locator('summary', { hasText: 'Advanced' }).click();
    await expect(page.getByRole('checkbox', { name: /Transparent background/ })).toBeChecked();
    const [corner, centre] = await renderedAlpha(page, [[0, 0], [0.5, 0.5]]);
    expect(corner).toBe(0);
    expect(centre).toBe(255);
  });

  test('an unsupported format (HEIC) is reported, not traced', async ({ page }) => {
    await page.locator('.dropzone input[type="file"]').setInputFiles({ name: 'photo.heic', mimeType: 'image/heic', buffer: Buffer.from('not really heic') });
    await expect(page.getByText(/Unsupported format/)).toBeVisible();
    await expect(page.locator('.dropzone')).toBeVisible();
  });
});

test.describe('editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: /Heraldic crest/ }).click();
    await waitForTrace(page);
  });

  /** Drag the n-th node by (dx, dy) screen px with the node editor on. */
  async function dragNode(page: Page, index: number, dx: number, dy: number) {
    await page.keyboard.press('n');
    const handle = page.locator('.interactive-anchor-handle').nth(index);
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  }

  test('dragging a node changes the drawing and undo restores it', async ({ page }) => {
    const before = await vectorSvg(page).evaluate((el) => el.outerHTML);
    await dragNode(page, 2, 40, 25);
    await expect.poll(() => vectorSvg(page).evaluate((el) => el.outerHTML)).not.toBe(before);
    await page.keyboard.press(undoKey);
    await expect.poll(() => vectorSvg(page).evaluate((el) => el.outerHTML)).toBe(before);
  });

  test('changing a setting keeps the edits one undo away', async ({ page }) => {
    await dragNode(page, 2, 40, 25);
    const edited = await vectorSvg(page).evaluate((el) => el.outerHTML);
    await page.keyboard.press('n');

    await page.locator('summary', { hasText: 'Advanced' }).click();
    await page.getByText('Transparent background').click();
    await waitForNewSvg(page, edited);
    await expect(page.getByText(/edits are one undo back/)).toBeVisible();

    await page.keyboard.press(undoKey);
    await expect.poll(() => vectorSvg(page).evaluate((el) => el.outerHTML)).toBe(edited);
    // The setting came back with the edits, and restoring it did not re-trace
    await expect(page.getByRole('checkbox', { name: /Transparent background/ })).not.toBeChecked();
    await page.waitForTimeout(800);
    expect(await vectorSvg(page).evaluate((el) => el.outerHTML)).toBe(edited);
  });

  test('a transparent background removes the surroundings and keeps the subject', async ({ page }) => {
    const before = await vectorSvg(page).evaluate((el) => el.outerHTML);
    expect(await renderedAlpha(page, [[0, 0], [0.5, 0.5]])).toEqual([255, 255]);

    await page.locator('summary', { hasText: 'Advanced' }).click();
    await page.getByText('Transparent background').click();
    await waitForNewSvg(page, before);
    const [corner, otherCorner, centre] = await renderedAlpha(page, [[0, 0], [1, 1], [0.5, 0.5]]);
    expect(corner).toBe(0);
    expect(otherCorner).toBe(0);
    expect(centre).toBe(255);
  });

  test('the side-by-side label counts the same shapes as the status bar', async ({ page }) => {
    const shapes = await page.locator('.status-metrics div', { hasText: 'Paths' }).locator('dd').innerText();
    await page.keyboard.press('d');
    await expect(page.getByText(`Vector (${shapes} paths)`)).toBeVisible();
  });
});

test.describe('export and language', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: /Geometric tech logo/ }).click();
    await waitForTrace(page);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
  });

  for (const [tab, extension] of [
    ['SVG', '.svg'],
    ['High-res PNG', '.png'],
    ['DXF (laser / CNC)', '.dxf'],
    ['EPS (print)', '.eps'],
    ['Vector PDF', '.pdf'],
  ] as const) {
    test(`downloads ${tab}`, async ({ page }) => {
      await page.getByRole('tab', { name: tab }).click();
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download/ }).click()]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\${extension}$`));
      const path = await download.path();
      expect(readFileSync(path).length).toBeGreaterThan(100);
    });
  }

  test('switches language', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeVisible();
  });
});

test.describe('remembered settings', () => {
  test('the user\'s settings and export choices survive a reload; samples bring their own preset', async ({ page }) => {
    // Change a setting by hand on the user's own image
    await page.locator('.dropzone input[type="file"]').setInputFiles(FIXTURE.pathname);
    await waitForTrace(page);
    await page.locator('summary', { hasText: 'Advanced' }).click();
    await page.getByText('Transparent background').click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('tab', { name: 'DXF (laser / CNC)' }).click();
    await page.keyboard.press('Escape');

    await page.reload();
    // A sample applies its own preset and leaves the remembered settings alone
    await page.getByRole('button', { name: /8-bit pixel art heart/ }).click();
    await waitForTrace(page);
    await expect(page.getByRole('radio', { name: /Exact pixel art/ })).toBeChecked();

    // The user's next image starts with what they chose
    await page.locator('.brand').click();
    await page.locator('.dropzone input[type="file"]').setInputFiles(FIXTURE.pathname);
    await waitForTrace(page);
    await page.locator('summary', { hasText: 'Advanced' }).click();
    await expect(page.getByRole('checkbox', { name: /Transparent background/ })).toBeChecked();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'DXF (laser / CNC)' })).toHaveAttribute('aria-selected', 'true');
  });
});

