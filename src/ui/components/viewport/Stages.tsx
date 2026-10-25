import type { ReactNode } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import type { RenderMode, ViewMode } from '../../types';
import { useI18n } from '../../../i18n';
import { RasterImage } from './ViewportParts';

/** Height of the title bar on top of each side-by-side pane (see .sbs-pane-badge). */
const SBS_TITLE_HEIGHT = 28;

interface StageProps {
  rasterUrl: string;
  svgContent: string;
  width: number;
  height: number;
  zoom: number;
  pan: { x: number; y: number };
  renderMode: RenderMode;
  /** The node editor overlay, when it is on. */
  nodeHandles: ReactNode;
}

const VectorDrawing = ({ svg }: { svg: string }) => <div className="svg-render-container" dangerouslySetInnerHTML={{ __html: svg }} />;

/** Original and vector next to each other, each with a title. */
export function SideBySideStage({ rasterUrl, svgContent, width, height, zoom, pan, renderMode, nodeHandles, shapeCount }: StageProps & { shapeCount: number }) {
  const { t } = useI18n();
  const [w, h] = [width * zoom, height * zoom];
  const pane = { width: `${w}px`, height: `${h + SBS_TITLE_HEIGHT}px` };
  return (
    <div className="artboard-stage side-by-side-stage" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`, width: `${w * 2 + 32}px`, height: `${h + 36}px` }}>
      <div className="sbs-pane" style={pane}>
        <div className="sbs-pane-badge raster-badge">
          <span>{t('viewport.rasterBadge', { width, height })}</span>
        </div>
        <div className="sbs-pane-content">
          <RasterImage url={rasterUrl} width={width} height={height} zoom={zoom} latticeId="pixelGridSbs" />
        </div>
      </div>
      <div className="sbs-pane" style={pane}>
        <div className="sbs-pane-badge vector-badge">
          <span>{t('viewport.vectorBadge', { count: shapeCount })}</span>
        </div>
        <div className={`sbs-pane-content vector-layer mode-${renderMode}`}>
          <VectorDrawing svg={svgContent} />
          {nodeHandles}
        </div>
      </div>
    </div>
  );
}

/** Clip to the part left (or right) of the split line, at `pos` %. */
const clipSide = (side: 'left' | 'right', pos: number) =>
  side === 'left' ? `polygon(0% 0%, ${pos}% 0%, ${pos}% 100%, 0% 100%)` : `polygon(${pos}% 0%, 100% 0%, 100% 100%, ${pos}% 100%)`;

/** One artboard: the original and the vector overlaid, split by a draggable line, or either alone. */
export function SplitStage({
  rasterUrl,
  svgContent,
  width,
  height,
  zoom,
  pan,
  renderMode,
  nodeHandles,
  viewMode,
  splitPos,
  onSplitDragStart,
}: StageProps & { viewMode: ViewMode; splitPos: number; onSplitDragStart: () => void }) {
  const { t } = useI18n();
  const split = viewMode === 'split';
  return (
    <div className="artboard-stage" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`, width: `${width * zoom}px`, height: `${height * zoom}px` }}>
      {viewMode !== 'vector' && (
        <div className="artboard-layer raster-layer" style={{ clipPath: split ? clipSide('left', splitPos) : undefined }}>
          <RasterImage url={rasterUrl} width={width} height={height} zoom={zoom} latticeId="pixelGrid" />
        </div>
      )}
      {viewMode !== 'raster' && (
        <div className={`artboard-layer vector-layer mode-${renderMode}`} style={{ clipPath: split ? clipSide('right', splitPos) : undefined }}>
          <VectorDrawing svg={svgContent} />
        </div>
      )}
      {nodeHandles}
      {split && (
        <div
          className="split-slider-line"
          style={{ left: `${splitPos}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSplitDragStart();
          }}
        >
          <div className="split-handle">
            <ChevronsLeftRight size={16} aria-label={t('viewport.splitTag')} />
          </div>
        </div>
      )}
    </div>
  );
}
