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

/* A development build only (src/lib/account-preview.ts): "1" shows the
   account screens as if a Google account were signed in, on an emulator
   that has no sign-in configured; no account call reaches the backend. */
export const ACCOUNT_PREVIEW: boolean = process.env.EXPO_PUBLIC_ACCOUNT_PREVIEW === '1'

/* Supporting Chatynkowo (src/features/support), both ways voluntary and
   unlocking nothing. The coffee is a store purchase and needs nothing
   here: the product ids are in src/features/support/tips.ts, the prices
   in the stores. The ad is a rewarded ad from AdMob: the app ids go to
   the native manifests through app.config.ts (Google's sample ids
   without them), the rewarded units are read here per platform; without
   one the development build uses Google's test unit and a release build
   offers no ad. */
export const ADMOB_REWARDED_ANDROID_UNIT_ID: string = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID || ''
export const ADMOB_REWARDED_IOS_UNIT_ID: string = process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID || ''

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
  /* The support ledger (src/lib/support-store.ts): how many coffees and
     ads the player has given, on this device only. */
  support: 'chatynkowo:support:v1',
} as const
