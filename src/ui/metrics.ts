import type { VectorResult } from '../domain/types';
import { formatBytes } from '../domain/format';
import type { MessageKey } from '../i18n';

export interface Metric {
  label: MessageKey;
  title: MessageKey;
  value: string;
}

/** How much smaller the SVG is than the source image (%), or 0. */
function savingsPercent({ rasterSizeBytes, fileSizeBytes }: VectorResult): number {
  return rasterSizeBytes > 0 ? Math.round(((rasterSizeBytes - fileSizeBytes) / rasterSizeBytes) * 100) : 0;
}

/** The status bar figures for a trace, in the reader's number format. */
export function metricsFor(result: VectorResult, lang: string): Metric[] {
  const n = (value: number) => value.toLocaleString(lang);
  const savings = savingsPercent(result);
  const shapes: Metric[] = result.isCenterline
    ? [
        { label: 'metrics.centerlines', title: 'metrics.centerlinesTitle', value: n(result.shapes) },
        { label: 'metrics.length', title: 'metrics.lengthTitle', value: `${n(result.centerlineLength ?? 0)} px` },
      ]
    : [{ label: 'metrics.paths', title: 'metrics.pathsTitle', value: n(result.shapes) }];
  const fidelity: Metric[] =
    result.ssim === undefined ? [] : [{ label: 'metrics.fidelity', title: 'metrics.fidelityTitle', value: `${(result.ssim * 100).toFixed(1)}%` }];
  return [
    ...shapes,
    { label: 'metrics.nodes', title: 'metrics.nodesTitle', value: n(result.nodesCount) },
    { label: 'metrics.time', title: 'metrics.timeTitle', value: `${result.executionTimeMs} ms` },
    { label: 'metrics.size', title: 'metrics.sizeTitle', value: formatBytes(result.fileSizeBytes) + (savings > 0 ? ` (−${savings}%)` : '') },
    ...fidelity,
  ];
}
