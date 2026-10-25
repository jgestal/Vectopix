import type { AppServices } from './services/context';
import { createPreferences } from '../application/preferences';
import { createUpdateChecker } from '../application/checkForUpdate';
import { LocalSettingsStore } from '../infrastructure/storage/localSettings';
import { GitHubReleaseSource } from '../infrastructure/github/releaseSource';
import { workerVectorization } from '../infrastructure/worker/vectorWorkerClient';
import { browserImageSource, canvasImageDecoder } from '../infrastructure/browser/imageLoading';
import { canvasSampleRenderer } from '../infrastructure/browser/sampleImages';
import { browserFileSaver } from '../infrastructure/browser/fileSaver';
import { createSvgDom } from '../infrastructure/browser/svgDom';
import { createElectronShell } from '../infrastructure/desktop/electronShell';
import { createDesktopFileSaver } from '../infrastructure/desktop/desktopFileSaver';
import { drawingExporter } from '../infrastructure/drawingExporter';

/**
 * Composition root: the one place where the interface meets concrete
 * infrastructure. Everything else depends on the AppServices contract.
 */
export function createAppServices(): AppServices {
  const store = new LocalSettingsStore();
  // Present only in the desktop app (electron/preload.cjs)
  const bridge = typeof window !== 'undefined' ? window.vectopixDesktop : undefined;
  const desktop = bridge ? createElectronShell(bridge) : null;
  return {
    vectorization: workerVectorization,
    images: browserImageSource,
    decoder: canvasImageDecoder,
    samples: canvasSampleRenderer,
    exporter: drawingExporter,
    files: bridge ? createDesktopFileSaver(bridge) : browserFileSaver,
    svgDom: createSvgDom(),
    preferences: createPreferences(store),
    updates: desktop
      ? createUpdateChecker({ currentVersion: __APP_VERSION__, releases: new GitHubReleaseSource(), store, clock: Date.now })
      : null,
    desktop,
  };
}
