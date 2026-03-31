import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Supabase client with the **service role** key (bypasses RLS).
 * Use only in trusted server contexts (e.g. cron jobs) — never import from client code.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for server-side cron jobs.",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
