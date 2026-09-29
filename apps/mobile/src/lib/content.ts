import * as Crypto from 'expo-crypto'
import {
  CACHE_MAX_AGE_MS,
  cacheEntry,
  createContentClient,
  isFresh,
  lookupCode,
  normalizeCacheEntry,
  type CacheEntry,
  type CodeLookup,
  type Cottage,
  type Language,
  type RewardsConfig,
} from '@chatynkowo/core'
import { CONTENT_BASE_URL, STORAGE_KEYS } from '../config'
import { readJson, readJsonMany, writeJson } from './storage'

/* The app's content client (the published site as the origin, expo-crypto
   for plaque codes) wrapped in an offline cache: every file is kept in
   AsyncStorage and served stale-while-revalidate, so a cold start in the
   forest shows the last known map, stories, rewards and code lookup, and a
   refresh happens in the background whenever the network is there. */

const sha256Hex = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)

export const content = createContentClient({ baseUrl: CONTENT_BASE_URL, sha256Hex })

export const { url: contentUrl, storyAudio } = content

export type CachedResult<T> = {
  value: T
  /* Served from the device rather than the network. */
  fromCache: boolean
  /* Older than its max age; a background refresh is under way. */
  stale: boolean
}

export type CachedOptions<T> = {
  /* Called with the fresh value once a background refresh of a stale entry
     lands, so the screen can update in place. */
  revalidate?: (value: T) => void
  /* Skip the network entirely (airplane mode): a stale entry is final. */
  offline?: boolean
  /* Pull to refresh: ask the network even when the entry is fresh, and keep
     the cached copy only when the fetch fails. */
  force?: boolean
}

/* Cache entry names: one per published file, stories and rewards per
   language. The lookup is the same for every language. */
export const CACHE_NAMES = {
  cottages: (language: Language) => `cottages:${language}`,
  rewards: (language: Language) => `rewards:${language}`,
  codeLookup: 'codeLookup',
} as const

const cacheKey = (name: string) => `${STORAGE_KEYS.contentCache}${name}`

async function readEntry<T>(name: string): Promise<CacheEntry<T> | null> {
  return normalizeCacheEntry<T>(await readJson<unknown>(cacheKey(name)))
}

async function writeEntry<T>(name: string, value: T) {
  await writeJson(cacheKey(name), cacheEntry(value))
}

export type CachedEntries = {
  cottages: CacheEntry<Cottage[]> | null
  rewards: CacheEntry<RewardsConfig> | null
  lookup: CacheEntry<CodeLookup> | null
}

/* The three entries the app boots from, in one storage round trip and
   without touching the network; bootstrap() races this against its
   deadline. */
export async function readCachedEntries(language: Language): Promise<CachedEntries> {
  const [cottages, rewards, lookup] = await readJsonMany<unknown>([
    cacheKey(CACHE_NAMES.cottages(language)),
    cacheKey(CACHE_NAMES.rewards(language)),
    cacheKey(CACHE_NAMES.codeLookup),
  ])
  return {
    cottages: normalizeCacheEntry<Cottage[]>(cottages),
    rewards: normalizeCacheEntry<RewardsConfig>(rewards),
    lookup: normalizeCacheEntry<CodeLookup>(lookup),
  }
}

/* Fresh cache -> returned as is. Stale cache -> returned now, refreshed in
   the background. No cache -> fetched; a failure here propagates, since
   there is nothing to show. Forced -> fetched first, cache as the fallback. */
export async function cached<T>(
  name: string,
  maxAgeMs: number,
  loader: () => Promise<T>,
  { revalidate, offline, force }: CachedOptions<T> = {},
): Promise<CachedResult<T>> {
  const entry = await readEntry<T>(name)
  if (force && !offline) {
    try {
      const value = await loader()
      await writeEntry(name, value)
      return { value, fromCache: false, stale: false }
    } catch (error) {
      if (!entry) throw error
      return { value: entry.value, fromCache: true, stale: !isFresh(entry, maxAgeMs) }
    }
  }
  if (entry && (isFresh(entry, maxAgeMs) || offline)) {
    return { value: entry.value, fromCache: true, stale: !isFresh(entry, maxAgeMs) }
  }
  if (entry) {
    void loader()
      .then(async (value) => {
        await writeEntry(name, value)
        revalidate?.(value)
      })
      .catch(() => {
        // Still offline, or the site is down: the stale copy stays in use.
      })
    return { value: entry.value, fromCache: true, stale: true }
  }
  const value = await loader()
  await writeEntry(name, value)
  return { value, fromCache: false, stale: false }
}

export function loadCottagesCached(language: Language, options?: CachedOptions<Cottage[]>) {
  return cached(CACHE_NAMES.cottages(language), CACHE_MAX_AGE_MS.stories, () => content.loadCottages(language), options)
}

export function loadRewardsCached(language: Language, options?: CachedOptions<RewardsConfig>) {
  return cached(CACHE_NAMES.rewards(language), CACHE_MAX_AGE_MS.rewards, () => content.loadRewards(language), options)
}

export function loadCodeLookupCached(options?: CachedOptions<CodeLookup>) {
  return cached(CACHE_NAMES.codeLookup, CACHE_MAX_AGE_MS.codeLookup, () => content.loadCodeLookup(), options)
}

/* A plaque code -> the cottage it opens, against a lookup already in hand
   (the content provider's), with no storage or network involved. */
export function resolveCode(lookup: CodeLookup, code: string): Promise<string | null> {
  return lookupCode(lookup, code, sha256Hex)
}

/* The same, validated against the cached lookup (the network is only asked
   when nothing is cached yet). */
export async function resolveCodeOffline(code: string, offline?: boolean): Promise<string | null> {
  const { value: lookup } = await loadCodeLookupCached({ offline })
  return lookupCode(lookup, code, sha256Hex)
}
