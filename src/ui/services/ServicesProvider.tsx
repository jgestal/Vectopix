import type { ReactNode } from 'react';
import { ServicesContext, type AppServices } from './context';

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
