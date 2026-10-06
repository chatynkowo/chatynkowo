import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* The support ledger: how many coffees and ads the player has given, kept
   on this device only (nothing reaches the account; the ledger is a
   keepsake, not a currency, since support unlocks nothing). One store
   behind one read of AsyncStorage, the same shape as the reachability
   store (network.ts): subscribers read one snapshot and re-render on a
   change; the hook on top lives in src/features/support. A coffee is what
   the player says arrived (the app cannot see the payment page's
   outcome), an ad is one watched to the end (the ad network's word). */

export type SupportKind = 'coffee' | 'ad'

export type SupportLedger = {
  coffees: number
  ads: number
  /* When the last support was given, in milliseconds since the epoch; 0
     for none. */
  lastAt: number
}

export const EMPTY_LEDGER: SupportLedger = { coffees: 0, ads: 0, lastAt: 0 }

let snapshot: SupportLedger = EMPTY_LEDGER
const listeners = new Set<() => void>()
let reading: Promise<void> | null = null

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/* A stored ledger brought back to shape; a broken entry counts as empty. */
function normalize(raw: unknown): SupportLedger {
  if (typeof raw !== 'object' || raw === null) return EMPTY_LEDGER
  const record = raw as Record<string, unknown>
  return { coffees: count(record.coffees), ads: count(record.ads), lastAt: count(record.lastAt) }
}

function publish(next: SupportLedger) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

/* The device is read once, on first use; a record made before the read
   lands is added on top of what was stored. */
function ensureRead(): Promise<void> {
  if (!reading) {
    reading = readJson<unknown>(STORAGE_KEYS.support).then((raw) => {
      const stored = normalize(raw)
      publish({
        coffees: stored.coffees + snapshot.coffees,
        ads: stored.ads + snapshot.ads,
        lastAt: Math.max(stored.lastAt, snapshot.lastAt),
      })
    })
  }
  return reading
}

export function subscribe(listener: () => void): () => void {
  void ensureRead()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): SupportLedger {
  return snapshot
}

/* One more coffee or ad, saved at once. */
export function recordSupport(kind: SupportKind, now = Date.now()): void {
  publish({
    coffees: snapshot.coffees + (kind === 'coffee' ? 1 : 0),
    ads: snapshot.ads + (kind === 'ad' ? 1 : 0),
    lastAt: now,
  })
  void ensureRead().then(() => writeJson(STORAGE_KEYS.support, snapshot))
}
