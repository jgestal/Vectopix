import type { VectorPreset } from './types';

/** Built-in sample; its title and texts live in the i18n catalogue (sample.{id}.*). */
export interface SampleImageItem {
  id: string;
  preset: VectorPreset;
}

/** The built-in samples, each with the preset that suits it. */
export const SAMPLE_IMAGES: SampleImageItem[] = [
  { id: 'tech-logo', preset: 'logo' },
  { id: 'badge-crest', preset: 'flat-art' },
  { id: 'hand-sketch', preset: 'sketch' },
  { id: 'pixel-heart', preset: 'pixel-art' },
];

/** Drag data type that identifies a sample dragged from the gallery. */
export const SAMPLE_DRAG_TYPE = 'application/x-vectopix-sample';
