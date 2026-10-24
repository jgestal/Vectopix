import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled (no Google Fonts request): works offline and stays private
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { I18nProvider, initI18n } from './i18n'

// Resolve the language first so the UI never flashes in the wrong one
initI18n().then(({ lang, messages }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider initialLanguage={lang} initialMessages={messages}>
        <App />
      </I18nProvider>
    </StrictMode>,
  )
})
