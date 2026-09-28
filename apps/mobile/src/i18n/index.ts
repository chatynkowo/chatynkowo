import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_LANGUAGE, LANGUAGES, toLanguage, type Language } from '@chatynkowo/core'
import { MOBILE_NAMESPACE, mobileResources } from '@chatynkowo/i18n/mobile'
import { STORAGE_KEYS } from '../config'

export { DEFAULT_LANGUAGE, LANGUAGES, toLanguage, type Language } from '@chatynkowo/core'

/* The app's i18next instance: the shared "translation" namespace from
   @chatynkowo/i18n plus the app-only "mobile" one, with the device locale
   as the starting language. A choice made in the app is remembered in
   AsyncStorage and restored by `restoreLanguage` at start-up. */


/* The device's first language that the app ships, else Polish. */
function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const language = toLanguage(locale.languageCode ?? undefined)
    if (language === locale.languageCode) return language
  }
  return DEFAULT_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources: mobileResources(),
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((language) => language.code),
  ns: ['translation', MOBILE_NAMESPACE],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  // All dictionaries are bundled, so init synchronously — components can
  // translate on their very first render, before any async tick.
  initAsync: false,
})

export async function restoreLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.language)
    if (stored && toLanguage(stored) === stored && stored !== i18n.language) await i18n.changeLanguage(stored)
  } catch {
    // Storage can fail on a full device; the device language is fine.
  }
}

export async function setLanguage(language: Language) {
  await i18n.changeLanguage(language)
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.language, language)
  } catch {
    // Not remembering the choice is a minor loss.
  }
}

export default i18n
