import React from 'react';
import { MagicEdit, Sparkles } from 'pixelarticons/react';
import type { VectorOptions, VectorPreset, TraceMethod } from '../types/vector';
import { useI18n, type MessageKey } from '../i18n';

interface SidebarProps {
  options: VectorOptions;
  setOptions: React.Dispatch<React.SetStateAction<VectorOptions>>;
  onApplyPreset: (preset: VectorPreset) => void;
  isProcessing: boolean;
  onRetrace: () => void;
  isCenterline?: boolean;
  onSimplifyNodes?: () => void;
  nodesCount?: number;
}

/** Presets shown for each trace method; `key` covers sketch's centerline variant. */
const OUTLINE_PRESETS: VectorPreset[] = ['logo', 'flat-art', 'photo', 'sketch', 'pixel-art'];
const CENTERLINE_PRESETS: { preset: VectorPreset; key: string }[] = [
  { preset: 'centerline-sketch', key: 'centerline-sketch' },
  { preset: 'sketch', key: 'sketch-centerline' },
];

interface SliderProps {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ticks?: string[];
}

const Slider: React.FC<SliderProps> = ({ id, label, value, display, min, max, step, onChange, ticks }) => (
  <div className="control-group">
    <div className="control-header">
      <label htmlFor={id}>{label}</label>
      <span className="control-val r-field">{display}</span>
    </div>
    <input
      id={id}
      type="range"
      className="r-range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    {ticks && (
      <div className="slider-ticks">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    )}
  </div>
);

const Toggle: React.FC<{ title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  title,
  desc,
  checked,
  onChange,
}) => (
  <label className="toggle-item">
    <input type="checkbox" className="r-check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="toggle-info">
      <span className="toggle-title">{title}</span>
      <span className="toggle-sub">{desc}</span>
    </span>
  </label>
);

