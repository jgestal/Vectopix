import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled (no third-party request): works offline and stays private
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import './index.css'
import App from './ui/App.tsx'
import { I18nProvider, initI18n } from './i18n'
import { ServicesProvider } from './ui/services/ServicesProvider'
import { createAppServices } from './ui/compositionRoot'

// Resolve the language first so the UI never flashes in the wrong one
initI18n().then(({ lang, messages }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServicesProvider services={createAppServices()}>
        <I18nProvider initialLanguage={lang} initialMessages={messages}>
          <App />
        </I18nProvider>
      </ServicesProvider>
    </StrictMode>,
  )
})
