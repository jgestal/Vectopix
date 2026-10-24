import React, { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import type { PaletteColor } from '../types/vector';
import { normalizeHex } from '../utils/paletteUtils';
import { useI18n } from '../i18n';
import { Dialog } from './ui/Dialog';

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
    <Dialog
      title={t('color.title')}
      onClose={onClose}
      className="color-dialog"
      footer={
        <>
          <button className="btn" onClick={handleRemove} title={t('color.makeTransparentTitle')}>
            <Trash2 size={15} />
            {t('color.makeTransparent')}
          </button>
          <span className="footer-spacer" />
          <button className="btn" onClick={onClose}>
            {t('export.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!isValidHex || selectedHex.toLowerCase() === color.hex.toLowerCase()}
          >
            {t('color.apply')}
          </button>
        </>
      }
    >
      <div className="color-detail">
        <span className="color-preview" style={{ background: color.hex }} />
        <div className="color-info">
          <div className="color-hex">
            {color.hex}
            <button className="icon-btn" onClick={handleCopyHex} title={t('color.copyHex')} aria-label={t('color.copyHex')}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="color-meta">
            RGB {color.r}, {color.g}, {color.b}
          </div>
          <div className="color-meta">{t('color.coverage', { pct: color.percentage, count: color.count.toLocaleString(lang) })}</div>
        </div>
      </div>

      <label className="color-replace" htmlFor="color-replace-input">
        {t('color.replaceLabel')}
      </label>
      <div className="color-replace-row">
        <input
          type="color"
          className="color-input"
          value={isValidHex ? normalizeHex(selectedHex) : '#000000'}
          onChange={(e) => setSelectedHex(e.target.value)}
          aria-label={t('color.replaceLabel')}
        />
        <input
          id="color-replace-input"
          type="text"
          className="field color-hex-input"
          value={selectedHex}
          onChange={(e) => setSelectedHex(e.target.value)}
          spellCheck={false}
        />
      </div>
    </Dialog>
  );
};
