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
export type SourceType = "rapidapi" | "rss";

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
