/* @chatynkowo/api — one client for the shared backend.

   Today the backend is a Supabase project: Google sign-in, a `profiles` row
   per account, a `finds` row per discovered cottage and a `leaderboard()`
   function that ranks seekers. The schema lives in the Supabase project;
   database.types.ts mirrors it.

   Content (stories, recordings, reward cards) is not served from here — it is
   published as static files and read through @chatynkowo/core's content
   client. Keep that split: the database holds what is per-user and mutable,
   the static site holds what is authored. */

export { createChatynkowoClient, type ChatynkowoClient, type ChatynkowoClientConfig } from './client'
export type { Database, Json, Tables } from './database.types'
export * from './ranking'
export type { Session, User } from '@supabase/supabase-js'
