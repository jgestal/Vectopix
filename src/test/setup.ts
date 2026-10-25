import { afterEach } from 'vitest';

// Unmount what each component test rendered (only where a DOM exists)
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
