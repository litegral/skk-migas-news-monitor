/**
 * POST /api/news/googlenews
 *
 * Triggers a fetch of news articles from Google News RSS for the authenticated
 * user's enabled topics/keywords. Articles are upserted into the `articles` table.
 *
 * Google News RSS is free and doesn't require an API key.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAndStoreGoogleNews } from "@/lib/services/news";
import type { ApiResponse } from "@/lib/types/news";

interface GoogleNewsResponseData {
  inserted: number;
  errors: string[];
}

export async function POST(): Promise<NextResponse<ApiResponse<GoogleNewsResponseData>>> {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Authenticate the request.
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[api/news/googlenews] Unauthorized request");
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const result = await fetchAndStoreGoogleNews(supabase, user.id);

    // Log the request
    console.log(JSON.stringify({
      route: "/api/news/googlenews",
      userId: user.id,
      inserted: result.inserted,
      errorCount: result.errors.length,
      durationMs: Date.now() - startTime,
    }));

    // Return partial success even if some queries failed
    // Only return error status if no articles were inserted AND there are errors
    if (result.inserted === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { data: { inserted: 0, errors: result.errors }, error: result.errors[0] },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: { inserted: result.inserted, errors: result.errors },
      error: null,
    });
  } catch (err) {
    console.error("[api/news/googlenews] Unhandled error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}
