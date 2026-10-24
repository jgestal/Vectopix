import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code, Copy, Cut, Download, FileText, Image as ImageIcon, Printer, Save } from 'pixelarticons/react';
import type { ExportFormat, VectorResult } from '../types/vector';
import { requestExport } from '../services/vectorWorkerClient';
import { useI18n, type MessageKey } from '../i18n';
import { RetroDialog } from './retro/RetroWindow';
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

  const tabs: { id: ExportTab; label: MessageKey; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { id: 'svg', label: 'export.tabSvg', icon: Save },
    { id: 'png', label: 'export.tabPng', icon: ImageIcon },
    { id: 'components', label: 'export.tabComponents', icon: Code },
    { id: 'dxf', label: 'export.tabDxf', icon: Cut },
    { id: 'eps', label: 'export.tabEps', icon: Printer },
    { id: 'pdf', label: 'export.tabPdf', icon: FileText },
  ];

  const badge: Record<ExportTab, string> = {
    svg: `image/svg+xml · ${formatBytes(new Blob([optimizedSvg]).size)}`,
    png: t('export.badgePng', { scale: pngScale }),
    components: t('export.badgeComponent', { framework: componentFramework.toUpperCase() }),
    dxf: t('export.badgeDxf'),
    eps: t('export.badgeEps'),
    pdf: t('export.badgePdf'),
  };

  return (
    <RetroDialog
      title={t('export.title')}
      icon={<Download width={16} height={16} />}
      onClose={onClose}
      closeLabel={t('export.close')}
      className="export-window"
      bodyClassName="export-body"
    >
      <p className="dialog-intro">{t('export.subtitle')}</p>

      <div className="r-tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`r-tab ${activeTab === id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon width={12} height={12} className="r-icon" />
            {t(label)}
          </button>
        ))}
      </div>

      <div className="r-tab-panel" role="tabpanel">
        {activeTab === 'svg' && (
          <label className="toggle-item export-option">
            <input
              type="checkbox"
              className="r-check"
              checked={minifySvgEnabled}
              onChange={(e) => setMinifySvgEnabled(e.target.checked)}
            />
            <span>{t('export.minify')}</span>
          </label>
        )}

        {activeTab === 'png' && (
          <div className="export-options-grid">
            <fieldset className="r-group">
              <legend>{t('export.scale')}</legend>
              {[1, 2, 4, 8].map((s) => (
                <label key={s} className="radio-item compact">
                  <input type="radio" className="r-radio" name="png-scale" checked={pngScale === s} onChange={() => setPngScale(s)} />
                  <span>
                    @{s}x ({width * s} × {height * s} px)
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="r-group">
              <legend>{t('export.background')}</legend>
              {(
                [
                  ['transparent', 'export.bgTransparent'],
                  ['#ffffff', 'export.bgWhite'],
                  ['#0f172a', 'export.bgDark'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="radio-item compact">
                  <input type="radio" className="r-radio" name="png-bg" checked={pngBgColor === value} onChange={() => setPngBgColor(value)} />
                  <span>{t(label)}</span>
                </label>
              ))}
            </fieldset>
          </div>
        )}

        {activeTab === 'components' && (
          <fieldset className="r-group">
            <legend>{t('export.framework')}</legend>
            <div className="radio-row">
              {(['react', 'vue', 'svelte'] as const).map((fw) => (
                <label key={fw} className="radio-item compact">
                  <input type="radio" className="r-radio" name="framework" checked={componentFramework === fw} onChange={() => setComponentFramework(fw)} />
                  <span>{fw.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="preview-toolbar">
          <span className="file-info-badge">{badge[activeTab]}</span>
          {activeTab !== 'png' && activeTab !== 'pdf' && (
            <button className="r-btn r-btn-small" onClick={handleCopy}>
              <Copy width={12} height={12} className="r-icon" />
              {copied ? t('export.copied') : t('export.copyCode')}
            </button>
          )}
        </div>

        {activeTab === 'png' ? (
          <div className="png-preview r-field" style={{ background: pngBgColor === 'transparent' ? undefined : pngBgColor }}>
            <div className="png-preview-svg" dangerouslySetInnerHTML={{ __html: result.svg }} />
          </div>
        ) : activeTab === 'pdf' && pdfState?.status !== 'error' ? (
          <div className="pdf-preview r-field">
            <FileText width={48} height={48} className="r-icon" />
            <h3 className="pdf-preview-title">
              {t(pdfState?.status === 'ready' ? 'export.pdfReadyTitle' : 'export.pdfGenerating')}
            </h3>
            <p>{t('export.pdfDesc')}</p>
            <dl className="pdf-specs">
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
          <pre className="code-viewer r-field">
            <code>{getActiveContent()}</code>
          </pre>
        )}
      </div>

      <div className="r-dialog-footer">
        <button
          className="r-btn is-default"
          onClick={handleDownload}
          disabled={isExportingPng || (isCadFormat(activeTab) && !cadData(activeTab))}
        >
          <Download width={12} height={12} className="r-icon" />
          {isExportingPng
            ? t('export.generatingPng')
            : t('export.download', {
                format: activeTab === 'components' ? componentFramework.toUpperCase() : activeTab.toUpperCase(),
              })}
        </button>
        <button className="r-btn" onClick={onClose}>
          {t('export.cancel')}
        </button>
      </div>
    </RetroDialog>
  );
};
