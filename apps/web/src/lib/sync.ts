import type { Session } from '@chatynkowo/api'
import * as api from '@chatynkowo/api'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { totalCottages } from './content'
import { localFinds } from './persistence'

/* The site's instance of the shared backend client, plus the ranking
   functions bound to it. Everything here is a thin wrapper over
   @chatynkowo/api; the mobile app builds its own wrapper the same way. */

export type { LeaderboardRow, Profile, Session } from '@chatynkowo/api'
export { localFinds, totalCottages }

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const supabase = configured ? api.createChatynkowoClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }) : null

export async function getSession() {
  return supabase ? api.getSession(supabase) : null
}

export function signInWithGoogle(redirectTo = location.href) {
  if (!supabase) throw new Error('The leaderboard backend is not configured.')
  return api.signInWithGoogle(supabase, redirectTo)
}

export async function signOut() {
  if (supabase) await api.signOut(supabase)
}

export async function ensureProfile(session: Session) {
  return supabase ? api.ensureProfile(supabase, session) : null
}

export async function syncFinds(session: Session, found = localFinds()) {
  if (!supabase) return
  await api.syncFinds(supabase, session, found, await totalCottages())
}

export async function recordFind(session: Session, slug: string, foundAt: string, foundCount: number) {
  if (!supabase) return
  await api.recordFind(supabase, session, slug, foundAt, foundCount, await totalCottages())
}

/* A fresh discovery goes to the account when someone is signed in; the
   local Kronika is the source of truth either way. */
export async function syncNewFind(slug: string, foundAt: string, foundCount: number) {
  const session = await getSession()
  if (!session) return
  await ensureProfile(session)
  await recordFind(session, slug, foundAt, foundCount)
}

export async function updateProfile(session: Session, patch: Pick<api.Profile, 'display_name' | 'avatar_url'>) {
  return supabase ? api.updateProfile(supabase, session, patch) : null
}

export async function fetchLeaderboard() {
  if (!supabase) return []
  return api.fetchLeaderboard(supabase, await totalCottages())
}
