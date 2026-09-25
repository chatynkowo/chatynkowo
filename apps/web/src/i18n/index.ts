import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGES } from '@chatynkowo/core'
import { DICTIONARIES } from '@chatynkowo/i18n'

export { DEFAULT_LANGUAGE, LANGUAGES, toLanguage, type Language } from '@chatynkowo/core'

/* The site's i18next instance: shared dictionaries from @chatynkowo/i18n,
   browser-side language detection remembered in localStorage. */
i18n.use(LanguageDetector).use(initReactI18next)

/* Assistive tech and the browser's translate prompt follow this attribute, so
   it must track every language change, including the initial detection. */
i18n.on('languageChanged', () => {
  document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE
})

void i18n.init({
  resources: DICTIONARIES,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((language) => language.code),
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  // All dictionaries are bundled, so init synchronously — components can
  // translate on their very first render, before any async tick.
  initAsync: false,
})

export default i18n
