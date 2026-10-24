import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { ViewMode, RenderMode, WorkerProgress } from '../types/vector';
import {
  parseSvgDocument,
  serializeParsedDoc,
  extractInteractiveNodes,
  toggleNodeType,
  splitSegmentAtMidpoint,
  simplifySvgPaths,
  type ParsedSvgDoc,
  type InteractiveNode,
} from '../utils/pathParser';
import {
  MousePointer,
  RotateCcw,
  Trash2,
  Crosshair,
  Spline,
  CornerUpRight,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

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
  isCenterline?: boolean;
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
  isCenterline,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100 %
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Node Editor State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeDraggingNode, setActiveDraggingNode] = useState<{
    id: string;
    pathIndex: number;
    segmentIndex: number;
    nodeType: 'anchor' | 'cp1' | 'cp2';
  } | null>(null);

  const hasDraggedNodeRef = useRef(false);
  const latestSvgRef = useRef(svgContent);

  useEffect(() => {
    latestSvgRef.current = svgContent;
  }, [svgContent]);

  // Center image when dimensions or viewMode changes
  useEffect(() => {
    if (!containerRef.current || !imageDimensions) return;
    const rect = containerRef.current.getBoundingClientRect();
    const effectiveWidth = viewMode === 'side-by-side' ? imageDimensions.width * 2 * zoom + 40 : imageDimensions.width * zoom;
    const cx = (rect.width - effectiveWidth) / 2;
    const cy = (rect.height - imageDimensions.height * zoom) / 2;
    setPan({ x: cx, y: cy });
  }, [imageDimensions, viewMode]);

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
  const parsedDoc: ParsedSvgDoc = useMemo(() => {
    return parseSvgDocument(svgContent);
  }, [svgContent]);

  // Extract interactive nodes
  const interactiveNodes: InteractiveNode[] = useMemo(() => {
    if (renderMode !== 'nodes') return [];
    return extractInteractiveNodes(parsedDoc.paths, null);
  }, [parsedDoc, renderMode]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return interactiveNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, interactiveNodes]);

  const hasModifications = svgContent !== originalSvg;

  // Handle Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(24, Math.max(0.1, zoom * zoomFactor));

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

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
  const handleNodeMouseDown = (
    e: React.MouseEvent,
    node: InteractiveNode
  ) => {
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
        const artboardX = pan.x;
        const artboardWidth = imageDimensions.width * zoom;
        const mouseX = e.clientX - rect.left;
        const relPos = ((mouseX - artboardX) / artboardWidth) * 100;
        setSplitPos(Math.max(0, Math.min(100, relPos)));
        return;
      }

      // 2. Dragging Interactive Anchor or Control Point
      if (activeDraggingNode && imageDimensions) {
        const artboardX = (e.clientX - pan.x) / zoom;
        const artboardY = (e.clientY - pan.y) / zoom;

        const updatedPaths = [...parsedDoc.paths];
        const targetPath = { ...updatedPaths[activeDraggingNode.pathIndex] };
        const segments = [...targetPath.segments];
        const targetSeg = { ...segments[activeDraggingNode.segmentIndex] };

        if (activeDraggingNode.nodeType === 'anchor') {
          const dx = artboardX - targetSeg.x;
          const dy = artboardY - targetSeg.y;
          targetSeg.x = artboardX;
          targetSeg.y = artboardY;

          // If this is a cubic curve, move its control point 2 proportionally
          if (targetSeg.cp2x !== undefined && targetSeg.cp2y !== undefined) {
            targetSeg.cp2x += dx;
            targetSeg.cp2y += dy;
          }
        } else if (activeDraggingNode.nodeType === 'cp1') {
          targetSeg.cp1x = artboardX;
          targetSeg.cp1y = artboardY;
        } else if (activeDraggingNode.nodeType === 'cp2') {
          targetSeg.cp2x = artboardX;
          targetSeg.cp2y = artboardY;
        }

        segments[activeDraggingNode.segmentIndex] = targetSeg;
        targetPath.segments = segments;
        updatedPaths[activeDraggingNode.pathIndex] = targetPath;

        const newDoc: ParsedSvgDoc = {
          ...parsedDoc,
          paths: updatedPaths,
        };

        const newSvg = serializeParsedDoc(newDoc);
        latestSvgRef.current = newSvg;
        hasDraggedNodeRef.current = true;
        // Non-committing update during active drag (smooth 60fps without undo flooding)
        onSvgModified(newSvg, false);
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
    [
      isDraggingSplit,
      activeDraggingNode,
      isPanning,
      pan.x,
      pan.y,
      panStart,
      zoom,
      imageDimensions,
      parsedDoc,
      onSvgModified,
    ]
  );

  const handleMouseUp = useCallback(() => {
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
  }, [selectedNode, parsedDoc]);

  // Delete Selected Node
  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    const { pathIndex, segmentIndex } = selectedNode;
    const updatedPaths = [...parsedDoc.paths];
    const targetPath = { ...updatedPaths[pathIndex] };
    const segments = [...targetPath.segments];

    if (segments.length <= 2) {
      alert('Un trazado no puede tener menos de 2 nodos.');
      return;
    }

    segments.splice(segmentIndex, 1);
    targetPath.segments = segments;
    updatedPaths[pathIndex] = targetPath;

    const newDoc: ParsedSvgDoc = {
      ...parsedDoc,
      paths: updatedPaths,
    };

    const newSvg = serializeParsedDoc(newDoc);
    onSvgModified(newSvg, true, 'Nodo eliminado');
    setSelectedNodeId(null);
  };

  // Toggle Node Curve / Corner Type
  const handleToggleCurve = () => {
    if (!selectedNode) return;
    const { pathIndex, segmentIndex } = selectedNode;
    const newDoc = toggleNodeType(parsedDoc, pathIndex, segmentIndex);
    const newSvg = serializeParsedDoc(newDoc);
    onSvgModified(newSvg, true, 'Tipo de nodo alternado');
  };

  // Split Segment / Insert Midpoint Node
  const handleSplitSegment = () => {
    if (!selectedNode) return;
    const { pathIndex, segmentIndex } = selectedNode;
    if (segmentIndex <= 0) return;

    const { newDoc } = splitSegmentAtMidpoint(parsedDoc, pathIndex, segmentIndex);
    const newSvg = serializeParsedDoc(newDoc);
    onSvgModified(newSvg, true, 'Nodo intermedio insertado con subdivisión de Bézier');
    setSelectedNodeId(`p${pathIndex}_s${segmentIndex}_anchor`);
  };

  // Simplify & Reduce Nodes across all paths
  const handleSimplifyAllPaths = () => {
    const { newDoc, removedCount, originalNodes } = simplifySvgPaths(parsedDoc, 1.2);
    if (removedCount <= 0) {
      alert('Los trazados ya tienen la cantidad mínima de nodos optimizada.');
      return;
    }
    const newSvg = serializeParsedDoc(newDoc);
    const pct = Math.round((removedCount / originalNodes) * 100);
    onSvgModified(
      newSvg,
      true,
      `Trazados simplificados: ${removedCount} nodos eliminados (-${pct}%)`
    );
  };

  if (!imageDimensions) {
    return <div className="studio-viewport-empty">No hay imagen cargada</div>;
  }

  const { width, height } = imageDimensions;
  const scaledWidth = width * zoom;
  const scaledHeight = height * zoom;

  // Process SVG for Wireframe mode
  let processedSvg = svgContent;
  if (renderMode === 'wireframe') {
    processedSvg = svgContent.replace(
      /<path\b([^>]*)fill="[^"]*"/gi,
      '<path $1 fill="none" stroke="#06b6d4" stroke-width="1"'
    );
  }

  // Node handle radius scaled inversely with zoom
  const handleRadius = Math.max(3, Math.min(8, 5.5 / Math.sqrt(zoom)));
  const handleStroke = Math.max(1, 1.5 / Math.sqrt(zoom));

  // Render SVG node editor handles
  const renderNodeHandlesSvg = () => (
    <svg
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
              stroke="#22d3ee"
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
            fill="#06b6d4"
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
                  fill="rgba(34, 211, 238, 0.25)"
                  stroke="#22d3ee"
                  strokeWidth={handleStroke}
                />
              )}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={handleRadius}
                fill={isSelected ? '#22d3ee' : '#ffffff'}
                stroke={isSelected ? '#0e7490' : '#4f46e5'}
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
      className={`studio-viewport ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-pressed' : ''}`}
      onWheel={handleWheel}
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
          <div className="sbs-pane" style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}>
            <div className="sbs-pane-badge raster-badge">
              <span>Raster Original ({width} × {height} px)</span>
            </div>
            <div className="sbs-pane-content">
              <img
                src={rasterUrl}
                alt="Original Raster"
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
          <div className="sbs-pane" style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}>
            <div className="sbs-pane-badge vector-badge">
              <span>Vector Limpio ({parsedDoc.paths.length} trazos)</span>
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
                alt="Original Raster"
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
                <span className="split-arrow-left">◀</span>
                <span className="split-tag">Raster | Vector</span>
                <span className="split-arrow-right">▶</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Node Editor Toolbar (when in Nodes / Anchor mode) */}
      {renderMode === 'nodes' && (
        <div className="node-editor-toolbar">
          <div className="node-toolbar-badge">
            <MousePointer size={14} className="text-cyan" />
            <span>Editor de Nodos Activo: Arrastra anclas y tiradores Bézier</span>
          </div>

          {selectedNode ? (
            <div className="node-toolbar-info">
              <Crosshair size={13} className="text-indigo" />
              <span>
                Nodo {selectedNode.nodeType === 'anchor' ? 'Ancla' : 'Tirador'}:
                {' '}
                <strong>X: {selectedNode.x.toFixed(1)}</strong>,{' '}
                <strong>Y: {selectedNode.y.toFixed(1)}</strong>
              </span>

              {selectedNode.nodeType === 'anchor' && (
                <>
                  <button
                    className="btn-node-tool"
                    onClick={handleToggleCurve}
                    title={
                      selectedNode.isCurve
                        ? 'Convertir a esquina afilada (línea recta)'
                        : 'Convertir a curva suave Bézier'
                    }
                  >
                    {selectedNode.isCurve ? (
                      <>
                        <CornerUpRight size={13} />
                        <span>Afilada</span>
                      </>
                    ) : (
                      <>
                        <Spline size={13} />
                        <span>Suave</span>
                      </>
                    )}
                  </button>

                  {selectedNode.segmentIndex > 0 && (
                    <button
                      className="btn-node-tool"
                      onClick={handleSplitSegment}
                      title="Dividir tramo intermedio e insertar nuevo nodo de control"
                    >
                      <PlusCircle size={13} />
                      <span>Dividir Tramo</span>
                    </button>
                  )}

                  <button
                    className="btn-node-tool danger"
                    onClick={handleDeleteSelectedNode}
                    title="Eliminar nodo seleccionado (Supr / Backspace)"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <span className="node-toolbar-hint">
              Haz clic sobre cualquier nodo para editar tiradores o alternar tipo de curva
            </span>
          )}

          <button
            className="btn-node-tool simplify"
            onClick={handleSimplifyAllPaths}
            title="Reducir nodos redundantes y simplificar curvas suavemente (Algoritmo Ramer-Douglas-Peucker)"
          >
            <Sparkles size={13} className="text-amber" />
            <span>Reducir Nodos</span>
          </button>

          {hasModifications && (
            <button
              className="btn-node-tool reset"
              onClick={onResetEdits}
              title="Restaurar trazado original antes de editar nodos"
            >
              <RotateCcw size={13} />
              <span>Restaurar Nodos</span>
            </button>
          )}
        </div>
      )}

      {/* Processing Loader Overlay */}
      {isProcessing && progress && (
        <div className="viewport-processing-overlay">
          <div className="processing-card">
            <div className="processing-spinner-glow"></div>
            <div className="processing-title">Vectorizando Imagen...</div>
            <div className="processing-stage">{progress.stage}</div>
            <div className="processing-bar-track">
              <div
                className="processing-bar-fill"
                style={{ width: `${progress.percent}%` }}
              ></div>
            </div>
            <div className="processing-percent">{progress.percent}%</div>
          </div>
        </div>
      )}

      {/* Floating Viewport Legend */}
      <div className="viewport-legend">
        {isCenterline ? (
          <>
            <span className="legend-tag centerline-tag">Línea Central (Centerline)</span>
            <span className="legend-sep">•</span>
            <span className="legend-sub">Trazos de un solo hilo para Láser/CNC</span>
          </>
        ) : (
          <>
            <span className="legend-tag raster-tag">Raster Original</span>
            <span className="legend-sep">⟷</span>
            <span className="legend-tag vector-tag">Vector Limpio</span>
          </>
        )}
      </div>
    </div>
  );
};
