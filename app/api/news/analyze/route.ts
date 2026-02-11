/**
 * POST /api/news/analyze
 *
 * Triggers AI analysis (summary, sentiment, categories) on unprocessed
 * articles for the authenticated user.
 *
 * Accepts an optional JSON body:
 *   { "limit": number }  — max articles to process (default 10).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeUnprocessedArticles } from "@/lib/services/news";
import type { ApiResponse } from "@/lib/types/news";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ analyzed: number }>>> {
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

    // Parse optional limit from body.
    let limit = 10;
    try {
      const body = await request.json();
      if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 50) {
        limit = body.limit;
      }
    } catch {
      // No body or invalid JSON — use default limit.
    }

    const result = await analyzeUnprocessedArticles(supabase, user.id, limit);

    if (result.error) {
      return NextResponse.json(
        { data: null, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: { analyzed: result.analyzed },
      error: null,
    });
  } catch (err) {
    console.error("[api/news/analyze] Unhandled error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}
