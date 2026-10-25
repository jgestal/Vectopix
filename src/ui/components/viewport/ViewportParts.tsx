import React from 'react';
import { CornerUpRight, Plus, RotateCcw, Sparkles, Spline, Trash2 } from 'lucide-react';
import type { InteractiveNode } from '../../../domain/geometry/nodeEditing';
import type { WorkerProgress } from '../../../domain/types';
import { useI18n } from '../../../i18n';

/** From this zoom pixels are drawn as crisp squares; from LATTICE_ZOOM their grid is outlined. */
const PIXELATED_ZOOM = 4;
const LATTICE_ZOOM = 6;

/** The source image at the current zoom, with the pixel grid when zoomed far in. */
export function RasterImage({ url, width, height, zoom, latticeId }: { url: string; width: number; height: number; zoom: number; latticeId: string }) {
  const { t } = useI18n();
  const [scaledWidth, scaledHeight] = [width * zoom, height * zoom];
  return (
    <>
      <img
        src={url}
        alt={t('viewport.rasterAlt')}
        width={scaledWidth}
        height={scaledHeight}
        className={`raster-img ${zoom >= PIXELATED_ZOOM ? 'pixelated' : ''}`}
        draggable={false}
      />
      {zoom >= LATTICE_ZOOM && (
        <svg className="pixel-lattice-overlay" width={scaledWidth} height={scaledHeight} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <pattern id={latticeId} width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth={0.05} />
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#${latticeId})`} />
        </svg>
      )}
    </>
  );
}

const isHandle = (n: InteractiveNode) => n.nodeType === 'cp1' || n.nodeType === 'cp2';

interface NodeHandlesProps {
  overlayRef: React.Ref<SVGSVGElement>;
  nodes: InteractiveNode[];
  selectedNodeId: string | null;
  width: number;
  height: number;
  zoom: number;
  onNodeMouseDown: (e: React.MouseEvent, node: InteractiveNode) => void;
}

/** The node editor overlay: anchors, Bézier handles and the lines joining them. */
export function NodeHandles({ overlayRef, nodes, selectedNodeId, width, height, zoom, onNodeMouseDown }: NodeHandlesProps) {
  // Handles keep a steady on-screen size whatever the zoom
  const radius = Math.max(3, Math.min(8, 5.5 / Math.sqrt(zoom)));
  const stroke = Math.max(1, 1.5 / Math.sqrt(zoom));
  const dash = 3 / Math.sqrt(zoom);
  const handles = nodes.filter(isHandle);
  return (
    <svg ref={overlayRef} className="artboard-layer node-editor-overlay" viewBox={`0 0 ${width} ${height}`} width={width * zoom} height={height * zoom}>
      {handles.map(
        (cp) =>
          cp.connectedAnchor && (
            <line
              key={`line_${cp.id}`}
              x1={cp.connectedAnchor.x}
              y1={cp.connectedAnchor.y}
              x2={cp.x}
              y2={cp.y}
              stroke="var(--magenta)"
              strokeWidth={1 / Math.sqrt(zoom)}
              strokeDasharray={`${dash},${dash}`}
            />
          )
      )}
      {handles.map((cp) => (
        <circle
          key={cp.id}
          cx={cp.x}
          cy={cp.y}
          r={radius * 0.75}
          fill="var(--magenta)"
          stroke="#ffffff"
          strokeWidth={stroke}
          className="interactive-cp-handle"
          onMouseDown={(e) => onNodeMouseDown(e, cp)}
        />
      ))}
      {nodes
        .filter((n) => n.nodeType === 'anchor')
        .map((anchor) => {
          const selected = selectedNodeId === anchor.id;
          return (
            <g key={anchor.id} className="anchor-point-group">
              {selected && <circle cx={anchor.x} cy={anchor.y} r={radius * 1.8} fill="var(--magenta-soft)" stroke="var(--magenta)" strokeWidth={stroke} />}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={radius}
                fill={selected ? 'var(--magenta)' : '#ffffff'}
                stroke={selected ? '#ffffff' : 'var(--magenta)'}
                strokeWidth={stroke}
                className="interactive-anchor-handle"
                onMouseDown={(e) => onNodeMouseDown(e, anchor)}
              />
            </g>
          );
        })}
    </svg>
  );
}

interface NodeToolbarProps {
  selectedNode: InteractiveNode | null;
  hasModifications: boolean;
  onToggleCurve: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onSimplify: () => void;
  onReset: () => void;
}

/** Actions on the selected node, floating at the bottom of the canvas. */
export function NodeToolbar({ selectedNode, hasModifications, onToggleCurve, onSplit, onDelete, onSimplify, onReset }: NodeToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="node-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      {selectedNode ? (
        <SelectedNodeActions node={selectedNode} onToggleCurve={onToggleCurve} onSplit={onSplit} onDelete={onDelete} />
      ) : (
        <span className="node-toolbar-hint">{t('nodes.hint')}</span>
      )}
      <button className="btn btn-small btn-quiet" onClick={onSimplify} title={t('nodes.simplifyTitle')}>
        <Sparkles size={14} />
        {t('nodes.simplify')}
      </button>
      {hasModifications && (
        <button className="btn btn-small btn-quiet" onClick={onReset} title={t('nodes.resetTitle')}>
          <RotateCcw size={14} />
          {t('nodes.reset')}
        </button>
      )}
    </div>
  );
}

function SelectedNodeActions({ node, onToggleCurve, onSplit, onDelete }: { node: InteractiveNode; onToggleCurve: () => void; onSplit: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const isAnchor = node.nodeType === 'anchor';
  // A subpath's first anchor has no segment before it to curve or split
  const isEditableSegment = isAnchor && node.segmentType !== 'M';
  return (
    <>
      <span className="node-toolbar-coords">
        {t(isAnchor ? 'nodes.anchor' : 'nodes.handle')}{' '}
        <span className="numeric">
          {node.x.toFixed(1)}, {node.y.toFixed(1)}
        </span>
      </span>
      {isEditableSegment && (
        <>
          <button className="btn btn-small btn-quiet" onClick={onToggleCurve} title={t(node.isCurve ? 'nodes.toCornerTitle' : 'nodes.toSmoothTitle')}>
            {node.isCurve ? <CornerUpRight size={14} /> : <Spline size={14} />}
            {t(node.isCurve ? 'nodes.corner' : 'nodes.smooth')}
          </button>
          <button className="btn btn-small btn-quiet" onClick={onSplit} title={t('nodes.splitTitle')}>
            <Plus size={14} />
            {t('nodes.split')}
          </button>
        </>
      )}
      {isAnchor && (
        <button className="btn btn-small btn-quiet" onClick={onDelete} title={t('nodes.deleteTitle')}>
          <Trash2 size={14} />
          {t('nodes.delete')}
        </button>
      )}
      <span className="node-toolbar-divider" />
    </>
  );
}

/** A slim card naming the current step of a trace. */
export function ProcessingCard({ progress }: { progress: WorkerProgress }) {
  const { t } = useI18n();
  return (
    <div className="processing" role="status">
      <span className="processing-title">{t('viewport.processing')}</span>
      <span className="processing-stage">{t(progress.stage)}</span>
      <span className="processing-track" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <span className="processing-fill" style={{ width: `${progress.percent}%` }} />
      </span>
    </div>
  );
}
