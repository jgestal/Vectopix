import { createContext, useContext } from 'react';
import type {
  DrawingExporter,
  FileSaver,
  ImageDecoder,
  ImageSource,
  SampleRenderer,
  VectorizationService,
} from '../../application/ports';
import type { Preferences } from '../../application/preferences';
import type { UpdateChecker } from '../../application/checkForUpdate';
import type { SvgDom } from '../../domain/geometry/svgDom';

/**
 * Everything the interface needs from the outside world, injected. The app
 * gets the real implementations (compositionRoot.ts); tests get fakes.
 */
export interface AppServices {
  vectorization: VectorizationService;
  images: ImageSource;
  decoder: ImageDecoder;
  samples: SampleRenderer;
  exporter: DrawingExporter;
  files: FileSaver;
  svgDom: SvgDom;
  preferences: Preferences;
  /** Null where there is nothing to update (the web version is always the latest). */
  updates: UpdateChecker | null;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
