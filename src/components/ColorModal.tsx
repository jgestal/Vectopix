import React, { useState } from 'react';
import { ColorsSwatch, Copy, Trash } from 'pixelarticons/react';
import type { PaletteColor } from '../types/vector';
import { normalizeHex } from '../utils/paletteUtils';
import { useI18n } from '../i18n';
import { RetroDialog } from './retro/RetroWindow';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface ColorModalProps {
  color: PaletteColor;
  onClose: () => void;
  onReplaceColor: (oldHex: string, newHex: string) => void;
  onRemoveColor: (hex: string) => void;
}

/** Paint's "Edit Colors" dialog: inspect a palette colour, replace it or drop it. */
export const ColorModal: React.FC<ColorModalProps> = ({ color, onClose, onReplaceColor, onRemoveColor }) => {
  const { t, lang } = useI18n();
  // App remounts this modal per color (via `key`), so state starts fresh each time
  const [selectedHex, setSelectedHex] = useState<string>(color.hex);
  const [copied, setCopied] = useState(false);
  const isValidHex = HEX_PATTERN.test(selectedHex);

  const handleCopyHex = async () => {
    await navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onReplaceColor(color.hex, selectedHex);
    onClose();
  };

  const handleRemove = () => {
    onRemoveColor(color.hex);
    onClose();
  };

  return (
    <RetroDialog
      title={t('color.title')}
      icon={<ColorsSwatch width={16} height={16} />}
      onClose={onClose}
      closeLabel={t('export.close')}
      className="color-window"
    >
      <div className="color-detail">
        <span className="color-preview r-field" style={{ background: color.hex }} />
        <div className="color-info">
          <div className="color-hex">{color.hex}</div>
          <div>
            RGB({color.r}, {color.g}, {color.b})
          </div>
          <div>{t('color.coverage', { pct: color.percentage, count: color.count.toLocaleString(lang) })}</div>
        </div>
      </div>

      <fieldset className="r-group">
        <legend>{t('color.replaceLabel')}</legend>
        <div className="color-replace-row">
          <input
            type="color"
            className="r-color-input"
            value={isValidHex ? normalizeHex(selectedHex) : '#000000'}
            onChange={(e) => setSelectedHex(e.target.value)}
          />
          <input
            type="text"
            className="r-field color-hex-input"
            value={selectedHex}
            onChange={(e) => setSelectedHex(e.target.value)}
            spellCheck={false}
          />
        </div>
      </fieldset>

      <div className="r-dialog-footer color-footer">
        <button className="r-btn" onClick={handleCopyHex}>
          <Copy width={12} height={12} className="r-icon" />
          {copied ? t('color.copied') : t('color.copyHex')}
        </button>
        <button className="r-btn" onClick={handleRemove} title={t('color.makeTransparentTitle')}>
          <Trash width={12} height={12} className="r-icon" />
          {t('color.makeTransparent')}
        </button>
        <span className="footer-spacer" />
        <button
          className="r-btn is-default"
          onClick={handleApply}
          disabled={!isValidHex || selectedHex.toLowerCase() === color.hex.toLowerCase()}
        >
          {t('color.apply')}
        </button>
        <button className="r-btn" onClick={onClose}>
          {t('export.cancel')}
        </button>
      </div>
    </RetroDialog>
  );
};
