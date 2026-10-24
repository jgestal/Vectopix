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
import type { SampleImageItem, VectorPreset } from '../types/vector';

interface DropZoneProps {
  onImageSelected: (
    fileDataUrl: string,
    fileName: string,
    suggestedPreset?: VectorPreset
  ) => void;
  onFileSelected: (file: File) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onImageSelected, onFileSelected }) => {
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

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Stop here so the app-level drop handler doesn't load the file a second time
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleSampleClick = (sample: SampleImageItem) => {
    onImageSelected(sampleThumbs[sample.id], `${sample.id}.png`, sample.preset);
  };

  return (
    <div className="dropzone-page">
      <div className="dropzone-hero">
        <div className="hero-badge">
          <Sparkles size={14} className="text-indigo" />
          <span>Vector Magic Calidad Sub-Pixel en tu Navegador</span>
        </div>

        <h1 className="hero-title">
          Convierte Imágenes Raster a <span className="gradient-text">Vectores Limpios</span>
        </h1>
        <p className="hero-description">
          Ajuste matemático de curvas Bézier, reconstrucción de anti-aliasing y cálculo
          de consistencia topológica. 100% privado en tu navegador, sin subir tus archivos.
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
            accept="image/png,image/jpeg,image/webp,image/bmp"
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
              Arrastra y suelta tu imagen aquí o{' '}
              <span className="text-highlight">explora en tu equipo</span>
            </div>
            <div className="dropzone-sub-text">
              Soporta PNG, JPG, WebP o pega directamente desde el portapapeles con{' '}
              <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="feature-pills">
          <div className="feature-pill">
            <Cpu size={15} className="text-indigo" />
            <span>Motor Web Worker Off-Thread</span>
          </div>
          <div className="feature-pill">
            <Zap size={15} className="text-cyan" />
            <span>Sub-pixel Bézier Curve Fitting</span>
          </div>
          <div className="feature-pill">
            <Shield size={15} className="text-emerald" />
            <span>100% Privado (Zero Server Upload)</span>
          </div>
        </div>

        {/* Built-in Sample Images */}
        <div className="samples-section">
          <div className="samples-header">
            <Layers size={16} />
            <span>O prueba con estas muestras prediseñadas:</span>
          </div>

          <div className="samples-grid">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.id}
                className="sample-card"
                onClick={() => handleSampleClick(sample)}
              >
                <div className="sample-preview">
                  <img
                    src={sampleThumbs[sample.id]}
                    alt={sample.title}
                    className="sample-thumb"
                  />
                </div>
                <div className="sample-info">
                  <div className="sample-title">{sample.title}</div>
                  <div className="sample-category">{sample.category}</div>
                  <div className="sample-desc">{sample.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
