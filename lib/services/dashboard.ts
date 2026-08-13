import { cache } from "react";
import {
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  startOfDay,
  startOfHour,
  subDays,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSharedUserId } from "@/lib/config/sharedData";
import {
  getPeriodCutoffDate,
  PERIOD_OPTIONS,
  type DashboardPeriod,
  type KPIComparisonData,
  type TopicWatchInsight,
} from "@/lib/types/dashboard";
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
  "id,title,link,decoded_url,snippet,photo_url,source_name,source_url,published_at,source_type,summary,sentiment,sentiment_manually_overridden,categories,ai_processed,ai_error,ai_processed_at,matched_topic_ids,url_decoded,decode_failed,ai_reason,created_at,updated_at";

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
  | "sentiment_manually_overridden"
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
    sentimentManuallyOverridden: row.sentiment_manually_overridden,
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

/**
 * Feed filter metadata, cached per server render so the dashboard can hydrate
 * with complete controls instead of issuing a second client-side request.
 */
export const getArticleFilterOptions = cache(async (): Promise<{
  categories: string[];
  sources: string[];
}> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { categories: [], sources: [] };
  }

  const { data, error } = await supabase
    .from("articles")
    .select("categories, source_name")
    .eq("user_id", getSharedUserId())
    .eq("ai_processed", true)
    .eq("is_hidden", false);

  if (error) {
    console.error("Error fetching article filter options:", error);
    return { categories: [], sources: [] };
  }

  const categories = new Set<string>();
  const sources = new Set<string>();

  for (const row of data ?? []) {
    if (row.source_name) sources.add(row.source_name);
    for (const category of row.categories ?? []) categories.add(category);
  }

  return {
    categories: Array.from(categories).sort(),
    sources: Array.from(sources).sort(),
  };
});

/** PostgREST default max rows per request; paginate past this in getAggregationsRawData. */
const AGGREGATION_PAGE_SIZE = 1000;

const aggregationSelect =
  "id, published_at, sentiment, source_name, categories, matched_topic_ids, ai_processed, ai_error, url_decoded, decode_failed";

type DashboardAggregationRow = Pick<
  ArticleRow,
  | "id"
  | "published_at"
  | "sentiment"
  | "source_name"
  | "categories"
  | "matched_topic_ids"
  | "ai_processed"
  | "ai_error"
  | "url_decoded"
  | "decode_failed"
>;

export const getAggregationsRawData = cache(async (period: DashboardPeriod) => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  const { activeTopicIds } = await getActiveTopics();
  if (activeTopicIds.length === 0) return [];

  const cutoffDate = getPeriodCutoffDate(period);

  const all: DashboardAggregationRow[] = [];
  let offset = 0;

  for (;;) {
    let query = supabase
      .from("articles")
      .select(aggregationSelect)
      .eq("is_hidden", false)
      .overlaps("matched_topic_ids", activeTopicIds);

    if (cutoffDate) {
      query = query.gte("published_at", cutoffDate.toISOString());
    }

    const { data, error } = await query.range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching aggregations data:", error);
      return [];
    }

    const page = (data ?? []) as DashboardAggregationRow[];
    all.push(...page);

    if (page.length < AGGREGATION_PAGE_SIZE) {
      break;
    }
    offset += AGGREGATION_PAGE_SIZE;
  }

  return all;
});

function calculateChangePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

const getPreviousPeriodRows = cache(async (
  period: DashboardPeriod,
): Promise<DashboardAggregationRow[]> => {
  const days = PERIOD_OPTIONS.find((option) => option.value === period)?.days ?? null;
  if (days === null) return [];

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return [];

  const { activeTopicIds } = await getActiveTopics();
  if (activeTopicIds.length === 0) return [];

  const currentStart = getPeriodCutoffDate(period);
  if (!currentStart) return [];
  const previousStart = subDays(currentStart, days);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const rows: DashboardAggregationRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("articles")
      .select(aggregationSelect)
      .eq("is_hidden", false)
      .overlaps("matched_topic_ids", activeTopicIds)
      .gte("published_at", previousStart.toISOString())
      .lte("published_at", previousEnd.toISOString())
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching previous-period KPI data:", error);
      return [];
    }

    const page = (data ?? []) as DashboardAggregationRow[];
    rows.push(...page);
    if (page.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
});

export const getKPIComparisons = cache(async (
  period: DashboardPeriod,
): Promise<KPIComparisonData> => {
  const [currentRows, previousRows] = await Promise.all([
    getAggregationsRawData(period),
    getPreviousPeriodRows(period),
  ]);
  const hasPreviousPeriod = period !== "all";

  const countSentiment = (rows: DashboardAggregationRow[], sentiment: string) =>
    rows.filter((row) => row.ai_processed && row.sentiment === sentiment).length;

  const values = {
    total: [currentRows.length, previousRows.length],
    positive: [countSentiment(currentRows, "positive"), countSentiment(previousRows, "positive")],
    negative: [countSentiment(currentRows, "negative"), countSentiment(previousRows, "negative")],
    neutral: [countSentiment(currentRows, "neutral"), countSentiment(previousRows, "neutral")],
  } as const;

  const comparison = (value: number, previous: number) => ({
    value,
    changePercent: hasPreviousPeriod ? calculateChangePercent(value, previous) : null,
  });

  return {
    total: comparison(...values.total),
    positive: comparison(...values.positive),
    negative: comparison(...values.negative),
    neutral: comparison(...values.neutral),
    hasPreviousPeriod,
  };
});

