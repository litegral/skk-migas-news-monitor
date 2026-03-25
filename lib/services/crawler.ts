/**
 * Crawl4AI client for extracting full article content.
 *
 * Connects to a self-hosted Crawl4AI Docker container via its HTTP API.
 * Uses the /crawl endpoint with full BrowserConfig + CrawlerRunConfig
 * for stealth mode, anti-bot bypass, and resource-blocking hooks.
 *
 * If the container is unavailable, all functions return null gracefully
 * so the rest of the pipeline can fall back to snippet-only mode.
 *
 * HARDENED: Includes URL validation, retry logic, bot-protection detection,
 * stealth mode, resource-blocking, and API token authentication.
 */

import { validateUrl } from "@/lib/utils/validateUrl";

/** Max characters of crawled content to keep for LLM input. */
const MAX_CONTENT_LENGTH = 4000;

/** Timeout for crawl request (ms). Must accommodate Crawl4AI internal retries:
 *  (1 + max_retries) attempts x ~15s each + buffer. */
const CRAWL_TIMEOUT_MS = 60_000;

/**
 * Patterns that indicate bot protection / challenge pages.
 * These pages contain no useful article content.
 */
const BOT_PROTECTION_PATTERNS = [
  // Cloudflare
  /performing security verification/i,
  /cloudflare/i,
  /ray id:/i,
  /please wait while we verify/i,
  /checking your browser/i,
  /enable javascript and cookies/i,
  // Generic bot protection
  /captcha/i,
  /are you a robot/i,
  /bot protection/i,
  /access denied/i,
  /please verify you are human/i,
  /security check/i,
  // Paywall / subscription walls (not bot protection but equally useless)
  /subscribe to continue reading/i,
  /this content is for subscribers only/i,
];

/**
 * Check if content appears to be a bot protection / challenge page.
 * These pages should be rejected as they contain no article content.
 */
function isBotProtectionPage(content: string): boolean {
  // Bot protection pages are usually short
  if (content.length > 5000) return false;

  // Check for multiple indicators (more reliable than single pattern)
  let matchCount = 0;
  for (const pattern of BOT_PROTECTION_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++;
      if (matchCount >= 2) return true; // Two matches = likely bot protection
    }
  }

  // Special case: Cloudflare has very distinctive markers
  if (/cloudflare/i.test(content) && /ray id:/i.test(content)) {
    return true;
  }

  return false;
}

function getBaseUrl(): string {
  return process.env.CRAWL4AI_API_URL || "http://localhost:11235";
}

function getApiToken(): string | undefined {
  return process.env.CRAWL4AI_API_TOKEN;
}

/**
 * Shape of a single result in the /crawl endpoint response.
 * The markdown field can be a string OR an object with raw_markdown.
 */
interface Crawl4AICrawlResultItem {
  url: string;
  success: boolean;
  markdown?: string | { raw_markdown: string };
  error_message?: string;
  status_code?: number;
}

/**
 * Shape of the Crawl4AI /crawl endpoint response.
 */
interface Crawl4AICrawlResponse {
  success: boolean;
  results?: Crawl4AICrawlResultItem[];
  error?: string;
}

/** Result type for crawlArticleContent */
export interface CrawlResult {
  data: string | null;
  error: string | null;
}

/**
 * Python code for resource-blocking hooks.
 * Blocks images, fonts, stylesheets, media, and tracking scripts
 * to save ~30-50% memory per page on the 4GB VPS.
 *
 * Hook: on_page_context_created — fires after browser context is created
 * but before page navigation. Routes are set on `context` (not `page`)
 * so they apply to all frames and popups within the context.
 */
const RESOURCE_BLOCKING_HOOK = `
async def on_page_context_created(page, context, **kwargs):
    async def block_resources(route, request):
        blocked = ["image", "media", "font", "stylesheet"]
        if request.resource_type in blocked:
            await route.abort()
            return
        url = request.url.lower()
        blocked_domains = [
            "google-analytics.com", "googletagmanager.com",
            "facebook.net", "doubleclick.net", "adservice.google",
            "analytics.", "tracker.", "pixel.", "ads."
        ]
        for domain in blocked_domains:
            if domain in url:
                await route.abort()
                return
        await route.continue_()
    await context.route("**/*", block_resources)
`;

/**
 * Build the /crawl request body with full BrowserConfig + CrawlerRunConfig.
 * Optimized for anti-bot bypass on Indonesian news sites (detik, kompas, tribun, etc.)
 * and memory-constrained 4GB VPS.
 */
