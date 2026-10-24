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

  // DXF / EPS / PDF are built by the worker only when their tab is opened
  // (a format with no entry yet is still loading)
  const [cadExports, setCadExports] = useState<Partial<Record<ExportFormat, ExportState>>>({});
  const requestedFormats = useRef(new Set<ExportFormat>());
  useEffect(() => {
    if (!isCadFormat(activeTab) || requestedFormats.current.has(activeTab)) return;
    const format = activeTab;
    requestedFormats.current.add(format);
    requestExport(format)
      .then((data) => setCadExports((prev) => ({ ...prev, [format]: { status: 'ready', data } })))
      .catch((err: unknown) =>
        setCadExports((prev) => ({
          ...prev,
          [format]: { status: 'error', message: err instanceof Error ? err.message : String(err) },
        }))
      );
  }, [activeTab]);

  const width = imageDimensions?.width || 400;
  const height = imageDimensions?.height || 400;
  const nameWithoutExt = baseFileName.replace(/\.[^/.]+$/, '');
  const hasEdits = result.svg !== result.originalSvg;

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
    if (!state) return `/* Generando ${format.toUpperCase()}... */`;
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
          ? `Documento Adobe PDF Vectorial (versión 1.4)\nDimensiones: ${width} × ${height} pt\nEstado: Listo para descargar`
          : cadText('pdf');
      case 'png':
        return `PNG Rasterizado de Alta Resolución (${width * pngScale} × ${height * pngScale} px a escala ${pngScale}x, fondo ${pngBgColor})`;
    }
  };

  const handleDownload = async () => {
    switch (activeTab) {
      case 'svg': {
        const svgContent = optimizedSvg;
        downloadFile(svgContent, `${nameWithoutExt}.svg`, 'image/svg+xml');
        onShowToast(`Archivo ${nameWithoutExt}.svg descargado`, 'success');
        break;
      }
      case 'png':
        try {
          setIsExportingPng(true);
          const blob = await exportSvgToPngBlob(result.svg, width, height, pngScale, pngBgColor);
          downloadBlob(blob, `${nameWithoutExt}_@${pngScale}x.png`);
          onShowToast(`PNG @${pngScale}x descargado con éxito`, 'success');
        } catch {
          onShowToast('Error al rasterizar PNG', 'warning');
        } finally {
          setIsExportingPng(false);
        }
        break;
      case 'components': {
        const ext = componentFramework === 'react' ? 'tsx' : componentFramework;
        downloadFile(componentCode, `VectorGraphic.${ext}`, 'text/plain');
        onShowToast(`Componente ${componentFramework.toUpperCase()} descargado`, 'success');
        break;
      }
      case 'dxf':
      case 'eps':
      case 'pdf': {
        const data = cadData(activeTab);
        if (!data) {
          onShowToast(`${activeTab.toUpperCase()} aún no está disponible`, 'warning');
        } else if (activeTab === 'pdf') {
          downloadPdf(data, `${nameWithoutExt}.pdf`);
          onShowToast('Documento Vectorial PDF descargado', 'success');
        } else if (activeTab === 'dxf') {
          downloadFile(data as string, `${nameWithoutExt}.dxf`, 'application/dxf');
          onShowToast('Archivo CAD DXF descargado', 'success');
        } else {
          downloadFile(data as string, `${nameWithoutExt}.eps`, 'application/postscript');
          onShowToast('Archivo EPS descargado', 'success');
        }
        break;
      }
    }
  };

  const handleCopy = async () => {
    const text = getActiveContent();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onShowToast('Copiado al portapapeles', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Exportar Gráfico Vectorial</h2>
            <span className="modal-subtitle">
              Formatos optimizados para desarrollo web, diseño UI, corte láser, CNC e imprenta
            </span>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
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
            <span>SVG Estándar</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'png' ? 'active' : ''}`}
            onClick={() => setActiveTab('png')}
          >
            <ImageIcon size={16} />
            <span>Alta Res. PNG</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'components' ? 'active' : ''}`}
            onClick={() => setActiveTab('components')}
          >
            <Code2 size={16} />
            <span>Componentes UI</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'dxf' ? 'active' : ''}`}
            onClick={() => setActiveTab('dxf')}
          >
            <Scissors size={16} />
            <span>DXF (Láser / CNC)</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'eps' ? 'active' : ''}`}
            onClick={() => setActiveTab('eps')}
          >
            <Printer size={16} />
            <span>EPS (Imprenta)</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <FileText size={16} />
            <span>PDF Vectorial</span>
          </button>
        </div>

        {isCadFormat(activeTab) && hasEdits && (
          <div className="export-subbar export-notice">
            Los formatos DXF, EPS y PDF se generan a partir del trazado original: las ediciones de
            nodos y colores solo se incluyen en SVG, PNG y componentes.
          </div>
        )}

        {/* Tab-Specific Sub-Bars */}
        {activeTab === 'svg' && (
          <div className="export-subbar">
            <span className="subbar-label">Optimización:</span>
            <label className="subbar-checkbox-label">
              <input
                type="checkbox"
                checked={minifySvgEnabled}
                onChange={(e) => setMinifySvgEnabled(e.target.checked)}
                className="studio-switch"
              />
              <span className="text-secondary text-sm">
                Minificar y optimizar coordenadas (reduce peso y elimina metadatos innecesarios)
              </span>
            </label>
          </div>
        )}

        {activeTab === 'png' && (
          <div className="export-subbar">
            <div className="subbar-group">
              <span className="subbar-label">Escala:</span>
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
              <span className="subbar-label">Fondo:</span>
              <div className="scale-selector">
                <button
                  className={`scale-btn ${pngBgColor === 'transparent' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('transparent')}
                >
                  Transparente
                </button>
                <button
                  className={`scale-btn ${pngBgColor === '#ffffff' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('#ffffff')}
                >
                  Blanco
                </button>
                <button
                  className={`scale-btn ${pngBgColor === '#0f172a' ? 'active' : ''}`}
                  onClick={() => setPngBgColor('#0f172a')}
                >
                  Oscuro
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="export-subbar">
            <span className="subbar-label">Framework:</span>
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
              {activeTab === 'png' && `PNG Rasterizado 32-bit • @${pngScale}x`}
              {activeTab === 'components' && `${componentFramework.toUpperCase()} Component`}
              {activeTab === 'dxf' && 'Autodesk Drawing Exchange Format (DXF R12)'}
              {activeTab === 'eps' && 'Encapsulated PostScript (EPS 3.0)'}
              {activeTab === 'pdf' && 'Documento Adobe PDF 1.4 Vectorial'}
            </span>

            {activeTab !== 'png' && (
              <button className="btn-copy-code" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald" />
                    <span className="text-emerald">Copiado al portapapeles</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar Código</span>
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
                  Resolución final de descarga:{' '}
                  <strong>{width * pngScale} × {height * pngScale} px</strong>
                </span>
                <span>
                  Fondo: {pngBgColor === 'transparent' ? 'Transparente (canal Alpha)' : pngBgColor}
                </span>
              </div>
            </div>
          ) : activeTab === 'pdf' && pdfState?.status !== 'error' ? (
            <div className="pdf-preview-card">
              <div className="pdf-icon-badge">
                <FileText size={36} className="text-cyan" />
              </div>
              <h3 className="pdf-preview-title">
                {pdfState?.status === 'ready' ? 'Documento Vectorial PDF Listo para Descarga' : 'Generando PDF...'}
              </h3>
              <p className="pdf-preview-desc">
                Generado con curvas de Bézier cúbicas exactas, resolución infinita y soporte directo
                para imprenta profesional, Illustrator, CorelDraw e InDesign.
              </p>
              <div className="pdf-specs-grid">
                <div className="spec-item">
                  <span className="spec-lbl">Dimensiones:</span>
                  <span className="spec-val">{width} × {height} pt</span>
                </div>
                <div className="spec-item">
                  <span className="spec-lbl">Espacio de Color:</span>
                  <span className="spec-val">sRGB / CMYK Compatible</span>
                </div>
                <div className="spec-item">
                  <span className="spec-lbl">Tipo de trazado:</span>
                  <span className="spec-val">{result.isCenterline ? 'Centerline Polylines' : 'Bézier Splines'}</span>
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
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={isExportingPng || (isCadFormat(activeTab) && !cadData(activeTab))}
          >
            <Download size={16} />
            <span>
              {isExportingPng
                ? 'Generando PNG...'
                : `Descargar ${activeTab === 'components' ? componentFramework.toUpperCase() : activeTab.toUpperCase()}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
