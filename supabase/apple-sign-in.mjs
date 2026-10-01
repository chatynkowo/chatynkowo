/* Switches on Sign in with Apple in the Supabase project. The Apple key
   (its id and the .p8 file) and the site's Services ID come from
   supabase/.env; the Apple team and the app's bundle id come from the app
   itself (its resolved Expo config, where they are declared for the build);
   the project comes from `supabase link`. The key makes the client secret
   Apple expects (a JWT signed with it, valid six months, the most Apple
   allows), which goes with the Services ID and the bundle id into the
   project's auth config through the Supabase Management API. Run it again
   before the secret expires (the script prints the date); nothing else
   changes. `--print` shows what would be sent, secret included, and sends
   nothing: the dashboard accepts the same values by hand. */
import { execFileSync } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '../apps/mobile')
const envFile = join(here, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

/* Written by `supabase link` (README, "Working with the schema"). */
const LINKED_PROJECT_FILE = join(here, '.temp/project-ref')
/* Apple rejects a secret that lives longer than six months. */
const SECRET_LIFETIME_S = 180 * 24 * 60 * 60
const APPLE_AUDIENCE = 'https://appleid.apple.com'
const MANAGEMENT_API = 'https://api.supabase.com/v1'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set; see supabase/.env.example`)
  return value
}

/* The app's configuration as Expo resolves it (app.json, app.config.ts and
   apps/mobile/.env): the one place the Apple team and the bundle id are
   declared. */
function appFacts() {
  const expo = join(appDir, 'node_modules/.bin/expo')
  if (!existsSync(expo)) throw new Error('The app is not installed; run pnpm install first')
  let output
  try {
    output = execFileSync(expo, ['config', '--type', 'prebuild', '--json'], { cwd: appDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    throw new Error(`The app's configuration could not be read (expo config):\n${error.stderr || error.message}`)
  }
  const { ios } = JSON.parse(output)
  if (!ios?.appleTeamId) throw new Error('The app declares no Apple team; set APPLE_TEAM_ID in apps/mobile/.env')
  if (!ios.bundleIdentifier) throw new Error('The app declares no bundle id (ios.bundleIdentifier in app.json)')
  return { teamId: ios.appleTeamId, bundleId: ios.bundleIdentifier }
}

function linkedProject() {
  if (!existsSync(LINKED_PROJECT_FILE)) throw new Error('No project linked; run pnpm dlx supabase link --project-ref <ref> first (README)')
  return readFileSync(LINKED_PROJECT_FILE, 'utf8').trim()
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

/* The client secret: the registered claims, signed ES256 with the key, as
   Apple specifies for Sign in with Apple on the web. */
function clientSecret({ teamId, keyId, servicesId, privateKey }, issuedAt) {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ iss: teamId, iat: issuedAt, exp: issuedAt + SECRET_LIFETIME_S, aud: APPLE_AUDIENCE, sub: servicesId }))
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${base64url(signature)}`
}

async function main() {
  const print = process.argv.includes('--print')
  const keyId = required('APPLE_KEY_ID')
  const servicesId = required('APPLE_SERVICES_ID')
  const privateKey = createPrivateKey(readFileSync(resolve(here, required('APPLE_PRIVATE_KEY_PATH')), 'utf8'))
  const { teamId, bundleId } = appFacts()
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiry = new Date((issuedAt + SECRET_LIFETIME_S) * 1000).toISOString().slice(0, 10)

  const config = {
    external_apple_enabled: true,
    /* The Services ID first: it is the client of the browser flow; the
       bundle id lets the backend accept the app's identity tokens. */
    external_apple_client_id: `${servicesId},${bundleId}`,
    external_apple_secret: clientSecret({ teamId, keyId, servicesId, privateKey }, issuedAt),
  }

  if (print) {
    console.log(JSON.stringify(config, null, 2))
    console.log(`Team ${teamId}; the secret expires on ${expiry}.`)
    return
  }

  const accessToken = required('SUPABASE_ACCESS_TOKEN')
  const projectRef = linkedProject()
  const response = await fetch(`${MANAGEMENT_API}/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!response.ok) throw new Error(`Supabase Management API: ${response.status} ${await response.text()}`)
  const applied = await response.json()
  if (applied.external_apple_enabled !== true) throw new Error('The project does not report Apple as enabled after the update.')
  console.log(`Sign in with Apple is on for project ${projectRef}; client ids: ${applied.external_apple_client_id}.`)
  console.log(`The secret expires on ${expiry}; run this again before then.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
