import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { LeaderboardRow } from '@chatynkowo/api'
import { fetchLeaderboard } from '../../lib/sync'
import { useForeground, useProgress, useReconnect } from '../../providers'

/* The leaderboard as the Ranking tab sees it. Rows are loaded once the
   cottage total is known and refreshed quietly whenever they may have
   changed: on focus when older than a minute, on a return to the foreground,
   on reconnect, and once the seeker's pending finds have reached the account.
   Rows on screen are never cleared by a refetch; a stale response (an older
   request, or one abandoned when the tab lost focus) is ignored. */

export type LeaderboardState = {
  rows: LeaderboardRow[]
  /* When the rows on screen were fetched; null until the first success. */
  updatedAt: number | null
  /* A visible (user-initiated) refresh is in flight. */
  refreshing: boolean
  /* The last request failed; the rows already shown stay. */
  error: boolean
  /* Fetches again now. `silent` keeps the RefreshControl still. */
  refresh: (options?: { silent?: boolean }) => Promise<void>
}

/* Rows older than this are fetched again when the tab regains focus. */
const STALE_MS = 60_000

export function useLeaderboard(total: number): LeaderboardState {
  const { pendingCount, exchanging } = useProgress()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  /* Only the newest request may commit its result. */
  const requestId = useRef(0)
  const inFlight = useRef(false)
  const focused = useRef(false)
  /* Something changed the board while it could not be fetched (the tab was
     not focused): the next chance loads regardless of age. */
  const dirty = useRef(false)
  const updatedAtRef = useRef<number | null>(null)
  const errorRef = useRef(false)
  const totalRef = useRef(total)

  const load = useCallback(async (silent: boolean) => {
    const count = totalRef.current
    if (count <= 0) return
    const id = ++requestId.current
    inFlight.current = true
    dirty.current = false
    if (!silent) {
      setRefreshing(true)
      setError(false)
    }
    try {
      const next = await fetchLeaderboard(count)
      if (requestId.current !== id) return
      const now = Date.now()
      updatedAtRef.current = now
      errorRef.current = false
      setRows(next)
      setUpdatedAt(now)
      setError(false)
    } catch {
      if (requestId.current !== id) return
      errorRef.current = true
      setError(true)
    } finally {
      if (requestId.current === id) {
        inFlight.current = false
        setRefreshing(false)
      }
    }
  }, [])

  /* Loads when nothing is on screen yet, the last attempt failed, the board
     is marked dirty or the rows are older than a minute. */
  const loadIfStale = useCallback(
    (silent: boolean) => {
      if (inFlight.current) return
      const at = updatedAtRef.current
      const stale = at === null || errorRef.current || dirty.current || Date.now() - at > STALE_MS
      if (stale) void load(silent)
    },
    [load],
  )

  /* The first load, and a reload whenever the total changes: every row's
     completed flag depends on it. */
  useEffect(() => {
    totalRef.current = total
    if (total <= 0) return
    dirty.current = true
    loadIfStale(true)
  }, [total, loadIfStale])

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      loadIfStale(true)
      return () => {
        focused.current = false
        /* Whatever is in flight lands on a tab nobody is looking at: drop it
           and let the next focus decide. */
        if (inFlight.current) {
          requestId.current += 1
          inFlight.current = false
          setRefreshing(false)
        }
      }
    }, [loadIfStale]),
  )

  useForeground(
    () => {
      if (focused.current) loadIfStale(true)
    },
    { minIntervalMs: STALE_MS },
  )

  useReconnect(() => {
    if (focused.current) loadIfStale(true)
  })

  /* The seeker's finds just reached the account (the queue emptied, or the
     sign-in exchange finished): the board has moved. */
  const previousPending = useRef(pendingCount)
  const previousExchanging = useRef(exchanging)
  useEffect(() => {
    const flushed = previousPending.current > 0 && pendingCount === 0
    const exchanged = previousExchanging.current && !exchanging
    previousPending.current = pendingCount
    previousExchanging.current = exchanging
    if (!flushed && !exchanged) return
    dirty.current = true
    if (focused.current) loadIfStale(true)
  }, [pendingCount, exchanging, loadIfStale])

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      await load(Boolean(options?.silent))
    },
    [load],
  )

  return { rows, updatedAt, refreshing, error, refresh }
}
