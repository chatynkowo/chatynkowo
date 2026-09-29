import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  backfillBadges,
  discoverCottage,
  enqueueFind,
  foundCount as countFound,
  mergeFinds,
  queuedFinds,
  settleFinds,
  type DiscoveryResult,
  type StoredState,
  type SyncQueue,
} from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import type { BootResult } from '../lib/bootstrap'
import { loadProgressStrict, loadQueueStrict, saveProgress, saveQueue } from '../lib/progress-store'
import { writeJson } from '../lib/storage'
import { pullFinds, pushFinds } from '../lib/sync'
import { useContent } from './ContentProvider'
import { useForeground, useOnline, useReconnect } from './NetworkProvider'
import { useSession } from './SessionProvider'

/* The seeker's progress: the local Kronika (source of truth, persisted on
   the device) and the queue of finds waiting for the account. Discoveries
   are applied with the core rules, saved, queued, and pushed whenever the
   device is online and someone is signed in; on sign-in the account's finds
   are merged back into the device. Two kinds of "new reward" leave here:
   the in-memory celebration queue (levels earned by a live discovery, shown
   by the Atlas after the story closes) and the persisted unseen list (the
   Kronika tab badge, which also covers levels back-filled by a content
   update). */

export type ProgressValue = {
  state: StoredState
  /* Always true: the stored progress arrives with the bootstrap result. */
  hydrated: boolean
  foundSlugs: Set<string>
  foundCount: number
  /* Finds not yet saved to the account. */
  pendingCount: number
  /* The account exchange on sign-in is in flight. */
  exchanging: boolean
  /* Idempotent: a second call for the same slug while the first is pending
     returns the same promise. */
  discover: (slug: string, code: string) => Promise<DiscoveryResult>
  /* Level ids earned by live discoveries, oldest first; in memory only. */
  celebration: string[]
  shiftCelebration: () => void
  clearCelebration: () => void
  /* Earned level ids not yet viewed in the Kronika; persisted. */
  unseenRewards: string[]
  markRewardsSeen: () => void
  /* The latest new discovery, for the Atlas to frame the cottage. */
  lastFound: { slug: string; at: number } | null
  /* The story modal marks itself open so the celebration presenter never
     fires over it. Refs, not state: nothing re-renders. */
  setStoryOpen: (open: boolean) => void
  isStoryOpen: () => boolean
  /* The story's reward banner asks for the celebration right away; the
     presenter reads the flag once (it clears on read) and skips its wait. */
  requestCelebration: () => void
  wantsCelebrateNow: () => boolean
  /* Levels awarded by a content update (never a live find); the root shows
     a toast. Returns the unsubscribe function. */
  onBackfill: (listener: (ids: string[]) => void) => () => void
}

type BackfillListener = (ids: string[]) => void

const ProgressContext = createContext<ProgressValue | null>(null)

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id))
}

