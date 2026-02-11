-- Migration: 004_topic_keywords.sql
-- Description: Add keywords array to topics for OR-based article matching
-- Date: 2026-02-11

-- ============================================================================
-- Add keywords column to topics table
-- ============================================================================

ALTER TABLE topics ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

COMMENT ON COLUMN topics.keywords IS 'Array of keywords for OR-based article matching. If empty, topic name is used for matching.';

-- ============================================================================
-- Index for keyword-based queries (optional, for future use)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topics_keywords ON topics USING GIN (keywords);
