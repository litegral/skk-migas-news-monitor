import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Create a Supabase client for use in **server** code:
 * Server Components, Server Actions, and Route Handlers.
 *
 * Must be called inside an async context where `cookies()` is available.
 * A fresh client should be created per-request -- never cache or share it.
 *
 * The proxy.ts file handles session refresh; this client simply reads/writes
 * the cookie jar so the auth state stays in sync.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll may be called from a Server Component where cookies
            // are read-only. This is safe to ignore because the proxy
            // handles session refresh.
          }
        },
      },
    },
  );
}
