import { useEffect } from 'react';
import type { WorkerProgress } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useServices } from '../services/context';
import { applyTheme } from '../theme';

/**
 * How the app shows itself outside the page: the window title names the
 * image, the Dock / taskbar icon shows a trace's progress, and the theme
 * (also of native menus and dialogs) is the one chosen in Settings.
 */
export function useWindowPresence({ fileName, progress }: { fileName: string | null; progress: WorkerProgress | null }) {
  const { t } = useI18n();
  const { desktop, preferences } = useServices();

  useEffect(() => {
    // A desktop window is just named after the app; a browser tab also says what it is
    document.title = fileName ? `${fileName} — Vectopix` : desktop ? 'Vectopix' : t('app.title');
  }, [desktop, fileName, t]);

  useEffect(() => {
    desktop?.setProgress(progress ? progress.percent / 100 : null);
  }, [desktop, progress]);

  useEffect(() => {
    applyTheme(preferences.loadAppPreferences().theme, desktop);
  }, [desktop, preferences]);
}
