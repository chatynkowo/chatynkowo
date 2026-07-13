import type { BadgeDefinition, StoredState } from '../types'

const STORAGE_KEY = 'chatynkowo:state:v1'

export const BADGES: BadgeDefinition[] = [
  { id: 'first-find', name: 'Pierwsza Chatynka', description: 'Pierwsza opowieść została odkryta.', threshold: 1 },
  { id: 'tropiciel', name: 'Tropiciel', description: 'Pięć Chatynek odnalezionych.', threshold: 5 },
  { id: 'polowa-drogi', name: 'Połowa drogi', description: 'Połowa wyprawy jest już za Tobą.', threshold: 13 },
  { id: 'mistrz-chatynkowa', name: 'Mistrz Chatynkowa', description: 'Wszystkie Chatynki zostały odkryte.', final: true },
]

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

export function discoverCottage(state: StoredState, slug: string, code: string, total: number) {
  const next: StoredState = structuredClone(state)
  const isNew = !next.found[slug]
  if (isNew) next.found[slug] = { foundAt: new Date().toISOString(), code }

  const foundCount = Object.keys(next.found).length
  const newlyEarned: string[] = []
  for (const badge of BADGES) {
    const required = badge.final ? total : badge.threshold ?? Number.POSITIVE_INFINITY
    if (foundCount >= required && !next.badges[badge.id]) {
      next.badges[badge.id] = { earnedAt: new Date().toISOString() }
      newlyEarned.push(badge.id)
    }
  }
  saveState(next)
  return { next, isNew, newlyEarned }
}
