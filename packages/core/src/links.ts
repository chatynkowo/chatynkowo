/* Where Chatynkowo lives outside the clients: the published site (the
   content origin for the app, the ranking page for shared results), the
   social profiles the footer and the app's about screen link to, and the
   store listings of the app itself. */
export const SITE_ORIGIN = 'https://www.chatynkowo.pl'

export const RANKING_PAGE = `${SITE_ORIGIN}/ranking.html`

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/chatynkowo.pl/',
  facebook: 'https://www.facebook.com/chatynkowo/',
} as const

/* The app in the stores. Only Android is published so far; the App Store
   listing joins here when it is. */
export const STORE_LINKS = {
  googlePlay: 'https://play.google.com/store/apps/details?id=com.blockchainwares.app.mysterious.cottages',
} as const

/* A shareable link to one seeker's place in the ranking (the site reads
   `me` from the query). */
export function rankingShareUrl(publicId: string) {
  return `${RANKING_PAGE}?me=${encodeURIComponent(publicId)}`
}
