import React, { useState } from 'react';
import { X, Check, Trash2, Copy, Palette } from 'lucide-react';
import type { PaletteColor } from '../types/vector';
import { normalizeHex } from '../utils/paletteUtils';
import { useI18n } from '../i18n';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface ColorModalProps {
  color: PaletteColor;
  onClose: () => void;
  onReplaceColor: (oldHex: string, newHex: string) => void;
  onRemoveColor: (hex: string) => void;
}

export const ColorModal: React.FC<ColorModalProps> = ({
  color,
  onClose,
  onReplaceColor,
  onRemoveColor,
}) => {
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

  const handleApplyReplacement = () => {
    onReplaceColor(color.hex, selectedHex);
    onClose();
  };

  const handleRemove = () => {
    onRemoveColor(color.hex);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="color-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="color-modal-header">
          <div className="color-modal-title">
            <Palette size={16} className="text-cyan" />
            <span>{t('color.title')}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="color-modal-body">
          {/* Swatch & Details */}
          <div className="swatch-detail-row">
            <div
              className="large-swatch-preview"
              style={{ backgroundColor: color.hex }}
            ></div>
            <div className="swatch-info-col">
              <div className="swatch-hex-display">{color.hex}</div>
              <div className="swatch-rgb-display">
                RGB({color.r}, {color.g}, {color.b})
              </div>
              <div className="swatch-coverage-badge">
                {t('color.coverage', { pct: color.percentage, count: color.count.toLocaleString(lang) })}
              </div>
            </div>
          </div>

          {/* Color Replacement Picker */}
          <div className="replacement-section">
            <label className="section-sub-label">{t('color.replaceLabel')}</label>
            <div className="replacement-picker-row">
              <input
                type="color"
                value={isValidHex ? normalizeHex(selectedHex) : '#000000'}
                onChange={(e) => setSelectedHex(e.target.value)}
                className="modal-color-input"
              />
              <input
                type="text"
                value={selectedHex}
                onChange={(e) => setSelectedHex(e.target.value)}
                className="modal-hex-text-input"
              />
              <button
                className="btn-apply-color"
                onClick={handleApplyReplacement}
                disabled={!isValidHex || selectedHex.toLowerCase() === color.hex.toLowerCase()}
              >
                <Check size={14} />
                <span>{t('color.apply')}</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="color-actions-row">
            <button className="btn-color-action" onClick={handleCopyHex}>
              {copied ? (
                <>
                  <Check size={14} className="text-emerald" />
                  <span className="text-emerald">{t('color.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>{t('color.copyHex')}</span>
                </>
              )}
            </button>

            <button
              className="btn-color-action danger"
              onClick={handleRemove}
              title={t('color.makeTransparentTitle')}
            >
              <Trash2 size={14} />
              <span>{t('color.makeTransparent')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
