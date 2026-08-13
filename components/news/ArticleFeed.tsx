"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiFilterLine,
  RiCloseLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiLoader4Line,
  RiErrorWarningLine,
} from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { ArticleCard } from "./ArticleCard";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { cx } from "@/lib/utils";
import { getFeedArticlesAction, type FeedQueryParams } from "@/app/actions/articles";

interface ArticleFeedProps {
  initialArticles: Article[];
  totalArticles: number;
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
  /** List of all available topic names for filtering. */
  availableTopics?: string[];
  initialCategories?: string[];
  initialSources?: string[];
  /** Number of articles per page (default: 10). */
  pageSize?: number;
}

type SortOption = "newest" | "oldest";
type SentimentFilter = Sentiment | "all";

const DEFAULT_PAGE_SIZE = 10;

export function ArticleFeed({
  initialArticles,
  totalArticles: initialTotal,
  topicMap = {},
  availableTopics = [],
  initialCategories = [],
  initialSources = [],
  pageSize = DEFAULT_PAGE_SIZE,
}: Readonly<ArticleFeedProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentimentParam = searchParams.get("feedSentiment");
  const initialSentiment: SentimentFilter =
    sentimentParam === "positive" || sentimentParam === "neutral" || sentimentParam === "negative"
      ? sentimentParam
      : "all";
  const drilldownDateFrom = searchParams.get("feedFrom");
  const drilldownDateTo = searchParams.get("feedTo");
  const drilldownTopic = searchParams.get("feedTopic");
  const hasKPIDrilldown = initialSentiment !== "all" || Boolean(drilldownDateFrom || drilldownTopic);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>(initialSentiment);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    drilldownTopic ? [drilldownTopic] : [],
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(hasKPIDrilldown);
  const [currentPage, setCurrentPage] = useState(1);

  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(hasKPIDrilldown);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const feedTopRef = useRef<HTMLDivElement>(null);
  const isFirstFeedEffect = useRef(!hasKPIDrilldown);

  // Derive unique topics from availableTopics
  const allTopics = useMemo(() => {
    if (availableTopics.length > 0) return availableTopics;
    return [];
  }, [availableTopics]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const handleSentimentUpdated = useCallback((articleId: string, sentiment: Sentiment) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? {
              ...a,
              sentiment,
              sentimentManuallyOverridden: true,
              aiError: null,
              aiReason: null,
            }
          : a,
      ),
    );
  }, []);

  const handleArticleDeleted = useCallback((articleId: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (isFirstFeedEffect.current) {
      isFirstFeedEffect.current = false;
      return;
    }

    const requestId = ++requestSequence.current;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);
      const params: FeedQueryParams = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch,
        sentiment: sentimentFilter,
        topics: selectedTopics,
        categories: selectedCategories,
        sources: selectedSources,
        sortBy,
        dateFrom: drilldownDateFrom,
        dateTo: drilldownDateTo,
      };
      const res = await getFeedArticlesAction(params);
      if (requestId !== requestSequence.current) return;

      if (res.error) {
        setLoadError("Artikel belum dapat dimuat. Silakan coba lagi.");
      } else {
        setArticles(res.articles);
        setTotal(res.total);
      }
      setIsLoading(false);
    }

    void loadData().catch((error: unknown) => {
      console.error("Failed to load articles", error);
      if (requestId === requestSequence.current) {
        setLoadError("Artikel belum dapat dimuat. Silakan coba lagi.");
        setIsLoading(false);
      }
    });
  }, [
    currentPage,
    debouncedSearch,
    sortBy,
    sentimentFilter,
    selectedTopics,
    selectedCategories,
    selectedSources,
    pageSize,
    initialArticles,
    initialTotal,
    drilldownDateFrom,
    drilldownDateTo,
  ]);


  const totalPages = Math.ceil(total / pageSize);

  function toggleTopic(topic: string) {
    setCurrentPage(1);
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  }

  function clearTopicFilters() {
    setCurrentPage(1);
    setSelectedTopics([]);
  }

  function clearAllFilters() {
    setCurrentPage(1);
    setSearch("");
    setSentimentFilter("all");
    setSelectedTopics([]);
    setSelectedCategories([]);
    setSelectedSources([]);
    setSortBy("newest");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["feedSentiment", "feedTopic", "feedFrom", "feedTo"]) params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | "ellipsis")[] = [1];

    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push("ellipsis");
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  }

  const activeFilterCount =
    (sentimentFilter !== "all" ? 1 : 0) +
    selectedTopics.length +
    selectedCategories.length +
    selectedSources.length +
    (drilldownDateFrom ? 1 : 0);

  return (
    <div id="articles" ref={feedTopRef} className="flex scroll-mt-20 flex-col gap-5">
      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Input
            type="search"
            placeholder="Cari artikel..."
            aria-label="Cari artikel"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <RiFilterLine className="size-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <ExportButton
            totalCount={total}
            topicMap={topicMap}
            exportQuery={{
              search: debouncedSearch,
              sentiment: sentimentFilter,
              topics: selectedTopics,
              categories: selectedCategories,
              sources: selectedSources,
              sortBy,
              dateFrom: drilldownDateFrom,
              dateTo: drilldownDateTo,
            }}
          />
        </div>
      </div>

      {/* Filter options panel */}
      {showFilters && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Persempit hasil</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Gabungkan beberapa filter untuk hasil yang lebih spesifik.</p>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Reset filter
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-gray-600 dark:text-gray-400">Urutan:</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-8 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="newest">Terbaru dahulu</option>
                <option value="oldest">Terlama dahulu</option>
              </select>
            </div>

            {/* Sentiment filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="sentiment" className="text-sm text-gray-600 dark:text-gray-400">Sentimen:</label>
              <select
                id="sentiment"
                value={sentimentFilter}
                onChange={(e) => {
                  setSentimentFilter(e.target.value as SentimentFilter);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-8 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="all">Semua</option>
                <option value="positive">Positif</option>
                <option value="neutral">Netral</option>
                <option value="negative">Negatif</option>
              </select>
            </div>

            {/* Category filter */}
            {initialCategories.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Kategori:</label>
                <div className="w-full min-w-0 sm:w-48">
                  <MultiSelect
                    options={initialCategories}
                    selected={selectedCategories}
                    onChange={(categories) => {
                      setSelectedCategories(categories);
                      setCurrentPage(1);
                    }}
                    placeholder="Semua Kategori"
                    searchPlaceholder="Cari Kategori..."
                  />
                </div>
              </div>
            )}

            {/* Source filter */}
            {initialSources.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Sumber:</label>
                <div className="w-full min-w-0 sm:w-48">
                  <MultiSelect
                    options={initialSources}
                    selected={selectedSources}
                    onChange={(sources) => {
                      setSelectedSources(sources);
                      setCurrentPage(1);
                    }}
                    placeholder="Semua Sumber"
                    searchPlaceholder="Cari Sumber..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Topic filter */}
          {allTopics.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Topik:</span>
                {selectedTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTopicFilters}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Hapus semua
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white dark:bg-blue-500"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      )}
                    >
                      {topic}
                      {isSelected && <RiCloseLine className="size-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400" aria-live="polite">
          Menampilkan {(currentPage - 1) * pageSize + (articles.length > 0 ? 1 : 0)}-{Math.min(currentPage * pageSize, total)} dari {total} artikel
        </p>
        {isLoading && <RiLoader4Line className="size-4 animate-spin text-blue-500" />}
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <RiErrorWarningLine className="size-4 shrink-0" aria-hidden="true" />
          {loadError}
        </div>
      )}

      {/* Article list */}
      <div className={cx("flex flex-col gap-3 transition-opacity duration-200", isLoading && "pointer-events-none opacity-55")} aria-busy={isLoading}>
        {articles.length > 0 ? (
          articles.map((article) => (
            <ArticleCard
              key={article.id ?? article.link}
              article={article}
              topicMap={topicMap}
              onSentimentUpdated={handleSentimentUpdated}
              onArticleDeleted={handleArticleDeleted}
            />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total === 0
                ? "Tidak ada artikel yang cocok dengan kriteria pencarian."
                : "Belum ada artikel. Ambil berita untuk memulai."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === 1 || isLoading
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
            aria-label="Halaman sebelumnya"
          >
            <RiArrowLeftSLine className="size-5" />
          </button>

          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400 dark:text-gray-500">...</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page as number)}
                disabled={isLoading}
                className={cx(
                  "flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  currentPage === page
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                  isLoading && "cursor-not-allowed opacity-50"
                )}
                aria-label={`Halaman ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === totalPages || isLoading
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
            aria-label="Halaman berikutnya"
          >
            <RiArrowRightSLine className="size-5" />
          </button>
        </nav>
      )}
    </div>
  );
}
