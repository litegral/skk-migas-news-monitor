/**
 * Supabase database types.
 *
 * This is a hand-written stub matching the planned schema.
 * Regenerate with:
 *   pnpm supabase gen types typescript --project-id <id> > lib/types/database.ts
 *
 * After regeneration this file will be fully replaced by the CLI output.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      rss_feeds: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          url: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          url: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          /** Keywords for OR-based article matching. If empty, topic name is used. */
          keywords: string[];
          enabled: boolean;
          /** When this topic was last fetched. NULL = never fetched (triggers 7-day lookback). */
          last_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          keywords?: string[];
          enabled?: boolean;
          last_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          keywords?: string[];
          enabled?: boolean;
          last_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          link: string;
          /** Decoded URL for Google News articles. Use for crawling. */
          decoded_url: string | null;
          snippet: string | null;
          photo_url: string | null;
          source_name: string | null;
          source_url: string | null;
          published_at: string | null;
          source_type: "googlenews" | "rss";
          summary: string | null;
          sentiment: "positive" | "negative" | "neutral" | null;
          categories: string[] | null;
          ai_processed: boolean;
          /** Error message if AI analysis failed. NULL indicates success. */
          ai_error: string | null;
          /** Timestamp of when AI processing was attempted. */
          ai_processed_at: string | null;
          /** Full crawled article content (from Crawl4AI). */
          full_content: string | null;
          /** Array of topic IDs (UUIDs) that this article matched against. */
          matched_topic_ids: string[];
          /** Whether the article URL has been decoded (Google News URLs need decoding). */
          url_decoded: boolean;
          /** Whether URL decoding failed (still marked url_decoded=true to prevent retries). */
          decode_failed: boolean;
          /** LLM's explanation for why it chose the sentiment/categories. */
          ai_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          link: string;
          decoded_url?: string | null;
          snippet?: string | null;
          photo_url?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          published_at?: string | null;
          source_type: "googlenews" | "rss";
          summary?: string | null;
          sentiment?: "positive" | "negative" | "neutral" | null;
          categories?: string[] | null;
          ai_processed?: boolean;
          ai_error?: string | null;
          ai_processed_at?: string | null;
          full_content?: string | null;
          matched_topic_ids?: string[];
          url_decoded?: boolean;
          decode_failed?: boolean;
          ai_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          link?: string;
          decoded_url?: string | null;
          snippet?: string | null;
          photo_url?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          published_at?: string | null;
          source_type?: "googlenews" | "rss";
          summary?: string | null;
          sentiment?: "positive" | "negative" | "neutral" | null;
          categories?: string[] | null;
          ai_processed?: boolean;
          ai_error?: string | null;
          ai_processed_at?: string | null;
          full_content?: string | null;
          matched_topic_ids?: string[];
          url_decoded?: boolean;
          decode_failed?: boolean;
          ai_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** Convenience aliases for row types */
export type RSSFeedRow = Database["public"]["Tables"]["rss_feeds"]["Row"];
export type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

/** Convenience aliases for insert types */
export type RSSFeedInsert = Database["public"]["Tables"]["rss_feeds"]["Insert"];
export type TopicInsert = Database["public"]["Tables"]["topics"]["Insert"];
export type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];

/** Convenience aliases for update types */
export type RSSFeedUpdate = Database["public"]["Tables"]["rss_feeds"]["Update"];
export type TopicUpdate = Database["public"]["Tables"]["topics"]["Update"];
export type ArticleUpdate = Database["public"]["Tables"]["articles"]["Update"];
