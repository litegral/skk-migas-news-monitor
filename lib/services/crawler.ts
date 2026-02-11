/**
 * Crawl4AI client for extracting full article content.
 *
 * Connects to a self-hosted Crawl4AI Docker container via its HTTP API.
 * Returns clean markdown text suitable for LLM analysis.
 *
 * If the container is unavailable, all functions return null gracefully
 * so the rest of the pipeline can fall back to snippet-only mode.
 */

/** Max characters of crawled content to keep for LLM input. */
const MAX_CONTENT_LENGTH = 4000;

/** Timeout for a single crawl request (ms). */
const CRAWL_TIMEOUT_MS = 30_000;

function getBaseUrl(): string {
  return process.env.CRAWL4AI_API_URL || "http://localhost:11235";
}

/**
 * Shape of the Crawl4AI `/crawl` response (only the fields we use).
 */
interface Crawl4AIResult {
  success: boolean;
  results?: Array<{
    success: boolean;
    markdown?: string | { raw_markdown?: string; fit_markdown?: string };
    error_message?: string;
  }>;
}

/**
 * Crawl a single URL and return its content as clean markdown.
 *
 * @param url - The article URL to crawl.
 * @returns Cleaned markdown string, or null if crawling failed.
 */
export async function crawlArticleContent(
  url: string,
): Promise<string | null> {
  const baseUrl = getBaseUrl();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [url],
        crawler_config: {
          cache_mode: "bypass",
          excluded_tags: ["nav", "footer", "header", "aside", "script", "style"],
          word_count_threshold: 20,
          only_text: false,
          markdown_generator: {
            type: "default",
            content_filter: {
              type: "pruning",
              threshold: 0.4,
              threshold_type: "fixed",
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(
        `[crawler] Crawl4AI HTTP ${response.status} for ${url}`,
      );
      return null;
    }

    const json = (await response.json()) as Crawl4AIResult;

    if (!json.success || !json.results?.[0]?.success) {
      const errMsg = json.results?.[0]?.error_message ?? "unknown error";
      console.warn(`[crawler] Crawl failed for ${url}: ${errMsg}`);
      return null;
    }

    const result = json.results[0];
    const markdown = extractMarkdown(result.markdown);

    if (!markdown || markdown.trim().length < 50) {
      console.warn(`[crawler] Content too short for ${url}`);
      return null;
    }

    // Truncate to MAX_CONTENT_LENGTH for LLM consumption.
    return markdown.length > MAX_CONTENT_LENGTH
      ? markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[content truncated]"
      : markdown;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn(`[crawler] Timeout crawling ${url}`);
    } else {
      // Connection refused, network error, etc. — Crawl4AI not running.
      console.warn(`[crawler] Unavailable or error for ${url}:`, err);
    }
    return null;
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

/**
 * Extract the best markdown string from the Crawl4AI result.
 * The `markdown` field can be a string or an object with raw/fit variants.
 */
function extractMarkdown(
  md: string | { raw_markdown?: string; fit_markdown?: string } | undefined,
): string | null {
  if (!md) return null;
  if (typeof md === "string") return md;
  // Prefer fit_markdown (content-filtered) over raw.
  return md.fit_markdown || md.raw_markdown || null;
}
