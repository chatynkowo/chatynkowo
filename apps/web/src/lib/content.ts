import { createContentClient, webCryptoSha256Hex } from '@chatynkowo/core'
import { CONTENT_BASE_URL } from '../config'

/* The site's content client: same-origin paths, WebCrypto for plaque codes. */
export const content = createContentClient({ baseUrl: CONTENT_BASE_URL, sha256Hex: webCryptoSha256Hex })

export const { loadCottages, loadRewards, resolveCode, storyAudio } = content

let cachedTotal: number | null = null

/* Number of published cottages — the ranking's denominator. */
export async function totalCottages() {
  if (cachedTotal !== null) return cachedTotal
  try {
    cachedTotal = (await content.loadLocations()).length
  } catch (error) {
    console.error('[content] totalCottages', error)
    cachedTotal = 0
  }
  return cachedTotal
}
