import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile, Session } from '@chatynkowo/api'
import {
  authEnabled,
  bindAutoRefresh,
  ensureProfile,
  getSession,
  onSessionChange,
  signIn as nativeSignIn,
  signOut as nativeSignOut,
  updateProfile,
  type SignInProvider,
} from '../lib/sync'

/* The account: the Supabase session, the profile row and native sign-in.
   `enabled` is false until the providers are configured in the backend —
   screens then hide every account control and the app runs signed out. */

type SessionValue = {
  enabled: boolean
  session: Session | null
  profile: Profile | null
  /* True while the stored session is being restored at start-up. */
  restoring: boolean
  busy: boolean
  signIn: (provider: SignInProvider) => Promise<boolean>
  signOut: () => Promise<void>
  saveProfile: (patch: Pick<Profile, 'display_name' | 'avatar_url'>) => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void getSession()
      .then((restored) => {
        if (current) setSession(restored)
      })
      .finally(() => {
        if (current) setRestoring(false)
      })
    const unsubscribe = onSessionChange((next) => {
      if (current) setSession(next)
    })
    const unbind = bindAutoRefresh()
    return () => {
      current = false
      unsubscribe()
      unbind()
    }
  }, [])

  /* The profile follows the session: created on first contact, dropped on
     sign-out. */
  useEffect(() => {
    let current = true
    if (!session) {
      setProfile(null)
      return
    }
    void ensureProfile(session).then((row) => {
      if (current) setProfile(row)
    })
    return () => {
      current = false
    }
  }, [session])

  const signIn = useCallback(async (provider: SignInProvider) => {
    setBusy(true)
    try {
      const next = await nativeSignIn(provider)
      setSession(next)
      return Boolean(next)
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setBusy(true)
    try {
      await nativeSignOut()
      setSession(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const saveProfile = useCallback(
    async (patch: Pick<Profile, 'display_name' | 'avatar_url'>) => {
      if (!session) return
      const updated = await updateProfile(session, patch)
      if (updated) setProfile(updated)
    },
    [session],
  )

  const value = useMemo<SessionValue>(
    () => ({ enabled: authEnabled, session, profile, restoring, busy, signIn, signOut, saveProfile }),
    [session, profile, restoring, busy, signIn, signOut, saveProfile],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider.')
  return value
}
