/**
 * Google News RSS service.
 *
 * Fetches news articles from Google News RSS search endpoint and normalizes
 * them into the app's `Article` shape.
 *
 * URL pattern: https://news.google.com/rss/search?q={query}&hl=id&gl=ID&ceid=ID:id
 *
 * Key features:
 * - Uses existing rss-parser library
 * - Decodes Google News article URLs to get actual article URLs via Google's API
 * - Normalizes articles to our Article type
 * - Free, no API key required
 */

import Parser from "rss-parser";
import type { Article } from "@/lib/types/news";
import { validateString } from "@/lib/utils/validateInput";
import { decodeGoogleNewsUrl } from "@/lib/utils/googleNewsDecoder";

/**
 * Google News RSS base URL for search queries.
 * Parameters:
 *   - q: URL-encoded search query
 *   - hl: Language (id = Indonesian)
 *   - gl: Country (ID = Indonesia)
 *   - ceid: Locale identifier
 */
const GOOGLE_NEWS_RSS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_PARAMS = "hl=id&gl=ID&ceid=ID:id";

/** Delay between URL decode requests to avoid rate limiting (ms) */
const DECODE_DELAY_MS = 100;

/** Sleep utility function */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reusable parser instance for Google News RSS feeds.
 */
const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
});

/**
 * Shape of a Google News RSS item.
 */
interface GoogleNewsItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  source?: { title?: string; url?: string } | string;
}

/** Result type for fetchGoogleNewsArticles */
export interface GoogleNewsFetchResult {
  data: Article[];
  error: string | null;
}

/**
 * Fetch news articles from Google News RSS for a given search query.
 *
 * @param query - The search query string (e.g., "SKK Migas Kalsul").
 * @param options.topicName - Topic name to tag articles with (for matched_topics).
 * @returns Result object with data array and optional error message.
 */
export async function fetchGoogleNewsArticles(
  query: string,
  { topicName }: { topicName?: string } = {},
): Promise<GoogleNewsFetchResult> {
  // Validate query input
  const queryValidation = validateString(query, "Search query", {
    minLength: 1,
    maxLength: 200,
  });
  if (!queryValidation.valid) {
    return { data: [], error: queryValidation.error! };
  }
  const validatedQuery = queryValidation.value!;

  // Build RSS URL
  const encodedQuery = encodeURIComponent(validatedQuery);
  const rssUrl = `${GOOGLE_NEWS_RSS_BASE}?q=${encodedQuery}&${GOOGLE_NEWS_PARAMS}`;

  try {
    const feed = await parser.parseURL(rssUrl);

    if (!feed.items || feed.items.length === 0) {
      console.log(`[googlenews] No articles found for query "${validatedQuery}"`);
      return { data: [], error: null };
    }

    // Process articles and resolve redirect URLs
    const articles: Article[] = [];
    const validItems = (feed.items as GoogleNewsItem[]).filter(
      (item) => item.title && item.link
    );

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];

      // Resolve the Google News redirect URL to get the actual article URL
      const resolvedUrl = await resolveGoogleNewsUrl(item.link!);

      // Extract source info from the title (Google News format: "Title - Source Name")
      const { title, sourceName } = parseGoogleNewsTitle(item.title!);

      articles.push({
        title,
        link: resolvedUrl,
        snippet: item.contentSnippet ?? item.content ?? null,
        photoUrl: null, // Google News RSS doesn't include images
        sourceName,
        sourceUrl: null,
        publishedAt: normalizeDate(item.isoDate ?? item.pubDate),
        sourceType: "googlenews",
        summary: null,
        sentiment: null,
        categories: null,
        aiProcessed: false,
        matchedTopics: topicName ? [topicName] : [],
      });

      // Add delay between decode requests to avoid rate limiting
      if (i < validItems.length - 1) {
        await sleep(DECODE_DELAY_MS);
      }
    }

    console.log(
      `[googlenews] Fetched ${articles.length} articles for query "${validatedQuery}"${topicName ? ` (topic: ${topicName})` : ""}`,
    );
    return { data: articles, error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
    console.error(`[googlenews] Failed to fetch for query "${validatedQuery}":`, errorMsg);
    return { data: [], error: errorMsg };
  }
}

/**
 * Resolve a Google News article URL to get the actual source article URL.
 *
 * Uses the googleNewsDecoder utility which calls Google's API to decode URLs.
 *
 * @param googleUrl - The Google News encoded URL.
 * @returns The decoded actual article URL, or the original URL if decoding fails.
 */
async function resolveGoogleNewsUrl(googleUrl: string): Promise<string> {
  try {
    const result = await decodeGoogleNewsUrl(googleUrl);

    if (result.status && result.decodedUrl) {
      return result.decodedUrl;
    }

    // If decoding failed, log and return original
    console.warn(`[googlenews] Could not decode URL: ${result.error || "Unknown error"}`);
    return googleUrl;
  } catch (err) {
    console.warn(
      `[googlenews] URL decode error for ${googleUrl}:`,
      err instanceof Error ? err.message : err,
    );
    return googleUrl;
  }
}

/**
 * Parse Google News title to extract the actual title and source name.
 *
 * Google News titles are formatted as: "Article Title - Source Name"
 * We split on the last " - " to separate title from source.
 *
 * @param fullTitle - The full title from Google News RSS.
 * @returns Object with separated title and sourceName.
 */
function parseGoogleNewsTitle(fullTitle: string): { title: string; sourceName: string | null } {
  const lastDashIndex = fullTitle.lastIndexOf(" - ");

  if (lastDashIndex === -1) {
    return { title: fullTitle, sourceName: null };
  }

  return {
    title: fullTitle.slice(0, lastDashIndex).trim(),
    sourceName: fullTitle.slice(lastDashIndex + 3).trim(),
  };
}

/**
 * Parse a date string into ISO 8601 format.
 */
function normalizeDate(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
