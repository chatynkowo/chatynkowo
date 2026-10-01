import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { OAuthProvider, Profile, Session } from '@chatynkowo/api'
import { mergeAccountFinds } from '../lib/persistence'
import { configured, ensureProfile, getSession, onSessionChange, signInWith, signOut as endSession, syncAccount, updateProfile, type MergeRemoteFinds } from '../lib/sync'

/* The account on the site: the Supabase session, the profile row and the
   way in and out, mirroring the app's SessionProvider. Mounted once per
   page by its entry; the header, the profile page and the ranking read it.
   A failure is a console line here and a notice on the screen. */

export type SignOutOutcome = 'ok' | 'failed'

export type AccountValue = {
  /* Whether the site has a backend to sign in to at all. */
  configured: boolean
  session: Session | null
  /* The account's row, read or created once per signed-in seeker; null
     while it is being read, or when it could not be. */
  profile: Profile | null
  /* The session is restored and, when signed in, the row was read or its
     read failed: what the screen shows is the truth, not a blank. */
  ready: boolean
  /* A save or a sign-out in flight. */
  busy: boolean
  /* Leaves for the provider and comes back to this page, where the client
     reads the session from the URL. */
  signIn: (provider: OAuthProvider) => void
  signOut: () => Promise<SignOutOutcome>
  /* Throws when the backend refused or is unreachable. */
  saveProfile: (patch: Pick<Profile, 'display_name' | 'avatar_url'>) => Promise<Profile>
}

const AccountContext = createContext<AccountValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restored, setRestored] = useState(false)
  /* The seeker whose row was read, or whose read failed. */
  const [settledFor, setSettledFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void getSession().then((active) => {
      if (!current) return
      setSession(active)
      setRestored(true)
    })
    const unsubscribe = onSessionChange((next) => {
      if (current) setSession(next)
    })
    return () => {
      current = false
      unsubscribe()
    }
  }, [])

  /* The row follows the account: read, or created on first contact, once
     per seeker rather than on every token refresh; dropped on sign-out. */
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!session || !userId) {
      setProfile(null)
      setSettledFor(null)
      return
    }
    let current = true
    setProfile(null)
    setSettledFor(null)
    ensureProfile(session)
      .then((row) => {
        if (current) setProfile(row)
      })
      .catch((reason: unknown) => console.error('[account] profile', reason))
      .finally(() => {
        if (current) setSettledFor(userId)
      })
    return () => {
      current = false
    }
    // The session object changes on every refresh; the seeker is what matters.
  }, [userId])

  const signIn = useCallback((provider: OAuthProvider) => {
    void signInWith(provider, `${location.origin}${location.pathname}`).catch((reason: unknown) => console.error('[account] sign-in', reason))
  }, [])

  const signOut = useCallback(async (): Promise<SignOutOutcome> => {
    setBusy(true)
    try {
      await endSession()
      setSession(null)
      return 'ok'
    } catch (reason) {
      console.error('[account] sign-out', reason)
      return 'failed'
    } finally {
      setBusy(false)
    }
  }, [])

  const saveProfile = useCallback(
    async (patch: Pick<Profile, 'display_name' | 'avatar_url'>) => {
      if (!session) throw new Error('Not signed in.')
      setBusy(true)
      try {
        const updated = await updateProfile(session, patch)
        if (!updated) throw new Error('The backend is not configured.')
        setProfile(updated)
        return updated
      } finally {
        setBusy(false)
      }
    },
    [session],
  )

  const ready = restored && (userId === null || settledFor === userId)
  const value = useMemo<AccountValue>(
    () => ({ configured, session, profile, ready, busy, signIn, signOut, saveProfile }),
    [session, profile, ready, busy, signIn, signOut, saveProfile],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useAccount must be used inside AccountProvider.')
  return value
}

export type AccountExchange = {
  /* The finds are travelling between the browser and the account. */
  exchanging: boolean
  /* The exchange ran, or there was no account to exchange with: what the
     browser holds is complete for this visit. */
  settled: boolean
}

/* The exchange with the account, once per page: the account's finds come
   down and are merged into the browser (through `merge`, so a page that
   holds the progress in memory merges into its latest state), then
   everything the browser knows goes up. Runs when the account is ready
   with its row; a failed exchange is logged and waits for the next visit. */
export function useAccountExchange(merge?: MergeRemoteFinds): AccountExchange {
  const account = useAccount()
  const [exchange, setExchange] = useState<AccountExchange>({ exchanging: false, settled: false })
  const mergeRef = useRef(merge)
  const sessionRef = useRef(account.session)
  useEffect(() => {
    mergeRef.current = merge
    sessionRef.current = account.session
  })

  const accountId = account.ready && account.session && account.profile ? account.profile.id : null
  useEffect(() => {
    if (!account.ready) return
    const session = sessionRef.current
    if (!accountId || !session) {
      setExchange({ exchanging: false, settled: true })
      return
    }
    let current = true
    setExchange({ exchanging: true, settled: false })
    syncAccount(session, (remote) => (current ? (mergeRef.current ?? mergeAccountFinds)(remote) : null))
      .catch((reason: unknown) => console.error('[account] exchange', reason))
      .finally(() => {
        if (current) setExchange({ exchanging: false, settled: true })
      })
    return () => {
      current = false
    }
  }, [account.ready, accountId])

  return exchange
}