interface TopicAccumulator {
  articles: number;
  analyzed: number;
  negative: number;
}

function aggregateTopics(rows: DashboardAggregationRow[]): Map<string, TopicAccumulator> {
  const topics = new Map<string, TopicAccumulator>();

  for (const row of rows) {
    for (const topicId of row.matched_topic_ids ?? []) {
      const value = topics.get(topicId) ?? { articles: 0, analyzed: 0, negative: 0 };
      value.articles++;
      if (row.ai_processed && row.sentiment) {
        value.analyzed++;
        if (row.sentiment === "negative") value.negative++;
      }
      topics.set(topicId, value);
    }
  }

  return topics;
}

/**
 * Ranks configured topics for shared-monitor visibility. The score is explicit:
 * status priority, negative share, growth, then current article volume.
 */
export const getTopicWatchInsights = cache(async (
  period: DashboardPeriod,
): Promise<TopicWatchInsight[]> => {
  const [{ topicMap }, currentRows, previousRows] = await Promise.all([
    getActiveTopics(),
    getAggregationsRawData(period),
    getPreviousPeriodRows(period),
  ]);
  const currentTopics = aggregateTopics(currentRows);
  const previousTopics = aggregateTopics(previousRows);

  return Array.from(currentTopics.entries())
    .map(([id, current]) => {
      const previousArticles = previousTopics.get(id)?.articles ?? 0;
      const changePercent = period === "all"
        ? null
        : calculateChangePercent(current.articles, previousArticles);
      const negativeShare = current.analyzed > 0
        ? Math.round((current.negative / current.analyzed) * 100)
        : 0;
      const isPriority = current.articles >= 2 && negativeShare >= 40;
      const isRising = period !== "all" && current.articles >= 2 &&
        (changePercent === null ? previousArticles === 0 : changePercent >= 50);
      const status = isPriority ? "priority" : isRising ? "rising" : "stable";

      return {
        id,
        name: topicMap[id] ?? "Topik tanpa nama",
        articles: current.articles,
        negativeShare,
        changePercent,
        status,
      } satisfies TopicWatchInsight;
    })
    .sort((a, b) => {
      const statusWeight = { priority: 3, rising: 2, stable: 1 } as const;
      return statusWeight[b.status] - statusWeight[a.status] ||
        b.negativeShare - a.negativeShare ||
        (b.changePercent ?? 0) - (a.changePercent ?? 0) ||
        b.articles - a.articles;
    })
    .slice(0, 5);
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

  const isHourly = period === "24h";
  const sentimentByBucket = new Map<string, { Positif: number; Netral: number; Negatif: number }>();
  for (const article of successfullyAnalyzed) {
    if (!article.published_at) continue;
    const bucketKey = format(
      new Date(article.published_at),
      isHourly ? "yyyy-MM-dd HH" : "MMM d",
    );
    const existing = sentimentByBucket.get(bucketKey) || { Positif: 0, Netral: 0, Negatif: 0 };
    if (article.sentiment === "positive") existing.Positif++;
    else if (article.sentiment === "neutral") existing.Netral++;
    else if (article.sentiment === "negative") existing.Negatif++;
    sentimentByBucket.set(bucketKey, existing);
  }

  const today = startOfDay(new Date());
  const startDate = cutoffDate ? startOfDay(cutoffDate) : today;
  const allDatesInRange = isHourly && cutoffDate
    ? eachHourOfInterval({ start: startOfHour(cutoffDate), end: startOfHour(new Date()) })
    : eachDayOfInterval({ start: startDate, end: today });

  const sentimentData: SentimentDataPoint[] = allDatesInRange.map((date) => {
    const bucketKey = format(date, isHourly ? "yyyy-MM-dd HH" : "MMM d");
    const existing = sentimentByBucket.get(bucketKey);
    return {
      date: format(date, isHourly ? "HH:mm" : "MMM d"),
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

  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const [{ count }, { data, error }] = await Promise.all([
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", false)
      .overlaps("matched_topic_ids", filterTopics),
    supabase
      .from("articles")
      .select(dashboardArticleSelect)
      .eq("is_hidden", false)
      .overlaps("matched_topic_ids", filterTopics)
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, end),
  ]);

  if (error) {
    console.error("Error fetching paginated articles:", error);
    return { articles: [], total: count ?? 0 };
  }

  const rows = (data ?? []) as DashboardArticleRow[];
  const articles = rows.map(toDashboardArticle);

  return { articles, total: count ?? 0 };
});
