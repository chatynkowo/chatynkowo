/* Deletes the caller's account for good: the finds, the profile and the
   auth user, in that order. The app's account screen and the site's
   delete-account page call it through `client.functions.invoke`
   (`deleteAccount` in @chatynkowo/api), with the seeker's access token as
   the bearer.

   Why an Edge Function at all: a client may update or remove its own rows
   under row-level security, but it can never delete its own auth user; that
   takes the service role, which must not leave the backend. So the function
   verifies who is calling and then acts as the administrator on that one
   account.

   Why the rows are deleted explicitly: the schema is not versioned in the
   repository (supabase/README.md), so whether `finds.user_id` and
   `profiles.id` cascade from `auth.users` is a fact of the project, not of
   the code. Deleting the rows first works whether they cascade or not, and
   would also clear what a foreign key without a cascade would otherwise
   block.

   Why the function checks the token itself: the gateway's JWT verification
   is a deployment option (`--no-verify-jwt` switches it off), not something
   this code can rely on. `auth.getUser` asks the auth server, so a revoked
   or expired token is refused here even when the gateway let it through.

   An account that signs in with Apple is also cut loose from Apple, as
   Apple asks of every app offering its sign-in: its Apple tokens are
   revoked before anything is deleted, and a revocation that fails deletes
   nothing, so the seeker can try again. Each client hands over what it
   has. The app sends a fresh authorization code from its own Sign in with
   Apple (`appleAuthorizationCode`), issued to the app's bundle id: the
   function trades it for the account's tokens, checks they belong to the
   Apple account the user signs in with, and revokes them. The site sends
   the Apple refresh token Supabase handed over with its Apple sign-in
   (`appleRefreshToken`), issued to the site's Services ID, and the
   function revokes it as it is: it came with the caller's own session.
   An older client sends neither, and its deletion goes ahead without.

   The runtime injects SUPABASE_URL, SUPABASE_ANON_KEY and
   SUPABASE_SERVICE_ROLE_KEY. The revocation reads five secrets, set once
   (supabase/README.md, "Deleting an account"): APPLE_TEAM_ID,
   APPLE_KEY_ID and APPLE_PRIVATE_KEY (the Sign in with Apple key and the
   contents of its .p8), APPLE_APP_ID (the app's bundle id) and
   APPLE_SERVICES_ID (the site's Services ID), the two clients Apple
   issues the tokens to. */
import { createClient } from 'npm:@supabase/supabase-js@2'

const PRODUCTION_ORIGIN = 'https://www.chatynkowo.pl'
const APPLE = 'https://appleid.apple.com'
const SITE_ORIGINS = new Set([PRODUCTION_ORIGIN, 'https://chatynkowo.pl'])
/* The site's dev server (Vite on localhost) and a local Supabase stack. */
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/* A browser preflight from the site, or from a dev server, is answered
   with its own origin; any other origin gets the production site, which
   its browser then refuses. The app sends no origin and ignores these. */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const allowed = SITE_ORIGINS.has(origin) || DEV_ORIGIN.test(origin) ? origin : PRODUCTION_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(request: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  })
}

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/* The access token from the Authorization header, or null when the header
   is missing or is not a bearer. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

const encodeJson = (value: unknown) => toBase64url(new TextEncoder().encode(JSON.stringify(value)))

/* The client secret Apple's token endpoints expect: a JWT signed ES256
   with the Sign in with Apple key, naming the client the tokens were
   issued to, valid for the few minutes the revocation takes. */
async function appleClientSecret(clientId: string): Promise<string> {
  const pem = env('APPLE_PRIVATE_KEY')
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (char) => char.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encodeJson({ alg: 'ES256', kid: env('APPLE_KEY_ID') })}.${encodeJson({ iss: env('APPLE_TEAM_ID'), iat: now, exp: now + 300, aud: APPLE, sub: clientId })}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${toBase64url(new Uint8Array(signature))}`
}

function applePost(path: 'token' | 'revoke', form: Record<string, string>): Promise<Response> {
  return fetch(`${APPLE}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  })
}

/* Revokes one token, which also ends the client's place in the seeker's
   Apple ID settings. Throws when Apple refuses. */
