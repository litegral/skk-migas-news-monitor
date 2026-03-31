/**
 * GET/POST /api/cron/sync
 *
 * Server-side news pipeline for Vercel Cron or manual triggers.
 * Secured with CRON_SECRET (Authorization: Bearer or x-cron-secret).
 *
 * Query:
 * - phase=full — fetch Google News + RSS, then decode + analyze (default)
 * - phase=decode-analyze — decode + analyze only (for frequent backlog runs)
 */

import { NextRequest, NextResponse } from "next/server";

import { getSharedUserId } from "@/lib/config/sharedData";
import { runNewsPipelineSync } from "@/lib/jobs/newsPipeline";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Match analyze route; raise on Pro if you need longer decode batches. */
export const maxDuration = 60;

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (bearer === secret) {
    return true;
  }
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

function parsePhase(request: NextRequest): "full" | "decode-analyze" {
  const url = new URL(request.url);
  const p = url.searchParams.get("phase");
  if (p === "decode-analyze") {
    return "decode-analyze";
  }
  return "full";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function handleCron(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    console.warn("[api/cron/sync] Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phase = parsePhase(request);
  const skipFetch = phase === "decode-analyze";

  const decodeArticleLimit = envInt("CRON_DECODE_ARTICLE_LIMIT", 12);
  const analyzeBatchSize = envInt("CRON_ANALYZE_BATCH_SIZE", 2);
  const timeBudgetMs = envInt("CRON_TIME_BUDGET_MS", 50_000);

  try {
    const supabase = createServiceRoleClient();
    const userId = getSharedUserId();

    const result = await runNewsPipelineSync(supabase, userId, {
      skipFetch,
      decodeArticleLimit,
      analyzeBatchSize,
      timeBudgetMs,
    });

    console.log(
      JSON.stringify({
        route: "/api/cron/sync",
        phase,
        ...result,
      }),
    );

    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    console.error("[api/cron/sync] Error:", err);
    return NextResponse.json(
      {
        data: null,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}
