/**
 * GET /api/news/decode/stream
 *
 * Server-Sent Events endpoint that streams URL decoding progress in real-time.
 * Decodes Google News URLs to actual article URLs with 3-second delays
 * between requests to avoid rate limiting.
 *
 * Events:
 *   { type: "progress", decoded: number, failed: number, total: number }
 *   { type: "complete", decoded: number, failed: number, total: number }
 *   { type: "error", message: string }
 *
 * Uses cookies for authentication (handled by Supabase server client).
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getArticlesToDecode,
  decodeAndUpdateArticle,
} from "@/lib/services/urlDecoder";
import {
  extractBase64Id,
  batchGetCachedUrls,
} from "@/lib/utils/googleNewsUrlCache";

/** Delay between decode requests (ms) - 3 seconds to avoid rate limits */
const DECODE_DELAY_MS = 3000;

/** SSE event data types */
interface ProgressEvent {
  type: "progress";
  decoded: number;
  failed: number;
  total: number;
}

interface CompleteEvent {
  type: "complete";
  decoded: number;
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
      console.warn("[api/news/decode/stream] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get all articles needing URL decode
    const articles = await getArticlesToDecode(supabase, user.id);
    const total = articles.length;

    // If no articles to process, return immediate complete
    if (total === 0) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(formatSSE({ type: "complete", decoded: 0, failed: 0, total: 0 }));
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

    // Pre-load URL cache for all articles
    const base64Ids = articles
      .map((a) => extractBase64Id(a.link))
      .filter((id): id is string => id !== null);

    const urlCache = await batchGetCachedUrls(supabase, base64Ids);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let decoded = 0;
        let failed = 0;

        console.log(`[api/news/decode/stream] Starting decode of ${total} articles for user ${user.id}`);

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];

          // Check if client disconnected
          if (request.signal.aborted) {
            console.log("[api/news/decode/stream] Client disconnected, stopping decode");
            break;
          }

          // Decode the article
          const result = await decodeAndUpdateArticle(supabase, article, urlCache);

          if (result.success) {
            decoded++;
          } else {
            failed++;
          }

          // Send progress event
          try {
            controller.enqueue(formatSSE({
              type: "progress",
              decoded,
              failed,
              total,
            }));
          } catch {
            // Controller might be closed if client disconnected
            console.log("[decode/stream] Failed to send progress event, client may have disconnected");
            break;
          }

          // Add delay before next decode request (skip for last article and cached results)
          if (i < articles.length - 1 && !result.cached && !request.signal.aborted) {
            await sleep(DECODE_DELAY_MS);
          }
        }

        // Send complete event
        try {
          controller.enqueue(formatSSE({
            type: "complete",
            decoded,
            failed,
            total,
          }));
        } catch {
          // Ignore if controller is closed
        }

        console.log(`[api/news/decode/stream] Decode complete: ${decoded} decoded, ${failed} failed`);
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
    console.error("[api/news/decode/stream] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
