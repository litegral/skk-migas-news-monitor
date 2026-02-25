import { cache } from "react";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getPeriodCutoffDate, type DashboardPeriod } from "@/lib/types/dashboard";
import type { ArticleRow } from "@/lib/types/database";
import type { Article } from "@/lib/types/news";
import type {
  KPIData,
  SentimentDataPoint,
  SentimentPieData,
  SourceData,
  CategoryData
} from "@/lib/types/dashboard";

export const dashboardArticleSelect =
  "id,title,link,decoded_url,snippet,photo_url,source_name,source_url,published_at,source_type,summary,sentiment,categories,ai_processed,ai_error,ai_processed_at,matched_topic_ids,url_decoded,decode_failed,ai_reason,created_at,updated_at";

export type DashboardArticleRow = Pick<
  ArticleRow,
  | "id"
  | "title"
  | "link"
  | "decoded_url"
  | "snippet"
  | "photo_url"
  | "source_name"
  | "source_url"
  | "published_at"
  | "source_type"
  | "summary"
  | "sentiment"
  | "categories"
  | "ai_processed"
  | "ai_error"
  | "ai_processed_at"
  | "matched_topic_ids"
  | "url_decoded"
  | "decode_failed"
  | "ai_reason"
  | "created_at"
  | "updated_at"
>;

export function toDashboardArticle(row: DashboardArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    decodedUrl: row.decoded_url,
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
    matchedTopicIds: row.matched_topic_ids ?? [],
    urlDecoded: row.url_decoded,
    decodeFailed: row.decode_failed,
    aiReason: row.ai_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ----------------------------------------------------------------------
// Server-Side Data Fetching for Dashboard Widgets (Cached per request)
// ----------------------------------------------------------------------

export const getActiveTopics = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { topicMap: {}, activeTopicIds: [], availableTopics: [] };

  const { data: topicsData } = await supabase
    .from("topics")
    .select("id, name")
    .eq("enabled", true)
    .order("name", { ascending: true });

  const topicMap: Record<string, string> = {};
  const activeTopicIds: string[] = [];

  for (const topic of topicsData ?? []) {
    topicMap[topic.id] = topic.name;
    activeTopicIds.push(topic.id);
  }

  const availableTopics = Object.values(topicMap).sort();
  return { topicMap, activeTopicIds, availableTopics };
});

export const getAggregationsRawData = cache(async (period: DashboardPeriod) => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  const { activeTopicIds } = await getActiveTopics();
  if (activeTopicIds.length === 0) return [];

  const cutoffDate = getPeriodCutoffDate(period);

  let query = supabase
    .from("articles")
    .select("id, published_at, sentiment, source_name, categories, ai_processed, ai_error, url_decoded, decode_failed")
    .overlaps("matched_topic_ids", activeTopicIds);

  if (cutoffDate) {
    query = query.gte("published_at", cutoffDate.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching aggregations data:", error);
    return [];
  }

  return data ?? [];
});

export const getDashboardKPIs = cache(async (period: DashboardPeriod): Promise<KPIData> => {
  const data = await getAggregationsRawData(period);

  const totalArticles = data.length;

  const successfullyAnalyzed = data.filter((a) => a.ai_processed && a.ai_error == null);
  const analyzedCount = successfullyAnalyzed.length;

  const failedCount = data.filter((a) => a.ai_processed && a.ai_error != null).length;
  const pendingCount = data.filter((a) => !a.ai_processed && a.url_decoded === true && a.decode_failed !== true).length;
  const decodePendingCount = data.filter((a) => a.url_decoded === false).length;

  const positiveCount = successfullyAnalyzed.filter((a) => a.sentiment === "positive").length;
  const positivePercent = analyzedCount > 0 ? Math.round((positiveCount / analyzedCount) * 100) : 0;

  const uniqueSources = new Set(data.map((a) => a.source_name).filter(Boolean));
  const activeSources = uniqueSources.size;

  let lastUpdated: string | null = null;
  for (const a of data) {
    if (a.published_at && (!lastUpdated || new Date(a.published_at) > new Date(lastUpdated))) {
      lastUpdated = a.published_at;
    }
  }

  return {
    totalArticles,
    analyzedCount,
    failedCount,
    pendingCount,
    decodePendingCount,
    positivePercent,
    activeSources,
    lastUpdated,
  };
});

