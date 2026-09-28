/* Runtime configuration of the app. Values come from EXPO_PUBLIC_* variables
   (apps/mobile/.env, see .env.example), inlined by Metro at build time, with
   the production project as the default so a checkout builds and runs
   without any setup. The anon key is a publishable key by design —
   row-level security guards the data. */

export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wqlodfnukdjrulcvzvtk.supabase.co'
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ASCFENexhyJ0sMopHKJIzQ_WhodJFoc'

/* Origin the published content (data/, cottages/, assets/) is read from. */
export const CONTENT_BASE_URL: string = process.env.EXPO_PUBLIC_CONTENT_BASE_URL || 'https://www.chatynkowo.pl'

/* Native sign-in stays hidden until the providers are configured in the
   backend; the app is fully usable signed out, like the site. */
export const AUTH_ENABLED: boolean = process.env.EXPO_PUBLIC_AUTH_ENABLED === 'true'

export const GOOGLE_WEB_CLIENT_ID: string = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''

/* Storage keys, all in one place so a schema bump is a one-line change. */
export const STORAGE_KEYS = {
  progress: 'chatynkowo:progress:v1',
  syncQueue: 'chatynkowo:sync-queue:v1',
  language: 'chatynkowo:language',
  contentCache: 'chatynkowo:content:v2:',
} as const
