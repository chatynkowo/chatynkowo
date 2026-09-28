/* The copy both clients use: the expedition loop as the "translation"
   namespace. Imported through the package root (`@chatynkowo/i18n`). */
import type { Language } from '@chatynkowo/core'
import { sharedPl } from './pl'
import { sharedEn } from './en'

export type SharedDictionary = typeof sharedPl

/* One dictionary per registered language — the Record over Language turns a
   registry entry without a dictionary into a compile error. */
export const SHARED_DICTIONARIES: Record<Language, SharedDictionary> = { pl: sharedPl, en: sharedEn }

export { sharedPl, sharedEn }
