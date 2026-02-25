/**
 * RSS feed service.
 *
 * Fetches and parses RSS/Atom feeds using the `rss-parser` library,
 * then normalizes each item into the app's `Article` shape.
 *
 * HARDENED: Includes URL validation, retry logic, and proper error returns.
 */

import Parser from "rss-parser";
import type { Article } from "@/lib/types/news";
import { validateUrl } from "@/lib/utils/validateUrl";
import { withRetry } from "@/lib/utils/withRetry";
import { validateString } from "@/lib/utils/validateInput";

/**
 * Reusable parser instance. `rss-parser` is stateless per-parse,
 * so a single instance is safe across concurrent calls.
 */
const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "SKKMigasNewsMonitor/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
    ],
  },
});

/**
 * Custom item type reflecting possible extra fields from RSS feeds.
 */
interface RSSItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  /** Full HTML content (common in WordPress feeds). */
  "content:encoded"?: string;
  /** ISO date string or free-form date. */
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  categories?: string[] | Array<{ _: string }>;
  enclosure?: { url?: string };
  mediaContent?: { $?: { url?: string } };
  mediaThumbnail?: { $?: { url?: string } };
}

/** Result type for fetchRSSFeedArticles */
export interface RSSFetchResult {
  data: Article[];
  error: string | null;
}

/**
 * Fetch and parse a single RSS feed, returning normalised `Article` objects.
 *
 * @param feedUrl  - The RSS/Atom feed URL.
 * @param feedName - Human-readable feed name (used as `sourceName`).
 * @returns Result object with data array and optional error message.
 */
export async function fetchRSSFeedArticles(
  feedUrl: string,
  feedName: string,
): Promise<RSSFetchResult> {
  // Validate URL
  const urlValidation = validateUrl(feedUrl);
  if (!urlValidation.valid) {
    return { data: [], error: `Invalid URL: ${urlValidation.error}` };
  }
  const validatedUrl = urlValidation.normalizedUrl!;

  // Validate feed name
  const nameValidation = validateString(feedName, "Feed name", {
    minLength: 1,
    maxLength: 100,
  });
  if (!nameValidation.valid) {
    return { data: [], error: nameValidation.error! };
  }
  const validatedName = nameValidation.value!;

  try {
    const feed = await withRetry(
      async () => {
        return await parser.parseURL(validatedUrl);
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: (error, attempt, delayMs) => {
          console.warn(
            `[rss] Attempt ${attempt} failed for "${validatedName}" (${validatedUrl}), retrying in ${delayMs}ms:`,
            error instanceof Error ? error.message : error
          );
        },
      }
    );

    const articles = (feed.items as RSSItem[])
      .filter((item): item is RSSItem & { title: string; link: string } =>
        Boolean(item.title && item.link),
      )
      .map((item) => normalizeItem(item, validatedName, validatedUrl));

    console.log(`[rss] Fetched ${articles.length} articles from "${validatedName}"`);
    return { data: articles, error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
    console.error(`[rss] Failed to parse feed "${validatedName}" (${validatedUrl}):`, errorMsg);
    return { data: [], error: errorMsg };
  }
}

/**
 * Map an RSS item to the normalised `Article` shape.
 */
function normalizeItem(
  item: RSSItem & { title: string; link: string },
  feedName: string,
  feedUrl: string,
): Article {
  return {
    title: item.title,
    link: item.link,
    snippet: extractSnippet(item),
    photoUrl: extractPhoto(item),
    sourceName: feedName,
    sourceUrl: feedUrl,
    publishedAt: normalizeDate(item.isoDate ?? item.pubDate),
    sourceType: "rss",
    summary: null,
    sentiment: null,
    categories: null,
    aiProcessed: false,
    matchedTopicIds: [], // Will be populated by filterArticlesByTopics
  };
}

/**
 * Pull the best available text snippet from the RSS item.
 * Prefer `contentSnippet` (text-only) > `content:encoded` stripped > `content`.
 */
function extractSnippet(item: RSSItem): string | null {
  if (item.contentSnippet) return item.contentSnippet.slice(0, 500);

  // content:encoded often has full HTML — strip tags for a snippet.
  const encoded = item["content:encoded"];
  if (encoded) return stripHtml(encoded).slice(0, 500) || null;

  if (item.content) return stripHtml(item.content).slice(0, 500) || null;

  return null;
}

/**
 * Try to find a thumbnail / photo URL from the RSS item.
 */
function extractPhoto(item: RSSItem): string | null {
  // Enclosure (podcast/media style)
  if (item.enclosure?.url) return item.enclosure.url;
  // media:content or media:thumbnail
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  return null;
}

/**
 * Naive HTML tag stripper. Good enough for snippet extraction.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a date string into ISO 8601 format.
 */
function normalizeDate(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// ============================================================================
// Topic Filtering
// ============================================================================

export interface TopicForFiltering {
  id: string;
  name: string;
  /** Keywords for OR-based matching. Topics with no keywords are skipped. */
  keywords: string[];
}

/**
 * Filter articles to keep only those that match at least one topic keyword.
 * 
 * Matching logic:
 * - Topics with empty keywords array are skipped
 * - Match if ANY keyword phrase is found in title/snippet (OR logic)
 * - Case-insensitive substring matching (exact phrase match)
 *
 * @param articles - Array of articles to filter.
 * @param topics - Array of topics (with IDs) to match against.
 * @returns Filtered articles with matched_topic_ids field populated.
 */
export function filterArticlesByTopics(
  articles: Article[],
  topics: TopicForFiltering[],
): Article[] {
  // Filter to only topics that have keywords defined
  const topicsWithKeywords = topics.filter((t) => t.keywords.length > 0);

  if (topicsWithKeywords.length === 0) {
    console.warn("[rss] No topics with keywords provided for filtering, returning empty array");
    return [];
  }

  const filteredArticles: Article[] = [];

  for (const article of articles) {
    const matchedTopicIds: string[] = [];

    // Combine searchable text (title + snippet)
    const searchableText = [
      article.title,
      article.snippet ?? "",
    ].join(" ").toLowerCase();

    // Check each topic
    for (const topic of topicsWithKeywords) {
      // OR logic: match if ANY keyword phrase is found (case-insensitive substring)
      const matched = topic.keywords.some((keyword) => {
        return searchableText.includes(keyword.toLowerCase());
      });

      if (matched) {
        matchedTopicIds.push(topic.id);
      }
    }

    // Only include articles that matched at least one topic
    if (matchedTopicIds.length > 0) {
      filteredArticles.push({
        ...article,
        matchedTopicIds,
      });
    }
  }

  console.log(`[rss] Filtered ${articles.length} articles down to ${filteredArticles.length} matching topics`);
  return filteredArticles;
}
