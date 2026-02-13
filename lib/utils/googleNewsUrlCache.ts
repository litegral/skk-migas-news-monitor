/**
 * Google News URL Cache utilities.
 *
 * Caches decoded Google News URLs to avoid repeated API calls to Google.
 * Cache is global (shared across all users) since URLs decode identically
 * regardless of who is fetching them.
 *
 * The cache table stores:
 * - base64_id: The unique identifier extracted from the Google News URL
 * - decoded_url: The actual article URL
 * - google_news_url: Original URL for reference
 *
 * NOTE: After running the SQL migration, regenerate types with:
 * pnpm supabase gen types typescript --project-id <id> > lib/types/database.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Using generic SupabaseClient until types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseDB = SupabaseClient<any>;

/** Shape of a cache row */
interface CacheRow {
  base64_id: string;
  decoded_url: string;
  google_news_url?: string | null;
}

/**
 * Extract the base64 ID from a Google News URL.
 *
 * Google News URLs have the format:
 * - https://news.google.com/rss/articles/CBMi...
 * - https://news.google.com/articles/CBMi...
 * - https://news.google.com/read/CBMi...
 *
 * The base64 ID is the last path segment (e.g., "CBMi...").
 *
 * @param googleNewsUrl - The Google News URL to extract from.
 * @returns The base64 ID, or null if not a valid Google News URL.
 */
export function extractBase64Id(googleNewsUrl: string): string | null {
  try {
    const url = new URL(googleNewsUrl);

    // Must be a Google News URL
    if (url.hostname !== "news.google.com") {
      return null;
    }

    const pathParts = url.pathname.split("/");

    // Filter out known path segments and empty strings
    const base64Id = pathParts
      .filter((p) => p && !["rss", "articles", "read"].includes(p))
      .pop();

    // Base64 IDs are typically long strings starting with CB
    if (base64Id && base64Id.length > 10) {
      return base64Id;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a Google News URL that needs decoding.
 *
 * @param url - The URL to check.
 * @returns True if this is a Google News URL.
 */
export function isGoogleNewsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "news.google.com";
  } catch {
    return false;
  }
}

/**
 * Get a cached decoded URL by base64 ID.
 *
 * @param supabase - Supabase client instance.
 * @param base64Id - The base64 ID extracted from the Google News URL.
 * @returns The decoded URL if cached, or null if not found.
 */
export async function getCachedUrl(
  supabase: SupabaseDB,
  base64Id: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("google_news_url_cache")
    .select("decoded_url")
    .eq("base64_id", base64Id)
    .single();

  if (error || !data) {
    return null;
  }

  return (data as CacheRow).decoded_url;
}

/**
 * Batch get cached URLs for multiple base64 IDs.
 *
 * This is more efficient than calling getCachedUrl() multiple times
 * as it uses a single database query.
 *
 * @param supabase - Supabase client instance.
 * @param base64Ids - Array of base64 IDs to look up.
 * @returns A Map of base64Id → decodedUrl for found entries.
 */
export async function batchGetCachedUrls(
  supabase: SupabaseDB,
  base64Ids: string[],
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  if (base64Ids.length === 0) {
    return cache;
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(base64Ids)];

  const { data, error } = await supabase
    .from("google_news_url_cache")
    .select("base64_id, decoded_url")
    .in("base64_id", uniqueIds);

  if (error || !data) {
    console.warn("[urlCache] Failed to batch get cached URLs:", error?.message);
    return cache;
  }

  for (const row of data as CacheRow[]) {
    cache.set(row.base64_id, row.decoded_url);
  }

  console.log(
    `[urlCache] Cache hit: ${cache.size}/${uniqueIds.length} URLs found`,
  );

  return cache;
}

/**
 * Cache a decoded URL.
 *
 * Uses upsert to handle both new entries and updates.
 *
 * @param supabase - Supabase client instance.
 * @param base64Id - The base64 ID from the Google News URL.
 * @param decodedUrl - The decoded actual article URL.
 * @param googleNewsUrl - The original Google News URL (for reference).
 */
export async function cacheDecodedUrl(
  supabase: SupabaseDB,
  base64Id: string,
  decodedUrl: string,
  googleNewsUrl?: string,
): Promise<void> {
  const { error } = await supabase.from("google_news_url_cache").upsert(
    {
      base64_id: base64Id,
      decoded_url: decodedUrl,
      google_news_url: googleNewsUrl ?? null,
    },
    { onConflict: "base64_id" },
  );

  if (error) {
    console.warn("[urlCache] Failed to cache URL:", error.message);
  }
}

/**
 * Batch cache multiple decoded URLs.
 *
 * @param supabase - Supabase client instance.
 * @param entries - Array of { base64Id, decodedUrl, googleNewsUrl } objects.
 */
export async function batchCacheDecodedUrls(
  supabase: SupabaseDB,
  entries: Array<{
    base64Id: string;
    decodedUrl: string;
    googleNewsUrl?: string;
  }>,
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((e) => ({
    base64_id: e.base64Id,
    decoded_url: e.decodedUrl,
    google_news_url: e.googleNewsUrl ?? null,
  }));

  const { error } = await supabase
    .from("google_news_url_cache")
    .upsert(rows, { onConflict: "base64_id" });

  if (error) {
    console.warn("[urlCache] Failed to batch cache URLs:", error.message);
  } else {
    console.log(`[urlCache] Cached ${entries.length} decoded URLs`);
  }
}
