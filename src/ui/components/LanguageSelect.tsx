import React from 'react';
import { LANGUAGES, useI18n, type Language } from '../../i18n';

export const LanguageSelect: React.FC = () => {
  const { lang, t, setLanguage } = useI18n();

  return (
    <select
      className="select language-select"
      value={lang}
      onChange={(e) => setLanguage(e.target.value as Language)}
      aria-label={t('app.language')}
      title={t('app.language')}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
};
