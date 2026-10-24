import React from 'react';
import {
  Wand2,
  Sliders,
  Palette,
  Sparkles,
  RotateCcw,
  GitFork,
  Activity,
  Scissors,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  VectorOptions,
  VectorPreset,
  PaletteColor,
  TraceMethod,
} from '../types/vector';

interface SidebarProps {
  options: VectorOptions;
  setOptions: React.Dispatch<React.SetStateAction<VectorOptions>>;
  onApplyPreset: (preset: VectorPreset) => void;
  palette: PaletteColor[];
  isProcessing: boolean;
  onRetrace: () => void;
  isCenterline?: boolean;
  onSelectColor: (color: PaletteColor) => void;
  onSimplifyNodes?: () => void;
  nodesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  options,
  setOptions,
  onApplyPreset,
  palette,
  isProcessing,
  onRetrace,
  isCenterline,
  onSelectColor,
  onSimplifyNodes,
  nodesCount,
}) => {
  const updateOption = <K extends keyof VectorOptions>(
    key: K,
    val: VectorOptions[K]
  ) => {
    setOptions((prev) => ({
      ...prev,
      [key]: val,
      preset: 'custom',
    }));
  };

  const handleTraceMethodChange = (method: TraceMethod) => {
    setOptions((prev) => ({
      ...prev,
      traceMethod: method,
      preset: method === 'centerline' ? 'centerline-sketch' : 'logo',
    }));
  };

  return (
    <aside className="studio-sidebar">
      {/* Trace Method Switcher: Outline vs Centerline */}
      <div className="sidebar-section">
        <div className="section-title">
          <GitFork size={16} className="section-icon" />
          <span>Método de Vectorización</span>
        </div>
        <div className="method-toggle-group">
          <button
            className={`method-btn ${options.traceMethod === 'outline' ? 'active' : ''}`}
            onClick={() => handleTraceMethodChange('outline')}
          >
            <div className="method-btn-title">
              <Activity size={14} />
              <span>Contornos (Outline)</span>
            </div>
            <div className="method-btn-desc">Polígonos y curvas cerradas con relleno</div>
          </button>

          <button
            className={`method-btn ${options.traceMethod === 'centerline' ? 'active' : ''}`}
            onClick={() => handleTraceMethodChange('centerline')}
          >
            <div className="method-btn-title">
              <Scissors size={14} />
              <span>Línea Central (Centerline)</span>
            </div>
            <div className="method-btn-desc">Esqueleto de un solo trazo para Láser/CNC/Bocetos</div>
          </button>
        </div>
      </div>

      {/* Presets Section */}
      <div className="sidebar-section">
        <div className="section-title">
          <Wand2 size={16} className="section-icon" />
          <span>Presets de Vectorización</span>
        </div>
        <div className="presets-grid">
          {options.traceMethod === 'centerline' ? (
            <>
              <button
                className={`preset-card ${options.preset === 'centerline-sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('centerline-sketch')}
              >
                <div className="preset-name">Boceto a Trazo Único</div>
                <div className="preset-desc">Firma, grabado y caligrafía de trazo continuo</div>
              </button>
              <button
                className={`preset-card ${options.preset === 'sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('sketch')}
              >
                <div className="preset-name">Plano Técnico / CAD</div>
                <div className="preset-desc">Líneas de centro limpias exportables a DXF</div>
              </button>
            </>
          ) : (
            <>
              <button
                className={`preset-card ${options.preset === 'logo' ? 'active' : ''}`}
                onClick={() => onApplyPreset('logo')}
              >
                <div className="preset-name">Logotipo / Icono</div>
                <div className="preset-desc">Bordes afilados, sub-pixel, nodos mínimos</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'flat-art' ? 'active' : ''}`}
                onClick={() => onApplyPreset('flat-art')}
              >
                <div className="preset-name">Ilustración Plana</div>
                <div className="preset-desc">Paleta suave, equilibrio curvas y detalle</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'photo' ? 'active' : ''}`}
                onClick={() => onApplyPreset('photo')}
              >
                <div className="preset-name">Fotografía / Color</div>
                <div className="preset-desc">Gradientes tonales y alta paleta (32 col)</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('sketch')}
              >
                <div className="preset-name">Boceto Monocromo</div>
                <div className="preset-desc">Alto contraste, 2 colores, sin fondo</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'pixel-art' ? 'active' : ''}`}
                onClick={() => onApplyPreset('pixel-art')}
              >
                <div className="preset-name">Pixel Art Bit-Exact</div>
                <div className="preset-desc">Rejilla geométrica ortogonal sin suavizado</div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Centerline Specific Controls */}
      {options.traceMethod === 'centerline' ? (
        <div className="sidebar-section">
          <div className="section-title">
            <Scissors size={16} className="section-icon" />
            <span>Parámetros de Línea Central</span>
          </div>

          <div className="control-group">
            <div className="control-header">
              <label htmlFor="cl-width-slider">Grosor de Trazo (Stroke)</label>
              <span className="control-val">{options.centerlineStrokeWidth} px</span>
            </div>
            <input
              id="cl-width-slider"
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={options.centerlineStrokeWidth}
              onChange={(e) => updateOption('centerlineStrokeWidth', Number(e.target.value))}
              className="studio-slider"
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label htmlFor="cl-color-input">Color del Trazo</label>
              <span className="control-val">{options.centerlineStrokeColor}</span>
            </div>
            <div className="color-picker-row">
              <input
                id="cl-color-input"
                type="color"
                value={options.centerlineStrokeColor}
                onChange={(e) => updateOption('centerlineStrokeColor', e.target.value)}
                className="color-picker-input"
              />
              <span className="color-hex-tag">{options.centerlineStrokeColor}</span>
            </div>
          </div>

          <div className="toggle-list">
            <label className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-title">Umbral Adaptativo (Bradley)</span>
                <span className="toggle-sub">
                  Compensa sombras e iluminación irregular
                </span>
              </div>
              <input
                type="checkbox"
                checked={options.centerlineAdaptive}
                onChange={(e) => updateOption('centerlineAdaptive', e.target.checked)}
                className="studio-switch"
              />
            </label>

            <label className="toggle-item">
              <div className="toggle-info">
                <span className="toggle-title">Tinta Oscura sobre Claro</span>
                <span className="toggle-sub">
                  Invierte si el dibujo es claro sobre fondo oscuro
                </span>
              </div>
              <input
                type="checkbox"
                checked={options.centerlineBlackOnWhite}
                onChange={(e) => updateOption('centerlineBlackOnWhite', e.target.checked)}
                className="studio-switch"
              />
            </label>
          </div>
        </div>
      ) : (
        <>
          {/* Engine Selection for Outline */}
          <div className="sidebar-section">
            <div className="section-title">
              <Sliders size={16} className="section-icon" />
              <span>Motor Algorítmico</span>
            </div>
            <div className="engine-toggle-group">
              <button
                className={`engine-btn ${options.engine === 'vecline' ? 'active' : ''}`}
                onClick={() => updateOption('engine', 'vecline')}
              >
                <div className="engine-title">
                  <span>Vecline (Sub-Pixel)</span>
                  <span className="rec-tag">Recomendado</span>
                </div>
                <div className="engine-sub">Curvas Bézier continuas tipo Vector Magic</div>
              </button>

              <button
                className={`engine-btn ${options.engine === 'imagetracer' ? 'active' : ''}`}
                onClick={() => updateOption('engine', 'imagetracer')}
              >
                <div className="engine-title">
                  <span>ImageTracerJS</span>
                </div>
                <div className="engine-sub">Trazado clásico por capas policromáticas</div>
              </button>
            </div>
          </div>

          {/* Preprocessing Controls */}
          <div className="sidebar-section">
            <div className="section-title">
              <SlidersHorizontal size={16} className="section-icon" />
              <span>Pre-procesamiento de Imagen</span>
            </div>

            <div className="control-group">
              <div className="control-header">
                <label htmlFor="contrast-slider">Contraste / Nitidez</label>
                <span className="control-val">{options.contrast > 0 ? `+${options.contrast}` : options.contrast}%</span>
              </div>
              <input
                id="contrast-slider"
                type="range"
                min={-50}
                max={50}
                step={5}
                value={options.contrast}
                onChange={(e) => updateOption('contrast', Number(e.target.value))}
                className="studio-slider"
              />
            </div>

            <div className="control-group">
              <div className="control-header">
                <label htmlFor="denoise-slider">Reducción de Ruido JPEG</label>
                <span className="control-val">{options.denoise}</span>
              </div>
              <input
                id="denoise-slider"
                type="range"
                min={0}
                max={10}
                step={1}
                value={options.denoise}
                onChange={(e) => updateOption('denoise', Number(e.target.value))}
                className="studio-slider"
              />
            </div>
          </div>

          {/* Numeric Sliders */}
          <div className="sidebar-section">
            <div className="section-title">
              <Sliders size={16} className="section-icon" />
              <span>Ajustes de Precisión</span>
            </div>

            {/* Colors */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="color-slider">Cantidad de Colores</label>
                <span className="control-val">{options.colors}</span>
              </div>
              <input
                id="color-slider"
                type="range"
                min={2}
                max={64}
                step={1}
                value={options.colors}
                onChange={(e) => updateOption('colors', Number(e.target.value))}
                className="studio-slider"
              />
              <div className="slider-ticks">
                <span>2 (B/N)</span>
                <span>16 (Estándar)</span>
                <span>64 (Fidelidad)</span>
              </div>
            </div>

            {/* Curve Fitting Error (Tolerance) */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="tolerance-slider">Tolerancia de Nodos y Curvas</label>
                <span className="control-val">{options.fitError.toFixed(2)}</span>
              </div>
              <input
                id="tolerance-slider"
                type="range"
                min={0.1}
                max={1.5}
                step={0.05}
                value={options.fitError}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setOptions((prev) => ({
                    ...prev,
                    fitError: val,
                    tolerance: val,
                  }));
                }}
                className="studio-slider"
              />
              <div className="slider-ticks">
                <span>0.1 (Fiel a píxeles / + nodos)</span>
                <span>0.75 (Estándar VM)</span>
                <span>1.5 (Menos nodos)</span>
              </div>
            </div>

            {/* Bézier Smoothing */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="smooth-slider">Suavizado de Splines (Bézier Smooth)</label>
                <span className="control-val">
                  {options.smooth === 0
                    ? 'Desactivado (0)'
                    : options.smooth === 2
                    ? 'Ultra Suave (2)'
                    : 'Estándar (1)'}
                </span>
              </div>
              <input
                id="smooth-slider"
                type="range"
                min={0}
                max={2}
                step={1}
                value={options.smooth ?? 1}
                onChange={(e) => updateOption('smooth', Number(e.target.value))}
                className="studio-slider"
              />
              <div className="slider-ticks">
                <span>0 (Poligonal)</span>
                <span>1 (Vector Magic)</span>
                <span>2 (Ultra Suave)</span>
              </div>
            </div>

            {/* Noise Filter (Min Area) */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="minarea-slider">Filtro de Ruido (Área mínima)</label>
                <span className="control-val">{options.minArea} px</span>
              </div>
              <input
                id="minarea-slider"
                type="range"
                min={0}
                max={40}
                step={1}
                value={options.minArea}
                onChange={(e) => updateOption('minArea', Number(e.target.value))}
                className="studio-slider"
              />
              <div className="slider-ticks">
                <span>0 (Todo)</span>
                <span>10 px</span>
                <span>40 px (Eliminar motas)</span>
              </div>
            </div>

            {/* Corner Angle */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="corner-slider">Umbral de Esquina Afilada</label>
                <span className="control-val">{options.cornerAngle}°</span>
              </div>
              <input
                id="corner-slider"
                type="range"
                min={30}
                max={120}
                step={5}
                value={options.cornerAngle}
                onChange={(e) => updateOption('cornerAngle', Number(e.target.value))}
                className="studio-slider"
              />
            </div>
          </div>

          {/* Advanced Toggles */}
          <div className="sidebar-section">
            <div className="section-title">
              <Sparkles size={16} className="section-icon" />
              <span>Filtros y Optimización</span>
            </div>

            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Reconstrucción Sub-Pixel</span>
                  <span className="toggle-sub">
                    Deduce bordes ideales en base al anti-aliasing (tipo Vector Magic)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={options.subpixel}
                  onChange={(e) => updateOption('subpixel', e.target.checked)}
                  className="studio-switch"
                />
              </label>

              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Fondo Transparente</span>
                  <span className="toggle-sub">
                    Elimina automáticamente el color de fondo predominante
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!options.background}
                  onChange={(e) => updateOption('background', !e.target.checked)}
                  className="studio-switch"
                />
              </label>

              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Detectar Primitivas</span>
                  <span className="toggle-sub">
                    Sustituye arcos por rectángulos y círculos exactos
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={options.primitives}
                  onChange={(e) => updateOption('primitives', e.target.checked)}
                  className="studio-switch"
                />
              </label>

              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Soporte de Gradientes</span>
                  <span className="toggle-sub">
                    Detecta y vectoriza degradados lineales suaves
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={options.gradients}
                  onChange={(e) => updateOption('gradients', e.target.checked)}
                  className="studio-switch"
                />
              </label>
            </div>

            {/* Quick Node Reduction Action */}
            {onSimplifyNodes && (
              <div className="sidebar-optimize-card">
                <div className="sidebar-optimize-header">
                  <Sparkles size={14} className="text-amber" />
                  <span className="sidebar-optimize-title">Reducción Inteligente de Nodos</span>
                </div>
                <p className="sidebar-optimize-desc">
                  Elimina micro-nodos redundantes y alinea segmentos colineales (RDP) conservando la curvatura original.
                  {nodesCount !== undefined && (
                    <span className="sidebar-optimize-count"> Nodos actuales: <strong>{nodesCount}</strong></span>
                  )}
                </p>
                <button
                  className="btn-simplify-action"
                  onClick={onSimplifyNodes}
                  disabled={isProcessing}
                >
                  <Sparkles size={14} />
                  <span>Reducir Nodos del SVG</span>
                </button>
              </div>
            )}
          </div>

          {/* Extracted Palette with Interactive Click */}
          {palette.length > 0 && (
            <div className="sidebar-section">
              <div className="section-title">
                <Palette size={16} className="section-icon" />
                <span>Paleta Activa ({palette.length} colores)</span>
              </div>
              <div className="palette-instruction">
                Haz clic en cualquier muestra para cambiarla, hacerla transparente o copiar su código HEX.
              </div>

              <div className="palette-grid">
                {palette.slice(0, 32).map((col, idx) => (
                  <div
                    key={idx}
                    className="palette-swatch"
                    style={{ backgroundColor: col.hex }}
                    title={`${col.hex} (${col.percentage}%) - Clic para gestionar`}
                    onClick={() => onSelectColor(col)}
                  >
                    <span className="swatch-hover-val">{col.hex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Apply / Retrace Button */}
      <div className="sidebar-footer">
        <button
          className="btn-retrace"
          onClick={onRetrace}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="spinner-sm"></div>
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <RotateCcw size={16} />
              <span>
                {isCenterline ? 'Trazar Línea Central' : 'Re-vectorizar ahora'}
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
