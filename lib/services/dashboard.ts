import type { ArticleRow } from "@/lib/types/database";
import type { Article } from "@/lib/types/news";

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
