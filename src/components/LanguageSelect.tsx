import React from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { LANGUAGES, useI18n, type Language } from '../i18n';

/**
 * Native <select> (accessible, keyboard friendly) laid transparently over a
 * custom face, so the compact variant can show just the language code.
 */
export const LanguageSelect: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, t, setLanguage } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <label className={`language-select ${compact ? 'is-compact' : ''}`} title={t('app.language')}>
      <Globe size={14} aria-hidden="true" />
      <span className="language-select-face" aria-hidden="true">
        {compact ? lang.toUpperCase() : current?.name}
      </span>
      <ChevronDown size={12} aria-hidden="true" />
      <select
        value={lang}
        onChange={(e) => setLanguage(e.target.value as Language)}
        aria-label={t('app.language')}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
};
