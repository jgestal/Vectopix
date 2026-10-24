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
import { useI18n } from '../i18n';

interface MetricsBarProps {
  result: VectorResult | null;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ result }) => {
  const { t, lang } = useI18n();
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
            <div className="metric-item" title={t('metrics.centerlinesTitle')}>
              <Scissors size={14} className="metric-icon text-amber" />
              <span className="metric-label">{t('metrics.centerlines')}:</span>
              <span className="metric-value text-amber">{result.shapes.toLocaleString(lang)}</span>
            </div>

            <div className="metric-sep"></div>

            <div className="metric-item" title={t('metrics.lengthTitle')}>
              <Activity size={14} className="metric-icon" />
              <span className="metric-label">{t('metrics.length')}:</span>
              <span className="metric-value">{result.centerlineLength?.toLocaleString(lang) || 0} px</span>
            </div>
          </>
        ) : (
          <div className="metric-item" title={t('metrics.pathsTitle')}>
            <Activity size={14} className="metric-icon" />
            <span className="metric-label">{t('metrics.paths')}:</span>
            <span className="metric-value">{result.shapes.toLocaleString(lang)}</span>
          </div>
        )}

        <div className="metric-sep"></div>

        <div
          className="metric-item"
          title={t('metrics.nodesTitle')}
        >
          <GitCommit size={14} className="metric-icon" />
          <span className="metric-label">{t('metrics.nodes')}:</span>
          <span className="metric-value">{result.nodesCount.toLocaleString(lang)}</span>
        </div>

        <div className="metric-sep"></div>

        <div className="metric-item" title={t('metrics.timeTitle')}>
          <Clock size={14} className="metric-icon" />
          <span className="metric-label">{t('metrics.time')}:</span>
          <span className="metric-value">{result.executionTimeMs} ms</span>
        </div>

        <div className="metric-sep"></div>

        <div className="metric-item" title={t('metrics.sizeTitle')}>
          <HardDrive size={14} className="metric-icon" />
          <span className="metric-label">{t('metrics.size')}:</span>
          <span className="metric-value">
            {formatBytes(result.fileSizeBytes)}
            {compressionRatio > 0 && (
              <span className="metric-badge-save">-{compressionRatio}%</span>
            )}
          </span>
        </div>

        {result.ssim !== undefined && (
          <>
            <div className="metric-sep"></div>
            <div
              className="metric-item"
              title={t('metrics.fidelityTitle')}
            >
              <Zap size={14} className="metric-icon text-cyan" />
              <span className="metric-label">{t('metrics.fidelity')}:</span>
              <span className="metric-value text-cyan">
                {(result.ssim * 100).toFixed(1)}% SSIM
              </span>
            </div>
          </>
        )}
      </div>

      <div className="metrics-actions">
        <button
          className="btn-quick-copy"
          onClick={handleCopySvg}
          title={t('metrics.copyTitle')}
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald" />
              <span className="text-emerald">{t('metrics.copied')}</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>{t('metrics.copy')}</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
