/**
 * News orchestration service.
 *
 * Coordinates the full data pipeline:
 *   1. Fetch articles from Google News RSS / RSS sources (using topics)
 *   2. Filter RSS articles by topic keywords
 *   3. Deduplicate and upsert into the `articles` table
 *   4. Background URL decoding (separate process via /api/news/decode/stream)
 *   5. Crawl full content via Crawl4AI for decoded articles
 *   6. Analyze with SiliconFlow LLM (summary, sentiment, categories)
 *   7. Update articles with AI results and error tracking
 *
 * HARDENED: Includes concurrency control, rate limiting delays, and proper error handling.
 * TOPIC-BASED: Uses topics table for filtering instead of search_queries.
 * URL DECODING: Happens in background process to avoid Google rate limits.
 */

import pLimit from "p-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Article } from "@/lib/types/news";
import { fetchGoogleNewsArticles } from "@/lib/services/googlenews";
import { fetchRSSFeedArticles, filterArticlesByTopics } from "@/lib/services/rss";
import { crawlArticleContent } from "@/lib/services/crawler";
import { analyzeArticle } from "@/lib/services/llm";

type SupabaseDB = SupabaseClient<Database>;

/** Concurrency limits for external API calls */
const RSS_CONCURRENCY = 5; // Max 5 parallel RSS fetches

/** Delay between Google News keyword fetches (ms) - just for RSS parsing, not URL decode */
const GOOGLENEWS_DELAY_MS = 500;

/** Delay between LLM calls to avoid rate limits (ms) */
const LLM_DELAY_MS = 500;

/** Maximum keywords to fetch per topic (to limit API calls) */
const MAX_KEYWORDS_PER_TOPIC = 5;

/** Default lookback period for first fetch (days) */
const DEFAULT_LOOKBACK_DAYS = 7;

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

export interface FetchResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Get the cutoff date for incremental fetching.
 * 
 * - If articles exist: use the most recent published_at date
 * - If no articles exist: use DEFAULT_LOOKBACK_DAYS ago
 * 
 * @returns Cutoff date - only fetch articles published after this date
 */
async function getIncrementalCutoffDate(
  supabase: SupabaseDB,
  userId: string,
): Promise<Date> {
  const { data } = await supabase
    .from("articles")
    .select("published_at")
    .eq("user_id", userId)
    .order("published_at", { ascending: false })
    .limit(1)
    .single();

  if (data?.published_at) {
    const lastPublished = new Date(data.published_at);
    console.log(`[news] Incremental fetch: articles after ${lastPublished.toISOString()}`);
    return lastPublished;
  }

  // No articles exist - use default lookback
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEFAULT_LOOKBACK_DAYS);
  console.log(`[news] First fetch: articles from last ${DEFAULT_LOOKBACK_DAYS} days (since ${cutoff.toISOString()})`);
  return cutoff;
}

/**
 * Filter articles to only include those published after the cutoff date.
 * Articles without a publishedAt date are excluded.
 */
function filterArticlesByDate(articles: Article[], cutoffDate: Date): Article[] {
  return articles.filter((article) => {
    if (!article.publishedAt) return false;
    const publishedAt = new Date(article.publishedAt);
    return publishedAt > cutoffDate;
  });
}

/**
 * Fetch articles from Google News RSS for all enabled topics using their keywords.
 * Each keyword becomes a search query, and results are tagged with the topic name.
 * Topics without keywords are skipped.
 * Requests are made sequentially with delay to be respectful to Google.
 * 
 * INCREMENTAL: Only fetches articles published after the most recent article in the database.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @returns Number of articles upserted, skipped, and any errors encountered.
 */
