import type { Metadata } from "next";
import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types/news";
import type { ArticleRow } from "@/lib/types/database";
import type { DashboardData } from "@/app/api/dashboard/route";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

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
    aiError: row.ai_error,
    aiProcessedAt: row.ai_processed_at,
    fullContent: row.full_content,
    matchedTopics: row.matched_topics ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

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

  // Count unique sources
  const uniqueSources = new Set(
    articles.map((a) => a.sourceName).filter(Boolean),
  );
  const activeSources = uniqueSources.size;

  // Last updated
  const lastUpdated = articles.length > 0 ? articles[0].publishedAt : null;

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

  // Convert to array sorted by date (most recent last for chart)
  const sentimentData = Array.from(sentimentByDay.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .reverse()
    .slice(-14); // Last 14 days

  // Compute sentiment pie data from all articles (no period filtering on server)
  const sentimentPieData = {
    positive: successfullyAnalyzed.filter((a) => a.sentiment === "positive").length,
    negative: successfullyAnalyzed.filter((a) => a.sentiment === "negative").length,
    neutral: successfullyAnalyzed.filter((a) => a.sentiment === "neutral").length,
    total: successfullyAnalyzed.length,
  };

  // Compute sources ranking (from analyzed articles only, to match sentiment pie)
  const sourcesCounts = new Map<string, number>();
  for (const article of successfullyAnalyzed) {
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
  const sourcesData = othersCount > 0
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

  const categoryData = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  // Build initial data for SWR fallback
  // Pass ALL articles - ArticleFeed handles pagination client-side
  const initialData: DashboardData = {
    articles,
    totalArticles,
    kpiData: {
      totalArticles,
      analyzedCount,
      failedCount,
      pendingCount,
      decodePendingCount,
      positivePercent,
      activeSources,
      lastUpdated,
    },
    sentimentData,
    sentimentPieData,
    sourcesData,
    allSourcesData,
    categoryData,
    availableTopics,
    pendingCount,
    period: "3m", // Default period for server-side render
  };

  return <DashboardClient initialData={initialData} />;
}
