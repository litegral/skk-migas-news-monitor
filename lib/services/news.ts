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
 * TOPIC-BASED: Uses topics table for filtering with per-topic incremental fetching.
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

/** Topic data for fetching (includes last_fetched_at for smart cutoff) */
interface TopicForFetch {
  id: string;
  name: string;
  keywords: string[];
  lastFetchedAt: string | null;
}

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

export interface FetchResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Get the cutoff date for a specific topic based on its last_fetched_at.
 *
 * - If last_fetched_at is NULL: use DEFAULT_LOOKBACK_DAYS ago (new topic)
 * - If last_fetched_at exists: use that timestamp
 *
 * @returns Cutoff date - only fetch articles published after this date
 */
function getTopicCutoffDate(topic: TopicForFetch): Date {
  if (!topic.lastFetchedAt) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DEFAULT_LOOKBACK_DAYS);
    console.log(`[news] Topic "${topic.name}" never fetched, using ${DEFAULT_LOOKBACK_DAYS}-day lookback (since ${cutoff.toISOString()})`);
    return cutoff;
  }

  const cutoff = new Date(topic.lastFetchedAt);
  console.log(`[news] Topic "${topic.name}" last fetched at ${cutoff.toISOString()}`);
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
 * Each keyword becomes a search query, and results are tagged with the topic ID.
 * Topics without keywords are skipped.
 * Requests are made sequentially with delay to be respectful to Google.
 *
 * SMART CUTOFF: Uses per-topic last_fetched_at for incremental fetching.
 * New topics (last_fetched_at IS NULL) get 7-day lookback.
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

  // 1. Get enabled topics with keywords and last_fetched_at for this user.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("id, name, keywords, last_fetched_at")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, skipped: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No enabled topics found"] };
  }

  // 2. Build list of keywords to fetch, with per-topic cutoff dates
  const keywordQueue: { keyword: string; topicId: string; topicName: string; cutoffDate: Date }[] = [];
  const topicCutoffs = new Map<string, Date>();

  for (const row of topics ?? []) {
    // Skip topics without keywords
    if (!row.keywords || row.keywords.length === 0) {
      console.log(`[news] Skipping topic "${row.name}" - no keywords defined`);
      continue;
    }

    const topic: TopicForFetch = {
      id: row.id,
      name: row.name,
      keywords: row.keywords,
      lastFetchedAt: row.last_fetched_at,
    };

    // Get per-topic cutoff
    const cutoffDate = getTopicCutoffDate(topic);
    topicCutoffs.set(topic.id, cutoffDate);

    // Limit to first N keywords per topic
    const keywordsToFetch = topic.keywords.slice(0, MAX_KEYWORDS_PER_TOPIC);

    for (const keyword of keywordsToFetch) {
      keywordQueue.push({ keyword, topicId: topic.id, topicName: topic.name, cutoffDate });
    }
  }

  if (keywordQueue.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No keywords found in any enabled topic"] };
  }

  // 3. Fetch articles from Google News sequentially with delay
  const allArticles: Article[] = [];
  const fetchedTopicIds = new Set<string>();

  for (let i = 0; i < keywordQueue.length; i++) {
    const { keyword, topicId, topicName, cutoffDate } = keywordQueue[i];

    console.log(`[news] Fetching keyword ${i + 1}/${keywordQueue.length}: "${keyword}" (topic: ${topicName})`);

    const result = await fetchGoogleNewsArticles(keyword, { topicId, topicName });

    if (result.error) {
      errors.push(`Keyword "${keyword}": ${result.error}`);
    }

    if (result.data && result.data.length > 0) {
      // Filter by this topic's cutoff date
      const filteredArticles = filterArticlesByDate(result.data, cutoffDate);
      
      if (filteredArticles.length > 0) {
        allArticles.push(...filteredArticles);
        fetchedTopicIds.add(topicId);
      }
    }

    // Add delay before next request (skip for last keyword)
    if (i < keywordQueue.length - 1) {
      await sleep(GOOGLENEWS_DELAY_MS);
    }
  }

  if (allArticles.length === 0) {
    // Still update last_fetched_at for topics we tried (no new articles found)
    if (fetchedTopicIds.size > 0) {
      await updateTopicsLastFetched(supabase, userId, Array.from(fetchedTopicIds));
    }
    return { inserted: 0, skipped: 0, errors };
  }

  // 4. Upsert into the articles table (with matchedTopicIds merging).
  const count = await upsertArticles(supabase, userId, allArticles);

  // 5. Update last_fetched_at for all topics that were fetched
  await updateTopicsLastFetched(supabase, userId, Array.from(fetchedTopicIds));

  console.log(`[news] Google News: Inserted ${count} articles from ${fetchedTopicIds.size} topics`);
  return { inserted: count, skipped: 0, errors };
}

