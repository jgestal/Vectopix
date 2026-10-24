import React, { useState } from 'react';
import {
  Activity,
  GitCommit,
  Clock,
  HardDrive,
  Check,
  Copy,
  Zap,
  Scissors,
} from 'lucide-react';
import type { VectorResult } from '../types/vector';
import { formatBytes } from '../utils/exportUtils';

interface MetricsBarProps {
  result: VectorResult | null;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopySvg = async () => {
    try {
      await navigator.clipboard.writeText(result.svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const compressionRatio =
    result.rasterSizeBytes > 0
      ? Math.round(
          ((result.rasterSizeBytes - result.fileSizeBytes) /
            result.rasterSizeBytes) *
            100
        )
      : 0;

  return (
    <footer className="studio-metrics-bar">
      <div className="metrics-group">
        {result.isCenterline ? (
          <>
            <div className="metric-item" title="Trazos de línea central generados">
              <Scissors size={14} className="metric-icon text-amber" />
              <span className="metric-label">Líneas de Centro:</span>
              <span className="metric-value text-amber">{result.shapes.toLocaleString()}</span>
            </div>

            <div className="metric-sep"></div>

            <div className="metric-item" title="Longitud acumulada de corte o grabado láser">
              <Activity size={14} className="metric-icon" />
              <span className="metric-label">Longitud de trazo:</span>
              <span className="metric-value">{result.centerlineLength?.toLocaleString() || 0} px</span>
            </div>
          </>
        ) : (
          <div className="metric-item" title="Caminos y polígonos vectoriales creados">
            <Activity size={14} className="metric-icon" />
            <span className="metric-label">Trazos:</span>
            <span className="metric-value">{result.shapes.toLocaleString()}</span>
          </div>
        )}

        <div className="metric-sep"></div>

        <div
          className="metric-item"
          title="Nodos y puntos de control Bézier totales (mínimos = curvas más limpias)"
        >
          <GitCommit size={14} className="metric-icon" />
          <span className="metric-label">Nodos Bézier:</span>
          <span className="metric-value">{result.nodesCount.toLocaleString()}</span>
        </div>

        <div className="metric-sep"></div>

        <div className="metric-item" title="Tiempo de procesamiento en Web Worker">
          <Clock size={14} className="metric-icon" />
          <span className="metric-label">Tiempo:</span>
          <span className="metric-value">{result.executionTimeMs} ms</span>
        </div>

        <div className="metric-sep"></div>

        <div className="metric-item" title="Tamaño del archivo">
          <HardDrive size={14} className="metric-icon" />
          <span className="metric-label">Peso:</span>
          <span className="metric-value">
            {formatBytes(result.fileSizeBytes)}
            {compressionRatio > 0 && (
              <span className="metric-badge-save">-{compressionRatio}%</span>
            )}
          </span>
        </div>

        {result.estimatedSsim && (
          <>
            <div className="metric-sep"></div>
            <div
              className="metric-item"
              title="Fidelidad de contorno estimada (SSIM)"
            >
              <Zap size={14} className="metric-icon text-cyan" />
              <span className="metric-label">Fidelidad:</span>
              <span className="metric-value text-cyan">
                {(result.estimatedSsim * 100).toFixed(1)}% SSIM
              </span>
            </div>
          </>
        )}
      </div>

      <div className="metrics-actions">
        <button
          className="btn-quick-copy"
          onClick={handleCopySvg}
          title="Copiar código SVG al portapapeles"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald" />
              <span className="text-emerald">¡Copiado!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copiar SVG</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
