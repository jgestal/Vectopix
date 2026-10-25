import { useEffect, useMemo } from 'react';
import { buildMenu, type MenuItem, type MenuSection, type MenuState } from '../../domain/menu';
import type { VectorOptions, VectorResult } from '../../domain/types';
import { useI18n, type MessageKey, type Translate } from '../../i18n';
import { useServices } from '../services/context';

const translateItem = (item: MenuItem, t: Translate): MenuItem => {
  if (item.kind === 'separator') return item;
  const label = t(item.label as MessageKey);
  return item.kind === 'submenu' ? { ...item, label, items: item.items.map((i) => translateItem(i, t)) } : { ...item, label };
};

/** The menu with its labels in the interface's language (the app's name stays as it is). */
export const translateMenu = (menu: MenuSection[], t: Translate): MenuSection[] =>
  menu.map((s) => ({ ...s, label: s.role === 'appMenu' ? s.label : t(s.label as MessageKey), items: s.items.map((i) => translateItem(i, t)) }));

/** What the menu bar reflects, from the app's state. */
export function menuStateFrom(app: {
  hasImage: boolean;
  result: VectorResult | null;
  isProcessing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  options: VectorOptions;
  viewMode: MenuState['viewMode'];
  renderMode: MenuState['renderMode'];
}): Omit<MenuState, 'isDevelopment'> {
  const { result, options } = app;
  return {
    hasImage: app.hasImage,
    hasResult: !!result,
    isProcessing: app.isProcessing,
    canUndo: app.canUndo,
    canRedo: app.canRedo,
    hasEdits: !!result && result.svg !== result.originalSvg,
    isCenterline: options.traceMethod === 'centerline',
    viewMode: app.viewMode,
    renderMode: app.renderMode,
    preset: options.preset,
    transparentBackground: options.transparentBackground,
    autoColors: options.autoColors,
  };
}

/**
 * Keep the desktop app's menu bar in step with the app: language, enabled
 * and checked items. Sent only when something changed. Nothing on the web.
 */
export function useDesktopMenu(state: Omit<MenuState, 'isDevelopment'>) {
  const { desktop } = useServices();
  const { t } = useI18n();
  // The state's values as the key: a new object with the same values is no change
  const stateKey = JSON.stringify(state);
  const menu = useMemo(() => {
    if (!desktop) return null;
    const current: MenuState = { ...JSON.parse(stateKey), isDevelopment: desktop.isDevelopment };
    return translateMenu(buildMenu(current, desktop.platform), t);
  }, [desktop, t, stateKey]);
  useEffect(() => {
    if (desktop && menu) desktop.setMenu(menu);
  }, [desktop, menu]);
}
