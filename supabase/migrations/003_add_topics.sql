-- Migration: 003_add_topics.sql
-- Description: Add topics table and matched_topics field for topic-based filtering
-- Date: 2026-02-11

-- ============================================================================
-- Topics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- RLS policies
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics_select_own" ON topics 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "topics_insert_own" ON topics 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topics_update_own" ON topics 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "topics_delete_own" ON topics 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER topics_updated_at 
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_enabled ON topics(user_id, enabled);

-- ============================================================================
-- Add matched_topics to articles
-- ============================================================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS matched_topics TEXT[] DEFAULT '{}';

COMMENT ON COLUMN articles.matched_topics IS 'Array of topic names that this article matched against.';

-- Index for topic filtering
CREATE INDEX IF NOT EXISTS idx_articles_matched_topics ON articles USING GIN (matched_topics);
