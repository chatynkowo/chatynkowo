import { AppState, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as api from '@chatynkowo/api'
import type { OAuthProvider, Session } from '@chatynkowo/api'
import type { StoredFind } from '@chatynkowo/core'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import i18n from '../i18n'
import { APPLE_SIGN_IN, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { previewEnabled, previewProfile, previewSession, updatePreviewProfile } from './account-preview'

/* The app's instance of the shared backend client plus the account
   functions bound to it — a thin wrapper over @chatynkowo/api, the mirror
   of apps/web/src/lib/sync.ts. The session lives in AsyncStorage and no
   URL is ever parsed for one; sign-in is native (Google, Apple): the
   provider's id token, minted here, goes to the backend through the api.
   A development build with the account preview on (account-preview.ts)
   answers every account call from a stand-in account instead. */

export type { LeaderboardRow, OAuthProvider, Profile, Session } from '@chatynkowo/api'

export type SignInResult =
  | { kind: 'ok'; session: Session; displayName: string | null }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: unknown }

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = configured
  ? api.createChatynkowoClient({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      options: {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      },
    })
  : null

/* The token refresh timer runs only while the app is in the foreground.
   Returns the unsubscribe function. */
export function bindAutoRefresh(): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const apply = (state: string) => void api.setAutoRefresh(client, state === 'active')
  apply(AppState.currentState)
  const subscription = AppState.addEventListener('change', apply)
  return () => subscription.remove()
}

export async function getSession() {
  if (previewEnabled) return previewSession()
  return supabase ? api.getSession(supabase) : null
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  if (previewEnabled || !supabase) return () => {}
  return api.onSessionChange(supabase, listener)
}

/* The sign-ins this build offers (src/config.ts): Google once its client
   ids are configured, Apple on iOS unless the build left the capability
   out. Nothing when the backend itself is not configured. */
export function availableProviders(): OAuthProvider[] {
  if (previewEnabled) return ['google']
  if (!supabase) return []
  const providers: OAuthProvider[] = []
  if (GOOGLE_WEB_CLIENT_ID && (Platform.OS !== 'ios' || GOOGLE_IOS_CLIENT_ID)) providers.push('google')
  if (Platform.OS === 'ios' && APPLE_SIGN_IN) providers.push('apple')
  return providers
}

/* Google's library is set up once, where the build offers it; the Supabase
   session is what signs in, the Google one is a convenience. */
const googleOffered = !previewEnabled && availableProviders().includes('google')
if (googleOffered) GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined })

/* What a native sign-in hands over, or null when the seeker closed the
   dialog. Apple shares the name once, on the first sign-in, and never in
   the token; Google's name travels in the token's metadata. */
type NativeCredential = { token: string; displayName: string | null; nonce?: string }

async function googleCredential(): Promise<NativeCredential | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const response = await GoogleSignin.signIn()
  if (response.type === 'cancelled') return null
  if (!response.data.idToken) throw new Error('Google sign-in returned no id token.')
  return { token: response.data.idToken, displayName: null }
}

function isAppleCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
}

async function appleCredential(): Promise<NativeCredential | null> {
  /* The token carries the hash of a nonce only this attempt knows; the
     backend checks it against the raw one, so a captured token is no use. */
  const nonce = Crypto.randomUUID()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })
    if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token.')
    const displayName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || null
    return { token: credential.identityToken, displayName, nonce }
  } catch (error) {
    if (isAppleCancellation(error)) return null
    throw error
  }
}

/* Native sign-in: the provider's dialog, then its token to the backend,
   which creates or finds the account. The name the dialog handed over is
   reported through `onCredential` before the exchange, since the backend
   announces the new session during it and the profile is created then. A
   closed dialog is not a failure. */
export async function signIn(provider: OAuthProvider, onCredential: (displayName: string | null) => void): Promise<SignInResult> {
  if (previewEnabled) return { kind: 'ok', session: previewSession(), displayName: null }
  if (!supabase) return { kind: 'failed', error: new Error('The backend is not configured.') }
  try {
    const credential = provider === 'google' ? await googleCredential() : await appleCredential()
    if (!credential) return { kind: 'cancelled' }
    onCredential(credential.displayName)
    const session = await api.signInWithIdToken(supabase, provider, credential.token, credential.nonce)
    return { kind: 'ok', session, displayName: credential.displayName }
  } catch (error) {
    return { kind: 'failed', error }
  }
}

/* Forgets the session on this device and, when the backend can be reached,
   revokes it everywhere; the Google session is a convenience. */
export async function signOut() {
  if (previewEnabled || !supabase) return
  await api.signOut(supabase)
  try {
    if (googleOffered) await GoogleSignin.signOut()
  } catch {
    // The Supabase session is gone; the Google one expires by itself.
  }
}

/* The profile row, created on first contact with the name the sign-in
   handed over or the translated default. */
export async function ensureProfile(session: Session, displayName: string | null = null) {
  if (previewEnabled) return previewProfile()
  return supabase ? api.ensureProfile(supabase, session, { hint: displayName, fallback: i18n.t('profile.defaultName') }) : null
}

export function providerAvatarUrl(session: Session) {
  return api.providerAvatarUrl(session)
}

/* The provider's name for "signed in with", translated; the session's
   own provider when it is one the app knows, else a generic word. */
export function providerName(session: Session): string {
  const provider = api.sessionProvider(session)
  return provider === 'apple' ? i18n.t('profile.providerApple') : provider === 'google' ? i18n.t('profile.providerGoogle') : i18n.t('profile.account')
}

export function sessionEmail(session: Session) {
  return api.sessionEmail(session)
}

export async function updateProfile(session: Session, patch: Pick<api.Profile, 'display_name' | 'avatar_url'>) {
  if (previewEnabled) return updatePreviewProfile(patch)
  return supabase ? api.updateProfile(supabase, session, patch) : null
}

/* Deletes the account for good through the backend's function (see
   @chatynkowo/api deleteAccount) and lets the Google session go; the
   finds on the device stay. Throws when the backend refused or could not
   be reached, with the session still in place. */
export async function deleteAccount() {
  if (previewEnabled || !supabase) return
  await api.deleteAccount(supabase)
  try {
    if (googleOffered) await GoogleSignin.signOut()
  } catch {
    // The account is gone; the Google session expires by itself.
  }
}

/* Push finds to the account. Resolves to false when the backend refused
   or is unreachable, so the caller keeps them queued; the reason goes to
   the console. */
export async function pushFinds(session: Session, found: Record<string, StoredFind>, total: number): Promise<boolean> {
  if (previewEnabled || !supabase || !Object.keys(found).length) return true
  try {
    await api.syncFinds(supabase, session, found, total)
    return true
  } catch (error) {
    console.error('[sync] push', error)
    return false
  }
}

/* The account's finds, for merging into the local Kronika. Throws when
   the backend cannot be read, so the caller retries instead of taking an
   empty answer for an empty account. */
export async function fetchFinds(session: Session): Promise<Record<string, StoredFind>> {
  if (previewEnabled) return {}
  return supabase ? api.fetchFinds(supabase, session) : {}
}

export async function fetchLeaderboard(total: number) {
  return supabase ? api.fetchLeaderboard(supabase, total) : []
}
