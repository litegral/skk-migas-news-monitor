/**
 * GET /api/news/analyze/stream
 *
 * Server-Sent Events endpoint that streams analysis progress in real-time.
 * Each article processed sends a progress event to the client.
 *
 * Events:
 *   { type: "progress", analyzed: number, failed: number, total: number }
 *   { type: "complete", analyzed: number, failed: number, total: number }
 *   { type: "error", message: string }
 *
 * Uses cookies for authentication (handled by Supabase server client).
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crawlArticleContent } from "@/lib/services/crawler";
import { analyzeArticle } from "@/lib/services/llm";

/** Delay between LLM calls to avoid rate limits (ms) */
const LLM_DELAY_MS = 500;

/** SSE event data types */
interface ProgressEvent {
  type: "progress";
  analyzed: number;
  failed: number;
  total: number;
}

interface CompleteEvent {
  type: "complete";
  analyzed: number;
  failed: number;
  total: number;
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type SSEEvent = ProgressEvent | CompleteEvent | ErrorEvent;

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  // Helper to format SSE message
  function formatSSE(data: SSEEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const supabase = await createClient();

    // Authenticate the request
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[api/news/analyze/stream] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get all unprocessed articles that have decoded URLs
    // (Google News articles need URL decoding before we can crawl them)
    const { data: articles, error: fetchError } = await supabase
      .from("articles")
      .select("id, title, link, decoded_url, snippet")
      .eq("user_id", user.id)
      .eq("ai_processed", false)
      .eq("url_decoded", true)
      .eq("decode_failed", false)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[api/news/analyze/stream] Failed to fetch articles:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch articles" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const pendingArticles = articles ?? [];
    const total = pendingArticles.length;

    // If no articles to process, return immediate complete
    if (total === 0) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(formatSSE({ type: "complete", analyzed: 0, failed: 0, total: 0 }));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let analyzed = 0;
        let failed = 0;

        console.log(`[api/news/analyze/stream] Starting analysis of ${total} articles for user ${user.id}`);

        for (let i = 0; i < pendingArticles.length; i++) {
          const article = pendingArticles[i];

          // Check if client disconnected
          if (request.signal.aborted) {
            console.log("[api/news/analyze/stream] Client disconnected, stopping analysis");
            break;
          }

          const now = new Date().toISOString();

          try {
            // 1. Crawl full content (required — skip analysis if crawl fails)
            // Use decoded_url for Google News articles, fall back to link for RSS
            const crawlUrl = article.decoded_url || article.link;
            const crawlResult = await crawlArticleContent(crawlUrl);
            const content = crawlResult.data;

            if (!content) {
              const crawlError = crawlResult.error || "Konten artikel tidak dapat diambil";
              console.warn(`[stream] Crawl failed for "${article.title}", skipping analysis: ${crawlError}`);

              // Store error but leave ai_processed=false for retry later
              await supabase
                .from("articles")
                .update({
                  ai_error: `Crawl gagal: ${crawlError}`,
                })
                .eq("id", article.id);

              failed++;

              // Send progress and continue to next article
              try {
                controller.enqueue(formatSSE({
                  type: "progress",
                  analyzed,
                  failed,
                  total,
                }));
              } catch {
                console.log("[stream] Failed to send progress event, client may have disconnected");
                break;
              }

              if (i < pendingArticles.length - 1 && !request.signal.aborted) {
                await sleep(LLM_DELAY_MS);
              }
              continue;
            }

            // 2. Analyze with LLM (only if we have crawled content)
            const analysisResult = await analyzeArticle({
              title: article.title,
              snippet: article.snippet,
              content,
            });

            if (!analysisResult.data) {
              const errorMsg = analysisResult.error || "Unknown LLM error";
              console.warn(`[stream] LLM analysis failed for "${article.title}": ${errorMsg}`);

              // Mark as processed with error tracking
              await supabase
                .from("articles")
                .update({
                  ai_processed: true,
                  ai_error: errorMsg,
                  ai_processed_at: now,
                  full_content: content,
                })
                .eq("id", article.id);

              failed++;
            } else {
              // Update the article with AI results
              const { error: updateError } = await supabase
                .from("articles")
                .update({
                  summary: analysisResult.data.summary,
                  sentiment: analysisResult.data.sentiment,
                  categories: analysisResult.data.categories,
                  ai_reason: analysisResult.data.reason,
                  ai_processed: true,
                  ai_error: null,
                  ai_processed_at: now,
                  full_content: content,
                })
                .eq("id", article.id);

              if (updateError) {
                console.error(`[stream] Failed to update article ${article.id}:`, updateError);
                failed++;
              } else {
                analyzed++;
              }
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`[stream] Error processing article "${article.title}":`, errorMsg);

            // Mark as processed with error tracking
            await supabase
              .from("articles")
              .update({
                ai_processed: true,
                ai_error: errorMsg,
                ai_processed_at: now,
              })
              .eq("id", article.id);

            failed++;
          }

          // Send progress event
          try {
            controller.enqueue(formatSSE({
              type: "progress",
              analyzed,
              failed,
              total,
            }));
          } catch {
            // Controller might be closed if client disconnected
            console.log("[stream] Failed to send progress event, client may have disconnected");
            break;
          }

          // Add delay before next LLM call (skip for last article)
          if (i < pendingArticles.length - 1 && !request.signal.aborted) {
            await sleep(LLM_DELAY_MS);
          }
        }

        // Send complete event
        try {
          controller.enqueue(formatSSE({
            type: "complete",
            analyzed,
            failed,
            total,
          }));
        } catch {
          // Ignore if controller is closed
        }

        console.log(`[api/news/analyze/stream] Analysis complete: ${analyzed} analyzed, ${failed} failed`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/news/analyze/stream] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
