/* The single registry of the site's languages — deliberately free of the
   dictionaries themselves, so the admin editor can share it without pulling
   the interface copy into its bundle.

   To add a new language:
   1. add an entry below and create its dictionary: copy src/i18n/pl.ts,
      translate it, and register it in DICTIONARIES in src/i18n/index.ts
      (the Record type errors until it is added);
   2. translate the content — cottages/<code>/<slug>.md and
      data/rewards.<code>.json, most conveniently via the language select
      in /admin/; any file that is missing simply falls back to the Polish
      original;
   3. if translated legal pages exist under legal/, point the new
      dictionary's footer.termsHref / footer.privacyHref at them
      (otherwise keep the Polish hrefs). */
export const LANGUAGES = [
  { code: 'pl', nativeName: 'polski' },
  { code: 'en', nativeName: 'English' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: Language = 'pl'

/* Narrows whatever i18next reports (undefined during startup, or a
   regional variant) to a language the site actually ships. */
export function toLanguage(code: string | undefined): Language {
  return LANGUAGES.find((language) => language.code === code)?.code ?? DEFAULT_LANGUAGE
}
