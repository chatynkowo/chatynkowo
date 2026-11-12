import { sessionProvider, type OAuthProvider, type Session } from '@chatynkowo/api'
import { tokenClaims } from './token'

/* The sign-ins this browser has seen, kept in localStorage for looking
   into a problem later: which provider the seeker chose and when, and
   the account that came back. Nothing on the site acts on it and the
   site sends it nowhere: it leaves the browser only inside the report a
   seeker makes and sends themselves (lib/diagnostics), or read out of
   the console (see supabase/README.md, "Looking into a sign-in"). The
   log is best effort: it never stands in the way of signing in. */

export type SignInEvent =
  /* The seeker chose a provider and left the site for it; `at` is this
     browser's clock. */
  | { event: 'started'; at: string; provider: OAuthProvider }
  /* A session arrived: the account, the backend's id of the session and
     the moment the backend signed it in. The provider is the one chosen
     here on the way; for a session that arrived without a choice, the one
     the account began with. */
  | { event: 'signed-in'; at: string; provider: OAuthProvider | null; userId: string; sessionId: string }

const STORAGE_KEY = 'chatynkowo:sign-ins:v1'
/* About the last twenty-five sign-ins, each a choice and an arrival. */
const KEPT_EVENTS = 50
/* How long a choice waits for its session: the trip to the provider and
   back. */
const TRIP_MS = 10 * 60 * 1000

/* A log that cannot be read starts over with the next entry. */
function readLog(): SignInEvent[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter((entry): entry is SignInEvent => typeof entry === 'object' && entry !== null) : []
  } catch {
    return []
  }
}

function writeLog(log: SignInEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.slice(-KEPT_EVENTS)))
}

/* What tells one sign-in from the next: the backend's id of the session
   and the moment it authenticated, two claims of the access token that a
   token refresh keeps (`session_id`, `amr`). The moment is this browser's
   own when the token does not say. */
function sessionOrigin(session: Session): { sessionId: string; at: string } | null {
  const claims = tokenClaims(session.access_token)
  if (typeof claims.session_id !== 'string') return null
  const methods: unknown[] = Array.isArray(claims.amr) ? claims.amr : []
  const times = methods.map((method) => (method as { timestamp?: unknown } | null)?.timestamp).filter((time) => typeof time === 'number')
  return { sessionId: claims.session_id, at: new Date(times.length ? Math.min(...times) * 1000 : Date.now()).toISOString() }
}

/* The seeker chose a provider; called before the page leaves for it. */
export function noteSignInStarted(provider: OAuthProvider) {
  try {
    writeLog([...readLog(), { event: 'started', at: new Date().toISOString(), provider }])
  } catch {
    // Storage can be disabled in private browsing. Signing in goes on.
  }
}

/* A session is here. Written down once per sign-in: a refreshed token,
   another page or another tab carries the same session. */
export function noteSignedIn(session: Session) {
  try {
    const origin = sessionOrigin(session)
    const log = readLog()
    if (!origin || log.some((entry) => entry.event === 'signed-in' && entry.sessionId === origin.sessionId)) return
    const last = log.at(-1)
    const chosen = last?.event === 'started' && Date.now() - Date.parse(last.at) < TRIP_MS ? last.provider : null
    writeLog([...log, { event: 'signed-in', at: origin.at, provider: chosen ?? sessionProvider(session), userId: session.user.id, sessionId: origin.sessionId }])
  } catch {
    // An unreadable token, or no storage: nothing to write down.
  }
}

/* A deleted account leaves no trace of itself in the browser: the log
   goes with it. */
export function forgetSignIns() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Without storage there was no log either.
  }
}
