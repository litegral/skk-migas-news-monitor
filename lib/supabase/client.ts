import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Create a Supabase client for use in **browser** (Client Component) code.
 *
 * This client uses the anon key and relies on cookies managed by the proxy
 * to attach the user's JWT automatically.
 *
 * Call this inside event handlers, useEffect, or other client-side code.
 * Do NOT call it at module scope -- always call inside a function/hook so
 * the cookie header is fresh.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