export async function fetchAndStoreGoogleNews(
  supabase: SupabaseDB,
  userId: string,
): Promise<FetchResult> {
  const errors: string[] = [];

  // 1. Get cutoff date for incremental fetching
  const cutoffDate = await getIncrementalCutoffDate(supabase, userId);

  // 2. Get enabled topics with keywords for this user.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("name, keywords")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, skipped: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No enabled topics found"] };
  }

  // 3. Build list of keywords to fetch
  const keywordQueue: { keyword: string; topicName: string }[] = [];

  for (const topic of topics) {
    // Skip topics without keywords
    if (!topic.keywords || topic.keywords.length === 0) {
      console.log(`[news] Skipping topic "${topic.name}" - no keywords defined`);
      continue;
    }

    // Limit to first N keywords per topic
    const keywordsToFetch = topic.keywords.slice(0, MAX_KEYWORDS_PER_TOPIC);

    for (const keyword of keywordsToFetch) {
      keywordQueue.push({ keyword, topicName: topic.name });
    }
  }

  if (keywordQueue.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No keywords found in any enabled topic"] };
  }

  // 4. Fetch articles from Google News sequentially with delay
  const allArticles: Article[] = [];

  for (let i = 0; i < keywordQueue.length; i++) {
    const { keyword, topicName } = keywordQueue[i];

    console.log(`[news] Fetching keyword ${i + 1}/${keywordQueue.length}: "${keyword}" (topic: ${topicName})`);

    const result = await fetchGoogleNewsArticles(keyword, { topicName });

    if (result.error) {
      errors.push(`Keyword "${keyword}": ${result.error}`);
    }

    if (result.data && result.data.length > 0) {
      allArticles.push(...result.data);
    }

    // Add delay before next request (skip for last keyword)
    if (i < keywordQueue.length - 1) {
      await sleep(GOOGLENEWS_DELAY_MS);
    }
  }

  if (allArticles.length === 0) {
    return { inserted: 0, skipped: 0, errors };
  }

  // 5. Filter to only include articles published after cutoff date
  const newArticles = filterArticlesByDate(allArticles, cutoffDate);
  const skipped = allArticles.length - newArticles.length;

  if (newArticles.length === 0) {
    console.log(`[news] Google News: No new articles found (${skipped} skipped as already fetched)`);
    return { inserted: 0, skipped, errors };
  }

  // 6. Upsert into the articles table (with matchedTopics merging).
  const count = await upsertArticles(supabase, userId, newArticles);

  console.log(`[news] Google News: Inserted ${count} articles, skipped ${skipped} (already fetched)`);
  return { inserted: count, skipped, errors };
}

/**
 * Fetch articles from all enabled RSS feeds, filter by topics, then upsert.
 * Only articles matching at least one topic keyword are stored.
 * 
 * INCREMENTAL: Only fetches articles published after the most recent article in the database.
 *
 * @returns Number of articles upserted, skipped, and any errors encountered.
 */
export async function fetchAndStoreRSS(
  supabase: SupabaseDB,
  userId: string,
): Promise<FetchResult> {
  const errors: string[] = [];

  // 1. Get cutoff date for incremental fetching
  const cutoffDate = await getIncrementalCutoffDate(supabase, userId);

  // 2. Get enabled RSS feeds for this user.
  const { data: feeds, error: fErr } = await supabase
    .from("rss_feeds")
    .select("name, url")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (fErr) {
    return { inserted: 0, skipped: 0, errors: [`Failed to load feeds: ${fErr.message}`] };
  }

  if (!feeds || feeds.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No enabled RSS feeds found"] };
  }

  // 3. Get enabled topics for filtering.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("name, keywords")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, skipped: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No enabled topics found for filtering RSS articles"] };
  }

  // 4. Fetch articles from each feed with concurrency control.
  const limit = pLimit(RSS_CONCURRENCY);
  const fetchPromises = feeds.map((f) =>
    limit(async () => {
      const result = await fetchRSSFeedArticles(f.url, f.name);
      if (result.error) {
        errors.push(`Feed "${f.name}": ${result.error}`);
      }
      return result.data;
    })
  );

  const fetchResults = await Promise.all(fetchPromises);
  const allRawArticles = fetchResults.flat();

  if (allRawArticles.length === 0) {
    return { inserted: 0, skipped: 0, errors };
  }

  // 5. Filter articles by topics (case-insensitive substring match).
  const topicFilteredArticles = filterArticlesByTopics(allRawArticles, topics);

  if (topicFilteredArticles.length === 0) {
    console.log(`[news] RSS: No articles matched any topics`);
    return { inserted: 0, skipped: 0, errors };
  }

  // 6. Filter to only include articles published after cutoff date
  const newArticles = filterArticlesByDate(topicFilteredArticles, cutoffDate);
  const skipped = topicFilteredArticles.length - newArticles.length;

  if (newArticles.length === 0) {
    console.log(`[news] RSS: No new articles found (${skipped} skipped as already fetched)`);
    return { inserted: 0, skipped, errors };
  }

  // 7. Upsert into the articles table.
  const count = await upsertArticles(supabase, userId, newArticles);

  console.log(`[news] RSS: Inserted ${count} articles, skipped ${skipped} (already fetched)`);
  return { inserted: count, skipped, errors };
}

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