export const getSentimentAggregations = cache(async (period: DashboardPeriod) => {
  const data = await getAggregationsRawData(period);
  const cutoffDate = getPeriodCutoffDate(period);

  const successfullyAnalyzed = data.filter((a) => a.ai_processed && a.sentiment != null);

  const sentimentPieData: SentimentPieData = {
    positive: successfullyAnalyzed.filter((a) => a.sentiment === "positive").length,
    negative: successfullyAnalyzed.filter((a) => a.sentiment === "negative").length,
    neutral: successfullyAnalyzed.filter((a) => a.sentiment === "neutral").length,
    total: successfullyAnalyzed.length,
  };

  const sentimentByDay = new Map<string, { Positif: number; Netral: number; Negatif: number }>();
  for (const article of successfullyAnalyzed) {
    if (!article.published_at) continue;
    const day = format(new Date(article.published_at), "MMM d");
    const existing = sentimentByDay.get(day) || { Positif: 0, Netral: 0, Negatif: 0 };
    if (article.sentiment === "positive") existing.Positif++;
    else if (article.sentiment === "neutral") existing.Netral++;
    else if (article.sentiment === "negative") existing.Negatif++;
    sentimentByDay.set(day, existing);
  }

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

  return { sentimentData, sentimentPieData };
});

export const getSourcesAndCategories = cache(async (period: DashboardPeriod) => {
  const data = await getAggregationsRawData(period);

  const successfullyAnalyzed = data.filter((a) => a.ai_processed && a.sentiment != null);
  const sourcesCounts = new Map<string, number>();
  for (const article of successfullyAnalyzed) {
    if (!article.source_name) continue;
    sourcesCounts.set(article.source_name, (sourcesCounts.get(article.source_name) || 0) + 1);
  }

  const allSourcesData = Array.from(sourcesCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topSources = allSourcesData.slice(0, 6);
  const topSourcesTotal = topSources.reduce((sum, s) => sum + s.value, 0);
  const totalArticlesWithSource = allSourcesData.reduce((sum, s) => sum + s.value, 0);
  const othersCount = totalArticlesWithSource - topSourcesTotal;

  const sourcesData: SourceData[] = othersCount > 0
    ? [...topSources, { name: "Lainnya", value: othersCount }]
    : topSources;

  const categoryCounts = new Map<string, number>();
  for (const article of data) {
    if (!article.categories) continue;
    for (const category of article.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
  }

  const categoryData: CategoryData[] = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { sourcesData, allSourcesData, categoryData };
});

export const getPaginatedArticles = cache(async (
  page: number,
  limit: number,
  topicFilterId?: string | null
): Promise<{ articles: Article[], total: number }> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { articles: [], total: 0 };

  const { activeTopicIds } = await getActiveTopics();
  if (activeTopicIds.length === 0) return { articles: [], total: 0 };

  const filterTopics = topicFilterId && topicFilterId !== "all"
    ? [topicFilterId]
    : activeTopicIds;

  // First fetch total count for pagination
  const { count } = await supabase
    .from("articles")
    .select("id", { count: 'exact', head: true })
    .overlaps("matched_topic_ids", filterTopics);

  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // Then fetch the paginated slice
  const { data, error } = await supabase
    .from("articles")
    .select(dashboardArticleSelect)
    .overlaps("matched_topic_ids", filterTopics)
    .order("published_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Error fetching paginated articles:", error);
    return { articles: [], total: count ?? 0 };
  }

  const rows = (data ?? []) as DashboardArticleRow[];
  const articles = rows.map(toDashboardArticle);

  return { articles, total: count ?? 0 };
});
