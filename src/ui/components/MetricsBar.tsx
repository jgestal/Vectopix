import React, { useState } from 'react';
import { Check, Copy, GripVertical } from 'lucide-react';
import { EXPORT_MIME, exportFileName } from '../../domain/export/exportFiles';
import type { VectorResult, WorkerProgress } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { metricsFor } from '../metrics';

interface MetricsBarProps {
  result: VectorResult | null;
  progress: WorkerProgress | null;
  /** The source image's name: what a dragged-out SVG is called. */
  fileName: string;
}

/** Status bar: what the engine is doing, then the numbers of the current trace. */
export const MetricsBar: React.FC<MetricsBarProps> = ({ result, progress, fileName }) => {
  const { t, lang } = useI18n();
  const { files, exporter } = useServices();
  const svgFileName = exportFileName('svg', fileName, { pngScale: 1, framework: 'react' });
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
        <>
          <span
            className="btn btn-small btn-quiet drag-out"
            draggable
            onDragStart={(e) => files.dragOut(e.nativeEvent, svgFileName, exporter.minify(result.svg), EXPORT_MIME.svg)}
            title={t('metrics.dragTitle')}
            role="img"
            aria-label={t('metrics.dragTitle')}
          >
            <GripVertical size={14} />
            {t('metrics.drag')}
          </span>
          <button className="btn btn-small btn-quiet" onClick={handleCopySvg} title={t('metrics.copyTitle')}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t('metrics.copied') : t('metrics.copy')}
          </button>
        </>
      )}
    </footer>
  );
};
