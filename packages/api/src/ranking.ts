import type { Session } from '@supabase/supabase-js'
import { DISPLAY_NAME_MAX_LENGTH, defaultFetch, type FetchLike, type StoredFind } from '@chatynkowo/core'
import type { ChatynkowoClient, ChatynkowoClientConfig } from './client'
import type { Database } from './database.types'

/* Accounts, profiles, finds and the leaderboard. Every function takes the
   client explicitly, so the web and the mobile app can each configure their
   own instance while sharing this logic. `total` (the number of published
   cottages) comes from the content client — the database does not know it.
   A refused or unreachable backend throws: the caller decides whether to
   queue, retry or tell the seeker. The local Kronika never depends on it. */

export type Profile = Database['public']['Tables']['profiles']['Row']

export type LeaderboardRow = Database['public']['Functions']['leaderboard']['Returns'][number]

/* Twelve base-36 characters. WebCrypto in browsers and Node; React Native
   needs the react-native-get-random-values polyfill (supabase-js requires it
   anyway), otherwise Math.random is a good-enough fallback for a public,
   non-secret id. */
export function newPublicId() {
  const g = globalThis as { crypto?: { getRandomValues?<T extends Uint8Array>(array: T): T } }
  const bytes = new Uint8Array(9)
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (byte) => byte.toString(36)).join('').slice(0, 12)
}

export async function getSession(client: ChatynkowoClient) {
  const { data } = await client.auth.getSession()
  return data.session
}

/* The providers the site signs in with. Apple is there for anyone whose
   account began in the iOS app, where the App Store asks for it. */
export type OAuthProvider = 'google' | 'apple'

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'apple']

/* The providers the backend has switched on (Supabase: Authentication,
   Providers), read from its public settings, so a client offers only what
   the backend can take: a button for a provider that is off leads to the
   backend's error page. Throws when the settings cannot be read. The
   global fetch serves unless one is passed (see core's platform adapters). */
export async function enabledProviders({ url, anonKey, fetch }: Pick<ChatynkowoClientConfig, 'url' | 'anonKey'> & { fetch?: FetchLike }): Promise<OAuthProvider[]> {
  const response = await (fetch ?? defaultFetch())(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } })
  if (!response.ok) throw new Error(`Auth settings: ${response.status}`)
  const { external } = (await response.json()) as { external?: Partial<Record<OAuthProvider, boolean>> }
  return OAUTH_PROVIDERS.filter((provider) => external?.[provider] === true)
}

/* Browser OAuth flow: navigates to the provider and back to `redirectTo`,
   where the client reads the session from the URL. A native app hands the
   provider's id token to `signInWithIdToken` instead (apps/mobile), with
   the raw nonce whose hash the token carries (Apple), so a captured token
   cannot be replayed. */
export async function signInWithOAuth(client: ChatynkowoClient, provider: OAuthProvider, redirectTo: string) {
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } })
  if (error) throw error
}

/* Native sign-in: the provider's id token, minted on the device, becomes a
   session; the provider's client id must be among the backend's authorized
   client ids. */
export async function signInWithIdToken(client: ChatynkowoClient, provider: OAuthProvider, token: string, nonce?: string): Promise<Session> {
  const { data, error } = await client.auth.signInWithIdToken({ provider, token, nonce })
  if (error) throw error
  if (!data.session) throw new Error('Sign-in returned no session.')
  return data.session
}

/* Every change of the session (sign-in, refresh, sign-out). Returns the
   unsubscribe function. */
export function onSessionChange(client: ChatynkowoClient, listener: (session: Session | null) => void): () => void {
  const { data } = client.auth.onAuthStateChange((_event, session) => listener(session))
  return () => data.subscription.unsubscribe()
}

/* The token refresh timer, which a native app runs only in the foreground. */
export function setAutoRefresh(client: ChatynkowoClient, active: boolean) {
  return active ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()
}

/* Revokes the session everywhere when the backend can be reached. The
   client forgets its own session before it reports a network error, so a
   sign-out offline still signs out here; only an error that left the
   session in place is reported. */
export async function signOut(client: ChatynkowoClient) {
  const { error } = await client.auth.signOut()
  if (!error) return
  const { data } = await client.auth.getSession()
  if (data.session) throw error
}

/* The picture the provider knows the seeker by, when it shared one. */
export function providerAvatarUrl(session: Session): string | null {
  const metadata = session.user.user_metadata
  return String(metadata.avatar_url || metadata.picture || '') || null
}