export function ProgressProvider({ initial, children }: { initial: BootResult; children: ReactNode }) {
  const { rewards, total, prefetchStoryPhotos } = useContent()
  const { session } = useSession()
  const online = useOnline()
  const [state, setState] = useState<StoredState>(initial.progress)
  const [queue, setQueue] = useState<SyncQueue>(initial.queue)
  const [celebration, setCelebration] = useState<string[]>([])
  const [rewardsSeen, setRewardsSeen] = useState<string[]>(initial.rewardsSeen)
  const [lastFound, setLastFound] = useState<{ slug: string; at: number } | null>(null)
  const [exchanging, setExchanging] = useState(false)

  /* Latest values for the callbacks that subscribe once (flush, exchange)
     and for updates computed outside a render. Written before any other
     effect of this component runs. */
  const stateRef = useRef(state)
  const queueRef = useRef(queue)
  const sessionRef = useRef(session)
  const totalRef = useRef(total)
  const levelsRef = useRef(rewards.levels)
  const onlineRef = useRef(online)
  const rewardsSeenRef = useRef(rewardsSeen)
  useEffect(() => {
    stateRef.current = state
    queueRef.current = queue
    sessionRef.current = session
    totalRef.current = total
    levelsRef.current = rewards.levels
    onlineRef.current = online
    rewardsSeenRef.current = rewardsSeen
  })

  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  /* A boot that could not read the storage: nothing is written until a
     read succeeds, then what was stored is merged with what happened since
     (the earliest find wins, nothing is lost) and writes resume. */
  const persistBlocked = useRef(!initial.storageOk)

  const syncing = useRef(false)
  const inFlight = useRef(new Map<string, Promise<DiscoveryResult>>())
  const storyOpen = useRef(false)
  const celebrateNow = useRef(false)
  const backfillListeners = useRef(new Set<BackfillListener>())

  const commitQueue = useCallback((next: SyncQueue) => {
    queueRef.current = next
    setQueue(next)
    if (!persistBlocked.current) void saveQueue(next)
  }, [])

  const commitState = useCallback((next: StoredState) => {
    stateRef.current = next
    setState(next)
    return persistBlocked.current ? Promise.resolve() : saveProgress(next)
  }, [])

  useEffect(() => {
    if (!persistBlocked.current) return
    let cancelled = false
    const delays = [1000, 5000, 15000, 60000]
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const retry = () => {
      timer = setTimeout(async () => {
        try {
          const [stored, storedQueue] = await Promise.all([loadProgressStrict(), loadQueueStrict()])
          if (cancelled) return
          persistBlocked.current = false
          const merged = mergeFinds(stateRef.current, stored.found)
          for (const [id, badge] of Object.entries(stored.badges)) if (!merged.badges[id]) merged.badges[id] = badge
          await commitState(merged)
          const pending = storedQueue.pending.reduce((queue, find) => enqueueFind(queue, find.slug, find.foundAt), queueRef.current)
          commitQueue(pending)
        } catch {
          if (cancelled) return
          attempt = Math.min(attempt + 1, delays.length - 1)
          retry()
        }
      }, delays[attempt])
    }
    retry()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [commitState, commitQueue])

  /* Push to the account while something is queued. The whole Kronika goes
     up (an idempotent upsert; existing rows keep their date), so the backend
     sees the seeker's real count and marks the collection complete when the
     last cottage arrives one find at a time. Reads the latest values through
     refs so one subscription serves every trigger. */
  const flush = useCallback(async () => {
    const current = sessionRef.current
    const pending = queueRef.current
    if (!current || !pending.pending.length || syncing.current || onlineRef.current === false) return
    syncing.current = true
    try {
      const found = { ...stateRef.current.found, ...queuedFinds(pending) }
      if (await pushFinds(current, found, totalRef.current)) {
        commitQueue(settleFinds(queueRef.current, pending.pending.map((find) => find.slug)))
      }
    } finally {
      syncing.current = false
    }
  }, [commitQueue])

  /* Whenever something new is waiting and someone is signed in; retried on
     every reconnect and every return to the foreground. */
  useEffect(() => {
    void flush()
  }, [flush, queue, session])
  useReconnect(() => void flush())
  useForeground(() => void flush())

  /* On sign-in, the account and the device exchange finds: everything local
     goes up, everything remote comes down, the earliest date wins. Once per
     account; a failure forgets the attempt so a reconnect retries it. */
  const exchangedFor = useRef<string | null>(null)
  const exchangeAttempt = useRef(0)
  const exchange = useCallback(async () => {
    const current = sessionRef.current
    if (!current || totalRef.current <= 0 || exchangedFor.current === current.user.id) return
    const userId = current.user.id
    const attempt = ++exchangeAttempt.current
    exchangedFor.current = userId
    /* Abandoned when the provider unmounts or the account changes under it. */
    const cancelled = () => !mounted.current || sessionRef.current?.user.id !== userId
    setExchanging(true)
    try {
      const pushed = await pushFinds(current, stateRef.current.found, totalRef.current)
      const remote = await pullFinds(current)
      if (cancelled()) return
      if (Object.keys(remote).length) await commitState(mergeFinds(stateRef.current, remote))
      if (!pushed) exchangedFor.current = null
    } catch {
      if (!cancelled()) exchangedFor.current = null
    } finally {
      if (mounted.current && exchangeAttempt.current === attempt) setExchanging(false)
    }
  }, [commitState])

  const hydrated = true
  const userId = session?.user.id
  const contentReady = total > 0
  useEffect(() => {
    if (!userId) exchangedFor.current = null
    if (!hydrated || !userId || !contentReady) return
    void exchange()
  }, [hydrated, userId, contentReady, exchange])
  useReconnect(() => void exchange())

  /* Cottages and the reward config can change what is already earned (a
     new level, a lowered threshold, finds merged from the account).
     Reconcile once both are in; these levels go to the badge and a toast,
     never to the celebration queue. */
  useEffect(() => {
    if (!total) return
    const result = backfillBadges(state, rewards.levels, total)
    if (!result) return
    void commitState(result.next)
    backfillListeners.current.forEach((listener) => listener(result.newlyEarned))
  }, [state, rewards.levels, total, commitState])

  const discover = useCallback(
    (slug: string, code: string): Promise<DiscoveryResult> => {
      const pending = inFlight.current.get(slug)
      if (pending) return pending
      const run = (async () => {
        /* The functional update keeps two quick discoveries from clobbering
           each other; the result is read back out of the updater. */
        const result = await new Promise<DiscoveryResult>((resolve) => {
          setState((current) => {
            const outcome = discoverCottage(current, slug, code, totalRef.current, levelsRef.current)
            resolve(outcome)
            return outcome.next
          })
        })
        stateRef.current = result.next
        await saveProgress(result.next)
        if (result.isNew) {
          commitQueue(enqueueFind(queueRef.current, slug, result.next.found[slug].foundAt))
          setLastFound({ slug, at: Date.now() })
        }
        if (result.newlyEarned.length) setCelebration((ids) => [...ids, ...result.newlyEarned])
        return result
      })()
      inFlight.current.set(slug, run)
      const settle = () => {
        inFlight.current.delete(slug)
      }
      run.then(settle, settle)
      return run
    },
    [commitQueue],
  )

  const shiftCelebration = useCallback(() => setCelebration((ids) => ids.slice(1)), [])
  const clearCelebration = useCallback(() => setCelebration([]), [])

  /* Oldest first, so the Kronika glow order matches the order earned. */
  const unseenRewards = useMemo(() => {
    const seen = new Set(rewardsSeen)
    return Object.entries(state.badges)
      .sort(([, a], [, b]) => a.earnedAt.localeCompare(b.earnedAt))
      .map(([id]) => id)
      .filter((id) => !seen.has(id))
  }, [state.badges, rewardsSeen])

  const markRewardsSeen = useCallback(() => {
    const ids = Object.keys(stateRef.current.badges)
    /* A reward looked at in the Kronika is not celebrated again later. */
    setCelebration((queued) => (queued.length ? queued.filter((id) => !ids.includes(id)) : queued))
    if (sameIds(ids, rewardsSeenRef.current)) return
    rewardsSeenRef.current = ids
    setRewardsSeen(ids)
    void writeJson(STORAGE_KEYS.rewardsSeen, ids)
  }, [])

  const setStoryOpen = useCallback((open: boolean) => {
    storyOpen.current = open
  }, [])
  const isStoryOpen = useCallback(() => storyOpen.current, [])
  const requestCelebration = useCallback(() => {
    celebrateNow.current = true
  }, [])
  const wantsCelebrateNow = useCallback(() => {
    const wants = celebrateNow.current
    celebrateNow.current = false
    return wants
  }, [])

  const onBackfill = useCallback((listener: BackfillListener) => {
    backfillListeners.current.add(listener)
    return () => {
      backfillListeners.current.delete(listener)
    }
  }, [])

  const foundSlugs = useMemo(() => new Set(Object.keys(state.found)), [state.found])

  /* The found cottages' photos open the story instantly, also offline. */
  useEffect(() => {
    prefetchStoryPhotos(foundSlugs)
  }, [foundSlugs, prefetchStoryPhotos])

  const value = useMemo<ProgressValue>(
    () => ({
      state,
      hydrated,
      foundSlugs,
      foundCount: countFound(state),
      pendingCount: queue.pending.length,
      exchanging,
      discover,
      celebration,
      shiftCelebration,
      clearCelebration,
      unseenRewards,
      markRewardsSeen,
      lastFound,
      setStoryOpen,
      isStoryOpen,
      requestCelebration,
      wantsCelebrateNow,
      onBackfill,
    }),
    [
      state,
      foundSlugs,
      queue.pending.length,
      exchanging,
      discover,
      celebration,
      shiftCelebration,
      clearCelebration,
      unseenRewards,
      markRewardsSeen,
      lastFound,
      setStoryOpen,
      isStoryOpen,
      requestCelebration,
      wantsCelebrateNow,
      onBackfill,
    ],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside ProgressProvider.')
  return value
}
