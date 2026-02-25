"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTopics, dashboardArticleSelect, DashboardArticleRow, toDashboardArticle } from "@/lib/services/dashboard";
import type { Article, Sentiment } from "@/lib/types/news";

export interface FeedQueryParams {
    page: number;
    limit: number;
    search?: string;
    sentiment?: Sentiment | "all";
    topics?: string[];
    sortBy?: "newest" | "oldest";
}

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
                .filter(([_, name]) => params.topics!.includes(name))
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
    } catch (err: any) {
        return { articles: [], total: 0, error: err.message };
    }
}
