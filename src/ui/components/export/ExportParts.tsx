import { Check, Copy, FileText } from 'lucide-react';
import { PNG_SCALES, type ComponentFramework, type ExportTab } from '../../../domain/export/exportFiles';
import { useI18n, type MessageKey } from '../../../i18n';
import { Segmented } from '../ui/Segmented';

export type PngBackground = 'transparent' | '#ffffff' | '#0f172a';

const BACKGROUNDS: readonly [PngBackground, MessageKey][] = [
  ['transparent', 'export.bgTransparent'],
  ['#ffffff', 'export.bgWhite'],
  ['#0f172a', 'export.bgDark'],
];
const FRAMEWORKS: readonly { value: ComponentFramework; text: string }[] = [
  { value: 'react', text: 'React' },
  { value: 'vue', text: 'Vue' },
  { value: 'svelte', text: 'Svelte' },
];

interface OptionsProps {
  tab: ExportTab;
  size: { width: number; height: number };
  minify: boolean;
  onMinify: (on: boolean) => void;
  pngScale: number;
  onPngScale: (scale: number) => void;
  pngBackground: PngBackground;
  onPngBackground: (bg: PngBackground) => void;
  framework: ComponentFramework;
  onFramework: (fw: ComponentFramework) => void;
}

/** The settings of the format being exported (none for DXF, EPS and PDF). */
export function ExportOptions(p: OptionsProps) {
  const { t } = useI18n();
  const { width, height } = p.size;
  return (
    <div className="export-options">
      {p.tab === 'svg' && (
        <label className="check-row">
          <input type="checkbox" checked={p.minify} onChange={(e) => p.onMinify(e.target.checked)} />
          <span className="check-title">{t('export.minify')}</span>
        </label>
      )}
      {p.tab === 'png' && (
        <>
          <div className="option-row">
            <span className="option-label">{t('export.scale')}</span>
            <Segmented
              label={t('export.scale')}
              options={PNG_SCALES.map((s) => ({ value: s, text: `${s}×`, title: `${width * s} × ${height * s} px` }))}
              value={p.pngScale}
              onChange={p.onPngScale}
            />
            <span className="option-hint">
              {width * p.pngScale} × {height * p.pngScale} px
            </span>
          </div>
          <div className="option-row">
            <span className="option-label">{t('export.background')}</span>
            <Segmented
              label={t('export.background')}
              options={BACKGROUNDS.map(([value, key]) => ({ value, text: t(key) }))}
              value={p.pngBackground}
              onChange={p.onPngBackground}
            />
          </div>
        </>
      )}
      {p.tab === 'components' && (
        <div className="option-row">
          <span className="option-label">{t('export.framework')}</span>
          <Segmented label={t('export.framework')} options={FRAMEWORKS} value={p.framework} onChange={p.onFramework} />
        </div>
      )}
    </div>
  );
}

/** What the PDF will be, while it is built and once it is ready. */
export function PdfCard({ ready, size, isCenterline }: { ready: boolean; size: { width: number; height: number }; isCenterline: boolean }) {
  const { t } = useI18n();
  return (
    <div className="export-preview export-pdf">
      <FileText size={40} strokeWidth={1.25} />
      <h3>{t(ready ? 'export.pdfReadyTitle' : 'export.pdfGenerating')}</h3>
      <p>{t('export.pdfDesc')}</p>
      <dl>
        <dt>{t('export.pdfDimensions')}</dt>
        <dd>
          {size.width} × {size.height} pt
        </dd>
        <dt>{t('export.pdfColorSpace')}</dt>
        <dd>sRGB</dd>
        <dt>{t('export.pdfPathType')}</dt>
        <dd>{t(isCenterline ? 'export.pdfPolylines' : 'export.pdfSplines')}</dd>
      </dl>
    </div>
  );
}

/** The drawing over the chosen background, as the PNG will look; it can go straight to the clipboard. */
export function PngPreview({ svg, background, onCopy }: { svg: string; background: PngBackground; onCopy: () => void }) {
  const { t } = useI18n();
  return (
    <div className="export-preview checker" style={{ background: background === 'transparent' ? undefined : background }}>
      <button className="btn btn-small code-copy" onClick={onCopy}>
        <Copy size={14} />
        {t('export.copyImage')}
      </button>
      <div className="export-preview-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

/** Text output with a copy button. */
export function CodeView({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  const { t } = useI18n();
  return (
    <div className="code-block">
      <button className="btn btn-small code-copy" onClick={onCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t('export.copied') : t('export.copyCode')}
      </button>
      <pre className="code-viewer">
        <code>{code}</code>
      </pre>
    </div>
  );
}
