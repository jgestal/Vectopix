import React, { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { SAMPLE_DRAG_TYPE, SAMPLE_IMAGES, type SampleImageItem } from '../../domain/samples';
import { useServices } from '../services/context';
import { useI18n, type MessageKey } from '../../i18n';
import { LanguageSelect } from './LanguageSelect';
import { ThemeToggle } from './ThemeToggle';
import { RELEASE_NOTES_URL, REPOSITORY_URL } from '../appInfo';

interface DropZoneProps {
  onSampleSelected: (id: string) => void;
  onFileSelected: (file: File) => void;
  onDrop: (dataTransfer: DataTransfer) => void;
}

/** Start screen: a sheet on the cutting mat with the drop area and the samples. */
export const DropZone: React.FC<DropZoneProps> = ({ onSampleSelected, onFileSelected, onDrop }) => {
  const { t } = useI18n();
  const { samples, images } = useServices();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasting is handled globally by App; samples are rendered once
  const sampleThumbs = useMemo(
    () => Object.fromEntries(SAMPLE_IMAGES.map((sample) => [sample.id, samples.render(sample.id)])),
    [samples]
  );
  const sampleText = (id: string, field: 'title' | 'category' | 'description') =>
    t(`sample.${id}.${field}` as MessageKey);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Moving over a child element also fires dragleave on the card
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Stop here so the app-level drop handler doesn't load the file a second time
    e.stopPropagation();
    setIsDragging(false);
    onDrop(e.dataTransfer);
  };

  const handleSampleDragStart = (e: React.DragEvent, sample: SampleImageItem) => {
    e.dataTransfer.setData(SAMPLE_DRAG_TYPE, sample.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="start mat">
      <main className="start-sheet">
        <header className="start-header">
          <div className="start-brand">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={36} height={36} />
            <span>Vectopix</span>
          </div>
          <div className="start-header-actions">
            <ThemeToggle />
            <LanguageSelect />
          </div>
        </header>

        <h1 className="start-title">
          {t('landing.titleBefore')} {t('landing.titleHighlight')}
        </h1>
        <p className="start-lead">{t('landing.description')}</p>

        <div
          className={`dropzone mat ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={['image/*', ...images.extraExtensions].join(',')}
            className="hidden-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = '';
            }}
          />
          <p className="dropzone-title">{t('landing.dropMain')}</p>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            {t('landing.dropBrowse')}
          </button>
          <p className="dropzone-hint">
            {t('landing.dropSub')} <kbd>⌘V</kbd> / <kbd>Ctrl V</kbd>
          </p>
        </div>

        <h2 className="start-subtitle">{t('landing.samplesHeader')}</h2>
        <div className="samples">
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              className="sample"
              onClick={() => onSampleSelected(sample.id)}
              draggable
              onDragStart={(e) => handleSampleDragStart(e, sample)}
              title={`${sampleText(sample.id, 'description')} ${t('landing.sampleHint')}`}
            >
              <span className="sample-thumb">
                <img src={sampleThumbs[sample.id]} alt="" draggable={false} />
              </span>
              <span className="sample-title">{sampleText(sample.id, 'title')}</span>
              <span className="sample-category">{sampleText(sample.id, 'category')}</span>
            </button>
          ))}
        </div>

        <footer className="start-footer">
          <span>{t('landing.privacyNote')}</span>
          <span className="start-footer-links">
            <a href={RELEASE_NOTES_URL} target="_blank" rel="noopener noreferrer">
              {t('about.version', { version: __APP_VERSION__ })}
            </a>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              {t('menu.sourceCode')}
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
};
