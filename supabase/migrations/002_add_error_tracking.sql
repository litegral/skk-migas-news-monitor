-- Migration: 002_add_error_tracking.sql
-- Description: Add error tracking fields to articles table for robust AI processing
-- Date: 2026-02-11

-- ============================================================================
-- Add AI error tracking columns
-- ============================================================================

-- Store error message when AI analysis fails
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_error TEXT;

-- Store timestamp of when AI processing was attempted
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- ============================================================================
-- Add full content storage
-- ============================================================================

-- Store crawled article content for re-analysis without re-crawling
ALTER TABLE articles ADD COLUMN IF NOT EXISTS full_content TEXT;

-- ============================================================================
-- Update comments for documentation
-- ============================================================================

COMMENT ON COLUMN articles.ai_error IS 'Error message if AI analysis failed. NULL indicates success.';
COMMENT ON COLUMN articles.ai_processed_at IS 'Timestamp of when AI processing was attempted.';
COMMENT ON COLUMN articles.full_content IS 'Full crawled article content (from Crawl4AI). Max ~4000 chars.';