function buildCrawlRequestBody(url: string): Record<string, unknown> {
  return {
    urls: [url],
    browser_config: {
      headless: true,
      text_mode: true,
      user_agent_mode: "random",
      // Critical: enables playwright-stealth to modify browser fingerprints
      // (navigator.webdriver, chrome.runtime, permissions, plugins, etc.)
      enable_stealth: true,
      extra_args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--js-flags=--max-old-space-size=256",
      ],
    },
    crawler_config: {
      // Anti-bot / stealth settings
      magic: true,
      simulate_user: true,
      wait_until: "load",
      delay_before_return_html: 1.0,

      // Crawl4AI internal anti-bot retry: detects Cloudflare challenge pages,
      // Akamai blocks, CAPTCHA injection, etc. and retries with escalation.
      // (1 + max_retries) attempts total per URL.
      max_retries: 2,

      // Content extraction settings
      word_count_threshold: 30,
      excluded_tags: [
        "nav", "footer", "header", "aside", "script",
        "style", "noscript", "iframe",
      ],
      remove_overlay_elements: true,

      // Markdown generation
      markdown_generator: {
        content_filter: {
          fit_markdown: true,
        },
      },

      // Page timeout (ms) - longer for stealth mode
      page_timeout: 30000,

      // Verbose for debugging (can disable later)
      verbose: false,
    },
    // Resource-blocking hooks
    hooks: {
      on_page_context_created: RESOURCE_BLOCKING_HOOK,
    },
  };
}

/**
 * Extract markdown string from the /crawl response.
 * Handles the polymorphic markdown field (string | { raw_markdown: string }).
 */
function extractMarkdownFromResponse(
  response: Crawl4AICrawlResponse,
): { markdown: string | null; error: string | null } {
  if (!response.success) {
    return {
      markdown: null,
      error: response.error ?? "Crawl request failed",
    };
  }

  if (!response.results || response.results.length === 0) {
    return { markdown: null, error: "No results returned" };
  }

  const result = response.results[0];

  if (!result.success) {
    return {
      markdown: null,
      error: result.error_message ?? `HTTP ${result.status_code ?? "unknown"}`,
    };
  }

  // Crawl4AI returns HTTP 200 for the API call itself, but the *target site*
  // status code is inside result.status_code. A 403/5xx from the target
  // means we got a block page, not article content.
  if (result.status_code && result.status_code >= 400) {
    return {
      markdown: null,
      error: `Target site returned HTTP ${result.status_code}`,
    };
  }

  // Handle polymorphic markdown field
  let markdown: string | null = null;

  if (typeof result.markdown === "string") {
    markdown = result.markdown;
  } else if (
    result.markdown &&
    typeof result.markdown === "object" &&
    "raw_markdown" in result.markdown
  ) {
    markdown = result.markdown.raw_markdown;
  }

  if (!markdown || markdown.trim().length === 0) {
    return { markdown: null, error: "Empty markdown returned" };
  }

  return { markdown: markdown.trim(), error: null };
}

/**
 * Crawl a single URL and return its content as clean markdown.
 * Uses the /crawl endpoint with stealth mode, anti-bot hooks, and
 * resource blocking for optimal performance on a 4GB VPS.
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
  const apiToken = getApiToken();

  try {
    // Single fetch — Crawl4AI handles anti-bot retries internally via max_retries.
    // No HTTP-level retry needed; it would compound with internal retries.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

    let response: Response;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth header if token is configured
      if (apiToken) {
        headers["Authorization"] = `Bearer ${apiToken}`;
      }

      response = await fetch(`${baseUrl}/crawl`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildCrawlRequestBody(validatedUrl)),
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errMsg = `Crawl4AI HTTP ${response.status}: ${response.statusText}`;
        console.warn(`[crawler] ${errMsg} for ${validatedUrl}`);
        return { data: null, error: errMsg };
      }
    } catch (fetchErr) {
      clearTimeout(timeout);
      throw fetchErr;
    }

    const json = (await response.json()) as Crawl4AICrawlResponse;

    const { markdown, error: extractError } =
      extractMarkdownFromResponse(json);

    if (extractError || !markdown) {
      const errMsg = extractError ?? "No content extracted";
      console.warn(`[crawler] Crawl failed for ${validatedUrl}: ${errMsg}`);
      return { data: null, error: errMsg };
    }

    if (markdown.length < 50) {
      const errMsg = "Content too short or empty";
      console.warn(`[crawler] ${errMsg} for ${validatedUrl}`);
      return { data: null, error: errMsg };
    }

    // Check for bot protection / challenge pages
    if (isBotProtectionPage(markdown)) {
      const errMsg = "Bot protection detected (Cloudflare/CAPTCHA)";
      console.warn(`[crawler] ${errMsg} for ${validatedUrl}`);
      return { data: null, error: errMsg };
    }

    // Truncate to MAX_CONTENT_LENGTH for LLM consumption.
    const content =
      markdown.length > MAX_CONTENT_LENGTH
        ? markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[content truncated]"
        : markdown;

    console.log(
      `[crawler] Successfully crawled ${validatedUrl} (${content.length} chars)`,
    );
    return { data: content, error: null };
  } catch (err) {
    let errorMsg: string;

    if (err instanceof DOMException && err.name === "AbortError") {
      errorMsg = `Timeout after ${CRAWL_TIMEOUT_MS}ms`;
    } else if (err instanceof Error) {
      // Check for connection refused (Crawl4AI not running)
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed")
      ) {
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
    const headers: Record<string, string> = {};
    const apiToken = getApiToken();
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    const response = await fetch(`${getBaseUrl()}/health`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
