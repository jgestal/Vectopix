import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteColor, VectorOptions, VectorPreset, VectorResult } from '../domain/types';
import type { RenderMode, ViewMode } from './types';
import type { Raster } from '../domain/raster/raster';
import { applyPreset, withOption, withTraceMethod } from '../domain/presets';
import { optionsForNewImage } from '../domain/images';
import { useI18n, type MessageKey } from '../i18n';
import { errorDetail } from './errors';
import { useToasts } from './hooks/useToasts';
import { useDrawing } from './hooks/useDrawing';
import { useVectorization } from './hooks/useVectorization';
import { useImageInput, type LoadedImage } from './hooks/useImageInput';
import { isTextEntry, useCommands } from './hooks/useCommands';
import { menuStateFrom, useDesktopMenu } from './hooks/useDesktopMenu';
import { useHistoryNavigation } from './hooks/useHistoryNavigation';
import { appCommandHandlers } from './appCommands';
import { useSaving } from './hooks/useSaving';
import { useWindowPresence } from './hooks/useWindowPresence';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { usePreference } from './hooks/usePreference';
import { useVectorOptions } from './hooks/useVectorOptions';
import { useDrawingEdits } from './hooks/useDrawingEdits';
import { useAutoRetrace } from './hooks/useAutoRetrace';
import { TopBar } from './components/TopBar';
import { CanvasControls } from './components/CanvasControls';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { MetricsBar } from './components/MetricsBar';
import { DropZone } from './components/DropZone';
import { ColorModal } from './components/ColorModal';
import { AppDialogs, type AppDialog } from './components/AppDialogs';
import { ToastContainer } from './components/Toast';
import { UpdateNotice } from './components/UpdateNotice';
import './App.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 24;

const VIEW_MODES: ViewMode[] = ['split', 'vector', 'raster', 'side-by-side'];

/** A preset's display name (sketch has its own for centerline tracing). */
const presetNameKey = (preset: VectorPreset, method: VectorOptions['traceMethod']): MessageKey =>
  preset === 'sketch' && method === 'centerline' ? 'preset.sketch-centerline.name' : (`preset.${preset}.name` as MessageKey);

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
  const [dialog, setDialog] = useState<AppDialog | null>(null);
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
  const { undo, redo } = useHistoryNavigation({ drawing, options, setOptions, skipTraceFor, cancelTrace: engine.cancel, showToast });

  // ── Edits ────────────────────────────────────────────────────────────────
  const edits = useDrawingEdits({ drawing, options, showToast, reportError });

  const applyUserPreset = (preset: VectorPreset) => {
    setUserOptions((prev) => applyPreset(preset, prev));
    showToast(t('toast.presetApplied', { preset: t(presetNameKey(preset, options.traceMethod)) }), 'info');
  };

  const fileName = image?.fileName ?? null;
  // Stable between renders: the canvas refits whenever this object changes
  const imageDimensions = useMemo(() => image && { width: image.width, height: image.height }, [image]);
  const saving = useSaving({ result, fileName: fileName, size: imageDimensions, showToast });
  useWindowPresence({ fileName: fileName, progress: engine.progress });
  const updateCheck = useUpdateCheck(showToast);

  const openImage = useCallback(() => fileInputRef.current?.click(), []);

  // ── Dialogs ──────────────────────────────────────────────────────────────
  const onPreferencesReset = () => {
    setViewMode('split');
    showToast(t('prefs.resetDone'), 'success');
  };

  // ── View ─────────────────────────────────────────────────────────────────
  const zoomBy = (factor: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * factor * 100) / 100)));
  const TOGGLE_NOTICE: Partial<Record<RenderMode, MessageKey>> = { wireframe: 'toast.wireframeToggled', nodes: 'toast.nodeEditorToggled' };
  const toggleRenderMode = (mode: RenderMode) => {
    setRenderMode((prev) => (prev === mode ? 'full' : mode));
    const notice = TOGGLE_NOTICE[mode];
    if (notice) showToast(t(notice), 'info');
  };

  // ── Commands: keyboard and the desktop menu bar ──────────────────────────
  useCommands(() =>
    appCommandHandlers({
      hasImage: !!image,
      hasResult: !!result && !engine.isProcessing,
      viewMode,
      newImage: closeImage,
      openImage,
      openSample: input.loadSample,
      saveSvg: saving.saveSvg,
      openExport: () => setDialog('export'),
      copySvg: edits.copySvg,
      copyPng: saving.copyPng,
      undo,
      redo,
      simplifyNodes: edits.simplifyNodes,
      restoreTrace: edits.resetEdits,
      setViewMode,
      setRenderMode,
      toggleRenderMode,
      zoomBy,
      zoomTo: setZoom,
      fit: () => setFitRequest((n) => n + 1),
      applyPreset: applyUserPreset,
      setTraceMethod: (method) => setUserOptions((prev) => withTraceMethod(prev, method)),
      toggleOption: (option) => setUserOptions((prev) => withOption(prev, option, !prev[option])),
      retrace,
      toggleShortcuts: () => setDialog((open) => (open === 'shortcuts' ? null : 'shortcuts')),
      showAbout: () => setDialog('about'),
      showPreferences: () => setDialog('preferences'),
      closeDialogs: () => {
        setSelectedColor(null);
        setDialog(null);
      },
      checkUpdates: updateCheck.check,
      openUrl: (url) => window.open(url, '_blank', 'noopener'),
      editText: (command) => isTextEntry(document.activeElement) && document.execCommand(command),
    })
  );
  useDesktopMenu(
    menuStateFrom({ hasImage: !!image, result, isProcessing: engine.isProcessing, canUndo: drawing.canUndo, canRedo: drawing.canRedo, options, viewMode, renderMode })
  );

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
            onOpen={openImage}
            onExport={() => setDialog('export')}
            onHelp={() => setDialog('shortcuts')}
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

          <MetricsBar result={result} progress={engine.progress} fileName={image.fileName} />
        </div>
      )}

      <AppDialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        result={result}
        fileName={fileName}
        imageDimensions={imageDimensions}
        historyIndex={drawing.index}
        showToast={showToast}
        onSaved={saving.markSaved}
        onPreferencesReset={onPreferencesReset}
      />

      {selectedColor && (
        <ColorModal
          key={selectedColor.hex}
          color={selectedColor}
          onClose={() => setSelectedColor(null)}
          onReplaceColor={edits.replaceColor}
          onRemoveColor={edits.deleteColor}
        />
      )}

      <UpdateNotice announced={updateCheck.announced} />
      {/* Outside the layout switch so errors on the start screen are shown too */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
