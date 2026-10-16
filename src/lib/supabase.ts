import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client, or null when the env vars are missing. Without
 * Supabase the app runs in local mode: data stays in this browser only.
 *
 * The session lives in localStorage, so a signed-in user stays signed in
 * while offline.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

/** User id used for rows created in local mode. */
export const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000000";
