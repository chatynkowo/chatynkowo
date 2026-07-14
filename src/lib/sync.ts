import { createClient, type Session } from '@supabase/supabase-js'
import type { StoredFind } from '../types'

const SUPABASE_URL = 'https://wqlodfnukdjrulcvzvtk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ASCFENexhyJ0sMopHKJIzQ_WhodJFoc'
const STORAGE_KEY = 'chatynkowo:state:v1'

export type Profile = {
  id: string
  public_id: string
  display_name: string
  avatar_url: string | null
  completed_at?: string | null
}

export type LeaderboardRow = {
  public_id: string
  display_name: string
  avatar_url: string | null
  found: number
  elapsed_seconds: number | string | null
  completed: boolean
}

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
let cachedTotal: number | null = null

export async function totalCottages() {
  if (cachedTotal !== null) return cachedTotal
  try {
    const response = await fetch('data/cottages.json', { cache: 'no-cache' })
    const data: unknown = await response.json()
    cachedTotal = Array.isArray(data) ? data.length : 0
  } catch (error) {
    console.error('[ranking] totalCottages', error)
    cachedTotal = 0
  }
  return cachedTotal
}

function newPublicId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, (byte) => byte.toString(36)).join('').slice(0, 12)
}

export function localFinds(): Record<string, StoredFind> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { version?: number; found?: Record<string, StoredFind> }
    return parsed.version === 1 ? parsed.found ?? {} : {}
  } catch {
    return {}
  }
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signInWithGoogle(redirectTo = location.href) {
  if (!supabase) throw new Error('Ranking nie jest skonfigurowany.')
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export async function ensureProfile(session: Session): Promise<Profile | null> {
  if (!supabase) return null
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle<Profile>()
  if (existing) return existing
  const metadata = session.user.user_metadata
  const displayName = String(metadata.given_name || metadata.name || metadata.full_name || 'Zdobywca').trim().slice(0, 40)
  const { data, error } = await supabase.from('profiles').insert({ id: session.user.id, public_id: newPublicId(), display_name: displayName }).select('*').single<Profile>()
  if (error) console.error('[ranking] ensureProfile', error)
  return data
}

async function markCompleted(session: Session, count: number) {
  const total = await totalCottages()
  if (!supabase || count < total || total === 0) return
  await supabase.from('profiles').update({ completed_at: new Date().toISOString() }).eq('id', session.user.id)
}

export async function syncFinds(session: Session, found = localFinds()) {
  if (!supabase) return
  const rows = Object.entries(found).map(([slug, value]) => ({ user_id: session.user.id, slug, found_at: value.foundAt || new Date().toISOString() }))
  if (!rows.length) return
  const { error } = await supabase.from('finds').upsert(rows, { onConflict: 'user_id,slug', ignoreDuplicates: true })
  if (error) console.error('[ranking] syncFinds', error)
  else await markCompleted(session, rows.length)
}

export async function recordFind(session: Session, slug: string, foundAt: string, foundCount: number) {
  if (!supabase) return
  const { error } = await supabase.from('finds').upsert({ user_id: session.user.id, slug, found_at: foundAt }, { onConflict: 'user_id,slug', ignoreDuplicates: true })
  if (error) console.error('[ranking] recordFind', error)
  else await markCompleted(session, foundCount)
}

export async function syncNewFind(slug: string, foundAt: string, foundCount: number) {
  const session = await getSession()
  if (!session) return
  await ensureProfile(session)
  await recordFind(session, slug, foundAt, foundCount)
}

export async function updateProfile(session: Session, patch: Pick<Profile, 'display_name' | 'avatar_url'>) {
  if (!supabase) return null
  const clean = { display_name: patch.display_name.trim().slice(0, 40), avatar_url: patch.avatar_url || null }
  const { data, error } = await supabase.from('profiles').update(clean).eq('id', session.user.id).select('*').single<Profile>()
  if (error) console.error('[ranking] updateProfile', error)
  return data
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!supabase) return []
  const total = await totalCottages()
  if (!total) return []
  const { data, error } = await supabase.rpc('leaderboard', { p_total: total })
  if (error) {
    console.error('[ranking] fetchLeaderboard', error)
    return []
  }
  return (data ?? []) as LeaderboardRow[]
}
