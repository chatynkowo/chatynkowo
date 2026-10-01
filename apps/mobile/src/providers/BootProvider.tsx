import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Href } from 'expo-router'
import { STORAGE_KEYS } from '../config'
import type { BootResult } from '../lib/bootstrap'
import { writeJson } from '../lib/storage'

/* What the app knew before its first frame (the bootstrap result: progress,
   queue, cached content, language, whether the welcome was seen) plus the
   two flags the root layout steers navigation with. `welcomeSeen` drives
   the Stack.Protected guards; `pendingHref` is a route the onboarding asks
   for on its way out (the code sheet, a plaque link) that the root pushes
   once the tabs are in the navigation state. */

type BootValue = {
  welcomeSeen: boolean
  /* The onboarding was seen: the root's guard flips to the tabs and the
     device remembers the visit. */
  markWelcomeSeen: () => void
  pendingHref: Href | null
  setPendingHref: (href: Href | null) => void
  initial: BootResult
}

const BootContext = createContext<BootValue | null>(null)

export function BootProvider({ initial, children }: { initial: BootResult; children: ReactNode }) {
  const [welcomeSeen, setSeen] = useState(initial.welcomeSeen)
  const [pendingHref, setPendingHref] = useState<Href | null>(null)

  const markSeen = useCallback(() => {
    setSeen(true)
    void markWelcomeSeen()
  }, [])

  const value = useMemo<BootValue>(
    () => ({ welcomeSeen, markWelcomeSeen: markSeen, pendingHref, setPendingHref, initial }),
    [welcomeSeen, markSeen, pendingHref, initial],
  )

  return <BootContext.Provider value={value}>{children}</BootContext.Provider>
}

export function useBoot() {
  const value = useContext(BootContext)
  if (!value) throw new Error('useBoot must be used inside BootProvider.')
  return value
}

/* Remembers that the welcome was shown; the onboarding calls it on every
   exit path, and +native-intent reads the same key for plaque links. */
export function markWelcomeSeen() {
  return writeJson(STORAGE_KEYS.welcomeSeen, true)
}
