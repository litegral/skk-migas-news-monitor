/**
 * POST /api/news/retry
 *
 * Resets all failed articles (ai_error IS NOT NULL) so they can be re-analyzed.
 * Sets ai_processed = false, ai_error = null for these articles.
 *
 * Returns the count of reset articles.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/lib/types/news";

export interface RetryResponse {
  resetCount: number;
}

export async function POST(): Promise<NextResponse<ApiResponse<RetryResponse>>> {
  try {
    const supabase = await createClient();

    // Authenticate the request
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Reset all failed articles for this user
    // Failed = ai_processed = true AND ai_error IS NOT NULL
    const { data, error } = await supabase
      .from("articles")
      .update({
        ai_processed: false,
        ai_error: null,
        ai_processed_at: null,
      })
      .eq("user_id", user.id)
      .eq("ai_processed", true)
      .not("ai_error", "is", null)
      .select("id");

    if (error) {
      console.error("[api/news/retry] Failed to reset articles:", error);
      return NextResponse.json(
        { data: null, error: `Failed to reset articles: ${error.message}` },
        { status: 500 },
      );
    }

    const resetCount = data?.length ?? 0;
    console.log(`[api/news/retry] Reset ${resetCount} failed articles for user ${user.id}`);

    return NextResponse.json({
      data: { resetCount },
      error: null,
    });
  } catch (err) {
    console.error("[api/news/retry] Unhandled error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}
