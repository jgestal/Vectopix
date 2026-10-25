import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests of the desktop app: Electron launched on the production
 * build (run `npm run build` first; `npm run test:e2e:desktop` does both).
 */
export default defineConfig({
  testDir: 'tests/e2e-desktop',
  testMatch: '**/*.e2e.ts',
  // One Electron instance at a time: they share the single-instance lock
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { trace: 'retain-on-failure' },
});
