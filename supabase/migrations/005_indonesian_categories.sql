-- Migration: 005_indonesian_categories.sql
-- Description: Migrate existing English categories to Indonesian
-- Date: 2026-02-11

-- ============================================================================
-- Migrate article categories from English to Indonesian
-- ============================================================================

-- This updates all existing articles with English category names to Indonesian.
-- The mapping is:
--   Production     -> Produksi
--   Exploration    -> Eksplorasi
--   Regulation     -> Regulasi
--   Investment     -> Investasi
--   Environment    -> Lingkungan
--   Infrastructure -> Infrastruktur
--   Safety         -> Keselamatan
--   Personnel      -> Personel
--   Market         -> Pasar
--   Community      -> Komunitas
--   Technology     -> Teknologi
--   General        -> Umum

UPDATE articles 
SET categories = (
  SELECT array_agg(
    CASE 
      WHEN cat = 'Production' THEN 'Produksi'
      WHEN cat = 'Exploration' THEN 'Eksplorasi'
      WHEN cat = 'Regulation' THEN 'Regulasi'
      WHEN cat = 'Investment' THEN 'Investasi'
      WHEN cat = 'Environment' THEN 'Lingkungan'
      WHEN cat = 'Infrastructure' THEN 'Infrastruktur'
      WHEN cat = 'Safety' THEN 'Keselamatan'
      WHEN cat = 'Personnel' THEN 'Personel'
      WHEN cat = 'Market' THEN 'Pasar'
      WHEN cat = 'Community' THEN 'Komunitas'
      WHEN cat = 'Technology' THEN 'Teknologi'
      WHEN cat = 'General' THEN 'Umum'
      ELSE cat  -- Keep unknown categories as-is
    END
  ) FROM unnest(categories) AS cat
)
WHERE categories IS NOT NULL 
  AND array_length(categories, 1) > 0;

-- Add a comment documenting the valid Indonesian categories
COMMENT ON COLUMN articles.categories IS 'AI-assigned categories in Indonesian: Produksi, Eksplorasi, Regulasi, Investasi, Lingkungan, Infrastruktur, Keselamatan, Personel, Pasar, Komunitas, Teknologi, Umum';
