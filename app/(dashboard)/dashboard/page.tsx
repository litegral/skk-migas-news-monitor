import type { Metadata } from "next";
import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types/news";
import type { ArticleRow } from "@/lib/types/database";

import { KPICards, type KPIData } from "@/components/dashboard/KPICards";
import {
  SentimentChart,
  type SentimentDataPoint,
} from "@/components/dashboard/SentimentChart";
import {
  SourcesBarList,
  type SourceData,
} from "@/components/dashboard/SourcesBarList";
import {
  CategoryChart,
  type CategoryData,
} from "@/components/dashboard/CategoryChart";
import { FetchNewsButton } from "@/components/dashboard/FetchNewsButton";
import { ArticleFeed } from "@/components/news/ArticleFeed";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Dashboard - SKK Migas News Monitor",
};

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
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch all articles for the current user
  const { data: articlesData } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false });

  const articleRows = articlesData ?? [];
  const articles = articleRows.map(toArticle);

  // Compute KPI data
  const totalArticles = articles.length;
  const analyzedArticles = articles.filter((a) => a.aiProcessed);
  const positiveCount = analyzedArticles.filter(
    (a) => a.sentiment === "positive",
  ).length;
  const positivePercent =
    analyzedArticles.length > 0
      ? Math.round((positiveCount / analyzedArticles.length) * 100)
      : 0;

  // Count unique sources
  const uniqueSources = new Set(
    articles.map((a) => a.sourceName).filter(Boolean),
  );
  const activeSources = uniqueSources.size;

  // Last updated
  const lastUpdated = articles.length > 0 ? articles[0].publishedAt : null;

  const kpiData: KPIData = {
    totalArticles,
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

  // Recent articles for feed (limit to 50)
  const recentArticles = articles.slice(0, 50);

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            News monitoring overview for SKK Migas Kalsul.
          </p>
        </div>
        <FetchNewsButton />
      </div>

      {/* KPI cards */}
      <KPICards data={kpiData} />

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SentimentChart data={sentimentData} />
        <SourcesBarList data={sourcesData} />
      </div>

      {/* Category chart */}
      <div className="mt-6">
        <CategoryChart data={categoryData} />
      </div>

      {/* Article feed */}
      <div className="mt-6">
        <Card>
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Recent Articles
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Latest news from all sources
          </p>
          <div className="mt-4">
            <ArticleFeed articles={recentArticles} />
          </div>
        </Card>
      </div>
    </>
  );
}
