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
import { vectorizeWithWorker } from './services/vectorWorkerClient';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { MetricsBar } from './components/MetricsBar';
import { ExportModal } from './components/ExportModal';
import { DropZone } from './components/DropZone';
import { ColorModal } from './components/ColorModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/Toast';
import { replaceColorInSvg, removeColorFromSvg } from './utils/paletteUtils';
import {
  parseSvgDocument,
  serializeParsedDoc,
  simplifySvgPaths,
} from './utils/pathParser';
import './App.css';

const DEFAULT_OPTIONS: VectorOptions = {
  engine: 'vecline',
  traceMethod: 'outline',
  preset: 'logo',
  colors: 12,
  subpixel: true,
  tolerance: 0.75,
  fitError: 0.75,
  cornerAngle: 75,
  minArea: 8,
  refineIterations: 6,
  smooth: 1,
  background: true,
  primitives: false,
  gradients: false,
  contrast: 0,
  denoise: 0,
  centerlineStrokeWidth: 2,
  centerlineStrokeColor: '#000000',
  centerlineAdaptive: false,
  centerlineBlackOnWhite: true,
  centerlineLineCap: 'round',
  centerlineLineJoin: 'round',
};

export function App() {
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('vector-image.png');
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [rasterSizeBytes, setRasterSizeBytes] = useState<number>(0);

  const [options, setOptions] = useState<VectorOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<VectorResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [zoom, setZoom] = useState<number>(1);

  // Modals & Floating UI State
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [selectedPaletteColor, setSelectedPaletteColor] = useState<PaletteColor | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // History stack for node & palette modifications
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const toastIdCounter = useRef(0);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `toast_${++toastIdCounter.current}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  // Core Vectorization Runner
  const runVectorization = useCallback(
    async (data: ImageData, sizeBytes: number, opts: VectorOptions) => {
      setIsProcessing(true);
      setProgress({ stage: 'Iniciando Web Worker...', percent: 5 });

      try {
        const res = await vectorizeWithWorker(data, sizeBytes, opts, (prog) => {
          setProgress(prog);
        });
        setResult(res);
        setHistory([res.svg]);
        setHistoryIndex(0);
        showToast('Vectorización completada', 'success');
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Canceled')) {
          return;
        }
        console.error('Vectorization error:', err);
        showToast('Error al vectorizar imagen', 'warning');
      } finally {
        setIsProcessing(false);
        setProgress(null);
      }
    },
    [showToast]
  );

  // Trigger vectorization on options change
  const handleRetrace = useCallback(() => {
    if (imageData) {
      runVectorization(imageData, rasterSizeBytes, options);
    }
  }, [imageData, rasterSizeBytes, options, runVectorization]);

  // Handle Preset Selection
  const handleApplyPreset = (preset: VectorPreset) => {
    let presetOptions: Partial<VectorOptions> = {};

    switch (preset) {
      case 'centerline-sketch':
        presetOptions = {
          traceMethod: 'centerline',
          centerlineStrokeWidth: 2,
          centerlineStrokeColor: '#000000',
          centerlineAdaptive: true,
          centerlineBlackOnWhite: true,
        };
        break;
      case 'logo':
        presetOptions = {
          traceMethod: 'outline',
          colors: 8,
          subpixel: true,
          tolerance: 0.75,
          fitError: 0.75,
          cornerAngle: 75,
          minArea: 8,
          smooth: 1,
          refineIterations: 6,
          background: true,
          primitives: false,
          gradients: false,
        };
        break;
      case 'flat-art':
        presetOptions = {
          traceMethod: 'outline',
          colors: 16,
          subpixel: true,
          tolerance: 0.85,
          fitError: 0.85,
          cornerAngle: 80,
          minArea: 6,
          smooth: 1,
          refineIterations: 6,
          background: true,
          primitives: false,
          gradients: false,
        };
        break;
      case 'photo':
        presetOptions = {
          traceMethod: 'outline',
          colors: 32,
          subpixel: true,
          tolerance: 0.6,
          fitError: 0.5,
          cornerAngle: 90,
          minArea: 2,
          background: true,
          primitives: false,
          gradients: true,
        };
        break;
      case 'sketch':
        if (options.traceMethod === 'centerline') {
          presetOptions = {
            traceMethod: 'centerline',
            centerlineStrokeWidth: 1.5,
            centerlineStrokeColor: '#000000',
            centerlineAdaptive: false,
            centerlineBlackOnWhite: true,
          };
        } else {
          presetOptions = {
            traceMethod: 'outline',
            colors: 2,
            subpixel: true,
            tolerance: 0.3,
            fitError: 0.3,
            cornerAngle: 70,
            minArea: 6,
            background: false,
            primitives: false,
            gradients: false,
          };
        }
        break;
      case 'pixel-art':
        presetOptions = {
          traceMethod: 'outline',
          colors: 16,
          subpixel: false,
          tolerance: 0.05,
          fitError: 0.05,
          cornerAngle: 90,
          minArea: 0,
          background: true,
          primitives: false,
          gradients: false,
        };
        break;
      default:
        break;
    }

    const updated: VectorOptions = {
      ...options,
      ...presetOptions,
      preset,
    };

    setOptions(updated);
    showToast(`Preset "${preset}" aplicado`, 'info');
    if (imageData) {
      runVectorization(imageData, rasterSizeBytes, updated);
    }
  };

  // Image Loader
  const handleImageSelected = (
    dataUrl: string,
    name: string,
    suggestedPreset?: VectorPreset
  ) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const rawImageData = ctx.getImageData(0, 0, width, height);
      const approxSize = Math.round((dataUrl.length * 3) / 4);

      setRasterUrl(dataUrl);
      setFileName(name);
      setImageDimensions({ width, height });
      setImageData(rawImageData);
      setRasterSizeBytes(approxSize);
      setZoom(1);

      const targetPreset = suggestedPreset || 'logo';
      let presetOpts: Partial<VectorOptions> = {};
      if (targetPreset === 'pixel-art') {
        presetOpts = {
          traceMethod: 'outline',
          colors: 16,
          subpixel: false,
          tolerance: 0.05,
          fitError: 0.05,
          minArea: 0,
        };
      } else if (targetPreset === 'sketch') {
        presetOpts = {
          traceMethod: 'outline',
          colors: 2,
          background: false,
          subpixel: true,
        };
      } else if (targetPreset === 'photo') {
        presetOpts = {
          traceMethod: 'outline',
          colors: 32,
          gradients: true,
          subpixel: true,
        };
      } else if (targetPreset === 'centerline-sketch') {
        presetOpts = {
          traceMethod: 'centerline',
          centerlineStrokeWidth: 2,
          centerlineAdaptive: true,
        };
      }

      const activeOpts: VectorOptions = {
        ...options,
        ...presetOpts,
        preset: targetPreset,
      };

      setOptions(activeOpts);
      runVectorization(rawImageData, approxSize, activeOpts);
    };

    img.src = dataUrl;
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

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
    (newSvg: string, commitHistory = true, toastText?: string) => {
      if (!result) return;
      const fileSizeBytes = new Blob([newSvg]).size;
      const nodesCount = (newSvg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;

      if (commitHistory) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newSvg);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              svg: newSvg,
              fileSizeBytes,
              nodesCount,
            }
          : null
      );

      if (toastText) {
        showToast(toastText, 'info');
      }
    },
    [history, historyIndex, result, showToast]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && result) {
      const prevSvg = history[historyIndex - 1];
      const fileSizeBytes = new Blob([prevSvg]).size;
      const nodesCount = (prevSvg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
      setHistoryIndex(historyIndex - 1);
      setResult({
        ...result,
        svg: prevSvg,
        fileSizeBytes,
        nodesCount,
      });
      showToast('Deshacer realizado', 'info');
    }
  }, [history, historyIndex, result, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && result) {
      const nextSvg = history[historyIndex + 1];
      const fileSizeBytes = new Blob([nextSvg]).size;
      const nodesCount = (nextSvg.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;
      setHistoryIndex(historyIndex + 1);
      setResult({
        ...result,
        svg: nextSvg,
        fileSizeBytes,
        nodesCount,
      });
      showToast('Rehacer realizado', 'info');
    }
  }, [history, historyIndex, result, showToast]);

  const handleResetEdits = () => {
    if (!result) return;
    applySvgUpdate(result.originalSvg, true, 'Nodos restaurados al estado original');
  };

  const handleSimplifyNodes = useCallback(() => {
    if (!result?.svg) return;
    const parsed = parseSvgDocument(result.svg);
    const { newDoc, removedCount, originalNodes } = simplifySvgPaths(parsed, 1.2);
    if (removedCount <= 0) {
      showToast('Los trazados ya tienen la cantidad mínima de nodos optimizada', 'info');
      return;
    }
    const newSvg = serializeParsedDoc(newDoc);
    const pct = Math.round((removedCount / originalNodes) * 100);
    applySvgUpdate(
      newSvg,
      true,
      `Trazados simplificados: ${removedCount} nodos eliminados (-${pct}%)`
    );
  }, [result, applySvgUpdate, showToast]);

  // Palette Actions
  const handleReplaceColor = (oldHex: string, newHex: string) => {
    if (!result) return;
    const newSvg = replaceColorInSvg(result.svg, oldHex, newHex);
    // Update active palette swatch
    const updatedPalette = result.palette.map((p) =>
      p.hex.toLowerCase() === oldHex.toLowerCase() ? { ...p, hex: newHex } : p
    );
    setResult((prev) => (prev ? { ...prev, palette: updatedPalette } : null));
    applySvgUpdate(newSvg, true, `Color ${oldHex} cambiado a ${newHex}`);
  };

  const handleRemoveColor = (targetHex: string) => {
    if (!result) return;
    const newSvg = removeColorFromSvg(result.svg, targetHex);
    const updatedPalette = result.palette.filter(
      (p) => p.hex.toLowerCase() !== targetHex.toLowerCase()
    );
    setResult((prev) => (prev ? { ...prev, palette: updatedPalette } : null));
    applySvgUpdate(newSvg, true, `Color ${targetHex} hecho transparente`);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (modifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (modifier && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString() && result) {
        e.preventDefault();
        navigator.clipboard.writeText(result.svg);
        showToast('Código SVG copiado al portapapeles', 'success');
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsExportOpen(false);
        setIsShortcutsOpen(false);
        setSelectedPaletteColor(null);
        return;
      }

      if (e.key.toLowerCase() === 'w') {
        setRenderMode((prev) => (prev === 'wireframe' ? 'full' : 'wireframe'));
        showToast('Modo Contornos alternado', 'info');
        return;
      }

      if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'n') {
        setRenderMode((prev) => (prev === 'nodes' ? 'full' : 'nodes'));
        showToast('Editor de Nodos alternado', 'info');
        return;
      }

      if (e.key.toLowerCase() === 's') {
        setViewMode((prev) => (prev === 'split' ? 'vector' : 'split'));
        return;
      }

      if (e.key.toLowerCase() === 'd') {
        setViewMode((prev) => (prev === 'side-by-side' ? 'split' : 'side-by-side'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, showToast, result]);

  // Global Paste Listener (Ctrl+V / Cmd+V) to load images at any time
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const res = ev.target?.result as string;
              if (res) {
                handleImageSelected(res, file.name || 'imagen-pegada.png');
                showToast('Imagen cargada desde portapapeles', 'success');
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showToast]);

  // Global Drag and Drop Handler on Window
  const handleAppDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAppDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const res = ev.target?.result as string;
          if (res) {
            handleImageSelected(res, file.name);
            showToast(`Imagen ${file.name} cargada`, 'success');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div
      className="studio-app-root"
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
    >
      {!rasterUrl ? (
        <DropZone onImageSelected={handleImageSelected} />
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
            onResetZoom={handleResetZoom}
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
              onSvgModified={(newSvg, commitHistory, toastText) =>
                applySvgUpdate(newSvg, commitHistory, toastText)
              }
              onResetEdits={handleResetEdits}
              isCenterline={options.traceMethod === 'centerline'}
            />
          </div>

          {/* Bottom Metrics Bar */}
          <MetricsBar result={result} />

          {/* Export Dialog */}
          <ExportModal
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            result={result}
            baseFileName={fileName}
            imageDimensions={imageDimensions}
            onShowToast={showToast}
          />

          {/* Color Management Dialog */}
          <ColorModal
            color={selectedPaletteColor}
            onClose={() => setSelectedPaletteColor(null)}
            onReplaceColor={handleReplaceColor}
            onRemoveColor={handleRemoveColor}
          />

          {/* Shortcuts Modal */}
          <ShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />

          {/* Floating Toasts */}
          <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        </div>
      )}
    </div>
  );
}

export default App;
