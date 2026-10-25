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
export function useSaving({ result, fileName, showToast }: { result: VectorResult | null; fileName: string | null; showToast: ShowToast }) {
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
    /** Save as SVG, named after the image. */
    saveSvg() {
      if (!result || !fileName) return;
      const name = exportFileName('svg', fileName, { pngScale: 1, framework: 'react' });
      files.save(exporter.minify(result.svg), name, EXPORT_MIME.svg);
      setSavedSvg(result.svg);
      showToast(t('export.downloaded', { file: name }), 'success');
    },
    /** The drawing on screen was saved some other way (the export dialog). */
    markSaved() {
      if (result) setSavedSvg(result.svg);
    },
  };
}
