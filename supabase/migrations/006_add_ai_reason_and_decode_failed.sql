-- Migration 006: Add ai_reason and decode_failed columns to articles table
--
-- ai_reason: Stores the LLM's explanation for why it chose a particular sentiment.
--            Useful for evaluating and auditing AI analysis accuracy.
--
-- decode_failed: Distinguishes between "URL successfully decoded" and "decode failed
--                but marked as decoded to prevent infinite retries". Articles with
--                decode_failed = true are skipped during AI analysis since we can't
--                crawl their actual content.

-- Add ai_reason column (nullable text, same type as summary)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_reason text;

-- Add decode_failed column (boolean, defaults to false)
-- Existing articles with url_decoded = true are assumed to have decoded successfully.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS decode_failed boolean NOT NULL DEFAULT false;

-- Index to efficiently filter out decode-failed articles during analysis
-- The analysis query filters: ai_processed = false AND url_decoded = true AND decode_failed = false
CREATE INDEX IF NOT EXISTS idx_articles_analysis_candidates
  ON articles (user_id, ai_processed, url_decoded, decode_failed)
  WHERE ai_processed = false AND url_decoded = true AND decode_failed = false;
