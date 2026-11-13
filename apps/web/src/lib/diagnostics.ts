import { tokenClaims, type OAuthProvider, type Profile, type Session } from '@chatynkowo/api'
import { diagnosticsEnvelope, gather as gatherWithin, storedEntry, type DiagnosticsEnvelope, type Gathered, type StoredFind } from '@chatynkowo/core'
import { SUPABASE_URL } from '../config'
import { content } from './content'
import { configured, enabledProviders, fetchAccountFinds } from './sync'

/* The report a seeker makes on the diagnostics page when something went
   wrong, to send to us with their own words: everything the site keeps in
   this browser, the account as the site and the backend see it, and the
   browser and device it all runs on, as one JSON document. The rules it
   shares with the app's report (the envelope, the gathering of parts, the
   secrets taken out) are core's diagnostics.ts.

   Making it reads and never writes: the page that makes it runs no
   exchange with the account. */

/* The kind of connection and whether the seeker saves data, where the
   browser tells (Chromium). */
type Connection = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }

export type DiagnosticsReport = DiagnosticsEnvelope & {
  client: 'site'
  site: {
    /* The commit the site was built from. */
    build: string
    address: string
    cameFrom: string | null
    language: string
  }
  browser: Gathered<{
    userAgent: string
    platform: string
    vendor: string
    languages: readonly string[]
    timeZone: string
    online: boolean
    cookies: boolean
    touchPoints: number
    screen: { width: number; height: number; pixelRatio: number }
    window: { width: number; height: number }
    /* Opened from the home screen rather than in a browser tab. */
    standalone: boolean
    connection: Connection | null
  }>
  /* How much the browser stores for the site, in bytes. */
  storage: Gathered<{ usage: number | null; quota: number | null }>
  account: {
    /* Whether the site has a backend to sign in to at all. */
    configured: boolean
    /* Whether the account had settled when the report was made; a report
       does not wait for a backend that does not answer. */
    ready: boolean
    signedIn: boolean
    sessionExpiresAt: string | null
    /* What the access token says of the session; the token itself is a
       secret and stays out. */
    tokenClaims: Gathered<Record<string, unknown>> | null
    /* Whether the session still carries the provider's own tokens (the
       Apple one confirms a deletion). */
    providerTokens: { access: boolean; refresh: boolean } | null
    profile: Profile | null
  }
  backend: {
    address: string
    /* Asked now: the providers the backend offers, the number of published
       cottages, and the finds the account holds. */
    signInProviders: Gathered<OAuthProvider[]>
    cottages: Gathered<number>
    accountFinds: Gathered<Record<string, StoredFind>> | null
  }
  localStorage: Gathered<Record<string, unknown>>
  sessionStorage: Gathered<Record<string, unknown>>
}

export type DiagnosticsSubject = {
  session: Session | null
  profile: Profile | null
  ready: boolean
  language: string
}

/* How long a question to the backend may take before the report goes on
   without the answer. Short on purpose: the backend client retries an
   unanswered read for several seconds before it gives up, and a seeker
   with a broken connection should not wait that out. */
const ANSWER_MS = 4000

function gather<T>(read: () => T | Promise<T>): Promise<Gathered<T>> {
  return gatherWithin(read, ANSWER_MS)
}

/* Every entry of a storage, with the secrets out. */
function entriesOf(storage: Storage): Record<string, unknown> {
  const entries: Record<string, unknown> = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key !== null) entries[key] = storedEntry(key, storage.getItem(key) ?? '')
  }
  return entries
}

/* The browser keeps these on the object's prototype, where JSON does not
   look, so each is read by name. */
function connectionOf(): Connection | null {
  const connection = (navigator as { connection?: Connection }).connection
  return connection ? { effectiveType: connection.effectiveType, downlink: connection.downlink, rtt: connection.rtt, saveData: connection.saveData } : null
}

/* An address without its query and fragment: a sign-in comes back with
   tokens in them. */
function plainAddress(address: string): string {
  const { origin, pathname } = new URL(address)
  return `${origin}${pathname}`
}

export async function collectDiagnostics({ session, profile, ready, language }: DiagnosticsSubject): Promise<DiagnosticsReport> {
  const [browser, storage, claims, signInProviders, cottages, accountFinds, local, tab] = await Promise.all([
    gather(() => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      languages: navigator.languages,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
      cookies: navigator.cookieEnabled,
      touchPoints: navigator.maxTouchPoints,
      screen: { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio },
      window: { width: window.innerWidth, height: window.innerHeight },
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      connection: connectionOf(),
    })),
    gather(async () => {
      const { usage, quota } = await navigator.storage.estimate()
      return { usage: usage ?? null, quota: quota ?? null }
    }),
    session ? gather(() => tokenClaims(session.access_token)) : null,
    gather(() => enabledProviders()),
    gather(async () => (await content.loadLocations()).length),
    session ? gather(() => fetchAccountFinds(session)) : null,
    gather(() => entriesOf(localStorage)),
    gather(() => entriesOf(sessionStorage)),
  ])

  return {
    ...diagnosticsEnvelope('site'),
    client: 'site',
    site: {
      build: __COMMIT_HASH__,
      address: plainAddress(location.href),
      cameFrom: document.referrer ? plainAddress(document.referrer) : null,
      language,
    },
    browser,
    storage,
    account: {
      configured,
      ready,
      signedIn: session !== null,
      sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      tokenClaims: claims,
      providerTokens: session ? { access: Boolean(session.provider_token), refresh: Boolean(session.provider_refresh_token) } : null,
      profile,
    },
    backend: { address: SUPABASE_URL, signInProviders, cottages, accountFinds },
    localStorage: local,
    sessionStorage: tab,
  }
}
