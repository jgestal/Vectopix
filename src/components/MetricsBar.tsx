import React, { useState } from 'react';
import { Copy } from 'pixelarticons/react';
import type { VectorResult, WorkerProgress } from '../types/vector';
import { formatBytes } from '../utils/exportUtils';
import { useI18n, type MessageKey } from '../i18n';

interface MetricsBarProps {
  result: VectorResult | null;
  progress: WorkerProgress | null;
}

/** Windows status bar: a message field, then sunken cells with the metrics. */
export const MetricsBar: React.FC<MetricsBarProps> = ({ result, progress }) => {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopySvg = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the menu offers the same action
    }
  };

  const cells: { label: MessageKey; title: MessageKey; value: string }[] = [];
  if (result) {
    const savings =
      result.rasterSizeBytes > 0
        ? Math.round(((result.rasterSizeBytes - result.fileSizeBytes) / result.rasterSizeBytes) * 100)
        : 0;
    if (result.isCenterline) {
      cells.push({ label: 'metrics.centerlines', title: 'metrics.centerlinesTitle', value: result.shapes.toLocaleString(lang) });
      cells.push({
        label: 'metrics.length',
        title: 'metrics.lengthTitle',
        value: `${(result.centerlineLength ?? 0).toLocaleString(lang)} px`,
      });
    } else {
      cells.push({ label: 'metrics.paths', title: 'metrics.pathsTitle', value: result.shapes.toLocaleString(lang) });
    }
    cells.push({ label: 'metrics.nodes', title: 'metrics.nodesTitle', value: result.nodesCount.toLocaleString(lang) });
    cells.push({ label: 'metrics.time', title: 'metrics.timeTitle', value: `${result.executionTimeMs} ms` });
    cells.push({
      label: 'metrics.size',
      title: 'metrics.sizeTitle',
      value: formatBytes(result.fileSizeBytes) + (savings > 0 ? ` (−${savings}%)` : ''),
    });
    if (result.ssim !== undefined) {
      cells.push({ label: 'metrics.fidelity', title: 'metrics.fidelityTitle', value: `${(result.ssim * 100).toFixed(1)}%` });
    }
  }

  return (
    <footer className="statusbar">
      <div className="r-status-field statusbar-message">{progress ? t(progress.stage) : t('status.idle')}</div>
      {cells.map((cell) => (
        <div key={cell.label} className="r-status-field" title={t(cell.title)}>
          <span className="metric-label">{t(cell.label)}:</span>
          <span className="metric-value">{cell.value}</span>
        </div>
      ))}
      {result && (
        <button className="r-btn r-btn-small" onClick={handleCopySvg} title={t('metrics.copyTitle')}>
          <Copy width={12} height={12} className="r-icon" />
          {copied ? t('metrics.copied') : t('metrics.copy')}
        </button>
      )}
    </footer>
  );
};
