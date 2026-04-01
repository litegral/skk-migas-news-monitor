"use server";

import { revalidatePath } from "next/cache";

import { getSharedUserId } from "@/lib/config/sharedData";
import { createClient } from "@/lib/supabase/server";
import { getActiveTopics, dashboardArticleSelect, DashboardArticleRow, toDashboardArticle } from "@/lib/services/dashboard";
import type { ArticleInsert } from "@/lib/types/database";
import type { Article, Sentiment } from "@/lib/types/news";
import { validateString, validateUuid } from "@/lib/utils/validateInput";
import { validateUrl } from "@/lib/utils/validateUrl";

/** Max rows returned in one export (PostgREST single-response limit). */
const MAX_EXPORT_ROWS = 10_000;

/** Max failed-analysis rows returned for the manual review modal. */
const MAX_FAILED_ARTICLES_FOR_REVIEW = 500;

export interface FeedQueryParams {
    page: number;
    limit: number;
    search?: string;
    sentiment?: Sentiment | "all";
    topics?: string[];
    categories?: string[];
    sources?: string[];
    sortBy?: "newest" | "oldest";
}

/** Same filters as the feed, without pagination; optional inclusive `published_at` bounds (ISO strings). */
export type ArticlesExportQueryParams = Omit<FeedQueryParams, "page" | "limit"> & {
    dateFrom?: string | null;
    dateTo?: string | null;
};

export async function getFeedArticlesAction(params: FeedQueryParams): Promise<{ articles: Article[]; total: number; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        const userId = claimsData?.claims?.sub;
        if (!userId) return { articles: [], total: 0, error: "Unauthorized" };

        const { activeTopicIds, topicMap } = await getActiveTopics();
        if (activeTopicIds.length === 0) return { articles: [], total: 0 };

        // Resolve topic names to IDs
        let filterTopicIds = activeTopicIds;
        if (params.topics && params.topics.length > 0) {
            filterTopicIds = Object.entries(topicMap)
                .filter((entry) => params.topics!.includes(entry[1]))
                .map(([id]) => id);
        }

        if (filterTopicIds.length === 0) {
            return { articles: [], total: 0 };
        }

        let query = supabase
            .from("articles")
            .select(dashboardArticleSelect, { count: "exact" })
            .overlaps("matched_topic_ids", filterTopicIds);

        if (params.sentiment && params.sentiment !== "all") {
            query = query.eq("sentiment", params.sentiment);
        }

        if (params.search && params.search.trim() !== "") {
            const searchTerms = `%${params.search.trim()}%`;
            query = query.or(`title.ilike.${searchTerms},summary.ilike.${searchTerms},source_name.ilike.${searchTerms}`);
        }

        if (params.categories && params.categories.length > 0) {
            query = query.overlaps("categories", params.categories);
        }

        if (params.sources && params.sources.length > 0) {
            query = query.in("source_name", params.sources);
        }

        const ascending = params.sortBy === "oldest";

        // Always fall back to id to ensure consistent pagination ordering
        query = query.order("published_at", { ascending, nullsFirst: false }).order("id", { ascending: false });

        const start = (params.page - 1) * params.limit;
        const end = start + params.limit - 1;

        query = query.range(start, end);

        const { data, count, error } = await query;

        if (error) {
            console.error("Error fetching feed articles:", error);
            return { articles: [], total: 0, error: error.message };
        }

        const rows = (data ?? []) as DashboardArticleRow[];
        const articles = rows.map(toDashboardArticle);

        return { articles, total: count ?? 0 };
    } catch (err: unknown) {
        return { articles: [], total: 0, error: err instanceof Error ? err.message : "Unknown error" };
    }
}

/**
 * Failed-analysis articles for the manual review modal (same topic scope as the feed).
 */
