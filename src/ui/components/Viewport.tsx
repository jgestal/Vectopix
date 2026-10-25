import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkerProgress } from '../../domain/types';
import type { ViewMode, RenderMode } from '../types';
import { parseSvgDocument, serializeParsedDoc, type ParsedSvgDoc } from '../../domain/geometry/svgDocument';
import { extractInteractiveNodes, toggleNodeType, splitSegmentAtMidpoint, moveNode, deleteNode, type InteractiveNode } from '../../domain/geometry/nodeEditing';
import { countShapes } from '../../domain/geometry/svgStats';
import { NodeHandles, NodeToolbar, ProcessingCard } from './viewport/ViewportParts';
import { SideBySideStage, SplitStage } from './viewport/Stages';
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

  // Wireframe styling is applied in CSS (.mode-wireframe), for every shape type
  const nodeHandles = renderMode === 'nodes' && (
    <NodeHandles
      overlayRef={overlayRef}
      nodes={interactiveNodes}
      selectedNodeId={selectedNodeId}
      width={width}
      height={height}
      zoom={zoom}
      onNodeMouseDown={handleNodeMouseDown}
    />
  );
  const stage = { rasterUrl, svgContent, width, height, zoom, pan, renderMode, nodeHandles };

  return (
    <div
      ref={containerRef}
      className={`studio-viewport mat ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-pressed' : ''}`}
      onMouseDown={handleMouseDown}
    >
      {/* Background Grid Pattern */}
      <div className="viewport-backdrop"></div>

      {viewMode === 'side-by-side' ? (
        <SideBySideStage {...stage} shapeCount={shapeCount} />
      ) : (
        <SplitStage {...stage} viewMode={viewMode} splitPos={splitPos} onSplitDragStart={() => setIsDraggingSplit(true)} />
      )}

      {renderMode === 'nodes' && (
        <NodeToolbar
          selectedNode={selectedNode}
          hasModifications={hasModifications}
          onToggleCurve={handleToggleCurve}
          onSplit={handleSplitSegment}
          onDelete={handleDeleteSelectedNode}
          onSimplify={onSimplifyNodes}
          onReset={onResetEdits}
        />
      )}

      {isProcessing && progress && <ProcessingCard progress={progress} />}
    </div>
  );
};
