/* Runtime configuration of the app. Values come from EXPO_PUBLIC_* variables
   (apps/mobile/.env, see .env.example), inlined by Metro at build time, with
   the production project as the default so a checkout builds and runs
   without any setup. The anon key is a publishable key by design —
   row-level security guards the data. */

export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wqlodfnukdjrulcvzvtk.supabase.co'
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ASCFENexhyJ0sMopHKJIzQ_WhodJFoc'

/* Origin the published content (data/, cottages/, assets/) is read from. */
export const CONTENT_BASE_URL: string = process.env.EXPO_PUBLIC_CONTENT_BASE_URL || 'https://www.chatynkowo.pl'

/* Which sign-ins the build offers (supabase/README.md, "Sign-in providers");
   the app is fully usable signed out, like the site. Google needs the
   backend's web client id, whose tokens the native flow mints, and on iOS
   its own client id as well; Apple is on unless a build cannot carry the
   capability (a free Personal Team), which app.config.ts reads from the
   same variable. */
export const GOOGLE_WEB_CLIENT_ID: string = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''
export const GOOGLE_IOS_CLIENT_ID: string = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ''
export const APPLE_SIGN_IN: boolean = process.env.EXPO_PUBLIC_APPLE_SIGN_IN !== '0'

/* Storage keys, all in one place so a schema bump is a one-line change. */
export const STORAGE_KEYS = {
  progress: 'chatynkowo:progress:v1',
  syncQueue: 'chatynkowo:sync-queue:v1',
  language: 'chatynkowo:language',
  contentCache: 'chatynkowo:content:v2:',
  welcomeSeen: 'chatynkowo:welcome-seen',
  /* The seeker let the Atlas find them once; a lapsed one-time grant is
     asked for again at start-up from then on. */
  locatedOnce: 'chatynkowo:located-once',
  /* Reward ids the player has already viewed in the Kronika; earned minus
     these is the tab badge. */
  rewardsSeen: 'chatynkowo:rewards-seen:v1',
  /* The maps app the seeker chose for "Navigate"; a device preference. */
  mapsApp: 'chatynkowo:maps-app',
} as const
