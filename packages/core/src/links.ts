/* Where Chatynkowo lives outside the clients: the published site (the
   content origin for the app, the ranking page for shared results) and
   the social profiles the footer and the app's about screen link to. */
export const SITE_ORIGIN = 'https://www.chatynkowo.pl'

export const RANKING_PAGE = `${SITE_ORIGIN}/ranking.html`

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/chatynkowo.pl/',
  facebook: 'https://www.facebook.com/chatynkowo/',
} as const

/* A shareable link to one seeker's place in the ranking (the site reads
   `me` from the query). */
export function rankingShareUrl(publicId: string) {
  return `${RANKING_PAGE}?me=${encodeURIComponent(publicId)}`
}
