/* Where Chatynkowo lives outside the clients: the published site (the
   content origin for the app, the ranking page for shared results), the
   contact address, the social profiles the footer and the app's about
   screen link to, and the store listings of the app itself. */
export const SITE_ORIGIN = 'https://www.chatynkowo.pl'

export const RANKING_PAGE = `${SITE_ORIGIN}/ranking.html`

/* The site's page for reporting a problem (diagnostics.html), at both
   addresses the site answers at. The server does not turn http into
   https, and a browser keeps what a site stored apart for each of the
   two (localStorage is per origin), so a seeker's Kronika and sign-in log
   may sit under either. The app, which cannot read a browser's storage,
   sends the seeker to both. Neither is an address the app itself claims
   as an app link (those are `/` and `/index.html`), so both open in the
   browser. */
export const SITE_DIAGNOSTICS_PAGES = {
  https: `${SITE_ORIGIN}/diagnostics.html`,
  http: 'http://www.chatynkowo.pl/diagnostics.html',
} as const

/* The address for every matter, the one the privacy policy names; a
   seeker's report of a problem goes there. */
export const CONTACT_EMAIL = 'chatynkowo@gmail.com'

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/chatynkowo.pl/',
  facebook: 'https://www.facebook.com/chatynkowo/',
} as const

/* The app in the stores: Google Play for Android, the App Store for iPhone
   and iPad. */
export const STORE_LINKS = {
  googlePlay: 'https://play.google.com/store/apps/details?id=com.blockchainwares.app.mysterious.cottages',
  appStore: 'https://apps.apple.com/pl/app/chatynkowo/id6828758921',
} as const

export type StoreId = keyof typeof STORE_LINKS

/* A shareable link to one seeker's place in the ranking (the site reads
   `me` from the query). */
export function rankingShareUrl(publicId: string) {
  return `${RANKING_PAGE}?me=${encodeURIComponent(publicId)}`
}
