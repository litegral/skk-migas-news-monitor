/**
 * Domain types for the news monitoring system.
 *
 * These are the application-level shapes used throughout the codebase.
 * They intentionally mirror (but are decoupled from) the database row types
 * so that service code isn't tightly coupled to Supabase column names.
 */

/** Sentiment values returned by the LLM analysis. */
export type Sentiment = "positive" | "negative" | "neutral";

/** Where the article was sourced from. */
export type SourceType = "googlenews" | "rss";

/**
 * Normalised article shape shared by all data sources.
 *
 * RapidAPI results AND RSS items are both mapped to this shape before
 * being upserted into the `articles` table.
 */
export interface Article {
  /** Database UUID (absent for articles not yet persisted). */
  id?: string;
  title: string;
  link: string;
  snippet: string | null;
  photoUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  sourceType: SourceType;

  /** AI-generated fields (null until processed). */
  summary: string | null;
  sentiment: Sentiment | null;
  categories: string[] | null;
  aiProcessed: boolean;

  /** Error tracking for AI analysis failures. */
  aiError?: string | null;
  aiProcessedAt?: string | null;

  /** Full crawled article content (from Crawl4AI). */
  fullContent?: string | null;

  /** Array of topic names that this article matched against. */
  matchedTopics?: string[];

  /** Whether the article URL has been decoded (Google News URLs need decoding). */
  urlDecoded?: boolean;

  /** Whether URL decoding failed (article still marked decoded to prevent retries). */
  decodeFailed?: boolean;

  /** LLM's explanation for why it chose the sentiment/categories. */
  aiReason?: string | null;

  /** Timestamps from database. */
  createdAt?: string;
  updatedAt?: string;
}

/** A user-configured RSS feed source. */
export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A user-configured search query for the RapidAPI news endpoint. */
export interface SearchQuery {
  id: string;
  query: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A user-configured topic for filtering articles. */
export interface Topic {
  id: string;
  name: string;
  /** Keywords for OR-based matching. If empty, topic name is used. */
  keywords: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Standard API response envelope used by all route handlers.
 *
 * Every `app/api/` route returns this shape so the client always knows
 * where to find data vs. errors.
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
