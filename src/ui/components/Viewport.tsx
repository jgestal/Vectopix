import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkerProgress } from '../../domain/types';
import type { ViewMode, RenderMode } from '../types';
import { parseSvgDocument, serializeParsedDoc, type ParsedSvgDoc } from '../../domain/geometry/svgDocument';
import { extractInteractiveNodes, toggleNodeType, splitSegmentAtMidpoint, moveNode, deleteNode, type InteractiveNode } from '../../domain/geometry/nodeEditing';
import { countShapes } from '../../domain/geometry/svgStats';
import { ChevronsLeftRight, CornerUpRight, Plus, RotateCcw, Sparkles, Spline, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';

interface ViewportProps {
  rasterUrl: string;
  svgContent: string;
  originalSvg: string;
  imageDimensions: { width: number; height: number } | null;
  viewMode: ViewMode;
  renderMode: RenderMode;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  isProcessing: boolean;
  progress: WorkerProgress | null;
  onSvgModified: (newSvg: string, commitHistory?: boolean, toastText?: string) => void;
  onResetEdits: () => void;
  onSimplifyNodes: () => void;
  onShowToast: (text: string, type?: 'info' | 'success' | 'warning') => void;
  /** Incremented by the parent to request a fit-to-screen. */
  fitRequest: number;
}

type DraggedNode = Pick<InteractiveNode, 'id' | 'pathIndex' | 'segmentIndex' | 'nodeType'>;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 24;
const FIT_PADDING = 80;
/** Height of the title bar on top of each side-by-side pane (see .sbs-pane-badge). */
const SBS_TITLE_HEIGHT = 28;

/** Path index encoded in an interactive node id (`p{path}_s{segment}_{type}`). */
function pathIndexFromNodeId(id: string | null): number | null {
  const match = id?.match(/^p(\d+)_/);
  return match ? Number(match[1]) : null;
}

export const Viewport: React.FC<ViewportProps> = ({
  rasterUrl,
  svgContent,
  originalSvg,
  imageDimensions,
  viewMode,
  renderMode,
  zoom,
  setZoom,
  isProcessing,
  progress,
  onSvgModified,
  onResetEdits,
  onSimplifyNodes,
  onShowToast,
  fitRequest,
}) => {
  const { t } = useI18n();
  const { svgDom } = useServices();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100 %
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Node Editor State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeDraggingNode, setActiveDraggingNode] = useState<DraggedNode | null>(null);

  const hasDraggedNodeRef = useRef(false);
  const latestSvgRef = useRef(svgContent);
  const dragFrameRef = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    latestSvgRef.current = svgContent;
  }, [svgContent]);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Fit the artboard to the viewport for a new image or an explicit fit
  // request, and re-center it (keeping the zoom) when the layout changes
  const lastFitRef = useRef<{ dims: typeof imageDimensions; request: number } | null>(null);
  useEffect(() => {
    if (!containerRef.current || !imageDimensions) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isSideBySide = viewMode === 'side-by-side';
    const contentWidth = (z: number) => (isSideBySide ? imageDimensions.width * 2 * z + 32 : imageDimensions.width * z);

    const last = lastFitRef.current;
    const shouldFit = !last || last.dims !== imageDimensions || last.request !== fitRequest;
    lastFitRef.current = { dims: imageDimensions, request: fitRequest };

    let z = zoomRef.current;
    if (shouldFit) {
      const widthFactor = isSideBySide ? 2 : 1;
      z = Math.max(
        MIN_ZOOM,
        Math.min(
          1,
          (rect.width - FIT_PADDING) / (imageDimensions.width * widthFactor),
          (rect.height - FIT_PADDING) / imageDimensions.height
        )
      );
      setZoom(z);
    }

    setPan({
      x: (rect.width - contentWidth(z)) / 2,
      y: (rect.height - imageDimensions.height * z) / 2,
    });
  }, [imageDimensions, viewMode, fitRequest, setZoom]);

  // Listen to Spacebar for pan navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Parse SVG Document for interactive node editing
  // Same count as the status bar: every shape drawn, primitives included
  const shapeCount = useMemo(() => countShapes(svgContent), [svgContent]);
  const parsedDoc: ParsedSvgDoc = useMemo(() => {
    return parseSvgDocument(svgContent, svgDom);
  }, [svgContent, svgDom]);

  // Anchors of every path, but Bézier handles only for the selected path:
  // showing every handle of a complex trace is unreadable and slow
  const selectedPathIndex = pathIndexFromNodeId(selectedNodeId);
  const interactiveNodes: InteractiveNode[] = useMemo(() => {
    if (renderMode !== 'nodes') return [];
    return extractInteractiveNodes(parsedDoc.paths, selectedPathIndex ?? -1);
  }, [parsedDoc, renderMode, selectedPathIndex]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return interactiveNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, interactiveNodes]);

  const hasModifications = svgContent !== originalSvg;

  // Mouse wheel zoom around the cursor. Registered natively because React
  // attaches wheel listeners as passive, where preventDefault is ignored.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      // Trackpad pinch arrives as ctrl+wheel with small deltas
      const intensity = e.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-e.deltaY * intensity);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom(newZoom);
      setPan({
        x: mouseX - (mouseX - currentPan.x) * (newZoom / currentZoom),
        y: mouseY - (mouseY - currentPan.y) * (newZoom / currentZoom),
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [setZoom, imageDimensions]);

  // Canvas Pan Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDraggingSplit || activeDraggingNode) return;
    if (e.button === 0 || e.button === 1 || isSpacePressed) {
      if ((e.target as HTMLElement).tagName !== 'circle') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  // Node Dragging Interaction
  const handleNodeMouseDown = (e: React.MouseEvent, node: InteractiveNode) => {
    if (isSpacePressed) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedNodeId(node.id);
    setActiveDraggingNode({
      id: node.id,
      pathIndex: node.pathIndex,
      segmentIndex: node.segmentIndex,
      nodeType: node.nodeType,
    });
    hasDraggedNodeRef.current = false;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // 1. Dragging Split Slider
      if (isDraggingSplit && containerRef.current && imageDimensions) {
        const rect = containerRef.current.getBoundingClientRect();
        const artboardWidth = imageDimensions.width * zoom;
        const relPos = ((e.clientX - rect.left - pan.x) / artboardWidth) * 100;
        setSplitPos(Math.max(0, Math.min(100, relPos)));
        return;
      }

      // 2. Dragging an anchor or control point, at most once per frame.
      // Coordinates come from the overlay's own box, so they are right in
      // every layout (split, solo or the right pane of side-by-side).
      if (activeDraggingNode && overlayRef.current && imageDimensions) {
        const rect = overlayRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * imageDimensions.width;
        const y = ((e.clientY - rect.top) / rect.height) * imageDimensions.height;

        if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const newSvg = serializeParsedDoc(moveNode(parsedDoc, activeDraggingNode, x, y), svgDom);
          latestSvgRef.current = newSvg;
          hasDraggedNodeRef.current = true;
          // Non-committing update during the drag; mouseup commits one undo step
          onSvgModified(newSvg, false);
        });
        return;
      }

      // 3. Panning Canvas
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isDraggingSplit, activeDraggingNode, isPanning, pan.x, panStart, zoom, imageDimensions, parsedDoc, onSvgModified, svgDom]
  );

  const handleMouseUp = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    if (activeDraggingNode && hasDraggedNodeRef.current) {
      // Commit final drag state into undo history
      onSvgModified(latestSvgRef.current, true);
      hasDraggedNodeRef.current = false;
    }
    setIsPanning(false);
    setIsDraggingSplit(false);
    setActiveDraggingNode(null);
  }, [activeDraggingNode, onSvgModified]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Delete Selected Node
  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const newDoc = deleteNode(parsedDoc, selectedNode.pathIndex, selectedNode.segmentIndex);
    if (!newDoc) {
      onShowToast(t('nodes.minNodes'), 'warning');
      return;
    }
    onSvgModified(serializeParsedDoc(newDoc, svgDom), true, t('nodes.deleted'));
    setSelectedNodeId(null);
  }, [selectedNode, parsedDoc, onSvgModified, onShowToast, t, svgDom]);

  // Keyboard shortcut listener for deleting selected node or deselecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNode) {
        e.preventDefault();
        handleDeleteSelectedNode();
      }

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, handleDeleteSelectedNode]);

  // Toggle Node Curve / Corner Type
  const handleToggleCurve = () => {
    if (!selectedNode) return;
    const { pathIndex, segmentIndex } = selectedNode;
    const newDoc = toggleNodeType(parsedDoc, pathIndex, segmentIndex);
    onSvgModified(serializeParsedDoc(newDoc, svgDom), true, t('nodes.toggled'));
  };

  // Split Segment / Insert Midpoint Node
  const handleSplitSegment = () => {
    if (!selectedNode || selectedNode.segmentType === 'M') return;
    const { pathIndex, segmentIndex } = selectedNode;

    const { newDoc } = splitSegmentAtMidpoint(parsedDoc, pathIndex, segmentIndex);
    onSvgModified(serializeParsedDoc(newDoc, svgDom), true, t('nodes.splitDone'));
    setSelectedNodeId(`p${pathIndex}_s${segmentIndex}_anchor`);
  };

  if (!imageDimensions) {
    return <div className="studio-viewport-empty">{t('viewport.empty')}</div>;
  }

  const { width, height } = imageDimensions;
  const scaledWidth = width * zoom;
  const scaledHeight = height * zoom;

  // Wireframe styling is applied in CSS (.mode-wireframe), for every shape type
  const processedSvg = svgContent;

  // Node handle radius scaled inversely with zoom
  const handleRadius = Math.max(3, Math.min(8, 5.5 / Math.sqrt(zoom)));
  const handleStroke = Math.max(1, 1.5 / Math.sqrt(zoom));

  // Render SVG node editor handles
  const renderNodeHandlesSvg = () => (
    <svg
      ref={overlayRef}
      className="artboard-layer node-editor-overlay"
      viewBox={`0 0 ${width} ${height}`}
      width={scaledWidth}
      height={scaledHeight}
    >
      {/* Draw Tangent Lines for Cubic Bézier Control Points */}
      {interactiveNodes
        .filter((n) => n.nodeType === 'cp1' || n.nodeType === 'cp2')
        .map((cp) => {
          if (!cp.connectedAnchor) return null;
          return (
            <line
              key={`line_${cp.id}`}
              x1={cp.connectedAnchor.x}
              y1={cp.connectedAnchor.y}
              x2={cp.x}
              y2={cp.y}
              stroke="var(--magenta)"
              strokeWidth={1 / Math.sqrt(zoom)}
              strokeDasharray={`${3 / Math.sqrt(zoom)},${3 / Math.sqrt(zoom)}`}
            />
          );
        })}

      {/* Draw Interactive Control Handle Points */}
      {interactiveNodes
        .filter((n) => n.nodeType === 'cp1' || n.nodeType === 'cp2')
        .map((cp) => (
          <circle
            key={cp.id}
            cx={cp.x}
            cy={cp.y}
            r={handleRadius * 0.75}
            fill="var(--magenta)"
            stroke="#ffffff"
            strokeWidth={handleStroke}
            className="interactive-cp-handle"
            onMouseDown={(e) => handleNodeMouseDown(e, cp)}
          />
        ))}

      {/* Draw Interactive Anchor Points */}
      {interactiveNodes
        .filter((n) => n.nodeType === 'anchor')
        .map((anchor) => {
          const isSelected = selectedNodeId === anchor.id;
          return (
            <g key={anchor.id} className="anchor-point-group">
              {isSelected && (
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r={handleRadius * 1.8}
                  fill="var(--magenta-soft)"
                  stroke="var(--magenta)"
                  strokeWidth={handleStroke}
                />
              )}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={handleRadius}
                fill={isSelected ? 'var(--magenta)' : '#ffffff'}
                stroke={isSelected ? '#ffffff' : 'var(--magenta)'}
                strokeWidth={handleStroke}
                className="interactive-anchor-handle"
                onMouseDown={(e) => handleNodeMouseDown(e, anchor)}
              />
            </g>
          );
        })}
    </svg>
  );

  return (
    <div
      ref={containerRef}
      className={`studio-viewport mat ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-pressed' : ''}`}
      onMouseDown={handleMouseDown}
    >
      {/* Background Grid Pattern */}
      <div className="viewport-backdrop"></div>

      {viewMode === 'side-by-side' ? (
        /* DUAL-PANE SIDE-BY-SIDE COMPARISON */
        <div
          className="artboard-stage side-by-side-stage"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            width: `${scaledWidth * 2 + 32}px`,
            height: `${scaledHeight + 36}px`,
          }}
        >
          {/* Left Board: Original Raster */}
          <div className="sbs-pane" style={{ width: `${scaledWidth}px`, height: `${scaledHeight + SBS_TITLE_HEIGHT}px` }}>
            <div className="sbs-pane-badge raster-badge">
              <span>{t('viewport.rasterBadge', { width, height })}</span>
            </div>
            <div className="sbs-pane-content">
              <img
                src={rasterUrl}
                alt={t('viewport.rasterAlt')}
                width={scaledWidth}
                height={scaledHeight}
                className={`raster-img ${zoom >= 4 ? 'pixelated' : ''}`}
                draggable={false}
              />
              {zoom >= 6 && (
                <svg
                  className="pixel-lattice-overlay"
                  width={scaledWidth}
                  height={scaledHeight}
                  viewBox={`0 0 ${width} ${height}`}
                >
                  <defs>
                    <pattern id="pixelGridSbs" width="1" height="1" patternUnits="userSpaceOnUse">
                      <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth={0.05} />
                    </pattern>
                  </defs>
                  <rect width={width} height={height} fill="url(#pixelGridSbs)" />
                </svg>
              )}
            </div>
          </div>

          {/* Right Board: Vector Output */}
          <div className="sbs-pane" style={{ width: `${scaledWidth}px`, height: `${scaledHeight + SBS_TITLE_HEIGHT}px` }}>
            <div className="sbs-pane-badge vector-badge">
              <span>{t('viewport.vectorBadge', { count: shapeCount })}</span>
            </div>
            <div className={`sbs-pane-content vector-layer mode-${renderMode}`}>
              <div
                className="svg-render-container"
                dangerouslySetInnerHTML={{ __html: processedSvg }}
              />
              {renderMode === 'nodes' && renderNodeHandlesSvg()}
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE ARTBOARD STAGE (SPLIT CURTAIN / SOLO VECTOR / SOLO RASTER) */
        <div
          className="artboard-stage"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
        >
          {/* Layer 1: Original Raster Bitmap */}
          {(viewMode === 'split' || viewMode === 'raster') && (
            <div
              className="artboard-layer raster-layer"
              style={{
                clipPath:
                  viewMode === 'split'
                    ? `polygon(0% 0%, ${splitPos}% 0%, ${splitPos}% 100%, 0% 100%)`
                    : undefined,
              }}
            >
              <img
                src={rasterUrl}
                alt={t('viewport.rasterAlt')}
                width={scaledWidth}
                height={scaledHeight}
                className={`raster-img ${zoom >= 4 ? 'pixelated' : ''}`}
                draggable={false}
              />

              {/* Pixel Lattice Grid at extreme zoom (>= 6x) to inspect sub-pixel fidelity */}
              {zoom >= 6 && (
                <svg
                  className="pixel-lattice-overlay"
                  width={scaledWidth}
                  height={scaledHeight}
                  viewBox={`0 0 ${width} ${height}`}
                >
                  <defs>
                    <pattern
                      id="pixelGrid"
                      width="1"
                      height="1"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 1 0 L 0 0 0 1"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth={0.05}
                      />
                    </pattern>
                  </defs>
                  <rect width={width} height={height} fill="url(#pixelGrid)" />
                </svg>
              )}
            </div>
          )}

          {/* Layer 2: Vector SVG Output */}
          {(viewMode === 'split' || viewMode === 'vector') && (
            <div
              className={`artboard-layer vector-layer mode-${renderMode}`}
              style={{
                clipPath:
                  viewMode === 'split'
                    ? `polygon(${splitPos}% 0%, 100% 0%, 100% 100%, ${splitPos}% 100%)`
                    : undefined,
              }}
            >
              <div
                className="svg-render-container"
                dangerouslySetInnerHTML={{ __html: processedSvg }}
              />
            </div>
          )}

          {/* Layer 3: Interactive Bézier Node Editor Overlay */}
          {renderMode === 'nodes' && renderNodeHandlesSvg()}

          {/* Layer 4: Split Curtain Slider Bar */}
          {viewMode === 'split' && (
            <div
              className="split-slider-line"
              style={{ left: `${splitPos}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsDraggingSplit(true);
              }}
            >
              <div className="split-handle">
                <ChevronsLeftRight size={16} aria-label={t('viewport.splitTag')} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Node editor toolbar, floating at the bottom of the canvas */}
      {renderMode === 'nodes' && (
        <div className="node-toolbar" onMouseDown={(e) => e.stopPropagation()}>
          {selectedNode ? (
            <>
              <span className="node-toolbar-coords">
                {t(selectedNode.nodeType === 'anchor' ? 'nodes.anchor' : 'nodes.handle')}{' '}
                <span className="numeric">
                  {selectedNode.x.toFixed(1)}, {selectedNode.y.toFixed(1)}
                </span>
              </span>
              {selectedNode.nodeType === 'anchor' && selectedNode.segmentType !== 'M' && (
                <>
                  <button
                    className="btn btn-small btn-quiet"
                    onClick={handleToggleCurve}
                    title={selectedNode.isCurve ? t('nodes.toCornerTitle') : t('nodes.toSmoothTitle')}
                  >
                    {selectedNode.isCurve ? <CornerUpRight size={14} /> : <Spline size={14} />}
                    {t(selectedNode.isCurve ? 'nodes.corner' : 'nodes.smooth')}
                  </button>
                  <button className="btn btn-small btn-quiet" onClick={handleSplitSegment} title={t('nodes.splitTitle')}>
                    <Plus size={14} />
                    {t('nodes.split')}
                  </button>
                </>
              )}
              {selectedNode.nodeType === 'anchor' && (
                <button className="btn btn-small btn-quiet" onClick={handleDeleteSelectedNode} title={t('nodes.deleteTitle')}>
                  <Trash2 size={14} />
                  {t('nodes.delete')}
                </button>
              )}
              <span className="node-toolbar-divider" />
            </>
          ) : (
            <span className="node-toolbar-hint">{t('nodes.hint')}</span>
          )}

          <button className="btn btn-small btn-quiet" onClick={onSimplifyNodes} title={t('nodes.simplifyTitle')}>
            <Sparkles size={14} />
            {t('nodes.simplify')}
          </button>
          {hasModifications && (
            <button className="btn btn-small btn-quiet" onClick={onResetEdits} title={t('nodes.resetTitle')}>
              <RotateCcw size={14} />
              {t('nodes.reset')}
            </button>
          )}
        </div>
      )}

      {/* Progress: a slim card that names the current step */}
      {isProcessing && progress && (
        <div className="processing" role="status">
          <span className="processing-title">{t('viewport.processing')}</span>
          <span className="processing-stage">{t(progress.stage)}</span>
          <span className="processing-track" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
            <span className="processing-fill" style={{ width: `${progress.percent}%` }} />
          </span>
        </div>
      )}
    </div>
  );
};
