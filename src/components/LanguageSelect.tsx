import React from 'react';
import { Globe } from 'pixelarticons/react';
import { LANGUAGES, useI18n, type Language } from '../i18n';

/** Win98 drop-down list for the language (the studio uses the Language menu). */
export const LanguageSelect: React.FC = () => {
  const { lang, t, setLanguage } = useI18n();

  return (
    <label className="language-select" title={t('app.language')}>
      <Globe width={24} height={24} className="r-icon" aria-hidden="true" />
      <span className="r-select">
        <select value={lang} onChange={(e) => setLanguage(e.target.value as Language)} aria-label={t('app.language')}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
};
