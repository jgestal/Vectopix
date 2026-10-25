import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteColor, VectorOptions, VectorPreset, VectorResult } from '../domain/types';
import type { RenderMode, ViewMode } from './types';
import type { Raster } from '../domain/raster/raster';
import { applyPreset } from '../domain/presets';
import { optionsForNewImage } from '../domain/images';
import { useI18n, type MessageKey } from '../i18n';
import { errorDetail } from './errors';
import { useToasts } from './hooks/useToasts';
import { useDrawing } from './hooks/useDrawing';
import { useVectorization } from './hooks/useVectorization';
import { useImageInput, type LoadedImage } from './hooks/useImageInput';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePreference } from './hooks/usePreference';
import { useVectorOptions } from './hooks/useVectorOptions';
import { useDrawingEdits } from './hooks/useDrawingEdits';
import { useAutoRetrace } from './hooks/useAutoRetrace';
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
import './App.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 24;

const VIEW_MODES: ViewMode[] = ['split', 'vector', 'raster', 'side-by-side'];

/** The image being traced. */
interface SourceImage {
  url: string;
  fileName: string;
  pixels: Raster;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * The studio: connects the image input, the engine, the drawing history and
 * the panels, and lays out the screen. Each concern lives in its own hook.
 */
export function App() {
  const { t } = useI18n();
  const { toasts, showToast, dismissToast, reportError } = useToasts();
  const drawing = useDrawing();
  const { options, setOptions, setUserOptions, loadUserOptions } = useVectorOptions();
  const [image, setImage] = useState<SourceImage | null>(null);

  const [{ viewMode }, setView] = usePreference('view', { viewMode: 'split' as ViewMode }, { viewMode: VIEW_MODES });
  const setViewMode = useCallback((mode: ViewMode) => setView({ viewMode: mode }), [setView]);
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<PaletteColor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { result, commit, clear } = drawing;
  const shownResult = useRef(result);
  useEffect(() => {
    shownResult.current = result;
  }, [result]);

  // ── Tracing ──────────────────────────────────────────────────────────────
  const onTraced = useCallback(
    (traced: VectorResult, tracedWith: VectorOptions) => {
      // Replacing hand edits: say where they went
      const shown = shownResult.current;
      if (shown && shown.svg !== shown.originalSvg) showToast(t('toast.editsInHistory'), 'info');
      commit({ result: traced, options: tracedWith });
    },
    [commit, showToast, t]
  );
  const onTraceError = useCallback(
    (err: unknown) => {
      const detail = errorDetail(err, t);
      if (detail) showToast(t('toast.vectorizeError', { message: detail }), 'warning');
    },
    [showToast, t]
  );
  const engine = useVectorization({ onTraced, onFidelity: drawing.attachFidelity, onError: onTraceError });
  const { run: runTrace } = engine;

  const { retrace, skipTraceFor } = useAutoRetrace(image, options, runTrace);

  // ── Images ───────────────────────────────────────────────────────────────
  const onLoaded = useCallback(
    (loaded: LoadedImage) => {
      const { dataUrl, fileName, pixels, width, height, sizeBytes } = loaded;
      setImage({ url: dataUrl, fileName, pixels, width, height, sizeBytes });
      clear();
      setOptions((current) =>
        optionsForNewImage({ current, userOptions: loadUserOptions(), samplePreset: loaded.samplePreset, isCutOut: loaded.isCutOut })
      );
    },
    [clear, loadUserOptions, setOptions]
  );
  const input = useImageInput({ onLoaded, showToast, reportError });

  const closeImage = () => {
    setImage(null);
    clear();
  };

  // ── History ──────────────────────────────────────────────────────────────
  const restoreStep = (index: number, toastKey: MessageKey) => {
    const step = drawing.restore(index);
    if (!step) return;
    engine.cancel(); // a trace in flight must not replace the restored step
    if (step.options !== options) {
      skipTraceFor(step.options);
      setOptions(step.options);
    }
    showToast(t(toastKey), 'info');
  };
  const undo = () => drawing.canUndo && restoreStep(drawing.index - 1, 'toast.undo');
  const redo = () => drawing.canRedo && restoreStep(drawing.index + 1, 'toast.redo');

  // ── Edits ────────────────────────────────────────────────────────────────
  const edits = useDrawingEdits({ drawing, options, showToast, reportError });

  const applyUserPreset = (preset: VectorPreset) => {
    setUserOptions((prev) => applyPreset(preset, prev));
    const nameKey = preset === 'sketch' && options.traceMethod === 'centerline' ? 'preset.sketch-centerline.name' : `preset.${preset}.name`;
    showToast(t('toast.presetApplied', { preset: t(nameKey as MessageKey) }), 'info');
  };

  // ── View ─────────────────────────────────────────────────────────────────
  const zoomBy = (factor: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * factor * 100) / 100)));
  const toggleRenderMode = (mode: RenderMode, toastKey: MessageKey) => {
    setRenderMode((prev) => (prev === mode ? 'full' : mode));
    showToast(t(toastKey), 'info');
  };

  useKeyboardShortcuts({
    undo,
    redo,
    // With text selected, ⌘C copies the text
    copySvg: () => (result && !window.getSelection()?.toString() ? edits.copySvg() : false),
    toggleHelp: () => setIsShortcutsOpen((open) => !open),
    closeDialogs: () => {
      setIsExportOpen(false);
      setIsShortcutsOpen(false);
      setSelectedColor(null);
    },
    toggleOutlines: () => toggleRenderMode('wireframe', 'toast.wireframeToggled'),
    toggleNodeEditor: () => toggleRenderMode('nodes', 'toast.nodeEditorToggled'),
    toggleSplit: () => setViewMode(viewMode === 'split' ? 'vector' : 'split'),
    toggleSideBySide: () => setViewMode(viewMode === 'side-by-side' ? 'split' : 'side-by-side'),
  });

  // Stable between renders: the canvas refits whenever this object changes
  const imageDimensions = useMemo(() => image && { width: image.width, height: image.height }, [image]);

  return (
    <div
      className="app-root"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        input.loadDrop(e.dataTransfer);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={input.acceptedTypes}
        className="hidden-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) input.loadFile(file);
          e.target.value = '';
        }}
      />

      {!image ? (
        <DropZone onSampleSelected={input.loadSample} onFileSelected={(file) => input.loadFile(file)} onDrop={input.loadDrop} />
      ) : (
        <div className="studio">
          <TopBar
            fileName={image.fileName}
            imageDimensions={imageDimensions}
            canUndo={drawing.canUndo}
            canRedo={drawing.canRedo}
            canExport={!!result && !engine.isProcessing}
            onUndo={undo}
            onRedo={redo}
            onHome={closeImage}
            onOpen={() => fileInputRef.current?.click()}
            onExport={() => setIsExportOpen(true)}
            onHelp={() => setIsShortcutsOpen(true)}
          />

          <div className="workspace">
            <div className="canvas-area">
              <Viewport
                rasterUrl={image.url}
                svgContent={result?.svg || ''}
                originalSvg={result?.originalSvg || ''}
                imageDimensions={imageDimensions}
                viewMode={viewMode}
                renderMode={renderMode}
                zoom={zoom}
                setZoom={setZoom}
                isProcessing={engine.isProcessing}
                progress={engine.progress}
                onSvgModified={edits.onSvgModified}
                onResetEdits={edits.resetEdits}
                onSimplifyNodes={edits.simplifyNodes}
                onShowToast={showToast}
                fitRequest={fitRequest}
              />
              <CanvasControls
                viewMode={viewMode}
                setViewMode={setViewMode}
                renderMode={renderMode}
                setRenderMode={setRenderMode}
                zoom={zoom}
                onZoom={zoomBy}
                onFit={() => setFitRequest((n) => n + 1)}
              />
            </div>

            <Sidebar
              options={options}
              setOptions={setUserOptions}
              onApplyPreset={applyUserPreset}
              palette={result?.palette ?? []}
              onSelectColor={setSelectedColor}
              isProcessing={engine.isProcessing}
              onRetrace={retrace}
              onSimplifyNodes={edits.simplifyNodes}
              nodesCount={result?.nodesCount}
            />
          </div>

          <MetricsBar result={result} progress={engine.progress} />
        </div>
      )}

      {isExportOpen && result && image && (
        <ExportModal
          key={drawing.index}
          onClose={() => setIsExportOpen(false)}
          result={result}
          baseFileName={image.fileName}
          imageDimensions={imageDimensions}
          onShowToast={showToast}
        />
      )}

      {selectedColor && (
        <ColorModal
          key={selectedColor.hex}
          color={selectedColor}
          onClose={() => setSelectedColor(null)}
          onReplaceColor={edits.replaceColor}
          onRemoveColor={edits.deleteColor}
        />
      )}

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <UpdateNotice />
      {/* Outside the layout switch so errors on the start screen are shown too */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
