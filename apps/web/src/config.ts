/* Runtime configuration of the web app. Values come from Vite env variables
   (apps/web/.env, see .env.example) with the production project as the
   default, so a checkout builds and runs without any setup. The anon key is
   a publishable key by design — row-level security guards the data. */
const env = import.meta.env

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || 'https://wqlodfnukdjrulcvzvtk.supabase.co'
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ASCFENexhyJ0sMopHKJIzQ_WhodJFoc'

/* Where data/, cottages/ and assets/ are served from. Empty = relative to the
   page, which is how the published site works. */
export const CONTENT_BASE_URL: string = env.VITE_CONTENT_BASE_URL || ''
