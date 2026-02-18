# Plan: Add AI Reason Column & Skip Analysis Without Content

## Overview

Two improvements to the AI analysis pipeline:
1. **Add `ai_reason` column** — LLM explains its sentiment reasoning for evaluation/audit
2. **Skip analysis without crawled content** — only analyze articles with full content; skip decode-failed and crawl-failed articles

## Changes

### 1. SQL Migration (`supabase/migrations/006_add_ai_reason_and_decode_failed.sql`)

Create new migration file:

```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_reason text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS decode_failed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_articles_analysis_candidates
  ON articles (user_id, ai_processed, url_decoded, decode_failed)
  WHERE ai_processed = false AND url_decoded = true AND decode_failed = false;
```

### 2. `lib/types/database.ts` — Add columns to Row/Insert/Update types

In the `articles` Row type, add:
- `ai_reason: string | null`
- `decode_failed: boolean`

In the `articles` Insert type, add:
- `ai_reason?: string | null`
- `decode_failed?: boolean`

In the `articles` Update type, add:
- `ai_reason?: string | null`
- `decode_failed?: boolean`

### 3. `lib/types/news.ts` — Add fields to Article interface

Add to Article interface:
- `aiReason?: string | null`
- `decodeFailed?: boolean`

### 4. `lib/services/llm.ts` — Prompt, AnalysisResult, parser

**AnalysisResult interface** — add `reason: string`

**SYSTEM_PROMPT** — add field #4:
```
4. "reason": A brief 1-2 sentence explanation in Indonesian of why you chose this sentiment.
   Explain the key factors that determined whether the news is positive, negative, or neutral.
```

Update example output to include `reason` field.

**parseAnalysisResponse** — extract and validate `reason` field (string, required; fallback to empty string if missing to avoid breaking).

### 5. `lib/services/urlDecoder.ts` — Mark decode failures

In `decodeAndUpdateArticle()`, on decode failure (around line 196-198), change the update from:
```ts
.update({ url_decoded: true })
```
to:
```ts
.update({ url_decoded: true, decode_failed: true })
```

### 6. `app/api/news/analyze/stream/route.ts` — Filter + skip + store

**Query change** (line 83-84): Add `.eq("decode_failed", false)` filter.

**Crawl-first logic**: After crawl, if `crawlResult.data` is null (crawl failed), mark article as `ai_processed: true` with `ai_error: "Konten artikel tidak dapat diambil"` and skip LLM call. Continue to next article.

**Store ai_reason**: On successful LLM analysis, include `ai_reason: analysisResult.data.reason` in the update.

### 7. `lib/services/news.ts` — Same changes in `analyzeUnprocessedArticles`

**Query change**: Add `.eq("decode_failed", false)` filter to the unprocessed articles query.

**Crawl-first logic**: Same as stream route — skip LLM if crawl fails.

**Store ai_reason**: Include in the update on success.

### 8. `app/api/news/analyze/route.ts` — Verify consistency

This endpoint calls `analyzeUnprocessedArticles()` from `news.ts`, so changes propagate automatically. Just verify no additional adjustments needed.

### 9. Type-check and lint

Run `pnpm tsc --noEmit` and `pnpm eslint` on all modified files.

## Files Modified

| File | Type of Change |
|------|---------------|
| `supabase/migrations/006_add_ai_reason_and_decode_failed.sql` | **New file** |
| `lib/types/database.ts` | Add columns to types |
| `lib/types/news.ts` | Add fields to interface |
| `lib/services/llm.ts` | Prompt + result type + parser |
| `lib/services/urlDecoder.ts` | Set decode_failed on failure |
| `app/api/news/analyze/stream/route.ts` | Filter + skip + store |
| `lib/services/news.ts` | Filter + skip + store |
| `app/api/news/analyze/route.ts` | Verify only |

## User Decisions

- **Crawl failure**: Skip analysis entirely (Option B)
- **Decode failure**: Skip analysis, mark ai_error (Recommended)
- **Column name**: `ai_reason` (general, covers all AI decisions)
- **Migration delivery**: SQL file in repo
- **No UI changes** for now — ai_reason stored for DB querying/evaluation
