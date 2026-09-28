import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  backfillBadges,
  discoverCottage,
  emptyProgress,
  emptyQueue,
  enqueueFind,
  foundCount as countFound,
  mergeFinds,
  queuedFinds,
  settleFinds,
  type DiscoveryResult,
  type StoredState,
  type SyncQueue,
} from '@chatynkowo/core'
import { loadProgress, loadQueue, saveProgress, saveQueue } from '../lib/progress-store'
import { onReconnect } from '../lib/network'
import { pullFinds, pushFinds } from '../lib/sync'
import { useContent } from './ContentProvider'
import { useSession } from './SessionProvider'

/* The seeker's progress: the local Kronika (source of truth, persisted on
   the device) and the queue of finds waiting for the account. Discoveries
   are applied with the core rules, saved, queued, and pushed whenever the
   device is online and someone is signed in; on sign-in the account's finds
   are merged back into the device. */

type ProgressValue = {
  state: StoredState
  /* False until the stored progress has been read; screens hold their
     first render on it so an empty Kronika never flashes. */
  hydrated: boolean
  foundSlugs: Set<string>
  foundCount: number
  /* Finds not yet saved to the account. */
  pendingCount: number
  discover: (slug: string, code: string) => Promise<DiscoveryResult>
  /* Ids of levels earned by the latest discovery, for the toast. */
  celebration: string[]
  dismissCelebration: () => void
}

const ProgressContext = createContext<ProgressValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { rewards, total } = useContent()
  const { session } = useSession()
  const [state, setState] = useState<StoredState>(emptyProgress)
  const [queue, setQueue] = useState<SyncQueue>(emptyQueue)
  const [hydrated, setHydrated] = useState(false)
  const [celebration, setCelebration] = useState<string[]>([])
  const syncing = useRef(false)

  useEffect(() => {
    let current = true
    void Promise.all([loadProgress(), loadQueue()]).then(([progress, pending]) => {
      if (!current) return
      setState(progress)
      setQueue(pending)
      setHydrated(true)
    })
    return () => {
      current = false
    }
  }, [])

  /* Cottages and the reward config can change what is already earned (a
     new level, a lowered threshold). Reconcile once both are in. */
  useEffect(() => {
    if (!hydrated || !total) return
    const result = backfillBadges(state, rewards.levels, total)
    if (result) {
      setState(result.next)
      void saveProgress(result.next)
    }
  }, [hydrated, total, rewards.levels, state])

  const commitQueue = useCallback((next: SyncQueue) => {
    setQueue(next)
    void saveQueue(next)
  }, [])

  const flush = useCallback(async () => {
    if (!session || !queue.pending.length || syncing.current) return
    syncing.current = true
    try {
      if (await pushFinds(session, queuedFinds(queue), total)) {
        commitQueue(settleFinds(queue, queue.pending.map((find) => find.slug)))
      }
    } finally {
      syncing.current = false
    }
  }, [session, queue, total, commitQueue])

  /* Push whenever there is something to push and a session to push to;
     retried on every reconnect. */
  useEffect(() => {
    void flush()
    return onReconnect(() => void flush())
  }, [flush])

  /* On sign-in, the account and the device exchange finds: everything local
     goes up, everything remote comes down, the earliest date wins. */
  const exchangedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!hydrated || !session || exchangedFor.current === session.user.id) return
    exchangedFor.current = session.user.id
    let current = true
    void (async () => {
      await pushFinds(session, state.found, total)
      const remote = await pullFinds(session)
      if (!current || !Object.keys(remote).length) return
      setState((local) => {
        const merged = mergeFinds(local, remote)
        void saveProgress(merged)
        return merged
      })
    })()
    return () => {
      current = false
    }
  }, [hydrated, session, state.found, total])

  const discover = useCallback(
    async (slug: string, code: string) => {
      const result = discoverCottage(state, slug, code, total, rewards.levels)
      setState(result.next)
      await saveProgress(result.next)
      if (result.isNew) {
        commitQueue(enqueueFind(queue, slug, result.next.found[slug].foundAt))
      }
      if (result.newlyEarned.length) setCelebration(result.newlyEarned)
      return result
    },
    [state, total, rewards.levels, queue, commitQueue],
  )

  const dismissCelebration = useCallback(() => setCelebration([]), [])

  const foundSlugs = useMemo(() => new Set(Object.keys(state.found)), [state.found])

  const value = useMemo<ProgressValue>(
    () => ({
      state,
      hydrated,
      foundSlugs,
      foundCount: countFound(state),
      pendingCount: queue.pending.length,
      discover,
      celebration,
      dismissCelebration,
    }),
    [state, hydrated, foundSlugs, queue.pending.length, discover, celebration, dismissCelebration],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside ProgressProvider.')
  return value
}
