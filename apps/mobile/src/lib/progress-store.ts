import { emptyProgress, emptyQueue, normalizeProgress, normalizeQueue, type StoredState, type SyncQueue } from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import { readJsonStrict, writeJson } from './storage'

/* Device storage for the seeker's progress and for the finds waiting to
   reach the account. The rules live in @chatynkowo/core (progress.ts,
   offline.ts); this module only reads and writes AsyncStorage around them.
   The reads throw when the storage cannot be read, so the provider knows
   not to write over an entry it never saw. */

export async function loadProgress(): Promise<StoredState> {
  const raw = await readJsonStrict<unknown>(STORAGE_KEYS.progress)
  return raw ? normalizeProgress(raw) : emptyProgress()
}

export async function loadQueue(): Promise<SyncQueue> {
  const raw = await readJsonStrict<unknown>(STORAGE_KEYS.syncQueue)
  return raw ? normalizeQueue(raw) : emptyQueue()
}

export function saveProgress(state: StoredState) {
  return writeJson(STORAGE_KEYS.progress, state)
}

export function saveQueue(queue: SyncQueue) {
  return writeJson(STORAGE_KEYS.syncQueue, queue)
}
