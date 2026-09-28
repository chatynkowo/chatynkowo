/* The site's entry (`@chatynkowo/i18n/web`): the site-only copy and the
   i18next resources that merge it with the shared set. Nothing here
   references the mobile set, so the site never bundles it. */
import { LANGUAGES, type Language } from '@chatynkowo/core'
import { SHARED_DICTIONARIES, type SharedDictionary } from '../shared'
import { webPl } from './pl'
import { webEn } from './en'

export type WebDictionary = typeof webPl

export const WEB_DICTIONARIES: Record<Language, WebDictionary> = { pl: webPl, en: webEn }

/* Shared and site-only groups in the one "translation" namespace, so every
   key reads as t('group.key'). */
export function webResources(): Record<Language, { translation: SharedDictionary & WebDictionary }> {
  return Object.fromEntries(
    LANGUAGES.map(({ code }) => [code, { translation: { ...SHARED_DICTIONARIES[code], ...WEB_DICTIONARIES[code] } }]),
  ) as Record<Language, { translation: SharedDictionary & WebDictionary }>
}

export { webPl, webEn }
