import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText } from 'lucide-react';
import type { ExportFormat, VectorResult } from '../../domain/types';
import { useI18n, type MessageKey } from '../../i18n';
import { Dialog } from './ui/Dialog';
import { useServices } from '../services/context';
import { usePreference } from '../hooks/usePreference';
import { errorMessage } from '../errors';
import { formatBytes } from '../../domain/format';
import { EXPORT_MIME, EXPORT_TABS, PNG_SCALES, exportFileName, type ComponentFramework, type ExportTab } from '../../domain/export/exportFiles';

interface ExportModalProps {
  onClose: () => void;
  result: VectorResult;
  baseFileName: string;
  imageDimensions: { width: number; height: number } | null;
  onShowToast: (text: string, type?: 'info' | 'success' | 'warning') => void;
}

type ExportState =
  | { status: 'ready'; data: string | Uint8Array }
  | { status: 'error'; message: string };

const isCadFormat = (tab: ExportTab): tab is ExportFormat => tab === 'dxf' || tab === 'eps' || tab === 'pdf';

/** Export choices, remembered between sessions: people export the same way again. */
const EXPORT_DEFAULTS = {
  tab: 'svg' as ExportTab,
  framework: 'react' as ComponentFramework,
  pngScale: 2,
  pngBackground: 'transparent' as 'transparent' | '#ffffff' | '#0f172a',
  minify: true,
};
type ExportChoices = typeof EXPORT_DEFAULTS;
const EXPORT_VALUES = {
  tab: EXPORT_TABS,
  framework: ['react', 'vue', 'svelte'] as ComponentFramework[],
  pngScale: [...PNG_SCALES],
  pngBackground: ['transparent', '#ffffff', '#0f172a'] as ExportChoices['pngBackground'][],
};

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, result, baseFileName, imageDimensions, onShowToast }) => {
  const { t } = useI18n();
  const { exporter, files } = useServices();
  const [choices, setChoices] = usePreference('export', EXPORT_DEFAULTS, EXPORT_VALUES);
  const choose = <K extends keyof ExportChoices>(key: K) => (value: ExportChoices[K]) => setChoices((c) => ({ ...c, [key]: value }));
  const { tab: activeTab, framework: componentFramework, pngScale, pngBackground: pngBgColor, minify: minifySvgEnabled } = choices;
  const [setActiveTab, setComponentFramework, setPngScale, setPngBgColor, setMinifySvgEnabled] = [
    choose('tab'),
    choose('framework'),
    choose('pngScale'),
    choose('pngBackground'),
    choose('minify'),
  ];
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [copied, setCopied] = useState(false);

  // DXF / EPS / PDF are built from the current SVG, only when their tab is
  // opened (a format with no entry yet is still loading). Building from the
  // SVG means node and colour edits are always included.
  const [cadExports, setCadExports] = useState<Partial<Record<ExportFormat, ExportState>>>({});
  const requestedFormats = useRef(new Set<ExportFormat>());
  useEffect(() => {
    if (!isCadFormat(activeTab) || requestedFormats.current.has(activeTab)) return;
    const format = activeTab;
    requestedFormats.current.add(format);
    exporter
      .cad(result.svg, format, !!result.isCenterline)
      .then((data) => setCadExports((prev) => ({ ...prev, [format]: { status: 'ready', data } })))
      .catch((err: unknown) =>
        setCadExports((prev) => ({ ...prev, [format]: { status: 'error', message: err instanceof Error ? err.message : String(err) } }))
      );
  }, [activeTab, result.svg, result.isCenterline, exporter]);

  const width = imageDimensions?.width || 400;
  const height = imageDimensions?.height || 400;

  const optimizedSvg = useMemo(() => (minifySvgEnabled ? exporter.minify(result.svg) : result.svg), [minifySvgEnabled, result.svg, exporter]);
  const componentCode = useMemo(
    () => (activeTab === 'components' ? exporter.component(optimizedSvg, componentFramework) : ''),
    [activeTab, optimizedSvg, componentFramework, exporter]
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

  /** What the code view shows for each tab. */
  const preview: Record<ExportTab, () => string> = {
    svg: () => optimizedSvg,
    components: () => componentCode,
    dxf: () => cadText('dxf'),
    eps: () => cadText('eps'),
    pdf: () => (cadData('pdf') ? t('export.pdfInfo', { width, height }) : cadText('pdf')),
    png: () => t('export.pngInfo', { width: width * pngScale, height: height * pngScale, scale: pngScale }),
  };
  const getActiveContent = () => preview[activeTab]();

  /** The file each tab downloads; null while a CAD format is still being built. */
  const produce: Record<ExportTab, () => Promise<string | Uint8Array | Blob | null>> = {
    svg: async () => optimizedSvg,
    components: async () => componentCode,
    png: () => exporter.png(result.svg, { width, height }, pngScale, pngBgColor),
    dxf: async () => cadData('dxf'),
    eps: async () => cadData('eps'),
    pdf: async () => cadData('pdf'),
  };

  const handleDownload = async () => {
    const fileName = exportFileName(activeTab, baseFileName, { pngScale, framework: componentFramework });
    setIsExportingPng(activeTab === 'png');
    try {
      const content = await produce[activeTab]();
      if (content === null) return onShowToast(t('export.notAvailable', { format: activeTab.toUpperCase() }), 'warning');
      files.save(content, fileName, EXPORT_MIME[activeTab]);
      onShowToast(t('export.downloaded', { file: fileName }), 'success');
    } catch (err) {
      onShowToast(errorMessage(err, t) ?? t('toast.unknownError'), 'warning');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleCopy = async () => {
    await files.copyText(getActiveContent());
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
    svg: `image/svg+xml, ${formatBytes(new TextEncoder().encode(optimizedSvg).length)}`,
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
                {PNG_SCALES.map((s) => (
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
