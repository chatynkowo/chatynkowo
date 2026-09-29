import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as api from '@chatynkowo/api'
import type { Session } from '@chatynkowo/api'
import type { StoredFind } from '@chatynkowo/core'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import * as AppleAuthentication from 'expo-apple-authentication'
import { AUTH_ENABLED, GOOGLE_WEB_CLIENT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

/* The app's instance of the shared backend client plus the account
   functions bound to it — a thin wrapper over @chatynkowo/api, the mirror
   of apps/web/src/lib/sync.ts. The session lives in AsyncStorage and no
   URL is ever parsed for one; sign-in is native (Google, Apple) and hands
   the provider's id token to Supabase. */

export type { LeaderboardRow, Profile, Session } from '@chatynkowo/api'

export type SignInProvider = 'google' | 'apple'

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/* Native sign-in is offered only once the providers are configured in the
   backend (EXPO_PUBLIC_AUTH_ENABLED); until then the account features stay
   hidden and the app works signed out, like the site. */
export const authEnabled = AUTH_ENABLED && configured

export const supabase = configured
  ? api.createChatynkowoClient({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      options: {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      },
    })
  : null

/* Supabase refreshes tokens on a timer that should only run while the app
   is in the foreground. Returns the unsubscribe function. */
export function bindAutoRefresh(): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const apply = (state: string) => {
    if (state === 'active') void client.auth.startAutoRefresh()
    else void client.auth.stopAutoRefresh()
  }
  apply(AppState.currentState)
  const subscription = AppState.addEventListener('change', apply)
  return () => subscription.remove()
}

export async function getSession() {
  return supabase ? api.getSession(supabase) : null
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session))
  return () => data.subscription.unsubscribe()
}

let googleConfigured = false

async function googleIdToken(): Promise<string> {
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })
    googleConfigured = true
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const response = await GoogleSignin.signIn()
  if (response.type !== 'success' || !response.data.idToken) throw new Error('Google sign-in was cancelled.')
  return response.data.idToken
}

async function appleIdToken(): Promise<string> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })
  if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token.')
  return credential.identityToken
}

/* Native sign-in: the provider's id token goes to Supabase, which creates
   or finds the account. Throws when cancelled or misconfigured. */
export async function signIn(provider: SignInProvider): Promise<Session | null> {
  if (!supabase || !authEnabled) throw new Error('Sign-in is not enabled in this build.')
  const token = provider === 'google' ? await googleIdToken() : await appleIdToken()
  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token })
  if (error) throw error
  return data.session
}

export async function signOut() {
  if (!supabase) return
  await api.signOut(supabase)
  try {
    if (googleConfigured) await GoogleSignin.signOut()
  } catch {
    // The Google session is a convenience; the Supabase session is gone.
  }
}

export async function ensureProfile(session: Session) {
  return supabase ? api.ensureProfile(supabase, session) : null
}

export async function updateProfile(session: Session, patch: Pick<api.Profile, 'display_name' | 'avatar_url'>) {
  return supabase ? api.updateProfile(supabase, session, patch) : null
}

/* Push finds to the account. Resolves to false when the backend refused
   or is unreachable, so the caller keeps them queued. */
export async function pushFinds(session: Session, found: Record<string, StoredFind>, total: number): Promise<boolean> {
  if (!supabase || !Object.keys(found).length) return true
  try {
    await api.syncFinds(supabase, session, found, total)
    return true
  } catch {
    return false
  }
}

/* The account's finds, for merging into the local Kronika. Throws when
   the backend cannot be read, so the caller retries instead of taking an
   empty answer for an empty account. */
export async function pullFinds(session: Session): Promise<Record<string, StoredFind>> {
  if (!supabase) return {}
  const { data, error } = await supabase.from('finds').select('slug, found_at').eq('user_id', session.user.id)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.slug, { foundAt: row.found_at }]))
}

export async function fetchLeaderboard(total: number) {
  return supabase ? api.fetchLeaderboard(supabase, total) : []
}
