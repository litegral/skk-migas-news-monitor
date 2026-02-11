# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Next.js 16 news monitoring dashboard for SKK Migas Kalsul (Kalimantan & Sulawesi).

**Stack:** TypeScript (strict), React 19, Tailwind CSS v4, Tremor Raw (UI),
Supabase (Auth + PostgreSQL), RapidAPI Real-Time News Data, RSS feeds,
SiliconFlow Llama (AI summarization/sentiment/categorization).
**Deploy target:** Vercel.

## Build / Lint / Test Commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Dev server | `pnpm dev` |
| Production build | `pnpm build` |
| Start production server | `pnpm start` |
| Lint (all files) | `pnpm lint` |
| Lint (single file) | `pnpm eslint path/to/file.ts` |
| Type-check only | `pnpm tsc --noEmit` |
| Generate Supabase types | `pnpm supabase gen types typescript --project-id <id> > lib/types/database.ts` |

### Testing

No test framework is configured yet. When one is added (likely Vitest):

```bash
pnpm test                                  # Run all tests
pnpm vitest run path/to/file.test.ts       # Run a single test file
pnpm vitest run -t "test name"             # Run tests matching a name
pnpm vitest                                # Watch mode
```

## Package Manager

**pnpm** (not npm or yarn). Always use `pnpm add`, `pnpm install`, etc.
The lockfile is `pnpm-lock.yaml` -- never delete or bypass it.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` + `@supabase/ssr` | Auth + database client (no ORM) |
| `tailwind-variants`, `clsx`, `tailwind-merge` | Tremor Raw styling utilities |
| `@remixicon/react` | Icon set used by Tremor |
| `recharts` | Charts (used by Tremor visualizations) |
| `@radix-ui/react-*` | Headless UI primitives (used by Tremor) |
| `@tailwindcss/forms` | Form element styling plugin |
| `rss-parser` | RSS/Atom feed parsing |

## Project Structure

```
app/
  (auth)/                    # Auth route group (login, register)
    login/page.tsx
    register/page.tsx
    layout.tsx               # Centered auth layout
  (dashboard)/               # Protected dashboard route group
    dashboard/page.tsx       # Main dashboard (KPIs, charts, news feed)
    settings/page.tsx        # RSS feeds + search query management
    layout.tsx               # Sidebar + topbar layout
  api/news/
    rapidapi/route.ts        # RapidAPI news search endpoint
    rss/route.ts             # RSS feed fetch + parse endpoint
    analyze/route.ts         # SiliconFlow LLM analysis endpoint
  layout.tsx                 # Root layout
  globals.css                # Tailwind v4 + Tremor animations + theme
components/
  ui/                        # Tremor Raw components (copy-paste from tremor.so)
  news/                      # ArticleCard, ArticleFeed, SentimentBadge, CategoryBadge
  dashboard/                 # KPICards, SentimentChart, SourcesBarList, TimelineChart
  settings/                  # RSSFeedManager, SearchQueryManager
  auth/                      # LoginForm, RegisterForm
lib/
  supabase/
    client.ts                # Browser Supabase client (createBrowserClient)
    server.ts                # Server Supabase client (createServerClient)
    proxy.ts                 # updateSession utility for proxy.ts
  services/
    rapidapi.ts              # RapidAPI fetch + normalize
    rss.ts                   # RSS fetch + parse + normalize
    llm.ts                   # SiliconFlow API (OpenAI-compatible)
    news.ts                  # Orchestrator: fetch, dedupe, upsert, analyze
  types/
    news.ts                  # Article, RSSFeed, SearchQuery interfaces
    database.ts              # Generated Supabase types (supabase gen types)
  utils.ts                   # cx(), focusInput, focusRing helpers
  chartUtils.ts              # Tremor chart color utilities
