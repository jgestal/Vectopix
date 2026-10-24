import React, { useMemo, useRef, useState } from 'react';
import { Check, Upload } from 'pixelarticons/react';
import { SAMPLE_IMAGES, generateSampleDataUrl } from '../utils/sampleImages';
import type { SampleImageItem } from '../types/vector';
import { EXTRA_IMAGE_EXTENSIONS, SAMPLE_DRAG_TYPE } from '../utils/imageLoading';
import { useI18n, type MessageKey } from '../i18n';
import { LanguageSelect } from './LanguageSelect';
import { AppIcon, RetroWindow } from './retro/RetroWindow';

interface DropZoneProps {
  onSampleSelected: (id: string) => void;
  onFileSelected: (file: File) => void;
  onDrop: (dataTransfer: DataTransfer) => void;
}

const FEATURES: MessageKey[] = ['landing.featureWorker', 'landing.featureSubpixel', 'landing.featurePrivate'];

/** Landing page: a welcome window on a teal Windows desktop. */
export const DropZone: React.FC<DropZoneProps> = ({ onSampleSelected, onFileSelected, onDrop }) => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasting is handled globally by App; samples are rendered once
  const sampleThumbs = useMemo(
    () => Object.fromEntries(SAMPLE_IMAGES.map((sample) => [sample.id, generateSampleDataUrl(sample.id)])),
    []
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
    <div className="desktop">
      <RetroWindow
        className="welcome-window"
        bodyClassName="welcome-body"
        title={t('landing.windowTitle')}
        icon={<AppIcon />}
      >
        <div className="welcome-top">
          <div className="welcome-brand">
            <AppIcon size={56} />
            <div>
              <h1 className="welcome-title">Vectopix</h1>
              <p className="welcome-tagline">
                {t('landing.titleBefore')} <span className="welcome-highlight">{t('landing.titleHighlight')}</span>
              </p>
            </div>
          </div>
          <LanguageSelect />
        </div>

        <p className="welcome-desc">{t('landing.description')}</p>

        <div
          className={`dropzone-card ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={['image/*', ...EXTRA_IMAGE_EXTENSIONS].join(',')}
            className="hidden-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = '';
            }}
          />
          <Upload width={48} height={48} className="r-icon dropzone-icon" />
          <div className="dropzone-main-text">
            {t('landing.dropMain')} <span className="r-link">{t('landing.dropBrowse')}</span>
          </div>
          <div className="dropzone-sub-text">
            {t('landing.dropSub')} <kbd>Ctrl+V</kbd> / <kbd>⌘V</kbd>
          </div>
        </div>

        <ul className="feature-list">
          {FEATURES.map((key) => (
            <li key={key}>
              <Check width={12} height={12} className="r-icon" />
              {t(key)}
            </li>
          ))}
        </ul>

        <fieldset className="r-group samples-group">
          <legend>{t('landing.samplesHeader')}</legend>
          <div className="samples-grid">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.id}
                className="sample-card"
                onClick={() => onSampleSelected(sample.id)}
                draggable
                onDragStart={(e) => handleSampleDragStart(e, sample)}
                title={`${sampleText(sample.id, 'description')} — ${t('landing.sampleHint')}`}
              >
                <span className="sample-preview">
                  <img
                    src={sampleThumbs[sample.id]}
                    alt={sampleText(sample.id, 'title')}
                    className="sample-thumb"
                    draggable={false}
                  />
                </span>
                <span className="sample-title">{sampleText(sample.id, 'title')}</span>
                <span className="sample-category">{sampleText(sample.id, 'category')}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </RetroWindow>
    </div>
  );
};
