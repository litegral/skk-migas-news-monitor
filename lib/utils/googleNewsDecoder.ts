/**
 * Google News URL Decoder
 *
 * Decodes Google News article URLs to extract the original source URLs.
 *
 * Uses a two-step approach:
 * 1. Direct base64 decoding (instant, no HTTP request) - works for most URLs
 * 2. Falls back to Google's batchexecute API only for "AU_yqL" prefixed URLs
 *
 * Based on: https://github.com/SSujitX/google-news-url-decoder (v2 algorithm)
 */

import * as cheerio from "cheerio";

/** Timeout for HTTP requests (10 seconds) */
const REQUEST_TIMEOUT_MS = 10_000;

/** Result type for decode operations */
export interface DecodeResult {
  status: boolean;
  decodedUrl?: string;
  error?: string;
  /** Whether the URL was decoded directly (no HTTP request) */
  directDecode?: boolean;
}

/**
 * Extracts the base64 string from a Google News URL.
 *
 * @param sourceUrl - The Google News article URL.
 * @returns Object with status and base64Str if successful.
 */
function getBase64Str(sourceUrl: string): { status: boolean; base64Str?: string; error?: string } {
  try {
    const url = new URL(sourceUrl);
    const pathParts = url.pathname.split("/");

    // Check if it's a valid Google News URL
    if (
      url.hostname === "news.google.com" &&
      pathParts.length > 1 &&
      ["articles", "read", "rss"].some((segment) => pathParts.includes(segment))
    ) {
      // Get the last non-empty path segment (the base64 encoded part)
      const base64Str = pathParts.filter((p) => p && p !== "rss" && p !== "articles" && p !== "read").pop();
      if (base64Str) {
        return { status: true, base64Str };
      }
    }

    return { status: false, error: "Invalid Google News URL format." };
  } catch (error) {
    return {
      status: false,
      error: `Error parsing URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Attempts to decode the URL directly from the base64 string.
 * This works for older Google News URLs where the actual URL is embedded.
 *
 * @param base64Str - The base64 string from the Google News URL.
 * @returns The decoded URL if successful, or null if it needs API decoding.
 */
function decodeBase64Direct(base64Str: string): string | null {
  try {
    // Add padding and decode as URL-safe base64
    // Node.js Buffer handles URL-safe base64 with "base64url" encoding
    const paddedBase64 = base64Str + "==";
    const decoded = Buffer.from(paddedBase64, "base64url").toString("latin1");

    // Known prefix and suffix bytes that Google uses
    const prefix = "\x08\x13\x22";
    const suffix = "\xd2\x01\x00";

    let result = decoded;

    // Remove prefix if present
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
    }

    // Remove suffix if present
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
    }

    // Extract URL using length byte
    const bytes = Buffer.from(result, "latin1");
    if (bytes.length === 0) {
      return null;
    }

    const length = bytes[0];

    // Handle variable-length encoding
    if (length >= 0x80) {
      // Two-byte length encoding
      result = result.slice(2, length + 1);
    } else {
      // Single-byte length encoding
      result = result.slice(1, length + 1);
    }

    // If it starts with "AU_yqL", we need the API call
    if (result.startsWith("AU_yqL")) {
      return null;
    }

    // Validate that the result looks like a URL
    if (result.startsWith("http://") || result.startsWith("https://")) {
      return result;
    }

    // Not a valid URL, need API decode
    return null;
  } catch {
    // Any error means we should fall back to API
    return null;
  }
}

/**
 * Fetches the decoded URL using Google's batchexecute API.
 * This is the fallback method for URLs that can't be decoded directly.
 *
 * @param base64Str - The base64 string from the Google News URL.
 * @returns Object with decodedUrl if successful.
 */
async function fetchDecodedBatchExecute(base64Str: string): Promise<DecodeResult> {
  try {
    const url = "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je";

    // Build the request payload (format from v2 decoder)
    const payload =
      '[[["Fbv4je","[\\"garturlreq\\",[[\\"en-US\\",\\"US\\",[\\"FINANCE_TOP_INDICES\\",\\"WEB_TEST_1_0_0\\"],' +
      'null,null,1,1,\\"US:en\\",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],' +
      '\\"en-US\\",\\"US\\",1,[2,3,4,8],1,0,\\"655000234\\",0,0,null,0],\\"' +
      base64Str +
      '\\"]",null,"generic"]]]';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        Referer: "https://news.google.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: `f.req=${encodeURIComponent(payload)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        directDecode: false,
      };
    }

    const text = await response.text();

    // Parse the response to extract the URL
    const header = '[\\"garturlres\\",\\"';
    const footer = '\\",';

    if (!text.includes(header)) {
      return {
        status: false,
        error: "Header not found in Google response",
        directDecode: false,
      };
    }

    const start = text.split(header)[1];
    if (!start || !start.includes(footer)) {
      return {
        status: false,
        error: "Footer not found in Google response",
        directDecode: false,
      };
    }

    const decodedUrl = start.split(footer)[0];

    if (!decodedUrl || typeof decodedUrl !== "string") {
      return {
        status: false,
        error: "Decoded URL is invalid",
        directDecode: false,
      };
    }

    return { status: true, decodedUrl, directDecode: false };
  } catch (error) {
    return {
      status: false,
      error: `API decode error: ${error instanceof Error ? error.message : "Unknown error"}`,
      directDecode: false,
    };
  }
}

/**
 * Fetches signature and timestamp required for decoding from Google News.
 * This is an alternative method that uses HTML scraping.
 *
 * @param base64Str - The base64 string extracted from the Google News URL.
 * @returns Object with signature, timestamp, and base64Str if successful.
 */
