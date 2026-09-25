/* @chatynkowo/i18n — the interface dictionaries, one per language registered
   in @chatynkowo/core. This package deliberately does not initialise i18next:
   the web adds the browser language detector, the mobile app will use the
   device locale, and both hand these resources to their own i18next instance.

   Content translations (stories, reward cards, recordings) are not here —
   they live next to the Polish originals in the repository root and are
   resolved by the content client. */
import type { Language } from '@chatynkowo/core'
import { pl } from './pl'
import { en } from './en'

export type Dictionary = typeof pl

/* One dictionary per registered language — the Record over Language turns a
   registry entry without a dictionary into a compile error. */
export const DICTIONARIES: Record<Language, Dictionary> = { pl, en }

export { pl, en }