proxy.ts                     # Next.js 16 auth proxy (session refresh)
```

## Architecture & Data Flow

1. User visits dashboard -- fetch enabled search queries + RSS feeds from Supabase.
2. In parallel: call RapidAPI for each query + parse each RSS feed URL.
3. Normalize all results into a common `Article` shape.
4. Upsert into `articles` table (deduplicated by `UNIQUE(user_id, link)`).
5. For articles where `ai_processed = false`, call SiliconFlow Llama.
6. LLM returns: summary, sentiment (positive/negative/neutral), categories.
7. Update articles with AI results. Display in dashboard with charts + feed.

**No ORM.** Use `@supabase/supabase-js` directly. Generate types with
`supabase gen types typescript`. The Supabase client passes the user's JWT
automatically, so RLS policies are enforced transparently.

## Database (Supabase PostgreSQL)

Three tables, all with Row-Level Security (users access only their own rows):

| Table | Purpose |
|-------|---------|
| `rss_feeds` | User's custom RSS feed sources (name, url, enabled) |
| `search_queries` | User's custom RapidAPI search queries (query, enabled) |
| `articles` | Cached news articles with AI analysis fields |

The `articles` table includes: `title`, `link`, `snippet`, `photo_url`,
`source_name`, `source_url`, `published_at`, `source_type` (rapidapi/rss),
`summary`, `sentiment`, `categories` (text[]), `ai_processed` (boolean).

Schema is managed via Supabase SQL editor. Types generated into
`lib/types/database.ts`.

## Authentication (Supabase Auth)

- **Email/password** authentication via Supabase Auth.
- **`proxy.ts`** at project root handles session refresh (Next.js 16 Proxy API).
  Do NOT use `middleware.ts` for auth -- Next.js 16 uses `proxy.ts`.
- **`lib/supabase/proxy.ts`** contains the `updateSession()` utility.
- **Server-side validation:** use `supabase.auth.getClaims()` (NOT `getSession()`).
  `getClaims()` validates JWT signature; `getSession()` does not revalidate.
- **Browser client:** `lib/supabase/client.ts` (uses `createBrowserClient`).
- **Server client:** `lib/supabase/server.ts` (uses `createServerClient`).

## Code Style Guidelines

### TypeScript

- **Strict mode is ON** (`"strict": true`). Never disable it.
- Use explicit types for function parameters and return types in non-trivial functions.
- Prefer `interface` for object shapes, `type` for unions/intersections/utility types.
- Use `Readonly<>` wrapper on component props types.
- Avoid `any`. Use `unknown` when the type is truly unknown, then narrow.
- Target is ES2017; do not use features unavailable in that target unless polyfilled.

### Imports

- Use `import type { ... }` for type-only imports (enforced by eslint).
- Use double quotes: `import { Foo } from "bar"`.
- Use the `@/*` path alias: `import { util } from "@/lib/util"`.
- Order: external packages, then `@/` imports, then relative imports.

### Formatting

No Prettier configured. Follow these conventions:

- **2-space indentation** (no tabs).
- **Double quotes** for strings (JS/TS and JSX attributes).
- **Semicolons** at end of statements.
- **Trailing commas** in multi-line arrays, objects, and parameter lists.
- Max line length: ~100 characters.

### Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `ArticleCard` |
| Functions / variables | camelCase | `fetchArticles` |
| Constants | camelCase or UPPER_SNAKE_CASE | `API_BASE_URL` |
| Types / Interfaces | PascalCase | `ArticleData` |
| Files (components) | PascalCase or kebab-case | `SentimentBadge.tsx` |
| Files (utilities) | camelCase or kebab-case | `rapidapi.ts` |

### React / Next.js Patterns

- **App Router** only (`app/` directory). No `pages/` directory.
- Default-export page/layout components.
- Prefer **Server Components** by default (no `"use client"` unless needed).
- Add `"use client"` only for hooks, event handlers, or browser APIs.
- Export `metadata` objects from page/layout files for SEO.
- Use `next/image` for images, `next/link` for navigation.

### Styling

- **Tailwind CSS v4** via `@tailwindcss/postcss`.
- **Tremor Raw** components in `components/ui/` (copied from tremor.so).
- **`@tailwindcss/forms`** plugin imported in `globals.css`.
- Dark mode: `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`.
- Tremor animations defined in `@theme` block in `globals.css`.
- Use `cx()` from `lib/utils.ts` for conditional class merging (not raw `clsx`).
- Do not use CSS Modules or styled-components.

### Error Handling

- Use `error.tsx` files in route segments for UI error boundaries.
- Use `not-found.tsx` for custom 404 pages.
- In route handlers / server actions: try/catch, return `{ data, error }` shape.
- Never silently swallow errors. Always log or surface them.
- Use `loading.tsx` for Suspense-based loading states.

## API Conventions

- Route handlers in `app/api/` return `NextResponse.json()`.
- Consistent response shape: `{ data: T | null, error: string | null }`.
- Server-only keys (`RAPIDAPI_KEY`, `SILICONFLOW_API_KEY`) -- no `NEXT_PUBLIC_` prefix.
- SiliconFlow uses OpenAI-compatible chat completions format.
- RSS parsing via `rss-parser` library (handles RSS 2.0, Atom, etc.).

## Environment Variables

All secrets in `.env.local` (gitignored). Document in `.env.example`.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase publishable/anon key |
| `RAPIDAPI_KEY` | Server only | RapidAPI Real-Time News Data key |
| `SILICONFLOW_API_KEY` | Server only | SiliconFlow API key |
| `SILICONFLOW_MODEL` | Server only | Model ID (e.g. `meta-llama/Llama-3.3-70B-Instruct`) |

## ESLint Configuration

ESLint v9 flat config in `eslint.config.mjs`:
- Extends `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.
- Ignores `.next/`, `out/`, `build/`, `next-env.d.ts`.

Run `pnpm lint` before committing. Fix all warnings and errors.

## Git Conventions

- Branch: `main`.
- Keep commits focused and descriptive.
- Do not commit `.env*`, `node_modules/`, `.next/`, or `coverage/`.
