/**
 * News orchestration service.
 *
 * Coordinates the full data pipeline:
 *   1. Fetch articles from RapidAPI / RSS sources
 *   2. Deduplicate and upsert into the `articles` table
 *   3. Crawl full content via Crawl4AI for unprocessed articles
 *   4. Analyze with SiliconFlow LLM (summary, sentiment, categories)
 *   5. Update articles with AI results
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Article } from "@/lib/types/news";
import { fetchRapidAPINews } from "@/lib/services/rapidapi";
import { fetchRSSFeedArticles } from "@/lib/services/rss";
import { crawlArticleContent } from "@/lib/services/crawler";
import { analyzeArticle } from "@/lib/services/llm";

type SupabaseDB = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

/**
 * Fetch articles from RapidAPI for all enabled search queries, then upsert.
 *
 * @returns Number of articles upserted.
 */
export async function fetchAndStoreRapidAPI(
  supabase: SupabaseDB,
  userId: string,
): Promise<{ inserted: number; error: string | null }> {
  // 1. Get enabled search queries for this user.
  const { data: queries, error: qErr } = await supabase
    .from("search_queries")
    .select("query")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (qErr) {
    return { inserted: 0, error: `Failed to load queries: ${qErr.message}` };
  }

  if (!queries || queries.length === 0) {
    return { inserted: 0, error: "No enabled search queries found" };
  }

  // 2. Fetch articles from RapidAPI for each query in parallel.
  const fetchResults = await Promise.all(
    queries.map((q) => fetchRapidAPINews(q.query)),
  );
  const allArticles = fetchResults.flat();

  if (allArticles.length === 0) {
    return { inserted: 0, error: null };
  }

  // 3. Upsert into the articles table.
  const count = await upsertArticles(supabase, userId, allArticles);
  return { inserted: count, error: null };
}

/**
 * Fetch articles from all enabled RSS feeds, then upsert.
 *
 * @returns Number of articles upserted.
 */
export async function fetchAndStoreRSS(
  supabase: SupabaseDB,
  userId: string,
): Promise<{ inserted: number; error: string | null }> {
  // 1. Get enabled RSS feeds for this user.
  const { data: feeds, error: fErr } = await supabase
    .from("rss_feeds")
    .select("name, url")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (fErr) {
    return { inserted: 0, error: `Failed to load feeds: ${fErr.message}` };
  }

  if (!feeds || feeds.length === 0) {
    return { inserted: 0, error: "No enabled RSS feeds found" };
  }

  // 2. Fetch articles from each feed in parallel.
  const fetchResults = await Promise.all(
    feeds.map((f) => fetchRSSFeedArticles(f.url, f.name)),
  );
  const allArticles = fetchResults.flat();

  if (allArticles.length === 0) {
    return { inserted: 0, error: null };
  }

  // 3. Upsert into the articles table.
  const count = await upsertArticles(supabase, userId, allArticles);
  return { inserted: count, error: null };
}

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

/**
 * Find unprocessed articles, crawl their full content, analyze with LLM,
 * and update the database.
 *
 * @param limit - Max articles to process in one batch (default 10).
 * @returns Number of articles successfully analyzed.
 */
export async function analyzeUnprocessedArticles(
  supabase: SupabaseDB,
  userId: string,
  limit = 10,
): Promise<{ analyzed: number; error: string | null }> {
  // 1. Get unprocessed articles (oldest first).
  const { data: articles, error: aErr } = await supabase
    .from("articles")
    .select("id, title, link, snippet")
    .eq("user_id", userId)
    .eq("ai_processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (aErr) {
    return { analyzed: 0, error: `Failed to load articles: ${aErr.message}` };
  }

  if (!articles || articles.length === 0) {
    return { analyzed: 0, error: null };
  }

  let analyzed = 0;

  // 2. Process each article sequentially to avoid overwhelming Crawl4AI / LLM.
  for (const article of articles) {
    try {
      // 2a. Crawl full content (returns null if Crawl4AI unavailable).
      const content = await crawlArticleContent(article.link);

      // 2b. Analyze with LLM.
      const result = await analyzeArticle({
        title: article.title,
        snippet: article.snippet,
        content,
      });

      if (!result) {
        console.warn(`[news] LLM analysis failed for "${article.title}"`);
        // Mark as processed to avoid retrying indefinitely.
        await supabase
          .from("articles")
          .update({ ai_processed: true })
          .eq("id", article.id);
        continue;
      }

      // 2c. Update the article with AI results.
      const { error: uErr } = await supabase
        .from("articles")
        .update({
          summary: result.summary,
          sentiment: result.sentiment,
          categories: result.categories,
          ai_processed: true,
        })
        .eq("id", article.id);

      if (uErr) {
        console.error(`[news] Failed to update article ${article.id}:`, uErr);
      } else {
        analyzed++;
      }
    } catch (err) {
      console.error(`[news] Error processing article "${article.title}":`, err);
      // Mark as processed to prevent retry loop.
      await supabase
        .from("articles")
        .update({ ai_processed: true })
        .eq("id", article.id);
    }
  }

  return { analyzed, error: null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upsert an array of normalised articles into the `articles` table.
 * Deduplicates by the `UNIQUE(user_id, link)` constraint.
 *
 * @returns Number of rows upserted.
 */
async function upsertArticles(
  supabase: SupabaseDB,
  userId: string,
  articles: Article[],
): Promise<number> {
  // Map domain articles to DB row shape.
  const rows = articles.map((a) => ({
    user_id: userId,
    title: a.title,
    link: a.link,
    snippet: a.snippet,
    photo_url: a.photoUrl,
    source_name: a.sourceName,
    source_url: a.sourceUrl,
    published_at: a.publishedAt,
    source_type: a.sourceType as "rapidapi" | "rss",
    ai_processed: false,
  }));

  // Upsert in chunks to avoid request size limits.
  const CHUNK_SIZE = 50;
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const { data, error } = await supabase
      .from("articles")
      .upsert(chunk, {
        onConflict: "user_id,link",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error(
        `[news] Upsert error (chunk ${i / CHUNK_SIZE + 1}):`,
        error.message,
      );
    } else {
      total += data?.length ?? 0;
    }
  }

  return total;
}
