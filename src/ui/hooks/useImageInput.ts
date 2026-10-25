import { useCallback, useEffect } from 'react';
import { prepareImage, type PreparedImage } from '../../application/prepareImage';
import { SAMPLE_IMAGES } from '../../domain/samples';
import type { VectorPreset } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import type { ShowToast } from './useToasts';

export interface LoadedImage extends PreparedImage {
  dataUrl: string;
  fileName: string;
  sizeBytes: number;
  /** Set for a built-in sample: the preset that suits it. */
  samplePreset?: VectorPreset;
}

interface Callbacks {
  onLoaded(image: LoadedImage): void;
  showToast: ShowToast;
  reportError(err: unknown, fallback?: 'error.fileRead'): void;
}

/**
 * Every way an image arrives (file picker, drop, paste, gallery sample,
 * image dragged from a web page) ends in one place: prepared and handed on.
 */
export function useImageInput({ onLoaded, showToast, reportError }: Callbacks) {
  const { t } = useI18n();
  const { images, decoder, samples } = useServices();

  const open = useCallback(
    async (dataUrl: string, fileName: string, samplePreset?: VectorPreset) => {
      try {
        const prepared = await prepareImage(dataUrl, decoder);
        for (const notice of prepared.notices) showToast(t(notice.code, notice.params), 'warning');
        onLoaded({ ...prepared, dataUrl, fileName, sizeBytes: Math.round((dataUrl.length * 3) / 4), samplePreset });
      } catch (err) {
        reportError(err);
      }
    },
    [decoder, onLoaded, reportError, showToast, t]
  );

  const loadFile = useCallback(
    async (file: File, successText?: string) => {
      try {
        const dataUrl = await images.readFile(file);
        await open(dataUrl, file.name || t('file.pastedName'));
        if (successText) showToast(successText, 'success');
      } catch (err) {
        reportError(err, 'error.fileRead');
      }
    },
    [images, open, reportError, showToast, t]
  );

  const loadSample = useCallback(
    (id: string) => {
      const sample = SAMPLE_IMAGES.find((s) => s.id === id);
      if (sample) open(samples.render(sample.id), `${sample.id}.png`, sample.preset);
    },
    [open, samples]
  );

  const loadDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      const dropped = images.readDrop(dataTransfer);
      if (dropped?.kind === 'sample') loadSample(dropped.id);
      else if (dropped?.kind === 'file') loadFile(dropped.file, t('toast.imageLoaded', { name: dropped.file.name }));
      else if (dropped?.kind === 'url') {
        try {
          loadFile(await images.fetchImage(dropped.url));
        } catch (err) {
          reportError(err);
        }
      }
    },
    [images, loadFile, loadSample, reportError, t]
  );

  // Paste an image (⌘/Ctrl+V) at any time
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) loadFile(file, t('toast.imagePasted'));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile, t]);

  return { loadFile, loadSample, loadDrop, acceptedTypes: ['image/*', ...images.extraExtensions].join(',') };
}
