import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { VectorResult, WorkerProgress } from '../types/vector';
import { formatBytes } from '../utils/exportUtils';
import { useI18n, type MessageKey } from '../i18n';

interface MetricsBarProps {
  result: VectorResult | null;
  progress: WorkerProgress | null;
}

/** Status bar: what the engine is doing, then the numbers of the current trace. */
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
      // Clipboard can be blocked; Cmd/Ctrl+C offers the same action
    }
  };

  const metrics: { label: MessageKey; title: MessageKey; value: string }[] = [];
  if (result) {
    const savings =
      result.rasterSizeBytes > 0
        ? Math.round(((result.rasterSizeBytes - result.fileSizeBytes) / result.rasterSizeBytes) * 100)
        : 0;
    if (result.isCenterline) {
      metrics.push({ label: 'metrics.centerlines', title: 'metrics.centerlinesTitle', value: result.shapes.toLocaleString(lang) });
      metrics.push({
        label: 'metrics.length',
        title: 'metrics.lengthTitle',
        value: `${(result.centerlineLength ?? 0).toLocaleString(lang)} px`,
      });
    } else {
      metrics.push({ label: 'metrics.paths', title: 'metrics.pathsTitle', value: result.shapes.toLocaleString(lang) });
    }
    metrics.push({ label: 'metrics.nodes', title: 'metrics.nodesTitle', value: result.nodesCount.toLocaleString(lang) });
    metrics.push({ label: 'metrics.time', title: 'metrics.timeTitle', value: `${result.executionTimeMs} ms` });
    metrics.push({
      label: 'metrics.size',
      title: 'metrics.sizeTitle',
      value: formatBytes(result.fileSizeBytes) + (savings > 0 ? ` (−${savings}%)` : ''),
    });
    if (result.ssim !== undefined) {
      metrics.push({ label: 'metrics.fidelity', title: 'metrics.fidelityTitle', value: `${(result.ssim * 100).toFixed(1)}%` });
    }
  }

  return (
    <footer className="statusbar">
      <span className={`status-message ${progress ? 'is-busy' : ''}`}>
        {progress ? t(progress.stage) : t('status.idle')}
      </span>
      <dl className="status-metrics">
        {metrics.map((m) => (
          <div key={m.label} title={t(m.title)}>
            <dt>{t(m.label)}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>
      {result && (
        <button className="btn btn-small btn-quiet" onClick={handleCopySvg} title={t('metrics.copyTitle')}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('metrics.copied') : t('metrics.copy')}
        </button>
      )}
    </footer>
  );
};
