/**
 * Server-side news pipeline (fetch → URL decode → AI analyze).
 * Used by cron and other trusted server jobs — not from the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import {
  analyzeUnprocessedArticles,
  fetchAndStoreGoogleNews,
  fetchAndStoreRSS,
} from "@/lib/services/news";
import {
  decodeArticlesWithProgress,
  type DecodeProgressCallback,
} from "@/lib/services/urlDecoder";

type SupabaseDB = SupabaseClient<Database>;

const noopDecodeProgress: DecodeProgressCallback = () => {
  /* cron has no SSE */
};

export interface NewsPipelineOptions {
  /** When true, skip Google News + RSS fetch (decode + analyze only). */
  skipFetch: boolean;
  /** Max articles to decode this invocation (each API decode may incur delay). */
  decodeArticleLimit: number;
  /** Articles per analyzeUnprocessedArticles call. */
  analyzeBatchSize: number;
  /** Stop processing after this many milliseconds (leave headroom under maxDuration). */
  timeBudgetMs: number;
}

export interface NewsPipelineResult {
  fetch: {
    googleNews: { inserted: number; skipped: number; errors: string[] };
    rss: { inserted: number; skipped: number; errors: string[] };
  } | null;
  decode: { decoded: number; failed: number; total: number };
  analyze: { analyzed: number; failed: number; batches: number };
  timedOut: boolean;
  durationMs: number;
}

/**
 * Run fetch (optional), bounded decode, then analyze in batches until the time
 * budget is nearly exhausted or no work remains.
 */
export async function runNewsPipelineSync(
  supabase: SupabaseDB,
  userId: string,
  options: NewsPipelineOptions,
): Promise<NewsPipelineResult> {
  const start = Date.now();
  const deadline = start + options.timeBudgetMs;

  const timeLeftMs = (): number => deadline - Date.now();

  let fetchResult: NewsPipelineResult["fetch"] = null;

  if (!options.skipFetch) {
    const gn = await fetchAndStoreGoogleNews(supabase, userId);
    const rss = await fetchAndStoreRSS(supabase, userId);
    fetchResult = {
      googleNews: {
        inserted: gn.inserted,
        skipped: gn.skipped,
        errors: gn.errors,
      },
      rss: {
        inserted: rss.inserted,
        skipped: rss.skipped,
        errors: rss.errors,
      },
    };
  }

  // Always run decode when there is budget left. (Empty queue returns immediately;
  // skipping here caused long fetches to consume the whole budget and skip decode entirely.)
  if (timeLeftMs() < 2000) {
    return {
      fetch: fetchResult,
      decode: { decoded: 0, failed: 0, total: 0 },
      analyze: { analyzed: 0, failed: 0, batches: 0 },
      timedOut: true,
      durationMs: Date.now() - start,
    };
  }

  const decode = await decodeArticlesWithProgress(
    supabase,
    userId,
    noopDecodeProgress,
    { articleLimit: options.decodeArticleLimit },
  );

  let analyzed = 0;
  let failed = 0;
  let batches = 0;

  while (timeLeftMs() > 12_000) {
    const result = await analyzeUnprocessedArticles(
      supabase,
      userId,
      options.analyzeBatchSize,
    );
    batches++;
    analyzed += result.analyzed;
    failed += result.failed;

    if (result.analyzed === 0 && result.failed === 0) {
      break;
    }
  }

  /** True if we ended with little time left — backlog may need another cron run. */
  const timedOut = timeLeftMs() < 5000;

  return {
    fetch: fetchResult,
    decode,
    analyze: { analyzed, failed, batches },
    timedOut,
    durationMs: Date.now() - start,
  };
}
