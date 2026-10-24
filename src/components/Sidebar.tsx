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
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
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
          <span>{t('sidebar.method')}</span>
        </div>
        <div className="method-toggle-group">
          <button
            className={`method-btn ${options.traceMethod === 'outline' ? 'active' : ''}`}
            onClick={() => handleTraceMethodChange('outline')}
          >
            <div className="method-btn-title">
              <Activity size={14} />
              <span>{t('sidebar.outline')}</span>
            </div>
            <div className="method-btn-desc">{t('sidebar.outlineDesc')}</div>
          </button>

          <button
            className={`method-btn ${options.traceMethod === 'centerline' ? 'active' : ''}`}
            onClick={() => handleTraceMethodChange('centerline')}
          >
            <div className="method-btn-title">
              <Scissors size={14} />
              <span>{t('sidebar.centerline')}</span>
            </div>
            <div className="method-btn-desc">{t('sidebar.centerlineDesc')}</div>
          </button>
        </div>
      </div>

      {/* Presets Section */}
      <div className="sidebar-section">
        <div className="section-title">
          <Wand2 size={16} className="section-icon" />
          <span>{t('sidebar.presets')}</span>
        </div>
        <div className="presets-grid">
          {options.traceMethod === 'centerline' ? (
            <>
              <button
                className={`preset-card ${options.preset === 'centerline-sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('centerline-sketch')}
              >
                <div className="preset-name">{t('preset.centerline-sketch.name')}</div>
                <div className="preset-desc">{t('preset.centerline-sketch.desc')}</div>
              </button>
              <button
                className={`preset-card ${options.preset === 'sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('sketch')}
              >
                <div className="preset-name">{t('preset.sketch-centerline.name')}</div>
                <div className="preset-desc">{t('preset.sketch-centerline.desc')}</div>
              </button>
            </>
          ) : (
            <>
              <button
                className={`preset-card ${options.preset === 'logo' ? 'active' : ''}`}
                onClick={() => onApplyPreset('logo')}
              >
                <div className="preset-name">{t('preset.logo.name')}</div>
                <div className="preset-desc">{t('preset.logo.desc')}</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'flat-art' ? 'active' : ''}`}
                onClick={() => onApplyPreset('flat-art')}
              >
                <div className="preset-name">{t('preset.flat-art.name')}</div>
                <div className="preset-desc">{t('preset.flat-art.desc')}</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'photo' ? 'active' : ''}`}
                onClick={() => onApplyPreset('photo')}
              >
                <div className="preset-name">{t('preset.photo.name')}</div>
                <div className="preset-desc">{t('preset.photo.desc')}</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'sketch' ? 'active' : ''}`}
                onClick={() => onApplyPreset('sketch')}
              >
                <div className="preset-name">{t('preset.sketch.name')}</div>
                <div className="preset-desc">{t('preset.sketch.desc')}</div>
              </button>

              <button
                className={`preset-card ${options.preset === 'pixel-art' ? 'active' : ''}`}
                onClick={() => onApplyPreset('pixel-art')}
              >
                <div className="preset-name">{t('preset.pixel-art.name')}</div>
                <div className="preset-desc">{t('preset.pixel-art.desc')}</div>
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
            <span>{t('sidebar.centerlineParams')}</span>
          </div>

          <div className="control-group">
            <div className="control-header">
              <label htmlFor="cl-width-slider">{t('sidebar.strokeWidth')}</label>
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
              <label htmlFor="cl-color-input">{t('sidebar.strokeColor')}</label>
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
                <span className="toggle-title">{t('sidebar.adaptive')}</span>
                <span className="toggle-sub">{t('sidebar.adaptiveDesc')}</span>
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
                <span className="toggle-title">{t('sidebar.darkOnLight')}</span>
                <span className="toggle-sub">{t('sidebar.darkOnLightDesc')}</span>
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
              <span>{t('sidebar.engine')}</span>
            </div>
            <div className="engine-toggle-group">
              <button
                className={`engine-btn ${options.engine === 'vecline' ? 'active' : ''}`}
                onClick={() => updateOption('engine', 'vecline')}
              >
                <div className="engine-title">
                  <span>{t('sidebar.engineVecline')}</span>
                  <span className="rec-tag">{t('sidebar.recommended')}</span>
                </div>
                <div className="engine-sub">{t('sidebar.engineVeclineDesc')}</div>
              </button>

              <button
                className={`engine-btn ${options.engine === 'imagetracer' ? 'active' : ''}`}
                onClick={() => updateOption('engine', 'imagetracer')}
              >
                <div className="engine-title">
                  <span>ImageTracerJS</span>
                </div>
                <div className="engine-sub">{t('sidebar.engineImageTracerDesc')}</div>
              </button>
            </div>
          </div>

          {/* Preprocessing Controls */}
          <div className="sidebar-section">
            <div className="section-title">
              <SlidersHorizontal size={16} className="section-icon" />
              <span>{t('sidebar.preprocessing')}</span>
            </div>

            <div className="control-group">
              <div className="control-header">
                <label htmlFor="contrast-slider">{t('sidebar.contrast')}</label>
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
                <label htmlFor="denoise-slider">{t('sidebar.denoise')}</label>
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
              <span>{t('sidebar.precision')}</span>
            </div>

            {/* Colors */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="color-slider">{t('sidebar.colors')}</label>
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
                <span>{t('sidebar.colorsMin')}</span>
                <span>{t('sidebar.colorsMid')}</span>
                <span>{t('sidebar.colorsMax')}</span>
              </div>
            </div>

            {/* Curve Fitting Error (Tolerance) */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="tolerance-slider">{t('sidebar.tolerance')}</label>
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
                <span>{t('sidebar.toleranceMin')}</span>
                <span>{t('sidebar.toleranceMid')}</span>
                <span>{t('sidebar.toleranceMax')}</span>
              </div>
            </div>

            {/* Bézier Smoothing */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="smooth-slider">{t('sidebar.smooth')}</label>
                <span className="control-val">
                  {t(
                    options.smooth === 0
                      ? 'sidebar.smoothOff'
                      : options.smooth === 2
                        ? 'sidebar.smoothUltra'
                        : 'sidebar.smoothStandard'
                  )}
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
                <span>{t('sidebar.smoothMin')}</span>
                <span>{t('sidebar.smoothMid')}</span>
                <span>{t('sidebar.smoothMax')}</span>
              </div>
            </div>

            {/* Noise Filter (Min Area) */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="minarea-slider">{t('sidebar.minArea')}</label>
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
                <span>{t('sidebar.minAreaMin')}</span>
                <span>10 px</span>
                <span>{t('sidebar.minAreaMax')}</span>
              </div>
            </div>

            {/* Corner Angle */}
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="corner-slider">{t('sidebar.cornerAngle')}</label>
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
              <span>{t('sidebar.filters')}</span>
            </div>

            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">{t('sidebar.subpixel')}</span>
                  <span className="toggle-sub">{t('sidebar.subpixelDesc')}</span>
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
                  <span className="toggle-title">{t('sidebar.transparent')}</span>
                  <span className="toggle-sub">{t('sidebar.transparentDesc')}</span>
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
                  <span className="toggle-title">{t('sidebar.primitives')}</span>
                  <span className="toggle-sub">{t('sidebar.primitivesDesc')}</span>
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
                  <span className="toggle-title">{t('sidebar.gradients')}</span>
                  <span className="toggle-sub">{t('sidebar.gradientsDesc')}</span>
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
                  <span className="sidebar-optimize-title">{t('sidebar.simplifyTitle')}</span>
                </div>
                <p className="sidebar-optimize-desc">
                  {t('sidebar.simplifyDesc')}
                  {nodesCount !== undefined && (
                    <span className="sidebar-optimize-count"> {t('sidebar.currentNodes')} <strong>{nodesCount}</strong></span>
                  )}
                </p>
                <button
                  className="btn-simplify-action"
                  onClick={onSimplifyNodes}
                  disabled={isProcessing}
                >
                  <Sparkles size={14} />
                  <span>{t('sidebar.simplifyButton')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Extracted Palette with Interactive Click */}
          {palette.length > 0 && (
            <div className="sidebar-section">
              <div className="section-title">
                <Palette size={16} className="section-icon" />
                <span>{t('sidebar.palette', { count: palette.length })}</span>
              </div>
              <div className="palette-instruction">
                {t('sidebar.paletteHint')}
              </div>

              <div className="palette-grid">
                {palette.slice(0, 32).map((col, idx) => (
                  <div
                    key={idx}
                    className="palette-swatch"
                    style={{ backgroundColor: col.hex }}
                    title={t('sidebar.swatchTitle', { hex: col.hex, pct: col.percentage })}
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
              <span>{t('sidebar.processing')}</span>
            </>
          ) : (
            <>
              <RotateCcw size={16} />
              <span>
                {t(isCenterline ? 'sidebar.traceCenterline' : 'sidebar.retrace')}
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
