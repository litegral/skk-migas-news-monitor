/**
 * RapidAPI Real-Time News Data service.
 *
 * Fetches news articles from the Real-Time News Data API on RapidAPI
 * and normalizes them into the app's `Article` shape.
 *
 * Endpoint: GET https://real-time-news-data.p.rapidapi.com/search
 * Docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-news-data
 *
 * HARDENED: Includes timeout, retry with exponential backoff, and input validation.
 */

import type { Article } from "@/lib/types/news";
import { fetchWithTimeout, FetchTimeoutError } from "@/lib/utils/fetchWithTimeout";
import { withRetry, httpRetryOptions } from "@/lib/utils/withRetry";
import { validateString } from "@/lib/utils/validateInput";

const API_HOST = "real-time-news-data.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

/** Timeout for RapidAPI requests (30 seconds) */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Shape of a single article from the RapidAPI response.
 * Only the fields we actually use are typed here.
 */
interface RapidAPIArticle {
  title?: string;
  link?: string;
  snippet?: string;
  photo_url?: string;
  source_url?: string;
  source_name?: string;
  /** ISO 8601 datetime string, e.g. "2026-02-10 08:30:00" */
  published_datetime_utc?: string;
}

interface RapidAPIResponse {
  status: string;
  data?: RapidAPIArticle[];
}

/** Result type for fetchRapidAPINews */
export interface RapidAPIFetchResult {
  data: Article[];
  error: string | null;
}

/**
 * Fetch news articles from RapidAPI Real-Time News Data for a given query/topic.
 *
 * @param query  - The search query string (e.g. "SKK Migas Kalsul").
 * @param options.topicName - Topic name to tag articles with (for matched_topics).
 * @param options.limit  - Max number of results (API default is ~10, max varies).
 * @param options.lang   - Language filter (default "id" for Indonesian).
 * @param options.country - Country filter (default "ID" for Indonesia).
 * @returns Result object with data array and optional error message.
 */
export async function fetchRapidAPINews(
  query: string,
  { topicName, limit = 50, lang = "id", country = "ID" }: {
    topicName?: string;
    limit?: number;
    lang?: string;
    country?: string;
  } = {},
): Promise<RapidAPIFetchResult> {
  // Validate query input
  const queryValidation = validateString(query, "Search query", {
    minLength: 1,
    maxLength: 200,
  });
  if (!queryValidation.valid) {
    return { data: [], error: queryValidation.error! };
  }
  const validatedQuery = queryValidation.value!;

  // Validate API key
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.error("[rapidapi] RAPIDAPI_KEY is not set");
    return { data: [], error: "RapidAPI key is not configured" };
  }

  // Validate limit
  const validLimit = Math.min(Math.max(1, limit), 100);

  const params = new URLSearchParams({
    query: validatedQuery,
    limit: String(validLimit),
    lang,
    country,
  });

  const url = `${API_BASE}/search?${params.toString()}`;

  try {
    const result = await withRetry(
      async () => {
        const response = await fetchWithTimeout(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": API_HOST,
          },
          cache: "no-store",
          timeoutMs: REQUEST_TIMEOUT_MS,
        });

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`[rapidapi] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        return response;
      },
      {
        ...httpRetryOptions,
        onRetry: (error, attempt, delayMs) => {
          console.warn(
            `[rapidapi] Attempt ${attempt} failed for query "${validatedQuery}", retrying in ${delayMs}ms:`,
            error instanceof Error ? error.message : error
          );
        },
      }
    );

    const json = (await result.json()) as RapidAPIResponse;

    if (json.status !== "OK" || !Array.isArray(json.data)) {
      const msg = `Unexpected response: status=${json.status}`;
      console.error(`[rapidapi] ${msg}`);
      return { data: [], error: msg };
    }

    const articles = json.data
      .filter((item): item is RapidAPIArticle & { title: string; link: string } =>
        Boolean(item.title && item.link),
      )
      .map((item) => normalizeArticle(item, topicName));

    console.log(`[rapidapi] Fetched ${articles.length} articles for query "${validatedQuery}"${topicName ? ` (topic: ${topicName})` : ""}`);
    return { data: articles, error: null };
  } catch (err) {
    let errorMsg: string;

    if (err instanceof FetchTimeoutError) {
      errorMsg = `Request timed out after ${REQUEST_TIMEOUT_MS}ms`;
    } else if (err instanceof Error) {
      errorMsg = err.message;
    } else {
      errorMsg = "Unknown error occurred";
    }

    console.error(`[rapidapi] Fetch failed for query "${validatedQuery}":`, errorMsg);
    return { data: [], error: errorMsg };
  }
}

/**
 * Map a RapidAPI article object to the normalised `Article` shape.
 */
function normalizeArticle(
  item: RapidAPIArticle & { title: string; link: string },
  topicName?: string,
): Article {
  return {
    title: item.title,
    link: item.link,
    snippet: item.snippet ?? null,
    photoUrl: item.photo_url ?? null,
    sourceName: item.source_name ?? null,
    sourceUrl: item.source_url ?? null,
    publishedAt: normalizeDate(item.published_datetime_utc),
    sourceType: "rapidapi",
    summary: null,
    sentiment: null,
    categories: null,
    aiProcessed: false,
    matchedTopics: topicName ? [topicName] : [],
  };
}

/**
 * Ensure the datetime string is a valid ISO 8601 string.
 * The API sometimes returns "YYYY-MM-DD HH:mm:ss" without the "T" separator.
 */
function normalizeDate(raw?: string): string | null {
  if (!raw) return null;
  // Replace space separator with "T" and ensure timezone suffix
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
