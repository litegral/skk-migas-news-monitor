import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

/**
 * Refresh the Supabase auth session on every matched request.
 *
 * This runs inside the Next.js 16 Proxy (`proxy.ts` at project root).
 * It does three things:
 *
 * 1. Reads auth cookies from the incoming request.
 * 2. Calls `getClaims()` which validates the JWT and refreshes if expired.
 * 3. Writes updated cookies to both the request (for downstream Server
 *    Components) and the response (for the browser).
 *
 * If there is no authenticated user, the request is redirected to `/login`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run any code between createServerClient and
  // getClaims(). A simple mistake could cause random logouts.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: Always return the supabaseResponse as-is.
  // If you create a new NextResponse, copy the cookies over:
  //   myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  return supabaseResponse;
}