async function revokeToken(clientId: string, clientSecret: string, token: string, hint: 'refresh_token' | 'access_token'): Promise<void> {
  const revoke = await applePost('revoke', { client_id: clientId, client_secret: clientSecret, token, token_type_hint: hint })
  if (!revoke.ok) throw new Error(`Apple revocation: ${revoke.status} ${await revoke.text()}`)
}

/* The app's way: trades its authorization code for the account's Apple
   tokens and revokes them. The identity token comes straight from Apple
   over TLS in exchange for the client secret, so its subject is trusted
   as it is. Throws when Apple refuses, or when the code belongs to
   another Apple account than the one the user signs in with. */
async function revokeAppleCode(code: string, appleUserId: string | null): Promise<void> {
  const clientId = env('APPLE_APP_ID')
  const clientSecret = await appleClientSecret(clientId)
  const exchange = await applePost('token', { client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' })
  if (!exchange.ok) throw new Error(`Apple token exchange: ${exchange.status} ${await exchange.text()}`)
  const tokens = (await exchange.json()) as { access_token?: string; refresh_token?: string; id_token?: string }
  const claims = tokens.id_token ? JSON.parse(new TextDecoder().decode(fromBase64url(tokens.id_token.split('.')[1] ?? ''))) : null
  if (!appleUserId || claims?.sub !== appleUserId) throw new Error('The authorization belongs to another Apple account.')
  const token = tokens.refresh_token ?? tokens.access_token
  if (!token) throw new Error('Apple returned no token to revoke.')
  await revokeToken(clientId, clientSecret, token, tokens.refresh_token ? 'refresh_token' : 'access_token')
}

/* The site's way: revokes the refresh token its Apple sign-in brought,
   issued to the Services ID. Apple allows a refresh token to be checked
   only rarely, so it is not checked first; it came with the caller's own
   session, and revoking it touches nothing but that sign-in. */
async function revokeAppleRefreshToken(refreshToken: string): Promise<void> {
  const clientId = env('APPLE_SERVICES_ID')
  await revokeToken(clientId, await appleClientSecret(clientId), refreshToken, 'refresh_token')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })

  const token = bearerToken(request)
  if (!token) return json(request, 401, { error: 'Sign in to delete an account.' })

  /* Who is calling: the anon client asks the auth server about the token
     it was handed. The anon key alone (a call without a session) carries no
     user and is refused the same way. */
  const url = env('SUPABASE_URL')
  const caller = createClient(url, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error: userError } = await caller.auth.getUser(token)
  if (userError || !data.user) return json(request, 401, { error: 'Sign in to delete an account.' })
  const userId = data.user.id

  /* Apple first: until its tokens are revoked nothing is deleted. A body
     that is missing or not JSON (an older client) carries no code. */
  const body = (await request.json().catch(() => ({}))) as { appleAuthorizationCode?: unknown; appleRefreshToken?: unknown }
  const code = typeof body.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : ''
  const refreshToken = typeof body.appleRefreshToken === 'string' ? body.appleRefreshToken : ''
  if (code || refreshToken) {
    const apple = data.user.identities?.find((identity) => identity.provider === 'apple')
    const appleUserId = (apple?.identity_data?.sub as string | undefined) ?? apple?.id ?? null
    try {
      if (code) await revokeAppleCode(code, appleUserId)
      else await revokeAppleRefreshToken(refreshToken)
    } catch (error) {
      console.error('[delete-account] apple', userId, error)
      return json(request, 502, { error: 'Sign in with Apple could not be revoked.' })
    }
  }

  /* From here on the administrator acts on that one account. Each step is
     a no-op when a previous attempt already did it, so a failed run can be
     retried. */
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const finds = await admin.from('finds').delete().eq('user_id', userId)
    if (finds.error) throw finds.error
    const profile = await admin.from('profiles').delete().eq('id', userId)
    if (profile.error) throw profile.error
    const user = await admin.auth.admin.deleteUser(userId)
    if (user.error) throw user.error
  } catch (error) {
    /* The reason stays in the function's logs; the client gets a plain
       refusal and keeps its session for another try. */
    console.error('[delete-account]', userId, error)
    return json(request, 500, { error: 'The account could not be deleted.' })
  }

  return json(request, 200, { deleted: true })
})
