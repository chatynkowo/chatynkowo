import type { OAuthProvider, Profile, Session } from '@chatynkowo/api'
import { withTimeout, type StoredFind } from '@chatynkowo/core'
import { SUPABASE_URL } from '../config'
import { content } from './content'
import { configured, enabledProviders, fetchAccountFinds } from './sync'
import { tokenClaims } from './token'

/* The report a seeker makes on the diagnostics page when something went
   wrong, to send to us with their own words: everything the site keeps in
   this browser, the account as the site and the backend see it, and the
   browser and device it all runs on, as one JSON document.

   Making it reads and never writes: the page that makes it runs no
   exchange with the account. What signs an account in is taken out
   before anyone sees the report (withoutSecrets), so a report in the
   wrong hands opens no account. Every part is gathered on its own and a
   part that fails says why in its place: the report is for the day
   something is broken, so it must not break with it. */

/* A part of the report, or the reason it could not be gathered. */
export type Gathered<T> = T | { failed: string }

/* The kind of connection and whether the seeker saves data, where the
   browser tells (Chromium). */
type Connection = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }

export type DiagnosticsReport = {
  format: 'chatynkowo-diagnostics'
  version: 1
  createdAt: string
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

function reasonOf(reason: unknown): string {
  /* A backend error carries its code and details as own properties. */
  if (reason instanceof Error) return JSON.stringify({ ...reason, name: reason.name, message: reason.message })
  return typeof reason === 'string' ? reason : JSON.stringify(reason) ?? String(reason)
}

async function gather<T>(read: () => T | Promise<T>): Promise<Gathered<T>> {
  try {
    return await withTimeout(Promise.resolve().then(read), ANSWER_MS)
  } catch (reason) {
    return { failed: reasonOf(reason) }
  }
}

/* What signs someone in: the session's tokens, the provider's tokens, the
   editor's GitHub token, anything stored under such a name, and any value
   shaped like one wherever it sits. `token_type` only names the kind. */
const SECRET_NAME = /token|secret|password|verifier/i
const SECRET_VALUE = /^(eyJ[\w-]+\.[\w-]+\.[\w-]*|gh[pousr]_\w+|github_pat_\w+)$/

/* A stored value with every secret replaced by a note of its length, so
   the report still says the secret was there. */
export function withoutSecrets(value: unknown, name = ''): unknown {
  if (typeof value === 'string') {
    const secret = (SECRET_NAME.test(name) && name !== 'token_type') || SECRET_VALUE.test(value)
    return secret ? `[removed: ${value.length} characters]` : value
  }
  if (Array.isArray(value)) return value.map((item) => withoutSecrets(item, name))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutSecrets(item, key)]))
  }
  return value
}

/* Every entry of a storage, read as the JSON most of them are. */
function entriesOf(storage: Storage): Record<string, unknown> {
  const entries: Record<string, unknown> = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key === null) continue
    const stored = storage.getItem(key) ?? ''
    let value: unknown = stored
    try {
      value = JSON.parse(stored)
    } catch {
      // Plain text, like the chosen language.
    }
    entries[key] = withoutSecrets(value, key)
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
    format: 'chatynkowo-diagnostics',
    version: 1,
    createdAt: new Date().toISOString(),
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

/* The report as the text a seeker downloads, copies and reads. */
export function reportText(report: DiagnosticsReport): string {
  return JSON.stringify(report, null, 2)
}

/* chatynkowo-diagnostics-20261112-1002.json, by the report's own time. */
export function reportFileName(report: DiagnosticsReport): string {
  const [date, time] = report.createdAt.split('T')
  return `chatynkowo-diagnostics-${date.replaceAll('-', '')}-${time.slice(0, 5).replace(':', '')}.json`
}
