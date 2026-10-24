import React from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Upload,
  SplitSquareVertical,
  Eye,
  Sparkles,
  Cpu,
  MousePointer,
  Scissors,
  Undo2,
  Redo2,
  HelpCircle,
  Columns,
} from 'lucide-react';
import type { ViewMode, RenderMode, TracingEngine } from '../types/vector';

interface HeaderProps {
  imageName: string;
  imageDimensions: { width: number; height: number } | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  onResetZoom: () => void;
  engine: TracingEngine;
  onOpenExport: () => void;
  onNewImage: () => void;
  isProcessing: boolean;
  isCenterline?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  imageName,
  imageDimensions,
  viewMode,
  setViewMode,
  renderMode,
  setRenderMode,
  zoom,
  setZoom,
  onResetZoom,
  engine,
  onOpenExport,
  onNewImage,
  isProcessing,
  isCenterline,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenShortcuts,
}) => {
  return (
    <header className="studio-header">
      <div className="header-brand">
        <div className="logo-icon-wrap">
          <Layers className="logo-icon" size={20} />
          <span className="logo-glow"></span>
        </div>
        <div className="brand-text">
          <h1 className="brand-title">VectorApp</h1>
          <span className="brand-badge">PRO</span>
        </div>
      </div>

      <div className="header-meta">
        {imageDimensions && (
          <div className="image-info-pill">
            <span className="image-name" title={imageName}>
              {imageName}
            </span>
            <span className="dim-sep">•</span>
            <span className="image-dims">
              {imageDimensions.width} × {imageDimensions.height} px
            </span>
            <span className="engine-badge" title="Motor activo">
              {isCenterline ? (
                <>
                  <Scissors size={12} className="text-amber" />
                  <span>Centerline Skeleton</span>
                </>
              ) : (
                <>
                  <Cpu size={12} />
                  <span>{engine === 'vecline' ? 'Vecline Sub-Pixel' : 'ImageTracerJS'}</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="header-controls">
        {/* Undo / Redo History */}
        {(canUndo !== undefined || canRedo !== undefined) && (
          <div className="history-btn-group">
            <button
              className="btn-history"
              onClick={onUndo}
              disabled={!canUndo}
              title="Deshacer edición de nodos (Cmd/Ctrl + Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              className="btn-history"
              onClick={onRedo}
              disabled={!canRedo}
              title="Rehacer edición de nodos (Cmd/Ctrl + Shift + Z)"
            >
              <Redo2 size={15} />
            </button>
          </div>
        )}

        {/* View Mode: Split, Vector, Raster */}
        <div className="view-mode-group" role="group" aria-label="Modo de Vista">
          <button
            className={`btn-icon ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Comparador Split (Cortinilla Antes/Después) [S]"
          >
            <SplitSquareVertical size={16} />
            <span className="btn-label">Split</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'vector' ? 'active' : ''}`}
            onClick={() => setViewMode('vector')}
            title="Solo Vector"
          >
            <Sparkles size={16} />
            <span className="btn-label">Vector</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'raster' ? 'active' : ''}`}
            onClick={() => setViewMode('raster')}
            title="Solo Original Raster"
          >
            <Eye size={16} />
            <span className="btn-label">Raster</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            title="Vista Doble Panel (Original y Vector uno al lado del otro) [D]"
          >
            <Columns size={16} />
            <span className="btn-label">Doble</span>
          </button>
        </div>

        {/* Vector Display Mode: Full, Wireframe, Nodes (Editor) */}
        <div className="render-mode-group" role="group" aria-label="Estilo del Vector">
          <button
            className={`render-pill ${renderMode === 'full' ? 'active' : ''}`}
            onClick={() => setRenderMode('full')}
            title="Relleno normal con colores"
          >
            Relleno
          </button>
          <button
            className={`render-pill ${renderMode === 'wireframe' ? 'active' : ''}`}
            onClick={() => setRenderMode('wireframe')}
            title="Estructura alámbrica (Wireframe) [W]"
          >
            Contornos
          </button>
          <button
            className={`render-pill render-pill-editor ${renderMode === 'nodes' ? 'active' : ''}`}
            onClick={() => setRenderMode('nodes')}
            title="Editor de Nodos interactivo: Arrastra anclas y tiradores Bézier [E / N]"
          >
            <MousePointer size={12} />
            <span>Editor Nodos</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="zoom-group">
          <button
            className="btn-zoom"
            onClick={() => setZoom((z) => Math.max(0.1, Math.round((z - 0.25) * 100) / 100))}
            title="Alejar (Zoom Out)"
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="zoom-readout"
            onClick={onResetZoom}
            title="Restablecer zoom al 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn-zoom"
            onClick={() => setZoom((z) => Math.min(24, Math.round((z + 0.25) * 100) / 100))}
            title="Acercar (Zoom In)"
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="btn-zoom"
            onClick={onResetZoom}
            title="Ajustar a pantalla"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Help Shortcuts Button */}
        <button
          className="btn-help-shortcuts"
          onClick={onOpenShortcuts}
          title="Ver Atajos de Teclado (?)"
        >
          <HelpCircle size={16} />
        </button>

        {/* Action Buttons */}
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={onNewImage}
            title="Subir o elegir otra imagen"
          >
            <Upload size={15} />
            <span>Nueva</span>
          </button>

          <button
            className="btn-primary"
            onClick={onOpenExport}
            disabled={isProcessing}
            title="Descargar o Exportar Vector (SVG, PNG @2x/@4x, React, DXF, EPS, PDF)"
          >
            <Download size={15} />
            <span>Exportar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
