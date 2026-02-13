/**
 * GET /api/dashboard
 *
 * Returns all dashboard data for the authenticated user.
 * Used by SWR for reactive data fetching and auto-revalidation.
 *
 * Query parameters:
 *   - period: Filter period for chart data (7d, 1m, 3m, 6m, 1y, all). Default: 3m
 */

import { NextRequest, NextResponse } from "next/server";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types/news";
import type { ArticleRow } from "@/lib/types/database";
import type { ApiResponse } from "@/lib/types/news";
import {
  type DashboardPeriod,
  DEFAULT_PERIOD,
  getPeriodCutoffDate,
} from "@/lib/types/dashboard";

/** KPI data for the dashboard */
export interface KPIData {
  totalArticles: number;
  analyzedCount: number;  // Successfully analyzed (has summary)
  failedCount: number;    // Failed analysis (has ai_error)
  pendingCount: number;   // Ready for analysis (url_decoded = true, ai_processed = false)
  decodePendingCount: number; // Waiting for URL decode (url_decoded = false)
  positivePercent: number;
  activeSources: number;
  lastUpdated: string | null;
}

/** Sentiment data point for charts */
export interface SentimentDataPoint {
  date: string;
  Positif: number;
  Netral: number;
  Negatif: number;
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

/** Sentiment pie chart data (server-computed) */
export interface SentimentPieData {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

/** Complete dashboard data response */
export interface DashboardData {
  /** All articles for the feed (not filtered by period) */
  articles: Article[];
  /** Total count of all articles */
  totalArticles: number;
  kpiData: KPIData;
  sentimentData: SentimentDataPoint[];
  sentimentPieData: SentimentPieData;
  /** Top 10 sources + "Lainnya" for bar chart */
  sourcesData: SourceData[];
  /** All sources for modal view */
  allSourcesData: SourceData[];
  categoryData: CategoryData[];
  availableTopics: string[];
  pendingCount: number;
  period: DashboardPeriod;
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
    urlDecoded: row.url_decoded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DashboardData>>> {
  try {
    const supabase = await createClient();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") as DashboardPeriod | null;
    const period: DashboardPeriod = periodParam ?? DEFAULT_PERIOD;

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
    const allArticles = articleRows.map(toArticle);
    const availableTopics = topicsData?.map((t) => t.name) ?? [];

    // Filter articles by period for chart calculations
    const cutoffDate = getPeriodCutoffDate(period);
    const articles = cutoffDate
      ? allArticles.filter((a) => {
          if (!a.publishedAt) return false;
          return new Date(a.publishedAt) >= cutoffDate;
        })
      : allArticles;

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
    
    // Pending analysis: url_decoded = true AND ai_processed = false (ready for analysis)
    const pendingCount = articles.filter(
      (a) => !a.aiProcessed && a.urlDecoded === true
    ).length;
    
    // Pending decode: url_decoded = false (waiting for URL decode before analysis)
    const decodePendingCount = articles.filter(
      (a) => a.urlDecoded === false
    ).length;

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
      decodePendingCount,
      positivePercent,
      activeSources,
      lastUpdated,
    };

    // Compute sentiment over time data (group by day)
    const sentimentByDay = new Map<
      string,
      { Positif: number; Netral: number; Negatif: number }
    >();

    for (const article of articles) {
      if (!article.publishedAt || !article.sentiment) continue;

      const day = format(new Date(article.publishedAt), "MMM d");
      const existing = sentimentByDay.get(day) || {
        Positif: 0,
        Netral: 0,
        Negatif: 0,
      };

      if (article.sentiment === "positive") existing.Positif++;
      else if (article.sentiment === "neutral") existing.Netral++;
      else if (article.sentiment === "negative") existing.Negatif++;

      sentimentByDay.set(day, existing);
    }

    // Generate all dates in the period range and fill missing days with zeros
    const today = startOfDay(new Date());
    const startDate = cutoffDate ? startOfDay(cutoffDate) : today;
    const allDatesInRange = eachDayOfInterval({ start: startDate, end: today });

    const sentimentData: SentimentDataPoint[] = allDatesInRange.map((date) => {
      const dayKey = format(date, "MMM d");
      const existing = sentimentByDay.get(dayKey);
      return {
        date: dayKey,
        Positif: existing?.Positif ?? 0,
        Netral: existing?.Netral ?? 0,
        Negatif: existing?.Negatif ?? 0,
      };
    });

    // Compute sentiment pie data from period-filtered articles
    const analyzedInPeriod = articles.filter(
      (a) => a.aiProcessed && a.sentiment != null
    );
    const sentimentPieData: SentimentPieData = {
      positive: analyzedInPeriod.filter((a) => a.sentiment === "positive").length,
      negative: analyzedInPeriod.filter((a) => a.sentiment === "negative").length,
      neutral: analyzedInPeriod.filter((a) => a.sentiment === "neutral").length,
      total: analyzedInPeriod.length,
    };

    // Compute sources ranking (from analyzed articles only, to match sentiment pie)
    const sourcesCounts = new Map<string, number>();
    for (const article of analyzedInPeriod) {
      if (!article.sourceName) continue;
      sourcesCounts.set(
        article.sourceName,
        (sourcesCounts.get(article.sourceName) || 0) + 1,
      );
    }

    // Get all sources sorted by count
    const allSourcesData = Array.from(sourcesCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Take top 6 and calculate "Others" count
    const topSources = allSourcesData.slice(0, 6);
    const topSourcesTotal = topSources.reduce((sum, s) => sum + s.value, 0);
    const totalArticlesWithSource = allSourcesData.reduce((sum, s) => sum + s.value, 0);
    const othersCount = totalArticlesWithSource - topSourcesTotal;

    // Add "Lainnya" (Others) row if there are more sources beyond top 6
    const sourcesData: SourceData[] = othersCount > 0
      ? [...topSources, { name: "Lainnya", value: othersCount }]
      : topSources;

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

    // Return ALL articles for the feed (not filtered by period)
    // Period filtering only applies to charts/KPIs
    // ArticleFeed component handles pagination client-side
    return NextResponse.json({
      data: {
        articles: allArticles,
        totalArticles: allArticles.length,
        kpiData,
        sentimentData,
        sentimentPieData,
        sourcesData,
        allSourcesData,
        categoryData,
        availableTopics,
        pendingCount,
        period,
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
