/**
 * RapidAPI Real-Time News Data service.
 *
 * Fetches news articles from the Real-Time News Data API on RapidAPI
 * and normalizes them into the app's `Article` shape.
 *
 * Endpoint: GET https://real-time-news-data.p.rapidapi.com/search
 * Docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-news-data
 */

import type { Article } from "@/lib/types/news";

const API_HOST = "real-time-news-data.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

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

/**
 * Fetch news articles from RapidAPI Real-Time News Data for a given query.
 *
 * @param query  - The search query string (e.g. "SKK Migas Kalsul").
 * @param limit  - Max number of results (API default is ~10, max varies).
 * @param lang   - Language filter (default "id" for Indonesian).
 * @param country - Country filter (default "ID" for Indonesia).
 * @returns Normalized Article array. Returns empty array on failure.
 */
export async function fetchRapidAPINews(
  query: string,
  { limit = 50, lang = "id", country = "ID" } = {},
): Promise<Article[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.error("[rapidapi] RAPIDAPI_KEY is not set");
    return [];
  }

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    lang,
    country,
  });

  const url = `${API_BASE}/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": API_HOST,
      },
      // No caching on the server — we control freshness via the orchestrator.
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `[rapidapi] HTTP ${response.status}: ${response.statusText}`,
      );
      return [];
    }

    const json = (await response.json()) as RapidAPIResponse;

    if (json.status !== "OK" || !Array.isArray(json.data)) {
      console.error("[rapidapi] Unexpected response shape:", json.status);
      return [];
    }

    return json.data
      .filter((item): item is RapidAPIArticle & { title: string; link: string } =>
        Boolean(item.title && item.link),
      )
      .map((item) => normalizeArticle(item));
  } catch (err) {
    console.error("[rapidapi] Fetch failed:", err);
    return [];
  }
}

/**
 * Map a RapidAPI article object to the normalised `Article` shape.
 */
function normalizeArticle(
  item: RapidAPIArticle & { title: string; link: string },
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