/** Properties panel: tracing method, presets and every engine setting. */
export const Sidebar: React.FC<SidebarProps> = ({
  options,
  setOptions,
  onApplyPreset,
  isProcessing,
  onRetrace,
  isCenterline,
  onSimplifyNodes,
  nodesCount,
}) => {
  const { t } = useI18n();

  const updateOption = <K extends keyof VectorOptions>(key: K, val: VectorOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: val, preset: 'custom' }));
  };

  const handleTraceMethodChange = (method: TraceMethod) => {
    setOptions((prev) => ({
      ...prev,
      traceMethod: method,
      preset: method === 'centerline' ? 'centerline-sketch' : 'logo',
    }));
  };

  const presets =
    options.traceMethod === 'centerline'
      ? CENTERLINE_PRESETS
      : OUTLINE_PRESETS.map((preset) => ({ preset, key: preset }));

  return (
    <aside className="properties">
      <div className="properties-scroll">
        <fieldset className="r-group">
          <legend>{t('sidebar.method')}</legend>
          {(['outline', 'centerline'] as const).map((method) => (
            <label key={method} className="radio-item">
              <input
                type="radio"
                name="trace-method"
                className="r-radio"
                checked={options.traceMethod === method}
                onChange={() => handleTraceMethodChange(method)}
              />
              <span className="toggle-info">
                <span className="toggle-title">{t(`sidebar.${method}` as MessageKey)}</span>
                <span className="toggle-sub">{t(`sidebar.${method}Desc` as MessageKey)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="r-group">
          <legend>{t('sidebar.presets')}</legend>
          <ul className="r-listbox" role="listbox" aria-label={t('sidebar.presets')}>
            {presets.map(({ preset, key }) => (
              <li key={key} role="option" aria-selected={options.preset === preset}>
                <button
                  className={`listbox-item ${options.preset === preset ? 'is-selected' : ''}`}
                  onClick={() => onApplyPreset(preset)}
                >
                  <span className="preset-name">{t(`preset.${key}.name` as MessageKey)}</span>
                  <span className="preset-desc">{t(`preset.${key}.desc` as MessageKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {options.traceMethod === 'centerline' ? (
          <fieldset className="r-group">
            <legend>{t('sidebar.centerlineParams')}</legend>
            <Slider
              id="cl-width-slider"
              label={t('sidebar.strokeWidth')}
              value={options.centerlineStrokeWidth}
              display={`${options.centerlineStrokeWidth} px`}
              min={1}
              max={10}
              step={0.5}
              onChange={(v) => updateOption('centerlineStrokeWidth', v)}
            />
            <div className="control-group">
              <div className="control-header">
                <label htmlFor="cl-color-input">{t('sidebar.strokeColor')}</label>
                <span className="control-val r-field">{options.centerlineStrokeColor}</span>
              </div>
              <input
                id="cl-color-input"
                type="color"
                className="r-color-input"
                value={options.centerlineStrokeColor}
                onChange={(e) => updateOption('centerlineStrokeColor', e.target.value)}
              />
            </div>
            <Toggle
              title={t('sidebar.adaptive')}
              desc={t('sidebar.adaptiveDesc')}
              checked={options.centerlineAdaptive}
              onChange={(v) => updateOption('centerlineAdaptive', v)}
            />
            <Toggle
              title={t('sidebar.darkOnLight')}
              desc={t('sidebar.darkOnLightDesc')}
              checked={options.centerlineBlackOnWhite}
              onChange={(v) => updateOption('centerlineBlackOnWhite', v)}
            />
          </fieldset>
        ) : (
          <>
            <fieldset className="r-group">
              <legend>{t('sidebar.engine')}</legend>
              {(['vecline', 'imagetracer'] as const).map((engine) => (
                <label key={engine} className="radio-item">
                  <input
                    type="radio"
                    name="engine"
                    className="r-radio"
                    checked={options.engine === engine}
                    onChange={() => updateOption('engine', engine)}
                  />
                  <span className="toggle-info">
                    <span className="toggle-title">
                      {engine === 'vecline' ? t('sidebar.engineVecline') : 'ImageTracerJS'}
                      {engine === 'vecline' && <span className="rec-tag">{t('sidebar.recommended')}</span>}
                    </span>
                    <span className="toggle-sub">
                      {t(engine === 'vecline' ? 'sidebar.engineVeclineDesc' : 'sidebar.engineImageTracerDesc')}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="r-group">
              <legend>{t('sidebar.preprocessing')}</legend>
              <Slider
                id="contrast-slider"
                label={t('sidebar.contrast')}
                value={options.contrast}
                display={`${options.contrast > 0 ? '+' : ''}${options.contrast}%`}
                min={-50}
                max={50}
                step={5}
                onChange={(v) => updateOption('contrast', v)}
              />
              <Slider
                id="denoise-slider"
                label={t('sidebar.denoise')}
                value={options.denoise}
                display={String(options.denoise)}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateOption('denoise', v)}
              />
            </fieldset>

            <fieldset className="r-group">
              <legend>{t('sidebar.precision')}</legend>
              <Slider
                id="color-slider"
                label={t('sidebar.colors')}
                value={options.colors}
                display={String(options.colors)}
                min={2}
                max={64}
                step={1}
                onChange={(v) => updateOption('colors', v)}
                ticks={[t('sidebar.colorsMin'), t('sidebar.colorsMid'), t('sidebar.colorsMax')]}
              />
              <Slider
                id="tolerance-slider"
                label={t('sidebar.tolerance')}
                value={options.fitError}
                display={options.fitError.toFixed(2)}
                min={0.1}
                max={1.5}
                step={0.05}
                onChange={(v) => setOptions((prev) => ({ ...prev, fitError: v, tolerance: v, preset: 'custom' }))}
                ticks={[t('sidebar.toleranceMin'), t('sidebar.toleranceMid'), t('sidebar.toleranceMax')]}
              />
              <Slider
                id="smooth-slider"
                label={t('sidebar.smooth')}
                value={options.smooth ?? 1}
                display={t(
                  options.smooth === 0
                    ? 'sidebar.smoothOff'
                    : options.smooth === 2
                      ? 'sidebar.smoothUltra'
                      : 'sidebar.smoothStandard'
                )}
                min={0}
                max={2}
                step={1}
                onChange={(v) => updateOption('smooth', v)}
                ticks={[t('sidebar.smoothMin'), t('sidebar.smoothMid'), t('sidebar.smoothMax')]}
              />
              <Slider
                id="minarea-slider"
                label={t('sidebar.minArea')}
                value={options.minArea}
                display={`${options.minArea} px`}
                min={0}
                max={40}
                step={1}
                onChange={(v) => updateOption('minArea', v)}
                ticks={[t('sidebar.minAreaMin'), '10 px', t('sidebar.minAreaMax')]}
              />
              <Slider
                id="corner-slider"
                label={t('sidebar.cornerAngle')}
                value={options.cornerAngle}
                display={`${options.cornerAngle}°`}
                min={30}
                max={120}
                step={5}
                onChange={(v) => updateOption('cornerAngle', v)}
              />
            </fieldset>

            <fieldset className="r-group">
              <legend>{t('sidebar.filters')}</legend>
              <Toggle
                title={t('sidebar.subpixel')}
                desc={t('sidebar.subpixelDesc')}
                checked={options.subpixel}
                onChange={(v) => updateOption('subpixel', v)}
              />
              <Toggle
                title={t('sidebar.transparent')}
                desc={t('sidebar.transparentDesc')}
                checked={!options.background}
                onChange={(v) => updateOption('background', !v)}
              />
              <Toggle
                title={t('sidebar.primitives')}
                desc={t('sidebar.primitivesDesc')}
                checked={options.primitives}
                onChange={(v) => updateOption('primitives', v)}
              />
              <Toggle
                title={t('sidebar.gradients')}
                desc={t('sidebar.gradientsDesc')}
                checked={options.gradients}
                onChange={(v) => updateOption('gradients', v)}
              />
            </fieldset>

            {onSimplifyNodes && (
              <fieldset className="r-group">
                <legend>{t('sidebar.simplifyTitle')}</legend>
                <p className="group-desc">
                  {t('sidebar.simplifyDesc')}
                  {nodesCount !== undefined && (
                    <>
                      {' '}
                      {t('sidebar.currentNodes')} <strong>{nodesCount}</strong>
                    </>
                  )}
                </p>
                <button className="r-btn full-width" onClick={onSimplifyNodes} disabled={isProcessing}>
                  <Sparkles width={12} height={12} className="r-icon" />
                  {t('sidebar.simplifyButton')}
                </button>
              </fieldset>
            )}
          </>
        )}
      </div>

      <div className="properties-footer">
        <button className="r-btn is-default full-width" onClick={onRetrace} disabled={isProcessing}>
          <MagicEdit width={12} height={12} className="r-icon" />
          {isProcessing ? t('sidebar.processing') : t(isCenterline ? 'sidebar.traceCenterline' : 'sidebar.retrace')}
        </button>
      </div>
    </aside>
  );
};
