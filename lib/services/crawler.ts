/**
 * Crawl4AI client for extracting full article content.
 *
 * Connects to a self-hosted Crawl4AI Docker container via its HTTP API.
 * Uses the /md endpoint for simple, reliable markdown generation.
 *
 * If the container is unavailable, all functions return null gracefully
 * so the rest of the pipeline can fall back to snippet-only mode.
 *
 * HARDENED: Includes URL validation, retry logic, and proper error returns.
 */

import { validateUrl } from "@/lib/utils/validateUrl";
import { withRetry } from "@/lib/utils/withRetry";

/** Max characters of crawled content to keep for LLM input. */
const MAX_CONTENT_LENGTH = 4000;

/** Timeout for a single crawl request (ms). */
const CRAWL_TIMEOUT_MS = 30_000;

/** Max retry attempts for crawl requests. */
const MAX_RETRIES = 2;

function getBaseUrl(): string {
  return process.env.CRAWL4AI_API_URL || "http://localhost:11235";
}

/**
 * Shape of the Crawl4AI `/md` endpoint response.
 * The /md endpoint returns markdown directly with a simpler structure.
 */
interface Crawl4AIMdResult {
  success: boolean;
  markdown?: string;
  error_message?: string;
}

/** Result type for crawlArticleContent */
export interface CrawlResult {
  data: string | null;
  error: string | null;
}

/**
 * Crawl a single URL and return its content as clean markdown.
 * Uses the /md endpoint which is simpler and more reliable than /crawl.
 *
 * @param url - The article URL to crawl.
 * @returns Result object with crawled content and optional error.
 */
export async function crawlArticleContent(url: string): Promise<CrawlResult> {
  // Validate URL to prevent SSRF attacks
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return { data: null, error: `Invalid URL: ${urlValidation.error}` };
  }
  const validatedUrl = urlValidation.normalizedUrl!;

  const baseUrl = getBaseUrl();

  try {
    const response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

        try {
          // Use the /md endpoint for simple markdown generation
          const resp = await fetch(`${baseUrl}/md`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: validatedUrl,
            }),
            signal: controller.signal,
            cache: "no-store",
          });

          clearTimeout(timeout);

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }

          return resp;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: (error, attempt, delayMs) => {
          console.warn(
            `[crawler] Attempt ${attempt} failed for ${validatedUrl}, retrying in ${delayMs}ms:`,
            error instanceof Error ? error.message : error
          );
        },
      }
    );

    const json = (await response.json()) as Crawl4AIMdResult;

    if (!json.success) {
      const errMsg = json.error_message ?? "Crawl failed";
      console.warn(`[crawler] Crawl failed for ${validatedUrl}: ${errMsg}`);
      return { data: null, error: errMsg };
    }

    const markdown = json.markdown;

    if (!markdown || markdown.trim().length < 50) {
      const errMsg = "Content too short or empty";
      console.warn(`[crawler] ${errMsg} for ${validatedUrl}`);
      return { data: null, error: errMsg };
    }

    // Truncate to MAX_CONTENT_LENGTH for LLM consumption.
    const content = markdown.length > MAX_CONTENT_LENGTH
      ? markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[content truncated]"
      : markdown;

    console.log(`[crawler] Successfully crawled ${validatedUrl} (${content.length} chars)`);
    return { data: content, error: null };
  } catch (err) {
    let errorMsg: string;

    if (err instanceof DOMException && err.name === "AbortError") {
      errorMsg = `Timeout after ${CRAWL_TIMEOUT_MS}ms`;
    } else if (err instanceof Error) {
      // Check for connection refused (Crawl4AI not running)
      if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
        errorMsg = "Crawl4AI service unavailable";
      } else {
        errorMsg = err.message;
      }
    } else {
      errorMsg = "Unknown error occurred";
    }

    console.warn(`[crawler] Failed for ${url}: ${errorMsg}`);
    return { data: null, error: errorMsg };
  }
}

/**
 * Check if the Crawl4AI service is reachable.
 * Useful for health checks / dashboard indicators.
 */
export async function isCrawlerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
