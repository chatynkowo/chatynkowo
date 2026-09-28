/* Database schema types — written by hand in the shape that
   `supabase gen types typescript` produces. Once the schema grows, replace
   this file with the generated one:
     supabase gen types typescript --linked > packages/api/src/database.types.ts
   The source of truth for the schema is the Supabase project itself; see
   supabase/README.md. */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          public_id: string
          display_name: string
          avatar_url: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          public_id: string
          display_name: string
          avatar_url?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          public_id?: string
          display_name?: string
          avatar_url?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      finds: {
        Row: {
          user_id: string
          slug: string
          found_at: string
        }
        Insert: {
          user_id: string
          slug: string
          found_at?: string
        }
        Update: {
          user_id?: string
          slug?: string
          found_at?: string
        }
        /* user_id references auth.users, not profiles, so PostgREST exposes no
           relationship between the two tables. */
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      /* The leaderboard() SQL function of the project. elapsed_seconds is a
         bigint, which PostgREST serialises as a number within JS range. */
      leaderboard: {
        Args: { p_total?: number }
        Returns: {
          public_id: string
          display_name: string
          avatar_url: string | null
          found: number
          completed: boolean
          elapsed_seconds: number | null
          first_found: string
          last_found: string
        }[]
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
