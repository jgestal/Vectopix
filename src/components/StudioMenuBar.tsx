import React from 'react';
import { MenuBar, type Menu } from './retro/MenuBar';
import { LANGUAGES, useI18n } from '../i18n';
import type { RenderMode, ViewMode } from '../types/vector';

export const REPOSITORY_URL = 'https://github.com/jgestal/Vectopix';

interface StudioMenuBarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasEdits: boolean;
  hasResult: boolean;
  onOpen: () => void;
  onNewImage: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopySvg: () => void;
  onSimplify: () => void;
  onResetEdits: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onShortcuts: () => void;
  onAbout: () => void;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';

export const StudioMenuBar: React.FC<StudioMenuBarProps> = (p) => {
  const { t, lang, setLanguage } = useI18n();

  const menus: Menu[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { label: t('menu.new'), onSelect: p.onNewImage },
        { label: t('menu.open'), onSelect: p.onOpen },
        'separator',
        { label: t('menu.export'), onSelect: p.onExport, disabled: !p.hasResult },
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      items: [
        { label: t('shortcuts.undo'), onSelect: p.onUndo, disabled: !p.canUndo, shortcut: `${MOD}Z` },
        { label: t('shortcuts.redo'), onSelect: p.onRedo, disabled: !p.canRedo, shortcut: `${MOD}⇧Z` },
        'separator',
        { label: t('menu.copySvg'), onSelect: p.onCopySvg, disabled: !p.hasResult, shortcut: `${MOD}C` },
        'separator',
        { label: t('nodes.simplify'), onSelect: p.onSimplify, disabled: !p.hasResult },
        { label: t('nodes.reset'), onSelect: p.onResetEdits, disabled: !p.hasEdits },
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        { label: t('header.viewSplit'), onSelect: () => p.setViewMode('split'), checked: p.viewMode === 'split', shortcut: 'S' },
        { label: t('header.viewSideBySide'), onSelect: () => p.setViewMode('side-by-side'), checked: p.viewMode === 'side-by-side', shortcut: 'D' },
        { label: t('header.viewVector'), onSelect: () => p.setViewMode('vector'), checked: p.viewMode === 'vector' },
        { label: t('header.viewRaster'), onSelect: () => p.setViewMode('raster'), checked: p.viewMode === 'raster' },
        'separator',
        { label: t('header.renderFull'), onSelect: () => p.setRenderMode('full'), checked: p.renderMode === 'full' },
        { label: t('header.renderWireframe'), onSelect: () => p.setRenderMode('wireframe'), checked: p.renderMode === 'wireframe', shortcut: 'W' },
        { label: t('header.renderNodes'), onSelect: () => p.setRenderMode('nodes'), checked: p.renderMode === 'nodes', shortcut: 'N' },
        'separator',
        { label: t('header.zoomIn'), onSelect: () => p.onZoom(1.25) },
        { label: t('header.zoomOut'), onSelect: () => p.onZoom(0.8) },
        { label: t('header.fit'), onSelect: p.onFit },
      ],
    },
    {
      id: 'language',
      label: t('menu.language'),
      items: LANGUAGES.map((l) => ({ label: l.name, onSelect: () => setLanguage(l.code), checked: lang === l.code })),
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        { label: t('shortcuts.title'), onSelect: p.onShortcuts, shortcut: 'F1' },
        { label: t('menu.sourceCode'), onSelect: () => window.open(REPOSITORY_URL, '_blank', 'noopener') },
        'separator',
        { label: t('menu.about'), onSelect: p.onAbout },
      ],
    },
  ];

  return <MenuBar menus={menus} />;
};
