import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { es, type Messages } from './locales/es';
import { STORAGE_KEY, applyToDocument, format, loadMessages, type Language } from './core';
import { I18nContext, type I18nContextValue } from './context';

export function I18nProvider({
  initialLanguage,
  initialMessages,
  children,
}: {
  initialLanguage: Language;
  initialMessages: Messages;
  children: ReactNode;
}) {
  const [state, setState] = useState({ lang: initialLanguage, messages: initialMessages });

  const setLanguage = useCallback(async (lang: Language) => {
    const messages = await loadMessages(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // The choice simply won't persist
    }
    applyToDocument(lang, messages);
    setState({ lang, messages });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang: state.lang,
      t: (key, params) => format(state.messages[key] ?? es[key] ?? key, params),
      setLanguage,
    }),
    [state, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