export interface AnalyzeResult {
  analyzed: number;
  failed: number;
  errors: string[];
}

/**
 * Find unprocessed articles, crawl their full content, analyze with LLM,
 * and update the database.
 *
 * @param limit - Max articles to process in one batch (default 10).
 * @returns Number of articles successfully analyzed, failed, and errors.
 */
export async function analyzeUnprocessedArticles(
  supabase: SupabaseDB,
  userId: string,
  limit = 10,
): Promise<AnalyzeResult> {
  const errors: string[] = [];

  // 1. Get unprocessed articles (oldest first).
  const { data: articles, error: aErr } = await supabase
    .from("articles")
    .select("id, title, link, snippet")
    .eq("user_id", userId)
    .eq("ai_processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (aErr) {
    return { analyzed: 0, failed: 0, errors: [`Failed to load articles: ${aErr.message}`] };
  }

  if (!articles || articles.length === 0) {
    return { analyzed: 0, failed: 0, errors: [] };
  }

  let analyzed = 0;
  let failed = 0;

  // 2. Process each article sequentially with delays to avoid rate limits.
  for (const article of articles) {
    const now = new Date().toISOString();

    try {
      // 2a. Crawl full content (returns null if Crawl4AI unavailable).
      const crawlResult = await crawlArticleContent(article.link);
      const content = crawlResult.data;

      // Log crawl errors but don't fail - we can still analyze with snippet
      if (crawlResult.error && !content) {
        console.warn(`[news] Crawl failed for "${article.title}": ${crawlResult.error}`);
      }

      // 2b. Analyze with LLM.
      const analysisResult = await analyzeArticle({
        title: article.title,
        snippet: article.snippet,
        content,
      });

      if (!analysisResult.data) {
        const errorMsg = analysisResult.error || "Unknown LLM error";
        console.warn(`[news] LLM analysis failed for "${article.title}": ${errorMsg}`);
        errors.push(`"${article.title.slice(0, 50)}...": ${errorMsg}`);

        // Mark as processed with error tracking.
        await supabase
          .from("articles")
          .update({
            ai_processed: true,
            ai_error: errorMsg,
            ai_processed_at: now,
            full_content: content,
          })
          .eq("id", article.id);

        failed++;
        continue;
      }

      // 2c. Update the article with AI results.
      const { error: uErr } = await supabase
        .from("articles")
        .update({
          summary: analysisResult.data.summary,
          sentiment: analysisResult.data.sentiment,
          categories: analysisResult.data.categories,
          ai_processed: true,
          ai_error: null, // Clear any previous error
          ai_processed_at: now,
          full_content: content,
        })
        .eq("id", article.id);

      if (uErr) {
        console.error(`[news] Failed to update article ${article.id}:`, uErr);
        errors.push(`Failed to save analysis for "${article.title.slice(0, 50)}..."`);
        failed++;
      } else {
        analyzed++;
      }

      // 2d. Add delay before next LLM call to avoid rate limits.
      if (articles.indexOf(article) < articles.length - 1) {
        await sleep(LLM_DELAY_MS);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[news] Error processing article "${article.title}":`, errorMsg);
      errors.push(`"${article.title.slice(0, 50)}...": ${errorMsg}`);

      // Mark as processed with error tracking.
      await supabase
        .from("articles")
        .update({
          ai_processed: true,
          ai_error: errorMsg,
          ai_processed_at: now,
        })
        .eq("id", article.id);

      failed++;
    }
  }

  console.log(`[news] Analysis complete: ${analyzed} succeeded, ${failed} failed`);
  return { analyzed, failed, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upsert an array of normalised articles into the `articles` table.
 * Deduplicates by the `UNIQUE(user_id, link)` constraint.
 * 
 * Key behaviors:
 * - For NEW articles: Insert with ai_processed = false
 * - For EXISTING articles: Only update matched_topics (preserves AI analysis)
 * - Topics are merged when the same article matches new keywords
 *
 * @returns Number of rows inserted (new articles only).
 */
async function upsertArticles(
  supabase: SupabaseDB,
  userId: string,
  articles: Article[],
): Promise<number> {
  if (articles.length === 0) return 0;

  // 1. Get unique links from incoming articles
  const links = [...new Set(articles.map((a) => a.link))];

  // 2. Fetch existing articles with these links
  const { data: existing } = await supabase
    .from("articles")
    .select("link, matched_topics")
    .eq("user_id", userId)
    .in("link", links);

  // 3. Create a set of existing links and map of their topics
  const existingLinksSet = new Set<string>();
  const existingTopicsMap = new Map<string, string[]>();
  for (const row of existing ?? []) {
    existingLinksSet.add(row.link);
    existingTopicsMap.set(row.link, row.matched_topics ?? []);
  }

  // 4. Deduplicate articles by link and merge matchedTopics
  const uniqueByLink = new Map<string, Article>();
  for (const article of articles) {
    const existingTopics = existingTopicsMap.get(article.link) ?? [];
    const currentTopics = uniqueByLink.get(article.link)?.matchedTopics ?? [];
    const newTopics = article.matchedTopics ?? [];

    // Merge all topics (existing DB + previously seen in batch + current)
    const mergedTopics = [...new Set([...existingTopics, ...currentTopics, ...newTopics])];

    uniqueByLink.set(article.link, { ...article, matchedTopics: mergedTopics });
  }

  const deduplicatedArticles = Array.from(uniqueByLink.values());

  // 5. Separate new articles from existing ones
  const newArticles = deduplicatedArticles.filter((a) => !existingLinksSet.has(a.link));
  const existingArticles = deduplicatedArticles.filter((a) => existingLinksSet.has(a.link));

  let totalInserted = 0;

  // 6. INSERT new articles (with ai_processed = false, url_decoded based on source)
  if (newArticles.length > 0) {
    const newRows = newArticles.map((a) => ({
      user_id: userId,
      title: a.title,
      link: a.link,
      snippet: a.snippet,
      photo_url: a.photoUrl,
      source_name: a.sourceName,
      source_url: a.sourceUrl,
      published_at: a.publishedAt,
      source_type: a.sourceType as "googlenews" | "rss",
      matched_topics: a.matchedTopics ?? [],
      ai_processed: false,
      // Google News URLs need decoding, RSS URLs are already actual URLs
      url_decoded: a.urlDecoded ?? (a.sourceType === "rss"),
    }));

    const CHUNK_SIZE = 50;
    for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
      const chunk = newRows.slice(i, i + CHUNK_SIZE);

      const { data, error } = await supabase
        .from("articles")
        .insert(chunk)
        .select("id");

      if (error) {
        console.error(
          `[news] Insert error (chunk ${i / CHUNK_SIZE + 1}):`,
          error.message,
        );
      } else {
        totalInserted += data?.length ?? 0;
      }
    }

    console.log(`[news] Inserted ${totalInserted} new articles`);
  }

  // 7. UPDATE existing articles (only matched_topics, preserving AI fields)
  if (existingArticles.length > 0) {
    let updatedCount = 0;

    for (const article of existingArticles) {
      const { error } = await supabase
        .from("articles")
        .update({ matched_topics: article.matchedTopics ?? [] })
        .eq("user_id", userId)
        .eq("link", article.link);

      if (error) {
        console.error(`[news] Update error for "${article.link}":`, error.message);
      } else {
        updatedCount++;
      }
    }

    console.log(`[news] Updated matched_topics for ${updatedCount} existing articles`);
  }

  return totalInserted;
}
