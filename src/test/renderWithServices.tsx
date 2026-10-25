import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { en } from '../i18n/locales/en';
import { ServicesProvider } from '../ui/services/ServicesProvider';
import type { AppServices } from '../ui/services/context';
import { createPreferences } from '../application/preferences';
import type { VectorResult } from '../domain/types';
import { createSvgDom } from '../infrastructure/browser/svgDom';
import { MemoryStore } from './fakes';

/** A small traced result: a white frame and a red square. */
export function tracedResult(overrides: Partial<VectorResult> = {}): VectorResult {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">' +
    '<path d="M0 0h120v80H0z" fill="#ffffff"/><path d="M20 20h40v40h-40z" fill="#ff0000"/></svg>';
  return {
    svg,
    originalSvg: svg,
    shapes: 2,
    colors: 2,
    regions: 2,
    nodesCount: 8,
    executionTimeMs: 12,
    fileSizeBytes: svg.length,
    rasterSizeBytes: 1000,
    palette: [
      { hex: '#ffffff', r: 255, g: 255, b: 255, a: 255, count: 8000, percentage: 83 },
      { hex: '#ff0000', r: 255, g: 0, b: 0, a: 255, count: 1600, percentage: 17 },
    ],
    ...overrides,
  };
}

/** Fake services: every port answers simply and records its calls. */
export function fakeServices(overrides: Partial<AppServices> = {}) {
  const store = new MemoryStore();
  const services = {
    vectorization: {
      vectorize: vi.fn(async () => tracedResult()),
      measureFidelity: vi.fn(async () => 0.97),
    },
    images: {
      extraExtensions: ['.tga'],
      readFile: vi.fn(async () => 'data:image/png;base64,file'),
      readDrop: vi.fn(() => null),
      fetchImage: vi.fn(async () => new File([], 'web.png')),
    },
    decoder: {
      decode: vi.fn(async (_url: string, fit: (w: number, h: number) => { width: number; height: number }) => {
        const size = fit(120, 80);
        return { pixels: { ...size, data: new Uint8ClampedArray(size.width * size.height * 4).fill(255) }, naturalWidth: 120, naturalHeight: 80 };
      }),
    },
    samples: { render: vi.fn((id: string) => `data:image/png;base64,sample-${id}`) },
    exporter: {
      cad: vi.fn(async () => 'DXF SECTION'),
      png: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
      component: vi.fn(() => 'export function VectorGraphic() {}'),
      minify: vi.fn((svg: string) => svg),
    },
    files: { save: vi.fn(async (_content: unknown, fileName: string) => ({ status: 'downloaded' as const, fileName })), copyText: vi.fn(async () => {}), copyImage: vi.fn(async () => {}), dragOut: vi.fn() },
    svgDom: createSvgDom(),
    preferences: createPreferences(store),
    updates: null,
    desktop: null,
    ...overrides,
  } satisfies AppServices;
  return { services, store };
}

export function Providers({ services, children }: { services: AppServices; children: ReactNode }) {
  return (
    <ServicesProvider services={services}>
      <I18nProvider initialLanguage="en" initialMessages={en}>
        {children}
      </I18nProvider>
    </ServicesProvider>
  );
}

/** Render with fake services (overridable) and the English catalogue. */
export function renderWithServices(ui: ReactElement, overrides: Partial<AppServices> = {}) {
  const { services, store } = fakeServices(overrides);
  const view = render(ui, { wrapper: ({ children }) => <Providers services={services}>{children}</Providers> });
  return { ...view, services, store };
}
