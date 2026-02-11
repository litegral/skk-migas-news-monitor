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
      search_queries: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          query: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
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
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          enabled?: boolean;
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
          snippet: string | null;
          photo_url: string | null;
          source_name: string | null;
          source_url: string | null;
          published_at: string | null;
          source_type: "rapidapi" | "rss";
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
          /** Array of topic names that this article matched against. */
          matched_topics: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          link: string;
          snippet?: string | null;
          photo_url?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          published_at?: string | null;
          source_type: "rapidapi" | "rss";
          summary?: string | null;
          sentiment?: "positive" | "negative" | "neutral" | null;
          categories?: string[] | null;
          ai_processed?: boolean;
          ai_error?: string | null;
          ai_processed_at?: string | null;
          full_content?: string | null;
          matched_topics?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          link?: string;
          snippet?: string | null;
          photo_url?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          published_at?: string | null;
          source_type?: "rapidapi" | "rss";
          summary?: string | null;
          sentiment?: "positive" | "negative" | "neutral" | null;
          categories?: string[] | null;
          ai_processed?: boolean;
          ai_error?: string | null;
          ai_processed_at?: string | null;
          full_content?: string | null;
          matched_topics?: string[];
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
export type SearchQueryRow = Database["public"]["Tables"]["search_queries"]["Row"];
export type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

/** Convenience aliases for insert types */
export type RSSFeedInsert = Database["public"]["Tables"]["rss_feeds"]["Insert"];
export type SearchQueryInsert = Database["public"]["Tables"]["search_queries"]["Insert"];
export type TopicInsert = Database["public"]["Tables"]["topics"]["Insert"];
export type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];

/** Convenience aliases for update types */
export type RSSFeedUpdate = Database["public"]["Tables"]["rss_feeds"]["Update"];
export type SearchQueryUpdate = Database["public"]["Tables"]["search_queries"]["Update"];
export type TopicUpdate = Database["public"]["Tables"]["topics"]["Update"];
export type ArticleUpdate = Database["public"]["Tables"]["articles"]["Update"];
