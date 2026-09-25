import type { Session } from '@supabase/supabase-js'
import type { StoredFind } from '@chatynkowo/core'
import type { ChatynkowoClient } from './client'
import type { Database } from './database.types'

/* Accounts, profiles, finds and the leaderboard. Every function takes the
   client explicitly, so the web and the mobile app can each configure their
   own instance while sharing this logic. `total` (the number of published
   cottages) comes from the content client — the database does not know it. */

export type Profile = Database['public']['Tables']['profiles']['Row']

export type LeaderboardRow = Database['public']['Functions']['leaderboard']['Returns'][number]

/* Errors are reported, never thrown: a failed sync must not break the local
   Kronika. React Native has console too; a host without it stays silent. */
function report(scope: string, error: unknown) {
  const g = globalThis as { console?: { error(...args: unknown[]): void } }
  g.console?.error(`[ranking] ${scope}`, error)
}

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

/* Browser OAuth flow: navigates to Google and back to `redirectTo`. A native
   app uses a different flow (see apps/mobile/README.md) — do not call this
   from React Native. */
export function signInWithGoogle(client: ChatynkowoClient, redirectTo: string) {
  return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}

export async function signOut(client: ChatynkowoClient) {
  await client.auth.signOut()
}

/* The profile row for a signed-in account, created on first contact from the
   provider's name. */
export async function ensureProfile(client: ChatynkowoClient, session: Session): Promise<Profile | null> {
  const { data: existing } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
  if (existing) return existing
  const metadata = session.user.user_metadata
  const displayName = String(metadata.given_name || metadata.name || metadata.full_name || 'Zdobywca').trim().slice(0, 40)
  const { data, error } = await client
    .from('profiles')
    .insert({ id: session.user.id, public_id: newPublicId(), display_name: displayName })
    .select('*')
    .single()
  if (error) report('ensureProfile', error)
  return data
}

async function markCompleted(client: ChatynkowoClient, session: Session, count: number, total: number) {
  if (count < total || total === 0) return
  await client.from('profiles').update({ completed_at: new Date().toISOString() }).eq('id', session.user.id)
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
  if (error) report('syncFinds', error)
  else await markCompleted(client, session, rows.length, total)
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
  if (error) report('recordFind', error)
  else await markCompleted(client, session, foundCount, total)
}

/* The account's finds as the shared progress shape, for merging into a
   device's local state. */
export async function fetchFinds(client: ChatynkowoClient, session: Session): Promise<Record<string, StoredFind>> {
  const { data, error } = await client.from('finds').select('slug, found_at').eq('user_id', session.user.id)
  if (error) {
    report('fetchFinds', error)
    return {}
  }
  return Object.fromEntries((data ?? []).map((row) => [row.slug, { foundAt: row.found_at }]))
}

export async function updateProfile(
  client: ChatynkowoClient,
  session: Session,
  patch: Pick<Profile, 'display_name' | 'avatar_url'>,
) {
  const clean = { display_name: patch.display_name.trim().slice(0, 40), avatar_url: patch.avatar_url || null }
  const { data, error } = await client.from('profiles').update(clean).eq('id', session.user.id).select('*').single()
  if (error) report('updateProfile', error)
  return data
}

export async function fetchLeaderboard(client: ChatynkowoClient, total: number): Promise<LeaderboardRow[]> {
  if (!total) return []
  const { data, error } = await client.rpc('leaderboard', { p_total: total })
  if (error) {
    report('fetchLeaderboard', error)
    return []
  }
  return data ?? []
}
