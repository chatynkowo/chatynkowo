import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { OAuthProvider, Profile, Session } from '@chatynkowo/api'
import {
  availableProviders,
  bindAutoRefresh,
  deleteAccount as removeAccount,
  ensureProfile,
  getSession,
  onSessionChange,
  signIn as nativeSignIn,
  signOut as nativeSignOut,
  updateProfile,
} from '../lib/sync'
import { useReconnect } from './NetworkProvider'

/* The account: the Supabase session, the profile row and native sign-in.
   `providers` lists the sign-ins this build offers (see
   `availableProviders`); with none, screens hide every account control and
   the app runs signed out. A failure is a console line here and a toast
   on the screen. */

export type SignInOutcome = 'ok' | 'cancelled' | 'failed'
export type SignOutOutcome = 'ok' | 'failed'

type SessionValue = {
  providers: OAuthProvider[]
  /* Whether any sign-in is on offer. */
  enabled: boolean
  session: Session | null
  /* The account's row; null while it is being read, or could not be. */
  profile: Profile | null
  busy: boolean
  signIn: (provider: OAuthProvider) => Promise<SignInOutcome>
  signOut: () => Promise<SignOutOutcome>
  /* Deletes the account for good (the backend's function removes the
     profile, the finds and the user); the device keeps its finds. */
  deleteAccount: () => Promise<SignOutOutcome>
  /* Throws when the backend refused or is unreachable. */
  saveProfile: (patch: Pick<Profile, 'display_name' | 'avatar_url'>) => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

const providers = availableProviders()

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  /* The name a sign-in dialog handed over, for the profile created on that
     account's first contact; Apple gives it once and never in the token. */
  const nameHint = useRef<string | null>(null)
  const sessionRef = useRef(session)
  const profileRef = useRef(profile)
  useEffect(() => {
    sessionRef.current = session
    profileRef.current = profile
  })

  useEffect(() => {
    let current = true
    void getSession().then((restored) => {
      if (current) setSession(restored)
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

  /* The profile follows the account: read, or created on first contact
     with the name the sign-in handed over, once per account rather than
     on every token refresh; dropped on sign-out. A backend that cannot be
     reached leaves it empty until the next reconnect. */
  const userId = session?.user.id
  const readProfile = useCallback(() => {
    const active = sessionRef.current
    if (!active || profileRef.current?.id === active.user.id) return
    const hint = nameHint.current
    nameHint.current = null
    ensureProfile(active, hint)
      .then((row) => {
        if (sessionRef.current?.user.id === active.user.id) setProfile(row)
      })
      .catch((error: unknown) => console.error('[account] profile', error))
  }, [])
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    readProfile()
  }, [userId, readProfile])
  useReconnect(readProfile)

  const signIn = useCallback(async (provider: OAuthProvider): Promise<SignInOutcome> => {
    setBusy(true)
    try {
      const result = await nativeSignIn(provider, (displayName) => {
        nameHint.current = displayName
      })
      if (result.kind === 'failed') {
        nameHint.current = null
        console.error('[account] sign-in', result.error)
        return 'failed'
      }
      if (result.kind === 'cancelled') return 'cancelled'
      setSession(result.session)
      return 'ok'
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async (): Promise<SignOutOutcome> => {
    setBusy(true)
    try {
      await nativeSignOut()
      setSession(null)
      return 'ok'
    } catch (error) {
      console.error('[account] sign-out', error)
      return 'failed'
    } finally {
      setBusy(false)
    }
  }, [])

  const deleteAccount = useCallback(async (): Promise<SignOutOutcome> => {
    setBusy(true)
    try {
      await removeAccount()
      setSession(null)
      return 'ok'
    } catch (error) {
      console.error('[account] delete', error)
      return 'failed'
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
    () => ({ providers, enabled: providers.length > 0, session, profile, busy, signIn, signOut, deleteAccount, saveProfile }),
    [session, profile, busy, signIn, signOut, deleteAccount, saveProfile],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider.')
  return value
}
