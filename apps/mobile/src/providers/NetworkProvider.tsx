import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { getSnapshot, refresh, subscribe } from '../lib/network'

/* Connectivity and life cycle for the rest of the app: the one NetInfo
   listener (src/lib/network.ts) and one AppState listener, exposed as
   hooks. `useOnline` re-renders a consumer only on a real flip;
   `useReconnect` and `useForeground` subscribe once and call the latest
   handler through a ref, so a component never re-subscribes on render. */

type Listener = () => void

const foregroundListeners = new Set<Listener>()
let foregroundStarted = false

/* Background (or inactive: the app switcher, a system sheet) to active.
   The connectivity listener may have slept with the app, so the device is
   asked again first and a reconnect seen there fires before the handlers. */
function ensureForegroundListener() {
  if (foregroundStarted) return
  foregroundStarted = true
  let previous: AppStateStatus = AppState.currentState
  AppState.addEventListener('change', (next) => {
    const cameBack = next === 'active' && previous !== 'active'
    previous = next
    if (!cameBack) return
    void refresh().finally(() => foregroundListeners.forEach((listener) => listener()))
  })
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureForegroundListener()
    void refresh()
  }, [])
  return <>{children}</>
}

export function useOnline(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* Calls `handler` every time the device comes back online. */
export function useReconnect(handler: () => void): void {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => {
    let wasOnline = getSnapshot()
    return subscribe(() => {
      const online = getSnapshot()
      if (online && wasOnline === false) handlerRef.current()
      wasOnline = online
    })
  }, [])
}

/* Calls `handler` when the app returns to the foreground, at most once per
   `minIntervalMs` for this caller (counted from the subscription, so a
   screen that just loaded does not reload on the first return). */
export function useForeground(handler: () => void, options: { minIntervalMs?: number } = {}): void {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  const minIntervalMs = options.minIntervalMs ?? 0
  useEffect(() => {
    ensureForegroundListener()
    let lastRun = Date.now()
    const listener = () => {
      const now = Date.now()
      if (now - lastRun < minIntervalMs) return
      lastRun = now
      handlerRef.current()
    }
    foregroundListeners.add(listener)
    return () => {
      foregroundListeners.delete(listener)
    }
  }, [minIntervalMs])
}
