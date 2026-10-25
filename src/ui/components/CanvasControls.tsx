import React from 'react';
import { Columns2, Image, Maximize, Minus, PenTool, Plus, SplitSquareHorizontal, Spline, Square, Waypoints } from 'lucide-react';
import type { RenderMode, ViewMode } from '../types';
import { useI18n, type MessageKey } from '../../i18n';

interface CanvasControlsProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
}

const VIEWS: { mode: ViewMode; label: MessageKey; title: MessageKey; icon: React.ElementType }[] = [
  { mode: 'split', label: 'header.viewSplit', title: 'header.viewSplitTitle', icon: SplitSquareHorizontal },
  { mode: 'side-by-side', label: 'header.viewSideBySide', title: 'header.viewSideBySideTitle', icon: Columns2 },
  { mode: 'vector', label: 'header.viewVector', title: 'header.viewVectorTitle', icon: PenTool },
  { mode: 'raster', label: 'header.viewRaster', title: 'header.viewRasterTitle', icon: Image },
];

const STYLES: { mode: RenderMode; label: MessageKey; title: MessageKey; icon: React.ElementType }[] = [
  { mode: 'full', label: 'header.renderFull', title: 'header.renderFullTitle', icon: Square },
  { mode: 'wireframe', label: 'header.renderWireframe', title: 'header.renderWireframeTitle', icon: Spline },
  { mode: 'nodes', label: 'header.renderNodes', title: 'header.renderNodesTitle', icon: Waypoints },
];

/** Floating controls over the canvas: what to show, how to draw it, and zoom. */
export const CanvasControls: React.FC<CanvasControlsProps> = ({
  viewMode,
  setViewMode,
  renderMode,
  setRenderMode,
  zoom,
  onZoom,
  onFit,
}) => {
  const { t } = useI18n();

  return (
    <>
      <div className="canvas-toolbar">
        <div className="segmented" role="group" aria-label={t('canvas.view')}>
          {VIEWS.map(({ mode, label, title, icon: Icon }) => (
            <button key={mode} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)} title={t(title)}>
              <Icon size={15} />
              {t(label)}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t('canvas.style')}>
          {STYLES.map(({ mode, label, title, icon: Icon }) => (
            <button key={mode} aria-pressed={renderMode === mode} onClick={() => setRenderMode(mode)} title={t(title)}>
              <Icon size={15} />
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      <div className="zoom-control">
        <button className="icon-btn" onClick={() => onZoom(0.8)} title={t('header.zoomOut')} aria-label={t('header.zoomOut')}>
          <Minus size={16} />
        </button>
        <button className="zoom-value" onClick={onFit} title={t('header.fit')}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" onClick={() => onZoom(1.25)} title={t('header.zoomIn')} aria-label={t('header.zoomIn')}>
          <Plus size={16} />
        </button>
        <button className="icon-btn" onClick={onFit} title={t('header.fit')} aria-label={t('header.fit')}>
          <Maximize size={16} />
        </button>
      </div>
    </>
  );
};
