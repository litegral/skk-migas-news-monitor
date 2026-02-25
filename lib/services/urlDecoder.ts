/**
 * URL Decoder Service.
 *
 * Handles background decoding of Google News URLs to actual article URLs.
 * Uses a 3-second delay between decode requests to avoid rate limiting.
 *
 * Flow:
 * 1. Get articles with url_decoded = false
 * 2. For each article:
 *    a. Check cache for decoded URL
 *    b. If not cached, decode via Google API
 *    c. Update article.link with decoded URL
 *    d. Set url_decoded = true
 *    e. Cache the decoded URL
 *    f. Wait 3 seconds before next
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeGoogleNewsUrl } from "@/lib/utils/googleNewsDecoder";
import {
  extractBase64Id,
  batchGetCachedUrls,
  cacheDecodedUrl,
  isGoogleNewsUrl,
} from "@/lib/utils/googleNewsUrlCache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseDB = SupabaseClient<any>;

/** Delay between decode requests (ms) - 3 seconds to avoid rate limits */
const DECODE_DELAY_MS = 3000;

/** Article shape for decoding */
interface ArticleToDecode {
  id: string;
  link: string;
  title: string;
}

/** Result of a single decode operation */
export interface DecodeResult {
  success: boolean;
  articleId: string;
  decodedUrl?: string;
  error?: string;
  cached?: boolean;
  /** Whether the URL was decoded directly without HTTP requests (instant) */
  directDecode?: boolean;
}

/** Progress callback type */
export type DecodeProgressCallback = (progress: {
  decoded: number;
  failed: number;
  total: number;
  currentArticle?: string;
}) => void;

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get articles that need URL decoding.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param limit - Maximum number of articles to fetch (default 100).
 * @returns Array of articles needing decode.
 */
export async function getArticlesToDecode(
  supabase: SupabaseDB,
  userId: string,
  limit = 100,
): Promise<ArticleToDecode[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("id, link, title")
    .eq("user_id", userId)
    .eq("url_decoded", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[urlDecoder] Failed to get articles:", error.message);
    return [];
  }

  return (data ?? []) as ArticleToDecode[];
}

/**
 * Get count of articles that need URL decoding.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @returns Number of articles needing decode.
 */
