import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { VectorResult, WorkerProgress } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { metricsFor } from '../metrics';

interface MetricsBarProps {
  result: VectorResult | null;
  progress: WorkerProgress | null;
}

/** Status bar: what the engine is doing, then the numbers of the current trace. */
export const MetricsBar: React.FC<MetricsBarProps> = ({ result, progress }) => {
  const { t, lang } = useI18n();
  const { files } = useServices();
  const [copied, setCopied] = useState(false);

  const handleCopySvg = () => {
    if (!result) return;
    // A blocked clipboard is not worth a message: ⌘/Ctrl+C offers the same action
    files.copyText(result.svg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, () => {});
  };

  const metrics = result ? metricsFor(result, lang) : [];

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
