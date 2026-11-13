import {
  backfillBadges as applyBackfill,
  discoverCottage as applyDiscovery,
  emptyProgress,
  emptyQueue,
  enqueueFind,
  mergeFinds,
  normalizeProgress,
  normalizeQueue,
  settleFinds,
  type RewardLevel,
  type StoredFind,
  type StoredState,
  type SyncQueue,
} from '@chatynkowo/core'

/* Browser storage for the seeker's progress and for the finds waiting to
   reach the account. The rules live in @chatynkowo/core (progress.ts,
   offline.ts); this module only reads and writes localStorage around
   them, as the app's progress-store does with AsyncStorage. */

const STORAGE_KEY = 'chatynkowo:state:v1'
/* The app keeps its queue under the same name. */
const QUEUE_KEY = 'chatynkowo:sync-queue:v1'

export function loadStoredState(): StoredState {
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    // Storage can be disabled in private browsing. The app remains usable.
    return emptyProgress()
  }
}

function saveState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Discovery still opens even when progress cannot be persisted.
  }
}

/* The finds alone, for syncing to an account. */
export function localFinds(): Record<string, StoredFind> {
  return loadStoredState().found
}

export function discoverCottage(
  state: StoredState,
  slug: string,
  code: string,
  total: number,
  levels: RewardLevel[],
) {
  const result = applyDiscovery(state, slug, code, total, levels)
  saveState(result.next)
  return result
}

export function backfillBadges(state: StoredState, levels: RewardLevel[], total: number) {
  const result = applyBackfill(state, levels, total)
  if (result) saveState(result.next)
  return result
}

/* The account's finds merged into the browser's progress (the earliest
   date wins, nothing is removed) and saved: the new state when something
   changed, null when the browser knew it all. A page that holds the
   progress in memory passes its own copy, so a find made meanwhile is
   kept. */
export function mergeAccountFinds(remote: Record<string, StoredFind>, current: StoredState = loadStoredState()): StoredState | null {
  const merged = mergeFinds(current, remote)
  const changed = Object.entries(merged.found).some(([slug, find]) => current.found[slug]?.foundAt !== find.foundAt)
  if (!changed) return null
  saveState(merged)
  return merged
}

/* ---------- Finds waiting for the account ---------- */

/* Every new find lands in the queue, signed in or not. The exchange with
   the account (useAccountExchange) sends what waits and settles it, and
   keeps trying while the backend does not take it; signing out ends the
   queue, as in the app, because the next sign-in sends the whole Kronika
   anyway. */

const queueListeners = new Set<() => void>()

export function loadQueue(): SyncQueue {
  try {
    return normalizeQueue(JSON.parse(localStorage.getItem(QUEUE_KEY) || 'null'))
  } catch {
    return emptyQueue()
  }
}

function saveQueue(queue: SyncQueue) {
  try {
    if (queue.pending.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Without storage there is no Kronika to send either.
  }
  queueListeners.forEach((listener) => listener())
}

export function queueFind(slug: string, foundAt: string) {
  saveQueue(enqueueFind(loadQueue(), slug, foundAt))
}

/* Drops the finds that reached the account. */
export function settleQueue(slugs: string[]) {
  if (slugs.length) saveQueue(settleFinds(loadQueue(), slugs))
}

export function clearQueue() {
  saveQueue(emptyQueue())
}

/* How many finds wait, for a page to say so. */
export function pendingFinds(): number {
  return loadQueue().pending.length
}

/* Every change of the queue, made here or in another tab of the site. */
export function subscribeQueue(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_KEY || event.key === null) listener()
  }
  queueListeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    queueListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
