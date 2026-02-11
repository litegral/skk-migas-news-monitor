/**
 * Supabase database types.
 *
 * This is a hand-written stub matching the planned 3-table schema.
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
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
