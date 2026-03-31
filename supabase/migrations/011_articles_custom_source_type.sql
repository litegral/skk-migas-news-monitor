-- Migration 011: Allow manual/custom articles (source_type = 'custom')
--
-- Extends the articles.source_type CHECK constraint to include 'custom' and
-- legacy 'rapidapi' values that may exist from older schemas.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'articles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%source_type%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.articles DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_source_type_check
  CHECK (source_type IN ('googlenews', 'rss', 'custom', 'rapidapi'));

COMMENT ON CONSTRAINT articles_source_type_check ON public.articles IS
  'Article origin: Google News fetch, RSS, user-added custom, or legacy rapidapi.';
