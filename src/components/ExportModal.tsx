import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText } from 'lucide-react';
import type { ExportFormat, VectorResult } from '../types/vector';
import { requestExport } from '../services/vectorWorkerClient';
import { useI18n, type MessageKey } from '../i18n';
import { Dialog } from './ui/Dialog';
import {
  downloadFile,
  downloadBlob,
  downloadPdf,
  exportSvgToPngBlob,
  convertSvgToComponent,
  formatBytes,
} from '../utils/exportUtils';
import { minifySvg } from '../utils/imageProcessing';

interface ExportModalProps {
  onClose: () => void;
  result: VectorResult;
  baseFileName: string;
  imageDimensions: { width: number; height: number } | null;
  onShowToast: (text: string, type?: 'info' | 'success' | 'warning') => void;
}

type ExportTab = 'svg' | 'png' | 'components' | 'dxf' | 'eps' | 'pdf';

type ExportState =
  | { status: 'ready'; data: string | Uint8Array }
  | { status: 'error'; message: string };

const isCadFormat = (tab: ExportTab): tab is ExportFormat => tab === 'dxf' || tab === 'eps' || tab === 'pdf';

export const ExportModal: React.FC<ExportModalProps> = ({
  onClose,
  result,
  baseFileName,
  imageDimensions,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('svg');
  const [componentFramework, setComponentFramework] = useState<'react' | 'vue' | 'svelte'>('react');
  const [pngScale, setPngScale] = useState<number>(2);
  const [pngBgColor, setPngBgColor] = useState<'transparent' | '#ffffff' | '#0f172a'>('transparent');
  const [minifySvgEnabled, setMinifySvgEnabled] = useState<boolean>(true);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  // DXF / EPS / PDF are built only when their tab is opened (a format with
  // no entry yet is still loading). An unedited trace uses the worker's exact
  // geometry; after edits, or for engines the worker can't export, they are
  // built from the current SVG so every change is included.
  const hasEdits = result.svg !== result.originalSvg;
  const [cadExports, setCadExports] = useState<Partial<Record<ExportFormat, ExportState>>>({});
  const requestedFormats = useRef(new Set<ExportFormat>());
  useEffect(() => {
    if (!isCadFormat(activeTab) || requestedFormats.current.has(activeTab)) return;
    const format = activeTab;
    requestedFormats.current.add(format);
    const fromSvg = () =>
      import('../utils/svgExport').then(({ exportSvg }) => exportSvg(result.svg, format, result.isCenterline));
    (hasEdits ? fromSvg() : requestExport(format).catch(fromSvg))
      .then((data) => setCadExports((prev) => ({ ...prev, [format]: { status: 'ready', data } })))
      .catch((err: unknown) =>
        setCadExports((prev) => ({
          ...prev,
          [format]: { status: 'error', message: err instanceof Error ? err.message : String(err) },
        }))
      );
  }, [activeTab, hasEdits, result.svg, result.isCenterline]);

  const width = imageDimensions?.width || 400;
  const height = imageDimensions?.height || 400;
  const nameWithoutExt = baseFileName.replace(/\.[^/.]+$/, '');

  const optimizedSvg = useMemo(
    () => (minifySvgEnabled ? minifySvg(result.svg) : result.svg),
    [minifySvgEnabled, result.svg]
  );
  const componentCode = useMemo(
    () => (activeTab === 'components' ? convertSvgToComponent(optimizedSvg, componentFramework) : ''),
    [activeTab, optimizedSvg, componentFramework]
  );

  const cadText = (format: ExportFormat): string => {
    const state = cadExports[format];
    if (!state) return `/* ${t('export.generating', { format: format.toUpperCase() })} */`;
    if (state.status === 'error') return `/* ${state.message} */`;
    return typeof state.data === 'string' ? state.data : '';
  };
  const cadData = (format: ExportFormat) => {
    const state = cadExports[format];
    return state?.status === 'ready' ? state.data : null;
  };
  const pdfState = cadExports.pdf;

  const getActiveContent = (): string => {
    switch (activeTab) {
      case 'svg':
        return optimizedSvg;
      case 'components':
        return componentCode;
      case 'dxf':
      case 'eps':
        return cadText(activeTab);
      case 'pdf':
        return cadData('pdf')
          ? t('export.pdfInfo', { width, height })
          : cadText('pdf');
      case 'png':
        return t('export.pngInfo', { width: width * pngScale, height: height * pngScale, scale: pngScale });
    }
  };

  const handleDownload = async () => {
    switch (activeTab) {
      case 'svg': {
        const svgContent = optimizedSvg;
        downloadFile(svgContent, `${nameWithoutExt}.svg`, 'image/svg+xml');
        onShowToast(t('export.downloaded', { file: `${nameWithoutExt}.svg` }), 'success');
        break;
      }
      case 'png':
        try {
          setIsExportingPng(true);
          const blob = await exportSvgToPngBlob(result.svg, width, height, pngScale, pngBgColor);
          downloadBlob(blob, `${nameWithoutExt}_@${pngScale}x.png`);
          onShowToast(t('export.downloaded', { file: `${nameWithoutExt}_@${pngScale}x.png` }), 'success');
        } catch {
          onShowToast(t('export.pngError'), 'warning');
        } finally {
          setIsExportingPng(false);
        }
        break;
      case 'components': {
        const ext = componentFramework === 'react' ? 'tsx' : componentFramework;
        downloadFile(componentCode, `VectorGraphic.${ext}`, 'text/plain');
        onShowToast(t('export.downloaded', { file: `VectorGraphic.${ext}` }), 'success');
        break;
      }
      case 'dxf':
      case 'eps':
      case 'pdf': {
        const data = cadData(activeTab);
        if (!data) {
          onShowToast(t('export.notAvailable', { format: activeTab.toUpperCase() }), 'warning');
        } else if (activeTab === 'pdf') {
          downloadPdf(data, `${nameWithoutExt}.pdf`);
          onShowToast(t('export.downloaded', { file: `${nameWithoutExt}.pdf` }), 'success');
        } else if (activeTab === 'dxf') {
          downloadFile(data as string, `${nameWithoutExt}.dxf`, 'application/dxf');
          onShowToast(t('export.downloaded', { file: `${nameWithoutExt}.dxf` }), 'success');
        } else {
          downloadFile(data as string, `${nameWithoutExt}.eps`, 'application/postscript');
          onShowToast(t('export.downloaded', { file: `${nameWithoutExt}.eps` }), 'success');
        }
        break;
      }
    }
  };

  const handleCopy = async () => {
    const text = getActiveContent();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onShowToast(t('export.copiedToast'), 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: ExportTab; label: MessageKey }[] = [
    { id: 'svg', label: 'export.tabSvg' },
    { id: 'png', label: 'export.tabPng' },
    { id: 'components', label: 'export.tabComponents' },
    { id: 'dxf', label: 'export.tabDxf' },
    { id: 'eps', label: 'export.tabEps' },
    { id: 'pdf', label: 'export.tabPdf' },
  ];

  const badge: Record<ExportTab, string> = {
    svg: `image/svg+xml, ${formatBytes(new Blob([optimizedSvg]).size)}`,
    png: t('export.badgePng', { scale: pngScale }),
    components: t('export.badgeComponent', { framework: componentFramework.toUpperCase() }),
    dxf: t('export.badgeDxf'),
    eps: t('export.badgeEps'),
    pdf: t('export.badgePdf'),
  };

  return (
    <Dialog
      title={t('export.title')}
      onClose={onClose}
      className="export-dialog"
      footer={
        <>
          <span className="dialog-footnote">{badge[activeTab]}</span>
          <button className="btn" onClick={onClose}>
            {t('export.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isExportingPng || (isCadFormat(activeTab) && !cadData(activeTab))}
          >
            <Download size={16} />
            {isExportingPng
              ? t('export.generatingPng')
              : t('export.download', {
                  format: activeTab === 'components' ? componentFramework.toUpperCase() : activeTab.toUpperCase(),
                })}
          </button>
        </>
      }
    >
      <p className="dialog-intro">{t('export.subtitle')}</p>

      <div className="tabs" role="tablist">
        {tabs.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={activeTab === id} className="tab" onClick={() => setActiveTab(id)}>
            {t(label)}
          </button>
        ))}
      </div>

      <div className="export-options">
        {activeTab === 'svg' && (
          <label className="check-row">
            <input type="checkbox" checked={minifySvgEnabled} onChange={(e) => setMinifySvgEnabled(e.target.checked)} />
            <span className="check-title">{t('export.minify')}</span>
          </label>
        )}

        {activeTab === 'png' && (
          <>
            <div className="option-row">
              <span className="option-label">{t('export.scale')}</span>
              <div className="segmented" role="group" aria-label={t('export.scale')}>
                {[1, 2, 4, 8].map((s) => (
                  <button key={s} aria-pressed={pngScale === s} onClick={() => setPngScale(s)} title={`${width * s} × ${height * s} px`}>
                    {s}×
                  </button>
                ))}
              </div>
              <span className="option-hint">
                {width * pngScale} × {height * pngScale} px
              </span>
            </div>
            <div className="option-row">
              <span className="option-label">{t('export.background')}</span>
              <div className="segmented" role="group" aria-label={t('export.background')}>
                {(
                  [
                    ['transparent', 'export.bgTransparent'],
                    ['#ffffff', 'export.bgWhite'],
                    ['#0f172a', 'export.bgDark'],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} aria-pressed={pngBgColor === value} onClick={() => setPngBgColor(value)}>
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'components' && (
          <div className="option-row">
            <span className="option-label">{t('export.framework')}</span>
            <div className="segmented" role="group" aria-label={t('export.framework')}>
              {(['react', 'vue', 'svelte'] as const).map((fw) => (
                <button key={fw} aria-pressed={componentFramework === fw} onClick={() => setComponentFramework(fw)}>
                  {fw === 'react' ? 'React' : fw === 'vue' ? 'Vue' : 'Svelte'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'png' ? (
        <div className="export-preview checker" style={{ background: pngBgColor === 'transparent' ? undefined : pngBgColor }}>
          <div className="export-preview-svg" dangerouslySetInnerHTML={{ __html: result.svg }} />
        </div>
      ) : activeTab === 'pdf' && pdfState?.status !== 'error' ? (
        <div className="export-preview export-pdf">
          <FileText size={40} strokeWidth={1.25} />
          <h3>{t(pdfState?.status === 'ready' ? 'export.pdfReadyTitle' : 'export.pdfGenerating')}</h3>
          <p>{t('export.pdfDesc')}</p>
          <dl>
            <dt>{t('export.pdfDimensions')}</dt>
            <dd>
              {width} × {height} pt
            </dd>
            <dt>{t('export.pdfColorSpace')}</dt>
            <dd>sRGB</dd>
            <dt>{t('export.pdfPathType')}</dt>
            <dd>{t(result.isCenterline ? 'export.pdfPolylines' : 'export.pdfSplines')}</dd>
          </dl>
        </div>
      ) : (
        <div className="code-block">
          <button className="btn btn-small code-copy" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t('export.copied') : t('export.copyCode')}
          </button>
          <pre className="code-viewer">
            <code>{getActiveContent()}</code>
          </pre>
        </div>
      )}
    </Dialog>
  );
};
