import {
  backfillBadges as applyBackfill,
  discoverCottage as applyDiscovery,
  emptyProgress,
  mergeFinds,
  normalizeProgress,
  type RewardLevel,
  type StoredFind,
  type StoredState,
} from '@chatynkowo/core'

/* Browser storage for the seeker's progress. The rules live in
   @chatynkowo/core (progress.ts); this module only reads and writes
   localStorage around them. */

const STORAGE_KEY = 'chatynkowo:state:v1'

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
