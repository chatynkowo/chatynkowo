import { ATTEMPT_TIMEOUT_MS, createContentClient, lookupCode, webCryptoSha256Hex, withTimeout, type CodeLookup } from '@chatynkowo/core'
import { CONTENT_BASE_URL } from '../config'

/* The site's content client: same-origin paths, WebCrypto for plaque codes. */
export const content = createContentClient({ baseUrl: CONTENT_BASE_URL, sha256Hex: webCryptoSha256Hex })

export const { loadCottages, loadRewards, storyAudio } = content

/* The plaque-code lookup as last read, kept for the page's life. A seeker
   stands at a cottage with the page open and the signal gone: the code is
   then checked against this copy, as the app checks against the one it
   keeps on the device. */
let codeLookup: CodeLookup | null = null
/* How long a fresh lookup is waited for when there is a copy to fall back
   on; a weak signal should not keep a seeker at "checking". */
const FRESH_LOOKUP_MS = 4000

/* Reads the lookup ahead of the first code, so the copy is there before
   the connection can go. A failed read is nothing: the first code asks
   again. */
export function warmCodeLookup() {
  void content
    .loadCodeLookup()
    .then((lookup) => {
      codeLookup = lookup
    })
    .catch(() => {})
}

/* A four-digit plaque code -> the cottage slug it opens, or null. The
   lookup is read afresh for every code (a new cottage's code works without
   a reload); when it cannot be read, the copy the page holds serves.
   Throws only when there is neither. */
export async function resolveCode(code: string): Promise<string | null> {
  try {
    codeLookup = await withTimeout(content.loadCodeLookup(), codeLookup ? FRESH_LOOKUP_MS : ATTEMPT_TIMEOUT_MS)
  } catch (error) {
    if (!codeLookup) throw error
  }
  return lookupCode(codeLookup, code, webCryptoSha256Hex)
}

let cachedTotal: number | null = null

/* Number of published cottages — the ranking's denominator; 0 when the
   list cannot be read. A failed read is not remembered: the next caller
   asks again, so a page opened without a connection learns the number
   once the connection is back. */
export async function totalCottages() {
  if (cachedTotal !== null) return cachedTotal
  try {
    cachedTotal = (await content.loadLocations()).length
    return cachedTotal
  } catch (error) {
    console.error('[content] totalCottages', error)
    return 0
  }
}
