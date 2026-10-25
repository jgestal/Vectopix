import { useState, useCallback, useEffect, useRef, type SetStateAction } from 'react';
import type {
  VectorOptions,
  VectorPreset,
  VectorResult,
  ViewMode,
  RenderMode,
  WorkerProgress,
  PaletteColor,
  ToastMessage,
} from './types/vector';
import {
  vectorizeWithWorker,
  measureSsimWithWorker,
  VectorizationCanceledError,
} from './services/vectorWorkerClient';
import { TopBar } from './components/TopBar';
import { CanvasControls } from './components/CanvasControls';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { MetricsBar } from './components/MetricsBar';
import { ExportModal } from './components/ExportModal';
import { DropZone } from './components/DropZone';
import { ColorModal } from './components/ColorModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/Toast';
import { UpdateNotice } from './components/UpdateNotice';
import { replaceColorInSvg, removeColorFromSvg, normalizeHex } from './utils/paletteUtils';
import { parseSvgDocument, serializeParsedDoc, simplifySvgPaths, countAnchors, countShapes } from './utils/pathParser';
import { rasterizeForComparison } from './utils/fidelity';
import { readImageFile, readDrop, fetchImage, EXTRA_IMAGE_EXTENSIONS } from './utils/imageLoading';
import { hasTransparentBorder } from './utils/transparency';
import { SAMPLE_IMAGES, generateSampleDataUrl } from './utils/sampleImages';
import { applyPreset, loadUserOptions, saveUserOptions } from './config/presets';
import { loadSetting, saveSetting } from './utils/storage';
import { useI18n, type MessageKey } from './i18n';
import { LocalizedError } from './i18n/errors';
import './App.css';

/** Larger images are downscaled before tracing to keep the worker responsive. */
const MAX_PIXELS = 4_000_000;
/** Below this longest side (px), thin features are a few pixels and trace poorly: say so. */
const SMALL_IMAGE_SIDE = 100;

/** Delay before re-tracing after a setting changes, so sliders don't flood the worker. */
const RETRACE_DEBOUNCE_MS = 400;

/** Undo steps kept; older ones are dropped. */
const HISTORY_LIMIT = 50;

/**
 * One undo step: a result and the settings that produced it. Traces and edits
 * both add steps, so changing a setting never throws edits away: they stay
 * one undo behind the new trace.
 */
interface HistoryEntry {
  result: VectorResult;
  options: VectorOptions;
}

interface History {
  entries: HistoryEntry[];
  /** The entry on screen. */
  index: number;
}

const EMPTY_HISTORY: History = { entries: [], index: -1 };