/**
 * Fetch articles from all enabled RSS feeds, filter by topics, then upsert.
 * Only articles matching at least one topic keyword are stored.
 *
 * SMART CUTOFF: Uses per-topic last_fetched_at for incremental fetching.
 * New topics (last_fetched_at IS NULL) get 7-day lookback.
 *
 * @returns Number of articles upserted, skipped, and any errors encountered.
 */
export async function fetchAndStoreRSS(
  supabase: SupabaseDB,
  userId: string,
): Promise<FetchResult> {
  const errors: string[] = [];

  // 1. Get enabled RSS feeds for this user.
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

  // 2. Get enabled topics with last_fetched_at for filtering.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("id, name, keywords, last_fetched_at")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, skipped: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, skipped: 0, errors: ["No enabled topics found for filtering RSS articles"] };
  }

  // 3. Compute the earliest cutoff date across all topics
  // (RSS feeds return all articles; we filter by the most permissive cutoff)
  const topicData: TopicForFetch[] = (topics ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    keywords: row.keywords,
    lastFetchedAt: row.last_fetched_at,
  }));
  let earliestCutoff = new Date();
  earliestCutoff.setDate(earliestCutoff.getDate() - DEFAULT_LOOKBACK_DAYS);

  for (const topic of topicData) {
    const topicCutoff = getTopicCutoffDate(topic);
    if (topicCutoff < earliestCutoff) {
      earliestCutoff = topicCutoff;
    }
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
  // Pass topic IDs to the filter function.
  const topicsWithIds = topicData.map((t) => ({ id: t.id, name: t.name, keywords: t.keywords }));
  const topicFilteredArticles = filterArticlesByTopics(allRawArticles, topicsWithIds);

  if (topicFilteredArticles.length === 0) {
    console.log(`[news] RSS: No articles matched any topics`);
    return { inserted: 0, skipped: 0, errors };
  }

  // 6. Filter to only include articles published after earliest cutoff
  const newArticles = filterArticlesByDate(topicFilteredArticles, earliestCutoff);
  const skipped = topicFilteredArticles.length - newArticles.length;

  if (newArticles.length === 0) {
    console.log(`[news] RSS: No new articles found (${skipped} skipped as already fetched)`);
    return { inserted: 0, skipped, errors };
  }

  // 7. Upsert into the articles table.
  const count = await upsertArticles(supabase, userId, newArticles);

  // 8. Update last_fetched_at for all topics that matched articles
  const matchedTopicIds = new Set<string>();
  for (const article of newArticles) {
    article.matchedTopicIds?.forEach((id) => matchedTopicIds.add(id));
  }
  if (matchedTopicIds.size > 0) {
    await updateTopicsLastFetched(supabase, userId, Array.from(matchedTopicIds));
  }

  console.log(`[news] RSS: Inserted ${count} articles, skipped ${skipped} (already fetched)`);
  return { inserted: count, skipped, errors };
}

/**
 * Update last_fetched_at for the given topics to NOW().
 */
