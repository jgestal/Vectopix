import React, { useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  Sparkles,
  Shield,
  Zap,
  Cpu,
  Layers,
} from 'lucide-react';
import { SAMPLE_IMAGES, generateSampleDataUrl } from '../utils/sampleImages';
import type { SampleImageItem } from '../types/vector';
import { EXTRA_IMAGE_EXTENSIONS, SAMPLE_DRAG_TYPE } from '../utils/imageLoading';
import { useI18n, type MessageKey } from '../i18n';
import { LanguageSelect } from './LanguageSelect';

interface DropZoneProps {
  onSampleSelected: (id: string) => void;
  onFileSelected: (file: File) => void;
  onDrop: (dataTransfer: DataTransfer) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onSampleSelected, onFileSelected, onDrop }) => {
  const { t } = useI18n();
  const sampleText = (id: string, field: 'title' | 'category' | 'description') =>
    t(`sample.${id}.${field}` as MessageKey);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasting is handled globally by App; samples are rendered once
  const sampleThumbs = useMemo(
    () => Object.fromEntries(SAMPLE_IMAGES.map((sample) => [sample.id, generateSampleDataUrl(sample.id)])),
    []
  );

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
    <div className="dropzone-page">
      <div className="dropzone-language">
        <LanguageSelect />
      </div>
      <div className="dropzone-hero">
        <div className="hero-badge">
          <Sparkles size={14} className="text-indigo" />
          <span>{t('landing.badge')}</span>
        </div>

        <h1 className="hero-title">
          {t('landing.titleBefore')} <span className="gradient-text">{t('landing.titleHighlight')}</span>
        </h1>
        <p className="hero-description">
          {t('landing.description')}
        </p>

        {/* Big Drag and Drop Target Card */}
        <div
          className={`dropzone-card ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
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

          <div className="dropzone-icon-glow">
            <UploadCloud size={44} className="dropzone-icon" />
          </div>

          <div className="dropzone-text-group">
            <div className="dropzone-main-text">
              {t('landing.dropMain')}{' '}
              <span className="text-highlight">{t('landing.dropBrowse')}</span>
            </div>
            <div className="dropzone-sub-text">
              {t('landing.dropSub')}{' '}
              <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="feature-pills">
          <div className="feature-pill">
            <Cpu size={15} className="text-indigo" />
            <span>{t('landing.featureWorker')}</span>
          </div>
          <div className="feature-pill">
            <Zap size={15} className="text-cyan" />
            <span>{t('landing.featureSubpixel')}</span>
          </div>
          <div className="feature-pill">
            <Shield size={15} className="text-emerald" />
            <span>{t('landing.featurePrivate')}</span>
          </div>
        </div>

        {/* Built-in Sample Images */}
        <div className="samples-section">
          <div className="samples-header">
            <Layers size={16} />
            <span>{t('landing.samplesHeader')}</span>
          </div>

          <div className="samples-grid">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.id}
                className="sample-card"
                onClick={() => onSampleSelected(sample.id)}
                draggable
                onDragStart={(e) => handleSampleDragStart(e, sample)}
                title={t('landing.sampleHint')}
              >
                <div className="sample-preview">
                  <img
                    src={sampleThumbs[sample.id]}
                    alt={sampleText(sample.id, 'title')}
                    className="sample-thumb"
                    draggable={false}
                  />
                </div>
                <div className="sample-info">
                  <div className="sample-title">{sampleText(sample.id, 'title')}</div>
                  <div className="sample-category">{sampleText(sample.id, 'category')}</div>
                  <div className="sample-desc">{sampleText(sample.id, 'description')}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
