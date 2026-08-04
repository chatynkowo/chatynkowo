import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './registry'
import { pl } from './pl'
import { en } from './en'

export { DEFAULT_LANGUAGE, LANGUAGES, toLanguage, type Language } from './registry'

/* One dictionary per registered language — the Record over Language turns a
   registry entry without a dictionary into a compile error. */
const DICTIONARIES: Record<Language, typeof pl> = { pl, en }

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
