import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { PaletteColor, VectorOptions } from '../../../domain/types';
import { useI18n, type MessageKey } from '../../../i18n';
import { Slider, Toggle } from './Controls';

/** Changes one setting (the preset becomes "custom"). */
export type UpdateOption = <K extends keyof VectorOptions>(key: K, value: VectorOptions[K]) => void;

const SMOOTH_LABELS: Record<number, MessageKey> = { 0: 'sidebar.smoothOff', 1: 'sidebar.smoothStandard', 2: 'sidebar.smoothUltra' };

export function CenterlineSettings({ options, updateOption }: { options: VectorOptions; updateOption: UpdateOption }) {
  const { t } = useI18n();
  return (
    <section className="settings-section">
      <h3>{t('sidebar.centerlineParams')}</h3>
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
      <div className="control control-row">
        <label htmlFor="cl-color-input">{t('sidebar.strokeColor')}</label>
        <input
          id="cl-color-input"
          type="color"
          className="color-input"
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
    </section>
  );
}

export function ColourSettings({
  options,
  updateOption,
  palette,
  onSelectColor,
}: {
  options: VectorOptions;
  updateOption: UpdateOption;
  palette: PaletteColor[];
  onSelectColor: (color: PaletteColor) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-section">
      <div className="control">
        <div className="control-row">
          <span className="control-label-inline">{t('sidebar.colors')}</span>
          <output>{options.autoColors ? palette.length || '' : options.colors}</output>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={options.autoColors}
            onChange={(e) => updateOption('autoColors', e.target.checked)}
          />
          <span>
            <span className="check-title">{t('sidebar.autoColors')}</span>
            <span className="check-desc">{t('sidebar.autoColorsDesc')}</span>
          </span>
        </label>
        {!options.autoColors && (
          <input
            id="color-slider"
            type="range"
            min={2}
            max={64}
            step={1}
            value={options.colors}
            onChange={(e) => updateOption('colors', Number(e.target.value))}
            aria-label={t('sidebar.colors')}
          />
        )}
      </div>
      {palette.length > 0 && (
        <div className="palette" aria-label={t('sidebar.palette', { count: palette.length })}>
          {palette.map((color) => (
            <button
              key={color.hex}
              className="swatch"
              style={{ background: color.hex }}
              onClick={() => onSelectColor(color)}
              title={t('sidebar.swatchTitle', { hex: color.hex, pct: color.percentage })}
              aria-label={color.hex}
            />
          ))}
        </div>
      )}
      {palette.length > 0 && <p className="section-note">{t('sidebar.paletteHint')}</p>}
    </section>
  );
}

export function AdvancedSettings({
  options,
  updateOption,
  setOptions,
  isProcessing,
  onSimplifyNodes,
  nodesCount,
}: {
  options: VectorOptions;
  updateOption: UpdateOption;
  setOptions: React.Dispatch<React.SetStateAction<VectorOptions>>;
  isProcessing: boolean;
  onSimplifyNodes: () => void;
  nodesCount?: number;
}) {
  const { t } = useI18n();
  return (
    <details className="settings-section advanced">
      <summary>
        <ChevronRight size={16} className="advanced-chevron" />
        {t('sidebar.advanced')}
      </summary>

      <Toggle
        title={t('sidebar.refine')}
        desc={t('sidebar.refineDesc')}
        checked={options.refine}
        onChange={(v) => updateOption('refine', v)}
      />

      <div className="control">
        <span className="control-label">{t('sidebar.engine')}</span>
        <div className="segmented is-full" role="group" aria-label={t('sidebar.engine')}>
          <button aria-pressed={options.engine === 'vecline'} onClick={() => updateOption('engine', 'vecline')}>
            Vecline
          </button>
          <button aria-pressed={options.engine === 'imagetracer'} onClick={() => updateOption('engine', 'imagetracer')}>
            ImageTracerJS
          </button>
        </div>
        <p className="control-hint">
          {t(options.engine === 'vecline' ? 'sidebar.engineVeclineDesc' : 'sidebar.engineImageTracerDesc')}
        </p>
      </div>

      <Slider
        id="tolerance-slider"
        label={t('sidebar.tolerance')}
        value={options.fitError}
        display={options.fitError.toFixed(2)}
        min={0.1}
        max={1.5}
        step={0.05}
        onChange={(v) => setOptions((prev) => ({ ...prev, fitError: v, tolerance: v, preset: 'custom' }))}
        hint={`${t('sidebar.toleranceMin')} – ${t('sidebar.toleranceMax')}`}
      />
      <Slider
        id="smooth-slider"
        label={t('sidebar.smooth')}
        value={options.smooth ?? 1}
        display={t(SMOOTH_LABELS[options.smooth] ?? 'sidebar.smoothStandard')}
        min={0}
        max={2}
        step={1}
        onChange={(v) => updateOption('smooth', v)}
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

      <Toggle
        title={t('sidebar.subpixel')}
        desc={t('sidebar.subpixelDesc')}
        checked={options.subpixel}
        onChange={(v) => updateOption('subpixel', v)}
      />
      <Toggle
        title={t('sidebar.pixelGrid')}
        desc={t('sidebar.pixelGridDesc')}
        checked={options.pixelGrid}
        onChange={(v) => updateOption('pixelGrid', v)}
      />
      <Toggle
        title={t('sidebar.transparent')}
        desc={t('sidebar.transparentDesc')}
        checked={options.transparentBackground}
        onChange={(v) => updateOption('transparentBackground', v)}
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

      <div className="control simplify">
        <p className="control-hint">
          {t('sidebar.simplifyDesc')}
          {nodesCount !== undefined && ` ${t('sidebar.currentNodes')} ${nodesCount}.`}
        </p>
        <button className="btn btn-small" onClick={onSimplifyNodes} disabled={isProcessing}>
          <Sparkles size={14} />
          {t('sidebar.simplifyButton')}
        </button>
      </div>
    </details>
  );
}
