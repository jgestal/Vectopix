/** What each export produces: file name and type. */

export type ExportTab = 'svg' | 'png' | 'components' | 'dxf' | 'eps' | 'pdf';
export type ComponentFramework = 'react' | 'vue' | 'svelte';

export const EXPORT_TABS: readonly ExportTab[] = ['svg', 'png', 'components', 'dxf', 'eps', 'pdf'];
export const PNG_SCALES = [1, 2, 4, 8] as const;

export const EXPORT_MIME: Record<ExportTab, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  components: 'text/plain',
  dxf: 'application/dxf',
  eps: 'application/postscript',
  pdf: 'application/pdf',
};

const COMPONENT_EXTENSION: Record<ComponentFramework, string> = { react: 'tsx', vue: 'vue', svelte: 'svelte' };

/** "logo.final.png" → "logo.final" */
export const stripExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '');

export function exportFileName(tab: ExportTab, sourceName: string, choices: { pngScale: number; framework: ComponentFramework }): string {
  const base = stripExtension(sourceName);
  if (tab === 'png') return `${base}_@${choices.pngScale}x.png`;
  if (tab === 'components') return `VectorGraphic.${COMPONENT_EXTENSION[choices.framework]}`;
  return `${base}.${tab}`;
}
