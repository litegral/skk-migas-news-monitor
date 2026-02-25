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
 * - Stores Google News URLs as-is (URL decoding happens in background)
 * - Normalizes articles to our Article type
 * - Free, no API key required
 *
 * NOTE: URLs are decoded in a separate background process (/api/news/decode/stream)
 * to avoid rate limiting. Articles are stored with url_decoded = false initially.
 */

import Parser from "rss-parser";
import type { Article } from "@/lib/types/news";
import { validateString } from "@/lib/utils/validateInput";

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
 * Articles are stored with their original Google News URLs (url_decoded = false).
 * URL decoding to actual article URLs happens in a background process to avoid
 * rate limiting.
 *
 * @param query - The search query string (e.g., "SKK Migas Kalsul").
 * @param options.topicId - Topic UUID to tag articles with (for matched_topic_ids).
 * @param options.topicName - Topic name (for logging).
 * @returns Result object with data array and optional error message.
 */
export async function fetchGoogleNewsArticles(
  query: string,
  { topicId, topicName }: { topicId?: string; topicName?: string } = {},
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

    // Process articles - keep original Google News URLs (will be decoded in background)
    const articles: Article[] = [];
    const validItems = (feed.items as GoogleNewsItem[]).filter(
      (item) => item.title && item.link
    );

    for (const item of validItems) {
      // Extract source info from the title (Google News format: "Title - Source Name")
      const { title, sourceName } = parseGoogleNewsTitle(item.title!);

      articles.push({
        title,
        link: item.link!, // Keep original Google News URL
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
        matchedTopicIds: topicId ? [topicId] : [],
        urlDecoded: false, // Will be decoded in background process
      });
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
