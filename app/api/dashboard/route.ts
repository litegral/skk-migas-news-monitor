/**
 * GET /api/dashboard
 *
 * Returns all dashboard data for the authenticated user.
 * Used by SWR for reactive data fetching and auto-revalidation.
 */

import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types/news";
import type { ArticleRow } from "@/lib/types/database";
import type { ApiResponse } from "@/lib/types/news";

/** KPI data for the dashboard */
export interface KPIData {
  totalArticles: number;
  analyzedCount: number;  // Successfully analyzed (has summary)
  failedCount: number;    // Failed analysis (has ai_error)
  pendingCount: number;   // Not yet processed
  positivePercent: number;
  activeSources: number;
  lastUpdated: string | null;
}

/** Sentiment data point for charts */
export interface SentimentDataPoint {
  date: string;
  Positive: number;
  Neutral: number;
  Negative: number;
}

/** Source data for bar list */
export interface SourceData {
  name: string;
  value: number;
}

/** Category data for charts */
export interface CategoryData {
  category: string;
  count: number;
}

/** Complete dashboard data response */
export interface DashboardData {
  articles: Article[];
  kpiData: KPIData;
  sentimentData: SentimentDataPoint[];
  sourcesData: SourceData[];
  categoryData: CategoryData[];
  availableTopics: string[];
  pendingCount: number;
}

/** Convert database row to domain Article type */
function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    snippet: row.snippet,
    photoUrl: row.photo_url,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
    sourceType: row.source_type,
    summary: row.summary,
    sentiment: row.sentiment,
    categories: row.categories,
    aiProcessed: row.ai_processed,
    aiError: row.ai_error,
    aiProcessedAt: row.ai_processed_at,
    fullContent: row.full_content,
    matchedTopics: row.matched_topics ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(): Promise<NextResponse<ApiResponse<DashboardData>>> {
  try {
    const supabase = await createClient();

    // Authenticate the request
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Fetch all articles for the current user
    const { data: articlesData } = await supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false });

    // Fetch enabled topics for filtering
    const { data: topicsData } = await supabase
      .from("topics")
      .select("name")
      .eq("enabled", true)
      .order("name", { ascending: true });

    const articleRows = articlesData ?? [];
    const articles = articleRows.map(toArticle);
    const availableTopics = topicsData?.map((t) => t.name) ?? [];

    // Compute KPI data
    const totalArticles = articles.length;
    
    // Successfully analyzed: ai_processed = true AND has summary (no error)
    const successfullyAnalyzed = articles.filter(
      (a) => a.aiProcessed && a.summary != null
    );
    const analyzedCount = successfullyAnalyzed.length;
    
    // Failed: ai_processed = true AND has ai_error (no summary)
    const failedCount = articles.filter(
      (a) => a.aiProcessed && a.aiError != null
    ).length;
    
    // Pending: not yet processed
    const pendingCount = articles.filter((a) => !a.aiProcessed).length;

    const positiveCount = successfullyAnalyzed.filter(
      (a) => a.sentiment === "positive",
    ).length;
    const positivePercent =
      successfullyAnalyzed.length > 0
        ? Math.round((positiveCount / successfullyAnalyzed.length) * 100)
        : 0;

    // Count unique sources (publishers with matching topics)
    const uniqueSources = new Set(
      articles.map((a) => a.sourceName).filter(Boolean),
    );
    const activeSources = uniqueSources.size;

    // Last updated
    const lastUpdated = articles.length > 0 ? articles[0].publishedAt : null;

    const kpiData: KPIData = {
      totalArticles,
      analyzedCount,
      failedCount,
      pendingCount,
      positivePercent,
      activeSources,
      lastUpdated,
    };

    // Compute sentiment over time data (group by day)
    const sentimentByDay = new Map<
      string,
      { Positive: number; Neutral: number; Negative: number }
    >();

    for (const article of articles) {
      if (!article.publishedAt || !article.sentiment) continue;

      const day = format(new Date(article.publishedAt), "MMM d");
      const existing = sentimentByDay.get(day) || {
        Positive: 0,
        Neutral: 0,
        Negative: 0,
      };

      if (article.sentiment === "positive") existing.Positive++;
      else if (article.sentiment === "neutral") existing.Neutral++;
      else if (article.sentiment === "negative") existing.Negative++;

      sentimentByDay.set(day, existing);
    }

    // Convert to array sorted by date (most recent last for chart)
    const sentimentData: SentimentDataPoint[] = Array.from(
      sentimentByDay.entries(),
    )
      .map(([date, counts]) => ({ date, ...counts }))
      .reverse()
      .slice(-14); // Last 14 days

    // Compute sources ranking
    const sourcesCounts = new Map<string, number>();
    for (const article of articles) {
      if (!article.sourceName) continue;
      sourcesCounts.set(
        article.sourceName,
        (sourcesCounts.get(article.sourceName) || 0) + 1,
      );
    }

    const sourcesData: SourceData[] = Array.from(sourcesCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

    // Compute category distribution
    const categoryCounts = new Map<string, number>();
    for (const article of articles) {
      if (!article.categories) continue;
      for (const category of article.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
    }

    const categoryData: CategoryData[] = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    // Return only recent articles for feed (limit to 50)
    const recentArticles = articles.slice(0, 50);

    return NextResponse.json({
      data: {
        articles: recentArticles,
        kpiData,
        sentimentData,
        sourcesData,
        categoryData,
        availableTopics,
        pendingCount,
      },
      error: null,
    });
  } catch (err) {
    console.error("[api/dashboard] Unhandled error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}
