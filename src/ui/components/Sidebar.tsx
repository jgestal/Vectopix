import React from 'react';
import { RotateCcw } from 'lucide-react';
import { AdvancedSettings, CenterlineSettings, ColourSettings } from './sidebar/Sections';
import type { PaletteColor, TraceMethod, VectorOptions, VectorPreset } from '../../domain/types';
import { useI18n, type MessageKey } from '../../i18n';
import { withOption, withTraceMethod } from '../../domain/presets';

interface SidebarProps {
  options: VectorOptions;
  setOptions: React.Dispatch<React.SetStateAction<VectorOptions>>;
  onApplyPreset: (preset: VectorPreset) => void;
  palette: PaletteColor[];
  onSelectColor: (color: PaletteColor) => void;
  isProcessing: boolean;
  onRetrace: () => void;
  onSimplifyNodes: () => void;
  nodesCount?: number;
}

/** Presets per trace method; `key` covers sketch's centerline variant. */
const OUTLINE_PRESETS: VectorPreset[] = ['logo', 'flat-art', 'photo', 'sketch', 'pixel-art'];
const CENTERLINE_PRESETS: { preset: VectorPreset; key: string }[] = [
  { preset: 'centerline-sketch', key: 'centerline-sketch' },
  { preset: 'sketch', key: 'sketch-centerline' },
];

/**
 * Settings panel. The choices most people need (method, preset, colours,
 * palette) are always visible; engine tuning is folded under "Advanced".
 */
export const Sidebar: React.FC<SidebarProps> = ({
  options,
  setOptions,
  onApplyPreset,
  palette,
  onSelectColor,
  isProcessing,
  onRetrace,
  onSimplifyNodes,
  nodesCount,
}) => {
  const { t } = useI18n();
  const isCenterline = options.traceMethod === 'centerline';

  const updateOption = <K extends keyof VectorOptions>(key: K, val: VectorOptions[K]) => setOptions((prev) => withOption(prev, key, val));
  const handleTraceMethodChange = (method: TraceMethod) => setOptions((prev) => withTraceMethod(prev, method));

  const presets = isCenterline
    ? CENTERLINE_PRESETS
    : OUTLINE_PRESETS.map((preset) => ({ preset, key: preset }));

  return (
    <aside className="settings">
      <div className="settings-scroll">
        <section className="settings-section">
          <h3>{t('sidebar.method')}</h3>
          <div className="segmented is-full" role="group" aria-label={t('sidebar.method')}>
            {(['outline', 'centerline'] as const).map((method) => (
              <button
                key={method}
                aria-pressed={options.traceMethod === method}
                onClick={() => handleTraceMethodChange(method)}
              >
                {t(`sidebar.${method}` as MessageKey)}
              </button>
            ))}
          </div>
          <p className="section-note">{t(isCenterline ? 'sidebar.centerlineDesc' : 'sidebar.outlineDesc')}</p>
        </section>

        <section className="settings-section">
          <h3>{t('sidebar.presets')}</h3>
          <div className="preset-list" role="radiogroup" aria-label={t('sidebar.presets')}>
            {presets.map(({ preset, key }) => (
              <label key={key} className={`preset ${options.preset === preset ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="preset"
                  checked={options.preset === preset}
                  onChange={() => onApplyPreset(preset)}
                />
                <span>
                  <span className="preset-name">{t(`preset.${key}.name` as MessageKey)}</span>
                  <span className="preset-desc">{t(`preset.${key}.desc` as MessageKey)}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {isCenterline ? (
          <CenterlineSettings options={options} updateOption={updateOption} />
        ) : (
          <>
            <ColourSettings options={options} updateOption={updateOption} palette={palette} onSelectColor={onSelectColor} />

            <AdvancedSettings
              options={options}
              updateOption={updateOption}
              setOptions={setOptions}
              isProcessing={isProcessing}
              onSimplifyNodes={onSimplifyNodes}
              nodesCount={nodesCount}
            />
          </>
        )}
      </div>

      <div className="settings-footer">
        <button className="btn btn-block" onClick={onRetrace} disabled={isProcessing}>
          <RotateCcw size={15} />
          {isProcessing ? t('sidebar.processing') : t(isCenterline ? 'sidebar.traceCenterline' : 'sidebar.retrace')}
        </button>
      </div>
    </aside>
  );
};
