/**
 * POST /api/news/rss
 *
 * Triggers a fetch of news articles from the authenticated user's
 * enabled RSS feeds. Articles are upserted into the `articles` table.
 *
 * HARDENED: Includes proper error aggregation and structured logging.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAndStoreRSS } from "@/lib/services/news";
import type { ApiResponse } from "@/lib/types/news";

interface RSSResponseData {
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function POST(): Promise<NextResponse<ApiResponse<RSSResponseData>>> {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Authenticate the request.
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[api/news/rss] Unauthorized request");
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const result = await fetchAndStoreRSS(supabase, user.id);

    // Log the request
    console.log(JSON.stringify({
      route: "/api/news/rss",
      userId: user.id,
      inserted: result.inserted,
      skipped: result.skipped,
      errorCount: result.errors.length,
      durationMs: Date.now() - startTime,
    }));

    // Return partial success even if some feeds failed
    // Only return error status if no articles were inserted AND there are errors
    if (result.inserted === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { data: { inserted: 0, skipped: result.skipped, errors: result.errors }, error: result.errors[0] },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: { inserted: result.inserted, skipped: result.skipped, errors: result.errors },
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