/* The provider the account signed in through, for "signed in with Google";
   null for a session from a provider neither client offers. */
export function sessionProvider(session: Session): OAuthProvider | null {
  const provider = session.user.app_metadata.provider
  return OAUTH_PROVIDERS.find((candidate) => candidate === provider) ?? null
}

/* The address the provider shared, to name the account the seeker is
   signed in with; null when the provider hid it (Apple's relay is still an
   address and is shown as one). */
export function sessionEmail(session: Session): string | null {
  return session.user.email || String(session.user.user_metadata.email || '') || null
}

/* Deletes the account for good: the `delete-account` Edge Function
   (supabase/functions/delete-account) removes the finds, the profile and
   the auth user under the service role, since a client may never delete
   its own auth row. The function reads the caller from the bearer token
   the client attaches. Once it answers, the local session is forgotten
   (the server one is gone with the user); the finds kept on the device
   are the caller's to keep. Throws when the function refused or could
   not be reached, with the session left in place for another try. */
export async function deleteAccount(client: ChatynkowoClient): Promise<void> {
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' })
  if (error) throw error
  await client.auth.signOut({ scope: 'local' })
}

export type ProfileNames = {
  /* A name the sign-in itself handed over (Apple gives it once, on the
     first sign-in, and never in the token). */
  hint?: string | null
  /* The caller's translated default, for a provider that shares no name. */
  fallback: string
}

/* The profile row for a signed-in account, created on first contact from
   the name the sign-in handed over, the provider's metadata, or the
   caller's default. */
export async function ensureProfile(client: ChatynkowoClient, session: Session, names: ProfileNames): Promise<Profile> {
  const { data: existing, error: readError } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
  if (readError) throw readError
  if (existing) return existing
  const metadata = session.user.user_metadata
  const displayName = String(names.hint || metadata.given_name || metadata.name || metadata.full_name || names.fallback)
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
  const { data, error } = await client
    .from('profiles')
    .insert({ id: session.user.id, public_id: newPublicId(), display_name: displayName })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function markCompleted(client: ChatynkowoClient, session: Session, count: number, total: number) {
  if (count < total || total === 0) return
  const { error } = await client.from('profiles').update({ completed_at: new Date().toISOString() }).eq('id', session.user.id)
  if (error) throw error
}

/* Push every local find to the account; existing rows keep their date. */
export async function syncFinds(client: ChatynkowoClient, session: Session, found: Record<string, StoredFind>, total: number) {
  const rows = Object.entries(found).map(([slug, value]) => ({
    user_id: session.user.id,
    slug,
    found_at: value.foundAt || new Date().toISOString(),
  }))
  if (!rows.length) return
  const { error } = await client.from('finds').upsert(rows, { onConflict: 'user_id,slug', ignoreDuplicates: true })
  if (error) throw error
  await markCompleted(client, session, rows.length, total)
}

export async function recordFind(
  client: ChatynkowoClient,
  session: Session,
  slug: string,
  foundAt: string,
  foundCount: number,
  total: number,
) {
  const { error } = await client
    .from('finds')
    .upsert({ user_id: session.user.id, slug, found_at: foundAt }, { onConflict: 'user_id,slug', ignoreDuplicates: true })
  if (error) throw error
  await markCompleted(client, session, foundCount, total)
}

/* The account's finds as the shared progress shape, for merging into a
   device's local state. */
export async function fetchFinds(client: ChatynkowoClient, session: Session): Promise<Record<string, StoredFind>> {
  const { data, error } = await client.from('finds').select('slug, found_at').eq('user_id', session.user.id)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.slug, { foundAt: row.found_at }]))
}

export async function updateProfile(
  client: ChatynkowoClient,
  session: Session,
  patch: Pick<Profile, 'display_name' | 'avatar_url'>,
) {
  const clean = { display_name: patch.display_name.trim().slice(0, DISPLAY_NAME_MAX_LENGTH), avatar_url: patch.avatar_url || null }
  const { data, error } = await client.from('profiles').update(clean).eq('id', session.user.id).select('*').single()
  if (error) throw error
  return data
}

export async function fetchLeaderboard(client: ChatynkowoClient, total: number): Promise<LeaderboardRow[]> {
  if (!total) return []
  const { data, error } = await client.rpc('leaderboard', { p_total: total })
  if (error) throw error
  return data ?? []
}
