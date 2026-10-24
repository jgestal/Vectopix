import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Copy, Palette } from 'lucide-react';
import type { PaletteColor } from '../types/vector';

interface ColorModalProps {
  color: PaletteColor | null;
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
  const [selectedHex, setSelectedHex] = useState<string>(color?.hex || '#ffffff');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (color) {
      setSelectedHex(color.hex);
      setCopied(false);
    }
  }, [color]);

  if (!color) return null;

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
            <span>Gestionar Color de la Paleta</span>
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
                {color.percentage}% de cobertura ({color.count.toLocaleString()} px)
              </div>
            </div>
          </div>

          {/* Color Replacement Picker */}
          <div className="replacement-section">
            <label className="section-sub-label">Sustituir por un nuevo color:</label>
            <div className="replacement-picker-row">
              <input
                type="color"
                value={selectedHex}
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
                disabled={selectedHex.toLowerCase() === color.hex.toLowerCase()}
              >
                <Check size={14} />
                <span>Aplicar Cambio</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="color-actions-row">
            <button className="btn-color-action" onClick={handleCopyHex}>
              {copied ? (
                <>
                  <Check size={14} className="text-emerald" />
                  <span className="text-emerald">HEX Copiado</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar HEX</span>
                </>
              )}
            </button>

            <button
              className="btn-color-action danger"
              onClick={handleRemove}
              title="Eliminar todos los trazados que usen este color (hacer transparente)"
            >
              <Trash2 size={14} />
              <span>Hacer Transparente</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