/** Input types that don't take typing: shortcuts keep working while they have focus. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file']);

/** Whether keys typed now are text for the focused field (so not shortcuts). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return ['TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function App() {
  const { t } = useI18n();
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('vector-image.png');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [rasterSizeBytes, setRasterSizeBytes] = useState<number>(0);

  const [options, setOptions] = useState<VectorOptions>(loadUserOptions);
  const [result, setResult] = useState<VectorResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => loadSetting('view', { viewMode: 'split' as ViewMode }, { viewMode: ['split', 'vector', 'raster', 'side-by-side'] }).viewMode
  );
  useEffect(() => saveSetting('view', { viewMode }), [viewMode]);
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [zoom, setZoom] = useState<number>(1);
  const [fitRequest, setFitRequest] = useState<number>(0);

  // Modals & Floating UI State
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPaletteColor, setSelectedPaletteColor] = useState<PaletteColor | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Undo history of traces and edits
  const [{ entries: history, index: historyIndex }, setHistory] = useState<History>(EMPTY_HISTORY);
  const toastIdCounter = useRef(0);
  const traceCounter = useRef(0);
  const lastTracedImage = useRef<ImageData | null>(null);
  /** Settings restored by undo/redo: they come with their result, so no re-trace. */
  const restoredOptions = useRef<VectorOptions | null>(null);
  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `toast_${++toastIdCounter.current}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  // Measure real fidelity in the background: render the SVG, compare with the source
  const measureFidelity = useCallback(async (traceId: number, source: ImageData, svg: string) => {
    try {
      const { reference, candidate } = await rasterizeForComparison(source, svg);
      const ssim = await measureSsimWithWorker(reference, candidate);
      if (traceId !== traceCounter.current) return;
      const withSsim = (r: VectorResult) => (r.originalSvg === svg ? { ...r, ssim } : r);
      setResult((prev) => prev && withSsim(prev));
      setHistory((h) => ({ ...h, entries: h.entries.map((entry) => ({ ...entry, result: withSsim(entry.result) })) }));
    } catch {
      // Fidelity is informative only; a failed measurement just isn't shown
    }
  }, []);

  /** Show a result and make it the newest undo step (dropping any redo steps). */
  const pushHistory = useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setHistory((h) => {
      const entries = [...h.entries.slice(0, h.index + 1), entry].slice(-HISTORY_LIMIT);
      return { entries, index: entries.length - 1 };
    });
  }, []);

  // Core Vectorization Runner
  const runVectorization = useCallback(
    async (data: ImageData, sizeBytes: number, opts: VectorOptions) => {
      const traceId = ++traceCounter.current;
      setIsProcessing(true);
      setProgress({ stage: 'progress.start', percent: 5 });

      try {
        const res = await vectorizeWithWorker(data, sizeBytes, opts, setProgress);
        if (traceId !== traceCounter.current) return; // superseded, e.g. by an undo
        // Replacing hand edits: say where they went
        const shown = resultRef.current;
        if (shown && shown.svg !== shown.originalSvg) showToast(t('toast.editsInHistory'), 'info');
        pushHistory({ result: res, options: opts });
        measureFidelity(traceId, data, res.svg);
      } catch (err: unknown) {
        if (err instanceof VectorizationCanceledError) return;
        console.error('Vectorization error:', err);
        const message =
          err instanceof LocalizedError ? t(err.key, err.params) : err instanceof Error ? err.message : t('toast.unknownError');
        showToast(t('toast.vectorizeError', { message }), 'warning');
      } finally {
        if (traceId === traceCounter.current) {
          setIsProcessing(false);
          setProgress(null);
        }
      }
    },
    [showToast, measureFidelity, pushHistory, t]
  );

  // Settings changed by the user (not by a sample's preset or by undo) are
  // remembered: the next image of theirs starts with them
  const userChangedOptions = useRef(false);
  const setUserOptions = useCallback((update: SetStateAction<VectorOptions>) => {
    userChangedOptions.current = true;
    setOptions(update);
  }, []);
  useEffect(() => {
    if (!userChangedOptions.current) return;
    userChangedOptions.current = false;
    saveUserOptions(options);
  }, [options]);

  // Re-trace whenever the image or any setting changes. A new image traces at
  // once; setting changes are debounced so dragging a slider traces only once.
  useEffect(() => {
    if (!imageData) return;
    if (restoredOptions.current === options) {
      restoredOptions.current = null;
      return;
    }
    const isNewImage = lastTracedImage.current !== imageData;
    lastTracedImage.current = imageData;
    const timer = setTimeout(
      () => runVectorization(imageData, rasterSizeBytes, options),
      isNewImage ? 0 : RETRACE_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [imageData, rasterSizeBytes, options, runVectorization]);

  const handleRetrace = useCallback(() => {
    if (imageData) runVectorization(imageData, rasterSizeBytes, options);
  }, [imageData, rasterSizeBytes, options, runVectorization]);

  const handleApplyPreset = (preset: VectorPreset) => {
    setUserOptions((prev) => applyPreset(preset, prev));
    const nameKey =
      preset === 'sketch' && options.traceMethod === 'centerline' ? 'preset.sketch-centerline.name' : `preset.${preset}.name`;
    showToast(t('toast.presetApplied', { preset: t(nameKey as MessageKey) }), 'info');
  };

  // Image Loader: the single entry point for files, drops, pastes and samples
  const handleImageSelected = useCallback(
    (dataUrl: string, name: string, suggestedPreset?: VectorPreset) => {
      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (naturalWidth * naturalHeight)));
        const width = Math.max(1, Math.round(naturalWidth * scale));
        const height = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        if (scale < 1) {
          showToast(
            t('toast.imageDownscaled', { from: `${naturalWidth}×${naturalHeight}`, to: `${width}×${height}` }),
            'warning'
          );
        }

        if (Math.max(width, height) < SMALL_IMAGE_SIDE) {
          showToast(t('toast.smallImage', { size: `${width}×${height}` }), 'warning');
        }

        const pixels = ctx.getImageData(0, 0, width, height);
        setRasterUrl(dataUrl);
        setFileName(name);
        setImageDimensions({ width, height });
        setImageData(pixels);
        setRasterSizeBytes(Math.round((dataUrl.length * 3) / 4));
        setResult(null);
        setHistory(EMPTY_HISTORY);
        // A cut-out stays a cut-out: the setting reflects what the result will be
        const cutOut = hasTransparentBorder(pixels);
        // A sample brings its own preset; the user's images start with the
        // settings they last chose
        setOptions((prev) => ({
          ...(suggestedPreset ? applyPreset(suggestedPreset, prev) : loadUserOptions()),
          ...(cutOut ? { transparentBackground: true } : {}),
        }));
      };
      img.onerror = () => showToast(t('error.imageDecode'), 'warning');
      img.src = dataUrl;
    },
    [showToast, t]
  );

  const loadFile = useCallback(
    async (file: File, toastText?: string) => {
      try {
        const dataUrl = await readImageFile(file);
        handleImageSelected(dataUrl, file.name || t('file.pastedName'));
        if (toastText) showToast(toastText, 'success');
      } catch (err) {
        showToast(err instanceof LocalizedError ? t(err.key, err.params) : t('error.fileRead'), 'warning');
      }
    },
    [handleImageSelected, showToast, t]
  );

  const loadSample = useCallback(
    (id: string) => {
      const sample = SAMPLE_IMAGES.find((s) => s.id === id);
      if (sample) handleImageSelected(generateSampleDataUrl(sample.id), `${sample.id}.png`, sample.preset);
    },
    [handleImageSelected]
  );

  // One entry point for every drop: system files, gallery samples, web images
  const handleDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      const dropped = readDrop(dataTransfer);
      if (!dropped) return;
      if (dropped.kind === 'sample') {
        loadSample(dropped.id);
      } else if (dropped.kind === 'file') {
        loadFile(dropped.file, t('toast.imageLoaded', { name: dropped.file.name }));
      } else {
        try {
          loadFile(await fetchImage(dropped.url));
        } catch (err) {
          if (err instanceof LocalizedError) showToast(t(err.key, err.params), 'warning');
        }
      }
    },
    [loadFile, loadSample, showToast, t]
  );

  const handleNewImage = () => {
    setRasterUrl(null);
    setImageData(null);
    setImageDimensions(null);
    setResult(null);
    setHistory(EMPTY_HISTORY);
  };

  // Node & Palette Mutation Pipeline
  const applySvgUpdate = useCallback(
    (newSvg: string, commitHistory = true, toastText?: string, palette?: PaletteColor[]) => {
      if (!result) return;
      const edited: VectorResult = {
        ...result,
        svg: newSvg,
        palette: palette ?? result.palette,
        fileSizeBytes: new Blob([newSvg]).size,
        nodesCount: countAnchors(newSvg),
        shapes: result.isCenterline ? result.shapes : countShapes(newSvg),
      };
      if (commitHistory) pushHistory({ result: edited, options });
      else setResult(edited);
      if (toastText) showToast(toastText, 'info');
    },
    [result, options, pushHistory, showToast]
  );

  const restoreHistory = useCallback(
    (index: number, toastText: string) => {
      const entry = history[index];
      if (!entry) return;
      // Cancel a trace in flight: the restored step must not be replaced by it
      traceCounter.current++;
      setIsProcessing(false);
      setProgress(null);
      setHistory((h) => ({ ...h, index }));
      setResult(entry.result);
      if (entry.options !== options) {
        restoredOptions.current = entry.options;
        setOptions(entry.options);
      }
      showToast(toastText, 'info');
    },
    [history, options, showToast]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) restoreHistory(historyIndex - 1, t('toast.undo'));
  }, [historyIndex, restoreHistory, t]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1, t('toast.redo'));
  }, [historyIndex, history.length, restoreHistory, t]);

  const handleResetEdits = () => {
    if (!result) return;
    const traced = history.findLast((entry) => entry.result.originalSvg === result.originalSvg && entry.result.svg === entry.result.originalSvg);
    applySvgUpdate(result.originalSvg, true, t('toast.nodesRestored'), traced?.result.palette);
  };

  const handleSimplifyNodes = useCallback(() => {
    if (!result?.svg) return;
    const parsed = parseSvgDocument(result.svg);
    const { newDoc, removedCount, originalNodes } = simplifySvgPaths(parsed, 1.2);
    if (removedCount <= 0) {
      showToast(t('toast.alreadySimplified'), 'info');
      return;
    }
    const pct = Math.round((removedCount / originalNodes) * 100);
    applySvgUpdate(
      serializeParsedDoc(newDoc),
      true,
      t('toast.simplified', { count: removedCount, pct })
    );
  }, [result, applySvgUpdate, showToast, t]);

  // Palette Actions
  const handleReplaceColor = (oldHex: string, newHex: string) => {
    if (!result) return;
    const target = normalizeHex(oldHex);
    const palette = result.palette.map((p) => (normalizeHex(p.hex) === target ? { ...p, hex: newHex } : p));
    applySvgUpdate(replaceColorInSvg(result.svg, oldHex, newHex), true, t('toast.colorReplaced', { from: oldHex, to: newHex }), palette);
  };

  const handleRemoveColor = (targetHex: string) => {
    if (!result) return;
    const target = normalizeHex(targetHex);
    const palette = result.palette.filter((p) => normalizeHex(p.hex) !== target);
    applySvgUpdate(removeColorFromSvg(result.svg, targetHex), true, t('toast.colorRemoved', { color: targetHex }), palette);
  };

  const handleCopySvg = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.svg);
    showToast(t('toast.svgCopied'), 'success');
  }, [result, showToast, t]);

  const handleZoom = (factor: number) =>
    setZoom((z) => Math.min(24, Math.max(0.1, Math.round(z * factor * 100) / 100)));
  const handleFit = () => setFitRequest((n) => n + 1);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const modifier = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (modifier) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (key === 'c' && !window.getSelection()?.toString() && result) {
          e.preventDefault();
          handleCopySvg();
        }
        return;
      }

      if (e.altKey) return;

      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsExportOpen(false);
        setIsShortcutsOpen(false);
        setSelectedPaletteColor(null);
      } else if (key === 'w') {
        setRenderMode((prev) => (prev === 'wireframe' ? 'full' : 'wireframe'));
        showToast(t('toast.wireframeToggled'), 'info');
      } else if (key === 'e' || key === 'n') {
        setRenderMode((prev) => (prev === 'nodes' ? 'full' : 'nodes'));
        showToast(t('toast.nodeEditorToggled'), 'info');
      } else if (key === 's') {
        setViewMode((prev) => (prev === 'split' ? 'vector' : 'split'));
      } else if (key === 'd') {
        setViewMode((prev) => (prev === 'side-by-side' ? 'split' : 'side-by-side'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopySvg, showToast, result, t]);

  // Global Paste Listener (Ctrl+V / Cmd+V) to load images at any time
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) loadFile(file, t('toast.imagePasted'));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadFile, t]);

  // Global Drag and Drop Handler on Window
  const handleAppDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAppDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDrop(e.dataTransfer);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="app-root" onDragOver={handleAppDragOver} onDrop={handleAppDrop}>
      <input
        ref={fileInputRef}
        type="file"
        accept={['image/*', ...EXTRA_IMAGE_EXTENSIONS].join(',')}
        className="hidden-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = '';
        }}
      />

      {!rasterUrl ? (
        <DropZone onSampleSelected={loadSample} onFileSelected={(file) => loadFile(file)} onDrop={handleDrop} />
      ) : (
        <div className="studio">
          <TopBar
            fileName={fileName}
            imageDimensions={imageDimensions}
            canUndo={canUndo}
            canRedo={canRedo}
            canExport={!!result && !isProcessing}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onHome={handleNewImage}
            onOpen={() => fileInputRef.current?.click()}
            onExport={() => setIsExportOpen(true)}
            onHelp={() => setIsShortcutsOpen(true)}
          />

          <div className="workspace">
            <div className="canvas-area">
              <Viewport
                rasterUrl={rasterUrl}
                svgContent={result?.svg || ''}
                originalSvg={result?.originalSvg || ''}
                imageDimensions={imageDimensions}
                viewMode={viewMode}
                renderMode={renderMode}
                zoom={zoom}
                setZoom={setZoom}
                isProcessing={isProcessing}
                progress={progress}
                onSvgModified={applySvgUpdate}
                onResetEdits={handleResetEdits}
                onSimplifyNodes={handleSimplifyNodes}
                onShowToast={showToast}
                fitRequest={fitRequest}
              />
              <CanvasControls
                viewMode={viewMode}
                setViewMode={setViewMode}
                renderMode={renderMode}
                setRenderMode={setRenderMode}
                zoom={zoom}
                onZoom={handleZoom}
                onFit={handleFit}
              />
            </div>

            <Sidebar
              options={options}
              setOptions={setUserOptions}
              onApplyPreset={handleApplyPreset}
              palette={result?.palette ?? []}
              onSelectColor={setSelectedPaletteColor}
              isProcessing={isProcessing}
              onRetrace={handleRetrace}
              onSimplifyNodes={handleSimplifyNodes}
              nodesCount={result?.nodesCount}
            />
          </div>

          <MetricsBar result={result} progress={progress} />
        </div>
      )}

      {isExportOpen && result && (
        <ExportModal
          key={historyIndex}
          onClose={() => setIsExportOpen(false)}
          result={result}
          baseFileName={fileName}
          imageDimensions={imageDimensions}
          onShowToast={showToast}
        />
      )}

      {selectedPaletteColor && (
        <ColorModal
          key={selectedPaletteColor.hex}
          color={selectedPaletteColor}
          onClose={() => setSelectedPaletteColor(null)}
          onReplaceColor={handleReplaceColor}
          onRemoveColor={handleRemoveColor}
        />
      )}

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <UpdateNotice />

      {/* Outside the layout switch so errors on the landing page are shown too */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

export default App;
