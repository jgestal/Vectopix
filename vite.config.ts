/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the same build works at the domain root and
  // under a subpath such as GitHub Pages (/Vectopix/)
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    setupFiles: ['src/test/setup.ts'],
    // Browser tests run under Playwright (npm run test:e2e)
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/test/**',
        'src/i18n/locales/**',
        '**/*.d.ts',
        // Entry point and wiring: nothing to decide, exercised by the e2e suite
        'src/main.tsx',
        'src/ui/compositionRoot.ts',
        // Adapters over browser engines (canvas, <img> decoding, downloads,
        // Web Worker) that a simulated DOM can't run: covered by the e2e suite
        'src/infrastructure/browser/fidelity.ts',
        'src/infrastructure/browser/fileSaver.ts',
        'src/infrastructure/browser/sampleImages.ts',
        'src/infrastructure/browser/environment.ts',
        'src/infrastructure/worker/**',
      ],
      // Per layer: the rules and use cases are held to a higher bar than the views
      thresholds: {
        'src/domain/**': { lines: 95, branches: 80 },
        'src/application/**': { lines: 95, branches: 85 },
        'src/infrastructure/**': { lines: 70 },
        'src/ui/**': { lines: 65 },
      },
    },
  },
})
