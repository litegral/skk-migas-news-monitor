-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for SKK Migas News Monitor
-- Date: 2026-02-11

-- ============================================================================
-- Helper function for updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RSS Feeds Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  url TEXT NOT NULL CHECK (char_length(url) <= 2048),
  enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, url)
);

-- RLS policies
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rss_feeds_select_own" ON rss_feeds 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rss_feeds_insert_own" ON rss_feeds 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rss_feeds_update_own" ON rss_feeds 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "rss_feeds_delete_own" ON rss_feeds 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER rss_feeds_updated_at 
  BEFORE UPDATE ON rss_feeds
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user_id ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_enabled ON rss_feeds(user_id, enabled);

-- ============================================================================
-- Search Queries Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL CHECK (char_length(query) <= 200),
  enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, query)
);

-- RLS policies
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_queries_select_own" ON search_queries 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "search_queries_insert_own" ON search_queries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "search_queries_update_own" ON search_queries 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "search_queries_delete_own" ON search_queries 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER search_queries_updated_at 
  BEFORE UPDATE ON search_queries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_enabled ON search_queries(user_id, enabled);

-- ============================================================================
-- Articles Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Core article data
  title TEXT NOT NULL CHECK (char_length(title) <= 500),
  link TEXT NOT NULL CHECK (char_length(link) <= 2048),
  snippet TEXT CHECK (char_length(snippet) <= 1000),
  photo_url TEXT CHECK (char_length(photo_url) <= 2048),
  source_name TEXT CHECK (char_length(source_name) <= 200),
  source_url TEXT CHECK (char_length(source_url) <= 2048),
  published_at TIMESTAMPTZ,
  source_type TEXT NOT NULL CHECK (source_type IN ('rapidapi', 'rss')),
  
  -- AI analysis results
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  categories TEXT[],
  ai_processed BOOLEAN DEFAULT false NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Unique constraint for deduplication
  UNIQUE(user_id, link)
);

-- RLS policies
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_select_own" ON articles 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "articles_insert_own" ON articles 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "articles_update_own" ON articles 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "articles_delete_own" ON articles 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER articles_updated_at 
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_ai_processed ON articles(user_id, ai_processed);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(user_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(user_id, sentiment);
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(user_id, source_type);
