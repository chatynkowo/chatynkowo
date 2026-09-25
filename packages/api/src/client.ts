import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type ChatynkowoClient = SupabaseClient<Database>

export type ChatynkowoClientConfig = {
  url: string
  /* The publishable (anon) key — safe to ship in a client; row-level security
     in the database is what protects the data. */
  anonKey: string
  /* Per-platform options. The web keeps the defaults (session in
     localStorage, OAuth redirect parsed from the URL). React Native passes
     AsyncStorage/SecureStore as `auth.storage` and turns `detectSessionInUrl`
     off — see apps/mobile/README.md. */
  options?: SupabaseClientOptions<'public'>
}

export function createChatynkowoClient({ url, anonKey, options }: ChatynkowoClientConfig): ChatynkowoClient {
  return createClient<Database>(url, anonKey, options)
}
