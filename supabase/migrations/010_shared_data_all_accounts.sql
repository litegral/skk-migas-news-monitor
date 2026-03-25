-- Migration 010: Shared data for all authenticated accounts
--
-- Before applying (supabase db push / SQL editor):
-- 1. The Auth user below must exist in auth.users (same as SHARED_DATA_USER_ID in .env).
--
-- Shared owner UUID:
-- 890b03cb-84e1-4087-8776-95df079b78e1

-- ============================================================================
-- 1. Deduplicate topics by name: remap matched_topic_ids, then drop duplicates
-- ============================================================================

WITH canon AS (
  SELECT DISTINCT ON (name) id AS canonical_id, name
  FROM topics
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT t.id AS old_id, c.canonical_id AS new_id
  FROM topics t
  JOIN canon c ON c.name = t.name AND t.id <> c.canonical_id
)
UPDATE articles a
SET matched_topic_ids = COALESCE((
  SELECT ARRAY_AGG(DISTINCT sub.x)
  FROM (
    SELECT COALESCE(d.new_id, u.elem) AS x
    FROM unnest(COALESCE(a.matched_topic_ids, '{}')) AS u(elem)
    LEFT JOIN dupes d ON d.old_id = u.elem
  ) sub
), '{}');

WITH canon AS (
  SELECT DISTINCT ON (name) id AS canonical_id, name
  FROM topics
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT t.id AS old_id, c.canonical_id AS new_id
  FROM topics t
  JOIN canon c ON c.name = t.name AND t.id <> c.canonical_id
)
DELETE FROM topics t
WHERE t.id IN (SELECT old_id FROM dupes);

-- ============================================================================
-- 2. Merge matched_topic_ids for duplicate article links, then keep newest row
-- ============================================================================

UPDATE articles a
SET matched_topic_ids = COALESCE((
  SELECT ARRAY_AGG(DISTINCT elem)
  FROM articles a2
  CROSS JOIN LATERAL unnest(COALESCE(a2.matched_topic_ids, '{}')) AS elem
  WHERE a2.link = a.link
), '{}');

DELETE FROM articles a
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY link
             ORDER BY updated_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM articles
  ) sub
  WHERE rn > 1
);

-- ============================================================================
-- 3. Deduplicate RSS feeds by url (keep oldest)
-- ============================================================================

DELETE FROM rss_feeds r
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY url ORDER BY created_at ASC) AS rn
    FROM rss_feeds
  ) sub
  WHERE rn > 1
);

-- ============================================================================
-- 4. Assign canonical owner
-- ============================================================================

UPDATE rss_feeds SET user_id = '890b03cb-84e1-4087-8776-95df079b78e1'::uuid;
UPDATE topics SET user_id = '890b03cb-84e1-4087-8776-95df079b78e1'::uuid;
UPDATE articles SET user_id = '890b03cb-84e1-4087-8776-95df079b78e1'::uuid;

-- ============================================================================
-- 5. RLS: any authenticated user can CRUD shared tables
-- ============================================================================

DROP POLICY IF EXISTS "rss_feeds_select_own" ON rss_feeds;
DROP POLICY IF EXISTS "rss_feeds_insert_own" ON rss_feeds;
DROP POLICY IF EXISTS "rss_feeds_update_own" ON rss_feeds;
DROP POLICY IF EXISTS "rss_feeds_delete_own" ON rss_feeds;

CREATE POLICY "rss_feeds_select_authenticated" ON rss_feeds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rss_feeds_insert_authenticated" ON rss_feeds
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rss_feeds_update_authenticated" ON rss_feeds
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rss_feeds_delete_authenticated" ON rss_feeds
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "topics_select_own" ON topics;
DROP POLICY IF EXISTS "topics_insert_own" ON topics;
DROP POLICY IF EXISTS "topics_update_own" ON topics;
DROP POLICY IF EXISTS "topics_delete_own" ON topics;

CREATE POLICY "topics_select_authenticated" ON topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics_insert_authenticated" ON topics
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "topics_update_authenticated" ON topics
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "topics_delete_authenticated" ON topics
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "articles_select_own" ON articles;
DROP POLICY IF EXISTS "articles_insert_own" ON articles;
DROP POLICY IF EXISTS "articles_update_own" ON articles;
DROP POLICY IF EXISTS "articles_delete_own" ON articles;

CREATE POLICY "articles_select_authenticated" ON articles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "articles_insert_authenticated" ON articles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "articles_update_authenticated" ON articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "articles_delete_authenticated" ON articles
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 6. RPC: remove topic id from all articles (no per-user filter)
-- ============================================================================

DROP FUNCTION IF EXISTS remove_topic_from_articles(uuid, uuid);

CREATE OR REPLACE FUNCTION remove_topic_from_articles(p_topic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE articles
  SET matched_topic_ids = array_remove(matched_topic_ids, p_topic_id)
  WHERE p_topic_id = ANY(matched_topic_ids);
END;
$$;
