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
 *
 * Proxies: optional multiline CRAWL4AI_PROXY_URLS (Webshare host:port:user:pass or URLs);
 * round-robin picks one proxy per crawl after "direct". See buildProxyConfigForCrawler.
 */

import { validateUrl } from "@/lib/utils/validateUrl";

/** Max characters of crawled content to keep for LLM input. */
const MAX_CONTENT_LENGTH = 4000;

/** Default timeout when crawling direct-only (ms). */
const CRAWL_TIMEOUT_MS_DEFAULT = 60_000;

/** Longer timeout when using direct-then-proxy escalation (more attempts). */
const CRAWL_TIMEOUT_MS_WITH_PROXY = 120_000;

/** Crawl4AI service may return transient 5xx; retry POST before snippet fallback. */
const CRAWL4AI_RETRYABLE_HTTP = new Set([500, 502, 503, 504]);
const MAX_CRAWL4AI_HTTP_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Round-robin index for loadProxiesFromEnv() list (module scope). */
let proxyRoundRobinIndex = 0;

/**
 * Parse one proxy line: URL with scheme, or Webshare `host:port:username:password`.
 * Returns Crawl4AI-compatible { server, username?, password? } or null.
 */
function parseProxyEntry(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    try {
      const u = new URL(trimmed);
      const hasAuth = Boolean(u.username || u.password);
      return {
        server: `${u.protocol}//${u.host}`,
        ...(hasAuth
          ? {
            username: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
          }
          : {}),
      };
    } catch {
      return null;
    }
  }

  // Webshare list export: host:port:username:password (host may be domain or IPv4 dotted)
  const m = trimmed.match(/^(.+):(\d+):([^:]+):(.+)$/);
  if (!m) return null;
  const [, host, port, username, password] = m;
  return {
    server: `http://${host}:${port}`,
    username,
    password,
  };
}

/**
 * Load proxy dicts from CRAWL4AI_PROXY_URLS (multiline or comma-separated),
 * else fall back to CRAWL4AI_PROXY_URL / CRAWL4AI_PROXY_SERVER.
 */
function loadProxiesFromEnv(): Record<string, string>[] {
  const raw = process.env.CRAWL4AI_PROXY_URLS?.trim();
  const out: Record<string, string>[] = [];

  if (raw) {
    const tokens = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const t of tokens) {
      const p = parseProxyEntry(t);
      if (p) out.push(p);
    }
  }

  if (out.length > 0) return out;

  const proxyUrl = process.env.CRAWL4AI_PROXY_URL?.trim();
  const server = process.env.CRAWL4AI_PROXY_SERVER?.trim();
  const username = process.env.CRAWL4AI_PROXY_USERNAME?.trim();
  const password = process.env.CRAWL4AI_PROXY_PASSWORD?.trim();

  if (proxyUrl) {
    const normalized = proxyUrl.includes("://") ? proxyUrl : `http://${proxyUrl}`;
    const p = parseProxyEntry(normalized);
    if (p) return [p];
  }

  if (server) {
    return [
      {
        server,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
      },
    ];
  }

  return [];
}

/**
 * Build CrawlerRunConfig.proxy_config: direct first, then one proxy (round-robin).
 * See https://docs.crawl4ai.com/advanced/anti-bot-and-fallback/
 *
 * Env (optional):
 * - CRAWL4AI_PROXY_URLS — multiline or comma-separated; Webshare lines or http:// URLs
 * - CRAWL4AI_PROXY_URL — single URL (legacy)
 * - CRAWL4AI_PROXY_SERVER + CRAWL4AI_PROXY_USERNAME + CRAWL4AI_PROXY_PASSWORD (legacy)
 * - CRAWL4AI_USE_PROXY=false — force direct-only
 */
// Notice the return type changed to Record<string, string> | undefined
function buildProxyConfigForCrawler(): Record<string, string> | undefined {
  const optOut = process.env.CRAWL4AI_USE_PROXY;
  if (optOut === "0" || optOut === "false") {
    return undefined;
  }

  const proxies = loadProxiesFromEnv();
  if (proxies.length === 0) {
    return undefined;
  }

  const i = proxyRoundRobinIndex % proxies.length;
  proxyRoundRobinIndex += 1;

  // Return ONLY the proxy object, not the array
  return proxies[i];
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
 *
 * @param proxyConfig - If set, Crawl4AI tries `direct` first, then one round-robin proxy.
 */
function buildCrawlRequestBody(
  url: string,
  proxyConfig: Record<string, string> | undefined, 
): Record<string, unknown> {
  return {
    urls: [url],
    
    // 1. BROWSER CONFIG
    browser_config: {
      type: "BrowserConfig",
      params: {
        headless: true,
        extra_args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    },

    // 2. CRAWLER CONFIG (This is where the Proxy goes in v0.8!)
    crawler_config: {
      type: "CrawlerRunConfig",
      params: {
        magic: true, // Bypasses Cloudflare
        simulate_user: true,
        page_timeout: 60000,
        delay_before_return_html: 5.0, // Wait for overlays to close
        
        // Safely inject the Webshare proxy dictionary
        ...(proxyConfig ? { proxy_config: proxyConfig } : {}),
      },
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

  console.log(`[debug] Target Crawl4AI URL: ${baseUrl}`);
  console.log(`[debug] Token loaded: ${apiToken ? `YES (Length: ${apiToken.length})` : "NO (It is undefined/empty!)"}`);

  const proxyConfig = buildProxyConfigForCrawler();
  const crawlTimeoutMs = proxyConfig
    ? CRAWL_TIMEOUT_MS_WITH_PROXY
    : CRAWL_TIMEOUT_MS_DEFAULT;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    if (proxyConfig) {
      console.log(
        "[crawler] Using direct-first proxy escalation (see Crawl4AI anti-bot docs)",
      );
    }

    let response: Response | undefined;

    for (let attempt = 0; attempt < MAX_CRAWL4AI_HTTP_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), crawlTimeoutMs);

      try {
        response = await fetch(`${baseUrl}/crawl`, {
          method: "POST",
          headers,
          body: JSON.stringify(buildCrawlRequestBody(validatedUrl, proxyConfig)),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        throw fetchErr;
      }
      clearTimeout(timeout);

      if (response.ok) {
        break;
      }

      // 4xx/5xx here is from the Crawl4AI *service* (POST /crawl), not the news site.
      let errMsg = `Crawl4AI HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 401 || response.status === 403) {
        errMsg +=
          " (check CRAWL4AI_API_TOKEN matches the container and that /crawl allows your client)";
      }

      const canRetry =
        CRAWL4AI_RETRYABLE_HTTP.has(response.status) &&
        attempt < MAX_CRAWL4AI_HTTP_ATTEMPTS - 1;

      if (!canRetry) {
        console.warn(`[crawler] ${errMsg} — target was ${validatedUrl}`);
        return { data: null, error: errMsg };
      }

      const delayMs = 500 * 2 ** attempt + Math.floor(Math.random() * 200);
      console.warn(
        `[crawler] ${errMsg} — retry ${attempt + 1}/${MAX_CRAWL4AI_HTTP_ATTEMPTS - 1} in ${delayMs}ms, target=${validatedUrl}`,
      );
      await sleep(delayMs);
    }

    if (!response?.ok) {
      return { data: null, error: "Crawl4AI request failed" };
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
      errorMsg = `Timeout after ${crawlTimeoutMs}ms`;
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
