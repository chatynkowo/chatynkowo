import type { RewardLevel, StoredState } from '../types'
import { requiredFinds } from './rewards'

const STORAGE_KEY = 'chatynkowo:state:v1'

export function loadStoredState(): StoredState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredState | null
    if (parsed?.version === 1) {
      return { version: 1, found: parsed.found ?? {}, badges: parsed.badges ?? {} }
    }
  } catch {
    // Storage can be disabled in private browsing. The app remains usable.
  }
  return { version: 1, found: {}, badges: {} }
}

function saveState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Discovery still opens even when progress cannot be persisted.
  }
}

/* Award every level whose threshold the seeker has now reached. The level name
   is stored alongside the date so a reward earned before someone renamed or
   deleted it in the editor still shows up in the Kronika. */
function awardLevels(state: StoredState, levels: RewardLevel[], total: number) {
  const foundCount = Object.keys(state.found).length
  const newlyEarned: string[] = []
  for (const level of levels) {
    const required = requiredFinds(level, total)
    // required > 0 guards the final level while the cottage total is unknown
    // (data failed to load) — never award "all found" against a total of 0.
    if (typeof required !== 'number' || required <= 0) continue
    if (foundCount >= required && !state.badges[level.id]) {
      state.badges[level.id] = { earnedAt: new Date().toISOString(), name: level.name }
      newlyEarned.push(level.id)
    }
  }
  return newlyEarned
}

export function discoverCottage(
  state: StoredState,
  slug: string,
  code: string,
  total: number,
  levels: RewardLevel[],
) {
  const next: StoredState = structuredClone(state)
  const isNew = !next.found[slug]
  if (isNew) next.found[slug] = { foundAt: new Date().toISOString(), code }

  const newlyEarned = awardLevels(next, levels, total)
  saveState(next)
  return { next, isNew, newlyEarned }
}

/* Back-fill levels for progress saved before the reward config changed — a
   newly added level must not stay locked for someone who already passed its
   threshold. Returns null when nothing changed, so callers can skip a render. */
export function backfillBadges(state: StoredState, levels: RewardLevel[], total: number) {
  const next: StoredState = structuredClone(state)
  const newlyEarned = awardLevels(next, levels, total)
  if (!newlyEarned.length) return null
  saveState(next)
  return { next, newlyEarned }
}
