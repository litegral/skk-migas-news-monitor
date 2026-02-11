/**
 * POST /api/news/rss
 *
 * Triggers a fetch of news articles from the authenticated user's
 * enabled RSS feeds. Articles are upserted into the `articles` table.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAndStoreRSS } from "@/lib/services/news";
import type { ApiResponse } from "@/lib/types/news";

export async function POST(): Promise<NextResponse<ApiResponse<{ inserted: number }>>> {
  try {
    const supabase = await createClient();

    // Authenticate the request.
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const result = await fetchAndStoreRSS(supabase, user.id);

    if (result.error) {
      return NextResponse.json(
        { data: null, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: { inserted: result.inserted },
      error: null,
    });
  } catch (err) {
    console.error("[api/news/rss] Unhandled error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}