export async function getArticlesToDecodeCount(
  supabase: SupabaseDB,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("url_decoded", false);

  if (error) {
    console.error("[urlDecoder] Failed to get count:", error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Decode a single article's URL and update the database.
 *
 * @param supabase - Supabase client instance.
 * @param article - The article to decode.
 * @param urlCache - Map of base64Id → decodedUrl for cached URLs.
 * @returns Result of the decode operation.
 */
export async function decodeAndUpdateArticle(
  supabase: SupabaseDB,
  article: ArticleToDecode,
  urlCache: Map<string, string>,
): Promise<DecodeResult> {
  // If not a Google News URL, just mark as decoded
  if (!isGoogleNewsUrl(article.link)) {
    const { error } = await supabase
      .from("articles")
      .update({ url_decoded: true })
      .eq("id", article.id);

    if (error) {
      return {
        success: false,
        articleId: article.id,
        error: `Failed to update: ${error.message}`,
      };
    }

    return {
      success: true,
      articleId: article.id,
      decodedUrl: article.link,
      cached: false,
      directDecode: true, // No HTTP request needed
    };
  }

  // Extract base64 ID for cache lookup
  const base64Id = extractBase64Id(article.link);

  // Check cache first
  if (base64Id && urlCache.has(base64Id)) {
    const cachedUrl = urlCache.get(base64Id)!;

    const { error } = await supabase
      .from("articles")
      .update({
        decoded_url: cachedUrl,
        url_decoded: true,
      })
      .eq("id", article.id);

    if (error) {
      return {
        success: false,
        articleId: article.id,
        error: `Failed to update with cached URL: ${error.message}`,
      };
    }

    console.log(`[urlDecoder] Cache hit for "${article.title.slice(0, 50)}..."`);
    return {
      success: true,
      articleId: article.id,
      decodedUrl: cachedUrl,
      cached: true,
      directDecode: true, // Cache hit = no HTTP request
    };
  }

  // Decode via decoder (tries direct base64 first, then API)
  const decodeResult = await decodeGoogleNewsUrl(article.link);

  if (!decodeResult.status || !decodeResult.decodedUrl) {
    // Failed to decode - still mark as decoded to avoid infinite retries
    // but also mark decode_failed so analysis skips this article
    // Keep the original Google News URL
    const { error } = await supabase
      .from("articles")
      .update({ url_decoded: true, decode_failed: true })
      .eq("id", article.id);

    if (error) {
      return {
        success: false,
        articleId: article.id,
        error: `Decode failed and update failed: ${error.message}`,
      };
    }

    console.warn(
      `[urlDecoder] Decode failed for "${article.title.slice(0, 50)}...": ${decodeResult.error}`,
    );
    return {
      success: false,
      articleId: article.id,
      error: decodeResult.error ?? "Unknown decode error",
      directDecode: decodeResult.directDecode,
    };
  }

  // Successfully decoded - update article and cache
  const decodedUrl = decodeResult.decodedUrl;
  const wasDirectDecode = decodeResult.directDecode ?? false;

  const { error } = await supabase
    .from("articles")
    .update({
      decoded_url: decodedUrl,
      url_decoded: true,
    })
    .eq("id", article.id);

  if (error) {
    return {
      success: false,
      articleId: article.id,
      error: `Decoded but failed to update: ${error.message}`,
    };
  }

  // Cache the decoded URL for future use
  if (base64Id) {
    await cacheDecodedUrl(supabase, base64Id, decodedUrl, article.link);
    // Also add to in-memory cache for this session
    urlCache.set(base64Id, decodedUrl);
  }

  const decodeMethod = wasDirectDecode ? "direct" : "API";
  console.log(`[urlDecoder] Decoded (${decodeMethod}) "${article.title.slice(0, 50)}..."`);
  return {
    success: true,
    articleId: article.id,
    decodedUrl,
    cached: false,
    directDecode: wasDirectDecode,
  };
}

/**
 * Decode all pending articles with progress callbacks.
 *
 * This is the main function used by the SSE endpoint. It:
 * 1. Fetches all articles needing decode
 * 2. Pre-loads the URL cache
 * 3. Processes each article (instant for direct decodes, delayed for API calls)
 * 4. Calls the progress callback after each article
 *
 * The new v2 decoder tries direct base64 decoding first (instant, no HTTP).
 * Only "AU_yqL" URLs require API calls, which get rate-limited delays.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param onProgress - Callback for progress updates.
 * @returns Final counts of decoded and failed articles.
 */
export async function decodeArticlesWithProgress(
  supabase: SupabaseDB,
  userId: string,
  onProgress: DecodeProgressCallback,
): Promise<{ decoded: number; failed: number; total: number }> {
  // Get articles to decode
  const articles = await getArticlesToDecode(supabase, userId);
  const total = articles.length;

  if (total === 0) {
    return { decoded: 0, failed: 0, total: 0 };
  }

  console.log(`[urlDecoder] Starting decode of ${total} articles`);

  // Pre-load URL cache for all articles
  const base64Ids = articles
    .map((a) => extractBase64Id(a.link))
    .filter((id): id is string => id !== null);

  const urlCache = await batchGetCachedUrls(supabase, base64Ids);

  let decoded = 0;
  let failed = 0;
  let apiCallCount = 0;

  // Process each article
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    // Report progress before processing
    onProgress({
      decoded,
      failed,
      total,
      currentArticle: article.title,
    });

    // Decode the article
    const result = await decodeAndUpdateArticle(supabase, article, urlCache);

    if (result.success) {
      decoded++;
    } else {
      failed++;
    }

    // Track API calls for logging
    if (!result.directDecode && !result.cached) {
      apiCallCount++;
    }

    // Report progress after processing
    onProgress({
      decoded,
      failed,
      total,
      currentArticle: article.title,
    });

    // Only add delay after API calls (not after direct decodes or cache hits)
    // This is the key optimization - direct decodes are instant!
    const needsDelay = !result.directDecode && !result.cached;
    if (i < articles.length - 1 && needsDelay) {
      await sleep(DECODE_DELAY_MS);
    }
  }

  console.log(
    `[urlDecoder] Complete: ${decoded} decoded, ${failed} failed out of ${total} (${apiCallCount} API calls)`,
  );

  return { decoded, failed, total };
}
