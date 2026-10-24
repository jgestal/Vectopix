import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Code2,
  FileCode,
  Printer,
  Scissors,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import type { ExportFormat, VectorResult } from '../types/vector';
import { requestExport } from '../services/vectorWorkerClient';
import { useI18n } from '../i18n';
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">{t('export.title')}</h2>
            <span className="modal-subtitle">
              {t('export.subtitle')}
            </span>
          </div>
          <button className="modal-close" onClick={onClose} title={t('export.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'svg' ? 'active' : ''}`}
            onClick={() => setActiveTab('svg')}
          >
            <FileCode size={16} />
            <span>{t('export.tabSvg')}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'png' ? 'active' : ''}`}
            onClick={() => setActiveTab('png')}
          >
            <ImageIcon size={16} />
            <span>{t('export.tabPng')}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'components' ? 'active' : ''}`}
            onClick={() => setActiveTab('components')}
          >
            <Code2 size={16} />
            <span>{t('export.tabComponents')}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'dxf' ? 'active' : ''}`}
            onClick={() => setActiveTab('dxf')}
          >
            <Scissors size={16} />
            <span>{t('export.tabDxf')}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'eps' ? 'active' : ''}`}
            onClick={() => setActiveTab('eps')}
          >
            <Printer size={16} />
            <span>{t('export.tabEps')}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <FileText size={16} />
            <span>{t('export.tabPdf')}</span>
          </button>
        </div>

        {/* Tab-Specific Sub-Bars */}
        {activeTab === 'svg' && (
          <div className="export-subbar">
            <span className="subbar-label">{t('export.optimization')}</span>
            <label className="subbar-checkbox-label">
              <input
                type="checkbox"
                checked={minifySvgEnabled}
                onChange={(e) => setMinifySvgEnabled(e.target.checked)}
                className="studio-switch"
              />
              <span className="text-secondary text-sm">
                {t('export.minify')}
              </span>
            </label>
          </div>
        )}

        {activeTab === 'png' && (
          <div className="export-subbar">
            <div className="subbar-group">
              <span className="subbar-label">{t('export.scale')}</span>
              <div className="scale-selector">
                {[1, 2, 4, 8].map((s) => (
                  <button
                    key={s}
                    className={`scale-btn ${pngScale === s ? 'active' : ''}`}
                    onClick={() => setPngScale(s)}
                  >
                    @{s}x ({width * s} × {height * s} px)
                  </button>
                ))}
              </div>
            </div>

            <div className="subbar-group">
              <span className="subbar-label">{t('export.background')}</span>
              <div className="scale-selector">
                <button
                  className={`scale-btn ${pngBgColor === 'transparent' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('transparent')}
                >
                  {t('export.bgTransparent')}
                </button>
                <button
                  className={`scale-btn ${pngBgColor === '#ffffff' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('#ffffff')}
                >
                  {t('export.bgWhite')}
                </button>
                <button
                  className={`scale-btn ${pngBgColor === '#0f172a' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('#0f172a')}
                >
                  {t('export.bgDark')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="export-subbar">
            <span className="subbar-label">{t('export.framework')}</span>
            <div className="framework-selector">
              {(['react', 'vue', 'svelte'] as const).map((fw) => (
                <button
                  key={fw}
                  className={`scale-btn ${componentFramework === fw ? 'active' : ''}`}
                  onClick={() => setComponentFramework(fw)}
                >
                  {fw.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Code / Content Preview */}
        <div className="modal-preview-body">
          <div className="preview-toolbar">
            <span className="file-info-badge">
              {activeTab === 'svg' &&
                `image/svg+xml • ${formatBytes(new Blob([optimizedSvg]).size)}`}
              {activeTab === 'png' && t('export.badgePng', { scale: pngScale })}
              {activeTab === 'components' && t('export.badgeComponent', { framework: componentFramework.toUpperCase() })}
              {activeTab === 'dxf' && t('export.badgeDxf')}
              {activeTab === 'eps' && t('export.badgeEps')}
              {activeTab === 'pdf' && t('export.badgePdf')}
            </span>

            {activeTab !== 'png' && (
              <button className="btn-copy-code" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald" />
                    <span className="text-emerald">{t('export.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>{t('export.copyCode')}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {activeTab === 'png' ? (
            <div className="png-preview-card">
              <div
                className="png-preview-canvas-box"
                style={{ backgroundColor: pngBgColor === 'transparent' ? undefined : pngBgColor }}
              >
                <div
                  className="png-preview-svg"
                  dangerouslySetInnerHTML={{ __html: result.svg }}
                />
              </div>
              <div className="png-preview-meta">
                <span>
                  {t('export.pngResolution')}{' '}
                  <strong>{width * pngScale} × {height * pngScale} px</strong>
                </span>
                <span>
                  {t('export.pngBackground')} {pngBgColor === 'transparent' ? t('export.pngTransparentAlpha') : pngBgColor}
                </span>
              </div>
            </div>
          ) : activeTab === 'pdf' && pdfState?.status !== 'error' ? (
            <div className="pdf-preview-card">
              <div className="pdf-icon-badge">
                <FileText size={36} className="text-cyan" />
              </div>
              <h3 className="pdf-preview-title">
                {t(pdfState?.status === 'ready' ? 'export.pdfReadyTitle' : 'export.pdfGenerating')}
              </h3>
              <p className="pdf-preview-desc">
                {t('export.pdfDesc')}
              </p>
              <div className="pdf-specs-grid">
                <div className="spec-item">
                  <span className="spec-lbl">{t('export.pdfDimensions')}</span>
                  <span className="spec-val">{width} × {height} pt</span>
                </div>
                <div className="spec-item">
                  <span className="spec-lbl">{t('export.pdfColorSpace')}</span>
                  <span className="spec-val">sRGB</span>
                </div>
                <div className="spec-item">
                  <span className="spec-lbl">{t('export.pdfPathType')}</span>
                  <span className="spec-val">{t(result.isCenterline ? 'export.pdfPolylines' : 'export.pdfSplines')}</span>
                </div>
              </div>
            </div>
          ) : (
            <pre className="code-viewer">
              <code>{getActiveContent()}</code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t('export.cancel')}
          </button>
          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={isExportingPng || (isCadFormat(activeTab) && !cadData(activeTab))}
          >
            <Download size={16} />
            <span>
              {isExportingPng
                ? t('export.generatingPng')
                : t('export.download', {
                    format: activeTab === 'components' ? componentFramework.toUpperCase() : activeTab.toUpperCase(),
                  })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
