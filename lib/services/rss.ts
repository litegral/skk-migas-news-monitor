/**
 * RSS feed service.
 *
 * Fetches and parses RSS/Atom feeds using the `rss-parser` library,
 * then normalizes each item into the app's `Article` shape.
 */

import Parser from "rss-parser";
import type { Article } from "@/lib/types/news";

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

/**
 * Fetch and parse a single RSS feed, returning normalised `Article` objects.
 *
 * @param feedUrl  - The RSS/Atom feed URL.
 * @param feedName - Human-readable feed name (used as `sourceName`).
 * @returns Array of normalised articles. Empty array on failure.
 */
export async function fetchRSSFeedArticles(
  feedUrl: string,
  feedName: string,
): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    return (feed.items as RSSItem[])
      .filter((item): item is RSSItem & { title: string; link: string } =>
        Boolean(item.title && item.link),
      )
      .map((item) => normalizeItem(item, feedName, feedUrl));
  } catch (err) {
    console.error(`[rss] Failed to parse feed "${feedName}" (${feedUrl}):`, err);
    return [];
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
