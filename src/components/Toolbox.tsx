import React from 'react';
import {
  Brush,
  Expand,
  Folder,
  Frame,
  Image,
  PenSquare,
  Pointer,
  Redo,
  Save,
  SortHorizontal,
  TextColums,
  Undo,
  ZoomIn,
  ZoomOut,
} from 'pixelarticons/react';
import type { RenderMode, ViewMode } from '../types/vector';
import { useI18n, type MessageKey } from '../i18n';

interface ToolboxProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  onFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewImage: () => void;
  onExport: () => void;
  isProcessing: boolean;
}

interface Tool {
  key: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  title: MessageKey;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 24;

/** Paint-style tool palette: a two-column grid of square bevelled buttons. */
export const Toolbox: React.FC<ToolboxProps> = ({
  viewMode,
  setViewMode,
  renderMode,
  setRenderMode,
  zoom,
  setZoom,
  onFit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewImage,
  onExport,
  isProcessing,
}) => {
  const { t } = useI18n();
  const step = (factor: number) => () =>
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * factor * 100) / 100)));

  const groups: Tool[][] = [
    [
      { key: 'new', icon: Folder, title: 'header.newTitle', onClick: onNewImage },
      { key: 'export', icon: Save, title: 'header.exportTitle', onClick: onExport, disabled: isProcessing },
      { key: 'undo', icon: Undo, title: 'header.undo', onClick: onUndo, disabled: !canUndo },
      { key: 'redo', icon: Redo, title: 'header.redo', onClick: onRedo, disabled: !canRedo },
    ],
    [
      { key: 'split', icon: SortHorizontal, title: 'header.viewSplitTitle', onClick: () => setViewMode('split'), active: viewMode === 'split' },
      { key: 'dual', icon: TextColums, title: 'header.viewSideBySideTitle', onClick: () => setViewMode('side-by-side'), active: viewMode === 'side-by-side' },
      { key: 'vector', icon: PenSquare, title: 'header.viewVectorTitle', onClick: () => setViewMode('vector'), active: viewMode === 'vector' },
      { key: 'raster', icon: Image, title: 'header.viewRasterTitle', onClick: () => setViewMode('raster'), active: viewMode === 'raster' },
    ],
    [
      { key: 'fill', icon: Brush, title: 'header.renderFullTitle', onClick: () => setRenderMode('full'), active: renderMode === 'full' },
      { key: 'outline', icon: Frame, title: 'header.renderWireframeTitle', onClick: () => setRenderMode('wireframe'), active: renderMode === 'wireframe' },
      { key: 'nodes', icon: Pointer, title: 'header.renderNodesTitle', onClick: () => setRenderMode('nodes'), active: renderMode === 'nodes' },
      { key: 'fit', icon: Expand, title: 'header.fit', onClick: onFit },
      { key: 'zoom-in', icon: ZoomIn, title: 'header.zoomIn', onClick: step(1.25) },
      { key: 'zoom-out', icon: ZoomOut, title: 'header.zoomOut', onClick: step(0.8) },
    ],
  ];

  return (
    <aside className="toolbox" aria-label={t('toolbox.label')}>
      {groups.map((tools, i) => (
        <div key={i} className="toolbox-grid">
          {tools.map(({ key, icon: Icon, title, onClick, active, disabled }) => (
            <button
              key={key}
              className={`tool-btn ${active ? 'is-active' : ''}`}
              onClick={onClick}
              disabled={disabled}
              title={t(title)}
              aria-label={t(title)}
              aria-pressed={active}
            >
              <Icon width={24} height={24} className="r-icon" />
            </button>
          ))}
        </div>
      ))}

      {/* Paint's "option box" under the tools, here showing the zoom */}
      <button className="toolbox-options" onClick={onFit} title={t('header.fit')}>
        {Math.round(zoom * 100)}%
      </button>
    </aside>
  );
};
