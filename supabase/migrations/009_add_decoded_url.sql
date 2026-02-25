-- Migration 009: Add decoded_url column for proper deduplication
--
-- Problem: When Google News URLs are decoded, the `link` field is updated
-- to the actual article URL. This breaks deduplication because:
-- 1. Article inserted with Google News URL
-- 2. URL decode updates `link` to actual URL
-- 3. Next fetch finds same article via Google News URL
-- 4. Deduplication query checks DB for Google News URL
-- 5. DB has decoded URL - NO MATCH
-- 6. Duplicate inserted!
--
-- Solution: Keep original `link` unchanged, store decoded URL in `decoded_url`.
-- Use `decoded_url` for crawling, `link` for deduplication.

-- Add decoded_url column
ALTER TABLE articles ADD COLUMN IF NOT EXISTS decoded_url TEXT;

-- For existing rows where url_decoded=true and source_type='googlenews',
-- the current `link` IS the decoded URL. We need to restore original.
-- Unfortunately we can't reverse the decoding, so we leave them as-is.
-- New articles will use the correct pattern.

-- Add comment for documentation
COMMENT ON COLUMN articles.decoded_url IS 'Decoded URL for Google News articles. NULL for RSS articles or undecoded Google News. Use this for crawling, use `link` for deduplication.';
