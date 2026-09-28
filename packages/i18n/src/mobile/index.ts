/* The app's entry (`@chatynkowo/i18n/mobile`): the app-only copy and the
   i18next resources that put it next to the shared set. Nothing here
   references the site-only set, so the app never bundles it. */
import { LANGUAGES, type Language } from '@chatynkowo/core'
import { SHARED_DICTIONARIES, type SharedDictionary } from '../shared'
import { mobilePl } from './pl'
import { mobileEn } from './en'

export type MobileDictionary = typeof mobilePl

export const MOBILE_DICTIONARIES: Record<Language, MobileDictionary> = { pl: mobilePl, en: mobileEn }

export const MOBILE_NAMESPACE = 'mobile'

/* The shared set as "translation" and the app-only set as the "mobile"
   namespace (t('mobile:group.key')). */
export function mobileResources(): Record<Language, { translation: SharedDictionary; mobile: MobileDictionary }> {
  return Object.fromEntries(
    LANGUAGES.map(({ code }) => [code, { translation: SHARED_DICTIONARIES[code], [MOBILE_NAMESPACE]: MOBILE_DICTIONARIES[code] }]),
  ) as Record<Language, { translation: SharedDictionary; mobile: MobileDictionary }>
}

export { mobilePl, mobileEn }