async function getDecodingParams(
  base64Str: string
): Promise<{ status: boolean; signature?: string; timestamp?: string; base64Str?: string; error?: string }> {
  const urls = [
    `https://news.google.com/rss/articles/${base64Str}`,
    `https://news.google.com/articles/${base64Str}`,
  ];

  for (const articleUrl of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(articleUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Look for the data attributes in c-wiz element
      const dataElement = $("c-wiz > div[jscontroller]");

      if (dataElement.length) {
        const signature = dataElement.attr("data-n-a-sg");
        const timestamp = dataElement.attr("data-n-a-ts");

        if (signature && timestamp) {
          return { status: true, signature, timestamp, base64Str };
        }
      }
    } catch {
      // Try next URL
      continue;
    }
  }

  return { status: false, error: "Failed to fetch decoding parameters from Google News." };
}

/**
 * Decodes the Google News URL using the signature and timestamp.
 * This is an alternative method that uses the v1 API format.
 *
 * @param signature - The signature required for decoding.
 * @param timestamp - The timestamp required for decoding.
 * @param base64Str - The base64 string from the Google News URL.
 * @returns Object with decodedUrl if successful.
 */
async function decodeUrlWithParams(
  signature: string,
  timestamp: string,
  base64Str: string
): Promise<DecodeResult> {
  try {
    const url = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

    const payload = [
      "Fbv4je",
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${timestamp},"${signature}"]`,
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: false, error: `HTTP ${response.status}: ${response.statusText}`, directDecode: false };
    }

    const responseText = await response.text();

    // Parse the response - it's a weird format with multiple lines
    const lines = responseText.split("\n\n");
    if (lines.length < 2) {
      return { status: false, error: "Invalid response format from Google", directDecode: false };
    }

    // Parse the JSON data
    const jsonData = JSON.parse(lines[1]);
    const parsedData = jsonData.slice(0, -2);

    if (!parsedData[0] || !parsedData[0][2]) {
      return { status: false, error: "Could not extract URL from response", directDecode: false };
    }

    const decodedUrl = JSON.parse(parsedData[0][2])[1];

    if (!decodedUrl || typeof decodedUrl !== "string") {
      return { status: false, error: "Decoded URL is invalid", directDecode: false };
    }

    return { status: true, decodedUrl, directDecode: false };
  } catch (error) {
    return {
      status: false,
      error: `Decode error: ${error instanceof Error ? error.message : "Unknown error"}`,
      directDecode: false,
    };
  }
}

/**
 * Decodes a Google News article URL into its original source URL.
 *
 * Uses a two-step approach:
 * 1. Try direct base64 decoding first (instant, no HTTP request)
 * 2. Fall back to Google's API only if direct decode fails
 *
 * @param sourceUrl - The Google News article URL.
 * @returns Object with decodedUrl if successful, or error message.
 */
export async function decodeGoogleNewsUrl(sourceUrl: string): Promise<DecodeResult> {
  try {
    // Check if this is a Google News URL
    if (!sourceUrl.includes("news.google.com")) {
      return { status: true, decodedUrl: sourceUrl, directDecode: true };
    }

    // Step 1: Extract base64 string
    const base64Response = getBase64Str(sourceUrl);
    if (!base64Response.status || !base64Response.base64Str) {
      return { status: false, error: base64Response.error };
    }

    const base64Str = base64Response.base64Str;

    // Step 2: Try direct base64 decoding first (instant, no HTTP request)
    const directDecoded = decodeBase64Direct(base64Str);
    if (directDecoded) {
      return { status: true, decodedUrl: directDecoded, directDecode: true };
    }

    // Step 3: Fall back to API methods for AU_yqL URLs
    // Try v2 method first (simpler API call)
    const v2Result = await fetchDecodedBatchExecute(base64Str);
    if (v2Result.status && v2Result.decodedUrl) {
      return v2Result;
    }

    // Try v1 method as final fallback (requires fetching signature first)
    const paramsResponse = await getDecodingParams(base64Str);
    if (paramsResponse.status && paramsResponse.signature && paramsResponse.timestamp) {
      const v1Result = await decodeUrlWithParams(
        paramsResponse.signature,
        paramsResponse.timestamp,
        base64Str
      );
      if (v1Result.status && v1Result.decodedUrl) {
        return v1Result;
      }
    }

    // All methods failed
    return {
      status: false,
      error: v2Result.error || paramsResponse.error || "All decode methods failed",
      directDecode: false,
    };
  } catch (error) {
    return {
      status: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Batch decode multiple Google News URLs with rate limiting.
 * Only applies delay for URLs that require API calls.
 *
 * @param urls - Array of Google News URLs to decode.
 * @param delayMs - Delay between API requests in milliseconds (default: 100ms).
 * @returns Array of decode results in the same order as input.
 */
export async function batchDecodeGoogleNewsUrls(
  urls: string[],
  delayMs = 100
): Promise<DecodeResult[]> {
  const results: DecodeResult[] = [];
  let lastApiCallTime = 0;

  for (let i = 0; i < urls.length; i++) {
    const result = await decodeGoogleNewsUrl(urls[i]);
    results.push(result);

    // Only add delay after API calls (not after direct decodes)
    if (!result.directDecode && i < urls.length - 1 && delayMs > 0) {
      const timeSinceLastApi = Date.now() - lastApiCallTime;
      if (timeSinceLastApi < delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs - timeSinceLastApi));
      }
      lastApiCallTime = Date.now();
    }
  }

  return results;
}
