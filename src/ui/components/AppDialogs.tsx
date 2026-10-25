import type { VectorResult } from '../../domain/types';
import type { ShowToast } from '../hooks/useToasts';
import { ExportModal } from './ExportModal';
import { ShortcutsModal } from './ShortcutsModal';
import { AboutDialog } from './AboutDialog';
import { PreferencesDialog } from './PreferencesDialog';

/** The app's modal windows: at most one is open. */
export type AppDialog = 'export' | 'shortcuts' | 'about' | 'preferences';

interface AppDialogsProps {
  dialog: AppDialog | null;
  onClose: () => void;
  result: VectorResult | null;
  fileName: string | null;
  imageDimensions: { width: number; height: number } | null;
  /** Remount the export dialog for each step, so it shows that step's drawing. */
  historyIndex: number;
  showToast: ShowToast;
  onSaved: () => void;
  onPreferencesReset: () => void;
}

export function AppDialogs({ dialog, onClose, result, fileName, imageDimensions, historyIndex, showToast, onSaved, onPreferencesReset }: AppDialogsProps) {
  if (dialog === 'export') {
    return result && fileName ? (
      <ExportModal
        key={historyIndex}
        onClose={onClose}
        result={result}
        baseFileName={fileName}
        imageDimensions={imageDimensions}
        onShowToast={showToast}
        onSaved={onSaved}
      />
    ) : null;
  }
  if (dialog === 'shortcuts') return <ShortcutsModal isOpen onClose={onClose} />;
  if (dialog === 'about') return <AboutDialog onClose={onClose} />;
  if (dialog === 'preferences') return <PreferencesDialog onClose={onClose} onReset={onPreferencesReset} />;
  return null;
}
