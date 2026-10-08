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

   The runtime injects SUPABASE_URL, SUPABASE_ANON_KEY and
   SUPABASE_SERVICE_ROLE_KEY; nothing is configured by hand. */
import { createClient } from 'npm:@supabase/supabase-js@2'

const PRODUCTION_ORIGIN = 'https://www.chatynkowo.pl'
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
