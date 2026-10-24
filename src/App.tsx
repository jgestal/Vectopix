import { useState, useCallback, useEffect, useRef } from 'react';
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
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { MetricsBar } from './components/MetricsBar';
import { ExportModal } from './components/ExportModal';
import { DropZone } from './components/DropZone';
import { ColorModal } from './components/ColorModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/Toast';
import { replaceColorInSvg, removeColorFromSvg, normalizeHex } from './utils/paletteUtils';
import { parseSvgDocument, serializeParsedDoc, simplifySvgPaths } from './utils/pathParser';
import { rasterizeForComparison } from './utils/fidelity';
import { readImageFile } from './utils/imageLoading';
import { DEFAULT_OPTIONS, applyPreset } from './config/presets';
import './App.css';

/** Larger images are downscaled before tracing to keep the worker responsive. */
const MAX_PIXELS = 4_000_000;

/** Delay before re-tracing after a setting changes, so sliders don't flood the worker. */
const RETRACE_DEBOUNCE_MS = 400;

interface HistoryEntry {
  svg: string;
  palette: PaletteColor[];
}

function countNodes(svg: string): number {
  return (svg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function App() {
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('vector-image.png');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [rasterSizeBytes, setRasterSizeBytes] = useState<number>(0);

  const [options, setOptions] = useState<VectorOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<VectorResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [zoom, setZoom] = useState<number>(1);
  const [fitRequest, setFitRequest] = useState<number>(0);

  // Modals & Floating UI State
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [selectedPaletteColor, setSelectedPaletteColor] = useState<PaletteColor | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // History stack for node & palette modifications
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const toastIdCounter = useRef(0);
  const traceCounter = useRef(0);
  const lastTracedImage = useRef<ImageData | null>(null);

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
      setResult((prev) => (prev && prev.originalSvg === svg ? { ...prev, ssim } : prev));
    } catch {
      // Fidelity is informative only; a failed measurement just isn't shown
    }
  }, []);

  // Core Vectorization Runner
  const runVectorization = useCallback(
    async (data: ImageData, sizeBytes: number, opts: VectorOptions) => {
      const traceId = ++traceCounter.current;
      setIsProcessing(true);
      setProgress({ stage: 'Iniciando Web Worker...', percent: 5 });

      try {
        const res = await vectorizeWithWorker(data, sizeBytes, opts, setProgress);
        setResult(res);
        setHistory([{ svg: res.svg, palette: res.palette }]);
        setHistoryIndex(0);
        measureFidelity(traceId, data, res.svg);
      } catch (err: unknown) {
        if (err instanceof VectorizationCanceledError) return;
        console.error('Vectorization error:', err);
        showToast(
          `Error al vectorizar: ${err instanceof Error ? err.message : 'error desconocido'}`,
          'warning'
        );
      } finally {
        if (traceId === traceCounter.current) {
          setIsProcessing(false);
          setProgress(null);
        }
      }
    },
    [showToast, measureFidelity]
  );

  // Re-trace whenever the image or any setting changes. A new image traces at
  // once; setting changes are debounced so dragging a slider traces only once.
  useEffect(() => {
    if (!imageData) return;
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
    setOptions((prev) => applyPreset(preset, prev));
    showToast(`Preset "${preset}" aplicado`, 'info');
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
            `Imagen reducida de ${naturalWidth}×${naturalHeight} a ${width}×${height} px para vectorizarla con fluidez`,
            'warning'
          );
        }

        setRasterUrl(dataUrl);
        setFileName(name);
        setImageDimensions({ width, height });
        setImageData(ctx.getImageData(0, 0, width, height));
        setRasterSizeBytes(Math.round((dataUrl.length * 3) / 4));
        setResult(null);
        setHistory([]);
        setHistoryIndex(-1);
        setOptions((prev) => applyPreset(suggestedPreset || 'logo', prev));
      };
      img.onerror = () => showToast('No se pudo leer la imagen', 'warning');
      img.src = dataUrl;
    },
    [showToast]
  );

  const loadFile = useCallback(
    async (file: File, toastText?: string) => {
      try {
        const dataUrl = await readImageFile(file);
        handleImageSelected(dataUrl, file.name || 'imagen-pegada.png');
        if (toastText) showToast(toastText, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'No se pudo leer el archivo', 'warning');
      }
    },
    [handleImageSelected, showToast]
  );

  const handleNewImage = () => {
    setRasterUrl(null);
    setImageData(null);
    setImageDimensions(null);
    setResult(null);
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Node & Palette Mutation Pipeline
  const applySvgUpdate = useCallback(
    (newSvg: string, commitHistory = true, toastText?: string, palette?: PaletteColor[]) => {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              svg: newSvg,
              palette: palette ?? prev.palette,
              fileSizeBytes: new Blob([newSvg]).size,
              nodesCount: countNodes(newSvg),
            }
          : null
      );

      if (commitHistory && result) {
        const entry = { svg: newSvg, palette: palette ?? result.palette };
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), entry]);
        setHistoryIndex(historyIndex + 1);
      }

      if (toastText) showToast(toastText, 'info');
    },
    [historyIndex, result, showToast]
  );

  const restoreHistory = useCallback(
    (index: number, toastText: string) => {
      const entry = history[index];
      if (!entry) return;
      setHistoryIndex(index);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              svg: entry.svg,
              palette: entry.palette,
              fileSizeBytes: new Blob([entry.svg]).size,
              nodesCount: countNodes(entry.svg),
            }
          : null
      );
      showToast(toastText, 'info');
    },
    [history, showToast]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) restoreHistory(historyIndex - 1, 'Deshacer realizado');
  }, [historyIndex, restoreHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1, 'Rehacer realizado');
  }, [historyIndex, history.length, restoreHistory]);

  const handleResetEdits = () => {
    if (!result) return;
    applySvgUpdate(result.originalSvg, true, 'Nodos restaurados al estado original', history[0]?.palette);
  };

  const handleSimplifyNodes = useCallback(() => {
    if (!result?.svg) return;
    const parsed = parseSvgDocument(result.svg);
    const { newDoc, removedCount, originalNodes } = simplifySvgPaths(parsed, 1.2);
    if (removedCount <= 0) {
      showToast('Los trazados ya tienen la cantidad mínima de nodos optimizada', 'info');
      return;
    }
    const pct = Math.round((removedCount / originalNodes) * 100);
    applySvgUpdate(
      serializeParsedDoc(newDoc),
      true,
      `Trazados simplificados: ${removedCount} nodos eliminados (-${pct}%)`
    );
  }, [result, applySvgUpdate, showToast]);

  // Palette Actions
  const handleReplaceColor = (oldHex: string, newHex: string) => {
    if (!result) return;
    const target = normalizeHex(oldHex);
    const palette = result.palette.map((p) => (normalizeHex(p.hex) === target ? { ...p, hex: newHex } : p));
    applySvgUpdate(replaceColorInSvg(result.svg, oldHex, newHex), true, `Color ${oldHex} cambiado a ${newHex}`, palette);
  };

  const handleRemoveColor = (targetHex: string) => {
    if (!result) return;
    const target = normalizeHex(targetHex);
    const palette = result.palette.filter((p) => normalizeHex(p.hex) !== target);
    applySvgUpdate(removeColorFromSvg(result.svg, targetHex), true, `Color ${targetHex} hecho transparente`, palette);
  };

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
          navigator.clipboard.writeText(result.svg);
          showToast('Código SVG copiado al portapapeles', 'success');
        }
        return;
      }

      if (e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsExportOpen(false);
        setIsShortcutsOpen(false);
        setSelectedPaletteColor(null);
      } else if (key === 'w') {
        setRenderMode((prev) => (prev === 'wireframe' ? 'full' : 'wireframe'));
        showToast('Modo Contornos alternado', 'info');
      } else if (key === 'e' || key === 'n') {
        setRenderMode((prev) => (prev === 'nodes' ? 'full' : 'nodes'));
        showToast('Editor de Nodos alternado', 'info');
      } else if (key === 's') {
        setViewMode((prev) => (prev === 'split' ? 'vector' : 'split'));
      } else if (key === 'd') {
        setViewMode((prev) => (prev === 'side-by-side' ? 'split' : 'side-by-side'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, showToast, result]);

  // Global Paste Listener (Ctrl+V / Cmd+V) to load images at any time
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) loadFile(file, 'Imagen cargada desde portapapeles');
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadFile]);

  // Global Drag and Drop Handler on Window
  const handleAppDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAppDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file, `Imagen ${file.name} cargada`);
  };

  return (
    <div className="studio-app-root" onDragOver={handleAppDragOver} onDrop={handleAppDrop}>
      {!rasterUrl ? (
        <DropZone onImageSelected={handleImageSelected} onFileSelected={(file) => loadFile(file)} />
      ) : (
        <div className="studio-layout">
          {/* Top Studio Header */}
          <Header
            imageName={fileName}
            imageDimensions={imageDimensions}
            viewMode={viewMode}
            setViewMode={setViewMode}
            renderMode={renderMode}
            setRenderMode={setRenderMode}
            zoom={zoom}
            setZoom={setZoom}
            onResetZoom={() => setFitRequest((n) => n + 1)}
            engine={options.engine}
            onOpenExport={() => setIsExportOpen(true)}
            onNewImage={handleNewImage}
            isProcessing={isProcessing}
            isCenterline={options.traceMethod === 'centerline'}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
          />

          {/* Main Workspace: Sidebar + Viewport */}
          <div className="studio-main-body">
            <Sidebar
              options={options}
              setOptions={setOptions}
              onApplyPreset={handleApplyPreset}
              palette={result?.palette || []}
              isProcessing={isProcessing}
              onRetrace={handleRetrace}
              isCenterline={options.traceMethod === 'centerline'}
              onSelectColor={(col) => setSelectedPaletteColor(col)}
              onSimplifyNodes={handleSimplifyNodes}
              nodesCount={result?.nodesCount}
            />

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
              isCenterline={options.traceMethod === 'centerline'}
            />
          </div>

          {/* Bottom Metrics Bar */}
          <MetricsBar result={result} />

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

          <ToastContainer
            toasts={toasts}
            onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
          />
        </div>
      )}
    </div>
  );
}

export default App;
