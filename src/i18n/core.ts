import { es, type MessageKey, type Messages } from './locales/es';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const STORAGE_KEY = 'vectopix.language';
const FALLBACK: Language = 'en';

// Locales are separate chunks: only the one in use is downloaded
const loaders: Record<Language, () => Promise<Messages>> = {
  es: async () => es,
  en: () => import('./locales/en').then((m) => m.en),
  de: () => import('./locales/de').then((m) => m.de),
  fr: () => import('./locales/fr').then((m) => m.fr),
  it: () => import('./locales/it').then((m) => m.it),
  pt: () => import('./locales/pt').then((m) => m.pt),
  zh: () => import('./locales/zh').then((m) => m.zh),
  ja: () => import('./locales/ja').then((m) => m.ja),
};

const isLanguage = (value: string | null | undefined): value is Language =>
  LANGUAGES.some((l) => l.code === value);

/** Saved choice first, then the browser's preferred languages, then English. */
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage can be unavailable (private mode, blocked site data)
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return FALLBACK;
}

export function loadMessages(lang: Language): Promise<Messages> {
  return loaders[lang]();
}

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export function format(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function applyToDocument(lang: Language, messages: Messages) {
  document.documentElement.lang = lang;
  document.title = messages['app.title'];
}

/** Resolve the language and its messages before the first render. */
export async function initI18n(): Promise<{ lang: Language; messages: Messages }> {
  const lang = detectLanguage();
  const messages = await loadMessages(lang).catch(() => loadMessages(FALLBACK));
  applyToDocument(lang, messages);
  return { lang, messages };
}
