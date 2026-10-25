/** Who makes Vectopix and where it lives. */

export const AUTHOR = {
  name: 'Juan Gestal',
  email: 'juan@gestal.es',
  website: 'https://gestal.es',
} as const;

export const REPOSITORY_URL = 'https://github.com/jgestal/Vectopix';
export const ISSUES_URL = `${REPOSITORY_URL}/issues/new`;
export const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
export const WEB_APP_URL = 'https://jgestal.github.io/Vectopix/';
/** What changed in the running version. */
export const RELEASE_NOTES_URL = `${REPOSITORY_URL}/releases/tag/v${__APP_VERSION__}`;

/** The open-source projects Vectopix is built on (credited in About). */
export const BUILT_WITH = [
  { name: 'vecline', url: 'https://www.npmjs.com/package/vecline' },
  { name: 'ImageTracerJS', url: 'https://github.com/jankovicsandras/imagetracerjs' },
  { name: 'React', url: 'https://react.dev' },
  { name: 'Electron', url: 'https://www.electronjs.org' },
] as const;
