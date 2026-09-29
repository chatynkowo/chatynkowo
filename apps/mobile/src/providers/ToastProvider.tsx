import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { announce } from '../lib/announce'
import { haptic } from '../lib/haptics'

/* One toast at a time for the whole app: profile saved, sign-in failed,
   download failed, locate errors, a badge backfilled by a content update.
   The provider owns the queue (the newest replaces the current one) and the
   timer, which the host can hold while a finger rests on the pill; ToastHost
   in src/ui/Toast.tsx draws whatever is current. */

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export type ToastOptions = {
  tone: ToastTone
  text: string
  action?: { label: string; onPress: () => void }
  /* How long the toast stays; 3500 ms by default. */
  durationMs?: number
  /* Under the status bar by default; 'bottom' floats above the Atlas chrome. */
  placement?: 'top' | 'bottom'
}

export type ActiveToast = ToastOptions & { id: number }

type ToastApi = { show: (options: ToastOptions) => void; hide: () => void }

/* For the host only: hold the timer while pressed, let it run on release. */
type ToastTimer = { pause: () => void; resume: () => void }

const DEFAULT_DURATION_MS = 3500
/* A released toast always stays readable for a moment more. */
const MIN_REMAINING_MS = 800

const ToastApiContext = createContext<ToastApi | null>(null)
const ToastTimerContext = createContext<ToastTimer | null>(null)
const ToastStateContext = createContext<ActiveToast | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ActiveToast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(0)
  /* When the running timer fires, and how much was left when it was held. */
  const deadline = useRef(0)
  const remaining = useRef<number | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const arm = useCallback((id: number, ms: number) => {
    clearTimer()
    deadline.current = Date.now() + ms
    timer.current = setTimeout(() => {
      timer.current = null
      setCurrent((active) => (active?.id === id ? null : active))
    }, ms)
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    remaining.current = null
    setCurrent(null)
  }, [])

  const show = useCallback(
    (options: ToastOptions) => {
      nextId.current += 1
      const toast: ActiveToast = { ...options, id: nextId.current }
      remaining.current = null
      setCurrent(toast)
      haptic(options.tone === 'info' ? 'select' : options.tone)
      announce(options.text)
      arm(toast.id, options.durationMs ?? DEFAULT_DURATION_MS)
    },
    [arm],
  )

  const pause = useCallback(() => {
    if (!timer.current) return
    remaining.current = Math.max(MIN_REMAINING_MS, deadline.current - Date.now())
    clearTimer()
  }, [])

  const resume = useCallback(() => {
    const ms = remaining.current
    remaining.current = null
    if (ms === null || timer.current) return
    setCurrent((active) => {
      if (active) arm(active.id, ms)
      return active
    })
  }, [arm])

  useEffect(() => clearTimer, [])

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide])
  const timerApi = useMemo<ToastTimer>(() => ({ pause, resume }), [pause, resume])

  return (
    <ToastApiContext.Provider value={api}>
      <ToastTimerContext.Provider value={timerApi}>
        <ToastStateContext.Provider value={current}>{children}</ToastStateContext.Provider>
      </ToastTimerContext.Provider>
    </ToastApiContext.Provider>
  )
}

const noop: ToastApi = {
  show: () => {
    if (__DEV__) console.warn('useToast: no ToastProvider above this component')
  },
  hide: () => {},
}

const noTimer: ToastTimer = { pause: () => {}, resume: () => {} }

export function useToast(): ToastApi {
  return useContext(ToastApiContext) ?? noop
}

/* The toast currently on screen, for the host. */
export function useActiveToast(): ActiveToast | null {
  return useContext(ToastStateContext)
}

/* The timer controls, for the host. */
export function useToastTimer(): ToastTimer {
  return useContext(ToastTimerContext) ?? noTimer
}
