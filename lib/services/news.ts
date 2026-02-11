/**
 * News orchestration service.
 *
 * Coordinates the full data pipeline:
 *   1. Fetch articles from Google News RSS / RSS sources (using topics)
 *   2. Filter RSS articles by topic keywords
 *   3. Deduplicate and upsert into the `articles` table
 *   4. Crawl full content via Crawl4AI for unprocessed articles
 *   5. Analyze with SiliconFlow LLM (summary, sentiment, categories)
 *   6. Update articles with AI results and error tracking
 *
 * HARDENED: Includes concurrency control, rate limiting delays, and proper error handling.
 * TOPIC-BASED: Uses topics table for filtering instead of search_queries.
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

/** Delay between Google News requests to be respectful (ms) */
const GOOGLENEWS_DELAY_MS = 2000;

/** Delay between LLM calls to avoid rate limits (ms) */
const LLM_DELAY_MS = 500;

/** Maximum keywords to fetch per topic (to limit API calls) */
const MAX_KEYWORDS_PER_TOPIC = 5;

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

export interface FetchResult {
  inserted: number;
  errors: string[];
}

/**
 * Fetch articles from Google News RSS for all enabled topics using their keywords.
 * Each keyword becomes a search query, and results are tagged with the topic name.
 * Topics without keywords are skipped.
 * Requests are made sequentially with delay to be respectful to Google.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @returns Number of articles upserted and any errors encountered.
 */
export async function fetchAndStoreGoogleNews(
  supabase: SupabaseDB,
  userId: string,
): Promise<FetchResult> {
  const errors: string[] = [];

  // 1. Get enabled topics with keywords for this user.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("name, keywords")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, errors: ["No enabled topics found"] };
  }

  // 2. Build list of keywords to fetch
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
    return { inserted: 0, errors: ["No keywords found in any enabled topic"] };
  }

  // 3. Fetch articles from Google News sequentially with delay
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
    return { inserted: 0, errors };
  }

  // 4. Upsert into the articles table (with matchedTopics merging).
  const count = await upsertArticles(supabase, userId, allArticles);

  console.log(`[news] Google News: Inserted ${count} articles from ${keywordQueue.length} keyword searches`);
  return { inserted: count, errors };
}

/**
 * Fetch articles from all enabled RSS feeds, filter by topics, then upsert.
 * Only articles matching at least one topic keyword are stored.
 *
 * @returns Number of articles upserted and any errors encountered.
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
    return { inserted: 0, errors: [`Failed to load feeds: ${fErr.message}`] };
  }

  if (!feeds || feeds.length === 0) {
    return { inserted: 0, errors: ["No enabled RSS feeds found"] };
  }

  // 2. Get enabled topics for filtering.
  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("name, keywords")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (tErr) {
    return { inserted: 0, errors: [`Failed to load topics: ${tErr.message}`] };
  }

  if (!topics || topics.length === 0) {
    return { inserted: 0, errors: ["No enabled topics found for filtering RSS articles"] };
  }

  // 3. Fetch articles from each feed with concurrency control.
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
    return { inserted: 0, errors };
  }

  // 4. Filter articles by topics (case-insensitive substring match).
  const filteredArticles = filterArticlesByTopics(allRawArticles, topics);

  if (filteredArticles.length === 0) {
    console.log(`[news] RSS: No articles matched any topics`);
    return { inserted: 0, errors };
  }

  // 5. Upsert into the articles table.
  const count = await upsertArticles(supabase, userId, filteredArticles);

  console.log(`[news] RSS: Inserted ${count} articles from ${feeds.length} feeds (${filteredArticles.length} matched topics)`);
  return { inserted: count, errors };
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

  // 6. INSERT new articles (with ai_processed = false)
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
