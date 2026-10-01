import type { Session } from '@chatynkowo/api'
import * as api from '@chatynkowo/api'
import type { StoredFind, StoredState } from '@chatynkowo/core'
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
export { OAUTH_PROVIDERS } from '@chatynkowo/api'

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
