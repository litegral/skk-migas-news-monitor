/**
 * POST /api/news/analyze
 *
 * Triggers AI analysis (summary, sentiment, categories) on unprocessed
 * articles for the authenticated user.
 *
 * Accepts an optional JSON body:
 *   { "limit": number }  — max articles to process (default 10, max 100).
 *
 * Returns the number of remaining unprocessed articles for background loop support.
 *
 * HARDENED: Includes proper error aggregation and structured logging.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeUnprocessedArticles } from "@/lib/services/news";
import type { ApiResponse } from "@/lib/types/news";

export const maxDuration = 60;

interface AnalyzeResponseData {
  analyzed: number;
  failed: number;
  remaining: number;
  errors: string[];
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AnalyzeResponseData>>> {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Authenticate the request.
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[api/news/analyze] Unauthorized request");
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Parse optional limit from body. Defaulting to 2 to minimize timeout risk.
    let limit = 2;
    try {
      const body = await request.json();
      if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 100) {
        limit = body.limit;
      }
    } catch {
      // No body or invalid JSON — use default limit.
    }

    const result = await analyzeUnprocessedArticles(supabase, user.id, limit);

    // Get remaining unprocessed count for background loop
    // Only count articles that are actually eligible for analysis
    const { count: remaining } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("ai_processed", false)
      .eq("url_decoded", true)
      .eq("decode_failed", false);

    // Log the request
    console.log(JSON.stringify({
      route: "/api/news/analyze",
      userId: user.id,
      limit,
      analyzed: result.analyzed,
      failed: result.failed,
      remaining: remaining ?? 0,
      errorCount: result.errors.length,
      durationMs: Date.now() - startTime,
    }));

    // Return partial success even if some analyses failed
    // Only return error status if nothing was analyzed AND there are errors
    if (result.analyzed === 0 && result.errors.length > 0) {
      return NextResponse.json(
        {
          data: {
            analyzed: 0,
            failed: result.failed,
            remaining: remaining ?? 0,
            errors: result.errors,
          },
          error: result.errors[0],
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: {
        analyzed: result.analyzed,
        failed: result.failed,
        remaining: remaining ?? 0,
        errors: result.errors,
      },
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
