import type { StoredFind } from './types'

/* Offline rules, free of any storage: a stale-while-revalidate envelope for
   cached content, the queue of finds waiting to reach the account, and the
   pace at which a client tries again what the backend did not take. The
   mobile app keeps the cache and the queue in AsyncStorage, the site keeps
   the queue in localStorage; every function here returns a new value and
   never mutates its input. */

/* ---------- Cached content ---------- */

export type CacheEntry<T> = {
  value: T
  /* ISO timestamp of when the value was fetched. */
  storedAt: string
}

export function cacheEntry<T>(value: T, now: Date = new Date()): CacheEntry<T> {
  return { value, storedAt: now.toISOString() }
}

/* How long a cached file is served without asking the network again. A stale
   entry is still shown (the forest has no signal), it just triggers a
   background refresh. */
export const CACHE_MAX_AGE_MS = {
  locations: 6 * 60 * 60 * 1000,
  stories: 24 * 60 * 60 * 1000,
  rewards: 24 * 60 * 60 * 1000,
  codeLookup: 24 * 60 * 60 * 1000,
} as const

export function isFresh(entry: CacheEntry<unknown> | null | undefined, maxAgeMs: number, now: Date = new Date()): boolean {
  if (!entry) return false
  const storedAt = Date.parse(entry.storedAt)
  return Number.isFinite(storedAt) && now.getTime() - storedAt < maxAgeMs
}

/* Whatever came out of storage -> a cache entry, or null when it is not one. */
export function normalizeCacheEntry<T>(raw: unknown): CacheEntry<T> | null {
  const parsed = raw as Partial<CacheEntry<T>> | null
  if (!parsed || typeof parsed !== 'object' || typeof parsed.storedAt !== 'string' || !('value' in parsed)) return null
  return { value: parsed.value as T, storedAt: parsed.storedAt }
}

/* ---------- Finds waiting for the account ---------- */

type PendingFind = { slug: string; foundAt: string }

export type SyncQueue = {
  version: 1
  pending: PendingFind[]
}

const SYNC_QUEUE_VERSION = 1

export function emptyQueue(): SyncQueue {
  return { version: SYNC_QUEUE_VERSION, pending: [] }
}

export function normalizeQueue(raw: unknown): SyncQueue {
  const parsed = raw as Partial<SyncQueue> | null
  if (parsed && parsed.version === SYNC_QUEUE_VERSION && Array.isArray(parsed.pending)) {
    const pending = parsed.pending.filter(
      (find): find is PendingFind => Boolean(find && typeof find.slug === 'string' && typeof find.foundAt === 'string'),
    )
    return { version: SYNC_QUEUE_VERSION, pending }
  }
  return emptyQueue()
}

/* One entry per cottage; a repeated discovery keeps the earliest date. */
export function enqueueFind(queue: SyncQueue, slug: string, foundAt: string): SyncQueue {
  const existing = queue.pending.find((find) => find.slug === slug)
  if (existing && existing.foundAt <= foundAt) return queue
  const pending = queue.pending.filter((find) => find.slug !== slug)
  return { version: SYNC_QUEUE_VERSION, pending: [...pending, { slug, foundAt }] }
}

/* Drop the finds that reached the account. */
export function settleFinds(queue: SyncQueue, slugs: Iterable<string>): SyncQueue {
  const settled = new Set(slugs)
  return { version: SYNC_QUEUE_VERSION, pending: queue.pending.filter((find) => !settled.has(find.slug)) }
}

/* The queue in the shape api.syncFinds takes. */
export function queuedFinds(queue: SyncQueue): Record<string, StoredFind> {
  return Object.fromEntries(queue.pending.map((find) => [find.slug, { foundAt: find.foundAt }]))
}

/* ---------- Trying again ---------- */

/* The pauses between tries of something the backend did not take while the
   device looked connected (a refused request, a signal too weak to carry
   it): short at first, then every few minutes for as long as the client
   is open. A reconnect, or a return to the client, tries at once whatever
   the pause. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000] as const

/* The pause after the nth failure in a row; the last one repeats. */
export function retryDelay(failures: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(failures, 1), RETRY_DELAYS_MS.length) - 1]
}

/* How long one try may take. A request on a dying connection can hang for
   minutes; past this the try counts as failed and the next one is free to
   go. What the clients send this way is idempotent, so a request that
   arrives late after all does no harm. */
export const ATTEMPT_TIMEOUT_MS = 20_000
