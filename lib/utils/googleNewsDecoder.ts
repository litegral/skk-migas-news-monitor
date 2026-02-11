/**
 * Google News URL Decoder
 *
 * Decodes Google News article URLs to extract the original source URLs.
 * Google News URLs are encoded and require fetching signature/timestamp
 * from Google's servers to decode.
 *
 * Based on: https://github.com/SSujitX/google-news-url-decoder-nodejs
 */

import * as cheerio from "cheerio";

/** Timeout for HTTP requests (10 seconds) */
const REQUEST_TIMEOUT_MS = 10_000;

/** Result type for decode operations */
export interface DecodeResult {
  status: boolean;
  decodedUrl?: string;
  error?: string;
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
 * Fetches signature and timestamp required for decoding from Google News.
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
    } catch (error) {
      // Try next URL
      continue;
    }
  }

  return { status: false, error: "Failed to fetch decoding parameters from Google News." };
}

/**
 * Decodes the Google News URL using the signature and timestamp.
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
      return { status: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const responseText = await response.text();

    // Parse the response - it's a weird format with multiple lines
    const lines = responseText.split("\n\n");
    if (lines.length < 2) {
      return { status: false, error: "Invalid response format from Google" };
    }

    // Parse the JSON data
    const jsonData = JSON.parse(lines[1]);
    const parsedData = jsonData.slice(0, -2);

    if (!parsedData[0] || !parsedData[0][2]) {
      return { status: false, error: "Could not extract URL from response" };
    }

    const decodedUrl = JSON.parse(parsedData[0][2])[1];

    if (!decodedUrl || typeof decodedUrl !== "string") {
      return { status: false, error: "Decoded URL is invalid" };
    }

    return { status: true, decodedUrl };
  } catch (error) {
    return {
      status: false,
      error: `Decode error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Decodes a Google News article URL into its original source URL.
 *
 * @param sourceUrl - The Google News article URL.
 * @returns Object with decodedUrl if successful, or error message.
 */
export async function decodeGoogleNewsUrl(sourceUrl: string): Promise<DecodeResult> {
  try {
    // Check if this is a Google News URL
    if (!sourceUrl.includes("news.google.com")) {
      return { status: true, decodedUrl: sourceUrl }; // Not a Google News URL, return as-is
    }

    // Step 1: Extract base64 string
    const base64Response = getBase64Str(sourceUrl);
    if (!base64Response.status || !base64Response.base64Str) {
      return { status: false, error: base64Response.error };
    }

    // Step 2: Get decoding parameters (signature & timestamp)
    const paramsResponse = await getDecodingParams(base64Response.base64Str);
    if (!paramsResponse.status || !paramsResponse.signature || !paramsResponse.timestamp) {
      return { status: false, error: paramsResponse.error };
    }

    // Step 3: Decode the URL
    const decodeResponse = await decodeUrlWithParams(
      paramsResponse.signature,
      paramsResponse.timestamp,
      paramsResponse.base64Str!
    );

    return decodeResponse;
  } catch (error) {
    return {
      status: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Batch decode multiple Google News URLs with rate limiting.
 *
 * @param urls - Array of Google News URLs to decode.
 * @param delayMs - Delay between requests in milliseconds (default: 100ms).
 * @returns Array of decode results in the same order as input.
 */
export async function batchDecodeGoogleNewsUrls(
  urls: string[],
  delayMs = 100
): Promise<DecodeResult[]> {
  const results: DecodeResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await decodeGoogleNewsUrl(urls[i]);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    if (i < urls.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
