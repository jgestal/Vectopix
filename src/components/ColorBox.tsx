import React from 'react';
import type { PaletteColor } from '../types/vector';
import { useI18n } from '../i18n';

const SLOTS = 28;

/**
 * Paint's colour box: the two dominant colours as overlapping "current
 * colour" squares, then the palette in two rows. Empty slots stay grey,
 * just like an unused palette in Paint.
 */
export const ColorBox: React.FC<{ palette: PaletteColor[]; onSelect: (color: PaletteColor) => void }> = ({
  palette,
  onSelect,
}) => {
  const { t } = useI18n();
  const slots = Array.from({ length: Math.max(SLOTS, palette.length) }, (_, i) => palette[i] ?? null);
  const [primary, secondary] = palette;

  return (
    <div className="colorbox" aria-label={t('sidebar.palette', { count: palette.length })} title={t('sidebar.paletteHint')}>
      <div className="colorbox-current" aria-hidden="true">
        <span className="colorbox-current-back" style={{ background: secondary?.hex ?? 'var(--r-white)' }} />
        <span className="colorbox-current-front" style={{ background: primary?.hex ?? 'var(--r-text)' }} />
      </div>
      <div className="colorbox-grid">
        {slots.map((color, i) =>
          color ? (
            <button
              key={i}
              className="colorbox-swatch"
              style={{ background: color.hex }}
              title={t('sidebar.swatchTitle', { hex: color.hex, pct: color.percentage })}
              aria-label={color.hex}
              onClick={() => onSelect(color)}
            />
          ) : (
            <span key={i} className="colorbox-swatch is-empty" aria-hidden="true" />
          )
        )}
      </div>
      <span className="colorbox-caption">{t('sidebar.palette', { count: palette.length })}</span>
    </div>
  );
};
