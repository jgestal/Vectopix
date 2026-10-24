import React from 'react';
import {
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
import { useI18n } from '../i18n';
import { LanguageSelect } from './LanguageSelect';

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
  const { t } = useI18n();

  return (
    <header className="studio-header">
      <div className="header-brand">
        <img className="logo-icon-img" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
        <div className="brand-text">
          <h1 className="brand-title">Vectopix</h1>
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
            <span className="engine-badge" title={t('header.activeEngine')}>
              {isCenterline ? (
                <>
                  <Scissors size={12} className="text-amber" />
                  <span>{t('header.engineCenterline')}</span>
                </>
              ) : (
                <>
                  <Cpu size={12} />
                  <span>{t(engine === 'vecline' ? 'header.engineVecline' : 'header.engineImageTracer')}</span>
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
              title={t('header.undo')}
            >
              <Undo2 size={15} />
            </button>
            <button
              className="btn-history"
              onClick={onRedo}
              disabled={!canRedo}
              title={t('header.redo')}
            >
              <Redo2 size={15} />
            </button>
          </div>
        )}

        {/* View Mode: Split, Vector, Raster */}
        <div className="view-mode-group" role="group" aria-label={t('header.viewMode')}>
          <button
            className={`btn-icon ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title={t('header.viewSplitTitle')}
          >
            <SplitSquareVertical size={16} />
            <span className="btn-label">{t('header.viewSplit')}</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'vector' ? 'active' : ''}`}
            onClick={() => setViewMode('vector')}
            title={t('header.viewVectorTitle')}
          >
            <Sparkles size={16} />
            <span className="btn-label">{t('header.viewVector')}</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'raster' ? 'active' : ''}`}
            onClick={() => setViewMode('raster')}
            title={t('header.viewRasterTitle')}
          >
            <Eye size={16} />
            <span className="btn-label">{t('header.viewRaster')}</span>
          </button>
          <button
            className={`btn-icon ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            title={t('header.viewSideBySideTitle')}
          >
            <Columns size={16} />
            <span className="btn-label">{t('header.viewSideBySide')}</span>
          </button>
        </div>

        {/* Vector Display Mode: Full, Wireframe, Nodes (Editor) */}
        <div className="render-mode-group" role="group" aria-label={t('header.renderStyle')}>
          <button
            className={`render-pill ${renderMode === 'full' ? 'active' : ''}`}
            onClick={() => setRenderMode('full')}
            title={t('header.renderFullTitle')}
          >
            {t('header.renderFull')}
          </button>
          <button
            className={`render-pill ${renderMode === 'wireframe' ? 'active' : ''}`}
            onClick={() => setRenderMode('wireframe')}
            title={t('header.renderWireframeTitle')}
          >
            {t('header.renderWireframe')}
          </button>
          <button
            className={`render-pill render-pill-editor ${renderMode === 'nodes' ? 'active' : ''}`}
            onClick={() => setRenderMode('nodes')}
            title={t('header.renderNodesTitle')}
          >
            <MousePointer size={12} />
            <span>{t('header.renderNodes')}</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="zoom-group">
          <button
            className="btn-zoom"
            onClick={() => setZoom((z) => Math.max(0.1, Math.round((z - 0.25) * 100) / 100))}
            title={t('header.zoomOut')}
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="zoom-readout"
            onClick={onResetZoom}
            title={t('header.zoomReset')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn-zoom"
            onClick={() => setZoom((z) => Math.min(24, Math.round((z + 0.25) * 100) / 100))}
            title={t('header.zoomIn')}
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="btn-zoom"
            onClick={onResetZoom}
            title={t('header.fit')}
          >
            <Maximize2 size={15} />
          </button>
        </div>

        <LanguageSelect compact />

        {/* Help Shortcuts Button */}
        <button
          className="btn-help-shortcuts"
          onClick={onOpenShortcuts}
          title={t('header.shortcuts')}
        >
          <HelpCircle size={16} />
        </button>

        {/* Action Buttons */}
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={onNewImage}
            title={t('header.newTitle')}
          >
            <Upload size={15} />
            <span>{t('header.new')}</span>
          </button>

          <button
            className="btn-primary"
            onClick={onOpenExport}
            disabled={isProcessing}
            title={t('header.exportTitle')}
          >
            <Download size={15} />
            <span>{t('header.export')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
