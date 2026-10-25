import { useEffect, useState } from 'react';
import { EXPORT_MIME, exportFileName } from '../../domain/export/exportFiles';
import type { VectorResult } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import type { ShowToast } from './useToasts';

/**
 * Saving the drawing, and what is at risk until it is saved: hand edits
 * (not traces, which can always be made again). In the desktop app, closing
 * the window with unsaved edits asks first.
 */
/** Copy as PNG renders at this multiple of the image's size: sharp when pasted into documents. */
const COPY_PNG_SCALE = 2;

export function useSaving({
  result,
  fileName,
  size,
  showToast,
}: {
  result: VectorResult | null;
  fileName: string | null;
  size: { width: number; height: number } | null;
  showToast: ShowToast;
}) {
  const { t } = useI18n();
  const { files, exporter, desktop } = useServices();
  const [savedSvg, setSavedSvg] = useState<string | null>(null);
  const hasUnsavedEdits = !!result && result.svg !== result.originalSvg && result.svg !== savedSvg;

  useEffect(() => {
    if (!desktop) return;
    const confirm = hasUnsavedEdits
      ? { title: t('close.title'), message: t('close.message', { file: fileName ?? '' }), discard: t('close.discard'), cancel: t('close.cancel') }
      : null;
    desktop.setCloseConfirmation(confirm);
  }, [desktop, hasUnsavedEdits, fileName, t]);

  return {
    hasUnsavedEdits,
    /** Save as SVG, named after the image (in the desktop app, where the person chooses). */
    async saveSvg() {
      if (!result || !fileName) return;
      const name = exportFileName('svg', fileName, { pngScale: 1, framework: 'react' });
      const outcome = await files.save(exporter.minify(result.svg), name, EXPORT_MIME.svg);
      if (outcome === 'cancelled') return;
      setSavedSvg(result.svg);
      showToast(t(outcome === 'saved' ? 'export.saved' : 'export.downloaded', { file: name }), 'success');
    },
    /** The drawing as a PNG on the clipboard (transparent background, twice the size). */
    async copyPng() {
      if (!result || !size) return;
      try {
        await files.copyImage(await exporter.png(result.svg, size, COPY_PNG_SCALE, 'transparent'));
        showToast(t('export.imageCopied'), 'success');
      } catch {
        showToast(t('export.copyImageFailed'), 'warning');
      }
    },
    /** The drawing on screen was saved some other way (the export dialog). */
    markSaved() {
      if (result) setSavedSvg(result.svg);
    },
  };
}
