import type { RewardLevel, StoredFind, StoredState } from './types'
import { requiredFinds } from './rewards'

/* Progress rules, free of any storage. The web wraps these with localStorage
   (apps/web/src/lib/persistence.ts), the mobile app with its own storage
   and the sync queue (apps/mobile/src/providers/ProgressProvider.tsx), and
   both merge the account's finds back in with `mergeFinds`. Every function
   returns a new state and never mutates its input. */

export const PROGRESS_VERSION = 1

export function emptyProgress(): StoredState {
  return { version: PROGRESS_VERSION, found: {}, badges: {} }
}

/* Whatever came out of storage -> a valid state, or an empty one. */
export function normalizeProgress(raw: unknown): StoredState {
  const parsed = raw as Partial<StoredState> | null
  if (parsed && parsed.version === PROGRESS_VERSION) {
    return { version: PROGRESS_VERSION, found: parsed.found ?? {}, badges: parsed.badges ?? {} }
  }
  return emptyProgress()
}

/* The state is plain JSON (strings and nested records), so a JSON round-trip
   is a complete deep copy and works on every runtime, Hermes included. */
export function cloneProgress(state: StoredState): StoredState {
  return JSON.parse(JSON.stringify(state)) as StoredState
}

export function foundCount(state: Pick<StoredState, 'found'>) {
  return Object.keys(state.found).length
}

/* Award every level whose threshold the seeker has now reached. The level name
   is stored alongside the date so a reward earned before someone renamed or
   deleted it in the editor still shows up in the Kronika. Mutates `state`,
   which callers pass as a fresh clone. */
function awardLevels(state: StoredState, levels: RewardLevel[], total: number, now: Date) {
  const count = foundCount(state)
  const newlyEarned: string[] = []
  for (const level of levels) {
    const required = requiredFinds(level, total)
    // required > 0 guards the final level while the cottage total is unknown
    // (data failed to load) — never award "all found" against a total of 0.
    if (typeof required !== 'number' || required <= 0) continue
    if (count >= required && !state.badges[level.id]) {
      state.badges[level.id] = { earnedAt: now.toISOString(), name: level.name }
      newlyEarned.push(level.id)
    }
  }
  return newlyEarned
}

export type DiscoveryResult = { next: StoredState; isNew: boolean; newlyEarned: string[] }

export function discoverCottage(
  state: StoredState,
  slug: string,
  code: string,
  total: number,
  levels: RewardLevel[],
  now: Date = new Date(),
): DiscoveryResult {
  const next = cloneProgress(state)
  const isNew = !next.found[slug]
  if (isNew) next.found[slug] = { foundAt: now.toISOString(), code }
  const newlyEarned = awardLevels(next, levels, total, now)
  return { next, isNew, newlyEarned }
}

/* Back-fill levels for progress saved before the reward config changed — a
   newly added level must not stay locked for someone who already passed its
   threshold. Returns null when nothing changed, so callers can skip a render. */
export function backfillBadges(
  state: StoredState,
  levels: RewardLevel[],
  total: number,
  now: Date = new Date(),
): { next: StoredState; newlyEarned: string[] } | null {
  const next = cloneProgress(state)
  const newlyEarned = awardLevels(next, levels, total, now)
  if (!newlyEarned.length) return null
  return { next, newlyEarned }
}

/* Merge finds that arrived from elsewhere (another device, the backend) into
   a local state: the earliest discovery date wins, nothing is ever removed. */
export function mergeFinds(state: StoredState, incoming: Record<string, StoredFind>): StoredState {
  const next = cloneProgress(state)
  for (const [slug, find] of Object.entries(incoming)) {
    const current = next.found[slug]
    if (!current || find.foundAt < current.foundAt) next.found[slug] = { ...current, ...find }
  }
  return next
}

/* Merge a whole progress record from this device read late (a storage that
   answered after the app had moved on): finds as `mergeFinds`, badges with
   the earliest `earnedAt` winning, nothing removed. */
export function mergeProgress(state: StoredState, other: StoredState): StoredState {
  const next = mergeFinds(state, other.found)
  for (const [id, badge] of Object.entries(other.badges)) {
    const current = next.badges[id]
    if (!current || badge.earnedAt < current.earnedAt) next.badges[id] = badge
  }
  return next
}

/* Every level the seeker has a record of: the published ones, plus any level
   earned before it was renamed or removed in the editor, so collected
   progress is never hidden from the Kronika. */
export function kronikaLevels(levels: RewardLevel[], badges: StoredState['badges']): RewardLevel[] {
  const published = new Set(levels.map((level) => level.id))
  const orphans = Object.entries(badges)
    .filter(([id]) => !published.has(id))
    .map(([id, meta]) => ({ id, name: meta.name || id, threshold: null, final: false, image: '', body: '' }))
  return [...levels, ...orphans]
}

/* The first level still locked and how many more discoveries it needs, or
   null once everything is earned — the "next task" line of the quest panel. */
export function nextLevel(
  state: StoredState,
  levels: RewardLevel[],
  total: number,
): { level: RewardLevel; remaining: number } | null {
  const level = levels.find((candidate) => !state.badges[candidate.id])
  if (!level) return null
  const required = requiredFinds(level, total) || total
  return { level, remaining: Math.max(0, required - foundCount(state)) }
}