export async function getFailedArticlesAction(): Promise<{
    articles: Article[];
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims?.sub) {
            return { articles: [], error: "Unauthorized" };
        }

        const { activeTopicIds } = await getActiveTopics();
        if (activeTopicIds.length === 0) {
            return { articles: [] };
        }

        const sharedId = getSharedUserId();

        const { data, error } = await supabase
            .from("articles")
            .select(dashboardArticleSelect)
            .eq("user_id", sharedId)
            .eq("ai_processed", true)
            .not("ai_error", "is", null)
            .overlaps("matched_topic_ids", activeTopicIds)
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false })
            .limit(MAX_FAILED_ARTICLES_FOR_REVIEW);

        if (error) {
            console.error("[articles] getFailedArticles:", error.message);
            return { articles: [], error: error.message };
        }

        const rows = (data ?? []) as DashboardArticleRow[];
        return { articles: rows.map(toDashboardArticle) };
    } catch (err: unknown) {
        return {
            articles: [],
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

/**
 * Fetches all articles matching the current feed filters (up to MAX_EXPORT_ROWS).
 * Used for Excel export instead of paginated client state so date/month presets include
 * every matching row, not only the current page.
 */
export async function getArticlesForExportAction(
    params: ArticlesExportQueryParams,
): Promise<{ articles: Article[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        const userId = claimsData?.claims?.sub;
        if (!userId) return { articles: [], error: "Unauthorized" };

        const { activeTopicIds, topicMap } = await getActiveTopics();
        if (activeTopicIds.length === 0) return { articles: [] };

        let filterTopicIds = activeTopicIds;
        if (params.topics && params.topics.length > 0) {
            filterTopicIds = Object.entries(topicMap)
                .filter((entry) => params.topics!.includes(entry[1]))
                .map(([id]) => id);
        }

        if (filterTopicIds.length === 0) {
            return { articles: [] };
        }

        let query = supabase
            .from("articles")
            .select(dashboardArticleSelect)
            .overlaps("matched_topic_ids", filterTopicIds);

        if (params.sentiment && params.sentiment !== "all") {
            query = query.eq("sentiment", params.sentiment);
        }

        if (params.search && params.search.trim() !== "") {
            const searchTerms = `%${params.search.trim()}%`;
            query = query.or(`title.ilike.${searchTerms},summary.ilike.${searchTerms},source_name.ilike.${searchTerms}`);
        }

        if (params.categories && params.categories.length > 0) {
            query = query.overlaps("categories", params.categories);
        }

        if (params.sources && params.sources.length > 0) {
            query = query.in("source_name", params.sources);
        }

        if (params.dateFrom && params.dateTo) {
            query = query
                .gte("published_at", params.dateFrom)
                .lte("published_at", params.dateTo);
        }

        const ascending = params.sortBy === "oldest";

        query = query
            .order("published_at", { ascending, nullsFirst: false })
            .order("id", { ascending: false })
            .limit(MAX_EXPORT_ROWS);

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching articles for export:", error);
            return { articles: [], error: error.message };
        }

        const rows = (data ?? []) as DashboardArticleRow[];
        return { articles: rows.map(toDashboardArticle) };
    } catch (err: unknown) {
        return {
            articles: [],
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

function validateSentiment(value: unknown): { valid: true; value: Sentiment } | { valid: false; error: string } {
    if (typeof value !== "string") {
        return { valid: false, error: "Sentiment must be a string" };
    }
    const v = value.trim().toLowerCase();
    if (v === "positive" || v === "neutral" || v === "negative") {
        return { valid: true, value: v };
    }
    return { valid: false, error: "Invalid sentiment" };
}

export interface UpdateArticleSentimentResult {
    success: boolean;
    error?: string;
}

/**
 * Sets an article's sentiment for the shared workspace and locks it against LLM overwrites.
 */
export async function updateArticleSentimentAction(
    articleId: string,
    sentiment: Sentiment,
): Promise<UpdateArticleSentimentResult> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims?.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const idVal = validateUuid(articleId, "article id");
        if (!idVal.valid) {
            return { success: false, error: idVal.error };
        }

        const sVal = validateSentiment(sentiment);
        if (!sVal.valid) {
            return { success: false, error: sVal.error };
        }

        const sharedId = getSharedUserId();

        const { data: updated, error: updateErr } = await supabase
            .from("articles")
            .update({
                sentiment: sVal.value,
                sentiment_manually_overridden: true,
                ai_error: null,
                ai_reason: null,
            })
            .eq("id", idVal.value!)
            .eq("user_id", sharedId)
            .select("id")
            .maybeSingle();

        if (updateErr) {
            console.error("[articles] updateArticleSentiment:", updateErr.message);
            return { success: false, error: "Failed to update sentiment" };
        }

        if (!updated) {
            return {
                success: false,
                error: "Artikel tidak ditemukan",
            };
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("[articles] updateArticleSentiment:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to update sentiment",
        };
    }
}

export async function getArticleFilterOptionsAction(): Promise<{ categories: string[]; sources: string[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        const userId = claimsData?.claims?.sub;

        if (!userId) {
            return { categories: [], sources: [], error: "Unauthorized" };
        }

        // To get distinct values efficiently, we'll fetch only the columns we need.
        // For a very large dataset, a dedicated RPC or distinct view might be better,
        // but this works for standard dashboard volumes.
        const { data, error } = await supabase
            .from("articles")
            .select("categories, source_name")
            .eq("user_id", getSharedUserId())
            .eq("ai_processed", true);

        if (error) {
            console.error("Error fetching filter options:", error);
            return { categories: [], sources: [], error: error.message };
        }

        const uniqueCategories = new Set<string>();
        const uniqueSources = new Set<string>();

        for (const row of data || []) {
            if (row.source_name) {
                uniqueSources.add(row.source_name);
            }
            if (row.categories && Array.isArray(row.categories)) {
                for (const cat of row.categories) {
                    uniqueCategories.add(cat);
                }
            }
        }

        return {
            categories: Array.from(uniqueCategories).sort(),
            sources: Array.from(uniqueSources).sort()
        };
    } catch (err: unknown) {
        return { categories: [], sources: [], error: err instanceof Error ? err.message : "Unknown error" };
    }
}

export interface AddCustomArticleInput {
    title: string;
    link: string;
    sourceName: string;
    /** When set, stored with sentiment_manually_overridden so Groq preserves it on first analyze. */
    sentiment?: Sentiment;
}

export interface AddCustomArticleResult {
    success: boolean;
    error?: string;
}

/**
 * Insert a user-submitted article into the shared workspace. The normal
 * decode → crawl → analyze pipeline picks it up on the next sync/cron run.
 */
export async function addCustomArticleAction(
    input: AddCustomArticleInput,
): Promise<AddCustomArticleResult> {
    try {
        const supabase = await createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims?.sub) {
            return { success: false, error: "Unauthorized" };
        }

        const titleValidation = validateString(input.title, "title", {
            minLength: 1,
            maxLength: 500,
        });
        if (!titleValidation.valid) {
            return { success: false, error: titleValidation.error };
        }

        const urlValidation = validateUrl(input.link, { maxLength: 2048 });
        if (!urlValidation.valid || !urlValidation.normalizedUrl) {
            return { success: false, error: urlValidation.error ?? "Invalid URL" };
        }
        const normalizedLink = urlValidation.normalizedUrl;

        const sourceNameValidation = validateString(input.sourceName, "Nama media", {
            minLength: 1,
            maxLength: 200,
        });
        if (!sourceNameValidation.valid) {
            return { success: false, error: sourceNameValidation.error };
        }
        const sourceName = sourceNameValidation.value!;

        const { data: enabledTopicRows, error: topicsErr } = await supabase
            .from("topics")
            .select("id")
            .eq("enabled", true);

        if (topicsErr) {
            console.error("[articles] addCustomArticle topics:", topicsErr.message);
            return { success: false, error: "Failed to load topics" };
        }

        const matchedTopicIds = (enabledTopicRows ?? []).map((row) => row.id);
        if (matchedTopicIds.length === 0) {
            return {
                success: false,
                error: "Aktifkan setidaknya satu topik di pengaturan agar artikel bisa muncul di feed.",
            };
        }

        let sourceUrl: string | null = null;
        try {
            sourceUrl = new URL(normalizedLink).origin;
        } catch {
            sourceUrl = null;
        }

        const sharedId = getSharedUserId();

        let presetSentiment: Sentiment | undefined;
        if (input.sentiment !== undefined) {
            const sVal = validateSentiment(input.sentiment);
            if (!sVal.valid) {
                return { success: false, error: sVal.error };
            }
            presetSentiment = sVal.value;
        }

        const insertRow: ArticleInsert = {
            user_id: sharedId,
            title: titleValidation.value!,
            link: normalizedLink,
            snippet: null,
            photo_url: null,
            source_name: sourceName,
            source_url: sourceUrl,
            published_at: null,
            source_type: "custom",
            matched_topic_ids: matchedTopicIds,
            ai_processed: false,
            url_decoded: false,
            decode_failed: false,
            ...(presetSentiment !== undefined
                ? { sentiment: presetSentiment, sentiment_manually_overridden: true }
                : {}),
        };

        const { error: insertErr } = await supabase.from("articles").insert(insertRow);

        if (insertErr) {
            if (insertErr.code === "23505") {
                return {
                    success: false,
                    error: "An article with this URL already exists",
                };
            }
            console.error("[articles] addCustomArticle insert:", insertErr.message);
            return { success: false, error: "Failed to save article" };
        }

        revalidatePath("/settings");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("[articles] addCustomArticle:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to save article",
        };
    }
}
