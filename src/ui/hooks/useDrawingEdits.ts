import { recolor, removeColor, restoreTrace, simplify, withSvg } from '../../domain/drawing';
import type { VectorOptions, VectorResult } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import type { useDrawing } from './useDrawing';
import type { ShowToast } from './useToasts';

/**
 * Hand edits to the drawing on screen, each committed as an undoable step
 * (with the settings in force) and announced with a short notice.
 */
export function useDrawingEdits({
  drawing,
  options,
  showToast,
  reportError,
}: {
  drawing: ReturnType<typeof useDrawing>;
  options: VectorOptions;
  showToast: ShowToast;
  reportError: (err: unknown) => void;
}) {
  const { t } = useI18n();
  const { files, svgDom } = useServices();
  const { result } = drawing;

  const commit = (edited: VectorResult, toastText?: string) => {
    drawing.commit({ result: edited, options });
    if (toastText) showToast(toastText, 'info');
  };

  return {
    /** From the node editor: a draft while dragging, a step when final. */
    onSvgModified(svg: string, isFinal = true, toastText?: string) {
      if (!result) return;
      const edited = withSvg(result, svg);
      if (isFinal) commit(edited, toastText);
      else drawing.preview(edited);
    },
    resetEdits() {
      if (result) commit(restoreTrace(result, drawing.earlierResults), t('toast.nodesRestored'));
    },
    simplifyNodes() {
      if (!result) return;
      const done = simplify(result, svgDom);
      if (done) commit(done.result, t('toast.simplified', { count: done.removed, pct: done.percent }));
      else showToast(t('toast.alreadySimplified'), 'info');
    },
    replaceColor(from: string, to: string) {
      if (result) commit(recolor(result, from, to, svgDom), t('toast.colorReplaced', { from, to }));
    },
    deleteColor(hex: string) {
      if (result) commit(removeColor(result, hex, svgDom), t('toast.colorRemoved', { color: hex }));
    },
    copySvg() {
      if (!result) return;
      files.copyText(result.svg).then(() => showToast(t('toast.svgCopied'), 'success'), reportError);
    },
  };
}
