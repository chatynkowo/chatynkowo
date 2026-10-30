import type { Session } from '@chatynkowo/api'
import * as api from '@chatynkowo/api'
import { LANGUAGES, type StoredFind, type StoredState } from '@chatynkowo/core'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import i18n from '../i18n'
import { totalCottages } from './content'
import { localFinds, mergeAccountFinds } from './persistence'

/* The site's instance of the shared backend client, plus the account
   functions bound to it. Everything here is a thin wrapper over
   @chatynkowo/api; the mobile app builds its own wrapper the same way. The
   browser's Kronika is the source of truth: an account collects what every
   browser and device found, and hands it back to each of them. */

export type { LeaderboardRow, OAuthProvider, Profile, Session } from '@chatynkowo/api'
export { localFinds, totalCottages }
export { OAUTH_PROVIDERS, sessionEmail, sessionProvider } from '@chatynkowo/api'

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const supabase = configured ? api.createChatynkowoClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }) : null

export async function getSession() {
  return supabase ? api.getSession(supabase) : null
}

/* The providers the backend offers; none without a backend. */
export async function enabledProviders() {
  return supabase ? api.enabledProviders({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }) : []
}

export async function signInWith(provider: api.OAuthProvider, redirectTo: string) {
  if (!supabase) throw new Error('The backend is not configured.')
  await api.signInWithOAuth(supabase, provider, redirectTo)
}

/* Every change of the session: a sign-in read from the URL, a token
   refresh, a sign-out here or in another tab. */
export function onSessionChange(listener: (session: Session | null) => void): () => void {
  return supabase ? api.onSessionChange(supabase, listener) : () => {}
}

export async function signOut() {
  if (supabase) await api.signOut(supabase)
}

/* A deletion that left for Apple and comes back to finish: who asked and
   when, kept in this tab only and taken once (takeDeletion). */
const DELETION_KEY = 'chatynkowo:delete-after-apple'
const DELETION_TTL_MS = 10 * 60 * 1000

/* How a deletion went: done, gone to Apple for the confirmation (the page
   is leaving), or back from Apple without the token that confirms it. */
export type DeletionResult = 'deleted' | 'confirming' | 'unconfirmed'

/* The account, its profile and its finds, gone for good; the session is
   forgotten with them. An account that signs in with Apple has its Apple
   sign-in revoked first, as Apple asks: with the Apple refresh token
   Supabase hands over with an Apple sign-in, which a session keeps until
   its first refresh. Without it the seeker confirms with Apple, leaving
   for Apple and coming back to this page, which finishes the deletion
   (`resume`); a return still without the token is 'unconfirmed', never a
   second trip. Throws when the backend refused or is unreachable. */
export async function deleteAccount(session: Session, resume = false): Promise<DeletionResult> {
  if (!supabase) throw new Error('The backend is not configured.')
  if (!api.hasAppleIdentity(session)) {
    await api.deleteAccount(supabase)
    return 'deleted'
  }
  const appleRefreshToken = session.provider_refresh_token
  if (!appleRefreshToken) {
    if (resume) return 'unconfirmed'
    try {
      sessionStorage.setItem(DELETION_KEY, JSON.stringify({ userId: session.user.id, at: Date.now() }))
    } catch {
      return 'unconfirmed'
    }
    await api.signInWithOAuth(supabase, 'apple', `${location.origin}${location.pathname}`)
    return 'confirming'
  }
  await api.deleteAccount(supabase, { appleRefreshToken })
  return 'deleted'
}

/* The deletion this tab left for Apple to confirm, taken once on the way
   back: 'resume' for the account that asked, 'mismatch' when the seeker
   came back signed in as another account, null when there is none (or it
   is older than a few minutes). */
export function takeDeletion(userId: string): 'resume' | 'mismatch' | null {
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(DELETION_KEY)
    sessionStorage.removeItem(DELETION_KEY)
  } catch {
    return null
  }
  if (!stored) return null
  try {
    const { userId: asked, at } = JSON.parse(stored) as { userId?: string; at?: number }
    if (typeof at !== 'number' || Date.now() - at > DELETION_TTL_MS) return null
    return asked === userId ? 'resume' : 'mismatch'
  } catch {
    return null
  }
}

/* Whether an account signs in with Apple: deleting it goes through Apple. */
export function signsInWithApple(session: Session): boolean {
  return api.hasAppleIdentity(session)
}

/* Whether a nickname is the default a profile gets when no sign-in named
   the seeker, in any of the site's languages: the profile page then asks
   for a nickname. */
export function isDefaultName(name: string): boolean {
  return LANGUAGES.some((language) => i18n.t('profile.defaultName', { lng: language.code }) === name.trim())
}

/* The profile row, created on first contact with the provider's name or
   the translated default. */
export async function ensureProfile(session: Session) {
  return supabase ? api.ensureProfile(supabase, session, { fallback: i18n.t('profile.defaultName') }) : null
}

export function providerAvatarUrl(session: Session) {
  return api.providerAvatarUrl(session)
}

/* How the account's finds reach the browser: `mergeAccountFinds` with the
   caller's copy of the progress, so a page that holds it in memory merges
   into its latest state. */
export type MergeRemoteFinds = (remote: Record<string, StoredFind>) => StoredState | null

/* The exchange with the account: its finds come down and are merged into
   the browser, then everything the browser knows goes up, so a seeker who
   signs in on a new device gets their Kronika back and the account sees
   every find. */
export async function syncAccount(session: Session, merge: MergeRemoteFinds = mergeAccountFinds): Promise<void> {
  if (!supabase) return
  merge(await api.fetchFinds(supabase, session))
  await api.syncFinds(supabase, session, localFinds(), await totalCottages())
}

/* A fresh discovery goes to the account when someone is signed in; the
   browser's Kronika is the source of truth either way, and a find the
   backend did not take now goes up with the next exchange. */
export async function syncNewFind(slug: string, foundAt: string, foundCount: number) {
  const session = await getSession()
  if (!supabase || !session) return
  await ensureProfile(session)
  await api.recordFind(supabase, session, slug, foundAt, foundCount, await totalCottages())
}

export async function updateProfile(session: Session, patch: Pick<api.Profile, 'display_name' | 'avatar_url'>) {
  return supabase ? api.updateProfile(supabase, session, patch) : null
}

export async function fetchLeaderboard() {
  if (!supabase) return []
  return api.fetchLeaderboard(supabase, await totalCottages())
}
