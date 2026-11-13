import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { OAuthProvider, Profile, Session } from '@chatynkowo/api'
import { clearQueue, loadQueue, mergeAccountFinds, pendingFinds, settleQueue, subscribeQueue } from '../lib/persistence'
import { offline, persist } from '../lib/retry'
import { forgetSignIns, noteSignedIn } from '../lib/sign-in-log'
import { configured, deleteAccount as removeAccount, ensureProfile, getSession, onSessionChange, pushFinds, signInWith, signOut as endSession, syncAccount, updateProfile, type MergeRemoteFinds } from '../lib/sync'

/* The account on the site: the Supabase session, the profile row, the way
   in and out and the way to delete it, mirroring the app's SessionProvider.
   Mounted once per page by its entry; the header, the profile page and the
   ranking read it. A failure is a console line here and a notice on the
   screen. */

/* How a sign-out or a deletion ended; the failure is already logged. */
export type AccountOutcome = 'ok' | 'failed'
/* A deletion may also have left for Apple to confirm it ('confirming',
   the page is leaving) or come back without the confirmation. */
export type DeletionOutcome = AccountOutcome | 'confirming' | 'unconfirmed'

export type AccountValue = {
  /* Whether the site has a backend to sign in to at all. */
  configured: boolean
  session: Session | null
  /* The account's row, read or created once per signed-in seeker; null
     while it is being read, or when it could not be. */
  profile: Profile | null
  /* The session is restored and, when signed in, the row was read or its
     first read failed: what the screen shows is the truth, not a blank.
     A read that failed is kept at, so the row may still arrive. */
  ready: boolean
  /* A save, a sign-out or a deletion in flight. */
  busy: boolean
  /* Leaves for the provider and comes back to this page, where the client
     reads the session from the URL. */
  signIn: (provider: OAuthProvider) => void
  signOut: () => Promise<AccountOutcome>
  /* Deletes the account with its profile and finds for good and forgets
     the session, the browser's sign-in log and the queue of finds that
     waited for the account; the finds kept in this browser stay. An Apple
     account confirms with Apple first (see deleteAccount in lib/sync);
     `resume` finishes a deletion that came back from Apple. */
  deleteAccount: (resume?: boolean) => Promise<DeletionOutcome>
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

  /* Each sign-in goes to the browser's sign-in log once (lib/sign-in-log);
     a refreshed token is the same sign-in. */
  useEffect(() => {
    if (session) noteSignedIn(session)
  }, [session])

  /* The row follows the account: read, or created on first contact, once
     per seeker rather than on every token refresh; dropped on sign-out.
     A read the backend did not answer is kept at (lib/retry) until the
     row is here, so a page opened without a connection gets its account
     when the connection returns; the account counts as ready after the
     first try either way. */
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
    /* Read once: a later return to the page finds nothing left to do. */
    let read = false
    const reading = persist(async () => {
      if (read) return true
      try {
        if (offline()) return false
        const row = await ensureProfile(session)
        read = true
        if (current) setProfile(row)
        return true
      } catch (reason) {
        console.error('[account] profile', reason)
        return false
      } finally {
        if (current) setSettledFor(userId)
      }
    })
    reading.kick()
    return () => {
      current = false
      reading.stop()
    }
    // The session object changes on every refresh; the seeker is what matters.
  }, [userId])

  const signIn = useCallback((provider: OAuthProvider) => {
    void signInWith(provider, `${location.origin}${location.pathname}`).catch((reason: unknown) => console.error('[account] sign-in', reason))
  }, [])

  const signOut = useCallback(async (): Promise<AccountOutcome> => {
    setBusy(true)
    try {
      await endSession()
      /* The queue of finds was waiting for this account; the next sign-in
         sends the whole Kronika anyway. */
      clearQueue()
      setSession(null)
      return 'ok'
    } catch (reason) {
      console.error('[account] sign-out', reason)
      return 'failed'
    } finally {
      setBusy(false)
    }
  }, [])

  const deleteAccount = useCallback(
    async (resume = false): Promise<DeletionOutcome> => {
      if (!session) return 'failed'
      setBusy(true)
      try {
        const result = await removeAccount(session, resume)
        if (result === 'confirming') return 'confirming'
        if (result === 'unconfirmed') return 'unconfirmed'
        forgetSignIns()
        clearQueue()
        setSession(null)
        return 'ok'
      } catch (reason) {
        console.error('[account] delete', reason)
        return 'failed'
      } finally {
        setBusy(false)
      }
    },
    [session],
  )

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
    () => ({ configured, session, profile, ready, busy, signIn, signOut, deleteAccount, saveProfile }),
    [session, profile, ready, busy, signIn, signOut, deleteAccount, saveProfile],
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
  /* The first try of the exchange is over, or there was no account to
     exchange with: the page shows what the browser holds. */
  settled: boolean
  /* Finds this browser holds that the account has not taken yet. */
  pending: number
  /* How many times the account and the browser got in step on this visit
     (the exchange, then each later push of new finds): what shows the
     account's side of things loads again when it grows. */
  synced: number
}

