export type ViewMode = 'split' | 'vector' | 'raster' | 'side-by-side';

export type RenderMode = 'full' | 'wireframe' | 'nodes';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}
