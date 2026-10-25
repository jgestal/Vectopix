import { useCallback, useMemo, useState } from 'react';
import { canRedo, canUndo, currentStep, emptyHistory, goTo, mapSteps, pushStep, type History } from '../../domain/history';
import type { VectorOptions, VectorResult } from '../../domain/types';

/** Undo steps kept; older ones are dropped. */
const HISTORY_LIMIT = 50;

/**
 * One undo step: a result and the settings that produced it. Traces and edits
 * both add steps, so changing a setting never throws edits away: they stay
 * one undo behind the new trace.
 */
export interface DrawingStep {
  result: VectorResult;
  options: VectorOptions;
}

/**
 * The drawing on screen and its history. While a node is being dragged the
 * screen shows a draft, which becomes a step when the drag ends.
 */
export function useDrawing() {
  const [history, setHistory] = useState<History<DrawingStep>>(emptyHistory);
  const [draft, setDraft] = useState<VectorResult | null>(null);

  const result = draft ?? currentStep(history)?.result ?? null;

  const commit = useCallback((step: DrawingStep) => {
    setDraft(null);
    setHistory((h) => pushStep(h, step, HISTORY_LIMIT));
  }, []);

  /** Make step `index` current; returns it (null if there is none). */
  const restore = useCallback(
    (index: number): DrawingStep | null => {
      const step = history.entries[index];
      if (!step) return null;
      setDraft(null);
      setHistory((h) => goTo(h, index));
      return step;
    },
    [history]
  );

  /** Attach a fidelity measured after the fact to every step showing that trace. */
  const attachFidelity = useCallback((tracedSvg: string, ssim: number) => {
    const withSsim = (r: VectorResult) => (r.originalSvg === tracedSvg ? { ...r, ssim } : r);
    setHistory((h) => mapSteps(h, (step) => ({ ...step, result: withSsim(step.result) })));
    setDraft((d) => d && withSsim(d));
  }, []);

  const clear = useCallback(() => {
    setDraft(null);
    setHistory(emptyHistory());
  }, []);

  const earlierResults = useMemo(() => history.entries.map((s) => s.result), [history]);

  return {
    result,
    index: history.index,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    earlierResults,
    commit,
    preview: setDraft,
    restore,
    attachFidelity,
    clear,
  };
}
