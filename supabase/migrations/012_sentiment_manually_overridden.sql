-- Migration 012: Manual sentiment override flag
--
-- When true, successful Groq analysis updates must not overwrite sentiment or ai_reason
-- so user-chosen labels persist across re-analysis.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS sentiment_manually_overridden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN articles.sentiment_manually_overridden IS
  'User corrected sentiment; LLM success path must preserve sentiment and ai_reason.';