/* Keeps the account and the browser in step for as long as the page is
   open. First the exchange: the account's finds come down and are merged
   into the browser (through `merge`, so a page that holds the progress in
   memory merges into its latest state), then everything the browser knows
   goes up. After it, every find that lands in the queue (lib/persistence),
   on this page or in another tab, goes up the same way. Runs when the
   account is ready with its row.

   What the backend did not take is kept at (lib/retry): tried again after
   a pause, when the browser is back online and when the page is back in
   front. A seeker who finds a cottage with the page open and no
   connection sees the find go to the account when the connection
   returns, without opening the site again. */
export function useAccountExchange(merge?: MergeRemoteFinds): AccountExchange {
  const account = useAccount()
  const [exchange, setExchange] = useState({ exchanging: false, settled: false, synced: 0 })
  const pending = useSyncExternalStore(subscribeQueue, pendingFinds)
  const mergeRef = useRef(merge)
  const sessionRef = useRef(account.session)
  useEffect(() => {
    mergeRef.current = merge
    sessionRef.current = account.session
  })

  const accountId = account.ready && account.session && account.profile ? account.profile.id : null
  useEffect(() => {
    if (!account.ready) return
    if (!accountId) {
      setExchange((state) => ({ ...state, exchanging: false, settled: true }))
      return
    }
    let current = true
    /* The account's finds came down on this visit; from then on only what
       the browser finds goes up. */
    let exchanged = false
    const keeping = persist(async () => {
      const session = sessionRef.current
      if (!current || !session) return true
      /* The finds waiting now are the ones this try settles; one made
         while it is in flight waits for the next. */
      const waiting = loadQueue().pending.map((find) => find.slug)
      if (exchanged && !waiting.length) return true
      if (offline()) {
        setExchange((state) => ({ ...state, settled: true }))
        return false
      }
      if (!exchanged) setExchange((state) => ({ ...state, exchanging: true }))
      try {
        if (exchanged) await pushFinds(session)
        else await syncAccount(session, (remote) => (current ? (mergeRef.current ?? mergeAccountFinds)(remote) : null))
        exchanged = true
        settleQueue(waiting)
        if (current) setExchange((state) => ({ exchanging: false, settled: true, synced: state.synced + 1 }))
        return true
      } catch (reason) {
        console.error('[account] exchange', reason)
        if (current) setExchange((state) => ({ ...state, exchanging: false, settled: true }))
        return false
      }
    })
    keeping.kick()
    const unsubscribe = subscribeQueue(keeping.kick)
    return () => {
      current = false
      unsubscribe()
      keeping.stop()
    }
  }, [account.ready, accountId])

  return useMemo(() => ({ ...exchange, pending }), [exchange, pending])
}