async function updateTopicsLastFetched(
  supabase: SupabaseDB,
  userId: string,
  topicIds: string[],
): Promise<void> {
  if (topicIds.length === 0) return;

  const { error } = await supabase
    .from("topics")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", topicIds);

  if (error) {
    console.error(`[news] Failed to update last_fetched_at for ${topicIds.length} topics:`, error.message);
  } else {
    console.log(`[news] Updated last_fetched_at for ${topicIds.length} topics`);
  }
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
  //    Filter out decode-failed articles — they can't be crawled.
  const { data: articles, error: aErr } = await supabase
    .from("articles")
    .select("id, title, link, decoded_url, snippet")
    .eq("user_id", userId)
    .eq("ai_processed", false)
    .eq("url_decoded", true)
    .eq("decode_failed", false)
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
      // 2a. Crawl full content (required — skip analysis if crawl fails).
      // Use decoded_url for Google News articles, fall back to link for RSS
      const crawlUrl = article.decoded_url || article.link;
      const crawlResult = await crawlArticleContent(crawlUrl);
      const content = crawlResult.data;

      // If crawl failed, skip analysis — title-only sentiment is unreliable
      if (!content) {
        const crawlError = crawlResult.error || "Konten artikel tidak dapat diambil";
        console.warn(`[news] Crawl failed for "${article.title}", skipping analysis: ${crawlError}`);
        errors.push(`"${article.title.slice(0, 50)}...": Crawl gagal: ${crawlError}`);

        await supabase
          .from("articles")
          .update({
            ai_processed: true,
            ai_error: `Crawl gagal: ${crawlError}`,
            ai_processed_at: now,
          })
          .eq("id", article.id);

        failed++;

        // Add delay before next article
        if (articles.indexOf(article) < articles.length - 1) {
          await sleep(LLM_DELAY_MS);
        }
        continue;
      }

      // 2b. Analyze with LLM (only if we have crawled content).
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
          ai_reason: analysisResult.data.reason,
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
 * - For EXISTING articles: Only update matched_topic_ids (preserves AI analysis)
 * - Topic IDs are merged when the same article matches new keywords
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
    .select("link, matched_topic_ids")
    .eq("user_id", userId)
    .in("link", links);

  // 3. Create a set of existing links and map of their topic IDs
  const existingLinksSet = new Set<string>();
  const existingTopicIdsMap = new Map<string, string[]>();
  for (const row of existing ?? []) {
    existingLinksSet.add(row.link);
    existingTopicIdsMap.set(row.link, row.matched_topic_ids ?? []);
  }

  // 4. Deduplicate articles by link and merge matchedTopicIds
  const uniqueByLink = new Map<string, Article>();
  for (const article of articles) {
    const existingTopicIds = existingTopicIdsMap.get(article.link) ?? [];
    const currentTopicIds = uniqueByLink.get(article.link)?.matchedTopicIds ?? [];
    const newTopicIds = article.matchedTopicIds ?? [];

    // Merge all topic IDs (existing DB + previously seen in batch + current)
    const mergedTopicIds = [...new Set([...existingTopicIds, ...currentTopicIds, ...newTopicIds])];

    uniqueByLink.set(article.link, { ...article, matchedTopicIds: mergedTopicIds });
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
      matched_topic_ids: a.matchedTopicIds ?? [],
      ai_processed: false,
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

  // 7. UPDATE existing articles (only matched_topic_ids, preserving AI fields)
  if (existingArticles.length > 0) {
    let updatedCount = 0;

    for (const article of existingArticles) {
      const { error } = await supabase
        .from("articles")
        .update({ matched_topic_ids: article.matchedTopicIds ?? [] })
        .eq("user_id", userId)
        .eq("link", article.link);

      if (error) {
        console.error(`[news] Update error for "${article.link}":`, error.message);
      } else {
        updatedCount++;
      }
    }

    console.log(`[news] Updated matched_topic_ids for ${updatedCount} existing articles`);
  }

  return totalInserted;
}
