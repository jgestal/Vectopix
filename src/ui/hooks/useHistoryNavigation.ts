import type { VectorOptions } from '../../domain/types';
import { useI18n, type MessageKey } from '../../i18n';
import type { useDrawing } from './useDrawing';
import type { ShowToast } from './useToasts';

/**
 * Undo and redo: each step brings back its drawing and the settings that
 * produced it, without tracing again and without a trace in flight replacing it.
 */
export function useHistoryNavigation(deps: {
  drawing: ReturnType<typeof useDrawing>;
  options: VectorOptions;
  setOptions: (options: VectorOptions) => void;
  /** Restored settings come with their result: don't trace them. */
  skipTraceFor: (options: VectorOptions) => void;
  cancelTrace: () => void;
  showToast: ShowToast;
}) {
  const { t } = useI18n();
  const { drawing, options, setOptions, skipTraceFor, cancelTrace, showToast } = deps;

  const restore = (index: number, toastKey: MessageKey) => {
    const step = drawing.restore(index);
    if (!step) return;
    cancelTrace();
    if (step.options !== options) {
      skipTraceFor(step.options);
      setOptions(step.options);
    }
    showToast(t(toastKey), 'info');
  };

  return {
    undo: () => drawing.canUndo && restore(drawing.index - 1, 'toast.undo'),
    redo: () => drawing.canRedo && restore(drawing.index + 1, 'toast.redo'),
  };
}
