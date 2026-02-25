-- Migration 007: Topic improvements
--
-- Changes:
-- 1. Add last_fetched_at to topics (for per-topic incremental fetching)
-- 2. Add matched_topic_ids (uuid[]) to articles (replaces matched_topics text[])
-- 3. Backfill matched_topic_ids from matched_topics
-- 4. Drop matched_topics column
-- 5. Add GIN index on matched_topic_ids for array overlap queries
-- 6. Add RPC function to remove topic ID from articles on delete

-- 1. Add last_fetched_at to topics
-- NULL = never fetched → triggers 7-day lookback on next fetch
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz DEFAULT NULL;

-- Set existing topics as "already fetched" so they don't all re-fetch 7 days of history
UPDATE topics SET last_fetched_at = NOW() WHERE last_fetched_at IS NULL;

-- 2. Add matched_topic_ids column alongside existing matched_topics
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS matched_topic_ids uuid[] DEFAULT '{}';

-- 3. Backfill matched_topic_ids by resolving topic names → IDs
-- For each article, find topics owned by the same user whose name is in matched_topics
UPDATE articles a
SET matched_topic_ids = COALESCE(
  (
    SELECT array_agg(DISTINCT t.id)
    FROM topics t
    WHERE t.user_id = a.user_id
      AND t.name = ANY(a.matched_topics)
  ),
  '{}'
);

-- 4. Drop the old matched_topics text[] column
ALTER TABLE articles DROP COLUMN IF EXISTS matched_topics;

-- 5. Add GIN index for fast array overlap queries (WHERE matched_topic_ids && ARRAY[...])
CREATE INDEX IF NOT EXISTS idx_articles_matched_topic_ids
  ON articles USING gin(matched_topic_ids);

-- 6. Create RPC function to remove a topic ID from all articles' matched_topic_ids
-- This is called when a topic is deleted
CREATE OR REPLACE FUNCTION remove_topic_from_articles(
  p_topic_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE articles
  SET matched_topic_ids = array_remove(matched_topic_ids, p_topic_id)
  WHERE user_id = p_user_id
    AND p_topic_id = ANY(matched_topic_ids);
  
  -- Optionally delete articles that no longer match any topics
  -- Uncomment the following if you want orphaned articles to be deleted:
  -- DELETE FROM articles WHERE user_id = p_user_id AND cardinality(matched_topic_ids) = 0;
END;
$$;
