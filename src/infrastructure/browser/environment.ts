/** The desktop app serves the interface from its private app:// origin. */
export function isDesktopApp(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'app:';
}
