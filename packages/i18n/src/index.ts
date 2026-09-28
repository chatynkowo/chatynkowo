/* @chatynkowo/i18n — the interface dictionaries, one set per language
   registered in @chatynkowo/core, in three directories with an entry point
   each, so a client bundles only what it uses:

   - shared/ — copy both clients use; this package root (`@chatynkowo/i18n`);
   - web/    — copy that exists only on the site: `@chatynkowo/i18n/web`;
   - mobile/ — copy that exists only in the app: `@chatynkowo/i18n/mobile`.

   The web and mobile entries also build their client's i18next resources.
   This package deliberately does not initialise i18next: each app hands
   those resources to its own instance (the site adds browser language
   detection, the app uses the device locale). Content translations
   (stories, reward cards, recordings) are not here — they live in
   packages/content next to the Polish originals and are resolved by the
   content client. */
export * from './shared'
