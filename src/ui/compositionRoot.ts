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
import { desktopShellFromWindow } from '../infrastructure/desktop/electronShell';
import { drawingExporter } from '../infrastructure/drawingExporter';

/**
 * Composition root: the one place where the interface meets concrete
 * infrastructure. Everything else depends on the AppServices contract.
 */
export function createAppServices(): AppServices {
  const store = new LocalSettingsStore();
  const desktop = desktopShellFromWindow();
  return {
    vectorization: workerVectorization,
    images: browserImageSource,
    decoder: canvasImageDecoder,
    samples: canvasSampleRenderer,
    exporter: drawingExporter,
    files: browserFileSaver,
    svgDom: createSvgDom(),
    preferences: createPreferences(store),
    updates: desktop
      ? createUpdateChecker({ currentVersion: __APP_VERSION__, releases: new GitHubReleaseSource(), store, clock: Date.now })
      : null,
    desktop,
  };
}
